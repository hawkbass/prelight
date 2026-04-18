/**
 * CLI entry for the H7 runtime-probe ground-truth harness.
 *
 *   tsx runtime-probe-run.ts                     # chromium
 *   tsx runtime-probe-run.ts --browser all       # chromium + webkit + firefox
 *   tsx runtime-probe-run.ts --browser webkit
 *   tsx runtime-probe-run.ts --json
 *   tsx runtime-probe-run.ts --strict            # exit non-zero on any disagreement
 *
 * See `runtime-probe-harness.ts` for what "agreement" means.
 */

import {
  RUNTIME_PROBE_ENGINES,
  runRuntimeProbeHarness,
  type RuntimeProbeEngine,
} from './runtime-probe-harness.js';

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

function resolveEngines(value: string): RuntimeProbeEngine[] {
  if (value === 'all') return RUNTIME_PROBE_ENGINES;
  if ((RUNTIME_PROBE_ENGINES as string[]).includes(value)) {
    return [value as RuntimeProbeEngine];
  }
  throw new Error(
    `runtime-probe ground-truth: --browser must be one of ${[...RUNTIME_PROBE_ENGINES, 'all'].join(', ')} (got "${value}")`,
  );
}

const engines = resolveEngines(browserArg);
const { ok, outcomes, skipped } = await runRuntimeProbeHarness(engines);

if (skipped) {
  const msg =
    'runtime-probe ground-truth: Playwright not installed. Run `bunx playwright install` first.';
  if (strict) {
    console.error(msg);
    process.exit(2);
  }
  console.log(msg);
  process.exit(0);
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
          total: o.measurements.length,
          disagreements: o.measurements.filter((m) => !m.agrees).length,
          measurements: o.measurements,
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
    const ms = outcome.measurements;
    const bad = ms.filter((m) => !m.agrees);
    const pct = ((ms.length - bad.length) / ms.length) * 100;
    console.log(
      `  ${ms.length} fixtures, ${ms.length - bad.length} agree (${pct.toFixed(2)}%), ${bad.length} disagree`,
    );
    for (const m of bad) {
      console.log(`  ${m.fixture.id}: ${m.fixture.concern}`);
      for (const d of m.disagreements) {
        console.log(
          `    ${d.property}: browser="${d.browser}"  happy-dom="${d.happyDom}"`,
        );
      }
      for (const v of m.expectedViolations) {
        console.log(
          `    expected ${v.property} ~= ${v.expected}, browser returned "${v.actual}"`,
        );
      }
    }
  }
}

if (strict) {
  process.exit(ok ? 0 : 1);
}

process.exit(0);
