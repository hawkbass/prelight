/**
 * Tree-walking style resolver for v0.2 (G1).
 *
 * Given a React element and a list of StyleResolver plugins, walk
 * the element tree top-down, accumulate each element's contributed
 * styles, and return the effective font / maxWidth / lineHeight at
 * the innermost text-bearing descendant.
 *
 * Cascade rules (a small, deliberate subset of CSS):
 *   - Typography props (font, fontFamily, fontSize, lineHeight,
 *     fontWeight, fontStyle): last writer wins as you descend the
 *     tree. Mirrors CSS inheritance for these specific properties.
 *   - Box constraints (width, maxWidth): innermost ancestor's value
 *     wins. An inner element that overrides its parent's maxWidth
 *     takes precedence. Useful for "button inside a card" where the
 *     button's own width narrows what the text sees.
 *   - CSS variables (`--foo`): merged across every element. A
 *     descendant can shadow an ancestor.
 *   - `font` shorthand: if present, parsed into its pieces (size +
 *     family) before further cascade. The shorthand wins over
 *     separate `fontFamily`/`fontSize` at the same element, but a
 *     deeper descendant's explicit `fontSize` still overrides.
 *
 * PRELIGHT-INVARIANT: the walk is pure — no DOM reads, no rendering,
 * no external network calls. Everything comes from the React tree
 * and the caller-supplied resolvers.
 *
 * v0.3 (H4) adds slot-targeted resolution via the `slot` option.
 * When `slot: 'title'` is passed, the walker descends along the
 * path from the root to the element carrying
 * `data-prelight-slot="title"` and applies resolvers at each
 * step — so the returned styles reflect exactly what cascades to
 * that slot, skipping unrelated siblings. If the slot isn't
 * present in the tree we throw with the list of known slots, so
 * callers fail fast instead of silently falling back to the
 * first-text-branch cascade.
 */

import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

import { findSlotPath, findSlots } from './slots.js';
import {
  inlineStyle,
  parseLengthPx,
  parseLineHeightPx,
  resolveVarReferences,
  type ResolvedStyleFragment,
  type StyleResolver,
} from './style-resolver.js';

export interface ResolvedStyles {
  font?: string;
  maxWidth?: number;
  lineHeight?: number;
  /** Accumulated CSS custom properties at the resolved leaf. */
  cssVariables: Record<string, string>;
  /** Debug: list of `{ prop, value, resolver, elementType }` contributions. */
  sources: StyleSource[];
}

export interface StyleSource {
  prop: string;
  value: string;
  resolver: string;
  elementType: string;
}

export interface ResolveStylesOptions {
  /** Defaults to `[inlineStyle()]`. Pass a custom chain to add resolvers. */
  resolvers?: StyleResolver[];
  /**
   * Base font size used when resolving em/rem lengths before a
   * `fontSize` has been established by the cascade. Defaults to 16.
   */
  rootFontSizePx?: number;
  /**
   * Resolve styles *for a named slot* instead of the innermost
   * text-bearing descendant of the first element branch. The slot
   * is the first element (depth-first preorder) carrying
   * `data-prelight-slot={slot}`. If no such element exists,
   * `resolveStyles` throws with the list of slots it found — fail
   * fast rather than silently returning unrelated styles.
   */
  slot?: string;
}

/**
 * Walk the tree and return the effective styles for the innermost
 * text-bearing leaf of the first text branch. See file docstring
 * for the cascade semantics.
 */
export function resolveStyles(
  element: ReactElement,
  options: ResolveStylesOptions = {},
): ResolvedStyles {
  const resolvers = options.resolvers ?? [inlineStyle()];
  const rootFontSize = options.rootFontSizePx ?? 16;

  const sources: StyleSource[] = [];
  const cssVariables: Record<string, string> = {};

  // Effective "currently inherited" state as we descend. We keep only
  // longhands here — any `font` shorthand is exploded into longhands
  // at apply time, so composition reads a single source of truth.
  const state = {
    fontFamily: undefined as string | undefined,
    fontSize: undefined as string | number | undefined,
    fontWeight: undefined as string | number | undefined,
    fontStyle: undefined as string | undefined,
    lineHeight: undefined as string | number | undefined,
    width: undefined as string | number | undefined,
    maxWidth: undefined as string | number | undefined,
  };

  function applyNode(node: ReactElement): void {
    const elementType =
      typeof node.type === 'string' ? node.type : (node.type as { name?: string } | null)?.name ?? 'Component';
    for (const resolver of resolvers) {
      const fragment = resolver.resolve(node);
      if (!fragment) continue;
      applyFragment(fragment, resolver.name, elementType, state, cssVariables, sources);
    }
  }

  /** Descend into the first child that itself has children, then recurse. */
  function visit(node: ReactNode): void {
    if (!isValidElement(node)) return;
    applyNode(node);
    const props = (node.props ?? {}) as { children?: ReactNode };
    const children = toArray(props.children);
    // Descend into the first element child. v0.2 treats the element
    // tree as a single text column; picking the first element-child
    // matches extractText's collapsing behaviour and keeps the
    // cascade predictable.
    for (const child of children) {
      if (isValidElement(child)) {
        visit(child);
        break;
      }
    }
  }

  if (options.slot !== undefined) {
    // Slot-targeted cascade: replay resolvers along the exact
    // ancestor path to the slot, no sibling descent. If the slot
    // isn't present, throw with a helpful list — callers want to
    // fail loudly here, not fall back to unrelated styles.
    const path = findSlotPath(element, options.slot);
    if (path === null) {
      const known = findSlots(element);
      const knownStr = known.length > 0 ? known.join(', ') : '(none)';
      throw new Error(
        `resolveStyles: slot "${options.slot}" not found; known slots in this tree: [${knownStr}].`,
      );
    }
    for (const node of path) applyNode(node);
  } else {
    visit(element);
  }

  // Post-cascade: resolve var() references in the final values
  // against the accumulated variable map.
  const finalFont = composeFontShorthand(state, cssVariables, rootFontSize);
  const finalMaxWidth = parseLengthPx(
    resolveMaybeVar(state.maxWidth ?? state.width, cssVariables),
    rootFontSize,
  );
  const fontSizePx =
    parseLengthPx(resolveMaybeVar(state.fontSize, cssVariables), rootFontSize) ?? rootFontSize;
  const finalLineHeight = parseLineHeightPx(
    resolveMaybeVar(state.lineHeight, cssVariables),
    fontSizePx,
  );

  const out: ResolvedStyles = { cssVariables, sources };
  if (finalFont !== undefined) out.font = finalFont;
  if (finalMaxWidth !== null && finalMaxWidth !== undefined) out.maxWidth = finalMaxWidth;
  if (finalLineHeight !== null && finalLineHeight !== undefined) out.lineHeight = finalLineHeight;
  return out;
}

