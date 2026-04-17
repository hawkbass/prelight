import { describe, expect, test } from 'vitest';

import { verify } from '../src/verify.js';
import { formatReport } from '../src/report.js';

describe('verify — end-to-end', () => {
  test('English "Save" fits at 120px, single line', () => {
    const r = verify({
      text: { en: 'Save' },
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cellsChecked).toBe(1);
  });

  test('German "Speichern" should still fit at 120px at scale 1', () => {
    const r = verify({
      text: { de: 'Speichern' },
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(r.ok).toBe(true);
  });

  test('long German compound word fails singleLine at 120px', () => {
    const r = verify({
      text: { de: 'Rechtsschutzversicherungsgesellschaften' },
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { singleLine: true },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures.length).toBeGreaterThan(0);
      expect(r.failures[0]!.cell.language).toBe('de');
    }
  });

  test('sweep across scales, a scale eventually fails', () => {
    const r = verify({
      text: { en: 'Speichern Sie' },
      font: '16px sans-serif',
      maxWidth: 80,
      lineHeight: 20,
      constraints: { maxLines: 1 },
      fontScales: [1, 1.25, 1.5, 2],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.cellsChecked).toBe(4);
      const failingScales = new Set(r.failures.map((f) => f.cell.scale));
      expect(failingScales.size).toBeGreaterThan(0);
    }
  });

  test('matrix sweep: each (lang x scale) counted', () => {
    const r = verify({
      text: { en: 'A', de: 'B' },
      font: '16px sans-serif',
      maxWidth: 400,
      lineHeight: 20,
      constraints: { maxLines: 1 },
      fontScales: [1, 1.5],
    });
    expect(r.cellsChecked).toBe(4);
  });

  test('languages filter narrows the sweep', () => {
    const r = verify({
      text: { en: 'A', de: 'B', ja: 'C' },
      font: '16px sans-serif',
      maxWidth: 400,
      lineHeight: 20,
      constraints: { maxLines: 1 },
      languages: ['en', 'de'],
    });
    expect(r.cellsChecked).toBe(2);
  });

  test('plain string input treated as default language', () => {
    const r = verify({
      text: 'Hello',
      font: '16px sans-serif',
      maxWidth: 200,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    });
    expect(r.ok).toBe(true);
  });

  test('formatReport produces readable output on failure', () => {
    const r = verify({
      text: { de: 'Rechtsschutzversicherungsgesellschaften' },
      font: '16px sans-serif',
      maxWidth: 100,
      lineHeight: 20,
      constraints: { singleLine: true },
    });
    const text = formatReport(r);
    expect(text).toMatch(/failure/i);
    expect(text).toMatch(/de/);
  });
});
