/**
 * Block flow engine for v0.2 (G4).
 *
 * Stacks block children vertically inside a container with
 * CSS 2.1 §8.3.1 margin collapsing between adjacent siblings.
 *
 * Scope (v0.2):
 *   - Adjacent-sibling vertical margin collapsing.
 *   - Per-child width defaults to the child's own borderBoxWidth;
 *     intrinsic block behaviour ("fill the container") is up to
 *     the caller to model on their Box before handing it in.
 *
 * Out of scope (tracked as PRELIGHT-NEXT):
 *   - PRELIGHT-NEXT(v0.3): parent-child margin collapse (first
 *     child's top margin collapsing with parent's top margin when
 *     the parent has no top padding/border).
 *   - PRELIGHT-NEXT(v0.3): empty-block self-collapse (a child
 *     with zero content, padding, border has its own top and
 *     bottom margins collapse together).
 *   - PRELIGHT-NEXT(v0.3): clearance from floats. Block flow with
 *     floats is niche in modern CSS; we flag it rather than
 *     silently assume no floats.
 *
 * Margin-collapse arithmetic (§8.3.1):
 *   - Two positive margins:       keep max(a, b)
 *   - Two negative margins:       keep min(a, b) — the more negative
 *   - One positive, one negative: a + b  (the sum is always smaller
 *                                 than the positive margin, matching
 *                                 the spec)
 *
 * PRELIGHT-INVARIANT: pure. No DOM, canvas, or external state.
 */

import type { Box } from './box.js';

export interface BlockContainer {
  /** Inner width of the container (content-box). Children wider than this overflow horizontally. */
  innerWidth: number;
  /** Optional max inner height for fitsBlock overflow detection. */
  innerHeight?: number;
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
}

export interface BlockLayout {
  children: BlockChildLayout[];
  /** Total content height of the container: bottom of the last child's border box minus top of the first. */
  contentHeight: number;
  /** Max child border-box width. Used for horizontal overflow detection. */
  contentWidth: number;
  /** True when contentHeight exceeds container.innerHeight (if provided). */
  overflowsVertical: boolean;
  /** True when any child's border-box width exceeds container.innerWidth. */
  overflowsHorizontal: boolean;
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
 * Walk children top-to-bottom, collapsing the bottom margin of the
 * previous child with the top margin of the next. Returns per-child
 * border-box positions + the container's content height.
 *
 * The first child's top margin and the last child's bottom margin
 * are *not* collapsed into the container — that is parent-child
 * collapsing, deferred to v0.3.
 */
export function computeBlockLayout(
  children: Box[],
  container: BlockContainer,
): BlockLayout {
  if (children.length === 0) {
    return {
      children: [],
      contentHeight: 0,
      contentWidth: 0,
      overflowsVertical: container.innerHeight !== undefined && 0 > container.innerHeight,
      overflowsHorizontal: false,
    };
  }

  const laid: BlockChildLayout[] = [];
  // First child: contributes its top margin verbatim.
  const first = children[0]!;
  let cursor = first.margin.top;
  laid.push({
    box: first,
    top: cursor,
    left: first.margin.left,
    height: first.borderBoxHeight,
    width: first.borderBoxWidth,
  });
  cursor += first.borderBoxHeight;

  let prevBottom = first.margin.bottom;
  for (let i = 1; i < children.length; i++) {
    const child = children[i]!;
    const gap = collapseMargins(prevBottom, child.margin.top);
    cursor += gap;
    laid.push({
      box: child,
      top: cursor,
      left: child.margin.left,
      height: child.borderBoxHeight,
      width: child.borderBoxWidth,
    });
    cursor += child.borderBoxHeight;
    prevBottom = child.margin.bottom;
  }
  // Add the last child's bottom margin to the content height. Not
  // collapsed into the container in v0.2.
  cursor += prevBottom;

  // Content height is the full footprint: from the first child's
  // top margin to the last child's bottom margin. Matches what a
  // caller would check against `innerHeight`.
  const contentHeight = cursor;
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