function toArray(children: ReactNode): ReactNode[] {
  if (children === undefined || children === null || children === false) return [];
  return Array.isArray(children) ? children : [children];
}

function applyFragment(
  frag: ResolvedStyleFragment,
  resolverName: string,
  elementType: string,
  state: Record<string, string | number | undefined>,
  cssVariables: Record<string, string>,
  sources: StyleSource[],
): void {
  // Explode the `font` shorthand first so subsequent longhands in
  // the same fragment (or in any descendant fragment) override it
  // cleanly. After this step we never read `state.font` again —
  // longhands are authoritative.
  if ('font' in frag && typeof frag.font === 'string') {
    const parsed = parseFontShorthand(frag.font);
    if (parsed.fontSize !== undefined) state.fontSize = parsed.fontSize;
    if (parsed.fontFamily !== undefined) state.fontFamily = parsed.fontFamily;
    sources.push({
      prop: 'font',
      value: frag.font,
      resolver: resolverName,
      elementType,
    });
  }

  for (const [k, v] of Object.entries(frag)) {
    if (v === undefined || v === null) continue;
    if (k === 'font') continue; // already exploded above.
    if (k.startsWith('--')) {
      cssVariables[k] = String(v);
      sources.push({ prop: k, value: String(v), resolver: resolverName, elementType });
      continue;
    }
    state[k] = v as string | number;
    sources.push({ prop: k, value: String(v), resolver: resolverName, elementType });
  }
}

function resolveMaybeVar(
  value: string | number | undefined,
  vars: Record<string, string>,
): string | number | undefined {
  if (typeof value !== 'string') return value;
  if (!value.includes('var(')) return value;
  return resolveVarReferences(value, vars);
}

/**
 * Build a CSS `font` shorthand from the effective state. Matches
 * what `@prelight/core` and `canvas.measureText` expect.
 *
 * If the state has an explicit `font` string we resolve any vars
 * and return that directly. Otherwise we assemble:
 *     [weight] [style] <size> <family>
 * with sensible defaults (weight: 400, family: sans-serif).
 */
function composeFontShorthand(
  state: Record<string, string | number | undefined>,
  vars: Record<string, string>,
  rootFontSize: number,
): string | undefined {
  const fontSize = parseLengthPx(resolveMaybeVar(state.fontSize, vars), rootFontSize);
  const fontFamily = typeof state.fontFamily === 'string'
    ? resolveMaybeVar(state.fontFamily, vars)
    : undefined;

  if (fontSize === null || fontSize === undefined) return undefined;
  if (fontFamily === undefined) return undefined;

  const parts: string[] = [];
  if (state.fontStyle && state.fontStyle !== 'normal') parts.push(String(state.fontStyle));
  if (state.fontWeight !== undefined && state.fontWeight !== 400 && state.fontWeight !== 'normal') {
    parts.push(String(state.fontWeight));
  }
  parts.push(`${fontSize}px`);
  parts.push(String(fontFamily));
  return parts.join(' ');
}

/**
 * Parse the parts of a `font` shorthand we care about: the pixel
 * size (before `/line-height`) and the family list (everything
 * after). Closely mirrors `@prelight/core`'s own parser; kept local
 * so the react package stays self-contained on the shorthand shape.
 */
function parseFontShorthand(shorthand: string): { fontSize?: string; fontFamily?: string } {
  const match = /^(?:(?:[a-z-]+|\d+)\s+){0,3}(\d*\.?\d+px)(?:\/[^\s]+)?\s+(.+)$/i.exec(shorthand.trim());
  if (!match) return {};
  const fontSize = match[1];
  const fontFamily = match[2];
  return {
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(fontFamily !== undefined ? { fontFamily } : {}),
  };
}
