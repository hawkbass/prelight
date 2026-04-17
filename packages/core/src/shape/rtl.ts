/**
 * RTL layout correction layer.
 *
 * Upstream @chenglou/pretext measures text through the canvas backend
 * using whatever font the caller names in the shorthand. When that font
 * (e.g. `Inter`) has no Arabic glyphs, the canvas backend falls back to
 * an *unshaped* form of the fallback face — every Arabic character gets
 * its isolated glyph width, cursive joining is ignored, and the total
 * width is reported ~40-60% wider than a real browser renders.
 *
 * Consequence: Pretext correctly wraps Arabic at whitespace given the
 * inflated widths, but the browser renders the same string on one line
 * (or fewer wraps). Ground-truth agreement for Arabic drops to 77%.
 *
 * Fix: when the text contains RTL script, re-measure it with an
 * Arabic-capable font ("Noto Sans Arabic" is the one the corpus
 * bundles) and re-layout using a simple greedy whitespace break. That
 * matches what Chrome, WebKit, and Firefox actually do when they find a
 * proper Arabic font in their fallback chain — which our harness now
 * forces via `@font-face unicode-range`.
 *
 * The function only ever replaces Pretext's layout when:
 *   1. The text contains RTL characters, AND
 *   2. The re-laid result has *fewer or equal* lines than Pretext, AND
 *   3. The canvas shim is actually available (Node/Bun with
 *      @napi-rs/canvas registered; otherwise we fall through to Pretext).
 *
 * PRELIGHT-INVARIANT: never increase line count. Worst case the
 * correction is a no-op.
 * PRELIGHT-NEXT(v1.0): replace with a proper upstream Pretext fix that
 * registers fallback fonts per unicode range.
 */

export interface LineLike {
  text: string;
  width: number;
}

export interface LayoutLike {
  lineCount: number;
  height: number;
  lines: LineLike[];
}

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
 * Does the text contain any character from a right-to-left script block?
 */
export function containsRTL(text: string): boolean {
  // Hebrew, Arabic, Syriac, Thaana, N'Ko, Arabic Extended-A, Arabic
  // Presentation Forms-A and -B.
  return /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Swap the font family in a CSS font shorthand to `newFamily`. Leaves
 * size, weight, style, and line-height tokens alone — everything after
 * the pixel-size token is replaced.
 */
function withFamily(font: string, newFamily: string): string {
  // Match the pixel size token (e.g. `14px`, `16px/1.4`) and keep
  // everything up to and including it. The family list follows.
  const match = /^(.*?\d*\.?\d+px(?:\/[^\s]+)?)\s+/.exec(font);
  if (!match) return font;
  return `${match[1]} ${newFamily}`;
}

/**
 * Greedy whitespace-based line break with canvas-measured widths. A
 * token is either a whitespace run or a non-whitespace run. We fit as
 * many tokens on each line as stay within `maxWidth` (tolerating half
 * a pixel of sub-pixel rounding). A token that on its own exceeds
 * `maxWidth` is placed on its own line and allowed to overflow — this
 * matches what every modern browser does for unbreakable content.
 */
function greedyBreakRTL(
  text: string,
  font: string,
  maxWidth: number,
  ctx: CanvasCtx,
): LineLike[] {
  const trimmed = text;
  const tokens = trimmed.split(/(\s+)/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [{ text: '', width: 0 }];

  ctx.font = font;
  const lines: LineLike[] = [];
  let current = '';
  for (const tok of tokens) {
    const isSpace = /^\s+$/.test(tok);
    const candidate = current + tok;
    const candidateWidth = ctx.measureText(candidate).width;
    if (current.length === 0 || candidateWidth <= maxWidth + 0.5) {
      current = candidate;
    } else {
      // Break: emit the current line (trimmed of trailing whitespace)
      const finalized = current.replace(/\s+$/u, '');
      lines.push({
        text: finalized,
        width: ctx.measureText(finalized).width,
      });
      // If the token that broke is whitespace, swallow it; otherwise
      // it starts the next line.
      if (isSpace) {
        current = '';
      } else {
        current = tok;
      }
    }
  }
  if (current.length > 0) {
    const finalized = current.replace(/\s+$/u, '');
    lines.push({
      text: finalized,
      width: ctx.measureText(finalized).width,
    });
  }
  return lines.length > 0 ? lines : [{ text: trimmed, width: ctx.measureText(trimmed).width }];
}

/**
 * Apply the RTL correction to a Pretext layout result.
 *
 * - Returns the input unchanged when the text has no RTL characters.
 * - Returns the input unchanged when the canvas shim isn't installed.
 * - Returns the input unchanged when the corrected layout would have
 *   *more* lines than Pretext's (monotonicity guarantee).
 *
 * Otherwise, returns a layout computed by greedy whitespace breaking
 * using `Noto Sans Arabic` as the measurement family — the same font
 * the harness now @font-face's into the "Inter" family's Arabic range.
 */
export function correctRTLLayout(
  pretextResult: LayoutLike,
  originalText: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): LayoutLike {
  if (!containsRTL(originalText)) return pretextResult;
  if (pretextResult.lineCount < 1) return pretextResult;

  const Canvas = getCanvas();
  if (!Canvas) return pretextResult;
  const ctx = new Canvas(1, 1).getContext('2d');
  const arabicFont = withFamily(font, 'Noto Sans Arabic');

  // Quick check: does the whole string fit on one line in Noto Sans Arabic?
  ctx.font = arabicFont;
  const fullWidth = ctx.measureText(originalText).width;
  if (fullWidth <= maxWidth + 0.5) {
    return {
      lineCount: 1,
      height: lineHeight,
      lines: [{ text: originalText, width: fullWidth }],
    };
  }

  const lines = greedyBreakRTL(originalText, arabicFont, maxWidth, ctx);
  // Monotonicity: never make Pretext's prediction worse.
  if (lines.length > pretextResult.lineCount) return pretextResult;
  return {
    lineCount: lines.length,
    height: lines.length * lineHeight,
    lines,
  };
}

/**
 * Back-compat alias. The Phase-E "fits in one line" correction is now
 * one branch of the RTL-aware correction. Callers that only need the
 * simple check (e.g., non-RTL languages where Pretext overshoots by
 * one line) can still use this entry point.
 */
export function applyFitsInOneLineCorrection(
  result: LayoutLike,
  naturalWidth: number,
  maxWidth: number,
  lineHeight: number,
): LayoutLike {
  if (result.lineCount < 2) return result;
  if (naturalWidth > maxWidth + 0.5) return result;
  const firstLine = result.lines[0] ?? { text: '', width: naturalWidth };
  return {
    lineCount: 1,
    height: lineHeight,
    lines: [{ text: firstLine.text, width: naturalWidth }],
  };
}
