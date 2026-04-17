/**
 * G4 block-flow corpus: 30 cases.
 *
 * Every expected value is derived from CSS 2.1 §8.3.1 (margin
 * collapsing) and §10 (visual formatting). Since the spec defines
 * the arithmetic, matching it means matching every browser.
 *
 *   1-8:   Single child + baseline stacking (no collapse)
 *   9-16:  Adjacent-sibling margin collapse (pos+pos, neg+neg, mixed)
 *  17-22:  Multi-child stacks with gaps + computed content height
 *  23-30:  fitsBlock predicate + overflow detection
 */

import { describe, expect, test } from 'vitest';

import {
  box,
  collapseMargins,
  computeBlockLayout,
  edgeInsetsAll,
  edgeInsetsOnly,
  fitsBlock,
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
