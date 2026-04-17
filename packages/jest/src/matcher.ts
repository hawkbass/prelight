/**
 * Jest matcher implementation. Mirrors @prelight/vitest/src/matcher.ts.
 *
 * PRELIGHT-INVARIANT: behaviour and error messages must match the Vitest
 * adapter exactly. A test rewritten between the two runners should produce
 * byte-identical `message()` output.
 */

import {
  formatReport,
  verify,
  type Constraints,
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

interface JestExpect {
  extend(matchers: Record<string, unknown>): void;
}

/**
 * Registers the matcher. Accepts an optional `expect` reference for
 * environments where the global `expect` is not yet assigned at import time
 * (Jest setup files, for example).
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
  });
}
