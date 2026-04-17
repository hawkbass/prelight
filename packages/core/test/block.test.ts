/**
 * Block-flow corpus: 50 cases.
 *
 * Every expected value is derived from CSS 2.1 §8.3.1 (margin
 * collapsing) and §10 (visual formatting). Since the spec defines
 * the arithmetic, matching it means matching every browser.
 *
 *   1-8:   Single child + baseline stacking (no collapse)             [v0.2 G4.1]
 *   9-16:  Adjacent-sibling margin collapse (pos+pos, neg+neg, mixed) [v0.2 G4.2]
 *  17-22:  Multi-child stacks with gaps + computed content height     [v0.2 G4.3]
 *  23-30:  fitsBlock predicate + overflow detection                   [v0.2 G4.4]
 *  31-36:  Parent-child top margin collapse                           [v0.3 H2.1]
 *  37-41:  Parent-child bottom margin collapse                        [v0.3 H2.2]
 *  42-44:  Combined edges + opt-in backwards-compat guards            [v0.3 H2.3]
 *  45-50:  Empty-block self-collapse                                  [v0.3 H2.4]
 */

import { describe, expect, test } from 'vitest';

import {
  box,
  collapseMarginList,
  collapseMargins,
  computeBlockLayout,
  edgeInsetsAll,
  edgeInsetsOnly,
  fitsBlock,
  isEmptyBlock,
  zeroInsets,
  type Box,
  type EdgeInsets,
} from '../src/index.js';
import type { Measurement } from '../src/index.js';

function measurement(w: number, h: number, lines = 1): Measurement {
  return {
    cell: { language: 'en', scale: 1, width: w },
    lines,
    measuredWidth: w,
    measuredHeight: h,
    naturalWidth: w,
    overflows: false,
  };
}

function mk(
  w: number,
  h: number,
  margin?: EdgeInsets,
  padding?: EdgeInsets,
  border?: EdgeInsets,
): Box {
  return box({
    content: measurement(w, h),
    ...(margin !== undefined ? { margin } : {}),
    ...(padding !== undefined ? { padding } : {}),
    ...(border !== undefined ? { border } : {}),
  });
}

describe('G4.1 single child + baseline', () => {
  test('C01 single child positions at its own top margin', () => {
    const layout = computeBlockLayout([mk(100, 20)], { innerWidth: 200 });
    expect(layout.children[0]!.top).toBe(0);
    expect(layout.children[0]!.height).toBe(20);
    expect(layout.contentHeight).toBe(20);
  });

  test('C02 top margin offsets the first child', () => {
    const layout = computeBlockLayout(
      [mk(100, 20, edgeInsetsOnly({ top: 10 }))],
      { innerWidth: 200 },
    );
    expect(layout.children[0]!.top).toBe(10);
    expect(layout.contentHeight).toBe(30);
  });

  test('C03 bottom margin extends content height', () => {
    const layout = computeBlockLayout(
      [mk(100, 20, edgeInsetsOnly({ bottom: 15 }))],
      { innerWidth: 200 },
    );
    expect(layout.contentHeight).toBe(35);
  });

  test('C04 top + bottom margins additive', () => {
    const layout = computeBlockLayout(
      [mk(100, 20, edgeInsetsOnly({ top: 10, bottom: 15 }))],
      { innerWidth: 200 },
    );
    expect(layout.contentHeight).toBe(45);
  });

  test('C05 padding + border grow border-box height', () => {
    const layout = computeBlockLayout(
      [mk(100, 20, zeroInsets(), edgeInsetsAll(8), edgeInsetsAll(1))],
      { innerWidth: 200 },
    );
    expect(layout.children[0]!.height).toBe(20 + 16 + 2);
    expect(layout.contentHeight).toBe(38);
  });

  test('C06 empty container returns zero', () => {
    const layout = computeBlockLayout([], { innerWidth: 200 });
    expect(layout.contentHeight).toBe(0);
    expect(layout.contentWidth).toBe(0);
    expect(layout.children).toHaveLength(0);
  });

  test('C07 left margin stored separately', () => {
    const layout = computeBlockLayout(
      [mk(100, 20, edgeInsetsOnly({ left: 8 }))],
      { innerWidth: 200 },
    );
    expect(layout.children[0]!.left).toBe(8);
  });

  test('C08 contentWidth = max child border-box width', () => {
    const layout = computeBlockLayout([mk(80, 20), mk(140, 20), mk(60, 20)], {
      innerWidth: 200,
    });
    expect(layout.contentWidth).toBe(140);
  });
});

