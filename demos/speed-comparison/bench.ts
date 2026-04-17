/**
 * Speed comparison: Prelight vs. Playwright DOM measurement.
 *
 * Runs the same 36-cell verification workload N times per side and reports
 * mean / p50 / p95 / p99 / min / max. Both paths produce identical pass/fail
 * verdicts on this corpus; only the time taken differs.
 *
 * Playwright is launched by spawning Chromium directly and connecting via
 * `connectOverCDP` over WebSocket (see DECISIONS #012 for why). This path
 * is robust across Windows antivirus interposition and ephemeral-port
 * environments.
 *
 * Exit 0 on success. Exit 2 if Playwright is unavailable.
 */

import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureCanvasEnv, verify, type VerifySpec } from '@prelight/core';

const ITERATIONS_DEFAULT = 50;
const argIter = process.argv.find((a) => a.startsWith('--iterations='));
const ITERATIONS = argIter ? Number.parseInt(argIter.slice('--iterations='.length), 10) : ITERATIONS_DEFAULT;
const jsonOutput = process.argv.includes('--json');

interface Case {
  name: string;
  text: Record<string, string>;
  font: string;
  maxWidth: number;
  lineHeight: number;
  constraints: VerifySpec['constraints'];
  fontScales: number[];
}

const cases: Case[] = [
  {
    name: 'Button',
    text: {
      en: 'Get coverage',
      de: 'Rechtsschutzversicherungsgesellschaften',
      ar: 'احصل على تغطية',
      ja: '法的保護保険会社',
    },
    font: '16px sans-serif',
    maxWidth: 140,
    lineHeight: 20,
    constraints: { maxLines: 1, noOverflow: true },
    fontScales: [1, 1.25, 1.5],
  },
  {
    name: 'NavLink',
    text: {
      en: 'Settings',
      de: 'Einstellungen',
      ar: 'الإعدادات',
      ja: '設定',
    },
    font: '15px sans-serif',
    maxWidth: 96,
    lineHeight: 20,
    constraints: { maxLines: 1, noOverflow: true },
    fontScales: [1, 1.25, 1.5],
  },
  {
    name: 'Toast',
    text: {
      en: 'Something went wrong',
      de: 'Etwas ist schiefgelaufen',
      ar: 'حدث خطأ ما',
      ja: 'エラーが発生しました',
    },
    font: '14px sans-serif',
    maxWidth: 320,
    lineHeight: 18,
    constraints: { maxLines: 2 },
    fontScales: [1, 1.25, 1.5],
  },
];

const TOTAL_CELLS = cases.reduce(
  (n, c) => n + Object.keys(c.text).length * c.fontScales.length,
  0,
);

