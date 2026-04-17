import { describe, expect, test } from 'vitest';

import {
  linesExact,
  maxLines,
  minLines,
  noOverflow,
  noTruncation,
  singleLine,
} from '../src/predicates.js';
import type { Measurement } from '../src/types.js';

function m(partial: Partial<Measurement> & { lines: number; overflows: boolean }): Measurement {
  const cellWidth = 120;
  return {
    cell: { language: 'en', scale: 1, width: cellWidth },
    lines: partial.lines,
    measuredWidth: partial.measuredWidth ?? 100,
    measuredHeight: partial.measuredHeight ?? 20,
    naturalWidth: partial.naturalWidth ?? (partial.overflows ? cellWidth + 40 : 100),
    overflows: partial.overflows,
  };
}

describe('noOverflow', () => {
  test('passes when not overflowing', () => {
    expect(noOverflow(m({ lines: 1, overflows: false }), { noOverflow: true })).toBeNull();
  });
  test('fails when overflowing', () => {
    const f = noOverflow(m({ lines: 2, overflows: true, naturalWidth: 180 }), { noOverflow: true });
    expect(f).not.toBeNull();
    expect(f!.constraint).toBe('noOverflow');
    expect(f!.message).toMatch(/overflow/i);
    expect(f!.message).toMatch(/60\.0px over/);
  });
  test('skipped when not enabled', () => {
    expect(noOverflow(m({ lines: 1, overflows: true }), {})).toBeNull();
  });
});

describe('maxLines', () => {
  test('passes at limit', () => {
    expect(maxLines(m({ lines: 2, overflows: false }), { maxLines: 2 })).toBeNull();
  });
  test('fails over limit', () => {
    const f = maxLines(m({ lines: 3, overflows: false }), { maxLines: 2 });
    expect(f!.actual).toBe(3);
    expect(f!.expected).toBe('<= 2');
  });
});

describe('minLines', () => {
  test('fails under limit', () => {
    const f = minLines(m({ lines: 1, overflows: false }), { minLines: 2 });
    expect(f!.actual).toBe(1);
  });
  test('passes at/over limit', () => {
    expect(minLines(m({ lines: 2, overflows: false }), { minLines: 2 })).toBeNull();
    expect(minLines(m({ lines: 3, overflows: false }), { minLines: 2 })).toBeNull();
  });
});

describe('singleLine', () => {
  test('passes on one line, not overflowing', () => {
    expect(singleLine(m({ lines: 1, overflows: false }), { singleLine: true })).toBeNull();
  });
  test('fails if wrapped to 2 lines', () => {
    const f = singleLine(m({ lines: 2, overflows: false }), { singleLine: true });
    expect(f!.message).toMatch(/wraps to 2 lines/);
  });
  test('fails if single line but overflows (nowrap truncation case)', () => {
    const f = singleLine(m({ lines: 1, overflows: true, measuredWidth: 160 }), {
      singleLine: true,
    });
    expect(f!.message).toMatch(/truncated|exceeds/);
  });
});

describe('noTruncation', () => {
  test('passes when not overflowing', () => {
    expect(noTruncation(m({ lines: 1, overflows: false }), { noTruncation: true })).toBeNull();
  });
  test('fails when overflowing', () => {
    const f = noTruncation(m({ lines: 1, overflows: true, measuredWidth: 150 }), {
      noTruncation: true,
    });
    expect(f!.constraint).toBe('noTruncation');
  });
});

describe('linesExact', () => {
  test('passes at match', () => {
    expect(linesExact(m({ lines: 2, overflows: false }), { lines: 2 })).toBeNull();
  });
  test('fails at mismatch', () => {
    const f = linesExact(m({ lines: 3, overflows: false }), { lines: 2 });
    expect(f!.actual).toBe(3);
    expect(f!.expected).toBe(2);
  });
});
