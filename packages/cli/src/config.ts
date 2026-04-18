/**
 * Loader and validator for `prelight.config.ts`.
 *
 * Shape (v0.2):
 *
 *   // prelight.config.ts
 *   import type { PrelightConfig } from '@prelight/cli'
 *
 *   const labels = {
 *     save: { en: 'Save', de: 'Speichern', ar: 'حفظ', ja: '保存' },
 *   }
 *
 *   const config: PrelightConfig = {
 *     tests: [
 *       {
 *         name: 'Save button',
 *         element: (lang) => <button>{labels.save[lang]}</button>,
 *         font: '16px Inter',
 *         maxWidth: 120,
 *         lineHeight: 20,
 *         constraints: { maxLines: 1, noOverflow: true },
 *         languages: ['en', 'de', 'ar', 'ja'],
 *         fontScales: [1, 1.25, 1.5],
 *       },
 *     ],
 *     // v0.2: structural predicate tests.
 *     layouts: [
 *       {
 *         name: 'Nav bar',
 *         kind: 'flex',
 *         spec: { container: { innerMain: 320, gap: 8 }, children: [...] },
 *       },
 *       {
 *         name: 'Hero image',
 *         kind: 'aspect',
 *         spec: { intrinsic: { width: 1600, height: 900 }, slot: { width: 400, height: 225 }, fit: 'cover' },
 *       },
 *     ],
 *   }
 *
 *   export default config
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import type { ComponentVerifySpec } from '@prelight/react';
import type {
  FitsAspectSpec,
  FitsBlockSpec,
  FitsFlexSpec,
} from '@prelight/core';

export interface PrelightTest extends ComponentVerifySpec {
  name: string;
}

/**
 * Structural-layout tests — one of flex, block, or aspect. Each
 * carries the exact spec the corresponding core predicate expects.
 */
export type PrelightLayoutTest =
  | { name: string; kind: 'flex'; spec: FitsFlexSpec }
  | { name: string; kind: 'block'; spec: FitsBlockSpec }
  | { name: string; kind: 'aspect'; spec: FitsAspectSpec };

export interface PrelightConfig {
  tests?: PrelightTest[];
  /** v0.2: structural predicate tests. */
  layouts?: PrelightLayoutTest[];
  failFast?: boolean;
}

/**
 * Find a config file in the given directory.
 *
 * Order: .tsx, .ts, .mts, .jsx, .js, .mjs. Configs that use JSX should use
 * the .tsx extension so Bun's loader parses them correctly — Prelight
 * configs commonly embed JSX component factories.
 */
export function findConfig(cwd: string): string | null {
  const candidates = [
    'prelight.config.tsx',
    'prelight.config.ts',
    'prelight.config.mts',
    'prelight.config.jsx',
    'prelight.config.js',
    'prelight.config.mjs',
  ];
  for (const name of candidates) {
    const full = resolve(cwd, name);
    if (existsSync(full)) return full;
  }
  return null;
}

/** Dynamically import the config file and validate its export shape. */
export async function loadConfig(path: string): Promise<PrelightConfig> {
  const url = pathToFileURL(path).href;
  const mod = (await import(url)) as { default?: unknown };
  const def = mod.default;
  if (!def || typeof def !== 'object') {
    throw new Error(`Prelight config at ${path} must export a default object.`);
  }
  const candidate = def as PrelightConfig;
  if (candidate.tests === undefined && candidate.layouts === undefined) {
    throw new Error(
      `Prelight config at ${path} must declare at least a 'tests' or 'layouts' array.`,
    );
  }
  if (candidate.tests !== undefined) {
    if (!Array.isArray(candidate.tests)) {
      throw new Error(`Prelight config at ${path} must declare a 'tests' array.`);
    }
    for (const [i, t] of candidate.tests.entries()) {
      validateTest(t, i, path);
    }
  }
  if (candidate.layouts !== undefined) {
    if (!Array.isArray(candidate.layouts)) {
      throw new Error(`Prelight config at ${path} must declare 'layouts' as an array.`);
    }
    for (const [i, l] of candidate.layouts.entries()) {
      validateLayout(l, i, path);
    }
  }
  return candidate;
}

function validateTest(test: PrelightTest, index: number, path: string): void {
  const loc = `tests[${index}]`;
  if (!test.name || typeof test.name !== 'string') {
    throw new Error(`${path}:${loc}.name must be a non-empty string.`);
  }
  // `autoResolve: true` walks the static React tree; `runtime: true`
  // mounts into happy-dom and reads `getComputedStyle()` (v0.3 H7).
  // Either path populates font/maxWidth/lineHeight from the
  // component itself, so explicit values become optional. Explicit
  // values always win if present — see `verifyComponent` overloads.
  const autoPopulates = test.autoResolve === true || test.runtime === true;
  if (!autoPopulates) {
    if (typeof test.font !== 'string') {
      throw new Error(`${path}:${loc}.font must be a CSS font shorthand string.`);
    }
    if (typeof test.maxWidth !== 'number' || test.maxWidth <= 0) {
      throw new Error(`${path}:${loc}.maxWidth must be a positive number.`);
    }
    if (typeof test.lineHeight !== 'number' || test.lineHeight <= 0) {
      throw new Error(`${path}:${loc}.lineHeight must be a positive number.`);
    }
  }
  if (!test.constraints || typeof test.constraints !== 'object') {
    throw new Error(`${path}:${loc}.constraints must be an object.`);
  }
}

function validateLayout(layout: PrelightLayoutTest, index: number, path: string): void {
  const loc = `layouts[${index}]`;
  if (!layout.name || typeof layout.name !== 'string') {
    throw new Error(`${path}:${loc}.name must be a non-empty string.`);
  }
  if (!['flex', 'block', 'aspect'].includes(layout.kind)) {
    throw new Error(`${path}:${loc}.kind must be one of "flex" | "block" | "aspect".`);
  }
  if (!layout.spec || typeof layout.spec !== 'object') {
    throw new Error(`${path}:${loc}.spec must be an object.`);
  }
}
