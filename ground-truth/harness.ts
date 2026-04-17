/**
 * Ground-truth harness.
 *
 * Playwright renders each corpus string in a real browser at a real pixel
 * size, reads `getBoundingClientRect()` for height and computes `lineCount`
 * from `Range.getClientRects()`. Prelight computes the same numbers
 * statically. We assert they agree within tolerance and publish the
 * agreement number per-language, per-engine.
 *
 * Tolerance in v0.1.x:
 *   - height: ±1px (tightened from ±2px in F4 after RTL/CJK fixes)
 *   - lineCount: exact match
 *
 * Engines in v0.1.x:
 *   - Chromium: spawned manually over WebSocket CDP (see DECISIONS #012).
 *   - WebKit:   Playwright's normal `.launch()` path — the CDP pipe issue is
 *               Chromium-specific on Windows; WebKit uses its own protocol.
 *   - Firefox:  Playwright's normal `.launch()` path — Juggler protocol.
 *
 * PRELIGHT-FLAG: Arabic (RTL) agrees at only ~75% on Chromium pre-F2.
 * PRELIGHT-FLAG: CJK (ja/zh) agreement is 84–90% on Chromium pre-F3.
 * PRELIGHT-NEXT(v1.0): upstream fixes to Pretext's RTL tokeniser + CJK
 * metrics, then re-measure.
 */

import {
  applyFitsInOneLineCorrection,
  correctCJKLayout,
  correctEmojiLayout,
  correctRTLLayout,
  ensureCanvasEnv,
  loadBundledFont,
  setCJKMeasurementFamilies,
  setEmojiMeasurementFamilies,
} from '@prelight/core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadAllCorpora, type LanguageCorpus } from '../corpus/schema.js';
import { registerCorpusFonts } from '../corpus/fonts.js';

const __harnessDir = dirname(fileURLToPath(import.meta.url));
const NOTO_SANS_JP_SUBSET = resolve(__harnessDir, 'fonts', 'NotoSansJP-subset.ttf');
const NOTO_SANS_SC_SUBSET = resolve(__harnessDir, 'fonts', 'NotoSansSC-subset.ttf');
const NOTO_EMOJI_SUBSET = resolve(__harnessDir, 'fonts', 'NotoEmoji-subset.ttf');
const EMOJI_HARNESS_FAMILY = 'Prelight Noto Emoji';

export type BrowserEngine = 'chromium' | 'webkit' | 'firefox';

export const ALL_ENGINES: BrowserEngine[] = ['chromium', 'webkit', 'firefox'];

export interface GroundTruthCase {
  language: string;
  key: string;
  text: string;
  font: string;
  maxWidth: number;
  lineHeight: number;
}

export interface GroundTruthResult {
  case: GroundTruthCase;
  engine: BrowserEngine;
  browser: { lineCount: number; height: number };
  prelight: { lineCount: number; height: number };
  deltaHeight: number;
  agrees: boolean;
}

export interface HarnessConfig {
  widths: number[];
  fonts: string[];
  lineHeight: number;
  tolerancePx: number;
}

export interface EngineRunOutcome {
  engine: BrowserEngine;
  results: GroundTruthResult[];
  skipped: boolean;
  skipReason?: string;
}

export const defaultHarnessConfig: HarnessConfig = {
  widths: [80, 120, 200, 320],
  // Using the bundled Inter ensures every engine measures glyphs from the
  // same font file. Without this, a missing "Inter" falls back to each
  // browser's system sans-serif and cross-engine comparison becomes noise.
  fonts: ['14px Inter', '16px Inter'],
  lineHeight: 20,
  // Tightened from 2px to 1px in F4. Post-F3 measurements show every
  // disagreement is an integer multiple of the line-height (20px), so
  // a 1px tolerance is operationally identical to a 2px tolerance
  // while giving us sub-pixel drift detection if fonts ever change.
  // See FINDINGS.md §F4.
  tolerancePx: 1,
};

interface PlaywrightPage {
  setContent(html: string): Promise<void>;
  evaluate: <T, A = unknown>(fn: (arg: A) => T, arg?: A) => Promise<T>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
}

interface PlaywrightBrowser {
  newPage?(): Promise<PlaywrightPage>;
  newContext?(): Promise<PlaywrightContext>;
  contexts?(): PlaywrightContext[];
  close(): Promise<void>;
}

interface PlaywrightLauncher {
  launch(opts?: {
    headless?: boolean;
    args?: string[];
    channel?: string;
    timeout?: number;
    ignoreDefaultArgs?: string[] | boolean;
  }): Promise<PlaywrightBrowser>;
  connectOverCDP?(endpoint: string): Promise<PlaywrightBrowser>;
  executablePath?(): string;
}

