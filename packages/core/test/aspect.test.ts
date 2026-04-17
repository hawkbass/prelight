/**
 * G5 aspect-ratio corpus: 20 cases.
 *
 *   1-8:   aspectFit() per object-fit mode
 *   9-14:  Edge cases (square source/slot, zero-size, same aspect)
 *  15-20:  fitsAspect predicate (letterbox/clip/scale thresholds)
 */

import { describe, expect, test } from 'vitest';

import { aspectFit, fitsAspect } from '../src/index.js';

describe('G5.1 object-fit modes', () => {
  test('C01 contain on wider-than-slot image letterboxes vertically', () => {
    const r = aspectFit({ width: 200, height: 100 }, { width: 200, height: 200 }, 'contain');
    // slot aspect 1, image aspect 2 → match slot width, height = 100
    expect(r.renderWidth).toBe(200);
    expect(r.renderHeight).toBe(100);
    expect(r.letterboxY).toBe(50);
    expect(r.letterboxX).toBe(0);
    expect(r.clippedX).toBe(0);
  });

  test('C02 contain on taller-than-slot image letterboxes horizontally', () => {
    const r = aspectFit({ width: 100, height: 200 }, { width: 200, height: 200 }, 'contain');
    expect(r.renderWidth).toBe(100);
    expect(r.renderHeight).toBe(200);
    expect(r.letterboxX).toBe(50);
  });

  test('C03 cover on wider-than-slot image clips horizontally', () => {
    const r = aspectFit({ width: 200, height: 100 }, { width: 100, height: 100 }, 'cover');
    // slot 1:1, image 2:1 → match slot height, width = 200
    expect(r.renderHeight).toBe(100);
    expect(r.renderWidth).toBe(200);
    expect(r.clippedX).toBe(50);
    expect(r.letterboxX).toBe(0);
  });

  test('C04 cover on taller-than-slot image clips vertically', () => {
    const r = aspectFit({ width: 100, height: 200 }, { width: 100, height: 100 }, 'cover');
    expect(r.renderWidth).toBe(100);
    expect(r.renderHeight).toBe(200);
    expect(r.clippedY).toBe(50);
  });

  test('C05 fill stretches to slot', () => {
    const r = aspectFit({ width: 200, height: 100 }, { width: 300, height: 300 }, 'fill');
    expect(r.renderWidth).toBe(300);
    expect(r.renderHeight).toBe(300);
    expect(r.letterboxX).toBe(0);
    expect(r.letterboxY).toBe(0);
    // scaleX ≠ scaleY because fill doesn't preserve aspect
    expect(r.scaleX).not.toBe(r.scaleY);
  });

  test('C06 none uses intrinsic dimensions', () => {
    const r = aspectFit({ width: 200, height: 100 }, { width: 300, height: 300 }, 'none');
    expect(r.renderWidth).toBe(200);
    expect(r.renderHeight).toBe(100);
    expect(r.scaleX).toBe(1);
    expect(r.scaleY).toBe(1);
  });

  test('C07 scale-down matches contain when upscaling would occur', () => {
    // intrinsic 50×50, slot 200×200 → contain would upscale to 200×200
    // scale-down keeps 50×50.
    const r = aspectFit({ width: 50, height: 50 }, { width: 200, height: 200 }, 'scale-down');
    expect(r.renderWidth).toBe(50);
    expect(r.renderHeight).toBe(50);
    expect(r.letterboxX).toBe(75);
    expect(r.letterboxY).toBe(75);
  });

  test('C08 scale-down matches contain when downscaling is required', () => {
    const r = aspectFit({ width: 400, height: 200 }, { width: 200, height: 200 }, 'scale-down');
    expect(r.renderWidth).toBe(200);
    expect(r.renderHeight).toBe(100);
    expect(r.letterboxY).toBe(50);
  });
});

