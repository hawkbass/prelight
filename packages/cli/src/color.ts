/**
 * Zero-dependency ANSI coloring with TTY detection and NO_COLOR support.
 *
 * Rules (in precedence order):
 *
 *   1. If `FORCE_COLOR=0` or `NO_COLOR` is set (to any non-empty value),
 *      return strings unchanged. This matches the
 *      https://no-color.org/ informal spec.
 *   2. If `FORCE_COLOR` is truthy (any other non-empty value), always colour.
 *   3. Otherwise, colour only when the output stream is a TTY.
 *
 * PRELIGHT-INVARIANT: zero runtime deps. No `chalk`, no `picocolors`.
 * One file, one set of codes, deterministic output. If a user pipes
 * our stderr into a file, they get plain text — always.
 *
 * PRELIGHT-NEXT(v0.4): add per-level palette overrides via
 * `PRELIGHT_COLOR_PASS=green` / `PRELIGHT_COLOR_FAIL=red` env vars for
 * accessibility (deuteranopia/protanopia).
 */

export type ColorLevel = 'none' | 'basic';

export interface ColorDecision {
  level: ColorLevel;
  reason: string;
}

export interface ColorEnv {
  env: Record<string, string | undefined>;
  isTTY: boolean;
}

/**
 * Decide whether to emit colour for a given (env, stream) pair.
 *
 * Exported so the reporter tests can assert the decision table
 * without poking at globals.
 */
export function decideColor(e: ColorEnv): ColorDecision {
  const env = e.env;
  const forceColor = env.FORCE_COLOR;
  const noColor = env.NO_COLOR;

  if (forceColor !== undefined && forceColor !== '' && forceColor !== '0') {
    return { level: 'basic', reason: 'FORCE_COLOR' };
  }
  if (forceColor === '0') {
    return { level: 'none', reason: 'FORCE_COLOR=0' };
  }
  if (noColor !== undefined && noColor !== '') {
    return { level: 'none', reason: 'NO_COLOR' };
  }
  if (e.isTTY) {
    return { level: 'basic', reason: 'TTY' };
  }
  return { level: 'none', reason: 'not-a-TTY' };
}

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
} as const;

type Wrap = (s: string) => string;

export interface Palette {
  pass: Wrap;
  fail: Wrap;
  warn: Wrap;
  name: Wrap;
  dim: Wrap;
  header: Wrap;
}

const identity: Wrap = (s) => s;

export const plainPalette: Palette = {
  pass: identity,
  fail: identity,
  warn: identity,
  name: identity,
  dim: identity,
  header: identity,
};

export const basicPalette: Palette = {
  pass: (s) => `${ANSI.green}${s}${ANSI.reset}`,
  fail: (s) => `${ANSI.red}${s}${ANSI.reset}`,
  warn: (s) => `${ANSI.yellow}${s}${ANSI.reset}`,
  name: (s) => `${ANSI.cyan}${s}${ANSI.reset}`,
  dim: (s) => `${ANSI.dim}${s}${ANSI.reset}`,
  header: (s) => `${ANSI.bold}${s}${ANSI.reset}`,
};

export function paletteFor(decision: ColorDecision): Palette {
  return decision.level === 'basic' ? basicPalette : plainPalette;
}

/**
 * Convenience: build a palette from the current process + an output
 * stream (stdout or stderr). Used by the default CLI entry point.
 */
export function autoPalette(stream: NodeJS.WriteStream): Palette {
  return paletteFor(
    decideColor({
      env: process.env as Record<string, string | undefined>,
      isTTY: Boolean(stream.isTTY),
    }),
  );
}
