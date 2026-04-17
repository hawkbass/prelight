/**
 * Emoji layout correction layer.
 *
 * Problem: `@chenglou/pretext` measures every run through the canvas
 * backend with the shorthand's primary face (`Inter` in our corpus). Our
 * Node/Bun backend (`@napi-rs/canvas`) ships no emoji-capable fallback,
 * so emoji codepoints all resolve to Inter's `.notdef` glyph width —
 * roughly `fontSize / 2`. A real browser renders them through a proper
 * emoji face (`Segoe UI Emoji`, `Apple Color Emoji`, `Noto Color Emoji`)
 * at ~1em. Consequence: Pretext under-reports width for emoji-bearing
 * text and under-wraps. Empirically, 33/41 of the v0.3 H6a-baseline
 * emoji disagreements on Chromium are this under-wrap mode
 * (see FINDINGS.md §F7 and scripts/analyze-emoji-disagreements.ts).
 *
 * Fix: when the text contains emoji AND the caller has registered an
 * emoji-capable family (via `VerifySpec.measurementFonts.emoji` per
 * spec, or `setEmojiMeasurementFamilies` module-wide), re-measure each
 * grapheme cluster with that family and greedily re-pack the lines at
 * whitespace-first boundaries, falling back to a per-grapheme break
 * inside a long unbreakable emoji run. If no emoji family is
 * registered, this pass is a no-op — the caller has opted out.
 *
 * Unlike `correctCJKLayout`, this pass does NOT enforce a
 * monotonicity floor. Emoji disagreements empirically split
 * bidirectionally — 33 under-wrap and 8 over-wrap on the v0.3 H6a
 * baseline — so both "more lines" and "fewer lines" are valid
 * directions for the correction to move.
 *
 * Contract (v0.3 H6b, mirrors H6a):
 *
 *   per-call argument  >  module-level global  >  no-op
 *
 * PRELIGHT-INVARIANT: `correctEmojiLayout` only runs when the caller
 * has a concrete emoji-capable face registered with the canvas
 * backend. With no face registered the probe returns `null` and
 * Pretext's original output is returned unchanged — there is no point
 * re-measuring against the same `.notdef` widths.
 * PRELIGHT-NEXT(v0.4): ship a bundled emoji subset so consumers no
 * longer need to register their own, and register it in the ground-
 * truth harness to move the reported agreement number. Tracked in
 * ROADMAP under "emoji harness font".
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
 * Codepoint blocks that can signal an emoji presence. Matches the same
 * set Pretext's `maybeEmojiRe` matches (see its `measurement.ts`), so
 * our detector and Pretext's stay in lockstep.
 *
 * We use Unicode property escapes here rather than block ranges because
 * the relevant glyphs are scattered across SMP blocks and the Emoji_*
 * properties are the only forward-stable way to reference them.
 */
const EMOJI_DETECTOR =
  /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;

/**
 * Does the text contain any character that would be rendered via an
 * emoji face in a standard browser fallback chain?
 */
export function containsEmoji(text: string): boolean {
  return EMOJI_DETECTOR.test(text);
}

/**
 * Preferred font-family list for measuring emoji grapheme widths when
 * the caller has not supplied a per-spec override. The first family in
 * this list whose canvas measurement of the probe glyph differs from
 * the spec's font (by > 0.5px) is selected.
 *
 * Defaults to the three emoji faces shipped by the major desktop OSes:
 * macOS (`Apple Color Emoji`), Windows (`Segoe UI Emoji`), Linux /
 * Android (`Noto Color Emoji`). On a system where none of these is
 * registered with the canvas backend, the probe returns `null` and the
 * correction is a no-op.
 *
 * Contract mirrors `CJK_MEASUREMENT_FAMILIES` exactly:
 *
 *   per-call argument  >  module-level global  >  no-op
 *
 * Per-call override lives on `VerifySpec.measurementFonts.emoji` and is
 * threaded through `verify()` → `correctEmojiLayout(..., override)`.
 *   - `undefined` caller arg → fall through to the global below.
 *   - Non-empty array → takes precedence over the global.
 *   - Empty array (`[]`)  → opts out of the emoji family probe; no
 *     emoji correction runs for this spec.
 */
let EMOJI_MEASUREMENT_FAMILIES: string[] = [
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Noto Color Emoji',
];

export function setEmojiMeasurementFamilies(families: string[]): void {
  EMOJI_MEASUREMENT_FAMILIES = families.slice();
}
export function getEmojiMeasurementFamilies(): readonly string[] {
  return EMOJI_MEASUREMENT_FAMILIES;
}

/**
 * Resolve which family list to consult for the emoji probe, given the
 * (optional) per-call override. Undefined falls through to the global;
 * an empty array is preserved (explicit opt-out signal).
 */
function resolveEmojiFamilies(
  override: readonly string[] | undefined,
): readonly string[] {
  if (override === undefined) return EMOJI_MEASUREMENT_FAMILIES;
  return override;
}

function withFamily(font: string, newFamily: string): string {
  const match = /^(.*?\d*\.?\d+px(?:\/[^\s]+)?)\s+/.exec(font);
  if (!match) return font;
  return `${match[1]} ${newFamily}`;
}

/**
 * Pick the first registered emoji family whose canvas measurement of
 * the probe glyph differs meaningfully from the input font's. The
 * probe glyph is `'🙂'` (U+1F642, SLIGHTLY SMILING FACE): a single
 * codepoint that every shipped emoji face we care about supports and
 * whose rendered width differs from Inter's `.notdef` by at least half
 * the em. Returns `null` if no registered family matches — in that
 * case the correction pass is a no-op.
 */
