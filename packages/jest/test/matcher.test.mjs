/**
 * Integration test for @prelight/jest.
 *
 * Imports from ../dist/ — so it exercises the shipped bundle, not the
 * TypeScript source. Run order:
 *
 *   bun run build
 *   bun run test
 *
 * The matcher is registered as a side effect of importing the package.
 */
import '../dist/index.js';

describe('toLayout matcher (Jest adapter)', () => {
  test('passes when text fits within maxWidth at singleLine', () => {
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
      expect(42).toLayout({ maxLines: 1 });
    }).toThrow(/toLayout expected/);
  });
});
