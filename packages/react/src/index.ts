export { extractText, htmlToText } from './extract.js';
export { verifyComponent } from './verify-component.js';
export type { ComponentVerifySpec } from './verify-component.js';
export { resolveStyles } from './resolve-styles.js';
export type {
  ResolvedStyles,
  ResolveStylesOptions,
  StyleSource,
} from './resolve-styles.js';
export { resolveStylesRuntime } from './runtime-probe.js';
export type { ResolveStylesRuntimeOptions } from './runtime-probe.js';
export {
  extractSlotText,
  findSlots,
  findSlotPath,
  SLOT_ATTR,
} from './slots.js';
export {
  inlineStyle,
  cssVariables,
  parseLengthPx,
  parseLineHeightPx,
  resolveVarReferences,
} from './style-resolver.js';
export type {
  ResolvedStyleFragment,
  StyleResolver,
} from './style-resolver.js';
