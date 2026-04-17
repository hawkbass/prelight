/**
 * Box model primitives.
 *
 * This file introduces `Box` and `EdgeInsets` — pure data types
 * describing a CSS box with content + padding + border + margin.
 * No layout logic lives here; the flex and block engines (G3, G4)
 * consume these primitives.
 *
 * Semantics mirror CSS's `box-sizing: content-box`, which is the
 * stable reference model the spec defines every other box-sizing
 * value against. For `border-box` consumers we expose a
 * `boxFromBorderBox()` builder that reverses the arithmetic.
 *
 * v0.3 (H3.2) adds percentage-based insets via `ResolvableInset`,
 * `pct()`, and `resolveInsets()`. Percentages follow the CSS rule
 * that *all* percentage padding/margin — top, right, bottom, left —
 * resolves against the **containing block's width**, not against
 * the box's own height on the vertical axis. This is a known CSS
 * quirk but preserving it is the whole point: Prelight is a layout
 * verifier, not a new layout spec.
 *
 * PRELIGHT-INVARIANT: every function in this file is pure. No I/O,
 * no DOM, no canvas calls. Given the same inputs it returns the
 * same output. Arithmetic rounding follows IEEE-754 double — no
 * deliberate truncation.
 *
 * PRELIGHT-NEXT(v0.4): `calc()` expressions mixing px + %. v0.3
 * accepts `"10px"` or `"10%"` but not `"calc(10% + 4px)"`; support
 * needs a tiny AST and containing-block-aware resolution.
 */

import type { Measurement } from '../types.js';

/**
 * Per-edge CSS inset (padding, border, margin). Values are always
 * px. A missing edge defaults to 0 when constructed via
 * `edgeInsets()`.
 */
export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Unresolved percent inset (H3.2). Produced by `pct(n)` or by
 * `parseEdgeInsets()` before resolution; consumed by
 * `resolveInsets()`. Kept as a discriminated tag rather than a
 * bare number so TypeScript prevents accidentally mixing px and %
 * values in the same position.
 */
export interface PercentInset {
  percent: number;
}

/** A single inset value: either px (number) or a percent tag. */
export type ResolvableInset = number | PercentInset;

/** Per-edge resolvable spec — the input to `resolveInsets()`. */
export interface ResolvableEdgeInsets {
  top?: ResolvableInset;
  right?: ResolvableInset;
  bottom?: ResolvableInset;
  left?: ResolvableInset;
}

/**
 * Tag a number as a percent inset. `pct(10)` means "10% of the
 * containing block's width" (CSS semantics — the same rule
 * applies to vertical edges).
 */
export function pct(percent: number): PercentInset {
  return { percent };
}

function isPercent(value: ResolvableInset): value is PercentInset {
  return typeof value === 'object' && value !== null && 'percent' in value;
}

function resolveOne(value: ResolvableInset | undefined, containingBlockWidth: number): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  return (value.percent / 100) * containingBlockWidth;
}

/**
 * Resolve a `ResolvableEdgeInsets` against a containing-block
 * width, returning concrete px-only `EdgeInsets`. Missing edges
 * default to 0. Per CSS, all four edges (including top/bottom)
 * resolve percentages against **width**, not height.
 */
export function resolveInsets(
  spec: ResolvableEdgeInsets,
  containingBlockWidth: number,
): EdgeInsets {
  if (!Number.isFinite(containingBlockWidth) || containingBlockWidth < 0) {
    throw new Error(
      `resolveInsets: containingBlockWidth must be a non-negative finite number, got ${containingBlockWidth}`,
    );
  }
  return {
    top: resolveOne(spec.top, containingBlockWidth),
    right: resolveOne(spec.right, containingBlockWidth),
    bottom: resolveOne(spec.bottom, containingBlockWidth),
    left: resolveOne(spec.left, containingBlockWidth),
  };
}

export interface BoxSpec {
  /** The inner content's text measurement. */
  content: Measurement;
  padding?: EdgeInsets;
  border?: EdgeInsets;
  margin?: EdgeInsets;
}

/**
 * Computed box geometry. Pure data — no getters, no methods — so
 * this serialises cleanly and stays tree-shakable.
 */
