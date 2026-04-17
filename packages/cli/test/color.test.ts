/**
 * Tests for the zero-dependency color layer.
 *
 * Covers the full env × TTY decision table, so any future refactor
 * that accidentally emits ANSI into a log file will be caught
 * immediately.
 */

import { describe, expect, test } from 'vitest';

import {
  autoPalette,
  basicPalette,
  decideColor,
  paletteFor,
  plainPalette,
} from '../src/color.js';

describe('decideColor', () => {
  test('plain text when not a TTY and no env overrides', () => {
    const d = decideColor({ env: {}, isTTY: false });
    expect(d.level).toBe('none');
    expect(d.reason).toBe('not-a-TTY');
  });

  test('colour when stream is a TTY', () => {
    const d = decideColor({ env: {}, isTTY: true });
    expect(d.level).toBe('basic');
    expect(d.reason).toBe('TTY');
  });

  test('NO_COLOR beats a TTY', () => {
    const d = decideColor({ env: { NO_COLOR: '1' }, isTTY: true });
    expect(d.level).toBe('none');
    expect(d.reason).toBe('NO_COLOR');
  });

  test('NO_COLOR accepts any non-empty value', () => {
    const d = decideColor({ env: { NO_COLOR: 'true' }, isTTY: true });
    expect(d.level).toBe('none');
  });

  test('empty NO_COLOR does not suppress colour', () => {
    const d = decideColor({ env: { NO_COLOR: '' }, isTTY: true });
    expect(d.level).toBe('basic');
  });

  test('FORCE_COLOR beats not-a-TTY', () => {
    const d = decideColor({ env: { FORCE_COLOR: '1' }, isTTY: false });
    expect(d.level).toBe('basic');
    expect(d.reason).toBe('FORCE_COLOR');
  });

  test('FORCE_COLOR=0 disables colour even on a TTY', () => {
    const d = decideColor({ env: { FORCE_COLOR: '0' }, isTTY: true });
    expect(d.level).toBe('none');
    expect(d.reason).toBe('FORCE_COLOR=0');
  });

  test('FORCE_COLOR takes precedence over NO_COLOR when set to non-zero', () => {
    const d = decideColor({ env: { FORCE_COLOR: '1', NO_COLOR: '1' }, isTTY: false });
    expect(d.level).toBe('basic');
    expect(d.reason).toBe('FORCE_COLOR');
  });
});

describe('palettes', () => {
  test('plainPalette returns input unchanged for every kind', () => {
    expect(plainPalette.pass('ok')).toBe('ok');
    expect(plainPalette.fail('nope')).toBe('nope');
    expect(plainPalette.warn('warn')).toBe('warn');
    expect(plainPalette.name('name')).toBe('name');
    expect(plainPalette.dim('dim')).toBe('dim');
    expect(plainPalette.header('head')).toBe('head');
  });

  test('basicPalette wraps with ANSI and resets', () => {
    const green = basicPalette.pass('ok');
    expect(green).toContain('\u001b[32m');
    expect(green.endsWith('\u001b[0m')).toBe(true);
    const red = basicPalette.fail('nope');
    expect(red).toContain('\u001b[31m');
  });

  test('paletteFor maps decision.level correctly', () => {
    expect(paletteFor({ level: 'none', reason: 'x' })).toBe(plainPalette);
    expect(paletteFor({ level: 'basic', reason: 'x' })).toBe(basicPalette);
  });

  test('autoPalette respects process env + stream TTY', () => {
    const stream = { isTTY: false } as NodeJS.WriteStream;
    const originalForce = process.env.FORCE_COLOR;
    const originalNo = process.env.NO_COLOR;
    try {
      delete process.env.FORCE_COLOR;
      delete process.env.NO_COLOR;
      const p = autoPalette(stream);
      expect(p).toBe(plainPalette);
    } finally {
      if (originalForce !== undefined) process.env.FORCE_COLOR = originalForce;
      if (originalNo !== undefined) process.env.NO_COLOR = originalNo;
    }
  });
});
