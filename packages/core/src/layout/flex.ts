/**
 * Single-axis flex engine.
 *
 * Implements CSS Flex Layout Module L1 §9 ("Resolving Flexible
 * Lengths") including multi-line wrapping (§9.3) and cross-axis
 * alignment (§8.3). The core main-axis resolution is identical to
 * the v0.2 (G3) engine; H1 (v0.3) adds a wrapping pre-pass that
 * packs items into lines and then runs main-axis resolution per
 * line, plus a cross-axis alignment pass.
 *
 * Algorithm overview:
 *
 *   1. If `wrap === 'wrap'`, pack items into lines greedily using
 *      each item's hypothetical outer main size (basis + margin),
 *      breaking before any item that would push the line past
 *      `container.innerMain`. With `wrap === 'nowrap'` (default),
 *      all items go onto one line.
 *   2. For each line, run the §9.7 main-axis resolution:
 *        a. Determine flex base size (explicit basis, or item's
 *           border-box main size).
 *        b. Clamp to [minMain, maxMain] → hypothetical main size.
 *        c. Compute free space = line.innerMain - sum(hypothetical)
 *           - sum(margin) - totalGap.
 *        d. If free > 0 and any item has `grow > 0`: distribute
 *           free space proportionally to `grow`.
 *        e. If free < 0 and any item has `shrink > 0`: distribute
 *           the deficit proportionally to `shrink × baseSize`
 *           (scaled flex shrink factor from the spec).
 *        f. Otherwise items stay at their hypothetical main sizes;
 *           the line overflows.
 *   3. Apply `justify-content` per line to distribute leftover
 *      main-axis free space around / between items.
 *   4. Stack lines along the cross axis starting at cross-start,
 *      separated by `crossGap` (defaults to `gap`).
 *   5. For each line, apply `align-items`:
 *        - `start` (default): items sit at the line's cross-start.
 *        - `end`: items sit flush against the line's cross-end.
 *        - `center`: items are centred in the line.
 *        - `stretch`: items expand to the line's full cross size
 *          (which is `innerCross` when defined and the flex is a
 *          single line, otherwise the max cross-outer of the
 *          line's items).
 *
 * PRELIGHT-INVARIANT: this engine is pure. It never calls into
 * Pretext, canvas, or the DOM. Given the same inputs it always
 * returns the same layout.
 *
 * PRELIGHT-NEXT(v0.3 H5): `align-items: 'baseline'`. Baseline
 * alignment needs each item's first-baseline offset (from the
 * item's border-box top to its primary text baseline). That value
 * arrives with H5's `VerifySpec.measurementFonts` which threads
 * font metrics (ascent/descent) through `Measurement`. Landing
 * baseline alongside measurementFonts keeps the data and the
 * algorithm colocated.
 *
 * PRELIGHT-NEXT(v0.4+): `align-content` (distribute cross-axis
 * free space between wrapped lines). Today lines pack flush
 * against the cross-start edge.
 *
 * PRELIGHT-NEXT(v1.0): intrinsic flex-basis:content resolution.
 */

import type { Box, EdgeInsets } from './box.js';

export type FlexDirection = 'row' | 'column';
export type FlexJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
export type FlexWrap = 'nowrap' | 'wrap';
export type FlexAlign = 'start' | 'end' | 'center' | 'stretch';

export interface FlexItem {
  box: Box;
  /** `flex-grow`. Defaults to 0. */
  grow?: number;
  /** `flex-shrink`. Defaults to 1 (matches CSS default). */
  shrink?: number;
  /**
   * `flex-basis` in px. Defaults to the main-axis outer size of
   * `box`. Use `null` to be explicit that you want the default.
   */
  basis?: number | null;
  /** `min-width` / `min-height` clamp. Defaults to 0. */
  minMain?: number;
  /** `max-width` / `max-height` clamp. Defaults to Infinity. */
  maxMain?: number;
}

