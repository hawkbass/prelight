/**
 * One-shot analysis script for v0.3 H6b design.
 *
 * Mines a ground-truth JSON dump for emoji-specific failure patterns.
 * Defaults to the post-H5/H6a baseline captured 2026-04-17; pass a
 * filename to analyse a different dump.
 *
 * Usage:
 *   bun run scripts/analyze-emoji-disagreements.ts
 *   bun run scripts/analyze-emoji-disagreements.ts ground-truth/cross-engine-2026-04-16.json
 *
 * Not part of the shipped product. Safe to delete once H6b lands.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

interface GroundTruthCase {
  language: string;
  key: string;
  text: string;
  font: string;
  maxWidth: number;
  lineHeight: number;
}

interface GroundTruthResult {
  case: GroundTruthCase;
  engine: string;
  browser: { lineCount: number; height: number };
  prelight: { lineCount: number; height: number };
  deltaHeight: number;
  agrees: boolean;
}

interface CrossEngineDump {
  engines: Array<{
    engine: string;
    totalCases: number;
    disagreements: number;
    results: GroundTruthResult[];
  }>;
}

const here = dirname(fileURLToPath(import.meta.url));
const defaultDump = resolve(
  here,
  '..',
  'ground-truth',
  'emoji-baseline-2026-04-17.json',
);
const dumpPath = resolve(process.cwd(), process.argv[2] ?? defaultDump);
console.log(`analysing: ${dumpPath}\n`);
const dump = JSON.parse(readFileSync(dumpPath, 'utf8')) as CrossEngineDump;

for (const engine of dump.engines) {
  const emoji = engine.results.filter((r) => r.case.language === 'emoji');
  const emojiFail = emoji.filter((r) => !r.agrees);
  const emojiLineFail = emojiFail.filter((r) => r.browser.lineCount !== r.prelight.lineCount);
  const emojiHeightOnly = emojiFail.filter(
    (r) => r.browser.lineCount === r.prelight.lineCount && r.deltaHeight > 1,
  );

  console.log(`\n[${engine.engine}] emoji cases`);
  console.log(`  total          : ${emoji.length}`);
  console.log(
    `  agreeing       : ${emoji.length - emojiFail.length} (${(
      ((emoji.length - emojiFail.length) / emoji.length) *
      100
    ).toFixed(1)}%)`,
  );
  console.log(`  failing        : ${emojiFail.length}`);
  console.log(`    line count Δ : ${emojiLineFail.length}`);
  console.log(`    height Δ only: ${emojiHeightOnly.length}`);

  const lineDeltas = new Map<number, number>();
  for (const r of emojiLineFail) {
    const delta = r.prelight.lineCount - r.browser.lineCount;
    lineDeltas.set(delta, (lineDeltas.get(delta) ?? 0) + 1);
  }
  if (lineDeltas.size > 0) {
    console.log('  line-count Δ histogram (prelight − browser):');
    for (const [delta, count] of Array.from(lineDeltas.entries()).sort(
      (a, b) => a[0] - b[0],
    )) {
      const arrow = delta > 0 ? 'over-wrap' : delta < 0 ? 'under-wrap' : 'equal';
      console.log(`    ${delta > 0 ? '+' : ''}${delta}  (${arrow})  × ${count}`);
    }
  }

  const widthBuckets = new Map<number, { total: number; fail: number }>();
  for (const r of emoji) {
    const b = widthBuckets.get(r.case.maxWidth) ?? { total: 0, fail: 0 };
    b.total++;
    if (!r.agrees) b.fail++;
    widthBuckets.set(r.case.maxWidth, b);
  }
  console.log('  failure rate by maxWidth:');
  for (const [w, b] of Array.from(widthBuckets.entries()).sort((a, b) => a[0] - b[0])) {
    const pct = ((b.fail / b.total) * 100).toFixed(1);
    console.log(`    ${String(w).padStart(3)}px  ${b.fail}/${b.total}  (${pct}%)`);
  }

  const keys = new Map<string, { total: number; fail: number }>();
  for (const r of emoji) {
    const b = keys.get(r.case.key) ?? { total: 0, fail: 0 };
    b.total++;
    if (!r.agrees) b.fail++;
    keys.set(r.case.key, b);
  }
  const failingKeys = Array.from(keys.entries())
    .filter(([, b]) => b.fail > 0)
    .sort((a, b) => b[1].fail - a[1].fail);
  console.log(`  failing corpus keys: ${failingKeys.length}`);
  for (const [k, b] of failingKeys.slice(0, 20)) {
    const sample = emoji.find((r) => r.case.key === k)?.case.text ?? '';
    console.log(
      `    ${k.padEnd(28)} ${b.fail}/${b.total}  "${sample.slice(0, 24)}${sample.length > 24 ? '…' : ''}"`,
    );
  }
}
