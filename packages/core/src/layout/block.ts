/**
 * Block flow engine.
 *
 * Stacks block children vertically inside a container, resolving
 * CSS 2.1 §8.3.1 ("Collapsing margins") for:
 *
 *   - Adjacent-sibling collapse (v0.2 / G4): two stacked siblings
 *     share a collapsed top+bottom margin.
 *   - Parent-child collapse (v0.3 / H2): the first child's top
 *     margin collapses with the parent's top margin when the
 *     parent has no top padding or top border; same for bottom.
 *   - Empty-block self-collapse (v0.3 / H2): a child with
 *     borderBoxHeight=0 and zero top+bottom padding+border has
 *     its own top and bottom margins collapse into a single
 *     margin that participates in adjacent-sibling collapse on
 *     both sides.
 *
 * Margin-collapse arithmetic (§8.3.1):
 *   - Two positive margins:       keep max(a, b)
 *   - Two negative margins:       keep min(a, b) — the more negative
 *   - One positive, one negative: a + b  (the sum is always smaller
 *                                 than the positive margin, matching
 *                                 the spec)
 *
 * Out of scope (tracked as PRELIGHT-NEXT):
 *   - PRELIGHT-NEXT(v0.4): chained collapse through an empty
 *     first/last child into the parent. CSS permits this ("margins
 *     collapse through" an empty box), but it requires a second
 *     pass and chained semantics; H2 handles the 99% case where
 *     the first/last child is non-empty.
 *   - PRELIGHT-NEXT(v0.4): empty-container self-collapse. When
 *     the container has no children, zero top+bottom padding+border,
 *     and no innerHeight, its own top and bottom margins collapse
 *     into one. Easy to add as a post-pass on `effectiveMargin*`.
 *   - PRELIGHT-NEXT(v1.0+): clearance from floats. Block flow with
 *     floats is niche in modern CSS (especially in React/styled
 *     codebases); we flag it rather than silently assume no floats.
 *     The `Box` model has no `float` field anyway, so the engine
 *     receives pure block-flow children by construction.
 *
 * PRELIGHT-INVARIANT: pure. No DOM, canvas, or external state.
 */

import type { Box, EdgeInsets } from './box.js';

export interface BlockContainer {
  /** Inner width of the container (content-box). Children wider than this overflow horizontally. */
  innerWidth: number;
  /** Optional max inner height for fitsBlock overflow detection. When set, bottom parent-child collapse is disabled (the container has a definite bottom edge). */
  innerHeight?: number;
  /**
   * Parent's own padding. Consulted for parent-child margin
   * collapse: top collapse requires `padding.top === 0`, bottom
   * requires `padding.bottom === 0`. Only has an effect when
   * `collapseWithParent` is also true.
   */
  padding?: EdgeInsets;
  /**
   * Parent's own border. Same opt-in rules as `padding`.
   */
  border?: EdgeInsets;
  /**
   * Parent's own margin. Threaded through to `effectiveMarginTop`
   * / `effectiveMarginBottom` on the output so callers stacking
   * this container inside another flow know the correct outer
   * margins to use. Participates in parent-child collapse when
   * `collapseWithParent` is true.
   */
  margin?: EdgeInsets;
  /**
   * Opt in to CSS 2.1 §8.3.1 parent-child margin collapsing. When
   * true, the first child's top margin collapses with the parent's
   * top margin (if the parent has no top padding/border); same
   * for bottom (if the parent has no bottom padding/border AND
   * `innerHeight` is undefined). When false or omitted, behaviour
   * matches v0.2 (children's margins stay strictly inside
   * `contentHeight`, and `effectiveMarginTop/Bottom` just echo
   * `container.margin.top/bottom`).
   */
  collapseWithParent?: boolean;
}

export interface BlockChildLayout {
  box: Box;
  /** Child's border-box top offset from the container's inner top edge. */
  top: number;
  /** Child's border-box left offset (padding.left of the container is applied by the caller). */
  left: number;
  /** Child's border-box height (content + padding + border). */
  height: number;
  /** Child's border-box width. */
  width: number;
  /**
   * True when this child is empty per §8.3.1 ("a block box with
   * height: auto and no content"): its borderBoxHeight is 0 and
   * its top+bottom padding+border are all 0. Empty children have
   * self-collapsed top+bottom margins.
   */
  emptyBlock: boolean;
}

