import { describe, expect, test } from 'vitest';

import type { PrelightTest } from '../src/config.js';
import { jsonReport, terminalReporter } from '../src/reporter.js';
import type { RunnerSummary } from '../src/runner.js';

function mkTest(name: string): PrelightTest {
  return {
    name,
    element: () => null as unknown as never,
    font: '16px sans-serif',
    maxWidth: 100,
    lineHeight: 20,
    constraints: { maxLines: 1 },
  };
}

describe('terminalReporter.testLine', () => {
  test('formats a passing test', () => {
    const line = terminalReporter.testLine({
      test: mkTest('Save'),
      result: { ok: true, cellsChecked: 3 },
    });
    expect(line).toBe('  [PASS] Save  (3 cells)');
  });

  test('formats a single-failure test with a short reason', () => {
    const line = terminalReporter.testLine({
      test: mkTest('Save'),
      result: {
        ok: false,
        cellsChecked: 3,
        failures: [
          {
            cell: { language: 'de', scale: 1, width: 120 },
            constraint: 'noOverflow',
            message: 'overflow',
            actual: 140,
            expected: 120,
          },
        ],
      },
    });
    expect(line.startsWith('  [FAIL] Save  (3 cells)')).toBe(true);
    expect(line.split('\n').length).toBe(2);
  });

  test('caps long failure lists with an ellipsis line', () => {
    const failures = Array.from({ length: 8 }, (_, i) => ({
      cell: { language: 'de', scale: 1 + i * 0.1, width: 100 },
      constraint: 'noOverflow' as const,
      message: 'overflow',
      actual: 100 + i,
      expected: 100,
    }));
    const line = terminalReporter.testLine({
      test: mkTest('Many'),
      result: { ok: false, cellsChecked: 8, failures },
    });
    expect(line).toMatch(/… 3 more failure\(s\)/);
  });
});

describe('terminalReporter.summary', () => {
  test('green summary when all tests pass', () => {
    const s: RunnerSummary = {
      ok: true,
      testsTotal: 2,
      testsFailed: 0,
      cellsChecked: 6,
      elapsedMs: 12.34,
      runs: [
        { test: mkTest('A'), result: { ok: true, cellsChecked: 3 } },
        { test: mkTest('B'), result: { ok: true, cellsChecked: 3 } },
      ],
    };
    const out = terminalReporter.summary(s);
    expect(out.startsWith('Prelight: 2 tests passed')).toBe(true);
    expect(out).toContain('[PASS] A');
    expect(out).toContain('[PASS] B');
  });

  test('red summary reports failed count', () => {
    const s: RunnerSummary = {
      ok: false,
      testsTotal: 2,
      testsFailed: 1,
      cellsChecked: 6,
      elapsedMs: 8,
      runs: [
        { test: mkTest('A'), result: { ok: true, cellsChecked: 3 } },
        {
          test: mkTest('B'),
          result: {
            ok: false,
            cellsChecked: 3,
            failures: [
              {
                cell: { language: 'en', scale: 1, width: 100 },
                constraint: 'maxLines',
                message: 'too many lines',
                actual: 2,
                expected: 1,
              },
            ],
          },
        },
      ],
    };
    const out = terminalReporter.summary(s);
    expect(out.startsWith('Prelight: 1 of 2 tests failed')).toBe(true);
  });
});

describe('jsonReport', () => {
  test('serializes a passing summary with empty failures', () => {
    const s: RunnerSummary = {
      ok: true,
      testsTotal: 1,
      testsFailed: 0,
      cellsChecked: 3,
      elapsedMs: 5,
      runs: [{ test: mkTest('A'), result: { ok: true, cellsChecked: 3 } }],
    };
    const r = jsonReport(s);
    expect(r.ok).toBe(true);
    expect(r.tests).toHaveLength(1);
    expect(r.tests[0]!.failures).toEqual([]);
  });

  test('serializes failures with cell metadata flattened', () => {
    const s: RunnerSummary = {
      ok: false,
      testsTotal: 1,
      testsFailed: 1,
      cellsChecked: 1,
      elapsedMs: 5,
      runs: [
        {
          test: mkTest('A'),
          result: {
            ok: false,
            cellsChecked: 1,
            failures: [
              {
                cell: { language: 'ja', scale: 1.5, width: 120 },
                constraint: 'noOverflow',
                message: 'overflow by 14px',
                actual: 134,
                expected: 120,
              },
            ],
          },
        },
      ],
    };
    const r = jsonReport(s);
    expect(r.tests[0]!.failures[0]).toEqual({
      constraint: 'noOverflow',
      language: 'ja',
      scale: 1.5,
      width: 120,
      message: 'overflow by 14px',
      actual: 134,
      expected: 120,
    });
  });
});
