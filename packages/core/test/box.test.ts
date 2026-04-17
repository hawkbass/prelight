/**
 * G2 Box-model corpus: 30 cases.
 *
 * Each case encodes a CSS box-model scenario with the expected
 * computed values derived from the CSS 2.1 box model spec (§8).
 * Since box-model arithmetic is deterministic and spec-defined, a
 * match against the spec is a match against Chromium / WebKit /
 * Firefox — all three implement the same spec.
 *
 *   1-10: EdgeInsets constructors + shorthand parsing
 *  11-20: box() arithmetic (padding, border, margin combinations)
 *  21-25: border-box inverse + intrinsic sizing helpers
 *  26-30: integration with Measurement shape + edge cases
 */

import { describe, expect, test } from 'vitest';

import {
  addInsets,
  box,
  contentWidthFromBorderBox,
  edgeInsetsAll,
  edgeInsetsOnly,
  edgeInsetsSymmetric,
  horizontalInset,
  parseEdgeInsets,
  verticalInset,
  zeroInsets,
  type EdgeInsets,
  type Box,
} from '../src/index.js';
import type { Measurement } from '../src/index.js';

const cell = { language: 'en', scale: 1, width: 120 } as const;

function measurement(width: number, height: number, lines = 1): Measurement {
  return {
    cell: { ...cell, width },
    lines,
    measuredWidth: width,
    measuredHeight: height,
    naturalWidth: width,
    overflows: false,
  };
}

