/**
 * SFNT table inspector for the emoji subset pipeline. Lists the tables
 * in the source Noto-COLRv1 and the harness subset so we can see
 * whether `CBDT`/`CBLC` (color bitmaps), `COLR`/`CPAL` (color layers),
 * `sbix` (Apple color bitmaps), `SVG`, and the `glyf` outline fallback
 * survive each step.
 *
 * Shipped alongside `subset-emoji-font.ts` for v0.3 H6c as a
 * diagnostic the next investigator can run without re-discovering
 * which tables live where. It's also the tool that falsified the
 * first two subsetter attempts documented in FINDINGS.md §H6c — if
 * `CBDT` is gone in the subset output this script will show it.
 *
 *   bun scripts/probe-emoji-tables.ts
 *   # or: npx tsx scripts/probe-emoji-tables.ts
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

function listTables(buf: Buffer): Array<{ tag: string; length: number }> {
  const numTables = buf.readUInt16BE(4);
  const tables: Array<{ tag: string; length: number }> = [];
  for (let i = 0; i < numTables; i += 1) {
    const off = 12 + i * 16;
    const tag = buf.slice(off, off + 4).toString('ascii');
    const length = buf.readUInt32BE(off + 12);
    tables.push({ tag, length });
  }
  return tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
}

function report(label: string, path: string, buf: Buffer): void {
  console.log(`\n${label} (${path})`);
  console.log(`  size ${buf.byteLength.toLocaleString()} bytes`);
  const tables = listTables(buf);
  console.log(`  ${tables.length} tables:`);
  for (const { tag, length } of tables) {
    console.log(`    ${tag.padEnd(4)} ${length.toLocaleString().padStart(12)} bytes`);
  }
}

const colrv1Path = resolve(REPO, 'node_modules', '.cache', 'prelight-emoji-font', 'Noto-COLRv1.ttf');
const subsetPath = resolve(REPO, 'ground-truth', 'fonts', 'NotoEmoji-subset.ttf');

await readFile(colrv1Path)
  .then((b) => report('Noto-COLRv1 source (COLR + outline)', colrv1Path, b))
  .catch(() => {});
await readFile(subsetPath)
  .then((b) => report('NotoEmoji subset (after subset-font + fontverter)', subsetPath, b))
  .catch(() => {});
