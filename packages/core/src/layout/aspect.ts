/**
 * Image aspect-ratio layout.
 *
 * Implements the CSS `object-fit` values:
 *
 *   contain    — scale uniformly to fit, letterbox leftover
 *   cover      — scale uniformly to fill, clip leftover
 *   fill       — stretch to fill; aspect ratio can change
 *   scale-down — min(contain, none); never upscale
 *   none       — intrinsic size; overflows if larger than slot
 *
 * Plus CSS `object-position` in v0.3 (H3.1): arbitrary placement
 * of the rendered rect inside the slot. The output exposes both
 * per-side values (`letterboxLeft/Right/Top/Bottom`,
 * `clippedLeft/Right/Top/Bottom`) which respect `objectPosition`,
 * and legacy `letterboxX/Y` / `clippedX/Y` fields which stay
 * source-compatible with v0.2 code paths — those fields now
 * report `max(left, right)` / `max(top, bottom)` so the
 * `fitsAspect()` threshold checks still catch the worst side
 * under any asymmetric placement. Under the centered default
 * (`{ x: 0.5, y: 0.5 }`) both interpretations agree, so v0.2
 * callers see no behaviour change.
 *
 * PRELIGHT-INVARIANT: pure. Deterministic arithmetic over
 * intrinsic + slot + position only.
 *
 * PRELIGHT-NEXT(v0.4+): position values outside [0, 1]. CSS
 * permits positions like `-10%` (image hangs off slot's left
 * edge) or `110%` (hangs off right). v0.3 clamps to [0, 1];
 * full overhang needs a "slot-external" offset field.
 */

export type ObjectFit = 'contain' | 'cover' | 'fill' | 'scale-down' | 'none';

/**
 * CSS `object-position` as a unit interval on each axis. x = 0
 * aligns the image's left edge with the slot's left edge
 * (equivalent to CSS `object-position: 0% 50%`); x = 1 aligns
 * right edges (`100% 50%`); x = 0.5 is the CSS default
 * (`50% 50%`, i.e. centered). Values are clamped to [0, 1] in
 * v0.3 — see the file-level PRELIGHT-NEXT for overhang support.
 */
export interface ObjectPosition {
  x: number;
  y: number;
}

/** The CSS default `object-position: 50% 50%`. */
export const OBJECT_POSITION_CENTER: ObjectPosition = Object.freeze({ x: 0.5, y: 0.5 });

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
   * Worst-side letterbox on the horizontal axis. Equals
   * `max(letterboxLeft, letterboxRight)`. Under the centered
   * default (`object-position.x === 0.5`) this equals half the
   * total letterbox, matching v0.2 behaviour. Under asymmetric
   * positioning this reports the larger of the two sides, which
   * is the value `fitsAspect()` compares against `maxLetterboxPx`.
   */
  letterboxX: number;
  /** Worst-side vertical letterbox. Symmetric to `letterboxX`. */
  letterboxY: number;
  /** Worst-side horizontal clipping. `max(clippedLeft, clippedRight)`. */
  clippedX: number;
  /** Worst-side vertical clipping. */
  clippedY: number;
  /** Letterbox on the slot's left edge (renderWidth < slot.width). */
  letterboxLeft: number;
  /** Letterbox on the slot's right edge. */
  letterboxRight: number;
  /** Letterbox on the slot's top edge. */
  letterboxTop: number;
  /** Letterbox on the slot's bottom edge. */
  letterboxBottom: number;
  /** Image clipped on the slot's left edge (renderWidth > slot.width). */
  clippedLeft: number;
  /** Image clipped on the slot's right edge. */
  clippedRight: number;
  /** Image clipped on the slot's top edge. */
  clippedTop: number;
  /** Image clipped on the slot's bottom edge. */
  clippedBottom: number;
  /** Effective scale applied to the intrinsic image (1 = no scaling). */
  scaleX: number;
  scaleY: number;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Compute the rendered rect + letterbox + clipping given an
 * intrinsic image, a slot, an object-fit mode, and an optional
 * object-position. Position defaults to centered (`{ x: 0.5, y: 0.5 }`)
 * which matches CSS's default `object-position: 50% 50%`.
 */
