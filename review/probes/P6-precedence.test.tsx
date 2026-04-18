/**
 * Probe P6 — runtime: true + explicit font/maxWidth/lineHeight.
 *
 * Two sources of typography:
 *   (1) the CSS the runtime probe reads from computed styles, and
 *   (2) the explicit `font` / `maxWidth` / `lineHeight` on the spec.
 *
 * Documented precedence (runtime-probe.ts, verify-component.ts,
 * CHANGELOG [0.3.0] H7): "Explicit `font` / `maxWidth` / `lineHeight`
 * overrides still win over the probed values."
 *
 * Question: is this empirically true, and is it true for each field
 * independently? Also: does the probe still mount React when all
 * three explicit values are provided (wasted work)?
 */

import React from 'react';
import { describe, expect, it, beforeAll } from 'vitest';
import { verifyComponent } from '@prelight/react';

/**
 * A styled div whose computed styles differ from every one of the
 * explicit numbers the spec will later supply. If precedence is
 * broken — either the probe values win, or only some of the
 * explicit values win — we'll see it in the result.
 */
function StyledBox({ text }: { text: string }) {
  return (
    <div
      style={{
        width: '300px',
        font: '24px monospace',
        lineHeight: '30px',
      }}
    >
      {text}
    </div>
  );
}

describe('P6 — precedence of explicit spec over runtime-probed values', () => {
  beforeAll(async () => {
    const { ensureCanvasEnv } = await import('@prelight/core');
    await ensureCanvasEnv();
  });

  it('explicit font/maxWidth/lineHeight override probed values', async () => {
    const result = await verifyComponent({
      element: () => <StyledBox text="Hello world" />,
      languages: ['en'],
      font: '10px serif',
      maxWidth: 1000,
      lineHeight: 12,
      constraints: { maxLines: 1 },
      runtime: true,
    });
    // `Hello world` at 10px/serif fits trivially in 1000px on 1 line.
    // If precedence broke and the probe's 24px/monospace/300px won,
    // the string MAY still fit depending on measurement, but this
    // asserts the call at least runs and the verifier is reached.
    console.log('[P6a] explicit-wins result:', JSON.stringify(result, null, 2));
    expect(result.cellsChecked).toBe(1);
    expect(result.ok).toBe(true);
  });

  it('only explicit maxWidth: probed font + lineHeight + explicit maxWidth', async () => {
    // Text that is long enough to overflow maxWidth=80 at 24px/monospace
    // (computed) but would fit comfortably at 10px.
    const result = await verifyComponent({
      element: () => <StyledBox text="AAAAAAAAAA" />,
      languages: ['en'],
      maxWidth: 80,
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    console.log('[P6b] partial-override result:', JSON.stringify(result, null, 2));
    expect(result.cellsChecked).toBe(1);
  });

  it('explicit font string "10px serif" is what flows to verify()', async () => {
    // Set maxWidth absurdly low, explicit font tiny, expect overflow
    // ONLY if probed font won.
    const result = await verifyComponent({
      element: () => <StyledBox text="Hi" />,
      languages: ['en'],
      font: '4px serif',
      maxWidth: 8,
      lineHeight: 6,
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    console.log('[P6c] tiny-font result:', JSON.stringify(result, null, 2));
    // "Hi" at 4px serif ~ 3-4px wide, fits in 8px. If probe's 24px
    // monospace won, the width would be ~30px, overflowing 8px.
    // We expect ok=true iff explicit font won.
    expect(result.ok).toBe(true);
  });
});
