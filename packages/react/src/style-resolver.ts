/**
 * Style-resolver plugin surface for @prelight/react v0.2 (G1).
 *
 * The problem: in v0.1 the caller hands Prelight `font`, `maxWidth`,
 * and `lineHeight` explicitly. That was deliberate — Prelight couldn't
 * reach through a full CSS cascade, and guessing would lie. v0.2 opens
 * the door: for components that set their typography *inline* (via the
 * `style` prop) or via CSS custom properties, Prelight can resolve
 * those same values by walking the React element tree.
 *
 * This file defines the plugin surface. Each resolver inspects one
 * element in isolation and returns the styles it contributes; the
 * caller in `resolve-styles.ts` composes the cascade.
 *
 * PRELIGHT-INVARIANT: resolvers are pure functions. Same input → same
 * output, no I/O, no access to parent or sibling state.
 *
 * PRELIGHT-NEXT(v0.3): emotion + styled-components resolvers. They
 * require a runtime probe to extract the generated className →
 * CSSRule mapping, which is architecturally different from the
 * static-walk approach here. Tracking separately.
 */

import type { ReactElement } from 'react';

/**
 * Shape of resolved styles. Only the properties Prelight uses at
 * the text-layout layer. We keep this narrow deliberately — adding
 * `margin`/`padding` here is a v0.2 (G2) decision, not this file's.
 */
export interface ResolvedStyleFragment {
  font?: string;
  fontFamily?: string;
  fontSize?: string | number;
  fontWeight?: string | number;
  fontStyle?: string;
  lineHeight?: string | number;
  width?: string | number;
  maxWidth?: string | number;
  // CSS custom properties: `--foo`. Collected across the cascade
  // so a later resolver (e.g. cssVariables()) can consume them.
  [key: `--${string}`]: string | undefined;
}

/**
 * A StyleResolver inspects one React element and returns the style
 * fragment it contributes. Return `null` when the element has no
 * relevant styles — don't return an empty object.
 */
export interface StyleResolver {
  name: string;
  resolve(element: ReactElement): ResolvedStyleFragment | null;
}

/**
 * Built-in: read the element's `style` prop directly. Covers the
 * overwhelming majority of component libraries that accept a
 * `style` prop or style their own markup with inline styles.
 */
export function inlineStyle(): StyleResolver {
  return {
    name: 'inlineStyle',
    resolve(element: ReactElement): ResolvedStyleFragment | null {
      const props = (element.props ?? {}) as {
        style?: Record<string, string | number | undefined>;
      };
      const s = props.style;
      if (!s || typeof s !== 'object') return null;

      const frag: ResolvedStyleFragment = {};
      let hit = false;
      for (const [k, v] of Object.entries(s)) {
        if (v === undefined || v === null) continue;
        // CSS custom properties pass through verbatim.
        if (k.startsWith('--')) {
          (frag as Record<string, string>)[k] = String(v);
          hit = true;
          continue;
        }
        // React's `style` prop uses camelCase. We accept the small
        // set we care about; other props are ignored here, not
        // because they're wrong, but because they aren't typography.
        switch (k) {
          case 'font':
          case 'fontFamily':
          case 'fontStyle':
            frag[k] = String(v);
            hit = true;
            break;
          case 'fontSize':
          case 'fontWeight':
          case 'lineHeight':
          case 'width':
          case 'maxWidth':
            frag[k] = v as string | number;
            hit = true;
            break;
          default:
            break;
        }
      }
      return hit ? frag : null;
    },
  };
}

/**
 * Built-in: resolve `var(--foo)` references inside the fragment
 * using a caller-supplied variable map. Runs as a post-cascade
 * pass (see `resolve-styles.ts`), so it sees the final merged
 * variable set from every ancestor.
 *
 * Example:
 *   cssVariables({ '--brand-size': '14px', '--brand-width': '120px' })
 *
 * Then `style={{ fontSize: 'var(--brand-size)' }}` resolves as
 * `fontSize: '14px'`.
 */
export function cssVariables(
  initialVars: Record<string, string> = {},
): StyleResolver {
  // Stored once per resolver instance so resolver function stays pure
  // per call. A different variable map means a different resolver.
  const seed = { ...initialVars };
  return {
    name: 'cssVariables',
    // This resolver never extracts styles from an element directly —
    // it only contributes the caller-seeded variables, which get
    // merged into the ancestor cascade and consumed by the
    // post-resolver in `resolve-styles.ts`. Returning the seeded
    // vars for every element is equivalent to "these vars exist at
    // the root," which is the intended semantic.
    resolve(_element: ReactElement): ResolvedStyleFragment | null {
      if (Object.keys(seed).length === 0) return null;
      const out: ResolvedStyleFragment = {};
      for (const [k, v] of Object.entries(seed)) {
        const key = k.startsWith('--') ? (k as `--${string}`) : (`--${k}` as `--${string}`);
        out[key] = v;
      }
      return out;
    },
  };
}

/**
 * Parse a CSS length (e.g. `"14px"`, `14`, `"1rem"`) into pixels.
 * Accepts numbers as px directly. Returns `null` for unsupported
 * units so the caller can decide (throw vs. fall back).
 *
 * Supported: px (explicit or unit-less), em/rem (multiplied by
 * baseFontSize when provided).
 *
 * Explicitly unsupported in v0.2: %, vw, vh, calc(). Those depend
 * on runtime context Prelight doesn't have at static-verify time.
 * PRELIGHT-NEXT(v0.3): resolve vw/vh against a caller-supplied
 * viewport.
 */
export function parseLengthPx(
  value: string | number | undefined,
  baseFontSize = 16,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const match = /^(-?\d*\.?\d+)\s*(px|em|rem|pt)?$/i.exec(trimmed);
  if (!match) return null;
  const raw = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(raw)) return null;
  const unit = (match[2] ?? 'px').toLowerCase();
  switch (unit) {
    case 'px':
      return raw;
    case 'em':
    case 'rem':
      return raw * baseFontSize;
    case 'pt':
      return raw * (96 / 72);
    default:
      return null;
  }
}

/**
 * Parse a CSS `line-height` into pixels. Unitless numbers multiply
 * by the font size (matches CSS behaviour). String-with-unit values
 * use `parseLengthPx`.
 */
export function parseLineHeightPx(
  value: string | number | undefined,
  fontSize: number,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    // Heuristic matches CSS: unitless multiplier if < 8, else px.
    // (CSS technically treats any unitless number as a multiplier,
    // but nobody writes `line-height: 20` intending `20×`.)
    return value < 8 ? value * fontSize : value;
  }
  const trimmed = value.trim();
  if (trimmed === 'normal') return fontSize * 1.2;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber < 8 ? asNumber * fontSize : asNumber;
  }
  return parseLengthPx(trimmed, fontSize);
}

/**
 * Resolve any `var(--foo, fallback)` references in a string using
 * the accumulated variable map. Unknown variables fall through to
 * their declared fallback, then to the literal token.
 *
 * Export it because the ground-truth harness for G1 reuses it
 * directly when stamping inline styles into the browser.
 */
export function resolveVarReferences(
  value: string,
  vars: Record<string, string>,
): string {
  // `var(--name)` or `var(--name, fallback)`. Single-level — nested
  // fallbacks are rare and handled by a second pass if the result
  // still contains `var(`.
  let out = value;
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, name, fallback) => {
      const resolved = vars[name];
      if (resolved !== undefined) return resolved;
      return typeof fallback === 'string' ? fallback.trim() : `var(${name})`;
    });
    if (out === before) break;
  }
  return out;
}
