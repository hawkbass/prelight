import '@prelight/vitest';
import React from 'react';
import { describe, expect, test } from 'vitest';

import { verifyComponent } from '@prelight/react';

import { BUTTON_FONT, BUTTON_LINE_HEIGHT, BUTTON_WIDTH, Button } from './Button.js';
import { LANGS, labels } from './labels.js';

describe('Button, at every language we ship', () => {
  test('"Save" fits at every language', () => {
    const result = verifyComponent({
      element: (lang) => <Button label={labels[lang as keyof typeof labels].save} />,
      languages: LANGS,
      font: BUTTON_FONT,
      maxWidth: BUTTON_WIDTH,
      lineHeight: BUTTON_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(true);
  });

  test('"Confirm" fits at every language', () => {
    const result = verifyComponent({
      element: (lang) => <Button label={labels[lang as keyof typeof labels].confirm} />,
      languages: LANGS,
      font: BUTTON_FONT,
      maxWidth: BUTTON_WIDTH,
      lineHeight: BUTTON_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(true);
  });

  // This one fails in German. The whole point of this demo is watching the
  // failure message. Mark skip/fail to your taste when wiring to CI.
  test('"Get coverage" fits at every language — FAILS in German', () => {
    const result = verifyComponent({
      element: (lang) => <Button label={labels[lang as keyof typeof labels].newPolicy} />,
      languages: LANGS,
      font: BUTTON_FONT,
      maxWidth: BUTTON_WIDTH,
      lineHeight: BUTTON_LINE_HEIGHT,
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
