/**
 * H6a/H6b contract tests for `VerifySpec.measurementFonts.{cjk,emoji}`.
 *
 * The canvas backend in unit tests is `@napi-rs/canvas`, which has no
 * CJK or emoji faces registered (ground-truth registers CJK subsets at
 * startup; emoji stays unregistered). So we can't observe a *different
 * family* being picked in a unit test — every family probe resolves to
 * the same host font metrics. What we *can* observe is the sequence of
 * family candidates probed by each correction pass, by swapping in a
 * test-local `OffscreenCanvas` stub that records every `ctx.font`
 * assignment.
 *
 * That's enough to prove the contract wiring for both passes:
 *
 *   per-call arg  >  module-level global  >  spec's own `font`
 *
 * plus the `[]` opt-out, plus per-call isolation when the global
 * changes across calls.
 *
 * CJK probes M1-M12; emoji probes M13-M24 follow the same shape. The
 * only structural difference is that `correctEmojiLayout` returns the
 * input unchanged when the probe finds no emoji family (the CJK
 * correction falls back to the spec's own `font` in that case).
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  correctCJKLayout,
  getCJKMeasurementFamilies,
  setCJKMeasurementFamilies,
} from '../src/shape/cjk.js';
import {
  correctEmojiLayout,
  getEmojiMeasurementFamilies,
  setEmojiMeasurementFamilies,
} from '../src/shape/emoji.js';
import type { LayoutLike } from '../src/shape/rtl.js';
import { verify } from '../src/verify.js';

/** Fake CJK-free layout the correction pass starts from. */
const SEED_LAYOUT: LayoutLike = {
  lineCount: 1,
  height: 24,
  lines: [{ text: '作業テスト', width: 120 }],
};
const CJK_TEXT = '作業テストの完了を確認してください';
// Emoji seed: single-line Pretext output the emoji correction would
// potentially rewrap if the probe found a registered emoji family.
const EMOJI_SEED_LAYOUT: LayoutLike = {
  lineCount: 1,
  height: 24,
  lines: [{ text: '🚀 Ship it 🚀', width: 60 }],
};
const EMOJI_TEXT = '🚀 Ship it 🚀';
const FONT = '16px Inter';

interface ProbeRecorder {
  fonts: string[];
  measureCalls: number;
}

/**
 * Install an `OffscreenCanvas` stub that records every `ctx.font =` write
 * and returns a constant width for `measureText`. Returns a disposer that
 * restores the prior global.
 *
 * Constant-width measurement means every probe will *fail* the >0.5px
 * delta check in `pickCJKFamily`, so the loop visits every family and
 * ends with `measurementFont = font` (input) — which is exactly what we
 * want for observing the probe sequence.
 */
function installProbeCanvas(recorder: ProbeRecorder): () => void {
  type GlobalWithCanvas = { OffscreenCanvas?: unknown };
  const globalRef = globalThis as GlobalWithCanvas;
  const prior = globalRef.OffscreenCanvas;

  class Ctx {
    private _font = '';
    get font(): string {
      return this._font;
    }
    set font(value: string) {
      this._font = value;
      recorder.fonts.push(value);
    }
    measureText(_text: string): { width: number } {
      recorder.measureCalls += 1;
      return { width: 10 };
    }
  }
  class OffscreenCanvasStub {
    constructor(_w: number, _h: number) {}
    getContext(_type: string): Ctx {
      return new Ctx();
    }
  }
  globalRef.OffscreenCanvas = OffscreenCanvasStub;
  return () => {
    globalRef.OffscreenCanvas = prior;
  };
}

function familyProbes(recorder: ProbeRecorder): string[] {
  // After the probe, pickCJKFamily leaves ctx.font set to the chosen
  // measurementFont (the original, in this stub). We care about the
  // *candidates* probed, which is every ctx.font assignment after the
  // initial baseline — i.e., everything from index 1 onward, except the
  // final assignment which re-sets ctx.font to the chosen measurementFont.
  //
  // In practice pickCJKFamily writes: baseline, candidate1, candidate2, …
  // Then correctCJKLayout writes ctx.font = measurementFont once more,
  // then again before the per-line width measurement loop.
  return recorder.fonts.slice();
}