interface PlaywrightModule {
  chromium: PlaywrightLauncher;
  webkit: PlaywrightLauncher;
  firefox: PlaywrightLauncher;
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    return (await import('playwright')) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
}

export function casesFromCorpus(
  corpus: Record<string, LanguageCorpus>,
  cfg: HarnessConfig,
): GroundTruthCase[] {
  const cases: GroundTruthCase[] = [];
  for (const [, langCorpus] of Object.entries(corpus)) {
    for (const [key, text] of Object.entries(langCorpus.strings)) {
      for (const font of cfg.fonts) {
        for (const maxWidth of cfg.widths) {
          cases.push({
            language: langCorpus.code,
            key,
            text,
            font,
            maxWidth,
            lineHeight: cfg.lineHeight,
          });
        }
      }
    }
  }
  return cases;
}

/**
 * Measure a case in any Playwright-controlled browser. Pure DOM: create a
 * fixed-width inline-block container, stuff the text, read the resulting
 * height and line count (via `Range.getClientRects`).
 */
export async function measureInBrowser(
  page: PlaywrightPage,
  c: GroundTruthCase,
): Promise<{ lineCount: number; height: number }> {
  return page.evaluate(
    (input: GroundTruthCase) => {
      const el = document.getElementById('probe')!;
      el.style.all = 'initial';
      el.style.display = 'inline-block';
      el.style.font = input.font;
      el.style.lineHeight = `${input.lineHeight}px`;
      el.style.width = `${input.maxWidth}px`;
      el.style.wordWrap = 'break-word';
      el.style.overflowWrap = 'break-word';
      el.style.whiteSpace = 'normal';
      el.textContent = input.text;

      const rect = el.getBoundingClientRect();
      // Use explicit line-height to derive line count.
      // Rationale: `Range.getClientRects()` over-reports lines in
      // Firefox when a line contains multiple bidi runs or font-face
      // transitions (e.g. Arabic text with a Latin token, or mixed
      // Inter + Noto Sans Arabic glyphs). Each run gets its own rect,
      // and baseline-alignment jitter between faces gives slightly
      // different `top` values — so the unique-`top` heuristic
      // inflates the count. Since we force `line-height` in pixels on
      // the container, `height / lineHeight` is an unambiguous
      // integer line count for all three engines.
      const lineCount = Math.max(1, Math.round(rect.height / input.lineHeight));
      return { lineCount, height: rect.height };
    },
    c,
  );
}

async function readFontBase64(relativePath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(new URL(relativePath, import.meta.url));
  return buffer.toString('base64');
}

interface BootstrapFonts {
  inter: string;
  arabic: string;
  jp: string;
  sc: string;
  emoji: string;
}

async function readBootstrapFonts(): Promise<BootstrapFonts> {
  const [inter, arabic, jp, sc, emoji] = await Promise.all([
    readFontBase64('../corpus/fonts/InterVariable.ttf'),
    readFontBase64('../corpus/fonts/NotoSansArabic.ttf'),
    readFontBase64('./fonts/NotoSansJP-subset.ttf'),
    readFontBase64('./fonts/NotoSansSC-subset.ttf'),
    readFontBase64('./fonts/NotoEmoji-subset.ttf'),
  ]);
  return { inter, arabic, jp, sc, emoji };
}