function percentiles(values: number[]): {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return {
    mean: values.reduce((s, v) => s + v, 0) / values.length,
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

async function runPrelightOnce(): Promise<number> {
  const start = performance.now();
  for (const c of cases) {
    verify(c as VerifySpec);
  }
  return performance.now() - start;
}

interface PlaywrightModule {
  chromium: {
    connectOverCDP(url: string): Promise<PlaywrightBrowser>;
    executablePath?(): string;
  };
}
interface PlaywrightBrowser {
  contexts(): { newPage(): Promise<PlaywrightPage> }[];
  newContext?(): Promise<{ newPage(): Promise<PlaywrightPage> }>;
  close(): Promise<void>;
}
interface PlaywrightPage {
  setContent(html: string): Promise<void>;
  evaluate: <T, A = unknown>(fn: (arg: A) => T, arg?: A) => Promise<T>;
}

async function launchChromium(
  pw: PlaywrightModule,
): Promise<{ browser: PlaywrightBrowser; cleanup: () => Promise<void> }> {
  const execPath = pw.chromium.executablePath?.();
  if (!execPath) throw new Error('Playwright did not report a Chromium executable path');
  const userDataDir = mkdtempSync(join(tmpdir(), 'prelight-bench-'));
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
    const timer = setTimeout(() => reject(new Error('Chromium did not print DevTools URL in 60s')), 60_000);
    child.stderr?.on('data', (buf: Buffer) => {
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf.toString('utf8'));
      if (m) {
        clearTimeout(timer);
        resolve(m[1]!);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited before printing CDP URL (code=${code})`));
    });
  });
  const browser = await pw.chromium.connectOverCDP(wsUrl);
  const cleanup = async () => {
    try {
      child.kill();
      await new Promise<void>((resolve) => {
        const fb = setTimeout(() => resolve(), 3000);
        child.once('exit', () => {
          clearTimeout(fb);
          resolve();
        });
      });
    } catch { /* shutdown path */ }
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* best effort */ }
  };
  return { browser, cleanup };
}

async function runPlaywrightOnce(page: PlaywrightPage): Promise<number> {
  const start = performance.now();
  for (const c of cases) {
    for (const lang of Object.keys(c.text)) {
      for (const scale of c.fontScales) {
        const text = c.text[lang]!;
        await page.evaluate(
          ({ text, font, maxWidth, scale }) => {
            const el = document.getElementById('probe')!;
            el.style.all = 'initial';
            el.style.display = 'inline-block';
            el.style.font = font.replace(/(\d+(?:\.\d+)?)px/, (_m: string, n: string) =>
              `${Number.parseFloat(n) * scale}px`,
            );
            el.style.maxWidth = `${maxWidth}px`;
            el.style.width = `${maxWidth}px`;
            el.style.whiteSpace = 'pre-wrap';
            el.style.overflow = 'hidden';
            el.textContent = text;
            const rect = el.getBoundingClientRect();
            return { width: rect.width, height: rect.height, scroll: el.scrollWidth };
          },
          { text, font: c.font, maxWidth: c.maxWidth, scale },
        );
      }
    }
  }
  return performance.now() - start;
}

async function main(): Promise<void> {
  if (!jsonOutput) {
    console.log(
      `Corpus: ${cases.length} components × 4 languages × 3 scales = ${TOTAL_CELLS} cells`,
    );
    console.log(`Iterations per side: ${ITERATIONS}`);
    console.log();
  }

  await ensureCanvasEnv();

  const prelightWarm = await runPrelightOnce();
  const prelightSamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    prelightSamples.push(await runPrelightOnce());
  }
  const prelight = percentiles(prelightSamples);

  let pw: PlaywrightModule | null = null;
  try {
    pw = (await import('playwright')) as unknown as PlaywrightModule;
  } catch {
    /* fall through */
  }

  let playwright: ReturnType<typeof percentiles> | null = null;
  let launchFailure: string | null = null;
  let launchMs = 0;
  if (pw) {
    try {
      const launchStart = performance.now();
      const { browser, cleanup } = await launchChromium(pw);
      launchMs = performance.now() - launchStart;
      const context = browser.contexts()[0] ?? (await browser.newContext?.());
      if (!context) throw new Error('no default context');
      const page = await context.newPage();
      await page.setContent('<body><div id="probe"></div></body>');
      // Warm the page so JIT / first compile costs don't pollute sample[0].
      await runPlaywrightOnce(page);
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        samples.push(await runPlaywrightOnce(page));
      }
      playwright = percentiles(samples);
      await browser.close();
      await cleanup();
    } catch (e) {
      launchFailure = e instanceof Error ? e.message : String(e);
    }
  }

  if (jsonOutput) {
    // `speedup` is the mean-over-mean ratio. We emit it explicitly so
    // CI (the Ubuntu full-stack job) can gate on "Prelight ≥ 10× faster
    // than a real browser round-trip" without re-deriving the number.
    // null when Playwright was unavailable — CI treats null as "no
    // bench signal" rather than a failing gate.
    const speedup =
      playwright !== null && prelight.mean > 0 ? playwright.mean / prelight.mean : null;
    console.log(
      JSON.stringify(
        {
          totalCells: TOTAL_CELLS,
          iterations: ITERATIONS,
          speedup,
          prelight: { ...prelight, warmup: prelightWarm },
          playwright:
            playwright !== null
              ? { ...playwright, launchMs }
              : { skipped: true, reason: launchFailure ?? 'playwright not installed' },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('Prelight (static, in-process):');
  console.log(
    `  mean ${prelight.mean.toFixed(2)}ms  p50 ${prelight.p50.toFixed(2)}ms  p95 ${prelight.p95.toFixed(2)}ms  p99 ${prelight.p99.toFixed(2)}ms`,
  );
  console.log(
    `  min ${prelight.min.toFixed(2)}ms  max ${prelight.max.toFixed(2)}ms  per-cell mean ${(prelight.mean / TOTAL_CELLS).toFixed(3)}ms`,
  );
  console.log(`  warmup ${prelightWarm.toFixed(2)}ms`);

  console.log();
  console.log('Playwright (DOM measurement):');
  if (!pw) {
    console.log('  skipped — playwright package not installed.');
    process.exit(2);
  }
  if (!playwright) {
    console.log(`  skipped — ${launchFailure}`);
    process.exit(2);
  }
  console.log(
    `  mean ${playwright.mean.toFixed(2)}ms  p50 ${playwright.p50.toFixed(2)}ms  p95 ${playwright.p95.toFixed(2)}ms  p99 ${playwright.p99.toFixed(2)}ms`,
  );
  console.log(
    `  min ${playwright.min.toFixed(2)}ms  max ${playwright.max.toFixed(2)}ms  per-cell mean ${(playwright.mean / TOTAL_CELLS).toFixed(2)}ms`,
  );
  console.log(`  launch cost ${launchMs.toFixed(0)}ms (one-time, excluded from samples)`);

  const speedup = playwright.mean / prelight.mean;
  console.log();
  console.log(`Prelight is ${speedup.toFixed(1)}× faster on the warm path (mean-vs-mean).`);
  console.log(
    `End-to-end (including Chromium launch), Prelight finishes ${((playwright.mean * ITERATIONS + launchMs) / (prelight.mean * ITERATIONS + prelightWarm)).toFixed(0)}× faster.`,
  );
}

await main();
