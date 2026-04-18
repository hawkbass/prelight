/**
 * Probe P5 — what does the probe do with React Suspense?
 *
 * A component suspends on a pending promise. Does the probe:
 *   (a) await the promise and measure the resolved content,
 *   (b) time out, or
 *   (c) silently measure the Suspense fallback?
 */

import React, { Suspense } from 'react';
import { describe, expect, it, beforeAll } from 'vitest';
import { resolveStylesRuntime } from '@prelight/react';

/**
 * A lazy resource that suspends indefinitely (for the duration of the
 * test) unless `resolveNow()` is called. We intentionally never
 * resolve it — we want to observe what the probe does with a
 * never-settling Suspense boundary.
 */
function makePendingResource(): () => string {
  let resolved = false;
  const promise = new Promise<void>(() => {
    // never resolves
  });
  return () => {
    if (!resolved) throw promise;
    return 'RESOLVED';
  };
}

const pendingRead = makePendingResource();

function LazyLabel() {
  const value = pendingRead();
  return <span>{value}</span>;
}

function FallbackLabel() {
  // Deliberately different typography so we can tell which one
  // getComputedStyle picks up.
  return <span style={{ width: 60, font: '12px monospace', lineHeight: '14px' }}>Loading…</span>;
}

describe('P5 — Suspense with a pending promise', () => {
  beforeAll(async () => {
    const { ensureCanvasEnv } = await import('@prelight/core');
    await ensureCanvasEnv();
  });

  it('documents what resolveStylesRuntime sees for a suspended subtree', async () => {
    const start = Date.now();
    let err: unknown = null;
    let resolved: unknown = null;
    try {
      resolved = await Promise.race([
        resolveStylesRuntime(
          <div style={{ width: 240, font: '16px sans-serif', lineHeight: '20px' }}>
            <Suspense fallback={<FallbackLabel />}>
              <LazyLabel />
            </Suspense>
          </div>,
        ),
        new Promise((_res, rej) => setTimeout(() => rej(new Error('P5 timeout 6s')), 6000)),
      ]);
    } catch (e) {
      err = e;
    }
    const ms = Date.now() - start;
    console.log(`[P5] elapsed ${ms}ms`);
    console.log('[P5] err:', err === null ? 'none' : String(err));
    console.log('[P5] resolved:', JSON.stringify(resolved, null, 2));
    // Document observed behaviour; no assertion on shape, we want to
    // see which path the code actually took.
    expect(ms).toBeLessThan(8000);
  });
});
