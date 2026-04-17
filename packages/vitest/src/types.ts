/**
 * Public type surface for the Vitest matcher. Augments `Assertion`
 * so that `expect(spec).toLayout(opts)` and its v0.2 siblings have
 * full TypeScript support in user tests.
 *
 * PRELIGHT-INVARIANT: matcher shape is identical between
 * @prelight/vitest and @prelight/jest. Keep these files in sync —
 * a divergence between the two is a bug, not a design.
 */

import type { Constraints } from '@prelight/core';

export interface ToLayoutOptions extends Constraints {
  atScales?: number[];
  atLanguages?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'vitest' {
  interface Assertion<T = any> {
    toLayout(options: ToLayoutOptions): T;
    toFitFlex(): T;
    toFitBlock(): T;
    toFitAspect(): T;
  }
  interface AsymmetricMatchersContaining {
    toLayout(options: ToLayoutOptions): unknown;
    toFitFlex(): unknown;
    toFitBlock(): unknown;
    toFitAspect(): unknown;
  }
}
