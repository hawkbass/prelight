/**
 * Verify a React component's text layout.
 *
 * Usage (explicit, v0.1-compatible):
 *
 *   verifyComponent({
 *     element: (lang) => <Button>{labels[lang]}</Button>,
 *     languages: ['en', 'de', 'ar', 'ja'],
 *     font: '16px Inter',
 *     maxWidth: 120,
 *     lineHeight: 20,
 *     constraints: { maxLines: 1, noOverflow: true },
 *     fontScales: [1, 1.25, 1.5],
 *   })
 *
 * Usage (v0.2 auto-resolved, G1): omit `font`, `maxWidth`, and
 * `lineHeight` — Prelight walks the rendered element tree and pulls
 * them from inline styles and CSS variables. See `resolveStyles()`.
 *
 *   verifyComponent({
 *     element: (lang) => (
 *       <div style={{ fontSize: 16, fontFamily: 'Inter', maxWidth: 120, lineHeight: 20 }}>
 *         <button>{labels[lang]}</button>
 *       </div>
 *     ),
 *     languages: ['en', 'de'],
 *     constraints: { maxLines: 1 },
 *     autoResolve: true,
 *   })
 *
 * The `element` factory is called once per language. Each render is
 * extracted to plain text via `renderToStaticMarkup`, then the matrix
 * verifier handles the rest.
 */

import type { ReactElement } from 'react';
import {
  verify,
  type Constraints,
  type VerifyResult,
} from '@prelight/core';

import { extractText } from './extract.js';
import { resolveStyles, type ResolveStylesOptions } from './resolve-styles.js';
import { extractSlotText } from './slots.js';

export interface ComponentVerifySpec {
  element: ReactElement | ((language: string) => ReactElement);
  /** Required unless `autoResolve: true` and the component supplies it inline. */
  font?: string;
  /** Required unless `autoResolve: true` and the component supplies it inline. */
  maxWidth?: number;
  /** Required unless `autoResolve: true` and the component supplies it inline. */
  lineHeight?: number;
  constraints: Constraints;
  languages?: string[];
  fontScales?: number[];
  /**
   * v0.2: when true, walk the rendered element with `resolveStyles()`
   * and derive any missing `font` / `maxWidth` / `lineHeight` from
   * inline styles and CSS variables. Explicit values still win.
   */
  autoResolve?: boolean;
  /** Forwarded to `resolveStyles()` when `autoResolve` is true. */
  resolveOptions?: ResolveStylesOptions;
  /**
   * v0.3 (H4) — verify a named slot rather than the whole
   * component. Extracts text via `extractSlotText(element, slot)`
   * (so only that slot's text flows through the verifier), and
   * when `autoResolve` is true also passes `{ slot }` to
   * `resolveStyles()` so the cascade follows the slot path.
   * The slot must be tagged with `data-prelight-slot={slot}` on
   * an element; an absent slot throws with the known-slots list.
   */
  slot?: string;
}

export function verifyComponent(spec: ComponentVerifySpec): VerifyResult {
  const languages = spec.languages ?? ['default'];
  const text: Record<string, string> = {};
  let font = spec.font;
  let maxWidth = spec.maxWidth;
  let lineHeight = spec.lineHeight;

  // Only auto-resolve once per verify call — the first language's
  // rendered tree decides the styles. Different languages reshape
  // text content, but they share the component's typography.
  let resolved: ReturnType<typeof resolveStyles> | undefined;

  for (const lang of languages) {
    const element =
      typeof spec.element === 'function' ? spec.element(lang) : spec.element;
    text[lang] = spec.slot !== undefined ? extractSlotText(element, spec.slot) : extractText(element);

    if (spec.autoResolve && resolved === undefined) {
      const resolveOpts: ResolveStylesOptions = { ...(spec.resolveOptions ?? {}) };
      if (spec.slot !== undefined && resolveOpts.slot === undefined) {
        resolveOpts.slot = spec.slot;
      }
      resolved = resolveStyles(element, resolveOpts);
      font = font ?? resolved.font;
      maxWidth = maxWidth ?? resolved.maxWidth;
      lineHeight = lineHeight ?? resolved.lineHeight;
    }
  }

  if (font === undefined || maxWidth === undefined || lineHeight === undefined) {
    const missing: string[] = [];
    if (font === undefined) missing.push('font');
    if (maxWidth === undefined) missing.push('maxWidth');
    if (lineHeight === undefined) missing.push('lineHeight');
    const suffix = spec.autoResolve
      ? ` (autoResolve did not find inline styles for these; sources: ${
          resolved?.sources.map((s) => `${s.prop}=${s.value}@${s.elementType}`).join(', ') ?? 'none'
        })`
      : '';
    throw new Error(`verifyComponent: missing required style inputs: ${missing.join(', ')}${suffix}`);
  }

  return verify({
    text,
    font,
    maxWidth,
    lineHeight,
    constraints: spec.constraints,
    ...(spec.fontScales !== undefined ? { fontScales: spec.fontScales } : {}),
    ...(spec.languages !== undefined ? { languages: spec.languages } : {}),
  });
}
