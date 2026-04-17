/**
 * Loader and validator for `prelight.config.ts`.
 *
 * Shape:
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
 *   }
 *
 *   export default config
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import type { ComponentVerifySpec } from '@prelight/react';

export interface PrelightTest extends ComponentVerifySpec {
  name: string;
}

export interface PrelightConfig {
  tests: PrelightTest[];
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
  if (!Array.isArray(candidate.tests)) {
    throw new Error(`Prelight config at ${path} must declare a 'tests' array.`);
  }
  for (const [i, t] of candidate.tests.entries()) {
    validateTest(t, i, path);
  }
  return candidate;
}

function validateTest(test: PrelightTest, index: number, path: string): void {
  const loc = `tests[${index}]`;
  if (!test.name || typeof test.name !== 'string') {
    throw new Error(`${path}:${loc}.name must be a non-empty string.`);
  }
  if (typeof test.font !== 'string') {
    throw new Error(`${path}:${loc}.font must be a CSS font shorthand string.`);
  }
  if (typeof test.maxWidth !== 'number' || test.maxWidth <= 0) {
    throw new Error(`${path}:${loc}.maxWidth must be a positive number.`);
  }
  if (typeof test.lineHeight !== 'number' || test.lineHeight <= 0) {
    throw new Error(`${path}:${loc}.lineHeight must be a positive number.`);
  }
  if (!test.constraints || typeof test.constraints !== 'object') {
    throw new Error(`${path}:${loc}.constraints must be an object.`);
  }
}
