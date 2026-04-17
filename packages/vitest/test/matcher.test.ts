import '../src/index.js';
import { describe, expect, test } from 'vitest';
import { box, zeroInsets, type Measurement } from '@prelight/core';

function content(width: number, height: number): Measurement {
  return {
    cell: { language: 'en', scale: 1, width },
    lines: 1,
    measuredWidth: width,
    measuredHeight: height,
    naturalWidth: width,
    overflows: false,
  };
}

function boxOf(w: number, h: number) {
  return box({ content: content(w, h), margin: zeroInsets() });
}

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

describe('toFitFlex matcher', () => {
  test('passes when a row packs within the container', () => {
    expect({
      container: { innerMain: 320, gap: 8 },
      children: [{ box: boxOf(80, 24) }, { box: boxOf(80, 24) }],
    }).toFitFlex();
  });

  test('fails when shrink:0 items overflow the main axis', () => {
    expect(() => {
      expect({
        container: { innerMain: 100 },
        children: [
          { box: boxOf(80, 20), shrink: 0 },
          { box: boxOf(80, 20), shrink: 0 },
        ],
      }).toFitFlex();
    }).toThrow(/flex layout failed/);
  });
});

describe('toFitBlock matcher', () => {
  test('passes when stacked children fit', () => {
    expect({
      container: { innerWidth: 300, innerHeight: 100 },
      children: [boxOf(100, 20), boxOf(100, 20)],
    }).toFitBlock();
  });

  test('fails when stack exceeds innerHeight', () => {
    expect(() => {
      expect({
        container: { innerWidth: 300, innerHeight: 30 },
        children: [boxOf(100, 20), boxOf(100, 20)],
      }).toFitBlock();
    }).toThrow(/block layout failed/);
  });
});

describe('toFitAspect matcher', () => {
  test('passes for contain-fit inside a matching slot', () => {
    expect({
      intrinsic: { width: 1600, height: 900 },
      slot: { width: 400, height: 225 },
      fit: 'contain',
    }).toFitAspect();
  });

  test('fails when clipping exceeds maxClipPx', () => {
    expect(() => {
      expect({
        intrinsic: { width: 1600, height: 900 },
        slot: { width: 400, height: 100 },
        fit: 'cover',
        maxClipPx: 1,
      }).toFitAspect();
    }).toThrow(/aspect layout failed/);
  });
});
