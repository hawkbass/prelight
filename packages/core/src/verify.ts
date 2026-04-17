/**
 * The verifier entry point. Sweep the (language x scale) matrix; for each
 * cell, measure with Pretext and dispatch through the predicate set.
 *
 * PRELIGHT-INVARIANT: `verify()` is a pure function of its input and the
 * bundled font state. No I/O, no DOM reads, no FS access. The caller's CI
 * minute budget is knowable a priori.
 */

import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

import { assertCanvasReady, scaleFont } from './font.js';
import { PREDICATES } from './predicates.js';
import { correctCJKLayout } from './shape/cjk.js';
import { applyFitsInOneLineCorrection, correctRTLLayout } from './shape/rtl.js';
import type {
  Failure,
  MatrixCell,
  Measurement,
  VerifyResult,
  VerifySpec,
} from './types.js';

function normalizeText(text: VerifySpec['text']): Record<string, string> {
  if (typeof text === 'string') return { default: text };
  return text;
}

function defaultLanguages(texts: Record<string, string>, allow?: string[]): string[] {
  const keys = Object.keys(texts);
  if (!allow || allow.length === 0) return keys;
  return keys.filter((k) => allow.includes(k));
}

function enabledPredicates(spec: VerifySpec): Array<keyof typeof PREDICATES> {
  const c = spec.constraints;
  const out: Array<keyof typeof PREDICATES> = [];
  if (c.noOverflow) out.push('noOverflow');
  if (c.singleLine) out.push('singleLine');
  if (c.noTruncation) out.push('noTruncation');
  if (c.maxLines !== undefined) out.push('maxLines');
  if (c.minLines !== undefined) out.push('minLines');
  if (c.lines !== undefined) out.push('lines');
  return out;
}

/**
 * Synchronous hot path. Consumers should call {@link ensureCanvasEnv} once
 * at bootstrap (the Vitest/Jest matchers do this automatically) before
 * invoking `verify`. If the canvas environment is not ready, this throws
 * with a message explaining how to fix it.
 */
export function verify(spec: VerifySpec): VerifyResult {
  assertCanvasReady();
  const texts = normalizeText(spec.text);
  const languages = defaultLanguages(texts, spec.languages);
  const scales = spec.fontScales && spec.fontScales.length > 0 ? spec.fontScales : [1];
  const predicates = enabledPredicates(spec);
  const failures: Failure[] = [];
  let cellsChecked = 0;

  for (const language of languages) {
    const raw = texts[language];
    if (raw === undefined) continue;
    for (const scale of scales) {
      const cell: MatrixCell = { language, scale, width: spec.maxWidth };
      const scaledFont = scaleFont(spec.font, scale);
      const scaledLineHeight = spec.lineHeight * scale;

      const prepared = prepareWithSegments(raw, scaledFont);
      const laid = layoutWithLines(prepared, spec.maxWidth, scaledLineHeight);
      const preparedNatural = prepareWithSegments(raw, scaledFont);
      const natural = layoutWithLines(preparedNatural, Number.POSITIVE_INFINITY, scaledLineHeight);
      const naturalWidth = natural.lines[0]?.width ?? 0;

      const fitOneLine = applyFitsInOneLineCorrection(
        laid,
        naturalWidth,
        spec.maxWidth,
        scaledLineHeight,
      );
      const rtlCorrected = correctRTLLayout(
        fitOneLine,
        raw,
        scaledFont,
        spec.maxWidth,
        scaledLineHeight,
      );
      const corrected = correctCJKLayout(
        rtlCorrected,
        raw,
        scaledFont,
        spec.maxWidth,
        scaledLineHeight,
        spec.measurementFonts?.cjk,
      );

      const measuredWidth = corrected.lines.reduce(
        (acc, line) => (line.width > acc ? line.width : acc),
        0,
      );

      const measurement: Measurement = {
        cell,
        lines: corrected.lineCount,
        measuredWidth,
        measuredHeight: corrected.height,
        naturalWidth,
        overflows: naturalWidth > spec.maxWidth + 0.5,
      };

      cellsChecked++;
      for (const key of predicates) {
        const fail = PREDICATES[key](measurement, spec.constraints);
        if (fail) failures.push(fail);
      }
    }
  }

  if (failures.length === 0) {
    return { ok: true, cellsChecked };
  }
  return { ok: false, cellsChecked, failures };
}