export interface FlexContainer {
  /**
   * The container's inner main-axis size: the length along the
   * flex direction *after* subtracting the container's own padding
   * and border. Callers typically compute this from a parent Box.
   */
  innerMain: number;
  /** Gap between items along the main axis (CSS `column-gap` for
   *  row, `row-gap` for column). Also used for between-line gap if
   *  `crossGap` is not supplied, matching the CSS `gap` shorthand. */
  gap?: number;
  /**
   * Between-line gap along the cross axis when `wrap === 'wrap'`.
   * Defaults to `gap`. Corresponds to the second value in the CSS
   * `gap: <row> <column>` shorthand (with role swap for `column`
   * direction).
   */
  crossGap?: number;
  direction?: FlexDirection;
  justify?: FlexJustify;
  /**
   * Single-line (`'nowrap'`, default) or multi-line (`'wrap'`). In
   * `'wrap'` mode items that do not fit on the current line move
   * to a fresh line at the line-start of the next cross-axis row.
   */
  wrap?: FlexWrap;
  /**
   * Cross-axis alignment for items within each line. Defaults to
   * `'start'`. `'stretch'` expands items to fill the line's cross
   * size (or the container's `innerCross` on single-line layouts
   * where it is defined).
   */
  align?: FlexAlign;
  /**
   * The container's inner cross-axis size. Required for meaningful
   * `'stretch'` behaviour on a single line and for cross-axis
   * overflow detection (via `fitsFlex`). May be left undefined
   * when the container's cross axis is intrinsic.
   */
  innerCross?: number;
}

export interface FlexItemLayout {
  box: Box;
  /** Resolved main size (width for row, height for column). */
  main: number;
  /** Position along the main axis, from the container's inner edge. */
  offset: number;
  /**
   * Cross-axis size. For `align: 'start' | 'end' | 'center'` this
   * is the item's natural cross outer size. For `align: 'stretch'`
   * it is expanded to the line's cross extent (minus the item's
   * cross-axis margin).
   */
  cross: number;
  /**
   * Position along the cross axis, from the container's inner
   * cross-start edge. Includes the item's leading cross-axis
   * margin.
   */
  crossOffset: number;
}

export interface FlexLineLayout {
  items: FlexItemLayout[];
  /** Total main-axis extent consumed by this line's items + gaps. */
  mainExtent: number;
  /** Cross-axis position of the line's start, from the container's
   *  inner cross-start edge. */
  crossStart: number;
  /** Cross-axis extent of this line (max of item crossOuter; expanded
   *  to `innerCross` for single-line stretch when available). */
  crossSize: number;
}

export interface FlexLayout {
  /** Flattened item list across all lines. Index order matches
   *  input item order. */
  items: FlexItemLayout[];
  /** One entry per line. For `wrap: 'nowrap'` this is a single
   *  line containing every item. */
  lines: FlexLineLayout[];
  /** Largest `line.mainExtent` across all lines. On `nowrap` this
   *  equals the single line's main extent. */
  contentMain: number;
  /** Total cross-axis extent consumed by lines + between-line gaps. */
  contentCross: number;
  /** `container.innerMain - contentMain`. Negative when the widest
   *  line exceeds the container. */
  freeSpace: number;
  /** True when any line's `mainExtent` exceeds `container.innerMain`.
   *  On `wrap` this only happens when a single item is larger than
   *  the container (wrapping places it on its own line). */
  overflows: boolean;
  /** True when `contentCross` exceeds `container.innerCross` (only
   *  when `innerCross` is defined). */
  crossOverflows: boolean;
  direction: FlexDirection;
}

// ────────────────────────────────────────────────────────────────
// Item geometry helpers
// ────────────────────────────────────────────────────────────────

/**
 * Main-axis outer size of a box, picked by direction. For row we
 * use borderBoxWidth + horizontal margin; for column we use
 * borderBoxHeight + vertical margin. (Margin is NOT collapsed on a
 * flex line; that's block-only behaviour — CSS Flex L1 §4.2.)
 */
function mainOuter(b: Box, direction: FlexDirection): number {
  if (direction === 'row') return b.outerWidth;
  return b.outerHeight;
}

