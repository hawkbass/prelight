/**
 * Flex-engine corpus: 72 cases.
 *
 * Each case encodes a flex-layout scenario with expected values
 * derived from CSS Flex L1 §9.7 ("Resolving Flexible Lengths"),
 * §9.3 ("Main Size Determination" — line breaking), and §8.3
 * ("Cross-Axis Alignment"). Categories:
 *
 *   1-10:   Basic packing — no grow/shrink, with gap + justify    [v0.2 G3.1]
 *  11-18:   Grow distribution (equal, weighted, clamped)          [v0.2 G3.2]
 *  19-26:   Shrink distribution                                   [v0.2 G3.3]
 *  27-32:   Justify-content variants                              [v0.2 G3.4]
 *  33-40:   fitsFlex predicate + column direction                 [v0.2 G3.5]
 *  41-52:   Wrap packing (multi-line)                             [v0.3 H1.1]
 *  53-64:   align-items (start, end, center, stretch)             [v0.3 H1.2]
 *  65-72:   wrap × align × direction integration                  [v0.3 H1.3]
 *
 * Pattern: `mkItem(borderBox, margin?)` builds a flex item with a
 * constant-size box so tests stay readable. The tests don't care
 * about text inside; this corpus is about main + cross-axis
 * resolution only.
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

// ================================================================
// v0.3 H1 — wrap + cross-axis alignment
// ================================================================

describe('H1.1 wrap packing', () => {
  test('C41 three items of width 100 wrap into two lines at innerMain=200', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 20), mkItem(100, 20)],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.items).toHaveLength(2);
    expect(layout.lines[1]!.items).toHaveLength(1);
    expect(layout.lines[0]!.mainExtent).toBe(200);
    expect(layout.lines[1]!.mainExtent).toBe(100);
    expect(layout.contentMain).toBe(200);
    expect(layout.overflows).toBe(false);
  });

  test('C42 wrap with gap preserves intra-line gap and honours line-break threshold', () => {
    // Three 80px items with gap 20 in a 200px container:
    //   line 1 fits items 0+1 at 80+20+80 = 180
    //   item 2 would need 180+20+80 = 280 → wraps to line 2
    const layout = computeFlexLayout(
      [mkItem(80, 20), mkItem(80, 20), mkItem(80, 20)],
      { innerMain: 200, gap: 20, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.mainExtent).toBe(180);
    expect(layout.items[1]!.offset).toBe(100); // 80 + gap 20
    expect(layout.items[2]!.offset).toBe(0); // fresh line restarts main axis
  });

  test('C43 oversized shrink:0 item on own line reports main overflow', () => {
    // 150px item cannot fit in 100px container; wrap puts it on its
    // own line but with shrink:0 it stays 150 and overflows.
    const layout = computeFlexLayout(
      [
        mkItem(50, 20),
        mkItem(150, 20, undefined, { shrink: 0 }),
        mkItem(50, 20),
      ],
      { innerMain: 100, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(3);
    expect(layout.lines[1]!.items).toHaveLength(1);
    expect(layout.lines[1]!.mainExtent).toBe(150);
    expect(layout.contentMain).toBe(150);
    expect(layout.overflows).toBe(true);
  });

  test('C44 column direction wraps on height', () => {
    // direction='column' → main axis is vertical. innerMain=100
    // holds two 40px items before the third wraps to a new column.
    const layout = computeFlexLayout(
      [mkItem(40, 40), mkItem(40, 40), mkItem(40, 40)],
      { innerMain: 100, direction: 'column', wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.items).toHaveLength(2);
    expect(layout.lines[1]!.items).toHaveLength(1);
    expect(layout.direction).toBe('column');
  });

  test('C45 grow applies per line, not across the whole flex', () => {
    // Three grow=1 items in a 200px container wrap as [0,1][2].
    // Line 1 has zero free space → no growth. Line 2's lone item
    // absorbs all 100px of free space.
    const layout = computeFlexLayout(
      [
        mkItem(100, 20, undefined, { grow: 1 }),
        mkItem(100, 20, undefined, { grow: 1 }),
        mkItem(100, 20, undefined, { grow: 1 }),
      ],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.items[0]!.main).toBe(100);
    expect(layout.items[1]!.main).toBe(100);
    expect(layout.items[2]!.main).toBe(200);
  });

  test('C46 wrap=wrap with items that all fit keeps lines.length===1', () => {
    const layout = computeFlexLayout(
      [mkItem(30, 20), mkItem(30, 20), mkItem(30, 20)],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]!.items).toHaveLength(3);
    expect(layout.overflows).toBe(false);
  });

  test('C47 flat layout.items preserves input order across lines', () => {
    // Build tagged items with distinctive widths so we can verify
    // order by main value.
    const layout = computeFlexLayout(
      [mkItem(90, 20), mkItem(90, 20), mkItem(90, 20), mkItem(90, 20)],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.items).toHaveLength(4);
    // All items are 90px; what we verify is that the flat array's
    // length + line membership round-trips correctly.
    expect(layout.lines[0]!.items).toHaveLength(2);
    expect(layout.lines[1]!.items).toHaveLength(2);
    expect(layout.lines[0]!.items[0]).toBe(layout.items[0]);
    expect(layout.lines[1]!.items[0]).toBe(layout.items[2]);
    expect(layout.lines[1]!.items[1]).toBe(layout.items[3]);
  });

  test('C48 minMain clamp participates in line-break decision', () => {
    // Items have basis 50 but minMain 80: hypothetical = 80.
    // 3 such items in innerMain 200 wrap as [0,1] + [2].
    const layout = computeFlexLayout(
      [
        mkItem(50, 20, undefined, { minMain: 80 }),
        mkItem(50, 20, undefined, { minMain: 80 }),
        mkItem(50, 20, undefined, { minMain: 80 }),
      ],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.items).toHaveLength(2);
    expect(layout.items[0]!.main).toBe(80);
  });

  test('C49 margin counts in packing extent and offsets', () => {
    // Items of border-box 80 with horizontal margin 10/10.
    // outerMain = 100 each; 3 items wrap in a 200px container.
    const m = edgeInsetsOnly({ left: 10, right: 10 });
    const layout = computeFlexLayout(
      [mkItem(80, 20, m), mkItem(80, 20, m), mkItem(80, 20, m)],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    // Item 0 starts after its own left margin: offset = 0 + 10.
    expect(layout.items[0]!.offset).toBe(10);
    // Item 1 starts after item 0's outer + its own left margin:
    //   leadingOffsets[1] = 100 + 10 = 110.
    expect(layout.items[1]!.offset).toBe(110);
    // Item 2 is on line 2: cursor restarts at 0 → offset = 10.
    expect(layout.items[2]!.offset).toBe(10);
  });

  test('C50 contentCross equals sum of line crossSizes when crossGap=0', () => {
    // 4 items w=80 h=30 with wrap in a 200px container pack as 2 per
    // line × 2 lines; each line crossSize = 30.
    const layout = computeFlexLayout(
      [mkItem(80, 30), mkItem(80, 30), mkItem(80, 30), mkItem(80, 30)],
      { innerMain: 200, wrap: 'wrap' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.contentCross).toBe(60);
    expect(layout.lines[0]!.crossStart).toBe(0);
    expect(layout.lines[1]!.crossStart).toBe(30);
  });

  test('C51 explicit crossGap overrides the main gap for between-line spacing', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 20), mkItem(100, 20)],
      { innerMain: 200, wrap: 'wrap', crossGap: 10 },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.crossStart).toBe(0);
    // Line 2 sits at line 1's crossSize (20) + crossGap (10) = 30.
    expect(layout.lines[1]!.crossStart).toBe(30);
    expect(layout.contentCross).toBe(50);
  });

  test('C52 empty input with wrap:wrap returns empty lines', () => {
    const layout = computeFlexLayout([], { innerMain: 200, wrap: 'wrap' });
    expect(layout.items).toHaveLength(0);
    expect(layout.lines).toHaveLength(0);
    expect(layout.contentCross).toBe(0);
    expect(layout.freeSpace).toBe(200);
    expect(layout.overflows).toBe(false);
  });
});

describe('H1.2 align-items', () => {
  test('C53 align start (default) on single line with innerCross keeps items at top', () => {
    // Single line of h=20 items in a 80px container; start means
    // crossOffset = 0 + leading margin (0) for all items.
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20)],
      { innerMain: 200, innerCross: 80 },
    );
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]!.crossSize).toBe(80);
    expect(layout.items[0]!.crossOffset).toBe(0);
    expect(layout.items[0]!.cross).toBe(20);
  });

  test('C54 align end pushes items to the cross-end edge', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 20)],
      { innerMain: 200, innerCross: 80, align: 'end' },
    );
    // slack = 80 - 20 = 60 → crossOffset = 60.
    expect(layout.items[0]!.crossOffset).toBe(60);
    expect(layout.items[0]!.cross).toBe(20);
  });

  test('C55 align center biases by half the cross slack', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20)],
      { innerMain: 200, innerCross: 80, align: 'center' },
    );
    // slack = 60 → bias = 30.
    expect(layout.items[0]!.crossOffset).toBe(30);
    expect(layout.items[0]!.cross).toBe(20);
  });

  test('C56 align stretch on single line expands cross to innerCross', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20)],
      { innerMain: 200, innerCross: 80, align: 'stretch' },
    );
    expect(layout.items[0]!.cross).toBe(80);
    expect(layout.items[0]!.crossOffset).toBe(0);
  });

  test('C57 align stretch without innerCross grows items to the tallest sibling', () => {
    // innerCross undefined → lineCrossSize = max(h=20, h=50) = 50.
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 50)],
      { innerMain: 200, align: 'stretch' },
    );
    expect(layout.lines[0]!.crossSize).toBe(50);
    expect(layout.items[0]!.cross).toBe(50);
    expect(layout.items[1]!.cross).toBe(50);
  });

  test('C58 align stretch preserves cross-axis margins', () => {
    // cross margin (top+bottom) = 10; stretch to innerCross=80
    // yields cross = 80 - 10 = 70, crossOffset = top margin 5.
    const m = edgeInsetsOnly({ top: 5, bottom: 5 });
    const layout = computeFlexLayout(
      [mkItem(40, 20, m)],
      { innerMain: 200, innerCross: 80, align: 'stretch' },
    );
    expect(layout.items[0]!.cross).toBe(70);
    expect(layout.items[0]!.crossOffset).toBe(5);
  });

  test('C59 align start with varying heights keeps each item at crossOffset 0', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 40), mkItem(40, 30)],
      { innerMain: 200 }, // align default 'start'
    );
    expect(layout.lines[0]!.crossSize).toBe(40);
    expect(layout.items[0]!.crossOffset).toBe(0);
    expect(layout.items[1]!.crossOffset).toBe(0);
    expect(layout.items[2]!.crossOffset).toBe(0);
    expect(layout.items[0]!.cross).toBe(20);
    expect(layout.items[1]!.cross).toBe(40);
    expect(layout.items[2]!.cross).toBe(30);
  });

  test('C60 align center with varying heights centres each item within lineCrossSize', () => {
    const layout = computeFlexLayout(
      [mkItem(40, 20), mkItem(40, 40), mkItem(40, 30)],
      { innerMain: 200, align: 'center' },
    );
    // lineCrossSize = 40.
    expect(layout.items[0]!.crossOffset).toBe(10); // (40-20)/2
    expect(layout.items[1]!.crossOffset).toBe(0); // (40-40)/2
    expect(layout.items[2]!.crossOffset).toBe(5); // (40-30)/2
  });

  test('C61 column direction + align center centres on the horizontal axis', () => {
    // Cross axis for column is width. 2 items widths [20, 40];
    // lineCrossSize = 40. align center: item 0 slack = 20 → bias 10.
    const layout = computeFlexLayout(
      [mkItem(20, 30), mkItem(40, 30)],
      { innerMain: 200, direction: 'column', align: 'center' },
    );
    expect(layout.items[0]!.crossOffset).toBe(10);
    expect(layout.items[1]!.crossOffset).toBe(0);
  });

  test('C62 align end with cross-axis margin includes leading margin in offset', () => {
    // item crossOuter = 20 + (5+5) = 30; innerCross = 80; slack =
    // 50 → bias 50; crossOffset = leading(top)=5 + 50 = 55.
    const m = edgeInsetsOnly({ top: 5, bottom: 5 });
    const layout = computeFlexLayout(
      [mkItem(40, 20, m)],
      { innerMain: 200, innerCross: 80, align: 'end' },
    );
    expect(layout.items[0]!.crossOffset).toBe(55);
    expect(layout.items[0]!.cross).toBe(20);
  });

  test('C63 align stretch does not shrink an item whose crossOuter exceeds innerCross', () => {
    // Item h=60 in innerCross=40; line grows to 60, cross stays 60,
    // crossOverflows reports true.
    const layout = computeFlexLayout(
      [mkItem(40, 60)],
      { innerMain: 200, innerCross: 40, align: 'stretch' },
    );
    expect(layout.lines[0]!.crossSize).toBe(60);
    expect(layout.items[0]!.cross).toBe(60);
    expect(layout.crossOverflows).toBe(true);
  });

  test('C64 align center with innerCross > tallest sibling uses innerCross', () => {
    // Tallest sibling is h=20; innerCross=100; lineCrossSize = 100.
    const layout = computeFlexLayout(
      [mkItem(40, 20)],
      { innerMain: 200, innerCross: 100, align: 'center' },
    );
    expect(layout.lines[0]!.crossSize).toBe(100);
    // slack = 100 - 20 = 80 → bias = 40.
    expect(layout.items[0]!.crossOffset).toBe(40);
  });
});

describe('H1.3 wrap × align integration', () => {
  test('C65 wrap + align start: each line starts flush at its own crossStart', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 20), mkItem(100, 20)],
      { innerMain: 200, wrap: 'wrap', align: 'start' },
    );
    expect(layout.lines).toHaveLength(2);
    // Line 1 items: crossOffset = 0 + 0.
    expect(layout.items[0]!.crossOffset).toBe(0);
    expect(layout.items[1]!.crossOffset).toBe(0);
    // Line 2 item: crossOffset = line 1 crossSize (20) + 0 = 20.
    expect(layout.items[2]!.crossOffset).toBe(20);
  });

  test('C66 wrap + align center centres items within each line independently', () => {
    // 4 items alternating heights 20 and 40 wrap as [0,1][2,3].
    // Each line crossSize = 40 (max of its pair).
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 40), mkItem(100, 20), mkItem(100, 40)],
      { innerMain: 200, wrap: 'wrap', align: 'center' },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.crossSize).toBe(40);
    expect(layout.lines[1]!.crossSize).toBe(40);
    // Item 0 (h=20) centred in line 1 → crossOffset = 10.
    expect(layout.items[0]!.crossOffset).toBe(10);
    expect(layout.items[1]!.crossOffset).toBe(0);
    // Line 2 starts at crossStart = 40; item 2 (h=20) → 40 + 10 = 50.
    expect(layout.items[2]!.crossOffset).toBe(50);
    expect(layout.items[3]!.crossOffset).toBe(40);
  });

  test('C67 wrap + align stretch expands each item to its own line crossSize', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 40), mkItem(100, 20), mkItem(100, 40)],
      { innerMain: 200, wrap: 'wrap', align: 'stretch' },
    );
    expect(layout.items[0]!.cross).toBe(40);
    expect(layout.items[1]!.cross).toBe(40);
    expect(layout.items[2]!.cross).toBe(40);
    expect(layout.items[3]!.cross).toBe(40);
  });

  test('C68 wrap contentCross = sum(line crossSize) + crossGap*(n-1)', () => {
    const layout = computeFlexLayout(
      [mkItem(100, 20), mkItem(100, 30), mkItem(100, 40), mkItem(100, 50)],
      { innerMain: 200, wrap: 'wrap', crossGap: 8 },
    );
    // Lines: [0,1] (crossSize 30) + [2,3] (crossSize 50).
    // contentCross = 30 + 8 + 50 = 88.
    expect(layout.contentCross).toBe(88);
  });

  test('C69 fitsFlex with wrap is ok when every line fits the main axis and lines fit innerCross', () => {
    const r = fitsFlex({
      children: [mkItem(100, 20), mkItem(100, 20), mkItem(100, 20), mkItem(100, 20)],
      container: { innerMain: 220, innerCross: 60, wrap: 'wrap' },
    });
    expect(r.ok).toBe(true);
    expect(r.layout.lines).toHaveLength(2);
    expect(r.layout.contentCross).toBe(40);
  });

  test('C70 fitsFlex wrap reports cross-axis overflow when stacked lines exceed innerCross', () => {
    const r = fitsFlex({
      children: [mkItem(100, 20), mkItem(100, 20), mkItem(100, 20), mkItem(100, 20)],
      container: { innerMain: 220, innerCross: 30, wrap: 'wrap' },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/cross-axis overflow/);
  });

  test('C71 wrap converts a layout that would overflow nowrap into a clean fit', () => {
    const spec = [mkItem(100, 20, undefined, { shrink: 0 }), mkItem(100, 20, undefined, { shrink: 0 }), mkItem(100, 20, undefined, { shrink: 0 })];
    const nowrap = fitsFlex({
      children: spec,
      container: { innerMain: 200, innerCross: 100 },
    });
    const wrapped = fitsFlex({
      children: spec,
      container: { innerMain: 200, innerCross: 100, wrap: 'wrap' },
    });
    expect(nowrap.ok).toBe(false);
    expect(nowrap.reasons[0]).toMatch(/main-axis overflow/);
    expect(wrapped.ok).toBe(true);
    expect(wrapped.layout.lines).toHaveLength(2);
  });

  test('C72 wrap + column + align fits a vertical tag cloud', () => {
    // Column main=height 120 holds 3 h=40 items per column; wrap
    // starts a new column for item 4. Align center uses width axis.
    const layout = computeFlexLayout(
      [mkItem(20, 40), mkItem(40, 40), mkItem(20, 40), mkItem(40, 40)],
      {
        innerMain: 120,
        direction: 'column',
        wrap: 'wrap',
        align: 'center',
      },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]!.items).toHaveLength(3);
    expect(layout.lines[1]!.items).toHaveLength(1);
    // Column 1 crossSize = max width of its items = max(20,40,20) = 40.
    expect(layout.lines[0]!.crossSize).toBe(40);
    // Column 2 crossSize = 40 (its single 40-wide item).
    expect(layout.lines[1]!.crossSize).toBe(40);
    // item 0 centred in col 1: slack 20, bias 10.
    expect(layout.items[0]!.crossOffset).toBe(10);
    expect(layout.items[1]!.crossOffset).toBe(0);
    // item 3 in col 2: crossStart 40 + slack 0 + leading 0 = 40.
    expect(layout.items[3]!.crossOffset).toBe(40);
  });
});