function bootstrapHtml(fonts: BootstrapFonts): string {
  // Stacked @font-face declarations for the SAME family name ("Inter").
  // The browser picks Inter's own glyphs for Latin, falls back to Noto
  // Sans Arabic for Arabic script, Noto Sans JP for Japanese (kana +
  // kanji), Noto Sans SC for Simplified Chinese code points that JP
  // doesn't already cover, and our monochrome Noto Emoji subset for
  // emoji pictograph blocks. This mirrors exactly what the canvas
  // backend sees after `registerCorpusFonts()` and the harness-only
  // CJK / emoji registrations in `runHarness` register the same files
  // under the "Inter" alias. See FINDINGS.md §F2 / §F3 / §H6c.
  //
  // Why the JP/SC split: Noto Sans SC is the authoritative CJK face
  // for Simplified Chinese, Noto Sans JP for Japanese. Their glyphs
  // for identical code points are visually and metrically distinct
  // (e.g., 保, 存, 的). Giving each script its own range keeps the
  // measurements faithful to what a production app with properly
  // localised fonts would produce.
  //
  // Why the emoji font is monochrome outline (not the CBDT color
  // bitmap most emoji fonts ship): see FINDINGS.md §H6c — bitmap
  // subsetting is blocked by a compile-time gate in the WASM build of
  // hb-subset that the npm ecosystem ships today. We subset
  // `Noto-COLRv1.ttf`'s glyf outline fallback layer instead. That layer
  // has identical advance widths to the colour layer, which is all the
  // measurement pipeline consumes.
  return `<!doctype html>
<html><head><style>
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.inter}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range: U+0000-05FF;
}
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.arabic}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range: U+0600-08FF, U+FB50-FDFF, U+FE70-FEFF;
}
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.jp}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range: U+3040-30FF, U+31F0-31FF, U+FF00-FFEF;
}
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.jp}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range: U+3400-4DBF, U+4E00-9FFF;
}
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.sc}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range: U+3400-4DBF, U+4E00-9FFF;
}
@font-face {
  font-family: 'Inter';
  src: url('data:font/ttf;base64,${fonts.emoji}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
  unicode-range:
    U+203C, U+2049, U+2122, U+2139, U+2194-2199, U+21A9-21AA,
    U+231A-231B, U+2328, U+23CF, U+23E9-23F3, U+23F8-23FA,
    U+24C2, U+25AA-25AB, U+25B6, U+25C0, U+25FB-25FE,
    U+2600-26FF, U+2700-27BF, U+2934-2935, U+2B00-2BFF,
    U+3030, U+303D, U+3297, U+3299, U+200D, U+20E3, U+FE0E-FE0F,
    U+1F000-1F02F, U+1F0A0-1F0FF, U+1F100-1F64F, U+1F680-1F6FF,
    U+1F700-1F77F, U+1F780-1F7FF, U+1F800-1F8FF, U+1F900-1F9FF,
    U+1FA00-1FAFF, U+1FB00-1FBFF, U+E0020-E007F;
}
body { margin: 0; padding: 0; }
#probe { font-family: Inter; }
</style></head><body><div id="probe"></div></body></html>`;
}

async function preparePage(
  browser: PlaywrightBrowser,
  fonts: BootstrapFonts,
): Promise<PlaywrightPage> {
  const contexts = browser.contexts?.() ?? [];
  const context: PlaywrightContext | undefined =
    contexts[0] ??
    (browser.newContext ? await browser.newContext() : undefined);
  let page: PlaywrightPage;
  if (context) {
    page = await context.newPage();
  } else if (browser.newPage) {
    page = await browser.newPage();
  } else {
    throw new Error('ground-truth: browser exposes neither context nor newPage');
  }
  await page.setContent(bootstrapHtml(fonts));
  await page.evaluate(async () => {
    const d = document as unknown as { fonts: { ready: Promise<unknown> } };
    await d.fonts.ready;
    return true;
  });
  return page;
}

