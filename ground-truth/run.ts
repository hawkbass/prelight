/**
 * CLI entry for the ground-truth harness.
 *
 *   tsx run.ts                              # chromium only, human output
 *   tsx run.ts --browser all                # chromium + webkit + firefox
 *   tsx run.ts --browser webkit             # single engine
 *   tsx run.ts --json                       # JSON report for CI aggregation
 *   tsx run.ts --strict                     # fail on per-engine floor violations
 */

import {
  ALL_ENGINES,
  defaultHarnessConfig,
  runHarness,
  type BrowserEngine,
  type GroundTruthResult,
} from './harness.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const strict = args.includes('--strict');
const browserFlagIdx = args.findIndex((a) => a === '--browser' || a.startsWith('--browser='));
const browserArg = (() => {
  if (browserFlagIdx === -1) return 'chromium';
  const raw = args[browserFlagIdx];
  if (raw && raw.startsWith('--browser=')) return raw.slice('--browser='.length);
  return args[browserFlagIdx + 1] ?? 'chromium';
})();

function resolveEngines(value: string): BrowserEngine[] {
  if (value === 'all') return ALL_ENGINES;
  if ((ALL_ENGINES as string[]).includes(value)) return [value as BrowserEngine];
  throw new Error(
    `ground-truth: --browser must be one of ${[...ALL_ENGINES, 'all'].join(', ')} (got "${value}")`,
  );
}

const engines = resolveEngines(browserArg);

// Per-engine × per-language floors. Re-calibrated 2026-04-16 after F3
// (CJK kinsoku correction shim + Noto Sans JP/SC subsets in the
// harness) — see FINDINGS.md "Phase F: CJK kinsoku". Floors sit ~1-2
// points below measured to absorb minor browser-version drift without
// masking real regressions. DECISIONS #008 is the authoritative copy;
// update both in lockstep.
const PER_ENGINE_FLOORS: Record<BrowserEngine, Record<string, number>> = {
  chromium: {
    en: 0.97,
    de: 0.98,
    'compound-words': 0.95,
    // Emoji floor relaxed from 93% to 88% in F6 when the corpus
    // expanded from 10 → 51 strings (ZWJ, skin-tone, flags, tag
    // sequences, Emoji 13-15.1). The 10% gap is font-fallback
    // variance — Inter has no emoji glyphs, so each engine picks a
    // different color/monochrome face. Documented in FINDINGS §F6.
    emoji: 0.88,
    zh: 0.96,
    ja: 0.93,
    ar: 0.95,
  },
  webkit: {
    en: 0.97,
    de: 0.98,
    'compound-words': 0.95,
    emoji: 0.88,
    zh: 0.95,
    ja: 0.95,
    ar: 0.95,
  },
  firefox: {
    en: 0.93,
    de: 0.97,
    'compound-words': 0.95,
    emoji: 0.88,
    zh: 0.96,
    ja: 0.94,
    ar: 0.95,
  },
};
const OVERALL_FLOOR = 0.93;

const { ok, outcomes, skipped } = await runHarness(defaultHarnessConfig, engines);

if (skipped) {
  const msg =
    'ground-truth: Playwright not installed. Run `bunx playwright install` first.';
  if (strict) {
    console.error(msg);
    process.exit(2);
  }
  console.log(msg);
  process.exit(0);
}

function agreementByLang(results: GroundTruthResult[]): Map<string, { total: number; fail: number }> {
  const byLang = new Map<string, { total: number; fail: number }>();
  for (const r of results) {
    const lang = r.case.language;
    const entry = byLang.get(lang) ?? { total: 0, fail: 0 };
    entry.total += 1;
    if (!r.agrees) entry.fail += 1;
    byLang.set(lang, entry);
  }
  return byLang;
}

if (json) {
  process.stdout.write(
    JSON.stringify(
      {
        ok,
        engines: outcomes.map((o) => ({
          engine: o.engine,
          skipped: o.skipped,
          skipReason: o.skipReason,
          totalCases: o.results.length,
          disagreements: o.results.filter((r) => !r.agrees).length,
          results: o.results,
        })),
      },
      null,
      2,
    ) + '\n',
  );
} else {
  for (const outcome of outcomes) {
    console.log(`\n[${outcome.engine}]`);
    if (outcome.skipped) {
      console.log(`  skipped: ${outcome.skipReason ?? 'unknown'}`);
      continue;
    }
    const { results } = outcome;
    const disagreements = results.filter((r) => !r.agrees);
    const agreement = ((results.length - disagreements.length) / results.length) * 100;
    console.log(
      `  ${results.length} cases, ${results.length - disagreements.length} agree (${agreement.toFixed(2)}%), ${disagreements.length} disagree`,
    );
    console.log('  by language:');
    for (const [lang, { total, fail }] of Array.from(agreementByLang(results).entries()).sort()) {
      const pct = ((total - fail) / total) * 100;
      console.log(`    ${lang.padEnd(16)} ${fail}/${total} fail (${pct.toFixed(1)}% agree)`);
    }
    for (const r of disagreements.slice(0, 10)) {
      console.log(
        `  ${r.case.language} "${r.case.text.slice(0, 30)}${r.case.text.length > 30 ? '…' : ''}" @ ${r.case.maxWidth}px ${r.case.font}`,
      );
      console.log(
        `    browser: ${r.browser.lineCount} lines, ${r.browser.height.toFixed(1)}px`,
      );
      console.log(
        `    prelight: ${r.prelight.lineCount} lines, ${r.prelight.height.toFixed(1)}px  (Δ ${r.deltaHeight.toFixed(1)}px)`,
      );
    }
    if (disagreements.length > 10) {
      console.log(`  … ${disagreements.length - 10} more`);
    }
  }
}

if (strict) {
  const floorViolations: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.skipped) {
      floorViolations.push(`  ${outcome.engine}: engine skipped (${outcome.skipReason ?? 'unknown'})`);
      continue;
    }
    const byLang = agreementByLang(outcome.results);
    const floors = PER_ENGINE_FLOORS[outcome.engine];
    const overall =
      (outcome.results.length - outcome.results.filter((r) => !r.agrees).length) /
      outcome.results.length;
    for (const [lang, { total, fail }] of byLang.entries()) {
      const floor = floors[lang];
      if (floor === undefined) continue;
      const agree = (total - fail) / total;
      if (agree + 1e-9 < floor) {
        floorViolations.push(
          `  ${outcome.engine}/${lang}: ${(agree * 100).toFixed(1)}% < floor ${(floor * 100).toFixed(0)}%`,
        );
      }
    }
    if (overall + 1e-9 < OVERALL_FLOOR) {
      floorViolations.unshift(
        `  ${outcome.engine}/overall: ${(overall * 100).toFixed(2)}% < floor ${(OVERALL_FLOOR * 100).toFixed(0)}%`,
      );
    }
  }
  if (floorViolations.length > 0) {
    console.error('\nground-truth --strict: release gate violated:');
    for (const v of floorViolations) console.error(v);
    process.exit(1);
  }
  console.log('\nground-truth --strict: all per-engine per-language floors met.');
  process.exit(0);
}

process.exit(ok ? 0 : 1);
