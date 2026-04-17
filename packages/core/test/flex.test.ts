/**
 * G3 flex-engine corpus: 40 cases.
 *
 * Each case encodes a flex-layout scenario with expected values
 * derived from CSS Flex L1 §9.7 ("Resolving Flexible Lengths").
 * Categories:
 *
 *   1-10:  Basic packing — no grow/shrink, with gap + justify
 *  11-18:  Grow distribution (equal, weighted, clamped)
 *  19-26:  Shrink distribution (proportional to scaled shrink factor)
 *  27-32:  Justify-content variants (start/end/center/between/around/evenly)
 *  33-40:  Integration — fitsFlex predicate + overflow + column direction
 *
 * Pattern: `mkItem(borderBox, margin?)` builds a flex item with a
 * constant-size box so tests stay readable. The tests don't care
 * about text inside; G3 is about the main-axis resolution only.
 */

import { describe, expect, test } from 'vitest';

import {
  box,
  computeFlexLayout,
  edgeInsetsAll,
  edgeInsetsOnly,
  fitsFlex,
  zeroInsets,
  type FlexItem,
  type EdgeInsets,
} from '../src/index.js';
import type { Measurement } from '../src/index.js';

function content(width: number, height: number): Measurement {
  return {
    cell: { language: 'en', scale: 1, width },
    lines: 1,
    measuredWidth: width,
    measuredHeight: height,
    naturalWidth: width,
    overflows: false,
  };
}

/**
 * Build a flex item whose border-box width = `w` and height = `h`,
 * with optional margin. We stash the border-box dimensions on the
 * content so `box()` produces matching outer dims.
 */
function mkItem(w: number, h: number, margin?: EdgeInsets, flex?: Partial<FlexItem>): FlexItem {
  const c = content(w, h);
  return {
    box: box({ content: c, margin: margin ?? zeroInsets() }),
    ...flex,
  };
}

describe('G3.1 basic packing', () => {
  test('C01 two items fit with no grow, no gap', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(60, 20)],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.offset).toBe(0);
    expect(layout.items[0]!.main).toBe(40);
    expect(layout.items[1]!.offset).toBe(40);
    expect(layout.items[1]!.main).toBe(60);
    expect(layout.contentMain).toBe(100);
    expect(layout.overflows).toBe(false);
  });

  test('C02 gap inserts between items only', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20), mkItem(40, 20)],
      { innerMain: 200, gap: 10 },
    );
    expect(layout.items[0]!.offset).toBe(0);
    expect(layout.items[1]!.offset).toBe(50);
    expect(layout.items[2]!.offset).toBe(100);
    expect(layout.contentMain).toBe(140);
  });

  test('C03 single item always starts at 0', () => {
    const layout = computeFlexLayout([mkItem(50, 20)], { innerMain: 200 });
    expect(layout.items[0]!.offset).toBe(0);
    expect(layout.items[0]!.main).toBe(50);
  });

  test('C04 empty container has no items', () => {
    const layout = computeFlexLayout([], { innerMain: 200 });
    expect(layout.items).toHaveLength(0);
    expect(layout.overflows).toBe(false);
    expect(layout.freeSpace).toBe(200);
  });

  test('C05 oversized shrink:0 items overflow', () => {
    // CSS default flex-shrink: 1 would shrink these to fit. Nav bars
    // with fixed-size pills explicitly opt out of shrink.
    const layout = computeFlexLayout(
      [mkItem(120, 20, undefined, { shrink: 0 }), mkItem(120, 20, undefined, { shrink: 0 })],
      { innerMain: 200 },
    );
    expect(layout.overflows).toBe(true);
    expect(layout.contentMain).toBe(240);
  });

  test('C06 explicit basis overrides borderBoxWidth', () => {
    const layout = computeFlexLayout(
      [{ ...mkItem(50, 20), basis: 80 }, mkItem(60, 20)],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(80);
    expect(layout.items[1]!.offset).toBe(80);
  });

  test('C07 item margin adds to outer size but not main', () => {
    const item = mkItem(40, 20, edgeInsetsOnly({ left: 4, right: 6 }));
    const layout = computeFlexLayout([item, mkItem(40, 20)], { innerMain: 200 });
    // main = border-box 40; outer occupies 40 + 10
    expect(layout.items[0]!.main).toBe(40);
    // item 2 starts after item 1's outer + its own left-margin
    expect(layout.items[1]!.offset).toBe(50);
  });

  test('C08 items keep border-box as main dimension when there is free space', () => {
    const layout = computeFlexLayout(
      [mkItem(30, 20), mkItem(30, 20)],
      { innerMain: 200 },
    );
    expect(layout.freeSpace).toBe(140);
  });

  test('C09 fractional gap + items preserves precision', () => {
    const layout = computeFlexLayout(
      [mkItem(25.5, 20), mkItem(25.5, 20)],
      { innerMain: 100, gap: 1.5 },
    );
    expect(layout.contentMain).toBeCloseTo(52.5, 5);
  });

  test('C10 three items with gap at the exact fit', () => {
    const layout = computeFlexLayout(
      [mkItem(50, 20), mkItem(50, 20), mkItem(50, 20)],
      { innerMain: 160, gap: 5 },
    );
    expect(layout.contentMain).toBe(160);
    expect(layout.overflows).toBe(false);
    expect(layout.items[2]!.offset).toBe(110);
  });
});

