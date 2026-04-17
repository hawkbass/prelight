/**
 * Terminal reporter. Presentation-only. No color detection in v0.1 —
 * PRELIGHT-NEXT(v0.2) will add TTY-aware coloring.
 */

import { formatFailureShort } from '@prelight/core';

import type { RunnerSummary, TestRunResult } from './runner.js';

export interface Reporter {
  summary(s: RunnerSummary): string;
  testLine(run: TestRunResult): string;
}

export const terminalReporter: Reporter = {
  testLine(run) {
    const { test, result } = run;
    const prefix = result.ok ? 'PASS' : 'FAIL';
    const cells = `${result.cellsChecked} cells`;
    const base = `  [${prefix}] ${test.name}  (${cells})`;
    if (result.ok) return base;
    const details = result.failures
      .slice(0, 5)
      .map((f) => `      · ${formatFailureShort(f)}`)
      .join('\n');
    const trailing =
      result.failures.length > 5
        ? `\n      … ${result.failures.length - 5} more failure(s)`
        : '';
    return `${base}\n${details}${trailing}`;
  },

  summary(s) {
    const header = s.ok
      ? `Prelight: ${s.testsTotal} test${s.testsTotal === 1 ? '' : 's'} passed (${s.cellsChecked} cells in ${s.elapsedMs.toFixed(0)}ms)`
      : `Prelight: ${s.testsFailed} of ${s.testsTotal} tests failed (${s.cellsChecked} cells in ${s.elapsedMs.toFixed(0)}ms)`;
    const lines: string[] = [header, ''];
    for (const run of s.runs) {
      lines.push(this.testLine(run));
    }
    return lines.join('\n');
  },
};

export interface JsonReportTestEntry {
  name: string;
  ok: boolean;
  cellsChecked: number;
  failures: Array<{
    constraint: string;
    language: string;
    scale: number;
    width: number;
    message: string;
    actual: unknown;
    expected: unknown;
  }>;
}

export interface JsonReport {
  ok: boolean;
  testsTotal: number;
  testsFailed: number;
  cellsChecked: number;
  elapsedMs: number;
  tests: JsonReportTestEntry[];
}

export function jsonReport(s: RunnerSummary): JsonReport {
  return {
    ok: s.ok,
    testsTotal: s.testsTotal,
    testsFailed: s.testsFailed,
    cellsChecked: s.cellsChecked,
    elapsedMs: s.elapsedMs,
    tests: s.runs.map((run) => ({
      name: run.test.name,
      ok: run.result.ok,
      cellsChecked: run.result.cellsChecked,
      failures: run.result.ok
        ? []
        : run.result.failures.map((f) => ({
            constraint: f.constraint,
            language: f.cell.language,
            scale: f.cell.scale,
            width: f.cell.width,
            message: f.message,
            actual: f.actual,
            expected: f.expected,
          })),
    })),
  };
}
