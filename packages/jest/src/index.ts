/**
 * Side-effect import registers the matcher with Jest's `expect` and ensures
 * the canvas environment is ready before the first assertion runs.
 *
 *   import '@prelight/jest'
 *
 *   test('fits', () => {
 *     expect({ text: 'Save', font: '16px Inter', maxWidth: 120, lineHeight: 20 })
 *       .toLayout({ maxLines: 1 })
 *   })
 *
 * Uses a top-level await on `ensureCanvasEnv`. Jest ESM mode required
 * (`--experimental-vm-modules` or `"type": "module"`). CJS consumers should
 * import from `@prelight/jest/cjs` (not yet shipped — PRELIGHT-NEXT(v0.2)).
 */

import { ensureCanvasEnv } from '@prelight/core';

import { register } from './matcher.js';

await ensureCanvasEnv();
register();

export { register } from './matcher.js';
export type { ToLayoutOptions } from './types.js';