function crossOuter(b: Box, direction: FlexDirection): number {
  if (direction === 'row') return b.outerHeight;
  return b.outerWidth;
}

function mainMargin(edges: EdgeInsets, direction: FlexDirection): number {
  if (direction === 'row') return edges.left + edges.right;
  return edges.top + edges.bottom;
}

function crossMargin(edges: EdgeInsets, direction: FlexDirection): number {
  if (direction === 'row') return edges.top + edges.bottom;
  return edges.left + edges.right;
}

function leadingCrossMargin(edges: EdgeInsets, direction: FlexDirection): number {
  if (direction === 'row') return edges.top;
  return edges.left;
}

// ────────────────────────────────────────────────────────────────
// Resolve main sizes (CSS Flex L1 §9.7)
// ────────────────────────────────────────────────────────────────

interface ResolvedSize {
  /** The item's final main-axis *border-box* size (not outer). */
  borderBoxMain: number;
  /** The item's main-axis outer size (including margin). */
  outerMain: number;
}

function flexBaseSize(item: FlexItem, direction: FlexDirection): number {
  if (typeof item.basis === 'number') return item.basis;
  return direction === 'row'
    ? item.box.borderBoxWidth
    : item.box.borderBoxHeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveFlex(
  items: FlexItem[],
  innerMain: number,
  gap: number,
  direction: FlexDirection,
): ResolvedSize[] {
  const totalGap = items.length > 1 ? gap * (items.length - 1) : 0;
  const marginMain = items.map((i) => mainMargin(i.box.margin, direction));
  const bases = items.map((i) => flexBaseSize(i, direction));
  const hypothetical = bases.map((b, i) =>
    clamp(b, items[i]!.minMain ?? 0, items[i]!.maxMain ?? Infinity),
  );

  const occupied = hypothetical.reduce((a, b) => a + b, 0)
    + marginMain.reduce((a, b) => a + b, 0)
    + totalGap;
  const freeSpace = innerMain - occupied;

  const borderBoxSizes = [...hypothetical];

  if (freeSpace > 0) {
    const grows = items.map((i) => i.grow ?? 0);
    const totalGrow = grows.reduce((a, b) => a + b, 0);
    if (totalGrow > 0) {
      for (let i = 0; i < items.length; i++) {
        const share = (grows[i]! / totalGrow) * freeSpace;
        borderBoxSizes[i] = clamp(
          borderBoxSizes[i]! + share,
          items[i]!.minMain ?? 0,
          items[i]!.maxMain ?? Infinity,
        );
      }
    }
  } else if (freeSpace < 0) {
    // Shrink resolution per §9.7-4b: scaled flex shrink factor.
    const shrinks = items.map((i) => i.shrink ?? 1);
    const scaledShrinks = shrinks.map((s, i) => s * bases[i]!);
    const totalScaled = scaledShrinks.reduce((a, b) => a + b, 0);
    if (totalScaled > 0) {
      for (let i = 0; i < items.length; i++) {
        const share = (scaledShrinks[i]! / totalScaled) * freeSpace;
        borderBoxSizes[i] = clamp(
          borderBoxSizes[i]! + share,
          items[i]!.minMain ?? 0,
          items[i]!.maxMain ?? Infinity,
        );
      }
      // Second pass: if any items bound to min, redistribute the
      // remaining deficit among the unfrozen items. Handles "two
      // items shrink, one hits min-width: 40" cases.
      const residual =
        innerMain -
        (borderBoxSizes.reduce((a, b) => a + b, 0) +
          marginMain.reduce((a, b) => a + b, 0) +
          totalGap);
      if (residual < -0.5) {
        const unfrozen: number[] = [];
        for (let i = 0; i < items.length; i++) {
          const atMin = borderBoxSizes[i]! <= (items[i]!.minMain ?? 0) + 0.5;
          if (!atMin && (items[i]!.shrink ?? 1) > 0) unfrozen.push(i);
        }
        const unfrozenScaled = unfrozen.reduce(
          (a, i) => a + (items[i]!.shrink ?? 1) * bases[i]!,
          0,
        );
        if (unfrozenScaled > 0) {
          for (const i of unfrozen) {
            const share =
              ((items[i]!.shrink ?? 1) * bases[i]! / unfrozenScaled) * residual;
            borderBoxSizes[i] = clamp(
              borderBoxSizes[i]! + share,
              items[i]!.minMain ?? 0,
              items[i]!.maxMain ?? Infinity,
            );
          }
        }
      }
    }
  }

  return borderBoxSizes.map((s, i) => ({
    borderBoxMain: s,
    outerMain: s + marginMain[i]!,
  }));
}

// ────────────────────────────────────────────────────────────────
// Wrap packing (CSS Flex L1 §9.3)
// ────────────────────────────────────────────────────────────────

/**
 * Pack items into lines greedily by their hypothetical outer main
 * size (base size clamped to min/max, plus leading margin, plus
 * trailing margin, plus gap). An item that by itself exceeds
 * `innerMain` still gets placed alone on its own line (per the
 * spec; the line is flagged as overflowing later).
 *
 * This function operates on input-order indices and does NOT
 * resolve grow/shrink — that happens per line after packing. Using
 * hypothetical size for the packing decision matches Chromium and
 * Firefox; items that would shrink to fit still move to the next
 * line if their hypothetical size overflows.
 */
function packLines(
  items: FlexItem[],
  innerMain: number,
  gap: number,
  direction: FlexDirection,
): FlexItem[][] {
  if (items.length === 0) return [];
  const lines: FlexItem[][] = [];
  let current: FlexItem[] = [];
  let currentExtent = 0;
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const base = flexBaseSize(item, direction);
    const hypothetical = clamp(
      base,
      item.minMain ?? 0,
      item.maxMain ?? Infinity,
    );
    const outer = hypothetical + mainMargin(item.box.margin, direction);

    if (current.length === 0) {
      current.push(item);
      currentExtent = outer;
      continue;
    }
    const nextExtent = currentExtent + gap + outer;
    if (nextExtent > innerMain + 0.5) {
      lines.push(current);
      current = [item];
      currentExtent = outer;
    } else {
      current.push(item);
      currentExtent = nextExtent;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

// ────────────────────────────────────────────────────────────────
// Justify distribution (per line)
// ────────────────────────────────────────────────────────────────

function applyJustify(
  sizes: ResolvedSize[],
  innerMain: number,
  gap: number,
  justify: FlexJustify,
  direction: FlexDirection,
  items: FlexItem[],
): { offsets: number[]; contentMain: number; freeSpace: number } {
  const totalGap = items.length > 1 ? gap * (items.length - 1) : 0;
  const itemsMain = sizes.reduce((a, s) => a + s.outerMain, 0);
  const contentMain = itemsMain + totalGap;
  const freeSpace = innerMain - contentMain;

  const offsets = new Array<number>(items.length);
  let cursor = 0;
  const leadingOffsets: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const leadingMargin =
      direction === 'row' ? items[i]!.box.margin.left : items[i]!.box.margin.top;
    leadingOffsets[i] = cursor + leadingMargin;
    cursor += sizes[i]!.outerMain + gap;
  }

  let bias = 0;
  let itemGapExtra = 0;
  if (freeSpace > 0) {
    switch (justify) {
      case 'start':
        bias = 0;
        break;
      case 'end':
        bias = freeSpace;
        break;
      case 'center':
        bias = freeSpace / 2;
        break;
      case 'space-between':
        if (items.length > 1) itemGapExtra = freeSpace / (items.length - 1);
        break;
      case 'space-around':
        itemGapExtra = freeSpace / items.length;
        bias = itemGapExtra / 2;
        break;
      case 'space-evenly':
        itemGapExtra = freeSpace / (items.length + 1);
        bias = itemGapExtra;
        break;
      default:
        bias = 0;
    }
  }

  for (let i = 0; i < items.length; i++) {
    offsets[i] = leadingOffsets[i]! + bias + itemGapExtra * i;
  }

  return { offsets, contentMain, freeSpace };
}

// ────────────────────────────────────────────────────────────────
// Cross-axis alignment
// ────────────────────────────────────────────────────────────────

/**
 * Compute per-item cross sizes and cross offsets within a line.
 * `lineCrossSize` is the line's cross extent (already decided by
 * the caller). For `stretch`, items expand to fill the line
 * minus their cross-axis margin. For `start | end | center`,
 * items keep their natural cross-outer size and are positioned
 * within the line.
 */
function applyAlign(
  items: FlexItem[],
  lineCrossSize: number,
  align: FlexAlign,
  direction: FlexDirection,
): { cross: number[]; crossOffset: number[] } {
  const cross = new Array<number>(items.length);
  const crossOffset = new Array<number>(items.length);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const leading = leadingCrossMargin(item.box.margin, direction);
    const margin = crossMargin(item.box.margin, direction);
    const naturalOuter = crossOuter(item.box, direction);
    const naturalBorderBox = naturalOuter - margin;

    if (align === 'stretch') {
      const stretched = Math.max(0, lineCrossSize - margin);
      cross[i] = stretched;
      crossOffset[i] = leading;
    } else {
      cross[i] = naturalBorderBox;
      const slack = lineCrossSize - naturalOuter;
      let bias = 0;
      if (align === 'end') bias = slack;
      else if (align === 'center') bias = slack / 2;
      crossOffset[i] = leading + bias;
    }
  }
  return { cross, crossOffset };
}

// ────────────────────────────────────────────────────────────────
// Public: computeFlexLayout
// ────────────────────────────────────────────────────────────────

export function computeFlexLayout(
  items: FlexItem[],
  container: FlexContainer,
): FlexLayout {
  const direction = container.direction ?? 'row';
  const wrap = container.wrap ?? 'nowrap';
  const align = container.align ?? 'start';
  const justify = container.justify ?? 'start';
  const gap = container.gap ?? 0;
  const crossGap = container.crossGap ?? gap;

  if (items.length === 0) {
    return {
      items: [],
      lines: [],
      contentMain: 0,
      contentCross: 0,
      freeSpace: container.innerMain,
      overflows: false,
      crossOverflows: false,
      direction,
    };
  }

  // Phase 1: pack items into lines.
  const lineItems: FlexItem[][] =
    wrap === 'wrap'
      ? packLines(items, container.innerMain, gap, direction)
      : [items.slice()];

  // Phase 2: resolve main-axis sizes and justify per line.
  interface LineResolved {
    items: FlexItem[];
    sizes: ResolvedSize[];
    offsets: number[];
    contentMain: number;
    freeSpace: number;
  }
  const resolved: LineResolved[] = lineItems.map((lineSet) => {
    const sizes = resolveFlex(lineSet, container.innerMain, gap, direction);
    const j = applyJustify(
      sizes,
      container.innerMain,
      gap,
      justify,
      direction,
      lineSet,
    );
    return {
      items: lineSet,
      sizes,
      offsets: j.offsets,
      contentMain: j.contentMain,
      freeSpace: j.freeSpace,
    };
  });

  // Phase 3: decide each line's cross size.
  // - Natural: max crossOuter of the line's items.
  // - Single-line + innerCross defined: expand to at least
  //   innerCross so that `align-items: {start|end|center|stretch}`
  //   position within the container's full cross axis (CSS Flex
  //   L1 §9.4: single-line definite-cross flex lines take the
  //   container's inner cross size). If the tallest item still
  //   exceeds innerCross the line grows to fit (with
  //   crossOverflows reported).
  //
  // Multi-line (`wrap: 'wrap'`): each line's cross size is the
  // max crossOuter of its items. `align-content` (distributing
  // unused container cross space between lines) is deferred to a
  // future release — today lines pack flush against the
  // cross-start edge.
  const lineCrossSizes: number[] = resolved.map((line) => {
    let max = 0;
    for (const it of line.items) {
      max = Math.max(max, crossOuter(it.box, direction));
    }
    return max;
  });
  const singleLine = resolved.length === 1;
  if (singleLine && typeof container.innerCross === 'number') {
    lineCrossSizes[0] = Math.max(lineCrossSizes[0]!, container.innerCross);
  }

  // Phase 4: stack lines along cross axis + apply align-items.
  const lines: FlexLineLayout[] = [];
  const flatItems: FlexItemLayout[] = new Array(items.length);
  let crossCursor = 0;
  let maxMainExtent = 0;
  for (let li = 0; li < resolved.length; li++) {
    const line = resolved[li]!;
    const lineCrossSize = lineCrossSizes[li]!;
    const { cross, crossOffset } = applyAlign(
      line.items,
      lineCrossSize,
      align,
      direction,
    );

    const laidOut: FlexItemLayout[] = line.items.map((_item, i) => ({
      box: line.items[i]!.box,
      main: line.sizes[i]!.borderBoxMain,
      offset: line.offsets[i]!,
      cross: cross[i]!,
      crossOffset: crossCursor + crossOffset[i]!,
    }));

    lines.push({
      items: laidOut,
      mainExtent: line.contentMain,
      crossStart: crossCursor,
      crossSize: lineCrossSize,
    });
    maxMainExtent = Math.max(maxMainExtent, line.contentMain);

    // Write back into the flat `items` array at the original indices.
    let writeIdx = 0;
    for (let li2 = 0; li2 < li; li2++) writeIdx += resolved[li2]!.items.length;
    for (let i = 0; i < laidOut.length; i++) {
      flatItems[writeIdx + i] = laidOut[i]!;
    }

    crossCursor += lineCrossSize;
    if (li < resolved.length - 1) crossCursor += crossGap;
  }

  const contentCross = crossCursor;
  const contentMain = maxMainExtent;
  const freeSpace = container.innerMain - contentMain;
  const overflows = contentMain > container.innerMain + 0.5;
  const crossOverflows =
    typeof container.innerCross === 'number' &&
    contentCross > container.innerCross + 0.5;

  return {
    items: flatItems,
    lines,
    contentMain,
    contentCross,
    freeSpace,
    overflows,
    crossOverflows,
    direction,
  };
}

// ────────────────────────────────────────────────────────────────
// fitsFlex predicate
// ────────────────────────────────────────────────────────────────

export interface FitsFlexSpec {
  container: FlexContainer;
  children: FlexItem[];
}

export interface FitsFlexResult {
  ok: boolean;
  layout: FlexLayout;
  reasons: string[];
}

/**
 * Returns `ok: true` when every line fits within the container's
 * main axis and the stacked lines fit within the container's
 * cross axis (when `innerCross` is supplied). Does not mutate
 * inputs.
 *
 * On `wrap: 'nowrap'` this reduces to the v0.2 behaviour: one
 * line must hold every child without main-axis overflow.
 */
export function fitsFlex(spec: FitsFlexSpec): FitsFlexResult {
  const layout = computeFlexLayout(spec.children, spec.container);
  const reasons: string[] = [];
  if (layout.overflows) {
    reasons.push(
      `main-axis overflow: content ${layout.contentMain.toFixed(1)}px > inner ${spec.container.innerMain}px`,
    );
  }
  if (spec.container.innerCross !== undefined) {
    if (layout.crossOverflows) {
      reasons.push(
        `cross-axis overflow: ${layout.contentCross.toFixed(1)}px > inner ${spec.container.innerCross}px`,
      );
    } else if ((spec.container.wrap ?? 'nowrap') === 'nowrap') {
      // On nowrap, `crossOverflows` reports the single line's
      // cross extent. We also want to flag a line whose max item
      // crossOuter exceeds innerCross even when contentCross has
      // already been clamped. In practice the two match because
      // lineCrossSize is the max crossOuter for non-stretch align
      // modes, so this branch is a belt-and-braces check.
      const line = layout.lines[0];
      if (line !== undefined && line.crossSize > spec.container.innerCross + 0.5) {
        reasons.push(
          `cross-axis overflow: ${line.crossSize.toFixed(1)}px > inner ${spec.container.innerCross}px`,
        );
      }
    }
  }
  return {
    ok: reasons.length === 0,
    layout,
    reasons,
  };
}
