/**
 * Verify a React component's text layout.
 *
 * Usage:
 *
 *   verifyComponent({
 *     element: (lang) => <Button>{labels[lang]}</Button>,
 *     languages: ['en', 'de', 'ar', 'ja'],
 *     font: '16px Inter',
 *     maxWidth: 120,
 *     lineHeight: 20,
 *     constraints: { maxLines: 1, noOverflow: true },
 *     fontScales: [1, 1.25, 1.5],
 *   })
 *
 * The `element` factory is called once per language. Each render is extracted
 * to plain text via `renderToStaticMarkup`, then the matrix verifier handles
 * the rest.
 */

import type { ReactElement } from 'react';
import {
  verify,
  type Constraints,
  type VerifyResult,
} from '@prelight/core';

import { extractText } from './extract.js';

export interface ComponentVerifySpec {
  element: ReactElement | ((language: string) => ReactElement);
  font: string;
  maxWidth: number;
  lineHeight: number;
  constraints: Constraints;
  languages?: string[];
  fontScales?: number[];
}

export function verifyComponent(spec: ComponentVerifySpec): VerifyResult {
  const languages = spec.languages ?? ['default'];
  const text: Record<string, string> = {};
  for (const lang of languages) {
    const element =
      typeof spec.element === 'function' ? spec.element(lang) : spec.element;
    text[lang] = extractText(element);
  }
  return verify({
    text,
    font: spec.font,
    maxWidth: spec.maxWidth,
    lineHeight: spec.lineHeight,
    constraints: spec.constraints,
    ...(spec.fontScales !== undefined ? { fontScales: spec.fontScales } : {}),
    ...(spec.languages !== undefined ? { languages: spec.languages } : {}),
  });
}
