/**
 * Placeholder for the v0.2 style-resolution surface. In v0.1 the consumer
 * supplies font/maxWidth/lineHeight explicitly; resolving those from the
 * rendered React tree is the core unlock of v0.2.
 *
 * PRELIGHT-NEXT(v0.2): walk the rendered element, collect inline `style`
 * props, merge a simple cascade, return a resolved text-layout context per
 * visible text node. Pair with slot markers from extract.ts.
 */

export interface ResolvedStyles {
  font?: string;
  maxWidth?: number;
  lineHeight?: number;
}

export function resolveStyles(_node: unknown): ResolvedStyles {
  throw new Error('PRELIGHT-NEXT(v0.2): resolveStyles not implemented in v0.1.');
}
