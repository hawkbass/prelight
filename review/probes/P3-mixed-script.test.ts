/**
 * Probe P3 — trace "Hello 👋 你好 مرحبا" through verify()'s
 * correction pipeline and document each pass's input and output.
 *
 * The pipeline documented in packages/core/src/verify.ts is:
 *
 *   prepareWithSegments + layoutWithLines         (pretext)
 *   → applyFitsInOneLineCorrection
 *   → correctRTLLayout       (triggers if containsRTL)
 *   → correctCJKLayout       (triggers if containsCJK)
 *   → correctEmojiLayout     (triggers if containsEmoji)
 *
 * Each correction returns `input unchanged` when the relevant
 * script is absent OR when the canvas/family probe gives up.
 * When a correction DOES trigger, it replaces the entire layout
 * with its own re-lay of the original text. The question this
 * probe answers: do corrections compose, or does the last one
 * that fires clobber the work of the ones before it?
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { ensureCanvasEnv } from '@prelight/core';
import {
  applyFitsInOneLineCorrection,
  correctRTLLayout,
  containsRTL,
} from '../../packages/core/dist/shape/rtl.js';
import {
  correctCJKLayout,
  containsCJK,
} from '../../packages/core/dist/shape/cjk.js';
import {
  correctEmojiLayout,
  containsEmoji,
} from '../../packages/core/dist/shape/emoji.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

const TEXT = 'Hello 👋 你好 مرحبا';
const FONT = '16px Inter';
const MAX_WIDTH = 80;
const LINE_HEIGHT = 20;

describe('P3 — mixed-script pipeline trace', () => {
  beforeAll(async () => {
    await ensureCanvasEnv();
  });

  it('traces each correction pass', () => {
    console.log('=== P3: text =', JSON.stringify(TEXT));
    console.log(
      '    containsRTL=%s containsCJK=%s containsEmoji=%s',
      containsRTL(TEXT),
      containsCJK(TEXT),
      containsEmoji(TEXT),
    );

    const prepared = prepareWithSegments(TEXT, FONT);
    const pretextLaid = layoutWithLines(prepared, MAX_WIDTH, LINE_HEIGHT);
    console.log(
      '[0] pretext:',
      pretextLaid.lineCount,
      'lines',
      JSON.stringify(pretextLaid.lines.map((l) => ({ text: l.text, w: l.width }))),
    );

    const preparedNat = prepareWithSegments(TEXT, FONT);
    const naturalLaid = layoutWithLines(preparedNat, Number.POSITIVE_INFINITY, LINE_HEIGHT);
    const naturalWidth = naturalLaid.lines[0]?.width ?? 0;

    const fitOne = applyFitsInOneLineCorrection(
      pretextLaid,
      naturalWidth,
      MAX_WIDTH,
      LINE_HEIGHT,
    );
    console.log('[1] after fits-one-line:', fitOne.lineCount, 'lines');

    const afterRTL = correctRTLLayout(fitOne, TEXT, FONT, MAX_WIDTH, LINE_HEIGHT);
    console.log(
      '[2] after RTL:',
      afterRTL.lineCount,
      'lines',
      JSON.stringify(afterRTL.lines.map((l) => ({ text: l.text, w: l.width }))),
    );

    const afterCJK = correctCJKLayout(afterRTL, TEXT, FONT, MAX_WIDTH, LINE_HEIGHT);
    console.log(
      '[3] after CJK:',
      afterCJK.lineCount,
      'lines',
      JSON.stringify(afterCJK.lines.map((l) => ({ text: l.text, w: l.width }))),
    );

    const afterEmoji = correctEmojiLayout(afterCJK, TEXT, FONT, MAX_WIDTH, LINE_HEIGHT);
    console.log(
      '[4] after Emoji:',
      afterEmoji.lineCount,
      'lines',
      JSON.stringify(afterEmoji.lines.map((l) => ({ text: l.text, w: l.width }))),
    );

    // Smoke — the pipeline doesn't crash. Correctness is observed
    // via the console logs above; the review will discuss whether
    // the order/composition is sound.
    expect(afterEmoji.lineCount).toBeGreaterThan(0);
  });

  it('alternative ordering: Emoji → CJK → RTL (reverse)', () => {
    // Prove order matters: if corrections composed, reversing
    // should produce identical output. If they don't compose
    // (each clobbers the previous), reverse order will give a
    // different result.

    const prepared = prepareWithSegments(TEXT, FONT);
    const pretextLaid = layoutWithLines(prepared, MAX_WIDTH, LINE_HEIGHT);
    const preparedNat = prepareWithSegments(TEXT, FONT);
    const naturalLaid = layoutWithLines(preparedNat, Number.POSITIVE_INFINITY, LINE_HEIGHT);
    const naturalWidth = naturalLaid.lines[0]?.width ?? 0;
    const base = applyFitsInOneLineCorrection(
      pretextLaid,
      naturalWidth,
      MAX_WIDTH,
      LINE_HEIGHT,
    );

    const forward = correctEmojiLayout(
      correctCJKLayout(
        correctRTLLayout(base, TEXT, FONT, MAX_WIDTH, LINE_HEIGHT),
        TEXT,
        FONT,
        MAX_WIDTH,
        LINE_HEIGHT,
      ),
      TEXT,
      FONT,
      MAX_WIDTH,
      LINE_HEIGHT,
    );

    const reverse = correctRTLLayout(
      correctCJKLayout(
        correctEmojiLayout(base, TEXT, FONT, MAX_WIDTH, LINE_HEIGHT),
        TEXT,
        FONT,
        MAX_WIDTH,
        LINE_HEIGHT,
      ),
      TEXT,
      FONT,
      MAX_WIDTH,
      LINE_HEIGHT,
    );

    console.log(
      '[forward] Emoji(last) =',
      forward.lineCount,
      JSON.stringify(forward.lines.map((l) => l.text)),
    );
    console.log(
      '[reverse] RTL(last)   =',
      reverse.lineCount,
      JSON.stringify(reverse.lines.map((l) => l.text)),
    );

    // If outputs differ, the pipeline is order-dependent.
    const sameLineCount = forward.lineCount === reverse.lineCount;
    const sameText = forward.lines.map((l) => l.text).join('|') === reverse.lines.map((l) => l.text).join('|');
    console.log(
      '[P3] order-matters =',
      !(sameLineCount && sameText),
      '(lineCount same=' + sameLineCount + ', text same=' + sameText + ')',
    );
  });
});
