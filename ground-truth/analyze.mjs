import { readFileSync } from 'node:fs';
let raw = readFileSync('cross-engine-2026-04-16.json', 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const data = JSON.parse(raw);
for (const engine of data.engines) {
  console.log(`\n=== ${engine.engine} ar ===`);
  const ar = engine.results.filter((r) => r.case.language === 'ar');
  const patterns = new Map();
  for (const r of ar) {
    const k = `browser=${r.browser.lineCount} prelight=${r.prelight.lineCount} ${r.agrees ? 'AGREE' : 'FAIL'}`;
    patterns.set(k, (patterns.get(k) || 0) + 1);
  }
  for (const [k, v] of [...patterns.entries()].sort()) console.log(`  ${v.toString().padStart(3)}  ${k}`);
  // Which widths does browser say 1 for?
  const browser1 = ar.filter((r) => r.browser.lineCount === 1).length;
  const browser2 = ar.filter((r) => r.browser.lineCount === 2).length;
  const browser3plus = ar.filter((r) => r.browser.lineCount >= 3).length;
  console.log(`  browser: 1-line=${browser1} 2-line=${browser2} 3+line=${browser3plus}`);
}