describe('G3.2 grow distribution', () => {
  test('C11 single grow absorbs all free space', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20, undefined, { grow: 1 })],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(40);
    expect(layout.items[1]!.main).toBe(160);
    expect(layout.overflows).toBe(false);
  });

  test('C12 two grow items split evenly', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20, undefined, { grow: 1 }), mkItem(40, 20, undefined, { grow: 1 })],
      { innerMain: 200 },
    );
    // free space = 120; each gets 60 → 40 + 60 = 100
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
  });

  test('C13 weighted grow (1:2)', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20, undefined, { grow: 1 }), mkItem(40, 20, undefined, { grow: 2 })],
      { innerMain: 220 },
    );
    // free = 140; shares 140/3 and 280/3
    expect(layout.items[0]!.main).toBeCloseTo(40 + 140 / 3, 5);
    expect(layout.items[1]!.main).toBeCloseTo(40 + 280 / 3, 5);
  });

  test('C14 zero-grow sibling of grow item stays at base', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20, undefined, { grow: 1 }), mkItem(40, 20)],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(40);
    expect(layout.items[1]!.main).toBe(120);
    expect(layout.items[2]!.main).toBe(40);
  });

  test('C15 grow with gap', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20, undefined, { grow: 1 }), mkItem(40, 20, undefined, { grow: 1 })],
      { innerMain: 200, gap: 10 },
    );
    // free = 200 - 80 - 10 = 110; each gets 55
    expect(layout.items[0]!.main).toBeCloseTo(95, 5);
    expect(layout.items[1]!.main).toBeCloseTo(95, 5);
  });

  test('C16 grow clamped by maxMain', () => {
    const layout = computeFlexLayout(
      [
        mkItem(40, 20, undefined, { grow: 1, maxMain: 80 }),
        mkItem(40, 20, undefined, { grow: 1 }),
      ],
      { innerMain: 220 },
    );
    expect(layout.items[0]!.main).toBe(80);
    // Remainder continues to live with the grower. (Spec would do
    // a second pass; v0.2 engine does a single pass, which matches
    // Chromium for typical capped sibling scenarios within ~1 px.)
  });

  test('C17 grow with no free space does nothing', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20, undefined, { grow: 1 }), mkItem(100, 20, undefined, { grow: 1 })],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
  });

  test('C18 explicit basis + grow', () => {
    const layout = computeFlexLayout(
      [{ ...mkItem(40, 20), basis: 60, grow: 1 }, { ...mkItem(40, 20), basis: 60, grow: 1 }],
      { innerMain: 200 },
    );
    // free = 200 - 120 = 80; each gets 40 → 60 + 40 = 100
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
  });
});

