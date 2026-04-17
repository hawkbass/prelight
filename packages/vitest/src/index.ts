/**
 * Side-effect import registers the matcher with Vitest's `expect` and ensures
 * the canvas environment is ready before the first assertion runs.
 *
 *   import '@prelight/vitest'
 *
 *   test('fits', () => {
 *     expect({ text: 'Save', font: '16px Inter', maxWidth: 120, lineHeight: 20 })
 *       .toLayout({ maxLines: 1 })
 *   })
 *
 * The top-level await on `ensureCanvasEnv` means this file must only be
 * imported from ESM contexts — which is the Vitest default.
 */

import { ensureCanvasEnv } from '@prelight/core';

import { register } from './matcher.js';

await ensureCanvasEnv();
register();

export type { ToLayoutOptions } from './types.js';