describe('G4.2 adjacent-sibling margin collapsing', () => {
  test('C09 collapseMargins positive+positive = max', () => {
    expect(collapseMargins(10, 15)).toBe(15);
    expect(collapseMargins(20, 5)).toBe(20);
  });
  test('C10 collapseMargins negative+negative = min', () => {
    expect(collapseMargins(-10, -20)).toBe(-20);
    expect(collapseMargins(-5, -3)).toBe(-5);
  });
  test('C11 collapseMargins mixed = sum', () => {
    expect(collapseMargins(20, -10)).toBe(10);
    expect(collapseMargins(-15, 8)).toBe(-7);
  });
  test('C12 collapseMargins with zero', () => {
    expect(collapseMargins(0, 10)).toBe(10);
    expect(collapseMargins(10, 0)).toBe(10);
    expect(collapseMargins(-5, 0)).toBe(-5);
  });

  test('C13 two positive siblings: larger margin wins', () => {
    const layout = computeBlockLayout(
      [
        mk(100, 20, edgeInsetsOnly({ bottom: 10 })),
        mk(100, 20, edgeInsetsOnly({ top: 20 })),
      ],
      { innerWidth: 200 },
    );
    // first top=0, height=20, then collapsed gap max(10,20)=20, then 20
    expect(layout.children[1]!.top).toBe(40);
    expect(layout.contentHeight).toBe(60);
  });

  test('C14 two negative siblings: most negative wins', () => {
    const layout = computeBlockLayout(
      [
        mk(100, 20, edgeInsetsOnly({ bottom: -5 })),
        mk(100, 20, edgeInsetsOnly({ top: -10 })),
      ],
      { innerWidth: 200 },
    );
    // gap = min(-5, -10) = -10 → overlap
    expect(layout.children[1]!.top).toBe(10);
    expect(layout.contentHeight).toBe(30);
  });

  test('C15 mixed siblings: sum', () => {
    const layout = computeBlockLayout(
      [
        mk(100, 20, edgeInsetsOnly({ bottom: 20 })),
        mk(100, 20, edgeInsetsOnly({ top: -5 })),
      ],
      { innerWidth: 200 },
    );
    // gap = 20 + (-5) = 15
    expect(layout.children[1]!.top).toBe(35);
    expect(layout.contentHeight).toBe(55);
  });

  test('C16 three siblings with equal margins collapse pairwise', () => {
    const m = edgeInsetsOnly({ top: 10, bottom: 10 });
    const layout = computeBlockLayout([mk(100, 20, m), mk(100, 20, m), mk(100, 20, m)], {
      innerWidth: 200,
    });
    // child 0 top = 10
    // child 1: gap = max(10,10)=10, top = 10+20+10 = 40
    // child 2: gap = max(10,10)=10, top = 40+20+10 = 70
    // content = 70+20+10 = 100
    expect(layout.children[0]!.top).toBe(10);
    expect(layout.children[1]!.top).toBe(40);
    expect(layout.children[2]!.top).toBe(70);
    expect(layout.contentHeight).toBe(100);
  });
});

