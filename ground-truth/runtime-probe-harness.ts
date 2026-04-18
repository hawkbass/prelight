/**
 * Ground-truth harness for the H7 runtime probe.
 *
 * For each fixture in `runtime-probe-fixtures.ts` we ask two
 * different engines the same question: "what does
 * `getComputedStyle(target)` return?" The two engines are:
 *
 *   1. Real browsers via Playwright (Chromium, WebKit, Firefox).
 *   2. happy-dom, the optional peer dependency
 *      `resolveStylesRuntime` uses.
 *
 * A fixture "agrees" when every measured property matches the
 * real-browser ground truth under a per-property equivalence
 * function (see `propertyMatches`). Real engines themselves
 * occasionally format the same value differently (`"Inter"` vs.
 * `Inter`, `30px` vs. `1.5` for unitless line-height); we fold
 * those out so the harness measures semantic agreement, not
 * string equality.
 *
 * The harness is intentionally decoupled from
 * `@prelight/react` — we want to test the happy-dom layer in
 * isolation. If the runtime probe's unit suite passes against
 * happy-dom AND happy-dom agrees with real browsers on the
 * properties the probe reads, then the probe agrees with real
 * browsers by construction.
 */

import { Window } from 'happy-dom';
import {
  RUNTIME_PROBE_FIXTURES,
  RUNTIME_PROBE_PROPERTIES,
  type RuntimeProbeFixture,
  type RuntimeProbeProperty,
} from './runtime-probe-fixtures.js';

export type RuntimeProbeEngine = 'chromium' | 'webkit' | 'firefox';

export const RUNTIME_PROBE_ENGINES: RuntimeProbeEngine[] = [
  'chromium',
  'webkit',
  'firefox',
];

export interface RuntimeProbeMeasurement {
  fixture: RuntimeProbeFixture;
  browserEngine: RuntimeProbeEngine;
  browserComputed: Record<RuntimeProbeProperty, string>;
  happyDomComputed: Record<RuntimeProbeProperty, string>;
  disagreements: Array<{
    property: RuntimeProbeProperty;
    browser: string;
    happyDom: string;
  }>;
  /** True iff `disagreements` is empty AND every `expected` hint matched the browser. */
  agrees: boolean;
  expectedViolations: Array<{
    property: RuntimeProbeProperty;
    expected: string;
    actual: string;
  }>;
}

export interface RuntimeProbeEngineOutcome {
  engine: RuntimeProbeEngine;
  measurements: RuntimeProbeMeasurement[];
  skipped: boolean;
  skipReason?: string;
}

export interface RuntimeProbeRunResult {
  ok: boolean;
  outcomes: RuntimeProbeEngineOutcome[];
  /** True when Playwright itself can't be loaded. */
  skipped: boolean;
}

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
    timeout?: number;
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

/**
 * Normalise a property value so trivial engine-format drift
 * doesn't count as a disagreement. We intentionally preserve
 * semantic differences (different pixel values = real
 * disagreement; quoted vs. unquoted font names = formatting).
 */
function normalise(prop: RuntimeProbeProperty, value: string): string {
  const raw = value.trim();
  if (prop === 'font-family') {
    // Strip surrounding quotes on each comma-separated family;
    // browsers are inconsistent about which ones they quote.
    return raw
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .join(', ');
  }
  if (prop === 'font-weight') {
    // Chromium returns "700"; some engines may map keywords.
    const kw: Record<string, string> = {
      normal: '400',
      bold: '700',
    };
    return kw[raw] ?? raw;
  }
  if (prop === 'line-height') {
    // Unitless `1.5` and computed `30px` are both spec-legal at
    // the "resolved value" stage. We still record both sides in
    // the report — just accept either for `expected`.
    return raw;
  }
  return raw;
}

function readExpected(
  value: string | RegExp | undefined,
  actual: string,
): { ok: boolean; expected?: string } {
  if (value === undefined) return { ok: true };
  if (value instanceof RegExp) {
    return { ok: value.test(actual), expected: value.toString() };
  }
  return { ok: actual === value, expected: value };
}

/**
 * Cheap check: did the fixture declare `<prop>:` anywhere in its
 * HTML? Real browsers report a used `width` for every laid-out
 * element (that's the value computed by the layout engine);
 * happy-dom has no layout engine, so it returns `""` when no
 * CSS rule set it. The runtime probe only wants the declared
 * value — a browser's layout-derived `width: 32px` for an
 * auto-sized `<button>` is meaningless as a style constraint.
 * So we treat a width disagreement as noise whenever the
 * fixture never declared `width`.
 */
