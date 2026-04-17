/**
 * Public type surface for the Jest matcher. Mirror of @prelight/vitest/types.
 *
 * PRELIGHT-INVARIANT: keep this shape identical to the Vitest version.
 */

import type { Constraints } from '@prelight/core';

export interface ToLayoutOptions extends Constraints {
  atScales?: number[];
  atLanguages?: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toLayout(options: ToLayoutOptions): R;
      toFitFlex(): R;
      toFitBlock(): R;
      toFitAspect(): R;
    }
  }
}

export {};
