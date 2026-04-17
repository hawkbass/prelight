/**
 * Resolve paths to the bundled test fonts. Consumers call
 * `await registerCorpusFonts()` once during test setup to make the fonts
 * available to the canvas measurement backend.
 *
 * See corpus/fonts/README.md for the rationale and licensing.
 */

import { loadBundledFont } from '@prelight/core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const INTER_VARIABLE_PATH = resolve(here, 'fonts', 'InterVariable.ttf');
export const NOTO_SANS_ARABIC_PATH = resolve(here, 'fonts', 'NotoSansArabic.ttf');

/**
 * Register every font bundled in `corpus/fonts/` with the canvas backend.
 * Safe to call multiple times; the backend ignores duplicate registrations.
 * Returns the list of aliases that registered successfully.
 *
 * The Arabic font is registered with the alias "Inter" so the canvas
 * backend falls through to it for glyphs Inter doesn't cover (Arabic
 * script). Without this, the canvas Arabic fallback differs from what
 * Chrome/WebKit/Firefox pick from the host OS, and ground-truth
 * agreement drops to 77% on Arabic (see FINDINGS.md, Phase F §F2).
 */
export async function registerCorpusFonts(): Promise<string[]> {
  const registered: string[] = [];
  const okInter = await loadBundledFont(INTER_VARIABLE_PATH, 'Inter');
  if (okInter) registered.push('Inter');
  // Register the Arabic font under both its real name (for explicit
  // consumers) and as "Inter" (so it acts as the fallback for Arabic
  // glyphs inside an "Inter"-named font-family). @napi-rs/canvas treats
  // a second registerFromPath with the same family alias as a fallback.
  const okNotoNamed = await loadBundledFont(NOTO_SANS_ARABIC_PATH, 'Noto Sans Arabic');
  if (okNotoNamed) registered.push('Noto Sans Arabic');
  const okNotoAlias = await loadBundledFont(NOTO_SANS_ARABIC_PATH, 'Inter');
  if (okNotoAlias) registered.push('Inter (Arabic fallback)');
  return registered;
}
