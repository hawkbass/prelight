/**
 * Measure the shipped size of every public Prelight package.
 *
 * For each package we:
 *   1. Bundle its entry with Bun, targeting node, externalising runtime
 *      peer deps (`@napi-rs/canvas`, `@chenglou/pretext`, `react`,
 *      `react-dom/*`, `@prelight/*` — anything a consumer installs
 *      themselves). This is the worst-case "cost of importing your
 *      package into a user's bundle" number.
 *   2. Minify.
 *   3. gzip the output and report both raw-minified and gzipped sizes.
 *
 * A budget file at `scripts/bundle-budget.json` declares the upper bound
 * per package. Regression beyond the budget exits non-zero so CI blocks
 * merges that would pad the shipped surface. Update the budget in the
 * same PR that intentionally grows the code.
 */

import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

interface Target {
  name: string;
  entry: string;
  externals: string[];
}

const TARGETS: Target[] = [
  {
    name: '@prelight/core',
    entry: 'packages/core/dist/index.js',
    externals: ['@napi-rs/canvas', '@chenglou/pretext'],
  },
  {
    name: '@prelight/react',
    entry: 'packages/react/dist/index.js',
    externals: [
      '@napi-rs/canvas',
      '@chenglou/pretext',
      '@prelight/core',
      'react',
      'react/*',
      'react-dom',
      'react-dom/server',
      // H7 runtime probe — loaded via dynamic import. `happy-dom`
      // is an optional peer dep (only installed when consumers
      // opt into `verifyComponent({ runtime: true })`);
      // `react-dom/client` is already a required peer. Both must
      // be external so the shipped surface measurement reflects
      // what consumers' bundlers actually absorb.
      'react-dom/client',
      'happy-dom',
    ],
  },
  {
    name: '@prelight/vitest',
    entry: 'packages/vitest/dist/index.js',
    externals: [
      '@napi-rs/canvas',
      '@chenglou/pretext',
      '@prelight/core',
      'vitest',
    ],
  },
  {
    name: '@prelight/jest',
    entry: 'packages/jest/dist/index.js',
    externals: [
      '@napi-rs/canvas',
      '@chenglou/pretext',
      '@prelight/core',
      'jest',
    ],
  },
  {
    name: '@prelight/cli',
    entry: 'packages/cli/dist/cli.js',
    externals: [
      '@napi-rs/canvas',
      '@chenglou/pretext',
      '@prelight/core',
      '@prelight/react',
      'react',
      'react/*',
      'react-dom',
      'react-dom/server',
    ],
  },
];

interface Measurement {
  name: string;
  minified: number;
  gzipped: number;
}

function bundle(target: Target): Measurement {
  const entryAbs = resolve(repoRoot, target.entry);
  if (!existsSync(entryAbs)) {
    throw new Error(`missing built entry for ${target.name}: ${entryAbs} (run "bun run build" first)`);
  }
  const externalArgs = target.externals.flatMap((e) => ['--external', e]);
  const result = spawnSync(
    'bun',
    ['build', entryAbs, '--minify', '--target=node', ...externalArgs],
    { encoding: 'buffer', cwd: repoRoot, shell: process.platform === 'win32' },
  );
  if (result.status !== 0) {
    const stderr = result.stderr?.toString('utf8') ?? '';
    throw new Error(`bun build failed for ${target.name}:\n${stderr}`);
  }
  const minified = result.stdout as Buffer;
  const gzipped = gzipSync(minified);
  return { name: target.name, minified: minified.byteLength, gzipped: gzipped.byteLength };
}

interface Budget {
  [pkg: string]: { minified: number; gzipped: number };
}

function loadBudget(): Budget | null {
  const p = resolve(here, 'bundle-budget.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as Budget;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(2)} KB`;
}

function main(): void {
  const jsonMode = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  const updateBudget = process.argv.includes('--update-budget');
  const budget = loadBudget();

  const measurements = TARGETS.map(bundle);

  if (jsonMode) {
    console.log(JSON.stringify({ measurements, budget }, null, 2));
  } else {
    console.log('Prelight bundle sizes (minified, gzipped):');
    console.log();
    for (const m of measurements) {
      const row = `  ${m.name.padEnd(20)} ${formatBytes(m.minified).padStart(10)} min   ${formatBytes(m.gzipped).padStart(10)} gz`;
      if (budget && budget[m.name]) {
        const b = budget[m.name]!;
        const overMin = m.minified > b.minified;
        const overGz = m.gzipped > b.gzipped;
        const flag = overMin || overGz ? '  [OVER BUDGET]' : '';
        console.log(`${row}  (budget ${formatBytes(b.minified)} min / ${formatBytes(b.gzipped)} gz)${flag}`);
      } else {
        console.log(`${row}  (no budget set)`);
      }
    }
  }

  if (updateBudget) {
    const newBudget: Budget = {};
    for (const m of measurements) {
      newBudget[m.name] = { minified: m.minified, gzipped: m.gzipped };
    }
    const { writeFileSync } = require('node:fs') as typeof import('node:fs');
    writeFileSync(resolve(here, 'bundle-budget.json'), JSON.stringify(newBudget, null, 2) + '\n');
    console.log('\nwrote scripts/bundle-budget.json');
    return;
  }

  if (strict) {
    if (!budget) {
      console.error('measure-bundle: --strict requires scripts/bundle-budget.json');
      process.exit(2);
    }
    const overages: string[] = [];
    for (const m of measurements) {
      const b = budget[m.name];
      if (!b) {
        overages.push(`${m.name}: no budget declared`);
        continue;
      }
      if (m.minified > b.minified) {
        overages.push(`${m.name}: minified ${formatBytes(m.minified)} > budget ${formatBytes(b.minified)}`);
      }
      if (m.gzipped > b.gzipped) {
        overages.push(`${m.name}: gzipped ${formatBytes(m.gzipped)} > budget ${formatBytes(b.gzipped)}`);
      }
    }
    if (overages.length > 0) {
      console.error('\nBundle budget regressions:');
      for (const o of overages) console.error(`  - ${o}`);
      console.error('\nEither simplify the code, or run `bun run measure-bundle:update` in the same PR.');
      process.exit(1);
    }
    console.log('\nAll bundles within budget.');
  }
}

main();
