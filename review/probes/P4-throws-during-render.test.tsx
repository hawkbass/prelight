/**
 * Probe P4 — what happens when a component throws during render?
 *
 * Documents: does the probe crash, leak happy-dom state, or report a
 * usable error? We exercise:
 *   (a) a synchronous throw from the root component
 *   (b) a throw from a nested child
 *   (c) verify the probe is reusable afterwards (state leak detection)
 */

import React from 'react';
import { describe, expect, it, beforeAll } from 'vitest';
import { resolveStylesRuntime, verifyComponent } from '@prelight/react';

function ThrowingButton(): React.ReactElement {
  throw new Error('P4: boom during render');
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 120, font: '16px sans-serif', lineHeight: '20px' }}>{children}</div>
  );
}

describe('P4 — component throws during render', () => {
  beforeAll(async () => {
    const { ensureCanvasEnv } = await import('@prelight/core');
    await ensureCanvasEnv();
  });

  it('resolveStylesRuntime behaviour when root throws', async () => {
    let err: unknown = null;
    let resolved: unknown = null;
    try {
      resolved = await resolveStylesRuntime(<ThrowingButton />);
    } catch (e) {
      err = e;
    }
    console.log('[P4a] err:', err === null ? 'none' : String(err));
    console.log('[P4a] resolved:', JSON.stringify(resolved, null, 2));
    // Document actual behaviour — do NOT assert a specific shape.
  });

  it('resolveStylesRuntime behaviour when nested child throws', async () => {
    let err: unknown = null;
    let resolved: unknown = null;
    try {
      resolved = await resolveStylesRuntime(
        <Wrapper>
          <ThrowingButton />
        </Wrapper>,
      );
    } catch (e) {
      err = e;
    }
    console.log('[P4b] err:', err === null ? 'none' : String(err));
    console.log('[P4b] resolved:', JSON.stringify(resolved, null, 2));
  });

  it('probe still works on a valid component AFTER a throw (state-leak check)', async () => {
    try {
      await resolveStylesRuntime(<ThrowingButton />);
    } catch {
      // Expected or swallowed — we just want the restore path exercised.
    }
    const ok = await resolveStylesRuntime(
      <Wrapper>
        <button>Save</button>
      </Wrapper>,
    );
    console.log('[P4c] post-throw resolution:', JSON.stringify(ok, null, 2));
    expect(ok.maxWidth).toBe(120);
    expect(ok.lineHeight).toBe(20);
  });

  it('verifyComponent on a throwing component', async () => {
    let err: unknown = null;
    let result: unknown = null;
    try {
      result = await verifyComponent({
        element: () => <ThrowingButton />,
        languages: ['en'],
        font: '16px sans-serif',
        maxWidth: 120,
        lineHeight: 20,
        constraints: { maxLines: 1 },
        runtime: true,
      });
    } catch (e) {
      err = e;
    }
    console.log('[P4d] verifyComponent err:', err === null ? 'none' : String(err));
    console.log('[P4d] verifyComponent result:', JSON.stringify(result, null, 2));
  });
});
