/**
 * Image aspect-ratio layout for v0.2 (G5).
 *
 * Implements the CSS `object-fit` values:
 *
 *   contain    — scale uniformly to fit, letterbox leftover
 *   cover      — scale uniformly to fill, clip leftover
 *   fill       — stretch to fill; aspect ratio can change
 *   scale-down — min(contain, none); never upscale
 *   none       — intrinsic size; overflows if larger than slot
 *
 * The output describes the rendered image rect (width, height) and
 * per-axis letterboxing / clipping. The `fitsAspect()` predicate
 * then decides whether the outcome is acceptable for a given
 * design intent (e.g. "no letterbox allowed on a hero").
 *
 * PRELIGHT-INVARIANT: pure. Deterministic arithmetic over
 * intrinsic + slot dimensions only.
 *
 * PRELIGHT-NEXT(v0.3): `object-position` offsets. v0.2 always
 * centers the rendered rect inside the slot, which matches the
 * CSS default (`50% 50%`) but not arbitrary positioning.
 */

export type ObjectFit = 'contain' | 'cover' | 'fill' | 'scale-down' | 'none';

export interface IntrinsicImage {
  /** Natural pixel width. */
  width: number;
  /** Natural pixel height. */
  height: number;
}

export interface Slot {
  width: number;
  height: number;
}

export interface AspectLayout {
  /** Rendered image rect width in the slot. */
  renderWidth: number;
  /** Rendered image rect height in the slot. */
  renderHeight: number;
  /**
   * Horizontal letterbox on each side (symmetric for CSS default
   * `object-position: 50% 50%`). Zero when the rendered rect is
   * ≥ slot width.
   */
  letterboxX: number;
  /** Vertical letterbox on each side. */
  letterboxY: number;
  /** Horizontal portion of the image clipped out (each side). */
  clippedX: number;
  /** Vertical portion of the image clipped out (each side). */
  clippedY: number;
  /** Effective scale applied to the intrinsic image (1 = no scaling). */
  scaleX: number;
  scaleY: number;
}

/**
 * Compute the rendered rect + letterbox + clipping given an
 * intrinsic image, a slot, and an object-fit mode.
 */
export function aspectFit(
  intrinsic: IntrinsicImage,
  slot: Slot,
  fit: ObjectFit = 'contain',
): AspectLayout {
  if (intrinsic.width <= 0 || intrinsic.height <= 0) {
    return {
      renderWidth: 0,
      renderHeight: 0,
      letterboxX: slot.width / 2,
      letterboxY: slot.height / 2,
      clippedX: 0,
      clippedY: 0,
      scaleX: 0,
      scaleY: 0,
    };
  }

  const intrinsicAspect = intrinsic.width / intrinsic.height;
  const slotAspect = slot.width / slot.height;

  let renderWidth: number;
  let renderHeight: number;

  switch (fit) {
    case 'fill':
      renderWidth = slot.width;
      renderHeight = slot.height;
      break;

    case 'none':
      renderWidth = intrinsic.width;
      renderHeight = intrinsic.height;
      break;

    case 'contain': {
      if (intrinsicAspect > slotAspect) {
        // Wider: match slot width, shrink height.
        renderWidth = slot.width;
        renderHeight = slot.width / intrinsicAspect;
      } else {
        // Taller: match slot height.
        renderHeight = slot.height;
        renderWidth = slot.height * intrinsicAspect;
      }
      break;
    }

    case 'cover': {
      if (intrinsicAspect > slotAspect) {
        // Wider: match slot height, overflow width.
        renderHeight = slot.height;
        renderWidth = slot.height * intrinsicAspect;
      } else {
        renderWidth = slot.width;
        renderHeight = slot.width / intrinsicAspect;
      }
      break;
    }

    case 'scale-down': {
      // contain, but never upscaled.
      const contained = aspectFit(intrinsic, slot, 'contain');
      if (contained.renderWidth >= intrinsic.width && contained.renderHeight >= intrinsic.height) {
        renderWidth = intrinsic.width;
        renderHeight = intrinsic.height;
      } else {
        renderWidth = contained.renderWidth;
        renderHeight = contained.renderHeight;
      }
      break;
    }

    default: {
      // Exhaustive guard. TypeScript's exhaustiveness check catches
      // this at compile time; the runtime fallback matches `contain`.
      renderWidth = slot.width;
      renderHeight = slot.height;
    }
  }

  const overflowX = renderWidth - slot.width;
  const overflowY = renderHeight - slot.height;
  const letterboxX = overflowX < 0 ? -overflowX / 2 : 0;
  const letterboxY = overflowY < 0 ? -overflowY / 2 : 0;
  const clippedX = overflowX > 0 ? overflowX / 2 : 0;
  const clippedY = overflowY > 0 ? overflowY / 2 : 0;

  return {
    renderWidth,
    renderHeight,
    letterboxX,
    letterboxY,
    clippedX,
    clippedY,
    scaleX: renderWidth / intrinsic.width,
    scaleY: renderHeight / intrinsic.height,
  };
}

