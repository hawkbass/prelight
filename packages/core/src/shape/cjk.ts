/**
 * CJK layout correction layer.
 *
 * Problem: `@chenglou/pretext` treats CJK text with the same
 * word-segmented wrapper it uses for Latin. It wraps at whitespace,
 * and because CJK strings usually have none, it tends to keep far too
 * much text on a single line. Real browsers wrap CJK per-character
 * (with kinsoku restrictions) — that's what `line-break: normal`
 * specifies. Consequence: Pretext under-reports line count for ja/zh
 * by 1-3 lines on strings that contain no whitespace.
 *
 * Fix: when the text contains CJK characters, re-layout by greedy
 * character-level wrapping using the same font Pretext used. Apply
 * minimum kinsoku rules — don't allow the opening set of characters
 * (`「『（[{`) to end a line, and don't allow the closing /
 * punctuation set (`」』）]}、。・！？…ー`) to start one. These are
 * the line-break taboos all three engines enforce by default.
 *
 * PRELIGHT-INVARIANT: never decrease line count below what Pretext
 * produced. Pretext is already conservative (tends to under-wrap CJK),
 * so the correction only ever *increases* lines back toward the
 * browser number.
 * PRELIGHT-NEXT(v1.0): expose kinsoku policy (`strict` / `normal` /
 * `loose`) once the CSS `line-break` value is part of VerifySpec.
 */

import type { LayoutLike, LineLike } from './rtl.js';

interface CanvasCtx {
  font: string;
  measureText(text: string): { width: number };
}

interface OffscreenCanvasLike {
  getContext(type: string): CanvasCtx;
}

type OffscreenCanvasCtor = new (w: number, h: number) => OffscreenCanvasLike;

function getCanvas(): OffscreenCanvasCtor | null {
  const g = globalThis as unknown as { OffscreenCanvas?: OffscreenCanvasCtor };
  return typeof g.OffscreenCanvas === 'function' ? g.OffscreenCanvas : null;
}

/**
 * Does the text contain any CJK character likely to be wrapped
 * per-character by a browser? Covers Hiragana, Katakana, CJK Unified
 * Ideographs (inc. Extension A), fullwidth forms, and Hangul (Korean
 * has similar break behaviour).
 */
export function containsCJK(text: string): boolean {
  return /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(text);
}

// Kinsoku (line-break taboo) sets.
// 行頭禁則 — characters that cannot *start* a line.
const NO_LINE_START = new Set(
  '、。，．・：；！？）］｝」』〉》〕〗〙〛"\')]}、。,.!?:;%°℃々ゝゞ゛゜ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…——ー',
);
// 行末禁則 — characters that cannot *end* a line.
const NO_LINE_END = new Set('（［｛「『〈《〔〖〘〚"\'([{$@＠￥£€');

/**
 * Is this character a CJK break candidate? We allow breaks before any
 * such character provided kinsoku doesn't forbid it. Latin runs
 * embedded in CJK text (e.g., "作業 OK") keep their whitespace-only
 * breaks.
 */
function isCJKChar(ch: string): boolean {
  return /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(ch);
}

/**
 * Split text into "grapheme-ish" segments that we can break around.
 * For CJK we treat every CJK character as its own break candidate;
 * for non-CJK runs we keep whitespace semantics (runs of non-space
 * non-CJK glyphs stay together). This is still approximate — proper
 * grapheme clustering would need ICU — but it matches browser
 * behaviour well enough for the corpus.
 */
