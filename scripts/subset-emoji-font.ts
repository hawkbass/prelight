/**
 * Subsets Noto-COLRv1's monochrome outline layer down to just the
 * codepoints that appear in the ground-truth emoji corpus
 * (`corpus/languages/emoji.json`), producing the file the harness ships
 * in `ground-truth/fonts/NotoEmoji-subset.ttf`.
 *
 * Ships for v0.3 H6c alongside the existing `NotoSansJP-subset.ttf` /
 * `NotoSansSC-subset.ttf` subsets. Same pattern as F3's CJK fonts: the
 * harness registers the subset face on both sides — `@font-face` in
 * `bootstrap.html` so the browser renders it, `loadBundledFont` +
 * `setEmojiMeasurementFamilies` on the canvas side so `@napi-rs/canvas`
 * measures it — which eliminates font-fallback variance between the two
 * engines.
 *
 * Usage:
 *   bun scripts/subset-emoji-font.ts
 *   bun scripts/subset-emoji-font.ts --source <path/to/font.ttf>
 *
 * Without `--source` the script downloads the pinned upstream release
 * and caches it in `node_modules/.cache/prelight-emoji-font/` for
 * subsequent runs. With `--source` it reads the given path directly.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Why the harness uses monochrome outline emoji (not CBDT color bitmap)
 * ──────────────────────────────────────────────────────────────────────
 *
 * The harness only needs advance widths. `packages/core/src/shape/emoji.ts`
 * reads `ctx.measureText(grapheme).width` per cluster and writes the
 * result back into the layout — colour bitmap data is never consulted.
 * The font's job is to eliminate cross-engine fallback variance (both
 * `@napi-rs/canvas` and Chromium measure against the *same* face), not
 * to produce pretty rendering.
 *
 * Three upstream constraints steered us onto outline emoji. Full
 * diagnostic trail is in FINDINGS.md §H6c; summary:
 *
 *   1. The obvious source, `NotoColorEmoji.ttf`, is bitmap-only — 10.5 MB
 *      of CBDT/CBLC tables and *no* `glyf` outline fallback layer. Strip
 *      CBDT and you have a font with 0 glyph shapes, which OTS rejects
 *      outright and the browser ignores.
 *
 *   2. `subset-font@2.5.0` (the wrapper we use for the CJK subsets)
 *      pipes every input through `fontverter.convert(..., 'truetype')`
 *      before handing bytes to hb-subset. That converter rewrites the
 *      SFNT table directory to its supported set only and drops
 *      CBDT/CBLC on the way in. Output: a 20 KB stub with no glyphs.
 *
 *   3. Even bypassing `subset-font` and calling `harfbuzzjs`' WASM
 *      directly doesn't help: `harfbuzzjs@0.10.3` ships a WASM blob
 *      built with `-DHB_TINY` plus an override that re-enables CFF /
 *      LAYOUT / VAR / STYLE / VERTICAL — but *not* `HB_NO_COLOR` or
 *      `HB_NO_BITMAP`. The CBDT/COLR subsetter C++ simply isn't
 *      compiled in. Verified against
 *      `node_modules/.bun/harfbuzzjs@0.10.3/node_modules/harfbuzzjs/`
 *      `Makefile` and `config-override-subset.h`.
 *
 * The pivot: `Noto-COLRv1.ttf` is Google's modern color emoji font,
 * COLR/CPAL layered on top of a 3.4 MB `glyf` outline fallback. When
 * `subset-font` / fontverter converts it to 'truetype', the COLR/CPAL
 * tables are stripped (fontverter doesn't know them) but the `glyf`
 * outlines survive — monochrome silhouettes with full cmap/GSUB/hmtx,
 * subsettable by the tiny hb-subset, identical metrics on both engines.
 * That's the whole game.
 *
 * If `harfbuzzjs` one day ships a full-featured WASM (or we build our
 * own, or we write a CBDT grafter — see HANDOFF.md H6d) we can swap
 * this script back to CBDT color emoji without touching any other part
 * of the pipeline.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import subsetFont from 'subset-font';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

// Pinned to googlefonts/noto-emoji v2.051 (Unicode 17.0 update, Sep 2025).
// If the upstream URL moves, bump this constant, re-run the script, and
// update FINDINGS.md §H6c + the sha256 recorded below in the same commit.
const NOTO_COLRV1_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-emoji/v2.051/fonts/Noto-COLRv1.ttf';
const EXPECTED_SOURCE_SHA256 =
  '0ae57fe58645638523ba35f388d93739d292539a9acb84df5700c81b1e1a28d2';

const CACHE_DIR = resolve(REPO_ROOT, 'node_modules', '.cache', 'prelight-emoji-font');
const CACHED_SOURCE = resolve(CACHE_DIR, 'Noto-COLRv1.ttf');
const CORPUS_EMOJI = resolve(REPO_ROOT, 'corpus', 'languages', 'emoji.json');
const OUTPUT = resolve(REPO_ROOT, 'ground-truth', 'fonts', 'NotoEmoji-subset.ttf');

interface EmojiCorpus {
  strings: Record<string, string>;
}

function parseArgs(): { source: string | null } {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === '--source' || a.startsWith('--source='));
  if (idx === -1) return { source: null };
  const raw = args[idx] ?? '';
  if (raw.startsWith('--source=')) return { source: raw.slice('--source='.length) };
  return { source: args[idx + 1] ?? null };
}

async function fetchSource(): Promise<Buffer> {
  const cached = await stat(CACHED_SOURCE).catch(() => null);
  if (cached?.isFile()) {
    return readFile(CACHED_SOURCE);
  }
  await mkdir(CACHE_DIR, { recursive: true });
  console.log(`fetching  ${NOTO_COLRV1_URL}`);
  const res = await fetch(NOTO_COLRV1_URL);
  if (!res.ok) {
    throw new Error(`failed to download Noto-COLRv1: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(CACHED_SOURCE, buf);
  return buf;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Build the text hb-subset sees. Passing the raw corpus strings preserves
 * every ZWJ sequence, skin-tone modifier, variation selector, and regional-
 * indicator pair as a reachable glyph chain — hb-subset walks GSUB from
 * each codepoint and keeps any ligature substitutions that fire.
 *
 * We deliberately do NOT append extra variation selectors, skin-tone
 * modifiers, tag characters, or regional indicators beyond what the
 * corpus already contains. H6c experiments (see FINDINGS §H6c)
 * showed that adding them inflates the GSUB closure hb-subset walks
 * from ~625 KB to ~1.9 MB without measurably improving agreement,
 * because every corpus sequence that needs those codepoints already
 * contributes them transitively.
 */