/**
 * Extract just the font-family portion of an "NNpx <family>" shorthand.
 * Useful for asserting which families were probed without pinning the
 * full shorthand.
 */
function familyOf(shorthand: string): string {
  const m = /^\s*\d*\.?\d+px(?:\/[^\s]+)?\s+(.*)$/.exec(shorthand);
  return m ? m[1]!.trim() : shorthand;
}

describe('H6a — VerifySpec.measurementFonts.cjk contract', () => {
  // Preserve and restore the module-level global so tests stay isolated.
  let priorGlobal: readonly string[];
  const recorder: ProbeRecorder = { fonts: [], measureCalls: 0 };
  let restoreCanvas: (() => void) | null = null;

  beforeEach(() => {
    priorGlobal = getCJKMeasurementFamilies();
    recorder.fonts = [];
    recorder.measureCalls = 0;
    restoreCanvas = installProbeCanvas(recorder);
  });

  afterEach(() => {
    if (restoreCanvas) restoreCanvas();
    restoreCanvas = null;
    // Restore the module-level global to its pre-test value.
    setCJKMeasurementFamilies([...priorGlobal]);
  });

  describe('correctCJKLayout direct contract', () => {
    test('M1: undefined override falls back to the module-level global', () => {
      setCJKMeasurementFamilies(['Global-A', 'Global-B']);
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Global-A');
      expect(probed).toContain('Global-B');
      expect(probed).not.toContain('Spec-A');
    });

    test('M2: non-empty override takes precedence over the global', () => {
      setCJKMeasurementFamilies(['Global-A', 'Global-B']);
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24, ['Spec-A', 'Spec-B']);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Spec-A');
      expect(probed).toContain('Spec-B');
      expect(probed).not.toContain('Global-A');
      expect(probed).not.toContain('Global-B');
    });

    test('M3: empty-array override opts out of the probe entirely', () => {
      setCJKMeasurementFamilies(['Global-A']);
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24, []);
      const probed = familyProbes(recorder).map(familyOf);
      // No CJK family candidate was probed. We still see the input font
      // set on ctx during the per-line width measurement loop, but no
      // "Global-A" / "Spec-*" candidate appears.
      expect(probed).not.toContain('Global-A');
      expect(probed.every((f) => f === 'Inter')).toBe(true);
    });

    test('M4: override preserves family order (first candidate probed first)', () => {
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24, ['First', 'Second', 'Third']);
      const candidates = familyProbes(recorder)
        .map(familyOf)
        .filter((f) => f === 'First' || f === 'Second' || f === 'Third');
      expect(candidates).toEqual(['First', 'Second', 'Third']);
    });

    test('M5: non-CJK text short-circuits before any canvas probe', () => {
      correctCJKLayout(
        { lineCount: 1, height: 24, lines: [{ text: 'Hello', width: 50 }] },
        'Hello world',
        FONT,
        200,
        24,
        ['Spec-A'],
      );
      expect(recorder.fonts).toEqual([]);
      expect(recorder.measureCalls).toBe(0);
    });

    test('M6: per-call override does not mutate the module-level global', () => {
      setCJKMeasurementFamilies(['Global-A']);
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24, ['Spec-A']);
      expect(getCJKMeasurementFamilies()).toEqual(['Global-A']);
    });

    test('M7: per-call override is isolated across successive calls', () => {
      setCJKMeasurementFamilies(['Global-A']);

      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24, ['Spec-A']);
      const firstCall = familyProbes(recorder).map(familyOf);
      expect(firstCall).toContain('Spec-A');
      expect(firstCall).not.toContain('Global-A');

      recorder.fonts = [];
      correctCJKLayout(SEED_LAYOUT, CJK_TEXT, FONT, 200, 24);
      const secondCall = familyProbes(recorder).map(familyOf);
      expect(secondCall).toContain('Global-A');
      expect(secondCall).not.toContain('Spec-A');
    });
  });

  describe('verify() integration', () => {
    test('M8: spec.measurementFonts.cjk reaches correctCJKLayout', () => {
      const result = verify({
        text: { ja: CJK_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
        measurementFonts: { cjk: ['Via-Spec'] },
      });
      // We don't care about ok/fail here — the contract we're verifying
      // is that the spec option was threaded through to the probe path.
      expect(result.cellsChecked).toBe(1);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Via-Spec');
    });

    test('M9: omitting measurementFonts falls through to the global', () => {
      setCJKMeasurementFamilies(['Via-Global']);
      verify({
        text: { ja: CJK_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Via-Global');
    });

    test('M10: spec.measurementFonts.cjk = [] opts out end-to-end', () => {
      setCJKMeasurementFamilies(['Via-Global']);
      verify({
        text: { ja: CJK_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
        measurementFonts: { cjk: [] },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).not.toContain('Via-Global');
      expect(probed.every((f) => f === 'Inter')).toBe(true);
    });

    test('M11: non-CJK text in verify() never triggers the CJK probe even with measurementFonts set', () => {
      verify({
        text: { en: 'Hello world' },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 1 },
        measurementFonts: { cjk: ['Unused'] },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).not.toContain('Unused');
    });

    test('M12: scale sweep routes measurementFonts through every cell', () => {
      const result = verify({
        text: { ja: CJK_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 20 },
        fontScales: [1, 1.5],
        measurementFonts: { cjk: ['Scale-Fam'] },
      });
      expect(result.cellsChecked).toBe(2);
      const probed = familyProbes(recorder).map(familyOf);
      // Both cells must have probed the per-call family.
      const hits = probed.filter((f) => f === 'Scale-Fam').length;
      expect(hits).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('H6b — VerifySpec.measurementFonts.emoji contract', () => {
  // Preserve and restore the module-level global so tests stay isolated.
  let priorGlobal: readonly string[];
  const recorder: ProbeRecorder = { fonts: [], measureCalls: 0 };
  let restoreCanvas: (() => void) | null = null;

  beforeEach(() => {
    priorGlobal = getEmojiMeasurementFamilies();
    recorder.fonts = [];
    recorder.measureCalls = 0;
    restoreCanvas = installProbeCanvas(recorder);
  });

  afterEach(() => {
    if (restoreCanvas) restoreCanvas();
    restoreCanvas = null;
    setEmojiMeasurementFamilies([...priorGlobal]);
  });

  describe('correctEmojiLayout direct contract', () => {
    test('M13: undefined override falls back to the module-level global', () => {
      setEmojiMeasurementFamilies(['Global-A', 'Global-B']);
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Global-A');
      expect(probed).toContain('Global-B');
      expect(probed).not.toContain('Spec-A');
    });

    test('M14: non-empty override takes precedence over the global', () => {
      setEmojiMeasurementFamilies(['Global-A', 'Global-B']);
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24, [
        'Spec-A',
        'Spec-B',
      ]);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Spec-A');
      expect(probed).toContain('Spec-B');
      expect(probed).not.toContain('Global-A');
      expect(probed).not.toContain('Global-B');
    });

    test('M15: empty-array override opts out of the probe entirely', () => {
      setEmojiMeasurementFamilies(['Global-A']);
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24, []);
      const probed = familyProbes(recorder).map(familyOf);
      // `pickEmojiFamily` short-circuits on `families.length === 0`
      // before writing any ctx.font, so the recorder sees zero
      // assignments. Contrast M3, where the CJK pass still runs its
      // per-line measurement loop on the spec's own font.
      expect(probed).toEqual([]);
      expect(recorder.measureCalls).toBe(0);
    });

    test('M16: override preserves family order (first candidate probed first)', () => {
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24, [
        'First',
        'Second',
        'Third',
      ]);
      const candidates = familyProbes(recorder)
        .map(familyOf)
        .filter((f) => f === 'First' || f === 'Second' || f === 'Third');
      expect(candidates).toEqual(['First', 'Second', 'Third']);
    });

    test('M17: non-emoji text short-circuits before any canvas probe', () => {
      correctEmojiLayout(
        { lineCount: 1, height: 24, lines: [{ text: 'Hello', width: 50 }] },
        'Hello world',
        FONT,
        200,
        24,
        ['Spec-A'],
      );
      expect(recorder.fonts).toEqual([]);
      expect(recorder.measureCalls).toBe(0);
    });

    test('M18: per-call override does not mutate the module-level global', () => {
      setEmojiMeasurementFamilies(['Global-A']);
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24, [
        'Spec-A',
      ]);
      expect(getEmojiMeasurementFamilies()).toEqual(['Global-A']);
    });

    test('M19: per-call override is isolated across successive calls', () => {
      setEmojiMeasurementFamilies(['Global-A']);

      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24, [
        'Spec-A',
      ]);
      const firstCall = familyProbes(recorder).map(familyOf);
      expect(firstCall).toContain('Spec-A');
      expect(firstCall).not.toContain('Global-A');

      recorder.fonts = [];
      correctEmojiLayout(EMOJI_SEED_LAYOUT, EMOJI_TEXT, FONT, 200, 24);
      const secondCall = familyProbes(recorder).map(familyOf);
      expect(secondCall).toContain('Global-A');
      expect(secondCall).not.toContain('Spec-A');
    });
  });

  describe('verify() integration', () => {
    test('M20: spec.measurementFonts.emoji reaches correctEmojiLayout', () => {
      const result = verify({
        text: { en: EMOJI_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
        measurementFonts: { emoji: ['Via-Spec'] },
      });
      expect(result.cellsChecked).toBe(1);
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Via-Spec');
    });

    test('M21: omitting measurementFonts falls through to the global', () => {
      setEmojiMeasurementFamilies(['Via-Global']);
      verify({
        text: { en: EMOJI_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).toContain('Via-Global');
    });

    test('M22: spec.measurementFonts.emoji = [] opts out end-to-end', () => {
      setEmojiMeasurementFamilies(['Via-Global']);
      verify({
        text: { en: EMOJI_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 10 },
        measurementFonts: { emoji: [] },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).not.toContain('Via-Global');
      // With the emoji probe opted out, pickEmojiFamily short-circuits
      // before writing any ctx.font. Other passes (CJK/RTL) also
      // short-circuit because EMOJI_TEXT is neither CJK nor RTL, so the
      // recorder stays empty for this spec.
      expect(probed).toEqual([]);
    });

    test('M23: non-emoji text in verify() never triggers the emoji probe even with measurementFonts set', () => {
      verify({
        text: { en: 'Hello world' },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 1 },
        measurementFonts: { emoji: ['Unused'] },
      });
      const probed = familyProbes(recorder).map(familyOf);
      expect(probed).not.toContain('Unused');
    });

    test('M24: scale sweep routes measurementFonts.emoji through every cell', () => {
      const result = verify({
        text: { en: EMOJI_TEXT },
        font: FONT,
        maxWidth: 200,
        lineHeight: 24,
        constraints: { maxLines: 20 },
        fontScales: [1, 1.5],
        measurementFonts: { emoji: ['Scale-Fam'] },
      });
      expect(result.cellsChecked).toBe(2);
      const probed = familyProbes(recorder).map(familyOf);
      const hits = probed.filter((f) => f === 'Scale-Fam').length;
      expect(hits).toBeGreaterThanOrEqual(2);
    });
  });
});