function segmentForCJKBreak(text: string): string[] {
  const out: string[] = [];
  let buffer = '';
  for (const ch of text) {
    if (isCJKChar(ch) || /\s/.test(ch)) {
      if (buffer) {
        out.push(buffer);
        buffer = '';
      }
      out.push(ch);
    } else {
      buffer += ch;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

/**
 * Preferred font-family list for measuring CJK character widths. We
 * override this at ground-truth time to force the harness's bundled
 * Noto Sans JP / SC files; library consumers may want to set it to
 * whatever CJK face their own app ships. The first family in this
 * list whose canvas measurement differs from the input font's (by >
 * 0.5px on a representative CJK glyph) will be used.
 *
 * PRELIGHT-NEXT(v0.3): surface this as an explicit `measurementFonts`
 * option on `VerifySpec` so it's part of the contract rather than a
 * side door. Deferred from v0.2 — the setter/getter pair above is
 * enough surface for v0.2 consumers (ground-truth uses it today).
 */
let CJK_MEASUREMENT_FAMILIES: string[] = ['Noto Sans JP', 'Noto Sans CJK JP', 'Noto Sans SC'];

export function setCJKMeasurementFamilies(families: string[]): void {
  CJK_MEASUREMENT_FAMILIES = families.slice();
}
export function getCJKMeasurementFamilies(): readonly string[] {
  return CJK_MEASUREMENT_FAMILIES;
}

function withFamily(font: string, newFamily: string): string {
  const match = /^(.*?\d*\.?\d+px(?:\/[^\s]+)?)\s+/.exec(font);
  if (!match) return font;
  return `${match[1]} ${newFamily}`;
}

/**
 * Pick the first registered CJK family whose measurement of a probe
 * glyph differs meaningfully from the input font's. This is how we
 * detect whether a CJK-capable face was actually registered with the
 * canvas backend. Returns `null` if none are.
 */
function pickCJKFamily(ctx: CanvasCtx, font: string, probe: string): string | null {
  ctx.font = font;
  const baseline = ctx.measureText(probe).width;
  for (const family of CJK_MEASUREMENT_FAMILIES) {
    const candidate = withFamily(font, family);
    ctx.font = candidate;
    const w = ctx.measureText(probe).width;
    if (Math.abs(w - baseline) > 0.5) return candidate;
  }
  return null;
}

/**
 * Apply a CJK correction to a Pretext layout result.
 *
 * - Returns the input unchanged when the text has no CJK characters.
 * - Returns the input unchanged when the canvas shim isn't installed.
 * - Returns the input unchanged when the corrected layout would have
 *   *fewer* lines than Pretext's (monotonicity guarantee: Pretext's
 *   conservative count is always at least the correct number for
 *   this language direction).
 */
export function correctCJKLayout(
  pretextResult: LayoutLike,
  originalText: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): LayoutLike {
  if (!containsCJK(originalText)) return pretextResult;
  const Canvas = getCanvas();
  if (!Canvas) return pretextResult;
  const ctx = new Canvas(1, 1).getContext('2d');

  // Pick the best CJK-capable family the caller has registered. If
  // none is registered, we use the original font — measurements will
  // agree with whatever canvas is doing internally, which is the best
  // we can offer without a registered face.
  const firstCJK = Array.from(originalText).find((ch) => isCJKChar(ch)) ?? '字';
  const measurementFont = pickCJKFamily(ctx, font, firstCJK) ?? font;
  ctx.font = measurementFont;

  const segments = segmentForCJKBreak(originalText);
  if (segments.length === 0) return pretextResult;

  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? '';
    if (seg.length === 0) continue;
    const isSpace = /^\s+$/.test(seg);
    // Candidate line after appending this segment.
    const candidate = current + seg;
    const candidateWidth = ctx.measureText(candidate).width;

    // Decide whether we can break AT this point (i.e. keep segment
    // on a new line instead of appending). Kinsoku:
    //   * a line can't start with NO_LINE_START → keep seg on current
    //   * a line can't end with NO_LINE_END → push NO_LINE_END to next
    const segFirst = seg.charAt(0);
    const currentLast = current.charAt(current.length - 1);
    const breakForbidden =
      NO_LINE_START.has(segFirst) || NO_LINE_END.has(currentLast);

    if (current.length === 0) {
      current = seg;
      continue;
    }
    if (candidateWidth <= maxWidth + 0.5 || breakForbidden) {
      current = candidate;
      continue;
    }
    // Break: emit current line, start new line with seg.
    lines.push(current.replace(/\s+$/u, ''));
    current = isSpace ? '' : seg;
  }
  if (current.length > 0) lines.push(current.replace(/\s+$/u, ''));

  // Build the Line objects with canvas-measured widths.
  ctx.font = measurementFont;
  const laid: LineLike[] = lines.map((text) => ({
    text,
    width: ctx.measureText(text).width,
  }));

  // Monotonicity: never return *fewer* lines than Pretext had — its
  // under-wrap is the failure mode we're correcting, so the answer is
  // always ≥ its count. If our correction somehow produced fewer,
  // that's a bug in our measurement; defer to Pretext.
  if (laid.length < pretextResult.lineCount) return pretextResult;
  return {
    lineCount: laid.length,
    height: laid.length * lineHeight,
    lines: laid,
  };
}