function fixtureDeclares(prop: RuntimeProbeProperty, html: string): boolean {
  const escape = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[;\\s\"'])${escape}\\s*:`, 'i');
  return re.test(html);
}

function propertyMatches(
  prop: RuntimeProbeProperty,
  browser: string,
  happyDom: string,
  fixtureHtml: string,
): boolean {
  const b = normalise(prop, browser);
  const h = normalise(prop, happyDom);
  if (b === h) return true;
  // Layout-derived width/max-width isn't a style concern; skip
  // if the fixture never declared the property.
  if ((prop === 'width' || prop === 'max-width') && !fixtureDeclares(prop, fixtureHtml)) {
    return true;
  }
  // line-height: real browsers resolve unitless `1.5` at a
  // 20px element to `30px`. happy-dom historically returns the
  // raw declared value. CSS Values 4 treats both as legal
  // "resolved values", so cross-mode (unitless vs. pixel)
  // comparison is always accepted. Same-mode comparisons
  // (px vs. px, or unitless vs. unitless) still require
  // numeric equality — otherwise a real `18px` vs. `20px`
  // disagreement would be silently swallowed.
  if (prop === 'line-height') {
    if (b === 'normal' && h === 'normal') return true;
    if (b === h) return true;
    const bNum = parseFloat(b);
    const hNum = parseFloat(h);
    if (Number.isNaN(bNum) || Number.isNaN(hNum)) return false;
    const bUnitless = /^\d+(\.\d+)?$/.test(b);
    const hUnitless = /^\d+(\.\d+)?$/.test(h);
    // Different modes — treat as equivalent: we can't multiply
    // by font-size here without re-reading the element, and the
    // unit suite already pins font-size × unitless = px.
    if (bUnitless !== hUnitless) return true;
    // Same mode — require numeric equality.
    return Math.abs(bNum - hNum) < 0.01;
  }
  // max-width / width: treat "none" and "" equivalently — some
  // engines return "" for the initial value in inline contexts.
  if (prop === 'max-width' || prop === 'width') {
    if ((b === 'none' || b === '' || b === 'auto') && (h === 'none' || h === '' || h === 'auto'))
      return true;
  }
  return false;
}

async function measureHappyDom(
  fixture: RuntimeProbeFixture,
): Promise<Record<RuntimeProbeProperty, string>> {
  const window = new Window();
  try {
    const document = window.document;
    document.body.innerHTML = fixture.html;
    const target = document.querySelector(fixture.target) as unknown as Element;
    if (!target) {
      throw new Error(
        `runtime-probe ground-truth: selector "${fixture.target}" matched nothing in fixture ${fixture.id}`,
      );
    }
    const computed = window.getComputedStyle(target as Parameters<typeof window.getComputedStyle>[0]);
    const out = {} as Record<RuntimeProbeProperty, string>;
    for (const prop of RUNTIME_PROBE_PROPERTIES) {
      out[prop] = (computed.getPropertyValue(prop) ?? '').trim();
    }
    return out;
  } finally {
    await window.happyDOM.close();
  }
}

async function measureBrowser(
  page: PlaywrightPage,
  fixture: RuntimeProbeFixture,
): Promise<Record<RuntimeProbeProperty, string>> {
  return page.evaluate(
    (args: { html: string; target: string; props: string[] }) => {
      document.body.innerHTML = args.html;
      const el = document.querySelector(args.target);
      if (!el) {
        throw new Error(`runtime-probe ground-truth: selector ${args.target} did not match`);
      }
      const computed = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const prop of args.props) {
        out[prop] = (computed.getPropertyValue(prop) ?? '').trim();
      }
      return out;
    },
    {
      html: fixture.html,
      target: fixture.target,
      props: RUNTIME_PROBE_PROPERTIES as unknown as string[],
    },
  ) as Promise<Record<RuntimeProbeProperty, string>>;
}

async function launch(
  pw: PlaywrightModule,
  engine: RuntimeProbeEngine,
): Promise<PlaywrightBrowser> {
  const launcher =
    engine === 'chromium' ? pw.chromium : engine === 'webkit' ? pw.webkit : pw.firefox;
  return launcher.launch({ headless: true, timeout: 30_000 });
}

export async function runRuntimeProbeHarness(
  engines: RuntimeProbeEngine[] = ['chromium'],
  fixtures: RuntimeProbeFixture[] = RUNTIME_PROBE_FIXTURES,
): Promise<RuntimeProbeRunResult> {
  const pw = await loadPlaywright();
  if (!pw) {
    return { ok: false, outcomes: [], skipped: true };
  }

  const outcomes: RuntimeProbeEngineOutcome[] = [];
  for (const engine of engines) {
    let browser: PlaywrightBrowser | undefined;
    try {
      browser = await launch(pw, engine);
      const contexts = browser.contexts?.() ?? [];
      const context = contexts[0] ?? (browser.newContext ? await browser.newContext() : undefined);
      const page = context ? await context.newPage() : await browser.newPage!();
      await page.setContent(
        '<!doctype html><html><head></head><body></body></html>',
      );
      const measurements: RuntimeProbeMeasurement[] = [];
      for (const fixture of fixtures) {
        const browserComputed = await measureBrowser(page, fixture);
        const happyDomComputed = await measureHappyDom(fixture);
        const disagreements: RuntimeProbeMeasurement['disagreements'] = [];
        for (const prop of RUNTIME_PROBE_PROPERTIES) {
          if (!propertyMatches(prop, browserComputed[prop], happyDomComputed[prop], fixture.html)) {
            disagreements.push({
              property: prop,
              browser: browserComputed[prop],
              happyDom: happyDomComputed[prop],
            });
          }
        }
        const expectedViolations: RuntimeProbeMeasurement['expectedViolations'] = [];
        for (const prop of RUNTIME_PROBE_PROPERTIES) {
          const expected = fixture.expected?.[prop];
          const check = readExpected(expected, normalise(prop, browserComputed[prop]));
          if (!check.ok) {
            expectedViolations.push({
              property: prop,
              expected: check.expected ?? String(expected),
              actual: browserComputed[prop],
            });
          }
        }
        measurements.push({
          fixture,
          browserEngine: engine,
          browserComputed,
          happyDomComputed,
          disagreements,
          expectedViolations,
          agrees: disagreements.length === 0 && expectedViolations.length === 0,
        });
      }
      outcomes.push({ engine, measurements, skipped: false });
    } catch (err) {
      outcomes.push({
        engine,
        measurements: [],
        skipped: true,
        skipReason: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // Ignored: best-effort close on shutdown.
        }
      }
    }
  }

  const ok =
    outcomes.length > 0 &&
    outcomes.every((o) => !o.skipped && o.measurements.every((m) => m.agrees));
  return { ok, outcomes, skipped: false };
}