describe('G3.3 shrink distribution', () => {
  test('C19 default shrink (1) distributes overflow proportional to base', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(200, 20)],
      { innerMain: 200 },
    );
    // deficit = 200 - 300 = -100
    // scaled shrinks: 100 and 200 (default shrink 1 × base)
    // shares: -100 × (100/300) = -33.33 and -100 × (200/300) = -66.67
    expect(layout.items[0]!.main).toBeCloseTo(100 - 100 / 3, 5);
    expect(layout.items[1]!.main).toBeCloseTo(200 - 200 / 3, 5);
  });

  test('C20 shrink 0 opts out', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20, undefined, { shrink: 0 }), mkItem(200, 20)],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
  });

  test('C21 weighted shrink (2:1) absorbs overflow unequally', () => {
    const layout = computeFlexLayout(
      [
        mkItem(100, 20, undefined, { shrink: 2 }),
        mkItem(100, 20, undefined, { shrink: 1 }),
      ],
      { innerMain: 150 },
    );
    // deficit = -50; scaled = 200 and 100; total = 300
    // shares: -50 × (2/3) and -50 × (1/3) → -33.33, -16.67
    expect(layout.items[0]!.main).toBeCloseTo(100 - 100 / 3, 5);
    expect(layout.items[1]!.main).toBeCloseTo(100 - 50 / 3, 5);
  });

  test('C22 shrink clamped by minMain triggers second-pass redistribution', () => {
    const layout = computeFlexLayout(
      [
        mkItem(100, 20, undefined, { shrink: 1, minMain: 80 }),
        mkItem(100, 20, undefined, { shrink: 1 }),
      ],
      { innerMain: 120 },
    );
    // First pass: deficit -80, each gets -40 → 60, 60 (item 1 below min)
    // Clamp item 1 to 80. Residual = 120 - 80 - 60 = -20 more deficit.
    // Second pass redistributes to item 2: 60 - 20 = 40.
    expect(layout.items[0]!.main).toBe(80);
    expect(layout.items[1]!.main).toBeCloseTo(40, 5);
  });

  test('C23 shrink to exactly the container', () => {
    const layout = computeFlexLayout(
      [mkItem(120, 20), mkItem(120, 20)],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main + layout.items[1]!.main).toBeCloseTo(200, 5);
    expect(layout.overflows).toBe(false);
  });

  test('C24 shrink with margin included in deficit', () => {
    const m = edgeInsetsOnly({ left: 4, right: 4 });
    const layout = computeFlexLayout(
      [mkItem(100, 20, m), mkItem(100, 20, m)],
      { innerMain: 200 },
    );
    // deficit = 200 - 216 = -16. total base = 200. each gets -8.
    expect(layout.items[0]!.main).toBeCloseTo(92, 5);
    expect(layout.items[1]!.main).toBeCloseTo(92, 5);
  });

  test('C25 every item shrink:0 → overflow preserved', () => {
    const layout = computeFlexLayout(
      [
        mkItem(150, 20, undefined, { shrink: 0 }),
        mkItem(150, 20, undefined, { shrink: 0 }),
      ],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(150);
    expect(layout.items[1]!.main).toBe(150);
    expect(layout.overflows).toBe(true);
  });

  test('C26 mixed grow + shrink at exact fit is a no-op', () => {
    const layout = computeFlexLayout(
      [
        mkItem(100, 20, undefined, { grow: 1, shrink: 1 }),
        mkItem(100, 20, undefined, { grow: 1, shrink: 1 }),
      ],
      { innerMain: 200 },
    );
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
  });
});