describe('G4.3 multi-child stacks', () => {
  test('C17 no margins → tight stack', () => {
    const layout = computeBlockLayout([mk(100, 20), mk(100, 30), mk(100, 10)], {
      innerWidth: 200,
    });
    expect(layout.children[0]!.top).toBe(0);
    expect(layout.children[1]!.top).toBe(20);
    expect(layout.children[2]!.top).toBe(50);
    expect(layout.contentHeight).toBe(60);
  });

  test('C18 padding + border expands each child', () => {
    const c = mk(100, 20, zeroInsets(), edgeInsetsAll(4), edgeInsetsAll(1));
    const layout = computeBlockLayout([c, c, c], { innerWidth: 200 });
    // each border-box = 20 + 8 + 2 = 30
    expect(layout.children[0]!.height).toBe(30);
    expect(layout.children[1]!.top).toBe(30);
    expect(layout.children[2]!.top).toBe(60);
    expect(layout.contentHeight).toBe(90);
  });

  test('C19 first child top + last child bottom included', () => {
    const layout = computeBlockLayout(
      [
        mk(100, 20, edgeInsetsOnly({ top: 5 })),
        mk(100, 20),
        mk(100, 20, edgeInsetsOnly({ bottom: 7 })),
      ],
      { innerWidth: 200 },
    );
    expect(layout.children[0]!.top).toBe(5);
    expect(layout.contentHeight).toBe(5 + 20 + 20 + 20 + 7);
  });

  test('C20 stack with asymmetric bottom/top margins', () => {
    const layout = computeBlockLayout(
      [
        mk(100, 20, edgeInsetsOnly({ bottom: 30 })),
        mk(100, 20, edgeInsetsOnly({ top: 10 })),
      ],
      { innerWidth: 200 },
    );
    // gap = max(30, 10) = 30
    expect(layout.children[1]!.top).toBe(50);
  });

  test('C21 wrapped child reports multi-line height', () => {
    const wrapped = box({
      content: measurement(180, 40, 2),
    });
    const layout = computeBlockLayout([mk(100, 20), wrapped, mk(100, 20)], {
      innerWidth: 200,
    });
    expect(layout.children[1]!.height).toBe(40);
    expect(layout.children[2]!.top).toBe(60);
  });

  test('C22 stack of 5 form rows with 12px spacing collapses to 12px gaps', () => {
    const row = mk(240, 32, edgeInsetsOnly({ top: 12, bottom: 12 }));
    const layout = computeBlockLayout([row, row, row, row, row], { innerWidth: 300 });
    // each gap = 12 (collapsed), total = 12*5 + 32*5 + 12 = 60+160+12 = ... actually:
    // top margin first: 12
    // + height 32 = 44
    // + gap 12 + height 32 = 88
    // + gap 12 + height 32 = 132
    // + gap 12 + height 32 = 176
    // + gap 12 + height 32 = 220
    // + bottom margin 12 = 232
    expect(layout.contentHeight).toBe(232);
  });
});

