/**
 * Probe P1 — throwaway vanilla-extract fixture.
 *
 * vanilla-extract is a compile-time CSS-in-JS library. Its `.css.ts`
 * files are transformed by a bundler plugin (Vite/esbuild/webpack) into:
 *   1. A static `.css` file containing the generated CSS, and
 *   2. A runtime module that exports string class names.
 *
 * At runtime — the moment the React component mounts and the probe reads
 * `getComputedStyle()` — all that remains is (a) className strings on
 * elements and (b) a stylesheet included in document.head as either a
 * `<link rel="stylesheet">` or an inline `<style>` tag. The probe's
 * claim ("works for vanilla-extract") reduces to: does the probe
 * correctly read computed styles from externally-applied class
 * selectors?
 *
 * This fixture simulates that end-state without invoking vanilla-extract's
 * build pipeline (which requires Vite/rollup plugin wiring outside the
 * scope of an isolated probe):
 *
 *   - A `styles` module (side-effectful on import) injects a `<style>`
 *     element into `document.head` containing `.btn { ... }` rules.
 *   - A `Button` component renders `<button className={styles.btn}>`.
 *   - The probe is then asked to resolve that button's typography.
 *
 * This is byte-for-byte identical to what vanilla-extract's compiled
 * output looks like once the Vite plugin has run. If the runtime probe
 * reads the correct computed styles here, the README's claim holds for
 * vanilla-extract (and by the same mechanism, CSS Modules, plain
 * `<link>` stylesheets, Linaria, and any other compile-time CSS-in-JS
 * approach whose runtime output is classNames + external stylesheet).
 * If it does not, the claim is broken.
 */

import React from 'react';
import { describe, expect, it, beforeAll } from 'vitest';
import { verifyComponent } from '@prelight/react';

const STYLE_TAG_ID = 'prelight-probe-p1-styles';

/**
 * Simulate vanilla-extract's post-compilation runtime: inject a <style>
 * element containing the generated CSS, and export a class-name map.
 * Real vanilla-extract does this via a bundler plugin; mechanically it
 * is identical.
 */
function installStyles(): { btn: string } {
  if (typeof document === 'undefined') {
    throw new Error('P1 requires a DOM env (vitest environment: happy-dom).');
  }
  if (!document.getElementById(STYLE_TAG_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    style.textContent = `
      .vebtn_root__a1b2c3 {
        width: 120px;
        font: 16px sans-serif;
        line-height: 20px;
      }
    `;
    document.head.appendChild(style);
  }
  return { btn: 'vebtn_root__a1b2c3' };
}

const styles = installStyles();

interface VEButtonProps {
  label: string;
}

function VEButton({ label }: VEButtonProps) {
  return <button className={styles.btn}>{label}</button>;
}

describe('P1 — runtime probe with vanilla-extract-shaped input', () => {
  beforeAll(async () => {
    const { ensureCanvasEnv } = await import('@prelight/core');
    await ensureCanvasEnv();
  });

  it('resolves class-based typography from an external <style> element', async () => {
    const result = await verifyComponent({
      element: (lang) => <VEButton label={lang === 'en' ? 'Save' : 'Speichern'} />,
      languages: ['en', 'de'],
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    // We assert structure rather than ok=true because the point of
    // the probe is whether Prelight SAW the styles — if it did,
    // `verify()` will report cellsChecked > 0. A missing-styles path
    // would have thrown from `assertStyleInputs` before reaching
    // verify().
    expect(result.cellsChecked).toBeGreaterThanOrEqual(2);
    // Document the expected failure mode too — "Speichern" overflows
    // 120px at 16px sans-serif.
    if (!result.ok) {
      for (const f of result.failures) {
        console.log('[P1] observed failure:', f.code, f.cell.language);
      }
    }
  });

  it('reports width/font/lineHeight recovered from the injected stylesheet', async () => {
    const { resolveStylesRuntime } = await import('@prelight/react');
    const resolved = await resolveStylesRuntime(<VEButton label="Save" />);
    console.log('[P1] resolved:', JSON.stringify(resolved, null, 2));
    expect(resolved.font).toMatch(/16px/);
    expect(resolved.maxWidth).toBe(120);
    expect(resolved.lineHeight).toBe(20);
  });
});