export interface Box {
  content: Measurement;
  padding: EdgeInsets;
  border: EdgeInsets;
  margin: EdgeInsets;
  /** content.measuredWidth + padding horizontal. */
  paddingBoxWidth: number;
  /** content.measuredHeight + padding vertical. */
  paddingBoxHeight: number;
  /** paddingBox + border horizontal. The visible width in the DOM. */
  borderBoxWidth: number;
  /** paddingBox + border vertical. The visible height in the DOM. */
  borderBoxHeight: number;
  /** borderBox + margin horizontal. The footprint in layout flow. */
  outerWidth: number;
  /** borderBox + margin vertical. The footprint in layout flow. */
  outerHeight: number;
}

// ────────────────────────────────────────────────────────────────
// Constructors
// ────────────────────────────────────────────────────────────────

const ZERO: EdgeInsets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/**
 * All four edges share the same inset. Equivalent to CSS
 * `padding: 10px;`.
 */
export function all(value: number): EdgeInsets {
  return { top: value, right: value, bottom: value, left: value };
}

/**
 * Vertical + horizontal shorthand. Equivalent to CSS
 * `padding: 10px 20px;`.
 */
export function symmetric(vertical: number, horizontal: number): EdgeInsets {
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
}

/**
 * Per-edge object with missing edges defaulting to 0.
 */
export function only(edges: Partial<EdgeInsets>): EdgeInsets {
  return {
    top: edges.top ?? 0,
    right: edges.right ?? 0,
    bottom: edges.bottom ?? 0,
    left: edges.left ?? 0,
  };
}

/**
 * CSS shorthand parser: accepts the 1-, 2-, 3-, or 4-value forms.
 *   "10px"              → all edges 10
 *   "10px 20px"         → vertical 10, horizontal 20
 *   "10px 20px 5px"     → top 10, horizontal 20, bottom 5
 *   "10px 20px 5px 8px" → top 10, right 20, bottom 5, left 8
 *
 * v0.3 (H3.2) also accepts `%` tokens provided a
 * `containingBlockWidth` is supplied; percentages are resolved
 * against that width on all four edges (CSS quirk).
 *
 *   parseEdgeInsets('10%', 200)           → all edges 20
 *   parseEdgeInsets('10% 20px', 200)      → vert 20, horiz 20
 *
 * If a `%` token appears without a `containingBlockWidth`, throws
 * with a clear message — callers should either supply the width
 * or parse into a `ResolvableEdgeInsets` via
 * `parseResolvableInsets()` and resolve later.
 *
 * `calc()` / mixed-unit forms still throw — see the file-level
 * PRELIGHT-NEXT.
 */
export function parseEdgeInsets(
  shorthand: string | number,
  containingBlockWidth?: number,
): EdgeInsets {
  if (typeof shorthand === 'number') return all(shorthand);
  const spec = parseResolvableInsets(shorthand);
  if (containingBlockWidth === undefined) {
    // Fast-path when no % tokens appeared and the caller didn't
    // supply a width: every edge is a number, so we can return
    // directly without forcing the caller to pass a width that
    // will be ignored.
    if (
      (spec.top === undefined || typeof spec.top === 'number') &&
      (spec.right === undefined || typeof spec.right === 'number') &&
      (spec.bottom === undefined || typeof spec.bottom === 'number') &&
      (spec.left === undefined || typeof spec.left === 'number')
    ) {
      return {
        top: (spec.top as number | undefined) ?? 0,
        right: (spec.right as number | undefined) ?? 0,
        bottom: (spec.bottom as number | undefined) ?? 0,
        left: (spec.left as number | undefined) ?? 0,
      };
    }
    throw new Error(
      `parseEdgeInsets: "${shorthand}" contains %-tokens; pass a containingBlockWidth (or use parseResolvableInsets + resolveInsets).`,
    );
  }
  return resolveInsets(spec, containingBlockWidth);
}

/**
 * Parse a CSS shorthand into an unresolved `ResolvableEdgeInsets`.
 * Accepts the same 1- to 4-value forms as `parseEdgeInsets`, plus
 * `%` tokens. The caller resolves with `resolveInsets(spec,
 * containingBlockWidth)` once the width is known — useful when
 * building a style object before the containing block exists.
 */
