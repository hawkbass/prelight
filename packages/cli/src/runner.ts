/**
 * Runs every test declared in the config. Calls the React adapter's
 * `verifyComponent` for text-layout tests and the core predicates for
 * structural (flex/block/aspect) layout tests. Aggregates results.
 */

import {
  ensureCanvasEnv,
  fitsAspect,
  fitsBlock,
  fitsFlex,
  type FitsAspectResult,
  type FitsBlockResult,
  type FitsFlexResult,
  type VerifyResult,
} from '@prelight/core';
import { verifyComponent } from '@prelight/react';

import type { PrelightConfig, PrelightLayoutTest, PrelightTest } from './config.js';

export interface TestRunResult {
  test: PrelightTest;
  result: VerifyResult;
}

/**
 * Result of a single structural layout test. The `kind` tag mirrors
 * the config entry so the reporter can branch on it without checking
 * shape.
 */
export type LayoutRunResult =
  | { test: PrelightLayoutTest; kind: 'flex'; result: FitsFlexResult }
  | { test: PrelightLayoutTest; kind: 'block'; result: FitsBlockResult }
  | { test: PrelightLayoutTest; kind: 'aspect'; result: FitsAspectResult };

export interface RunnerSummary {
  ok: boolean;
  testsTotal: number;
  testsFailed: number;
  cellsChecked: number;
  runs: TestRunResult[];
  /** v0.2: structural layout predicate runs. */
  layoutsTotal: number;
  layoutsFailed: number;
  layoutRuns: LayoutRunResult[];
  elapsedMs: number;
}

export async function runVerification(config: PrelightConfig): Promise<RunnerSummary> {
  await ensureCanvasEnv();

  const start = performance.now();
  const runs: TestRunResult[] = [];
  const layoutRuns: LayoutRunResult[] = [];
  let cellsChecked = 0;
  let testsFailed = 0;
  let layoutsFailed = 0;

  const tests = config.tests ?? [];
  const layouts = config.layouts ?? [];

  for (const test of tests) {
    const result = verifyComponent(test);
    runs.push({ test, result });
    cellsChecked += result.cellsChecked;
    if (!result.ok) {
      testsFailed++;
      if (config.failFast) {
        return finalise({
          start,
          runs,
          layoutRuns,
          cellsChecked,
          testsFailed,
          layoutsFailed,
          testsTotal: tests.length,
          layoutsTotal: layouts.length,
        });
      }
    }
  }

  for (const layout of layouts) {
    const run = runLayout(layout);
    layoutRuns.push(run);
    if (!run.result.ok) {
      layoutsFailed++;
      if (config.failFast) {
        return finalise({
          start,
          runs,
          layoutRuns,
          cellsChecked,
          testsFailed,
          layoutsFailed,
          testsTotal: tests.length,
          layoutsTotal: layouts.length,
        });
      }
    }
  }

  return finalise({
    start,
    runs,
    layoutRuns,
    cellsChecked,
    testsFailed,
    layoutsFailed,
    testsTotal: tests.length,
    layoutsTotal: layouts.length,
  });
}

function runLayout(test: PrelightLayoutTest): LayoutRunResult {
  switch (test.kind) {
    case 'flex':
      return { test, kind: 'flex', result: fitsFlex(test.spec) };
    case 'block':
      return { test, kind: 'block', result: fitsBlock(test.spec) };
    case 'aspect':
      return { test, kind: 'aspect', result: fitsAspect(test.spec) };
  }
}

interface FinaliseInput {
  start: number;
  runs: TestRunResult[];
  layoutRuns: LayoutRunResult[];
  cellsChecked: number;
  testsFailed: number;
  layoutsFailed: number;
  testsTotal: number;
  layoutsTotal: number;
}

function finalise(x: FinaliseInput): RunnerSummary {
  return {
    ok: x.testsFailed === 0 && x.layoutsFailed === 0,
    testsTotal: x.testsTotal,
    testsFailed: x.testsFailed,
    cellsChecked: x.cellsChecked,
    runs: x.runs,
    layoutsTotal: x.layoutsTotal,
    layoutsFailed: x.layoutsFailed,
    layoutRuns: x.layoutRuns,
    elapsedMs: performance.now() - x.start,
  };
}