export function aspectFit(
  intrinsic: IntrinsicImage,
  slot: Slot,
  fit: ObjectFit = 'contain',
  position: ObjectPosition = OBJECT_POSITION_CENTER,
): AspectLayout {
  const px = clamp01(position.x);
  const py = clamp01(position.y);

  if (intrinsic.width <= 0 || intrinsic.height <= 0) {
    // Zero-sized intrinsic image: rendered rect is (0, 0); whole
    // slot is letterbox, distributed by position.
    return {
      renderWidth: 0,
      renderHeight: 0,
      letterboxLeft: slot.width * px,
      letterboxRight: slot.width * (1 - px),
      letterboxTop: slot.height * py,
      letterboxBottom: slot.height * (1 - py),
      clippedLeft: 0,
      clippedRight: 0,
      clippedTop: 0,
      clippedBottom: 0,
      letterboxX: Math.max(slot.width * px, slot.width * (1 - px)),
      letterboxY: Math.max(slot.height * py, slot.height * (1 - py)),
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
      // contain, but never upscaled. Position has no effect on
      // size here; we reuse the centered contain result purely for
      // its dimensions.
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

  // Per-axis slack: negative means rendered rect is smaller than
  // the slot (letterbox), positive means it's larger (clip).
  const slackX = renderWidth - slot.width;
  const slackY = renderHeight - slot.height;

  let letterboxLeft = 0;
  let letterboxRight = 0;
  let clippedLeft = 0;
  let clippedRight = 0;
  if (slackX < 0) {
    // Letterbox distributed by position. px=0 → all on right;
    // px=1 → all on left; px=0.5 → split evenly.
    const total = -slackX;
    letterboxLeft = total * px;
    letterboxRight = total * (1 - px);
  } else if (slackX > 0) {
    // Clip distributed by position: image overflows, position
    // chooses which side gets trimmed. px=0 means image's left
    // edge anchored to slot's left, so all overflow is clipped
    // on the right.
    clippedLeft = slackX * px;
    clippedRight = slackX * (1 - px);
  }

  let letterboxTop = 0;
  let letterboxBottom = 0;
  let clippedTop = 0;
  let clippedBottom = 0;
  if (slackY < 0) {
    const total = -slackY;
    letterboxTop = total * py;
    letterboxBottom = total * (1 - py);
  } else if (slackY > 0) {
    clippedTop = slackY * py;
    clippedBottom = slackY * (1 - py);
  }

  return {
    renderWidth,
    renderHeight,
    letterboxLeft,
    letterboxRight,
    letterboxTop,
    letterboxBottom,
    clippedLeft,
    clippedRight,
    clippedTop,
    clippedBottom,
    letterboxX: Math.max(letterboxLeft, letterboxRight),
    letterboxY: Math.max(letterboxTop, letterboxBottom),
    clippedX: Math.max(clippedLeft, clippedRight),
    clippedY: Math.max(clippedTop, clippedBottom),
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
   * Object-position inside the slot. Defaults to centered
   * (`{ x: 0.5, y: 0.5 }`, matching CSS's `50% 50%`). Affects
   * which side is letterboxed or clipped under non-square
   * aspect mismatches — the predicate flags the worst side.
   */
  position?: ObjectPosition;
  /**
   * Maximum allowed letterbox in px on either axis. Defaults to 0:
   * any letterboxing fails. Useful for heroes where you want the
   * image to fully cover; the caller opts into some letterbox
   * with a positive threshold. Compared against the WORST side
   * (`max(letterboxLeft, letterboxRight)`), so an asymmetric
   * `object-position` pile-up on one side still fails.
   */
  maxLetterboxPx?: number;
  /** Maximum allowed clipping in px on either axis (worst side). Defaults to 0. */
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
  const layout = aspectFit(
    spec.intrinsic,
    spec.slot,
    spec.fit ?? 'contain',
    spec.position ?? OBJECT_POSITION_CENTER,
  );
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
