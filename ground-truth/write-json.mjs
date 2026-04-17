import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const result = spawnSync(process.execPath, [
  // Use the same tsx loader used elsewhere.
  '--import',
  new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url).href,
  'run.ts',
  '--json',
  '--browser',
  'all',
], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
writeFileSync('cross-engine-2026-04-16.json', result.stdout, { encoding: 'utf8' });
console.log('wrote', result.stdout.length, 'bytes, exit', result.status);
