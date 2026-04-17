import '../src/index.js';
import { describe, expect, test } from 'vitest';

describe('toLayout matcher', () => {
  test('passes when text fits', () => {
    expect({
      text: { en: 'Save' },
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
    }).toLayout({ maxLines: 1, noOverflow: true });
  });

  test('fails with a readable message when text overflows', () => {
    expect(() => {
      expect({
        text: { de: 'Rechtsschutzversicherungsgesellschaften' },
        font: '16px sans-serif',
        maxWidth: 100,
        lineHeight: 20,
      }).toLayout({ singleLine: true });
    }).toThrow(/failure/i);
  });

  test('sweeps across scales via atScales', () => {
    expect(() => {
      expect({
        text: { en: 'Speichern Sie' },
        font: '16px sans-serif',
        maxWidth: 80,
        lineHeight: 20,
      }).toLayout({ maxLines: 1, atScales: [1, 1.5, 2] });
    }).toThrow();
  });

  test('narrows matrix via atLanguages', () => {
    expect({
      text: { en: 'Save', de: 'Speichern', ja: 'long string 長' },
      font: '16px sans-serif',
      maxWidth: 300,
      lineHeight: 20,
    }).toLayout({ maxLines: 1, atLanguages: ['en', 'de'] });
  });

  test('rejects malformed receiver', () => {
    expect(() => {
      // @ts-expect-error — intentionally broken
      expect(42).toLayout({ maxLines: 1 });
    }).toThrow(/toLayout expected/);
  });
});
