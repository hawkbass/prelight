/**
 * The v0.3 H7 runtime-probe demo, driven by vitest.
 *
 * Three tests, mirroring `demos/failing-german-button/Button.test.tsx`:
 *   1. "Save" fits everywhere — passes.
 *   2. "Confirm" fits everywhere — passes.
 *   3. The 39-character German insurance compound — fails, with a
 *      diagnostic that cites the language and the overflow.
 *
 * Every call uses `verifyComponent({ runtime: true })`. The spec
 * declares no `font` / `maxWidth` / `lineHeight` — the runtime probe
 * recovers them from `getComputedStyle()` after emotion has injected
 * its stylesheet. This is the whole point of H7: the consumer
 * writes the component normally and Prelight discovers the
 * typography from the same DOM the browser would.
 */

import '@prelight/vitest';
import React from 'react';
import { describe, expect, test } from 'vitest';

import { verifyComponent } from '@prelight/react';

import { SaveButton } from './SaveButton.js';
import { LANGS, labels } from './labels.js';

describe('SaveButton (emotion-styled), at every language we ship', () => {
  test('"Save" fits at every language — runtime probe reads emotion styles', async () => {
    const result = await verifyComponent({
      element: (lang) => <SaveButton label={labels[lang as keyof typeof labels].save} />,
      runtime: true,
      languages: LANGS,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(true);
  });

  test('"Confirm" fits at every language', async () => {
    const result = await verifyComponent({
      element: (lang) => <SaveButton label={labels[lang as keyof typeof labels].confirm} />,
      runtime: true,
      languages: LANGS,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(true);
  });

  test('"Get coverage" fits at every language — FAILS in German', async () => {
    const result = await verifyComponent({
      element: (lang) => <SaveButton label={labels[lang as keyof typeof labels].newPolicy} />,
      runtime: true,
      languages: LANGS,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const german = result.failures.find((f) => f.cell.language === 'de');
      expect(german).toBeDefined();
      expect(german!.message).toMatch(/overflow|wraps/i);
    }
  });
});