export async function runHarness(
  cfg: HarnessConfig = defaultHarnessConfig,
  engines: BrowserEngine[] = ['chromium'],
): Promise<{
  ok: boolean;
  outcomes: EngineRunOutcome[];
  skipped: boolean;
}> {
  const pw = await loadPlaywright();
  if (!pw) {
    return { ok: false, outcomes: [], skipped: true };
  }
  await ensureCanvasEnv();
  await registerCorpusFonts();
  // Register the harness-only CJK + emoji subset fonts with the canvas
  // backend so the `correctCJKLayout` / `correctEmojiLayout` shims can
  // measure those scripts against the exact same font files the browser
  // loads via @font-face. See FINDINGS.md §F3 (CJK) and §H6c (emoji).
  // Consumers of @prelight/core would register their own CJK / emoji
  // fonts via `loadBundledFont` in production.
  await loadBundledFont(NOTO_SANS_JP_SUBSET, 'Noto Sans JP');
  await loadBundledFont(NOTO_SANS_SC_SUBSET, 'Noto Sans SC');
  await loadBundledFont(NOTO_EMOJI_SUBSET, EMOJI_HARNESS_FAMILY);
  setCJKMeasurementFamilies(['Noto Sans JP', 'Noto Sans SC']);
  setEmojiMeasurementFamilies([EMOJI_HARNESS_FAMILY]);

  const corpus = await loadAllCorpora();
  const cases = casesFromCorpus(corpus, cfg);
  const bootstrapFonts = await readBootstrapFonts();

  const outcomes: EngineRunOutcome[] = [];

  for (const engine of engines) {
    try {
      const { browser, cleanup } = await launchEngine(pw, engine);
      try {
        const page = await preparePage(browser, bootstrapFonts);
        const results: GroundTruthResult[] = [];
        const { prepareWithSegments, layoutWithLines } = (await import(
          '@chenglou/pretext'
        )) as typeof import('@chenglou/pretext');
        for (const c of cases) {
          const browserMeasure = await measureInBrowser(page, c);
          const prep = prepareWithSegments(c.text, c.font);
          const laid = layoutWithLines(prep, c.maxWidth, c.lineHeight);
          const natural = layoutWithLines(
            prepareWithSegments(c.text, c.font),
            Number.POSITIVE_INFINITY,
            c.lineHeight,
          );
          const naturalWidth = natural.lines[0]?.width ?? 0;
          // Apply the same post-correction the verifier applies, so the
          // ground-truth harness scores the *actual* Prelight prediction
          // consumers would see — not the pre-correction Pretext output.
          const fitOneLine = applyFitsInOneLineCorrection(
            laid,
            naturalWidth,
            c.maxWidth,
            c.lineHeight,
          );
          const rtlCorrected = correctRTLLayout(
            fitOneLine,
            c.text,
            c.font,
            c.maxWidth,
            c.lineHeight,
          );
          const cjkCorrected = correctCJKLayout(
            rtlCorrected,
            c.text,
            c.font,
            c.maxWidth,
            c.lineHeight,
          );
          const corrected = correctEmojiLayout(
            cjkCorrected,
            c.text,
            c.font,
            c.maxWidth,
            c.lineHeight,
          );
          const prelight = {
            lineCount: corrected.lineCount,
            height: corrected.height,
          };
          const deltaHeight = Math.abs(browserMeasure.height - prelight.height);
          const agrees =
            browserMeasure.lineCount === prelight.lineCount &&
            deltaHeight <= cfg.tolerancePx;
          results.push({
            case: c,
            engine,
            browser: browserMeasure,
            prelight,
            deltaHeight,
            agrees,
          });
        }
        outcomes.push({ engine, results, skipped: false });
      } finally {
        try {
          await browser.close();
        } catch {
          // Ignored: best-effort browser close on the shutdown path.
        }
        await cleanup();
      }
    } catch (err) {
      outcomes.push({
        engine,
        results: [],
        skipped: true,
        skipReason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok =
    outcomes.length > 0 &&
    outcomes.every(
      (o) => !o.skipped && o.results.every((r) => r.agrees),
    );
  // `skipped` means Playwright itself could not be loaded. Per-engine
  // launch failures are reported via each outcome's `skipped` flag and its
  // `skipReason`.
  return { ok, outcomes, skipped: false };
}

/**
 * Engine-specific launch.
 *
 * - Chromium: spawn the binary ourselves, parse the printed DevTools URL,
 *   connect via `connectOverCDP`. The pipe-based default transport hangs
 *   on some Windows machines (DECISIONS #012).
 * - WebKit / Firefox: normal `.launch()` path; they use their own protocols
 *   (WebKit's Remote Web Inspector Protocol, Firefox's Juggler) that do
 *   not exhibit the Chromium pipe-CDP Windows issue.
 */
async function launchEngine(
  pw: PlaywrightModule,
  engine: BrowserEngine,
): Promise<{ browser: PlaywrightBrowser; cleanup: () => Promise<void> }> {
  if (engine === 'chromium') {
    return launchChromiumViaCDP(pw);
  }
  const launcher = engine === 'webkit' ? pw.webkit : pw.firefox;
  const browser = await launcher.launch({ headless: true, timeout: 30_000 });
  return { browser, cleanup: async () => undefined };
}

async function launchChromiumViaCDP(
  pw: PlaywrightModule,
): Promise<{
  browser: PlaywrightBrowser;
  cleanup: () => Promise<void>;
}> {
  const { spawn } = await import('node:child_process');
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');

  const execPath = pw.chromium.executablePath?.();
  if (!execPath) {
    throw new Error(
      'ground-truth: Playwright did not report a Chromium executable path. Install browsers with `bunx playwright install chromium`.',
    );
  }

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prelight-chromium-'));

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-component-update',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  const child = spawn(execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('ground-truth: Chromium did not print a DevTools URL within 60s')),
      60_000,
    );
    const onData = (buf: Buffer) => {
      const line = buf.toString('utf8');
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(line);
      if (match) {
        clearTimeout(timer);
        child.stderr?.off('data', onData);
        resolve(match[1]!);
      }
    };
    child.stderr?.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`ground-truth: Chromium exited before printing CDP URL (code=${code})`));
    });
  });

  if (!pw.chromium.connectOverCDP) {
    throw new Error('ground-truth: Playwright chromium.connectOverCDP not available');
  }
  const browser = await pw.chromium.connectOverCDP(wsUrl);

  const cleanup = async () => {
    try {
      child.kill();
      await new Promise<void>((resolve) => {
        const fallback = setTimeout(() => resolve(), 3000);
        child.once('exit', () => {
          clearTimeout(fallback);
          resolve();
        });
      });
    } catch {
      // Ignored: we're on the shutdown path.
    }
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignored: best-effort cleanup of the temp profile dir.
    }
  };

  return { browser, cleanup };
}
