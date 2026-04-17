/**
 * @prelight/core — public entry point.
 *
 * Consumers should import from here, never from submodules. Submodule paths
 * are unstable between minor versions.
 */

export { verify } from './verify.js';
export { formatFailureShort, formatReport } from './report.js';
export {
  ensureCanvasEnv,
  installCanvasShim,
  loadBundledFont,
  parseFont,
  scaleFont,
} from './font.js';
export type { FontDescriptor } from './font.js';
export { PREDICATES } from './predicates.js';
export type { Predicate } from './predicates.js';
export type {
  Constraints,
  Failure,
  FontScale,
  LocalizedText,
  MatrixCell,
  Measurement,
  VerifyResult,
  VerifySpec,
} from './types.js';
export {
  applyFitsInOneLineCorrection,
  containsRTL,
  correctRTLLayout,
} from './shape/rtl.js';
export type { LayoutLike, LineLike } from './shape/rtl.js';
export {
  containsCJK,
  correctCJKLayout,
  getCJKMeasurementFamilies,
  setCJKMeasurementFamilies,
} from './shape/cjk.js';
