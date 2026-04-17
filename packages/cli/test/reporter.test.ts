import { describe, expect, test } from 'vitest';

import { basicPalette, plainPalette } from '../src/color.js';
import type { PrelightTest } from '../src/config.js';
import { createTerminalReporter, jsonReport, terminalReporter } from '../src/reporter.js';
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

function mkSummary(partial: Partial<RunnerSummary>): RunnerSummary {
  return {
    ok: true,
    testsTotal: 0,
    testsFailed: 0,
    cellsChecked: 0,
    elapsedMs: 0,
    runs: [],
    layoutsTotal: 0,
    layoutsFailed: 0,
    layoutRuns: [],
    ...partial,
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
    const s = mkSummary({
      ok: true,
      testsTotal: 2,
      testsFailed: 0,
      cellsChecked: 6,
      elapsedMs: 12.34,
      runs: [
        { test: mkTest('A'), result: { ok: true, cellsChecked: 3 } },
        { test: mkTest('B'), result: { ok: true, cellsChecked: 3 } },
      ],
    });
    const out = terminalReporter.summary(s);
    expect(out.startsWith('Prelight: 2 tests passed')).toBe(true);
    expect(out).toContain('[PASS] A');
    expect(out).toContain('[PASS] B');
  });

  test('red summary reports failed count', () => {
    const s = mkSummary({
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
    });
    const out = terminalReporter.summary(s);
    expect(out.startsWith('Prelight: 1 of 2 tests failed')).toBe(true);
  });

  test('renders layout runs alongside text tests', () => {
    const s = mkSummary({
      ok: true,
      testsTotal: 1,
      cellsChecked: 3,
      elapsedMs: 4,
      runs: [{ test: mkTest('A'), result: { ok: true, cellsChecked: 3 } }],
      layoutsTotal: 1,
      layoutRuns: [
        {
          test: { name: 'Nav', kind: 'flex', spec: {} as never },
          kind: 'flex',
          result: { ok: true, reasons: [], layout: {} as never },
        },
      ],
    });
    const out = terminalReporter.summary(s);
    expect(out).toContain('[PASS] A');
    expect(out).toContain('[PASS] Nav  (flex)');
    expect(out).toContain('Prelight: 2 tests passed');
  });

  test('default terminalReporter never emits ANSI escapes', () => {
    const s = mkSummary({
      ok: false,
      testsTotal: 1,
      testsFailed: 1,
      runs: [
        {
          test: mkTest('A'),
          result: {
            ok: false,
            cellsChecked: 1,
            failures: [
              {
                cell: { language: 'en', scale: 1, width: 40 },
                constraint: 'noOverflow',
                message: 'overflows',
                actual: 80,
                expected: 40,
              },
            ],
          },
        },
      ],
    });
    const out = terminalReporter.summary(s);
    expect(out).not.toContain('\u001b[');
  });

  test('colourful reporter wraps PASS/FAIL in ANSI when basicPalette is chosen', () => {
    const r = createTerminalReporter(basicPalette);
    const s = mkSummary({
      ok: true,
      testsTotal: 1,
      runs: [{ test: mkTest('A'), result: { ok: true, cellsChecked: 3 } }],
    });
    const out = r.summary(s);
    expect(out).toContain('\u001b[32m'); // green for PASS
    expect(out).toContain('\u001b[0m'); // reset
  });

  test('explicit plainPalette produces byte-identical output to default reporter', () => {
    const plain = createTerminalReporter(plainPalette);
    const s = mkSummary({
      ok: true,
      testsTotal: 1,
      runs: [{ test: mkTest('A'), result: { ok: true, cellsChecked: 3 } }],
      elapsedMs: 5,
      cellsChecked: 3,
    });
    expect(plain.summary(s)).toBe(terminalReporter.summary(s));
  });

  test('reports failed layout reasons', () => {
    const s = mkSummary({
      ok: false,
      layoutsTotal: 1,
      layoutsFailed: 1,
      layoutRuns: [
        {
          test: { name: 'Hero', kind: 'aspect', spec: {} as never },
          kind: 'aspect',
          result: {
            ok: false,
            reasons: ['letterbox exceeds maxLetterboxPx (y=120 > 40)'],
            layout: {} as never,
          },
        },
      ],
    });
    const out = terminalReporter.summary(s);
    expect(out).toContain('[FAIL] Hero  (aspect)');
    expect(out).toContain('letterbox exceeds');
  });
});

describe('jsonReport', () => {
  test('serializes a passing summary with empty failures', () => {
    const s = mkSummary({
      ok: true,
      testsTotal: 1,
      testsFailed: 0,
      cellsChecked: 3,
      elapsedMs: 5,
      runs: [{ test: mkTest('A'), result: { ok: true, cellsChecked: 3 } }],
    });
    const r = jsonReport(s);
    expect(r.ok).toBe(true);
    expect(r.tests).toHaveLength(1);
    expect(r.tests[0]!.failures).toEqual([]);
  });

  test('serializes failures with cell metadata flattened', () => {
    const s = mkSummary({
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
    });
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
