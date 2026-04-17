/**
 * Jest matcher implementation. Mirrors @prelight/vitest/src/matcher.ts.
 *
 * PRELIGHT-INVARIANT: behaviour and error messages must match the
 * Vitest adapter exactly. A test rewritten between the two runners
 * should produce byte-identical `message()` output.
 */

import {
  fitsAspect,
  fitsBlock,
  fitsFlex,
  formatReport,
  verify,
  type Constraints,
  type FitsAspectSpec,
  type FitsBlockSpec,
  type FitsFlexSpec,
  type VerifySpec,
} from '@prelight/core';

import type { ToLayoutOptions } from './types.js';

const CONSTRAINT_KEYS = [
  'noOverflow',
  'maxLines',
  'minLines',
  'lines',
  'singleLine',
  'noTruncation',
] as const satisfies ReadonlyArray<keyof Constraints>;

function extractConstraints(options: ToLayoutOptions): Constraints {
  const out: Constraints = {};
  const bag = options as unknown as Record<string, unknown>;
  for (const key of CONSTRAINT_KEYS) {
    const v = bag[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

type ReceivedSpec = Pick<VerifySpec, 'text' | 'font' | 'maxWidth' | 'lineHeight'>;

function isReceivedSpec(value: unknown): value is ReceivedSpec {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (typeof v.text === 'string' || (typeof v.text === 'object' && v.text !== null)) &&
    typeof v.font === 'string' &&
    typeof v.maxWidth === 'number' &&
    typeof v.lineHeight === 'number'
  );
}

function isFlexSpec(value: unknown): value is FitsFlexSpec {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.container !== undefined && typeof v.container === 'object' && Array.isArray(v.children);
}

function isBlockSpec(value: unknown): value is FitsBlockSpec {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.container !== undefined && typeof v.container === 'object' && Array.isArray(v.children);
}

function isAspectSpec(value: unknown): value is FitsAspectSpec {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.intrinsic === 'object' &&
    v.intrinsic !== null &&
    typeof v.slot === 'object' &&
    v.slot !== null
  );
}

interface JestExpect {
  extend(matchers: Record<string, unknown>): void;
}

/**
 * Registers the matchers. Accepts an optional `expect` reference for
 * environments where the global `expect` is not yet assigned at
 * import time (Jest setup files, for example).
 */
export function register(expectRef?: JestExpect): void {
  const target =
    expectRef ??
    ((globalThis as unknown as { expect?: JestExpect }).expect as JestExpect | undefined);
  if (!target) {
    throw new Error(
      '@prelight/jest: expect is not defined. Import this module from a Jest test file or pass expect explicitly.',
    );
  }
  target.extend({
    toLayout(received: unknown, options: ToLayoutOptions) {
      if (!isReceivedSpec(received)) {
        return {
          pass: false,
          message: () =>
            'toLayout expected an object with { text, font, maxWidth, lineHeight }.',
        };
      }
      const spec: VerifySpec = {
        text: received.text,
        font: received.font,
        maxWidth: received.maxWidth,
        lineHeight: received.lineHeight,
        constraints: extractConstraints(options),
        ...(options.atScales !== undefined ? { fontScales: options.atScales } : {}),
        ...(options.atLanguages !== undefined ? { languages: options.atLanguages } : {}),
      };
      const result = verify(spec);
      return {
        pass: result.ok,
        message: () => (result.ok ? 'all cells passed' : formatReport(result)),
      };
    },

    toFitFlex(received: unknown) {
      if (!isFlexSpec(received)) {
        return {
          pass: false,
          message: () =>
            'toFitFlex expected an object with { container, children: [...] }.',
        };
      }
      const r = fitsFlex(received);
      return {
        pass: r.ok,
        message: () =>
          r.ok ? 'flex layout fits' : `flex layout failed:\n  ${r.reasons.join('\n  ')}`,
      };
    },

    toFitBlock(received: unknown) {
      if (!isBlockSpec(received)) {
        return {
          pass: false,
          message: () =>
            'toFitBlock expected an object with { container, children: [...] }.',
        };
      }
      const r = fitsBlock(received);
      return {
        pass: r.ok,
        message: () =>
          r.ok ? 'block layout fits' : `block layout failed:\n  ${r.reasons.join('\n  ')}`,
      };
    },

    toFitAspect(received: unknown) {
      if (!isAspectSpec(received)) {
        return {
          pass: false,
          message: () =>
            'toFitAspect expected an object with { intrinsic, slot, fit?, ... }.',
        };
      }
      const r = fitsAspect(received);
      return {
        pass: r.ok,
        message: () =>
          r.ok ? 'aspect layout fits' : `aspect layout failed:\n  ${r.reasons.join('\n  ')}`,
      };
    },
  });
}
