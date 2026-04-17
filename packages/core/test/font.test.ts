import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadBundledFont, parseFont, scaleFont } from '../src/font.js';

describe('parseFont', () => {
  test('minimal form: size + family', () => {
    expect(parseFont('16px Inter')).toEqual({
      family: 'Inter',
      size: 16,
      weight: 400,
      style: 'normal',
      lineHeight: undefined,
    });
  });

  test('weight keyword', () => {
    expect(parseFont('bold 14px Inter')).toEqual({
      family: 'Inter',
      size: 14,
      weight: 700,
      style: 'normal',
      lineHeight: undefined,
    });
  });

  test('numeric weight', () => {
    expect(parseFont('600 14px Inter')).toEqual({
      family: 'Inter',
      size: 14,
      weight: 600,
      style: 'normal',
      lineHeight: undefined,
    });
  });

  test('style + weight + size/line-height + stack', () => {
    expect(parseFont('italic 600 14px/1.5 Inter, system-ui')).toEqual({
      family: 'Inter, system-ui',
      size: 14,
      weight: 600,
      style: 'italic',
      lineHeight: 1.5,
    });
  });

  test('quoted family names survive', () => {
    const parsed = parseFont("600 16px 'SF Pro', sans-serif");
    expect(parsed.family).toBe("'SF Pro', sans-serif");
    expect(parsed.size).toBe(16);
    expect(parsed.weight).toBe(600);
  });

  test('empty string throws', () => {
    expect(() => parseFont('')).toThrow(/empty/);
  });

  test('missing size throws', () => {
    expect(() => parseFont('Inter')).toThrow(/unsupported token/);
  });

  test('missing family throws', () => {
    expect(() => parseFont('16px')).toThrow(/font family/);
  });
});

describe('scaleFont', () => {
  test('scales by factor, preserves family', () => {
    expect(scaleFont('16px Inter', 1.25)).toBe('20px Inter');
  });

  test('scale 1 is identity for integer sizes', () => {
    expect(scaleFont('16px Inter', 1)).toBe('16px Inter');
  });

  test('only the first NNpx is replaced', () => {
    expect(scaleFont('600 14px/1.5 Inter', 2)).toBe('600 28px/1.5 Inter');
  });

  test('rounds non-integer results to two decimals', () => {
    expect(scaleFont('15px Inter', 1.1)).toBe('16.50px Inter');
  });
});

describe('loadBundledFont', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const interPath = resolve(here, '..', '..', '..', 'corpus', 'fonts', 'InterVariable.ttf');

  test('registers the bundled Inter with the canvas backend', async () => {
    const ok = await loadBundledFont(interPath, 'Inter');
    expect(ok).toBe(true);
  });

  test('returns false for a non-existent path instead of throwing', async () => {
    const ok = await loadBundledFont('C:/no/such/font.ttf', 'Nope');
    expect(ok).toBe(false);
  });
});