function pickEmojiFamily(
  ctx: CanvasCtx,
  font: string,
  families: readonly string[],
): string | null {
  if (families.length === 0) return null;
  ctx.font = font;
  const baseline = ctx.measureText('\u{1F642}').width;
  for (const family of families) {
    const candidate = withFamily(font, family);
    ctx.font = candidate;
    const w = ctx.measureText('\u{1F642}').width;
    if (Math.abs(w - baseline) > 0.5) return candidate;
  }
  return null;
}

/**
 * Split text into extended grapheme clusters using `Intl.Segmenter`.
 * This gives us the same units the browser ligates when it measures
 * emoji: flag pairs collapse to one cluster, skin-tone modifiers stick
 * to their base emoji, ZWJ sequences form a single cluster.
 *
 * Falls back to a naïve split-by-codepoint when `Intl.Segmenter` is
 * unavailable (very old engines). That degrades cleanly: per-codepoint
 * widths are already what Pretext uses internally, so the correction
 * becomes a re-measurement with the emoji font but without grapheme
 * ligation. Better than nothing.
 */
function segmentByGrapheme(text: string): string[] {
  const SegmenterCtor = (globalThis as unknown as {
    Intl?: { Segmenter?: new (l?: string, o?: { granularity: string }) => {
      segment(s: string): Iterable<{ segment: string }>;
    } };
  }).Intl?.Segmenter;
  if (typeof SegmenterCtor === 'function') {
    const seg = new SegmenterCtor(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (g) => g.segment);
  }
  return Array.from(text);
}

/**
 * Greedily pack pre-measured grapheme widths into lines, preferring
 * whitespace breaks but allowing a per-grapheme break when a run of
 * non-whitespace clusters would exceed `maxWidth`. Matches browser
 * `overflow-wrap: anywhere` fallback behaviour for unbreakable emoji
 * runs.
 */
function packGraphemes(
  graphemes: string[],
  widths: number[],
  maxWidth: number,
): LineLike[] {
  if (graphemes.length === 0) return [];
  const lines: LineLike[] = [];
  let curText = '';
  let curWidth = 0;
  let lastBreakIndex = -1;
  let curWidthAtBreak = 0;

  for (let i = 0; i < graphemes.length; i++) {
    const g = graphemes[i]!;
    const w = widths[i]!;
    const isSpace = /^\s+$/u.test(g);

    if (curWidth + w <= maxWidth + 0.5) {
      curText += g;
      curWidth += w;
      if (isSpace) {
        lastBreakIndex = curText.length;
        curWidthAtBreak = curWidth;
      }
      continue;
    }

    if (lastBreakIndex >= 0) {
      // Break at the last whitespace. Strip trailing spaces from the
      // emitted line (browsers discard them when computing rendered
      // width), then start the next line with whatever followed that
      // whitespace, plus this grapheme.
      const emit = curText.slice(0, lastBreakIndex).replace(/\s+$/u, '');
      lines.push({ text: emit, width: curWidthAtBreak });
      const tail = curText.slice(lastBreakIndex);
      const tailWidth = curWidth - curWidthAtBreak;
      curText = tail + g;
      curWidth = tailWidth + w;
      lastBreakIndex = -1;
      curWidthAtBreak = 0;
      continue;
    }

    // No whitespace to break at — hard-break on this grapheme
    // boundary. Emit the current line as-is.
    if (curText.length > 0) {
      lines.push({ text: curText, width: curWidth });
    }
    curText = g;
    curWidth = w;
    lastBreakIndex = -1;
    curWidthAtBreak = 0;
  }

  if (curText.length > 0) {
    const emit = curText.replace(/\s+$/u, '');
    // `curWidth` is the width including any trailing whitespace we
    // just stripped; rewriting it for correctness is optional since
    // we don't expose per-line trailing-space metrics.
    lines.push({ text: emit, width: curWidth });
  }
  return lines;
}

/**
 * Apply an emoji correction to a Pretext layout result.
 *
 * - Returns the input unchanged when the text has no emoji codepoints.
 * - Returns the input unchanged when the canvas shim isn't installed.
 * - Returns the input unchanged when no emoji family in the resolved
 *   list is registered with the canvas backend (the probe returns
 *   `null`).
 * - Returns the input unchanged when `measurementFamilies === []`
 *   (explicit opt-out).
 *
 * Otherwise, re-measures the text as a stream of grapheme clusters
 * against the chosen emoji-capable face, greedily packs them back into
 * lines, and returns a fresh layout.
 *
 * No monotonicity floor: emoji disagreements observed in the
 * 2026-04-17 ground-truth baseline split both ways (33 under-wrap,
 * 8 over-wrap), so clamping the correction in either direction would
 * leave half the population uncorrected.
 */
export function correctEmojiLayout(
  pretextResult: LayoutLike,
  originalText: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
  measurementFamilies?: readonly string[],
): LayoutLike {
  if (!containsEmoji(originalText)) return pretextResult;
  const Canvas = getCanvas();
  if (!Canvas) return pretextResult;
  const ctx = new Canvas(1, 1).getContext('2d');

  const families = resolveEmojiFamilies(measurementFamilies);
  const measurementFont = pickEmojiFamily(ctx, font, families);
  if (measurementFont === null) return pretextResult;

  ctx.font = measurementFont;
  const graphemes = segmentByGrapheme(originalText);
  if (graphemes.length === 0) return pretextResult;
  const widths = graphemes.map((g) => ctx.measureText(g).width);

  const laid = packGraphemes(graphemes, widths, maxWidth);
  if (laid.length === 0) return pretextResult;

  return {
    lineCount: laid.length,
    height: laid.length * lineHeight,
    lines: laid,
  };
}
