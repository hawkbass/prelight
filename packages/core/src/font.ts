/**
 * Font shorthand parsing + canvas measurement environment setup.
 *
 * Pretext's measurement primitive asks the runtime for a `OffscreenCanvas`
 * (browsers), a DOM `HTMLCanvasElement` (browsers), or throws. In Node and
 * Bun, neither exists. Prelight installs a tiny `OffscreenCanvas` shim
 * backed by `@napi-rs/canvas` so consumers never have to think about it.
 *
 * PRELIGHT-INVARIANT: importing from this file must be safe in every
 * environment Prelight supports (Node, Bun, modern browsers). The shim
 * installer is lazy and idempotent.
 * PRELIGHT-FLAG: the shim mutates `globalThis`. Browser builds short-circuit
 * the install, but the fact that we touch globals at all is a trade-off —
 * documented in DECISIONS #009.
 */

export interface FontDescriptor {
  family: string;
  size: number;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
  lineHeight?: number | undefined;
}

let shimInstalled = false;

function hasNativeOffscreenCanvas(): boolean {
  return typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas !== 'undefined';
}

/**
 * Install an `OffscreenCanvas` shim backed by `@napi-rs/canvas` when running
 * in Node or Bun. No-op in browsers. Async — the native canvas module loads
 * through dynamic import so browser builds never include it.
 *
 * Consumers who want to pre-install (test bootstrap, CLI startup) call this
 * directly. Subsequent calls are no-ops.
 */
export async function installCanvasShim(): Promise<void> {
  if (shimInstalled) return;
  if (hasNativeOffscreenCanvas()) {
    shimInstalled = true;
    return;
  }
  const mod = (await import('@napi-rs/canvas')) as {
    createCanvas: (w: number, h: number) => { getContext: (t: string) => unknown };
  };
  class OffscreenCanvasShim {
    private _canvas: { getContext: (t: string) => unknown };
    constructor(width: number, height: number) {
      this._canvas = mod.createCanvas(width, height);
    }
    getContext(type: string): unknown {
      return this._canvas.getContext(type);
    }
  }
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = OffscreenCanvasShim;
  shimInstalled = true;
}

/**
 * Ensure Pretext can measure text in the current environment. Call once at
 * test bootstrap or CLI startup before invoking {@link verify}.
 *
 *   import { ensureCanvasEnv } from '@prelight/core'
 *   await ensureCanvasEnv()
 *
 * The Vitest, Jest, and CLI adapters all do this automatically.
 */
export async function ensureCanvasEnv(): Promise<void> {
  if (!hasNativeOffscreenCanvas()) {
    await installCanvasShim();
  }
}

/** Throws if the canvas env was not pre-flighted. Used by the sync verifier. */
export function assertCanvasReady(): void {
  if (!hasNativeOffscreenCanvas()) {
    throw new Error(
      'Prelight: canvas environment not ready. Call `await ensureCanvasEnv()` at test setup or CLI startup before `verify()`.',
    );
  }
}

/**
 * Register a font file with the Node/Bun canvas backend so that measurements
 * using the given family resolve to the bundled file rather than whatever the
 * host OS happens to have installed.
 *
 * No-op in browsers (they load fonts via `@font-face` in CSS). Only meaningful
 * under `@napi-rs/canvas`, which is what `installCanvasShim` wires up.
 *
 *   import { loadBundledFont, ensureCanvasEnv } from '@prelight/core'
 *   await ensureCanvasEnv()
 *   loadBundledFont('/abs/path/InterVariable.ttf', 'Inter')
 *
 * Returns `true` if the font was registered, `false` if the backend refused
 * (unreadable file, unsupported format, browser context, …).
 *
 * PRELIGHT-INVARIANT: this function must be callable from a browser build
 * without throwing. It simply returns `false` there.
 */
