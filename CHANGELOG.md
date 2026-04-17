# Changelog

All notable changes to Prelight are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase F — v0.1.x quality hardening (2026-04-16)

- **Cross-engine ground-truth**: harness rewritten to be engine-agnostic;
  `ground-truth/run.ts --browser all` now sweeps **Chromium, WebKit, and
  Firefox** from a single command. Per-engine CDP/launch logic in
  `harness.ts` (ADR 012 notes still apply to Chromium on Windows).
  Per-engine × per-language floors published in `DECISIONS.md` §008 and
  enforced by `--strict`. (F1)
- **Arabic RTL correction** in `packages/core/src/shape/rtl.ts`:
  `correctRTLLayout` re-measures RTL strings with Noto Sans Arabic (now
  bundled at `corpus/fonts/NotoSansArabic.ttf`) and greedy-breaks at
  whitespace, honouring bidi direction. Mirrored in the harness via a
  second `@font-face` for `Inter` with `unicode-range` covering the
  Arabic Unicode blocks. Arabic agreement: **77% → 98%** on every
  engine. (F2)
- **CJK kinsoku correction** in `packages/core/src/shape/cjk.ts`:
  `correctCJKLayout` per-character greedy-breaks CJK text with kinsoku
  rules (closing punctuation / small kana / `ー` / `…` never start a
  line, brackets never end one), using a caller-registered CJK face for
  width metrics. Harness bundles Google Fonts subsetted
  `NotoSansJP-subset.ttf` (74 KB) and `NotoSansSC-subset.ttf` (41 KB)
  in `ground-truth/fonts/` and registers them under `Noto Sans JP` /
  `Noto Sans SC`. Browser @font-face stack mirrors this for every
  engine. CJK agreement: **85–90% → 95–99%**. (F3)
- **Tolerance tightened from ±2px to ±1px** (`tolerancePx: 1` in
  `defaultHarnessConfig`). All post-F3 disagreements are integer
  multiples of the 20 px line-height, so this is a zero-regression
  tightening that catches sub-pixel font drift. README, LAUNCH, thesis,
  AGENTS, DECISIONS #008, and the stats card swept. (F4)
- **Line-count heuristic**: harness replaces the
  `unique-top-of-getClientRects()` line counter with
  `round(height / lineHeight)`. Firefox's bidi/font-face run splitting
  was over-reporting lines on mixed CJK+Latin and Arabic+Latin
  strings; with a forced CSS `line-height` the height-based count is
  exact for every engine.
- **New public API surface** in `@prelight/core`:
  `containsRTL`, `correctRTLLayout`, `applyFitsInOneLineCorrection`,
  `containsCJK`, `correctCJKLayout`, `setCJKMeasurementFamilies`,
  `getCJKMeasurementFamilies`, plus `LayoutLike` / `LineLike` types.
- **Ubuntu full-stack CI** (`.github/workflows/ubuntu-full.yml`):
  push-to-main + weekly-Monday + manual-dispatch job that runs
  typecheck, build, tests, bundle budget (strict), Playwright
  install (Chromium+WebKit+Firefox), ground-truth `--strict --browser all`,
  and the speed-comparison bench with a 10× speedup floor. Explicit
  release-candidate gate for F7. Rationale in DECISIONS #015. (F5)
- **Emoji corpus 10 → 51 strings**: ZWJ sequences (families,
  professions, pirate/rainbow/trans flags), all 5 Fitzpatrick skin
  tones, regional-indicator flags, subdivision-tag flags (Scotland,
  England), keycaps, variation selectors, Emoji 13-15.1 additions
  (🫀 🫡 🫨 🙂‍↕️ …). Corpus cells: 600 → 928. Emoji agreement 90 %
  across all three engines — the 10 % gap is font-fallback variance
  (Inter has no emoji glyphs), not a layout bug; documented in
  `FINDINGS.md §F6` and floors adjusted in DECISIONS #008. (F6)
- **Release-gate numbers** (DECISIONS.md §008, enforced by
  `ground-truth --strict --browser all`):
  - Chromium 94.50 % overall / 97.9 %+ non-emoji (floor 93 %)
  - WebKit   94.72 % overall / 97.9 %+ non-emoji (floor 93 %)
  - Firefox  94.29 % overall / 97.9 %+ non-emoji (floor 93 %)

### Phase E — evidence closeout (2026-04-16)

- **Per-package publish surface**: every `@prelight/*` package ships its
  own `README.md` and `LICENSE`. `npm pack --dry-run` is warning-free for
  all five public packages. Top-level `CONTRIBUTING.md`, `SECURITY.md`,
  and GitHub issue/PR templates added.
- **Bundled Inter Variable v4.1** at `corpus/fonts/InterVariable.ttf`
  (SIL OFL). New `loadBundledFont(path, alias?)` in `@prelight/core` and a
  `registerCorpusFonts()` helper in `corpus/fonts.ts`. Ground-truth and
  benchmarks now measure against a deterministic, version-pinned font.
- **Ground-truth runs green under `--strict`**. Measured 91.83% overall
  corpus agreement with Chromium across 600 cases; per-language floors
  (en 98%, de 99%, compound-words 95%, emoji 93%, zh 88%, ja 84%,
  ar 75%) are committed in ADR 008 and enforced by CI.
