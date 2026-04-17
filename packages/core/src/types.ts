/**
 * Public type surface for @prelight/core.
 *
 * These types are the API boundary between Prelight and its consumers. Every
 * adapter (React, Vitest, Jest, CLI) speaks in terms of `VerifySpec` and
 * `VerifyResult`. Keep this file small, stable, and ruthless about breaking
 * changes.
 *
 * PRELIGHT-INVARIANT: a consumer that imports from `@prelight/core` only via
 * this file's exports should never need to know anything about Pretext,
 * canvas metrics, or the predicate implementation internals.
 */

/**
 * A language-keyed text map. Keys are BCP-47 language tags; values are the
 * strings to verify. English ('en') is the conventional default key but is
 * not required — a spec with only German strings is valid.
 */
export type LocalizedText = Record<string, string>;

/**
 * A single user font scale multiplier. 1.0 is the default, 1.25 and 1.5 are
 * common accessibility settings, 2.0 is the upper bound we recommend testing.
 */
export type FontScale = number;

/**
 * Predicate set exposed to users. Each field is independently optional.
 *
 * PRELIGHT-NEXT(v1.0): add `fitsGrid` once the grid engine lands in
 * Presize. Additive only — existing predicate semantics are frozen.
 * (fitsFlex / fitsBlock / fitsAspect shipped in v0.2; see
 * packages/core/src/layout/*.ts.)
 */
export interface Constraints {
  /** Exact line count. Mutually exclusive with maxLines/minLines. */
  lines?: number;
  /** Maximum allowed line count (inclusive). */
  maxLines?: number;
  /** Minimum required line count (inclusive). */
  minLines?: number;
  /** Fail if measured width exceeds the spec's maxWidth. */
  noOverflow?: boolean;
  /** Shorthand for `maxLines: 1` plus `noOverflow: true`. */
  singleLine?: boolean;
  /** Fail if the measured text would be truncated (ellipsized). */
  noTruncation?: boolean;
}

/**
 * Per-spec font family overrides for the script-specific measurement passes
 * that run on top of Pretext's primary layout (CJK today; emoji in H6b).
 *
 * The first family whose canvas measurement of a probe glyph differs from
 * the spec's `font` by more than 0.5px is selected for the correction pass.
 * A consumer that knows it ships a CJK-capable face under a specific family
 * name sets that name here; consumers with no CJK face on hand can leave
 * this undefined and Prelight falls back to the module-level global
 * (`setCJKMeasurementFamilies`) and ultimately to the spec's own `font`.
 *
 * Passing `cjk: []` or `emoji: []` explicitly opts out of the relevant
 * family probe for this spec — the correction pass then skips (emoji) or
 * uses the spec's `font` directly (CJK).
 */
export interface MeasurementFontFamilies {
  /** Ordered preference list of CJK-capable font families to probe. */
  cjk?: string[];
  /**
   * Ordered preference list of emoji-capable font families to probe.
   * The first family in the list whose canvas measurement of the probe
   * glyph (`🙂`, U+1F642) differs from the spec's `font` by more than
   * 0.5px is selected for the emoji correction pass. When omitted, the
   * module-level global (`setEmojiMeasurementFamilies`) is consulted;
   * when that list is empty or no family is registered with the canvas
   * backend, the emoji correction is a no-op and Pretext's original
   * layout is returned unchanged.
   */
  emoji?: string[];
}

/**
 * Input to the verifier. Everything needed to answer "does this text fit?"
 * at the full matrix of (language, fontScale).
 *
 * PRELIGHT-FLAG: `font` is a CSS shorthand string today. If we need richer
 * font control (weight axes, variable font features) we'll accept a
 * structured FontDescriptor. Breaking change, track in DECISIONS.
 */
export interface VerifySpec {
  text: LocalizedText | string;
  font: string;
  maxWidth: number;
  lineHeight: number;
  constraints: Constraints;
  /** Defaults to [1.0]. Pass multiple to sweep scale. */
  fontScales?: FontScale[];
  /** Whitelist of language keys from `text` to verify. Defaults to all. */
  languages?: string[];
  /**
   * Per-spec override of the family lists used for script-specific
   * measurement passes (CJK, emoji). Undefined falls back to the
   * module-level global; a non-empty list takes precedence over the
   * global; an empty list (`cjk: []` / `emoji: []`) opts out of the
   * relevant probe entirely.
   */
  measurementFonts?: MeasurementFontFamilies;
}

/**
 * A single cell in the verification matrix.
 */
export interface MatrixCell {
  language: string;
  scale: FontScale;
  width: number;
}

/**
 * A measurement produced by the core for one matrix cell. Framework-agnostic
 * — Pretext produces it, predicates consume it.
 */
export interface Measurement {
  cell: MatrixCell;
  /** Number of lines the text wraps to at the cell's maxWidth. */
  lines: number;
  /** Max line width AFTER wrapping (<= maxWidth for wrapped text). */
  measuredWidth: number;
  /** Total laid-out height in pixels. */
  measuredHeight: number;
  /**
   * Width of the unwrapped (single-line) text — what the text would occupy
   * if `white-space: nowrap` were applied. Used to explain overflow deltas.
   */
  naturalWidth: number;
  /** True when natural width would exceed the cell's maxWidth. */
  overflows: boolean;
  /** If the renderer would ellipsize, what's the trimmed text? */
  truncatedTo?: string;
}

/**
 * A single predicate failure. Reports which constraint was violated, on
 * which matrix cell, with a human-readable message and structured context.
 */
export interface Failure {
  cell: MatrixCell;
  constraint: keyof Constraints;
  message: string;
  actual: unknown;
  expected: unknown;
}

/**
 * Return value of `verify()`. Callers should always branch on `ok` — the
 * `failures` array is only meaningful when `ok` is `false`.
 */
export type VerifyResult =
  | { ok: true; cellsChecked: number }
  | { ok: false; cellsChecked: number; failures: Failure[] };