describe('G2.1 EdgeInsets constructors', () => {
  test('C01 zeroInsets returns all-zero', () => {
    expect(zeroInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
  test('C02 all() sets every edge', () => {
    expect(edgeInsetsAll(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });
  test('C03 symmetric() splits vertical + horizontal', () => {
    expect(edgeInsetsSymmetric(6, 10)).toEqual({ top: 6, right: 10, bottom: 6, left: 10 });
  });
  test('C04 only() fills missing edges with 0', () => {
    expect(edgeInsetsOnly({ top: 4, left: 8 })).toEqual({ top: 4, right: 0, bottom: 0, left: 8 });
  });
  test('C05 parseEdgeInsets 1-value', () => {
    expect(parseEdgeInsets('10px')).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });
  test('C06 parseEdgeInsets 2-value', () => {
    expect(parseEdgeInsets('10px 20px')).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
  });
  test('C07 parseEdgeInsets 3-value', () => {
    expect(parseEdgeInsets('10px 20px 5px')).toEqual({ top: 10, right: 20, bottom: 5, left: 20 });
  });
  test('C08 parseEdgeInsets 4-value', () => {
    expect(parseEdgeInsets('1px 2px 3px 4px')).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });
  test('C09 parseEdgeInsets unit-less numbers', () => {
    expect(parseEdgeInsets('5 10 5 10')).toEqual({ top: 5, right: 10, bottom: 5, left: 10 });
  });
  test('C10 parseEdgeInsets rejects unsupported', () => {
    expect(() => parseEdgeInsets('10% 5px')).toThrow(/unsupported token/);
    expect(() => parseEdgeInsets('')).toThrow(/expected 1-4 tokens/);
  });
});

describe('G2.2 box() arithmetic', () => {
  const content = measurement(100, 20);

  test('C11 bare content → all box sizes equal content', () => {
    const b = box({ content });
    expect(b.paddingBoxWidth).toBe(100);
    expect(b.paddingBoxHeight).toBe(20);
    expect(b.borderBoxWidth).toBe(100);
    expect(b.borderBoxHeight).toBe(20);
    expect(b.outerWidth).toBe(100);
    expect(b.outerHeight).toBe(20);
  });

  test('C12 symmetric padding grows padding box only', () => {
    const b = box({ content, padding: edgeInsetsAll(8) });
    expect(b.paddingBoxWidth).toBe(116);
    expect(b.paddingBoxHeight).toBe(36);
    expect(b.borderBoxWidth).toBe(116);
    expect(b.outerWidth).toBe(116);
  });

  test('C13 border adds on top of padding', () => {
    const b = box({ content, padding: edgeInsetsAll(8), border: edgeInsetsAll(1) });
    expect(b.paddingBoxWidth).toBe(116);
    expect(b.borderBoxWidth).toBe(118);
    expect(b.borderBoxHeight).toBe(38);
    expect(b.outerWidth).toBe(118);
  });

  test('C14 margin does not change border box', () => {
    const b = box({ content, margin: edgeInsetsAll(20) });
    expect(b.borderBoxWidth).toBe(100);
    expect(b.outerWidth).toBe(140);
    expect(b.outerHeight).toBe(60);
  });

  test('C15 asymmetric padding', () => {
    const b = box({
      content,
      padding: edgeInsetsOnly({ left: 4, right: 12 }),
    });
    expect(b.paddingBoxWidth).toBe(100 + 4 + 12);
    expect(b.outerWidth).toBe(116);
  });

  test('C16 asymmetric margin', () => {
    const b = box({
      content,
      margin: edgeInsetsOnly({ top: 5, bottom: 10 }),
    });
    expect(b.outerHeight).toBe(35);
  });

  test('C17 negative margin reduces outer dimension', () => {
    const b = box({
      content,
      margin: edgeInsetsOnly({ right: -10 }),
    });
    expect(b.outerWidth).toBe(90);
  });

  test('C18 CSS shorthand box: 10px 20px padding, 1px border, 8px margin', () => {
    const b = box({
      content,
      padding: parseEdgeInsets('10px 20px'),
      border: parseEdgeInsets('1px'),
      margin: parseEdgeInsets('8px'),
    });
    expect(b.paddingBoxWidth).toBe(100 + 40);
    expect(b.paddingBoxHeight).toBe(20 + 20);
    expect(b.borderBoxWidth).toBe(142);
    expect(b.borderBoxHeight).toBe(42);
    expect(b.outerWidth).toBe(158);
    expect(b.outerHeight).toBe(58);
  });

  test('C19 wrapped 2-line content with insets', () => {
    const wrapped = measurement(100, 40, 2);
    const b = box({ content: wrapped, padding: edgeInsetsAll(10) });
    expect(b.paddingBoxHeight).toBe(60);
    expect(b.outerHeight).toBe(60);
  });

  test('C20 frozen Measurement stays untouched in Box', () => {
    const input = measurement(50, 18);
    const b = box({ content: input });
    expect(b.content).toBe(input); // identity
  });
});

describe('G2.3 border-box inverse + insets math', () => {
  test('C21 contentWidthFromBorderBox subtracts padding + border', () => {
    const content = contentWidthFromBorderBox(200, edgeInsetsAll(8), edgeInsetsAll(1));
    expect(content).toBe(200 - 16 - 2);
  });

  test('C22 contentWidthFromBorderBox accepts asymmetric insets', () => {
    const content = contentWidthFromBorderBox(
      200,
      edgeInsetsOnly({ left: 10, right: 4 }),
      edgeInsetsOnly({ left: 1, right: 2 }),
    );
    expect(content).toBe(200 - 14 - 3);
  });

  test('C23 contentWidthFromBorderBox throws when negative', () => {
    expect(() =>
      contentWidthFromBorderBox(10, edgeInsetsAll(8), edgeInsetsAll(1)),
    ).toThrow(/nothing fits/);
  });

  test('C24 addInsets sums edge-wise', () => {
    const a: EdgeInsets = { top: 1, right: 2, bottom: 3, left: 4 };
    const b: EdgeInsets = { top: 10, right: 20, bottom: 30, left: 40 };
    expect(addInsets(a, b)).toEqual({ top: 11, right: 22, bottom: 33, left: 44 });
  });

  test('C25 horizontalInset + verticalInset shortcut', () => {
    const e: EdgeInsets = { top: 5, right: 6, bottom: 7, left: 8 };
    expect(horizontalInset(e)).toBe(14);
    expect(verticalInset(e)).toBe(12);
  });
});

describe('G2.4 integration + edge cases', () => {
  test('C26 real button: 120 content + 12/24 padding + 1px border + 0 margin', () => {
    const content = measurement(96, 20);
    const b = box({
      content,
      padding: parseEdgeInsets('12px 24px'),
      border: parseEdgeInsets('1px'),
    });
    expect(b.paddingBoxWidth).toBe(96 + 48);
    expect(b.borderBoxWidth).toBe(96 + 48 + 2);
    expect(b.outerWidth).toBe(146);
  });

  test('C27 card with 16px padding + 8px margin', () => {
    const content = measurement(280, 60, 3);
    const b = box({ content, padding: edgeInsetsAll(16), margin: edgeInsetsAll(8) });
    expect(b.borderBoxWidth).toBe(280 + 32);
    expect(b.outerWidth).toBe(280 + 32 + 16);
    expect(b.outerHeight).toBe(60 + 32 + 16);
  });

  test('C28 zero content with insets becomes chrome-only', () => {
    const empty = measurement(0, 0, 0);
    const b = box({ content: empty, padding: edgeInsetsAll(10), border: edgeInsetsAll(2) });
    expect(b.paddingBoxWidth).toBe(20);
    expect(b.borderBoxWidth).toBe(24);
  });

  test('C29 sub-pixel insets preserve precision', () => {
    const content = measurement(100.5, 20.25);
    const b: Box = box({ content, padding: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } });
    expect(b.paddingBoxWidth).toBeCloseTo(101.5, 5);
    expect(b.paddingBoxHeight).toBeCloseTo(21.25, 5);
  });

  test('C30 box arithmetic is additive: outer - margin - border - padding = content', () => {
    const content = measurement(100, 20);
    const b = box({
      content,
      padding: edgeInsetsAll(10),
      border: edgeInsetsAll(2),
      margin: edgeInsetsAll(5),
    });
    const recoveredWidth =
      b.outerWidth -
      horizontalInset(b.margin) -
      horizontalInset(b.border) -
      horizontalInset(b.padding);
    const recoveredHeight =
      b.outerHeight -
      verticalInset(b.margin) -
      verticalInset(b.border) -
      verticalInset(b.padding);
    expect(recoveredWidth).toBe(100);
    expect(recoveredHeight).toBe(20);
  });
});