function buildSubsetText(corpus: EmojiCorpus): string {
  return Object.values(corpus.strings).join('');
}

function countUniqueCodepoints(s: string): number {
  return new Set(Array.from(s, (ch) => ch.codePointAt(0))).size;
}

async function main(): Promise<void> {
  const { source } = parseArgs();
  const sourceBuf: Buffer = source ? await readFile(resolve(source)) : await fetchSource();
  const sourceSha = sha256(sourceBuf);
  console.log(`source    ${source ?? NOTO_COLRV1_URL}`);
  console.log(`          ${sourceBuf.byteLength.toLocaleString()} bytes, sha256 ${sourceSha}`);
  if (!source && sourceSha !== EXPECTED_SOURCE_SHA256) {
    console.warn(
      `warning: downloaded font sha256 differs from pinned EXPECTED_SOURCE_SHA256.\n` +
        `         expected ${EXPECTED_SOURCE_SHA256}\n` +
        `         actual   ${sourceSha}\n` +
        `         the subset will still be produced, but FINDINGS.md §H6c\n` +
        `         should be re-measured and the constant bumped.`,
    );
  }

  const corpusRaw = await readFile(CORPUS_EMOJI, 'utf8');
  const corpus = JSON.parse(corpusRaw) as EmojiCorpus;
  const text = buildSubsetText(corpus);
  const unique = countUniqueCodepoints(text);
  console.log(`corpus    ${Object.keys(corpus.strings).length} strings, ${unique} unique codepoints`);

  // `targetFormat: 'truetype'` is what we want here — fontverter rewrites
  // the SFNT directory to its supported set, which happens to discard
  // COLR / CPAL (the color-vector layers) while preserving the `glyf`
  // outline fallback. hb-subset then trims glyf/loca/hmtx/cmap/GSUB to
  // just our corpus codepoints. See the header comment for why the
  // alternative paths (CBDT via direct WASM, CBDT via grafter) are on
  // hold for v0.3.
  //
  // We do NOT pass `noLayoutClosure: true`: hb-subset's default walks
  // GSUB lookups transitively so keycap-, ZWJ-, flag-, and skin-tone-
  // ligature glyph IDs reachable from our corpus codepoints survive
  // into the subset. That matters for measurement agreement even
  // though we never render the font visibly: when a ligature is
  // present, HarfBuzz on both @napi-rs/canvas *and* Chromium resolves
  // the cluster to the single ligature glyph and both report the
  // ligature's advance width; when a ligature is absent, the browser
  // falls through to per-codepoint cascade across the @font-face
  // stack (some codepoints resolve to Inter, others to us) while the
  // canvas measures the whole cluster against us — and the two widths
  // diverge. Ground-truth H6c showed 6/408 over-wrap disagreements on
  // precisely the keycap-1..keycap-5 and England flag sequences when
  // closure was disabled; all 6 resolved once GSUB closure was
  // re-enabled. See FINDINGS §H6c.
  const subset = await subsetFont(sourceBuf, text, {
    targetFormat: 'truetype',
  });
  const subsetSha = sha256(subset);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, subset);
  const pctRemaining = (subset.byteLength / sourceBuf.byteLength) * 100;
  console.log(
    `subset    ${subset.byteLength.toLocaleString()} bytes (${pctRemaining.toFixed(2)}% of source), sha256 ${subsetSha}`,
  );
  console.log(`written   ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