export async function loadBundledFont(path: string, familyAlias?: string): Promise<boolean> {
  if (
    hasNativeOffscreenCanvas() &&
    typeof (globalThis as { window?: unknown }).window !== 'undefined'
  ) {
    return false;
  }
  try {
    const mod = (await import('@napi-rs/canvas')) as {
      GlobalFonts?: {
        registerFromPath: (path: string, nameAlias?: string) => unknown;
        has?: (name: string) => boolean;
      };
    };
    if (!mod.GlobalFonts) return false;
    const key = mod.GlobalFonts.registerFromPath(path, familyAlias);
    return key !== null && key !== undefined;
  } catch {
    return false;
  }
}

/**
 * Parse a CSS font shorthand string into a structured descriptor.
 *
 * Accepted shapes (subset of the full CSS font shorthand — v0.1 targets the
 * cases real component libraries write):
 *   - "16px Inter"
 *   - "600 14px Inter"
 *   - "italic 600 14px/1.5 Inter, system-ui"
 *   - "bold 20px 'SF Pro', sans-serif"
 *
 * Not supported in v0.1, tracked as PRELIGHT-NEXT(v1.0):
 *   - Font-size keywords (small, medium, large, x-large, …)
 *   - Relative sizes (em, rem, %, smaller, larger)
 *   - Font-variant, font-stretch
 *   - CSS custom properties
 */
export function parseFont(shorthand: string): FontDescriptor {
  const trimmed = shorthand.trim();
  if (!trimmed) {
    throw new Error(`parseFont: empty font string`);
  }

  let style: FontDescriptor['style'] = 'normal';
  let weight = 400;
  let size: number | null = null;
  let lineHeight: number | undefined;
  let familyStart = -1;

  const tokens = tokenizeFontShorthand(trimmed);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const lower = tok.toLowerCase();

    if (lower === 'normal' || lower === 'italic' || lower === 'oblique') {
      style = lower;
      continue;
    }
    if (lower === 'bold') {
      weight = 700;
      continue;
    }
    if (/^[1-9]00$/.test(lower)) {
      weight = Number.parseInt(lower, 10);
      continue;
    }
    const sizeMatch = /^(-?\d*\.?\d+)px(?:\/(-?\d*\.?\d+)(px)?)?$/i.exec(tok);
    if (sizeMatch) {
      size = Number.parseFloat(sizeMatch[1]!);
      if (sizeMatch[2]) {
        lineHeight = Number.parseFloat(sizeMatch[2]);
      }
      familyStart = i + 1;
      break;
    }
    throw new Error(`parseFont: unsupported token "${tok}" in "${shorthand}"`);
  }

  if (size === null || familyStart < 0) {
    throw new Error(`parseFont: missing pixel size in "${shorthand}"`);
  }
  const familyTokens = tokens.slice(familyStart);
  if (familyTokens.length === 0) {
    throw new Error(`parseFont: missing font family in "${shorthand}"`);
  }
  const family = familyTokens.join(' ').replace(/\s*,\s*/g, ', ');

  return { family, size, weight, style, lineHeight };
}

function tokenizeFontShorthand(input: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = i + 1;
      while (end < input.length && input[end] !== quote) end++;
      out.push(input.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let end = i;
    while (end < input.length && input[end] !== ' ' && input[end] !== '\t') {
      end++;
    }
    out.push(input.slice(i, end));
    i = end;
  }
  return out;
}

/**
 * Scale a font's pixel size while preserving every other facet of the
 * shorthand. Used when sweeping user-agent font scales (1.0, 1.25, 1.5, 2.0).
 *
 * Implementation note: we regex-replace only the first `NNpx` occurrence in
 * the string (which, by CSS grammar, is always the font-size). Preserving
 * the original string shape avoids reconstructing the shorthand, which is
 * lossy for exotic cases (fallback stacks with quoted families).
 */
export function scaleFont(shorthand: string, scale: number): string {
  return shorthand.replace(/(-?\d*\.?\d+)px/, (_match, n: string) => {
    const scaled = Number.parseFloat(n) * scale;
    const rounded = Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(2);
    return `${rounded}px`;
  });
}
