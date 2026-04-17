/**
 * Render a React element and extract its visible text content.
 *
 * v0.1 scope: we render the element with `react-dom/server`'s
 * `renderToStaticMarkup`, then strip HTML tags. This captures the final,
 * localized text users see — which is exactly what we want to verify.
 *
 * Explicitly out of scope for v0.1:
 *   - Extracting per-slot styles (font, max-width, line-height) from the
 *     rendered markup. The user supplies those to `verifyComponent` because
 *     CSS cascades from external stylesheets and CSS-in-JS libraries are
 *     out of reach for a pure-static walker.
 *   - Multi-slot verification. v0.1 treats the rendered output as one text
 *     blob. v0.3 H4 added `extractSlotText()` / `findSlots()` /
 *     `resolveStyles({ slot })` for this; see `slots.ts`.
 *
 * PRELIGHT-NEXT(v0.3 H7): emotion + styled-components StyleResolver
 *   plugins. The v0.2 `resolveStyles()` surface already accepts
 *   them; the plugins themselves need a runtime probe and are
 *   tracked as a separate phase.
 * PRELIGHT-NEXT(v1.0): full style resolution via Presize.
 */

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Render a React element to its static markup, then strip HTML tags and
 * decode the basic entities produced by React's server renderer.
 */
export function extractText(element: ReactElement): string {
  const html = renderToStaticMarkup(element);
  return htmlToText(html);
}

/** HTML → plain-text. Fast, no external parser, handles React SSR output. */
export function htmlToText(html: string): string {
  const noTags = html.replace(/<[^>]*>/g, '');
  return decodeEntities(noTags);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}