// ────────────────────────────────────────────────────────────────
// fitsAspect predicate
// ────────────────────────────────────────────────────────────────

export interface FitsAspectSpec {
  intrinsic: IntrinsicImage;
  slot: Slot;
  fit?: ObjectFit;
  /**
   * Maximum allowed letterbox in px on either axis. Defaults to 0:
   * any letterboxing fails. Useful for heroes where you want the
   * image to fully cover; the caller opts into some letterbox
   * with a positive threshold.
   */
  maxLetterboxPx?: number;
  /** Maximum allowed clipping in px on either axis. Defaults to 0. */
  maxClipPx?: number;
  /**
   * Minimum effective scale. e.g. `0.5` forbids scaling below 50%
   * (avoids blurry upscales on low-res source images).
   */
  minScale?: number;
  /**
   * Maximum effective scale. Guards against blowing a small
   * thumbnail up into a hero where quality collapses.
   */
  maxScale?: number;
}

export interface FitsAspectResult {
  ok: boolean;
  layout: AspectLayout;
  reasons: string[];
}

export function fitsAspect(spec: FitsAspectSpec): FitsAspectResult {
  const layout = aspectFit(spec.intrinsic, spec.slot, spec.fit ?? 'contain');
  const reasons: string[] = [];
  const maxLetterbox = spec.maxLetterboxPx ?? 0;
  const maxClip = spec.maxClipPx ?? 0;

  if (layout.letterboxX > maxLetterbox + 0.5) {
    reasons.push(
      `horizontal letterbox ${layout.letterboxX.toFixed(1)}px > allowed ${maxLetterbox}px`,
    );
  }
  if (layout.letterboxY > maxLetterbox + 0.5) {
    reasons.push(
      `vertical letterbox ${layout.letterboxY.toFixed(1)}px > allowed ${maxLetterbox}px`,
    );
  }
  if (layout.clippedX > maxClip + 0.5) {
    reasons.push(`horizontal clipping ${layout.clippedX.toFixed(1)}px > allowed ${maxClip}px`);
  }
  if (layout.clippedY > maxClip + 0.5) {
    reasons.push(`vertical clipping ${layout.clippedY.toFixed(1)}px > allowed ${maxClip}px`);
  }
  if (spec.minScale !== undefined) {
    const effScale = Math.min(layout.scaleX, layout.scaleY);
    if (effScale < spec.minScale - 1e-6) {
      reasons.push(`effective scale ${effScale.toFixed(3)} < minScale ${spec.minScale}`);
    }
  }
  if (spec.maxScale !== undefined) {
    const effScale = Math.max(layout.scaleX, layout.scaleY);
    if (effScale > spec.maxScale + 1e-6) {
      reasons.push(`effective scale ${effScale.toFixed(3)} > maxScale ${spec.maxScale}`);
    }
  }

  return { ok: reasons.length === 0, layout, reasons };
}