export function parseResolvableInsets(shorthand: string): ResolvableEdgeInsets {
  const tokens = shorthand.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    throw new Error(
      `parseResolvableInsets: expected 1-4 tokens, got ${tokens.length} in "${shorthand}"`,
    );
  }
  const values = tokens.map(parseInsetToken);
  const [a, b, c, d] = values;
  switch (tokens.length) {
    case 1:
      return { top: a!, right: a!, bottom: a!, left: a! };
    case 2:
      return { top: a!, right: b!, bottom: a!, left: b! };
    case 3:
      return { top: a!, right: b!, bottom: c!, left: b! };
    case 4:
      return { top: a!, right: b!, bottom: c!, left: d! };
    default:
      throw new Error('unreachable');
  }
}

function parseInsetToken(token: string): ResolvableInset {
  const pxMatch = /^(-?\d*\.?\d+)\s*(px)?$/i.exec(token);
  if (pxMatch) return Number.parseFloat(pxMatch[1] ?? '');
  const pctMatch = /^(-?\d*\.?\d+)\s*%$/.exec(token);
  if (pctMatch) return { percent: Number.parseFloat(pctMatch[1] ?? '') };
  throw new Error(
    `parseEdgeInsets: unsupported token "${token}" (only px and % supported; calc/mixed units not yet).`,
  );
}

/** Zero-inset singleton. Safe to alias — never mutate. */
export function zeroInsets(): EdgeInsets {
  return { ...ZERO };
}

// ────────────────────────────────────────────────────────────────
// Box builder
// ────────────────────────────────────────────────────────────────

/**
 * Build a `Box` from a content measurement + optional insets.
 * Defaults every inset to zero when omitted.
 */
export function box(spec: BoxSpec): Box {
  const padding = spec.padding ?? zeroInsets();
  const border = spec.border ?? zeroInsets();
  const margin = spec.margin ?? zeroInsets();
  const paddingBoxWidth = spec.content.measuredWidth + padding.left + padding.right;
  const paddingBoxHeight = spec.content.measuredHeight + padding.top + padding.bottom;
  const borderBoxWidth = paddingBoxWidth + border.left + border.right;
  const borderBoxHeight = paddingBoxHeight + border.top + border.bottom;
  const outerWidth = borderBoxWidth + margin.left + margin.right;
  const outerHeight = borderBoxHeight + margin.top + margin.bottom;
  return {
    content: spec.content,
    padding,
    border,
    margin,
    paddingBoxWidth,
    paddingBoxHeight,
    borderBoxWidth,
    borderBoxHeight,
    outerWidth,
    outerHeight,
  };
}

/**
 * Inverse builder: the caller has a border-box width (e.g. from
 * `box-sizing: border-box;`) and wants the content width. Subtracts
 * padding + border to recover the text-layout maxWidth the user
 * should pass to `verify()`.
 *
 * Throws if the result would be negative — that's a spec bug the
 * caller should hear about immediately.
 */
export function contentWidthFromBorderBox(
  borderBoxWidth: number,
  padding: EdgeInsets,
  border: EdgeInsets,
): number {
  const content = borderBoxWidth - padding.left - padding.right - border.left - border.right;
  if (content < 0) {
    throw new Error(
      `contentWidthFromBorderBox: borderBox ${borderBoxWidth}px is smaller than padding+border (${
        padding.left + padding.right + border.left + border.right
      }px); nothing fits.`,
    );
  }
  return content;
}

/**
 * Sum two EdgeInsets element-wise. Handy for combining padding +
 * border into a single "inner chrome" measure for intrinsic sizing.
 */
export function addInsets(a: EdgeInsets, b: EdgeInsets): EdgeInsets {
  return {
    top: a.top + b.top,
    right: a.right + b.right,
    bottom: a.bottom + b.bottom,
    left: a.left + b.left,
  };
}

/** Horizontal sum: left + right. */
export function horizontalInset(e: EdgeInsets): number {
  return e.left + e.right;
}

/** Vertical sum: top + bottom. */
export function verticalInset(e: EdgeInsets): number {
  return e.top + e.bottom;
}