describe('G4.4 fitsBlock predicate', () => {
  test('C23 stack under the height budget passes', () => {
    const r = fitsBlock({
      children: [mk(100, 20), mk(100, 20)],
      container: { innerWidth: 200, innerHeight: 100 },
    });
    expect(r.ok).toBe(true);
  });

  test('C24 stack over the height budget fails', () => {
    const r = fitsBlock({
      children: [mk(100, 60), mk(100, 60)],
      container: { innerWidth: 200, innerHeight: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/vertical overflow/);
  });

  test('C25 wide child triggers horizontal overflow', () => {
    const r = fitsBlock({
      children: [mk(100, 20), mk(250, 20)],
      container: { innerWidth: 200 },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/horizontal overflow/);
  });

  test('C26 both axes overflow → both reasons reported', () => {
    const r = fitsBlock({
      children: [mk(300, 80), mk(300, 80)],
      container: { innerWidth: 200, innerHeight: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons).toHaveLength(2);
  });

  test('C27 no innerHeight provided means vertical never fails', () => {
    const r = fitsBlock({
      children: [mk(100, 1000)],
      container: { innerWidth: 200 },
    });
    expect(r.ok).toBe(true);
  });

  test('C28 collapsed margins count against the vertical budget', () => {
    const r = fitsBlock({
      children: [
        mk(100, 30, edgeInsetsOnly({ bottom: 20 })),
        mk(100, 30, edgeInsetsOnly({ top: 20 })),
      ],
      container: { innerWidth: 200, innerHeight: 81 },
    });
    // collapsed gap 20 → total 80 → fits under 81
    expect(r.ok).toBe(true);
  });

  test('C29 uncollapsed margins exceed budget', () => {
    const r = fitsBlock({
      children: [
        mk(100, 30, edgeInsetsOnly({ bottom: 20 })),
        mk(100, 30, edgeInsetsOnly({ top: 20 })),
      ],
      container: { innerWidth: 200, innerHeight: 60 },
    });
    expect(r.ok).toBe(false);
  });

  test('C30 fitsBlock preserves layout output for inspection', () => {
    const r = fitsBlock({
      children: [mk(100, 20), mk(100, 20), mk(100, 20)],
      container: { innerWidth: 200, innerHeight: 100 },
    });
    expect(r.layout.children).toHaveLength(3);
    expect(r.layout.contentHeight).toBe(60);
    expect(r.ok).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// v0.3 H2: parent-child margin collapse, empty-block self-collapse
// ──────────────────────────────────────────────────────────────────

describe('H2.1 parent-child top margin collapse', () => {
  test('C31 basic top collapse: first child top margin escapes through parent', () => {
    // §8.3.1: parent has no top padding/border → first child top
    // margin adjoins parent's top margin. Larger wins.
    const child = mk(100, 20, edgeInsetsOnly({ top: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentTop).toBe(true);
    expect(layout.children[0]!.top).toBe(0);
    // effective = max(parent.mt=10, child.mt=15) = 15
    expect(layout.effectiveMarginTop).toBe(15);
    // contentHeight no longer includes child.mt
    expect(layout.contentHeight).toBe(20);
  });

  test('C32 top collapse blocked by parent top padding', () => {
    const child = mk(100, 20, edgeInsetsOnly({ top: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: edgeInsetsOnly({ top: 5 }),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentTop).toBe(false);
    expect(layout.children[0]!.top).toBe(15);
    expect(layout.effectiveMarginTop).toBe(10);
    expect(layout.contentHeight).toBe(35);
  });

  test('C33 top collapse blocked by parent top border', () => {
    const child = mk(100, 20, edgeInsetsOnly({ top: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: edgeInsetsOnly({ top: 1 }),
      margin: edgeInsetsOnly({ top: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentTop).toBe(false);
    expect(layout.children[0]!.top).toBe(15);
    expect(layout.effectiveMarginTop).toBe(10);
  });

  test('C34 top collapse with mixed signs: sum', () => {
    // parent.mt = 20, child.mt = -5 → mixed → 15
    const child = mk(100, 20, edgeInsetsOnly({ top: -5 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 20 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentTop).toBe(true);
    expect(layout.effectiveMarginTop).toBe(15);
    expect(layout.children[0]!.top).toBe(0);
  });

  test('C35 top collapse with equal margins: value unchanged', () => {
    const child = mk(100, 20, edgeInsetsOnly({ top: 10 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 10 }),
      collapseWithParent: true,
    });
    expect(layout.effectiveMarginTop).toBe(10);
  });

  test('C36 top collapse: child with zero top margin → parent margin wins', () => {
    const child = mk(100, 20);
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 20 }),
      collapseWithParent: true,
    });
    expect(layout.effectiveMarginTop).toBe(20);
    expect(layout.children[0]!.top).toBe(0);
  });
});

describe('H2.2 parent-child bottom margin collapse', () => {
  test('C37 basic bottom collapse: last child bottom margin escapes', () => {
    const child = mk(100, 20, edgeInsetsOnly({ bottom: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ bottom: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentBottom).toBe(true);
    // contentHeight stops at last child's border-box bottom = 0+20 = 20
    expect(layout.contentHeight).toBe(20);
    expect(layout.effectiveMarginBottom).toBe(15);
  });

  test('C38 innerHeight blocks bottom collapse (definite container height)', () => {
    const child = mk(100, 20, edgeInsetsOnly({ bottom: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      innerHeight: 100,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ bottom: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentBottom).toBe(false);
    // child.mb stays inside contentHeight
    expect(layout.contentHeight).toBe(35);
    expect(layout.effectiveMarginBottom).toBe(10);
  });

  test('C39 bottom collapse blocked by parent bottom padding', () => {
    const child = mk(100, 20, edgeInsetsOnly({ bottom: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: edgeInsetsOnly({ bottom: 5 }),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ bottom: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentBottom).toBe(false);
    expect(layout.contentHeight).toBe(35);
  });

  test('C40 bottom collapse blocked by parent bottom border', () => {
    const child = mk(100, 20, edgeInsetsOnly({ bottom: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: edgeInsetsOnly({ bottom: 2 }),
      margin: edgeInsetsOnly({ bottom: 10 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentBottom).toBe(false);
  });

  test('C41 bottom collapse with mixed signs: sum', () => {
    // parent.mb=20, child.mb=-5 → mixed → 15
    const child = mk(100, 20, edgeInsetsOnly({ bottom: -5 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ bottom: 20 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentBottom).toBe(true);
    expect(layout.effectiveMarginBottom).toBe(15);
  });
});

describe('H2.3 combined edges + opt-in backwards compat', () => {
  test('C42 both edges collapse when parent has zero insets on both sides', () => {
    // Wrapper with zero padding/border, single child with top+bottom
    // margins, collapseWithParent=true. Top AND bottom collapse.
    const child = mk(
      100,
      20,
      edgeInsetsOnly({ top: 10, bottom: 15 }),
    );
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 5, bottom: 8 }),
      collapseWithParent: true,
    });
    expect(layout.collapsedWithParentTop).toBe(true);
    expect(layout.collapsedWithParentBottom).toBe(true);
    expect(layout.children[0]!.top).toBe(0);
    expect(layout.contentHeight).toBe(20); // just the border-box, margins escape both sides
    expect(layout.effectiveMarginTop).toBe(10); // max(5, 10)
    expect(layout.effectiveMarginBottom).toBe(15); // max(8, 15)
  });

  test('C43 opt-in off: padding/border/margin supplied but collapseWithParent=false preserves v0.2 behaviour', () => {
    const child = mk(100, 20, edgeInsetsOnly({ top: 15, bottom: 15 }));
    const layout = computeBlockLayout([child], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 10, bottom: 10 }),
      collapseWithParent: false,
    });
    // v0.2: margins stay inside contentHeight, no collapse
    expect(layout.collapsedWithParentTop).toBe(false);
    expect(layout.collapsedWithParentBottom).toBe(false);
    expect(layout.children[0]!.top).toBe(15);
    expect(layout.contentHeight).toBe(15 + 20 + 15);
    // effectiveMargin echoes parent.margin
    expect(layout.effectiveMarginTop).toBe(10);
    expect(layout.effectiveMarginBottom).toBe(10);
  });

  test('C44 empty children + opt-in: no collapse flags, effective margins equal parent margins', () => {
    const layout = computeBlockLayout([], {
      innerWidth: 200,
      padding: zeroInsets(),
      border: zeroInsets(),
      margin: edgeInsetsOnly({ top: 10, bottom: 5 }),
      collapseWithParent: true,
    });
    expect(layout.children).toHaveLength(0);
    expect(layout.contentHeight).toBe(0);
    expect(layout.collapsedWithParentTop).toBe(false);
    expect(layout.collapsedWithParentBottom).toBe(false);
    expect(layout.effectiveMarginTop).toBe(10);
    expect(layout.effectiveMarginBottom).toBe(5);
  });
});

describe('H2.4 empty-block self-collapse', () => {
  function emptyMk(topM: number, bottomM: number): Box {
    // A truly empty block: zero content height, zero padding, zero border.
    return box({
      content: {
        cell: { language: 'en', scale: 1, width: 0 },
        lines: 0,
        measuredWidth: 0,
        measuredHeight: 0,
        naturalWidth: 0,
        overflows: false,
      },
      margin: edgeInsetsOnly({ top: topM, bottom: bottomM }),
    });
  }

  test('C45 isEmptyBlock predicate: recognises zero-height zero-inset boxes', () => {
    const empty = emptyMk(10, 10);
    const nonEmpty = mk(100, 20);
    const emptyWithPadding = box({
      content: {
        cell: { language: 'en', scale: 1, width: 0 },
        lines: 0,
        measuredWidth: 0,
        measuredHeight: 0,
        naturalWidth: 0,
        overflows: false,
      },
      padding: edgeInsetsAll(4),
    });
    expect(isEmptyBlock(empty)).toBe(true);
    expect(isEmptyBlock(nonEmpty)).toBe(false);
    expect(isEmptyBlock(emptyWithPadding)).toBe(false);
  });

  test('C46 collapseMarginList folds N margins associatively', () => {
    // Positive + positive + positive = max
    expect(collapseMarginList([5, 10, 15])).toBe(15);
    // Negative + negative + negative = min
    expect(collapseMarginList([-5, -10, -3])).toBe(-10);
    // Mixed mixes via pairwise rules (associativity holds)
    expect(collapseMarginList([20, 10])).toBe(20);
    expect(collapseMarginList([])).toBe(0);
  });

  test('C47 empty between two non-empties collapses all three margins into one gap', () => {
    // prev.bottom=10, empty.top=20, empty.bottom=8, next.top=5
    // empty self-collapses → M = max(20,8)=20
    // Whole gap = max(10, 20, 5) = 20
    const prev = mk(100, 20, edgeInsetsOnly({ bottom: 10 }));
    const empty = emptyMk(20, 8);
    const next = mk(100, 20, edgeInsetsOnly({ top: 5 }));
    const layout = computeBlockLayout([prev, empty, next], { innerWidth: 200 });
    // prev at top=0, height=20 → bottom at 20
    // empty placed at top=20 + max(10, 20) = 40, zero height
    expect(layout.children[0]!.top).toBe(0);
    expect(layout.children[1]!.top).toBe(40);
    expect(layout.children[1]!.height).toBe(0);
    expect(layout.children[1]!.emptyBlock).toBe(true);
    // next placed after the full collapsed gap of 20
    expect(layout.children[2]!.top).toBe(40);
    expect(layout.contentHeight).toBe(60); // cursor=60, pendingMargin=next.bottom=0
  });

  test('C48 empty block with padding does NOT self-collapse', () => {
    const prev = mk(100, 20, edgeInsetsOnly({ bottom: 10 }));
    const nonEmpty = box({
      content: {
        cell: { language: 'en', scale: 1, width: 0 },
        lines: 0,
        measuredWidth: 0,
        measuredHeight: 0,
        naturalWidth: 0,
        overflows: false,
      },
      padding: edgeInsetsAll(4),
      margin: edgeInsetsOnly({ top: 20, bottom: 8 }),
    });
    const next = mk(100, 20);
    const layout = computeBlockLayout([prev, nonEmpty, next], { innerWidth: 200 });
    // nonEmpty has borderBoxHeight = 0 + 8(padding) = 8 → NOT empty per §8.3.1
    // Adjacent-sibling collapse between prev(bottom=10) and nonEmpty(top=20) = 20
    expect(layout.children[1]!.emptyBlock).toBe(false);
    expect(layout.children[1]!.height).toBe(8);
    expect(layout.children[1]!.top).toBe(40); // prev(0+20) + gap(20) = 40
    // adjacent collapse between nonEmpty(bottom=8) and next(top=0) = 8
    expect(layout.children[2]!.top).toBe(40 + 8 + 8);
  });

  test('C49 multiple empties in a row fold into one collapsed gap', () => {
    const prev = mk(100, 20, edgeInsetsOnly({ bottom: 5 }));
    const e1 = emptyMk(10, 12);
    const e2 = emptyMk(8, 15);
    const e3 = emptyMk(3, 7);
    const next = mk(100, 20, edgeInsetsOnly({ top: 2 }));
    const layout = computeBlockLayout([prev, e1, e2, e3, next], { innerWidth: 200 });
    // Each empty collapses top+bottom into its own single margin:
    //   e1: max(10,12)=12, e2: max(8,15)=15, e3: max(3,7)=7
    // Then the whole chain between prev and next collapses into:
    //   max(prev.bottom=5, 12, 15, 7, next.top=2) = 15
    expect(layout.children[0]!.top).toBe(0);
    expect(layout.children[1]!.emptyBlock).toBe(true);
    expect(layout.children[2]!.emptyBlock).toBe(true);
    expect(layout.children[3]!.emptyBlock).toBe(true);
    expect(layout.children[4]!.top).toBe(0 + 20 + 15);
    expect(layout.contentHeight).toBe(20 + 15 + 20);
  });

  test('C50 trailing empty after last non-empty: emptyBlock flag set, contentHeight includes collapsed margin', () => {
    const prev = mk(100, 20, edgeInsetsOnly({ bottom: 5 }));
    const empty = emptyMk(10, 15);
    const layout = computeBlockLayout([prev, empty], { innerWidth: 200 });
    // prev.bottom=5, empty self-collapsed = max(10,15)=15 → pendingMargin = max(5,15)=15
    // No parent-child collapse (not opted in) → contentHeight includes it
    expect(layout.children[1]!.emptyBlock).toBe(true);
    expect(layout.children[1]!.height).toBe(0);
    expect(layout.contentHeight).toBe(20 + 15);
  });
});