- **Real Playwright-vs-Prelight numbers**: 50 iterations per side.
  Prelight 0.88 ms mean / 0.024 ms per cell; Playwright 20.35 ms mean /
  0.57 ms per cell. **23.2× faster on the warm path, 20× end-to-end.**
  Full table in `demos/speed-comparison/RESULTS.md`.
- **Chromium launch on Windows**: manual spawn + `connectOverCDP` over
  WebSocket. Documented in ADR 012. Ground-truth and speed-comparison
  now both run reliably on Windows/Defender machines.
- **Test coverage**: 74 tests total. Jest package gains a dist-based
  integration test (5 tests) running under Node's
  `--experimental-vm-modules`. CLI gains 22 unit tests covering
  `config.ts`, `reporter.ts`, and `cli.ts`. All `--passWithNoTests`
  flags removed.
- **Site narratives**: `site/index.html` now embeds three real,
  unedited demo outputs (failing German button, dogfood library CI run,
  speed comparison). Stats card shows the measured 23× and 91.83%
  numbers instead of placeholders.
- **Bundle budget**: `scripts/measure-bundle.ts` produces minified +
  gzipped numbers per package, compares to `scripts/bundle-budget.json`,
  and `bun run measure-bundle:strict` gates CI. Current: core 6.20 KB /
  2.61 KB gz; react 924 B / 510 B gz; vitest 951 B / 538 B gz; jest
  1.07 KB / 630 B gz; cli 4.11 KB / 1.82 KB gz. Total shipped:
  **13.2 KB / 6.1 KB gz**. Policy in ADR 014.
- **ADRs added in Phase E**: 012 (WebSocket CDP), 013 (ground-truth on
  `tsx`/Node), 014 (bundle budget).

### Added

- **Core verifier** (`@prelight/core`): `verify()` with matrix sweep over
  languages × widths × font scales. `Measurement` now carries
  `naturalWidth` for accurate overflow reporting.
- **Predicates** (`@prelight/core`): `noOverflow`, `maxLines`, `minLines`,
  `linesExact`, `fitsAtScale`, `singleLine`, `noTruncation`. Each with
  unit tests and diagnostic messages.
- **Font handling** (`@prelight/core/src/font.ts`): CSS font-shorthand
  parser, `scaleFont()`, and a `@napi-rs/canvas`-backed
  `OffscreenCanvas` polyfill so Pretext measurement works under Node and
  Bun. `ensureCanvasEnv()` is async (bootstrap-once); `assertCanvasReady()`
  is a sync guard used by the verifier.
- **React adapter** (`@prelight/react`): `verifyComponent()`,
  `extractText()`, and an HTML-to-text stripper driven by
  `react-dom/server`.
- **Vitest matcher** (`@prelight/vitest`): `expect(spec).toLayout(options)`
  with full TypeScript augmentation.
- **Jest matcher** (`@prelight/jest`): mirror of the Vitest matcher.
- **CLI** (`@prelight/cli`): `prelight` binary with TS/TSX config loader,
  runner, terminal + JSON reporters, and correct non-zero exit codes.
- **Corpus**: curated strings for English, German, Arabic, Japanese,
  Chinese, emoji, and compound-word stress cases in
  `corpus/languages/*.json` plus a schema/loader.
- **Demos**:
  - `demos/failing-german-button` — Vitest suite that passes English and
    fails German on the same component.
  - `demos/dogfood-library` — 4-component library with a
    `prelight.config.tsx` driving the CLI; surfaces real overflow bugs
    in Arabic and German at 1.5× scale.
  - `demos/speed-comparison` — head-to-head benchmark between Prelight
    and Playwright with timeout-guarded launch, documenting the "launch
    failed" case as the thing Prelight eliminates.
- **Ground-truth harness** (`ground-truth/`): Playwright-driven
  comparison against Chromium with a declared tolerance (±2px height,
  exact line count) and a `--strict` CI flag.
- **Site** (`site/`): landing page, thesis markdown, and an
  in-browser Pretext playground (`site/playground.html`).
- **Governance**: `README.md`, `ROADMAP.md`, `DECISIONS.md`
  (11 ADRs), `FINDINGS.md` with dated empirical entries,
  `DEVELOPMENT.md`, `CHANGELOG.md`, `LICENSE`, root `tsconfig`,
  `bunfig.toml`, `.editorconfig`, `.gitattributes`.
- **CI**: `.github/workflows/ci.yml` (build + test across
  Ubuntu/macOS/Windows), `ground-truth.yml` (nightly browser
  agreement), `prelight-dogfood.yml` (CLI smoke gate).

### Decisions

- Added ADR 009 (canvas polyfill via `@napi-rs/canvas`), 010 (`.tsx`
  config preference), 011 (async bootstrap / sync verifier split).

### Deferred to 0.2.0 and beyond

See [ROADMAP.md](./ROADMAP.md) for the full list of `PRELIGHT-NEXT`
markers. v0.1 intentionally excludes flex/grid/image-slot verification,
hyphenation, and runtime pre-render guards.