describe('G5.2 edge cases', () => {
  test('C09 same aspect: no letterbox, no clip, any mode', () => {
    const intrinsic = { width: 400, height: 200 };
    const slot = { width: 200, height: 100 };
    for (const mode of ['contain', 'cover', 'fill', 'scale-down'] as const) {
      const r = aspectFit(intrinsic, slot, mode);
      expect(r.letterboxX).toBe(0);
      expect(r.letterboxY).toBe(0);
      expect(r.clippedX).toBe(0);
      expect(r.clippedY).toBe(0);
    }
  });

  test('C10 square image, landscape slot, contain', () => {
    const r = aspectFit({ width: 100, height: 100 }, { width: 200, height: 100 }, 'contain');
    expect(r.renderWidth).toBe(100);
    expect(r.renderHeight).toBe(100);
    expect(r.letterboxX).toBe(50);
  });

  test('C11 square image, portrait slot, cover', () => {
    const r = aspectFit({ width: 100, height: 100 }, { width: 100, height: 200 }, 'cover');
    expect(r.renderWidth).toBe(200);
    expect(r.renderHeight).toBe(200);
    expect(r.clippedX).toBe(50);
  });

  test('C12 zero-sized image returns zero render with centered letterbox', () => {
    const r = aspectFit({ width: 0, height: 0 }, { width: 100, height: 100 }, 'contain');
    expect(r.renderWidth).toBe(0);
    expect(r.renderHeight).toBe(0);
    expect(r.letterboxX).toBe(50);
    expect(r.letterboxY).toBe(50);
  });

  test('C13 scale-down on already-smaller-than-slot image', () => {
    const r = aspectFit({ width: 100, height: 50 }, { width: 400, height: 200 }, 'scale-down');
    expect(r.renderWidth).toBe(100);
    expect(r.renderHeight).toBe(50);
  });

  test('C14 tiny image into huge slot with cover upscales', () => {
    const r = aspectFit({ width: 100, height: 50 }, { width: 800, height: 400 }, 'cover');
    expect(r.renderWidth).toBe(800);
    expect(r.renderHeight).toBe(400);
    expect(r.scaleX).toBe(8);
  });
});

describe('G5.3 fitsAspect predicate', () => {
  test('C15 contain fails when any letterbox > 0 by default', () => {
    const r = fitsAspect({
      intrinsic: { width: 200, height: 100 },
      slot: { width: 200, height: 200 },
      fit: 'contain',
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/vertical letterbox/);
  });

  test('C16 allow letterbox up to threshold', () => {
    const r = fitsAspect({
      intrinsic: { width: 200, height: 100 },
      slot: { width: 200, height: 200 },
      fit: 'contain',
      maxLetterboxPx: 60,
    });
    expect(r.ok).toBe(true);
  });

  test('C17 cover with zero allowed clip fails', () => {
    const r = fitsAspect({
      intrinsic: { width: 200, height: 100 },
      slot: { width: 100, height: 100 },
      fit: 'cover',
    });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/horizontal clipping/);
  });

  test('C18 cover with allowed clip passes', () => {
    const r = fitsAspect({
      intrinsic: { width: 200, height: 100 },
      slot: { width: 100, height: 100 },
      fit: 'cover',
      maxClipPx: 100,
    });
    expect(r.ok).toBe(true);
  });

  test('C19 maxScale catches upscaling a thumbnail', () => {
    const r = fitsAspect({
      intrinsic: { width: 100, height: 50 },
      slot: { width: 800, height: 400 },
      fit: 'cover',
      maxScale: 2,
      maxClipPx: 1000,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.some((r) => r.includes('maxScale'))).toBe(true);
  });

  test('C20 minScale catches excessive downscaling', () => {
    const r = fitsAspect({
      intrinsic: { width: 4000, height: 2000 },
      slot: { width: 400, height: 200 },
      fit: 'contain',
      minScale: 0.5,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.some((r) => r.includes('minScale'))).toBe(true);
  });
});
