/**
 * Terminal reporter. Presentation-only.
 *
 * TTY-aware colouring via @prelight/cli/color — respects NO_COLOR
 * and FORCE_COLOR per https://no-color.org/, and never emits
 * escape sequences when the destination isn't a TTY. No runtime
 * dependencies — one file, ANSI basics only.
 */

import { formatFailureShort } from '@prelight/core';

import { plainPalette, type Palette } from './color.js';
import type { LayoutRunResult, RunnerSummary, TestRunResult } from './runner.js';

export interface Reporter {
  summary(s: RunnerSummary): string;
  testLine(run: TestRunResult): string;
  layoutLine(run: LayoutRunResult): string;
}

/**
 * Build a reporter bound to a specific palette. `createTerminalReporter()`
 * is exported so tests can inject a stub palette without touching
 * `process.env` or `process.stderr.isTTY`.
 */
export function createTerminalReporter(palette: Palette): Reporter {
  return {
    testLine(run) {
      const { test, result } = run;
      const tag = result.ok ? palette.pass('PASS') : palette.fail('FAIL');
      const name = palette.name(test.name);
      const cells = palette.dim(`(${result.cellsChecked} cells)`);
      const base = `  [${tag}] ${name}  ${cells}`;
      if (result.ok) return base;
      const details = result.failures
        .slice(0, 5)
        .map((f) => `      ${palette.dim('·')} ${formatFailureShort(f)}`)
        .join('\n');
      const trailing =
        result.failures.length > 5
          ? `\n      ${palette.dim(`… ${result.failures.length - 5} more failure(s)`)}`
          : '';
      return `${base}\n${details}${trailing}`;
    },

    layoutLine(run) {
      const { test, result } = run;
      const tag = result.ok ? palette.pass('PASS') : palette.fail('FAIL');
      const name = palette.name(test.name);
      const kind = palette.dim(`(${run.kind})`);
      const base = `  [${tag}] ${name}  ${kind}`;
      if (result.ok) return base;
      const details = result.reasons
        .slice(0, 5)
        .map((r) => `      ${palette.dim('·')} ${r}`)
        .join('\n');
      const trailing =
        result.reasons.length > 5
          ? `\n      ${palette.dim(`… ${result.reasons.length - 5} more reason(s)`)}`
          : '';
      return `${base}\n${details}${trailing}`;
    },

    summary(s) {
      const totalFailed = s.testsFailed + s.layoutsFailed;
      const totalRun = s.testsTotal + s.layoutsTotal;
      const elapsed = palette.dim(
        `(${s.cellsChecked} cells in ${s.elapsedMs.toFixed(0)}ms)`,
      );
      const header = s.ok
        ? palette.header(
            `Prelight: ${totalRun} test${totalRun === 1 ? '' : 's'} ${palette.pass('passed')}`,
          ) + ` ${elapsed}`
        : palette.header(
            `Prelight: ${palette.fail(`${totalFailed} of ${totalRun} tests failed`)}`,
          ) + ` ${elapsed}`;
      const lines: string[] = [header, ''];
      for (const run of s.runs) {
        lines.push(this.testLine(run));
      }
      if (s.layoutRuns.length > 0) {
        if (s.runs.length > 0) lines.push('');
        for (const run of s.layoutRuns) {
          lines.push(this.layoutLine(run));
        }
      }
      return lines.join('\n');
    },
  };
}

/**
 * Default plain-text reporter. Retained for backwards compatibility
 * with existing callers and tests. New callers should prefer
 * `createTerminalReporter(autoPalette(stream))` so NO_COLOR /
 * FORCE_COLOR are honoured automatically.
 */
export const terminalReporter: Reporter = createTerminalReporter(plainPalette);

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

export interface JsonReportLayoutEntry {
  name: string;
  kind: 'flex' | 'block' | 'aspect';
  ok: boolean;
  reasons: string[];
}

export interface JsonReport {
  ok: boolean;
  testsTotal: number;
  testsFailed: number;
  cellsChecked: number;
  elapsedMs: number;
  tests: JsonReportTestEntry[];
  layoutsTotal: number;
  layoutsFailed: number;
  layouts: JsonReportLayoutEntry[];
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
    layoutsTotal: s.layoutsTotal,
    layoutsFailed: s.layoutsFailed,
    layouts: s.layoutRuns.map((run) => ({
      name: run.test.name,
      kind: run.kind,
      ok: run.result.ok,
      reasons: run.result.ok ? [] : [...run.result.reasons],
    })),
  };
}
