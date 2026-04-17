/**
 * Runs every test declared in the config. Calls the React adapter's
 * `verifyComponent` for each. Aggregates results.
 */

import { ensureCanvasEnv, type VerifyResult } from '@prelight/core';
import { verifyComponent } from '@prelight/react';

import type { PrelightConfig, PrelightTest } from './config.js';

export interface TestRunResult {
  test: PrelightTest;
  result: VerifyResult;
}

export interface RunnerSummary {
  ok: boolean;
  testsTotal: number;
  testsFailed: number;
  cellsChecked: number;
  runs: TestRunResult[];
  elapsedMs: number;
}

export async function runVerification(config: PrelightConfig): Promise<RunnerSummary> {
  await ensureCanvasEnv();

  const start = performance.now();
  const runs: TestRunResult[] = [];
  let cellsChecked = 0;
  let testsFailed = 0;
  for (const test of config.tests) {
    const result = verifyComponent(test);
    runs.push({ test, result });
    cellsChecked += result.cellsChecked;
    if (!result.ok) {
      testsFailed++;
      if (config.failFast) break;
    }
  }
  const elapsedMs = performance.now() - start;
  return {
    ok: testsFailed === 0,
    testsTotal: config.tests.length,
    testsFailed,
    cellsChecked,
    runs,
    elapsedMs,
  };
}
