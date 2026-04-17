/**
 * Box model primitives for v0.2 (G2).
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
 * PRELIGHT-INVARIANT: every function in this file is pure. No I/O,
 * no DOM, no canvas calls. Given the same inputs it returns the
 * same output. Arithmetic rounding follows IEEE-754 double — no
 * deliberate truncation.
 *
 * PRELIGHT-NEXT(v0.3): percentage-based insets resolved against a
 * caller-supplied containing-block width. Today we accept px-only
 * numeric insets.
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
 * Unsupported forms (calc, %, mixed units) throw — callers should
 * pre-resolve them.
 */
export function parseEdgeInsets(shorthand: string | number): EdgeInsets {
  if (typeof shorthand === 'number') return all(shorthand);
  const tokens = shorthand.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    throw new Error(`parseEdgeInsets: expected 1-4 tokens, got ${tokens.length} in "${shorthand}"`);
  }
  const px = tokens.map(parsePxToken);
  const [a, b, c, d] = px;
  switch (tokens.length) {
    case 1:
      return all(a!);
    case 2:
      return symmetric(a!, b!);
    case 3:
      return { top: a!, right: b!, bottom: c!, left: b! };
    case 4:
      return { top: a!, right: b!, bottom: c!, left: d! };
    default:
      throw new Error('unreachable');
  }
}

function parsePxToken(token: string): number {
  const match = /^(-?\d*\.?\d+)\s*(px)?$/i.exec(token);
  if (!match) {
    throw new Error(`parseEdgeInsets: unsupported token "${token}" (only px supported in v0.2)`);
  }
  return Number.parseFloat(match[1] ?? '');
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
