/**
 * Shared typed access to the corpus. Adapter packages, the ground-truth
 * harness, and the demos all import from here rather than reading JSON
 * directly.
 */

export interface LanguageCorpus {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
  source: string;
  notes?: string;
  strings: Record<string, string>;
}

export const LANGUAGE_CODES = [
  'en',
  'de',
  'ar',
  'ja',
  'zh',
  'emoji',
  'compound-words',
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export async function loadCorpus(code: LanguageCode): Promise<LanguageCorpus> {
  const url = new URL(`./languages/${code}.json`, import.meta.url);
  // Node's `fetch` does not handle `file://` URLs; Bun's does. Browsers
  // handle neither. We read via `fs` when available (Node/Bun) and fall
  // back to `fetch` in browser contexts.
  try {
    const fs = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const text = await fs.readFile(fileURLToPath(url), 'utf8');
    return JSON.parse(text) as LanguageCorpus;
  } catch {
    const text = await (await fetch(url)).text();
    return JSON.parse(text) as LanguageCorpus;
  }
}

export async function loadAllCorpora(): Promise<Record<LanguageCode, LanguageCorpus>> {
  const entries = await Promise.all(
    LANGUAGE_CODES.map(async (code) => [code, await loadCorpus(code)] as const),
  );
  return Object.fromEntries(entries) as Record<LanguageCode, LanguageCorpus>;
}
