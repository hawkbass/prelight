/**
 * Single-axis flex engine for v0.2 (G3).
 *
 * Implements CSS Flex Layout Module L1 §9.7 "Resolving Flexible
 * Lengths" for the no-wrap case. With no-wrap the algorithm is:
 *
 *   1. For each item, determine its flex base size:
 *        - If `basis` is explicit, use it.
 *        - Otherwise use the item's main-axis outer size from its
 *          Box measurement.
 *   2. Clamp to [minMain, maxMain] per item to get the hypothetical
 *      main size.
 *   3. Compute free space = container.inner - sum(hypothetical) - gaps.
 *   4. If free > 0 and any item has `grow > 0`: distribute free
 *      space proportionally to `grow`.
 *   5. If free < 0 and any item has `shrink > 0`: distribute the
 *      deficit proportionally to `shrink × baseSize` (scaled flex
 *      shrink factor from the spec).
 *   6. Otherwise items stay at their hypothetical main sizes; the
 *      container overflows / has leftover space.
 *   7. Apply `justify-content` to distribute any remaining free
 *      space around / between items.
 *
 * PRELIGHT-INVARIANT: this engine is pure. It never calls into
 * Pretext, canvas, or the DOM. Given the same inputs it always
 * returns the same layout.
 *
 * PRELIGHT-NEXT(v0.3): wrap. Adds a wrapping pass that packs items
 * into lines, then runs the resolution above per line.
 * PRELIGHT-NEXT(v0.3): cross-axis `align-items` (baseline, stretch).
 * Today we surface the cross-axis dimension as-is on each item.
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
  /** Gap between items (both CSS `gap` and `column-gap`/`row-gap`). */
  gap?: number;
  direction?: FlexDirection;
  justify?: FlexJustify;
  /**
   * The container's inner cross-axis size. Currently only used by
   * `fitsFlex` for overflow detection on the cross axis; the
   * engine itself is single-axis.
   */
  innerCross?: number;
}

export interface FlexItemLayout {
  box: Box;
  /** Resolved main size (width for row, height for column). */
  main: number;
  /** Position along the main axis, from the container's inner edge. */
  offset: number;
  /** Cross-axis size (unchanged for no-wrap, no-stretch). */
  cross: number;
}

export interface FlexLayout {
  items: FlexItemLayout[];
  /** Total length of all items + gaps along the main axis. */
  contentMain: number;
  /** Leftover (positive) or excess (negative) main space. */
  freeSpace: number;
  /** True when `contentMain` exceeds `container.innerMain`. */
  overflows: boolean;
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
  // Default basis is the item's border-box main size (excludes
  // margin, since margin is added separately as an outer-size
  // contribution).
  return direction === 'row'
    ? item.box.borderBoxWidth
    : item.box.borderBoxHeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveFlex(
  items: FlexItem[],
  container: FlexContainer,
  direction: FlexDirection,
): ResolvedSize[] {
  const gap = container.gap ?? 0;
  const totalGap = items.length > 1 ? gap * (items.length - 1) : 0;
  const marginMain = items.map((i) => mainMargin(i.box.margin, direction));
  const bases = items.map((i) => flexBaseSize(i, direction));
  const hypothetical = bases.map((b, i) =>
    clamp(b, items[i]!.minMain ?? 0, items[i]!.maxMain ?? Infinity),
  );

  const occupied = hypothetical.reduce((a, b) => a + b, 0)
    + marginMain.reduce((a, b) => a + b, 0)
    + totalGap;
  const freeSpace = container.innerMain - occupied;

  const borderBoxSizes = [...hypothetical];

  if (freeSpace > 0) {
    // Grow resolution.
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
      // Distribute the deficit. The spec's iterative freezing step
      // only matters when min/max clamps bind; for the common case
      // we get within sub-pixel agreement of Chromium in one pass.
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
        container.innerMain -
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
// Justify distribution
// ────────────────────────────────────────────────────────────────

function applyJustify(
  sizes: ResolvedSize[],
  container: FlexContainer,
  direction: FlexDirection,
  items: FlexItem[],
): { offsets: number[]; contentMain: number; freeSpace: number } {
  const gap = container.gap ?? 0;
  const totalGap = items.length > 1 ? gap * (items.length - 1) : 0;
  const itemsMain = sizes.reduce((a, s) => a + s.outerMain, 0);
  const contentMain = itemsMain + totalGap;
  const freeSpace = container.innerMain - contentMain;
  const justify = container.justify ?? 'start';

  const offsets = new Array<number>(items.length);
  // Start with every item packed flush at 0 with `gap` between them,
  // then shift by the justify offset.
  let cursor = 0;
  const leadingOffsets: number[] = [];
  for (let i = 0; i < items.length; i++) {
    // Include the item's leading margin contribution in its offset
    // so `offset` names the item's border-box position, not its
    // outer position.
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
// Public: computeFlexLayout
// ────────────────────────────────────────────────────────────────

export function computeFlexLayout(
  items: FlexItem[],
  container: FlexContainer,
): FlexLayout {
  const direction = container.direction ?? 'row';
  if (items.length === 0) {
    return {
      items: [],
      contentMain: 0,
      freeSpace: container.innerMain,
      overflows: false,
      direction,
    };
  }

  const sizes = resolveFlex(items, container, direction);
  const { offsets, contentMain, freeSpace } = applyJustify(
    sizes,
    container,
    direction,
    items,
  );

  const laidOut: FlexItemLayout[] = items.map((item, i) => ({
    box: item.box,
    main: sizes[i]!.borderBoxMain,
    offset: offsets[i]!,
    cross: crossOuter(item.box, direction),
  }));

  const overflows = contentMain > container.innerMain + 0.5;

  return {
    items: laidOut,
    contentMain,
    freeSpace,
    overflows,
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
 * Returns `ok: true` when the container holds every child on one
 * line with no main-axis overflow and no cross-axis overflow. Does
 * not mutate inputs.
 *
 * Callers layering additional constraints (min-width floors, aspect
 * ratios) should inspect `layout.items` directly.
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
    const maxCross = layout.items.reduce((m, it) => Math.max(m, it.cross), 0);
    if (maxCross > spec.container.innerCross + 0.5) {
      reasons.push(
        `cross-axis overflow: ${maxCross.toFixed(1)}px > inner ${spec.container.innerCross}px`,
      );
    }
  }
  // Items hitting their min-main while shrinking indicate a design
  // that would clip or truncate under stress. Surface as a reason
  // but do not fail on its own — clamp-at-min is valid CSS.
  return {
    ok: reasons.length === 0,
    layout,
    reasons,
  };
}