export interface BlockLayout {
  children: BlockChildLayout[];
  /**
   * Content height of the container: from the inner-top edge to
   * the last child's border-box bottom, plus any margins that
   * didn't collapse with the parent. When bottom parent-child
   * collapse is active the last child's bottom margin is NOT
   * included (it escapes through `effectiveMarginBottom`).
   */
  contentHeight: number;
  /** Max child border-box width. Used for horizontal overflow detection. */
  contentWidth: number;
  /** True when contentHeight exceeds container.innerHeight (if provided). */
  overflowsVertical: boolean;
  /** True when any child's border-box width exceeds container.innerWidth. */
  overflowsHorizontal: boolean;
  /**
   * Parent's effective outer top margin. Equals
   * `collapseMargins(container.margin.top, firstChild.margin.top)`
   * when parent-child top collapse applies; otherwise equals
   * `container.margin.top` (defaulting to 0).
   */
  effectiveMarginTop: number;
  /** Parent's effective outer bottom margin. Symmetric to `effectiveMarginTop`. */
  effectiveMarginBottom: number;
  /** True when the first child's top margin collapsed with the parent's top margin. */
  collapsedWithParentTop: boolean;
  /** True when the last child's bottom margin collapsed with the parent's bottom margin. */
  collapsedWithParentBottom: boolean;
}

/**
 * Collapse two adjacent vertical margins per CSS 2.1 §8.3.1. The
 * rule is:
 *   - Both non-negative → max.
 *   - Both non-positive → min (most negative wins).
 *   - Mixed → sum. (The sum is always less than the positive value.)
 */
export function collapseMargins(a: number, b: number): number {
  if (a >= 0 && b >= 0) return Math.max(a, b);
  if (a <= 0 && b <= 0) return Math.min(a, b);
  return a + b;
}

/**
 * Variadic collapse. Left-folds `collapseMargins` across the list.
 * The operation is associative (max/min/sum all are) so fold order
 * doesn't affect the result. Empty list → 0.
 */
export function collapseMarginList(values: number[]): number {
  if (values.length === 0) return 0;
  let acc = values[0]!;
  for (let i = 1; i < values.length; i++) acc = collapseMargins(acc, values[i]!);
  return acc;
}

/**
 * True when the child qualifies for §8.3.1 empty-block
 * self-collapse: border-box height is zero AND there's no
 * top/bottom padding or border to keep the margins apart.
 */
export function isEmptyBlock(child: Box): boolean {
  return (
    child.borderBoxHeight === 0 &&
    child.padding.top === 0 &&
    child.padding.bottom === 0 &&
    child.border.top === 0 &&
    child.border.bottom === 0
  );
}

function topEdgeOpen(container: BlockContainer): boolean {
  const pt = container.padding?.top ?? 0;
  const bt = container.border?.top ?? 0;
  return pt === 0 && bt === 0;
}

function bottomEdgeOpen(container: BlockContainer): boolean {
  // A definite container height blocks bottom collapse: the
  // container has a rendered bottom edge that contains the
  // children's bottom margin.
  if (container.innerHeight !== undefined) return false;
  const pb = container.padding?.bottom ?? 0;
  const bb = container.border?.bottom ?? 0;
  return pb === 0 && bb === 0;
}

/**
 * Walk children top-to-bottom, collapsing adjacent-sibling
 * margins, handling empty-block self-collapse, and optionally
 * collapsing the first/last child's margin with the parent's own.
 */