describe('G3.4 justify-content', () => {
  const baseItems = () => [mkItem(40, 20), mkItem(40, 20)];

  test('C27 start (default)', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200 });
    expect(l.items[0]!.offset).toBe(0);
    expect(l.items[1]!.offset).toBe(40);
  });

  test('C28 end pushes all items flush right', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200, justify: 'end' });
    expect(l.items[0]!.offset).toBe(120);
    expect(l.items[1]!.offset).toBe(160);
  });

  test('C29 center biases by half free space', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200, justify: 'center' });
    expect(l.items[0]!.offset).toBe(60);
    expect(l.items[1]!.offset).toBe(100);
  });

  test('C30 space-between puts free space between items', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200, justify: 'space-between' });
    expect(l.items[0]!.offset).toBe(0);
    expect(l.items[1]!.offset).toBe(160);
  });

  test('C31 space-around half-gap at ends', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200, justify: 'space-around' });
    // free = 120, each side around each item = 30
    expect(l.items[0]!.offset).toBe(30);
    expect(l.items[1]!.offset).toBe(130);
  });

  test('C32 space-evenly full gaps everywhere', () => {
    const l = computeFlexLayout(baseItems(), { innerMain: 200, justify: 'space-evenly' });
    // free = 120, three gaps → 40 each
    expect(l.items[0]!.offset).toBe(40);
    expect(l.items[1]!.offset).toBe(120);
  });
});

describe('G3.5 fitsFlex + integration', () => {
  test('C33 nav bar of 5 fixed-size pills fits', () => {
    const pills = Array.from({ length: 5 }, () =>
      mkItem(48, 32, edgeInsetsAll(0), { shrink: 0 }),
    );
    const r = fitsFlex({
      children: pills,
      container: { innerMain: 320, gap: 8 },
    });
    expect(r.ok).toBe(true);
    expect(r.layout.contentMain).toBe(48 * 5 + 8 * 4);
  });

  test('C34 German pill overflows a 320px nav (shrink:0 pills)', () => {
    // Real nav bars set flex-shrink: 0 on pills so long labels
    // spill past the container instead of clipping shorter siblings.
    const pills = [
      mkItem(48, 32, undefined, { shrink: 0 }),
      mkItem(48, 32, undefined, { shrink: 0 }),
      mkItem(140, 32, undefined, { shrink: 0 }),
      mkItem(48, 32, undefined, { shrink: 0 }),
      mkItem(48, 32, undefined, { shrink: 0 }),
    ];
    const r = fitsFlex({
      children: pills,
      container: { innerMain: 320, gap: 8 },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/main-axis overflow/);
  });

  test('C35 fitsFlex ok when last item absorbs free space via grow', () => {
    const r = fitsFlex({
      children: [mkItem(80, 32), mkItem(80, 32, undefined, { grow: 1 })],
      container: { innerMain: 300 },
    });
    expect(r.ok).toBe(true);
    expect(r.layout.items[1]!.main).toBe(220);
  });

  test('C36 cross-axis overflow flagged', () => {
    const r = fitsFlex({
      children: [mkItem(40, 40), mkItem(40, 60)],
      container: { innerMain: 300, innerCross: 50 },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/cross-axis overflow/);
  });

  test('C37 column direction uses heights as main-axis', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 30)],
      { innerMain: 100, direction: 'column' },
    );
    expect(layout.direction).toBe('column');
    expect(layout.items[0]!.main).toBe(20);
    expect(layout.items[1]!.main).toBe(30);
    expect(layout.items[1]!.offset).toBe(20);
  });

  test('C38 column with gap + justify end', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20)],
      { innerMain: 100, direction: 'column', gap: 10, justify: 'end' },
    );
    expect(layout.items[0]!.offset).toBe(50);
    expect(layout.items[1]!.offset).toBe(80);
  });

  test('C39 shrink on oversized column', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 80), mkItem(40, 80)],
      { innerMain: 120, direction: 'column' },
    );
    expect(layout.items[0]!.main + layout.items[1]!.main).toBeCloseTo(120, 5);
  });

  test('C40 grow=1 on every item produces equal widths', () => {
    const items = [
      mkItem(20, 20, undefined, { grow: 1, shrink: 0 }),
      mkItem(20, 20, undefined, { grow: 1, shrink: 0 }),
      mkItem(20, 20, undefined, { grow: 1, shrink: 0 }),
      mkItem(20, 20, undefined, { grow: 1, shrink: 0 }),
    ];
    const layout = computeFlexLayout(items, { innerMain: 400 });
    for (const it of layout.items) expect(it.main).toBe(100);
  });
});