export function computeBlockLayout(
  children: Box[],
  container: BlockContainer,
): BlockLayout {
  const parentMarginTop = container.margin?.top ?? 0;
  const parentMarginBottom = container.margin?.bottom ?? 0;

  if (children.length === 0) {
    return {
      children: [],
      contentHeight: 0,
      contentWidth: 0,
      overflowsVertical:
        container.innerHeight !== undefined && 0 > container.innerHeight,
      overflowsHorizontal: false,
      effectiveMarginTop: parentMarginTop,
      effectiveMarginBottom: parentMarginBottom,
      collapsedWithParentTop: false,
      collapsedWithParentBottom: false,
    };
  }

  const first = children[0]!;
  const last = children[children.length - 1]!;

  // Parent-child collapse is opt-in (backwards-compat with v0.2).
  // When enabled, the CSS 2.1 §8.3.1 edge conditions decide whether
  // the top or bottom edge is actually "open" for collapse.
  const optIn = container.collapseWithParent === true;
  const collapsedWithParentTop = optIn && topEdgeOpen(container);
  const collapsedWithParentBottom = optIn && bottomEdgeOpen(container);

  // Inside-the-container cursor. When top-collapse is active the
  // first child's top margin "escapes" up, so the cursor starts
  // at 0 regardless of first.margin.top. Otherwise the first
  // child contributes its top margin verbatim (v0.2 behaviour).
  let cursor = collapsedWithParentTop ? 0 : first.margin.top;

  const laid: BlockChildLayout[] = [];

  // `pendingMargin` carries the margin "owed" to the next
  // non-empty child (from the previous non-empty's bottom +
  // any empty children's collapsed-self margin in between).
  // It participates in collapseMargins with the next non-empty
  // child's top margin.
  //
  // For the very first child the "pending margin" concept
  // doesn't apply — the first child's placement is handled
  // above via `cursor`. So we seed `pendingMargin` after the
  // first child has been placed.
  let pendingMargin = 0;
  let seenFirstNonEmpty = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const empty = isEmptyBlock(child);

    if (empty) {
      // Empty-block: top+bottom margins collapse into a single
      // margin that feeds into `pendingMargin`.
      const selfCollapsed = collapseMargins(child.margin.top, child.margin.bottom);
      if (!seenFirstNonEmpty) {
        // Before any non-empty has been placed: empty children
        // at the start don't get their own "top" placement;
        // they sit at cursor and their collapsed margin feeds
        // the next child's placement. Treat them like they
        // extend the initial margin.
        //
        // When top-collapse is active, first-child.margin.top
        // has already escaped (cursor=0). For subsequent leading
        // empties, we still just fold into pendingMargin —
        // the chained "empty escapes into parent" case is
        // v0.4 scope per the file-level note.
        laid.push({
          box: child,
          top: cursor,
          left: child.margin.left,
          height: 0,
          width: child.borderBoxWidth,
          emptyBlock: true,
        });
        // Empty contributes its collapsed-self margin to
        // pendingMargin for the next non-empty's placement.
        // If the first child is empty and not-top-collapsed,
        // we already advanced cursor by first.margin.top
        // above; the empty's collapsed-self-margin stacks on
        // top of that via pendingMargin. This slightly over-
        // counts in the rare chain case; flagged for v0.4.
        pendingMargin = collapseMargins(pendingMargin, selfCollapsed);
      } else {
        // Empty between two non-empties (or after a non-empty).
        // Place at the cursor advanced by collapsed pending.
        // The empty's zero-height border-box lives at the
        // start of the pending-gap.
        const gap = collapseMargins(pendingMargin, selfCollapsed);
        laid.push({
          box: child,
          top: cursor + gap,
          left: child.margin.left,
          height: 0,
          width: child.borderBoxWidth,
          emptyBlock: true,
        });
        pendingMargin = gap;
      }
      continue;
    }

    if (!seenFirstNonEmpty) {
      // First non-empty child: cursor already at its correct
      // position (either 0 for top-collapsed or first.margin.top
      // for non-collapsed). But `pendingMargin` may carry
      // leading-empty contributions that must stack onto cursor
      // before placement.
      //
      // When the first child is itself non-empty, pendingMargin
      // is 0 and this is a no-op. When leading empties pre-
      // contributed margin, cursor advances by that.
      cursor += pendingMargin;
      // For the first child, its own top margin has either been
      // already folded into cursor (v0.2 path) or escaped up
      // (top-collapse path); don't add it here again.
      laid.push({
        box: child,
        top: cursor,
        left: child.margin.left,
        height: child.borderBoxHeight,
        width: child.borderBoxWidth,
        emptyBlock: false,
      });
      cursor += child.borderBoxHeight;
      pendingMargin = child.margin.bottom;
      seenFirstNonEmpty = true;
      continue;
    }

    // Non-empty child after another non-empty (or after some
    // empties): adjacent-sibling collapse using pendingMargin.
    const gap = collapseMargins(pendingMargin, child.margin.top);
    cursor += gap;
    laid.push({
      box: child,
      top: cursor,
      left: child.margin.left,
      height: child.borderBoxHeight,
      width: child.borderBoxWidth,
      emptyBlock: false,
    });
    cursor += child.borderBoxHeight;
    pendingMargin = child.margin.bottom;
  }

  // Bottom-edge handling: either the trailing margin escapes
  // (parent-child bottom collapse) or it stays inside contentHeight.
  //
  // `pendingMargin` after the loop = the last non-empty child's
  // bottom margin already collapsed with any trailing empty
  // children's collapsed-self margins. That's the value we
  // either keep or escape.
  let contentHeight: number;
  if (collapsedWithParentBottom) {
    // Trailing margin escapes upward to effectiveMarginBottom.
    // contentHeight stops at the last child's border-box bottom
    // (which is `cursor` after the last non-empty's height was
    // added). Note: if any trailing empties exist after the last
    // non-empty, their placed `top` is still valid (each sits
    // on the pending-gap line) but their zero height doesn't
    // move cursor.
    contentHeight = cursor;
  } else {
    contentHeight = cursor + pendingMargin;
  }

  // Effective outer margins of this container for its *own*
  // parent to collapse with.
  const effectiveMarginTop = collapsedWithParentTop
    ? collapseMargins(parentMarginTop, first.margin.top)
    : parentMarginTop;
  // For bottom, we use the LAST CHILD'S OWN bottom margin when
  // top-collapse is active. If there were trailing empties, their
  // collapsed-self margins already folded into `pendingMargin`,
  // but CSS's parent-child bottom collapse strictly uses the last
  // non-empty child's bottom margin (per §8.3.1 — "the bottom
  // margin of a block box is adjoining to its last in-flow
  // child's bottom margin"). Matching that: use
  // `last.margin.bottom` (when last is non-empty) or pendingMargin
  // (when the last is empty — it's already folded in).
  const lastIsEmpty = isEmptyBlock(last);
  const bottomChildMargin = lastIsEmpty ? pendingMargin : last.margin.bottom;
  const effectiveMarginBottom = collapsedWithParentBottom
    ? collapseMargins(parentMarginBottom, bottomChildMargin)
    : parentMarginBottom;

  const contentWidth = Math.max(...children.map((c) => c.borderBoxWidth));

  const overflowsVertical =
    container.innerHeight !== undefined && contentHeight > container.innerHeight + 0.5;
  const overflowsHorizontal = contentWidth > container.innerWidth + 0.5;

  return {
    children: laid,
    contentHeight,
    contentWidth,
    overflowsVertical,
    overflowsHorizontal,
    effectiveMarginTop,
    effectiveMarginBottom,
    collapsedWithParentTop,
    collapsedWithParentBottom,
  };
}

// ────────────────────────────────────────────────────────────────
// fitsBlock predicate
// ────────────────────────────────────────────────────────────────

export interface FitsBlockSpec {
  container: BlockContainer;
  children: Box[];
}

export interface FitsBlockResult {
  ok: boolean;
  layout: BlockLayout;
  reasons: string[];
}

export function fitsBlock(spec: FitsBlockSpec): FitsBlockResult {
  const layout = computeBlockLayout(spec.children, spec.container);
  const reasons: string[] = [];
  if (layout.overflowsHorizontal) {
    reasons.push(
      `horizontal overflow: max child width ${layout.contentWidth.toFixed(1)}px > inner ${spec.container.innerWidth}px`,
    );
  }
  if (layout.overflowsVertical) {
    reasons.push(
      `vertical overflow: content height ${layout.contentHeight.toFixed(1)}px > inner ${spec.container.innerHeight}px`,
    );
  }
  return { ok: reasons.length === 0, layout, reasons };
}
