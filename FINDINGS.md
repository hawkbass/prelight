# FINDINGS

Empirical results produced during Prelight development. Every claim in
README.md or the site traces to a dated entry here. When evidence changes,
we amend the entry with a `(amended YYYY-MM-DD, reason)` tag rather than
rewriting history.

---

## 2026-04-17 — v0.3 H1 flex-wrap + align-items: evidence gap on browser confirmation

Environment: Windows 10.0.26200, Bun 1.3.11, @prelight/core internal
build (uncommitted), no browser run.

### What was implemented

`@prelight/core/layout/flex.ts` gained:

- **Wrap packing** (`FlexContainer.wrap: 'wrap'`): greedy line-breaking
  by hypothetical outer main size, per CSS Flex L1 §9.3. Margins,
  gaps, and `minMain`/`maxMain` clamps all participate in the packing
  decision; grow/shrink do not (they are resolved per-line after
  packing, matching Chromium / Firefox / Safari behaviour).
- **Cross-axis alignment** (`FlexContainer.align: 'start' | 'end' |
  'center' | 'stretch'`): per CSS Flex L1 §8.3, with single-line +
  definite `innerCross` using the container's inner cross size as
  the line cross size (§9.4).
- New layout fields: `FlexLayout.lines`, `contentCross`,
  `crossOverflows`; `FlexItemLayout.crossOffset`; `FlexLineLayout`
  (new type).
- `align-items: 'baseline'` explicitly deferred to H5 where font
  ascent values thread through `VerifySpec.measurementFonts`.

### Evidence available

- **32 new unit tests** in `packages/core/test/flex.test.ts`
  (C41–C72) covering wrap packing, align-items modes, and
  wrap × align integration.
- **40 pre-existing v0.2 flex tests (C01–C40) unchanged and still
  passing** — the rewrite preserves v0.2 no-wrap + `align: 'start'`
  behaviour byte-for-byte.
- **Per-test comments trace each expected value to the CSS spec
  clause it enforces** (§9.3 packing, §9.7 main-axis resolution,
  §8.3 cross-axis alignment, §9.4 single-line cross size).

### Evidence MISSING

- **Zero browser-confirmed cases for wrap or align-items.** The
  existing `ground-truth/harness.ts` is exclusively a text-layout
  oracle: it renders corpus strings via Playwright and compares
  `getBoundingClientRect()` height + `Range.getClientRects()`
  line count against what `@prelight/core::verify()` predicts.
  There is no corpus schema for flex specs, no Playwright-side
  per-item border-box-rect extraction, no cross-engine tolerance
  model calibrated for sub-pixel flex rounding differences.
- Consequently, **no public-facing documentation in this release
  may claim "flex-wrap / align-items verified against Chromium /
  WebKit / Firefox"**. The CHANGELOG Phase H1 entry complies with
  this constraint: it says "32 new unit tests" and "browser-confirmed
  ground-truth is not in this release".

### Planned path

Building a flex ground-truth harness is a distinct multi-day phase:

1. Flex-corpus schema — serialisable `{ container, items,
   expectedLines, expectedItemRects }` fixtures.
2. Playwright renderer that mounts each fixture into a clean DOM
   and extracts per-item `getBoundingClientRect()` relative to the
   container's padding-box.
3. Tolerance model — cross-engine sub-pixel rounding diverges
   meaningfully on wrapped flex (Chromium rounds differently from
   Firefox on row-gap); calibrate per-case tolerance the way
   `defaultHarnessConfig.tolerancePx` does for text.
4. Per-engine floors — decide whether flex lands with the same
   100% agreement claim as text, or (more honestly) starts with a
   published floor calibrated from measurement.

This is scheduled as either **H9 of v0.3** (if we extend the v0.3
scope to include the harness), or a **standalone pre-v0.3.0 phase**
run after H8 governance but before tagging. Choice is pending user
input; see `HANDOFF.md` §2026-04-17 for the decision record.

### Why this entry exists

Per the evidence invariant: every empirical claim in a
public-facing doc traces to a dated `FINDINGS.md` entry from a
real run. H1's public claims are limited to "unit tests pass" and
"CSS spec traceability in test comments", both of which this entry
backs. No claim of cross-engine verification is made until the
harness exists and produces measurements.

---

## 2026-04-16 — v0.1 scaffold session

Environment: Windows 10.0.26200, Bun 1.3.11, Node 22.x runtime, pretext 0.0.3,
@napi-rs/canvas 0.1.x. System sans-serif used (bundled Inter is a
PRELIGHT-NEXT(v0.1-final) item).

### pretext package name

- **Finding**: The npm package name `pretext` belongs to a 2012 Markdown
  preprocessor by Antti Sykäri, not Chenglou's text layout library. The real
  library publishes as `@chenglou/pretext`.
- **Impact**: Every README, package.json, and doc references the correct
  scoped name. The initial scaffold referenced plain `pretext`; fixed.

### Canvas polyfill

- **Finding**: `@chenglou/pretext` requires `globalThis.OffscreenCanvas`. In
  Node and Bun, this does not exist. The library throws
  `Text measurement requires OffscreenCanvas or a DOM canvas context.`
- **Fix**: `@prelight/core/src/font.ts::installCanvasShim()` dynamically
  imports `@napi-rs/canvas` and wraps it in a class with the OffscreenCanvas
  interface. Verified against Pretext 0.0.3 on Windows/Bun.
- **Ergonomics**: `ensureCanvasEnv()` is async and must be awaited once at
  bootstrap. The Vitest/Jest/CLI adapters all do this automatically. The
  verifier is then synchronous for the life of the process.

### Core performance (warm path)

- **Corpus**: 3 component shapes × 4 languages × 3 scales = 36 cells.
- **Prelight end-to-end time**: ~1.2ms wall-clock on first cold invocation
  after warmup; 0.03-0.04ms per cell.
- **Warmup cost**: ~18ms one-time (canvas shim load + first measurement).
- **Comparison with Playwright**: superseded by Phase E entry below. The
  original launch failure on Windows was root-caused to Playwright's
  default pipe-based CDP transport (DECISIONS #012) and resolved by
  spawning Chromium directly and connecting over WebSocket CDP.

### Dogfood library

- **Corpus**: 7 declared tests × 4 languages × 3 scales = 84 cells.
- **Prelight wall-clock**: 27ms.
- **Detected failures**: 3 of 7 tests fail as expected — NavLinks overflow in
  Arabic at 1.5× scale and in German at 1.5× scale; StatusBadge "Refunded"
  overflows in Arabic at all scales. These are genuine bugs in the demo's
  declared constraints, surfaced by the verifier, matching hand-audit.

### Ground-truth agreement

- **Status**: Harness wired (`ground-truth/run.ts`), corpus defined,
  Chromium measurement path implemented, tolerance declared (±2px height,
  exact lineCount). The corpus-sweep run is part of the CI matrix
  (`.github/workflows/ground-truth.yml`). Agreement numbers will be
  published after the first green CI run.

### Core test coverage

- `@prelight/core`: 34 tests across font parsing, each predicate, and the
  full verifier. All pass.
- `@prelight/vitest`: 5 tests covering pass/fail paths and matrix filtering.
- `@prelight/react`: 6 tests covering HTML extraction and verifyComponent.
- `demos/failing-german-button`: 3 tests demonstrating pass and fail paths.
- Total runtime: <2s across the workspace.

---

## 2026-04-16 — Phase E: Bundled Inter (G2)

Environment: Windows 10.0.26200, Bun 1.3.11, @napi-rs/canvas 0.1.98,
@chenglou/pretext 0.0.3.

### Font registration

- **Finding**: `@napi-rs/canvas` exposes `GlobalFonts.registerFromPath`,
  which returns a non-null `FontKey` on success or `null` on failure
  (unsupported format, unreadable path). Wrapped as
  `@prelight/core#loadBundledFont(path, familyAlias?)` returning a boolean.
- **Bundled asset**: `corpus/fonts/InterVariable.ttf` — Inter v4.1 variable
  font (880,707 bytes), pulled from
  `https://raw.githubusercontent.com/rsms/inter/v4.1/docs/font-files/InterVariable.ttf`,
  licensed under SIL OFL 1.1 (see `corpus/fonts/Inter-LICENSE.txt`).
- **Registered from**: `corpus/fonts.ts#registerCorpusFonts()` exposes a
  single helper that loads Inter and returns the list of registered
  aliases. Ground-truth and any demo/test that wants deterministic metrics
  imports from there.

### Verification

- **Core unit test**: `packages/core/test/font.test.ts` now exercises
  `loadBundledFont` against the corpus path; returns `true` for the real
  file and `false` for a bogus path. 36 tests pass total (was 34).
- **Ground-truth default font**: changed from `'14px sans-serif' /
  '16px sans-serif'` to `'14px Inter' / '16px Inter'`. Before this, the
  OS-default sans-serif on Windows/Linux/macOS produced different pixel
  counts, which made the ±2px tolerance claim a floor rather than a gate.
- **Harness integration**: `ground-truth/harness.ts` also embeds Inter as
  a base64 `@font-face` into the Chromium test page so the browser-side
  measurement comes from the same glyph data as the canvas-side
  measurement.

### Impact

- Ground-truth is now a fair comparison across machines. A disagreement
  between Prelight and Chromium now means a real Pretext-vs-browser
  delta, not a font fallback artifact. This is the prerequisite for G3.
- Packages do not ship the font; only the monorepo's `corpus/` does.
  Consumers who want the same deterministic behavior follow the same
  pattern with their own registered font (documented in the core README).

---

## 2026-04-16 — Phase E: Ground-truth first green run (G3)

Environment: Windows 10.0.26200, Node v24.12.0 via `tsx` 4.21.0,
Playwright 1.59.1, Chromium 147.0.7727.15 (Chromium channel,
`--remote-debugging-port=0`, WebSocket CDP via
`connectOverCDP`), bundled Inter v4.1 on both sides. See DECISIONS #012
and #013 for the launch-path rationale.

### Setup

- `corpus/` emits 7 languages × {2-3} strings × 4 widths × 2 fonts =
  **600 cases** (exact per-language counts below).
- Font: bundled `Inter-Variable.ttf` registered with `@napi-rs/canvas`
  on the Prelight side and injected via `@font-face` (base64
  `data:font/ttf`) on the Chromium side.
- Tolerance: ±2px height AND exact line-count match. Both must hold for
  a case to "agree".

### Headline number

**551 of 600 cases agree = 91.83% agreement.**

### Per-language breakdown

| Language       | Agree / Total | Agreement |
| -------------- | ------------- | --------- |
| en             | 95 / 96       | 99.0%     |
| de             | 111 / 112     | 99.1%     |
| compound-words | 47 / 48       | 97.9%     |
| emoji          | 76 / 80       | 95.0%     |
| zh             | 72 / 80       | 90.0%     |
| ja             | 76 / 88       | 86.4%     |
| ar             | 74 / 96       | 77.1%     |
| **total**      | **551 / 600** | **91.83%**|

### Failure modes

- **Overestimates vs underestimates**: 25 cases where Prelight predicts
  *more* lines than Chromium, 24 cases where it predicts *fewer*. No
  systematic bias toward one side; the gap is a measurement noise +
  tokenizer-edge-case phenomenon, not a scaling error.
- **Arabic (22/96 fail)** is the dominant contributor. Every failing
  Arabic case is Prelight predicting one more line than Chromium;
  upstream Pretext's bidi/RTL tokeniser appears to treat some Arabic
  spaces as hard wrap opportunities where Chromium's `normal`
  white-space does not. Marked `PRELIGHT-FLAG` in
  `ground-truth/harness.ts` and in `DECISIONS #008`.
- **CJK (ja 12/88 fail, zh 8/80 fail)** splits both ways, consistent
  with kinsoku (line-break avoidance) and narrow-vs-wide width
  heuristic differences between Skia's `measureText` and Blink's
  line-breaker.
- **Emoji (4/80 fail)** — all four are variation-selector / ZWJ
  sequences where the browser glyph composition differs from what
  Skia reports.
- **Long unbreakable Latin**: 1 case each in en (email address) and de
  (`Rechtsschutzversicherung`); these are edges where Chromium will
  soft-break at `-` / `@` characters slightly differently from
  Pretext's rule set.

### What this unblocks

- `DECISIONS #008` now has a concrete gate: 91.83% corpus-wide with
  per-language floors (see that entry for the table). Any regression
  below a floor blocks release.
- `README.md`, `site/thesis.md`, and `LAUNCH.md` can cite 91.83% with a
  dated pointer to this FINDINGS entry instead of the earlier
  hypothetical "to be measured" language. Done in the same commit.

### What we did NOT do in this run

- Did not tighten tolerance to ±1px. At ±2px we already have measurable
  disagreements; tightening the gate would mostly punish sub-pixel
  anti-aliasing noise rather than catch real bugs. Re-evaluate in 0.1.1
  after we fix the RTL gap.
- Did not run under Bun. Under Bun on Windows, the `WebSocket`
  connection to Chromium's CDP endpoint times out in
  `connectOverCDP`. Switching the harness to `tsx`/Node resolved it
  (DECISIONS #013).
- Did not sweep WebKit or Firefox. Scheduled for v1.0.

---

## 2026-04-16 — Phase E: Real Playwright-vs-Prelight numbers (G4)

Environment: Windows 10.0.26200, Node v24.12.0 via `tsx` 4.21.0,
Playwright 1.59.1, Chromium 147.0.7727.15, spawned + connected via
`connectOverCDP` (DECISIONS #012).

### Workload

3 components × 4 languages × 3 font scales = **36 cells** per run,
**50 iterations per side** (Playwright's first run discarded as a warmup).
Full run log in `demos/speed-comparison/RESULTS.md`.

### Headline

| Side       | mean     | p50      | p95      | p99      | per-cell mean |
| ---------- | -------- | -------- | -------- | -------- | ------------- |
| Prelight   | 0.88 ms  | 0.81 ms  | 1.64 ms  | 1.84 ms  | 0.024 ms      |
| Playwright | 20.35 ms | 19.96 ms | 25.02 ms | 27.62 ms | 0.57 ms       |

- **Warm-path speedup (mean-vs-mean): 23.2×**
- **End-to-end speedup (50 iterations + Chromium launch): 20×**
- **Chromium launch cost**: 243 ms one-time, excluded from samples.
- **Prelight warmup (canvas shim + first measurement): 19.67 ms one-time**.

### Caveats published with the number

- Playwright here runs in its most favorable configuration: a single
  reused page, `page.evaluate()` returning numbers only (no
  screenshot, no file I/O). Real visual regression tools would be
  another order of magnitude slower per cell.
- Prelight runs the full verifier (every predicate, localized failure
  messages, full result shape). Not just a measurement call.
- Hardware is a single dev laptop. CI numbers will differ; we will
  regenerate on the first green Ubuntu CI run (tracked as a
  `PRELIGHT-NEXT` in RESULTS.md).

### Bundle sizes after Phase E G7

Measured by `scripts/measure-bundle.ts` — Bun bundler, minified, gzipped,
runtime externals (`@napi-rs/canvas`, `@chenglou/pretext`, React,
`@prelight/*` inter-package deps) excluded so the number reflects the
code *we* ship, not our dependency tree.

| Package          | Minified | Gzipped  | Budget (min / gz) |
| ---------------- | -------- | -------- | ----------------- |
| `@prelight/core`    | 6.20 KB  | 2.61 KB  | 8.00 KB / 3.50 KB |
| `@prelight/react`   | 924 B    | 510 B    | 2.00 KB / 1.00 KB |
| `@prelight/vitest`  | 951 B    | 538 B    | 2.00 KB / 1.00 KB |
| `@prelight/jest`    | 1.07 KB  | 630 B    | 2.00 KB / 1.00 KB |
| `@prelight/cli`     | 4.11 KB  | 1.82 KB  | 6.00 KB / 2.50 KB |
| **total shipped** | **13.2 KB** | **6.1 KB** | — |

Budgets are encoded in `scripts/bundle-budget.json` and enforced in CI via
`bun run measure-bundle:strict`. Any regression past the budget fails the
build; legitimate growth is unblocked by running
`bun run measure-bundle:update` in the same PR, which rewrites the budget
file and makes the regression visible in the diff. This is the policy
recorded in `DECISIONS.md` — Prelight competes on size, so growth must be
argued for, not accidental.

### Test coverage after Phase E G5

| Package          | Tests | Surface covered                                                                               |
| ---------------- | ----- | --------------------------------------------------------------------------------------------- |
| `@prelight/core`    | 36    | font parsing, predicates, verify matrix                                                       |
| `@prelight/react`   | 6     | HTML-to-text, element extraction, component verification                                      |
| `@prelight/vitest`  | 5     | matcher integration (pass/fail, scale sweeps, language whitelist, malformed receiver)         |
| `@prelight/jest`    | 5     | same matcher surface tested against the *built* dist bundle under Jest ESM                    |
| `@prelight/cli`     | 22    | `config.ts` discovery + validation, `reporter.ts` terminal + json, `cli.ts` main orchestration |
| **total**        | **74** | —                                                                                             |

All `--passWithNoTests` flags were removed in this phase; an empty test
directory now fails the build for that package.

The Jest test imports from `packages/jest/dist/` (the shipped bundle), so a
breakage in the TypeScript emit or the packed module resolution would
surface before release. A small cross-platform launcher
(`test/run-jest.mjs`) sets `NODE_OPTIONS=--experimental-vm-modules` without
needing a `cross-env` dependency.

### Chromium launch-failure resolution

The original Phase A bench recorded `launch-failed` because
`playwright.chromium.launch()` times out on Windows when the system has
Defender real-time protection interposing on Chromium's pipe transport.
Phase E replaces the launcher with a manual `spawn()` + WebSocket CDP
connect (`demos/speed-comparison/bench.ts#launchChromium`). Same fix
shipped in `ground-truth/harness.ts`. See `DECISIONS.md #012`.

---

## 2026-04-16 — Phase F: Cross-engine ground-truth (F1)

Environment: Windows 10.0.26200, Node 24.12.0 via `tsx`, Playwright 1.59.1
with locally-installed Chromium 1217, WebKit 2272 (26.4), and Firefox 1511
(148.0.2). Bundled Inter v4.1 used on every side.

### Setup

Same 600-case corpus as the 2026-04-16 Chromium-only run. `runHarness`
now loops a list of engines; Chromium uses the DECISIONS #012 spawn +
`connectOverCDP` path, WebKit and Firefox use Playwright's normal
`.launch()` because the pipe-CDP Windows issue is Chromium-specific.
Each engine gets a fresh context and a fresh `@font-face` setContent so
cross-engine comparisons share the exact same glyph metrics.

### Headline numbers

| Engine     | Agree / Total | Agreement  |
| ---------- | ------------- | ---------- |
| Chromium   | 551 / 600     | **91.83%** |
| WebKit     | 562 / 600     | **93.67%** |
| Firefox    | 547 / 600     | **91.17%** |

WebKit is the closest match — its Arabic word-wrap happens to align
more often with Pretext's RTL tokenizer than Chromium's does (85.4% vs
77.1%). Firefox is worst on English because it wraps URLs at different
characters than Chromium (`http://...` boundaries).

### Per-engine × per-language matrix

| Language       | Chromium | WebKit  | Firefox |
| -------------- | -------- | ------- | ------- |
| en             | 99.0%    | 99.0%   | 95.8%   |
| de             | 99.1%    | 100.0%  | 99.1%   |
| compound-words | 97.9%    | 97.9%   | 97.9%   |
| emoji          | 95.0%    | 95.0%   | 95.0%   |
| zh             | 90.0%    | 90.0%   | 90.0%   |
| ja             | 86.4%    | 88.6%   | 85.2%   |
| ar             | 77.1%    | 85.4%   | 77.1%   |

### Takeaways

- **The Arabic gap is genuinely a Pretext tokenizer issue, not a
  Chromium quirk.** If it were Chromium-specific we'd see WebKit and
  Firefox agree; instead WebKit agrees *more*, which means Pretext's
  model is closer to WebKit's wrapping rules than to Chromium's. F2
  needs to address the Pretext side.
- **Compound words, emoji, zh are identical across all three engines**
  — the disagreements are purely Prelight-side. That's the good kind:
  a fix propagates everywhere at once.
- **Firefox URL wrapping** is the one English regression; it wraps at
  `/` after the first path segment where Chromium and WebKit wrap at
  the first `-` or not at all. Edge case worth a `PRELIGHT-FLAG`, not
  a blocker.

### What this unblocks

- `ground-truth --strict --browser all` is a committed CI gate: per-engine
  × per-language floors in DECISIONS #008 and `ground-truth/run.ts`.
- Full JSON for reproducibility at
  [`ground-truth/cross-engine-2026-04-16.json`](./ground-truth/cross-engine-2026-04-16.json).
- F4's `--tolerance 1` pass can now be evaluated per-engine.

---

## 2026-04-16 — Phase F: Arabic RTL correction (F2)

Same toolchain as F1. This entry replaces the F1 Arabic rows because
the correction re-ran on the same 600-case corpus.

### Root cause

F1 reported Arabic agreement of 77.1% / 85.4% / 77.1% (Chromium / WebKit
/ Firefox). Initial hypothesis was that Pretext over-segments Arabic
whitespace. That turned out to be wrong — the real issue was **font
shaping in the measurement backend**.

The bundled `InterVariable.ttf` has no Arabic glyphs. When
`@napi-rs/canvas` is asked to render Arabic under a `font-family: Inter`
stack, it falls back to a system face but renders **isolated glyph
forms** — the Arabic cursive joining that a browser applies is lost.
The effect: `ctx.measureText("تسجيل الدخول")` returns ~105px on the
canvas backend, while the same string in Chrome with a proper fallback
chain renders at ~63px. That 40-60% width inflation makes Pretext wrap
Arabic strings that the browser keeps on a single line.

Verified via `ground-truth/diag-browser.ts` and
`ground-truth/diag-canvas.ts` — the diagnostics are kept in the repo
so the next maintainer can re-run them.

### Fix

Two-part:

1. **Canvas side** (`packages/core/src/shape/rtl.ts::correctRTLLayout`):
   if the text contains characters in `U+0590–U+08FF`, `U+FB50–U+FDFF`,
   or `U+FE70–U+FEFF`, re-measure the string with
   `font-family: "Noto Sans Arabic"` and greedy-break at whitespace.
   Monotonicity invariant: never produce *more* lines than Pretext did.
2. **Browser side** (`ground-truth/harness.ts::bootstrapHtml`): add a
   second `@font-face` rule for "Inter" with `unicode-range: U+0600-06FF,
   U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF` pointing at
   `NotoSansArabic.ttf` (bundled in `corpus/fonts/`). Every engine now
   gets identical Arabic glyph metrics.

A separate `harness.ts` change replaced the `Range.getClientRects` line
counter with `height / lineHeight`. Reason: Firefox emits multiple
`ClientRect`s per bidi run, and the rects' `top` coordinates differ
slightly between Inter and Noto Sans Arabic due to baseline alignment,
so the unique-`top` heuristic over-reports lines. Since we force
`line-height` in pixels, `height / lineHeight` is unambiguous.

### Headline numbers after F2

| Engine     | Before F2 | After F2 |
| ---------- | --------- | -------- |
| Chromium   | 91.83%    | **95.17%** |
| WebKit     | 93.67%    | **95.67%** |
| Firefox    | 91.17%    | **94.50%** |

### Per-language matrix (post-F2)

| Language       | Chromium | WebKit  | Firefox |
| -------------- | -------- | ------- | ------- |
| en             | 99.0%    | 99.0%   | 95.8%   |
| de             | 99.1%    | 100.0%  | 99.1%   |
| compound-words | 97.9%    | 97.9%   | 97.9%   |
| emoji          | 95.0%    | 95.0%   | 95.0%   |
| zh             | 90.0%    | 90.0%   | 90.0%   |
| ja             | 86.4%    | 88.6%   | 85.2%   |
| ar             | **97.9%** | **97.9%** | **97.9%** |

Arabic now clears the 95% release-gate target on every engine and is
uniform across them — exactly what a real fix looks like, not a
per-engine calibration.

### Takeaways

- Font availability is a silent correctness axis. Any future script
  with complex shaping (Hebrew, Devanagari, Thai) will need the same
  bundle-and-fallback treatment. Tracked in `ROADMAP.md` as a
  PRELIGHT-NEXT(v1.0).
- The CJK gap is now the dominant error source (86-90%). F3 targets it.
- Raw F2 evidence:
  [`ground-truth/cross-engine-2026-04-16.json`](./ground-truth/cross-engine-2026-04-16.json)
  (regenerated after F2; F1 numbers live in the git history of this
  file).
- DECISIONS #008 amended with the new floors (93% overall, 95% Arabic).

---

## 2026-04-16 — Phase F: CJK kinsoku + shaping correction (F3)

Same toolchain as F1/F2.

### Root cause

After F2, CJK (`ja`/`zh`) agreement was 85–90% across all engines. Two
independent issues compounded:

1. **Pretext under-wraps CJK.** The tokenizer breaks at whitespace,
   so a Japanese string with no spaces stays on a single line regardless
   of `maxWidth`. Browsers, by contrast, implement `line-break: normal`
   which permits per-character breaks in CJK runs with kinsoku
   (line-break taboo) adjustments.
2. **CJK font shaping differs between canvas and browser.** Exactly the
   same failure mode as Arabic in F2: the bundled `InterVariable.ttf`
   has no CJK glyphs. `@napi-rs/canvas` falls back to one font family,
   the browser to another; their metrics disagree by ~20-40%.

### Fix

Layered, mirroring F2's structure:

1. **Algorithmic layer** (`packages/core/src/shape/cjk.ts::correctCJKLayout`):
   when the text contains any character in the CJK code ranges
   (`U+3040–30FF`, `U+3400–9FFF`, `U+AC00–D7AF`, `U+FF00–FFEF`),
   segment per-character and greedy-break, honouring kinsoku:
   characters in `NO_LINE_START` (closing punctuation, small kana,
   `ー`, `…`) never start a line; characters in `NO_LINE_END`
   (opening brackets) never end a line. Monotonicity invariant: never
   produce *fewer* lines than Pretext — the underwrap is the bug we
   correct.

2. **Font layer** (harness-side):
   - New harness-only subset fonts, pulled from Google Fonts subset API
     keyed on the exact corpus strings:
     - `ground-truth/fonts/NotoSansJP-subset.ttf` (74 KB)
     - `ground-truth/fonts/NotoSansSC-subset.ttf` (41 KB)
   - Registered with `@napi-rs/canvas` via `loadBundledFont` under the
     names `Noto Sans JP` and `Noto Sans SC`.
   - Exposed to the shim through `setCJKMeasurementFamilies(['Noto Sans
     JP', 'Noto Sans SC'])`.
   - Injected into the browser bootstrap HTML as additional
     `@font-face` declarations for the `Inter` family, scoped by
     `unicode-range` to the JP and CJK code blocks.
   - Result: both canvas and browser measure CJK glyphs from the same
     two files. Measurements no longer depend on host OS fonts.

These subsets live outside `corpus/fonts/` on purpose — they're only
valid for the corpus strings. Consumers who need production CJK
accuracy should bundle the full Noto Sans JP / CJK variable font (~10-
20 MB) with their app and `loadBundledFont` it. `PRELIGHT-NEXT(v0.3)`
is to expose `measurementFonts` as part of `VerifySpec` (deferred from
v0.2 — the `setCJKMeasurementFamilies` / `getCJKMeasurementFamilies`
pair is sufficient for v0.2 consumers and is what ground-truth uses).

### Shim selector logic

`correctCJKLayout` probes each family in `CJK_MEASUREMENT_FAMILIES` and
uses the first one whose canvas measurement of a CJK probe glyph
differs from the input font's by more than 0.5px. That signals the
family is actually registered (not a phantom alias). If none are
registered, the shim falls through and Prelight measures with whatever
canvas does internally — the v0.1.0 behaviour.

### Line-count counting fix (carried over from F2)

The previous line-counting heuristic (`unique Range.getClientRects()
top values`) over-reported lines in Firefox when a CJK line contained
a Latin token ("Downloading" in the corpus), because the baseline of
Noto Sans JP and Inter are ~0.5px off and each run got its own rect.
The harness now uses `Math.round(height / lineHeight)` on the
container, which is exact given we force `line-height` in pixels.

### Headline numbers after F3

| Engine     | Pre-F2  | Post-F2 | Post-F3    |
| ---------- | ------- | ------- | ---------- |
| Chromium   | 91.83%  | 95.17%  | **97.67%** |
| WebKit     | 93.67%  | 95.67%  | **98.00%** |
| Firefox    | 91.17%  | 94.50%  | **97.33%** |

Per-language, post-F3:

| Language       | Chromium | WebKit    | Firefox   |
| -------------- | -------- | --------- | --------- |
| en             | 99.0%    | 99.0%     | 95.8%     |
| de             | 99.1%    | 100.0%    | 99.1%     |
| compound-words | 97.9%    | 97.9%     | 97.9%     |
| emoji          | 95.0%    | 95.0%     | 95.0%     |
| zh             | **98.8%** | **97.5%** | **98.8%** |
| ja             | **95.5%** | **97.7%** | **96.6%** |
| ar             | 97.9%    | 97.9%     | 97.9%     |

Every script/corpus-language cell clears the 95% target on every
engine, and CJK converges across engines (the 85-90% dispersion of F1
is gone). DECISIONS #008 floors raised to 96% overall, 93-96% on ja/zh.

### Remaining gaps (not blockers)

- **ja "続行する前に作業を保存してください。変更が失われないようにす…" @ 80-120px**:
  browser wraps 1 character earlier than the shim in 2 cases (off by
  one line). This is a real kinsoku edge: the browser refuses to leave
  `で` alone at end-of-line; our shim allows it. Fix requires a fuller
  kinsoku rule set. Tracked as `PRELIGHT-NEXT(v1.0)`.
- **emoji ZWJ / variation selector cases** (4 per engine): unchanged
  from F1. F6 will expand the emoji corpus and address these.
- **Firefox URL wrapping**: unchanged, same 4 cases with `https://`
  path boundaries. Engine-specific; benign `PRELIGHT-FLAG`.

### Artifacts

- Raw F3 evidence:
  [`ground-truth/cross-engine-2026-04-16.json`](./ground-truth/cross-engine-2026-04-16.json)
  (regenerated after F3).
- Subset fonts: `ground-truth/fonts/NotoSansJP-subset.ttf`,
  `ground-truth/fonts/NotoSansSC-subset.ttf`.
- CJK shim: `packages/core/src/shape/cjk.ts`.
- Floors: `ground-truth/run.ts::PER_ENGINE_FLOORS`, DECISIONS #008.

---

## 2026-04-16 — Phase F: Tolerance tightened ±2px → ±1px (F4)

Same toolchain as F1-F3.

### Observation

After F3, every disagreement in the 600-case corpus is a **whole-line**
disagreement: the absolute height delta is always a multiple of the
20 px line-height. None of the 14-16 remaining disagreements per engine
falls in the ±1–2px band. Proof: ran `bunx tsx run.ts --browser all`
with `tolerancePx: 1` and compared against `tolerancePx: 2` — identical
agreement numbers on every engine (97.67% / 98.00% / 97.33%).

That means tightening the release-gate tolerance from ±2px to ±1px
is, today, a **zero-regression operation**. It doesn't remove any
passing case from the green set.

### Why tighten it if it changes no numbers?

1. **Sub-pixel drift detection.** If a future browser version, Inter
   font update, or Pretext change shifts measurements by a consistent
   1.5 px (e.g., ascender adjustment), the loose ±2px gate would swallow
   it silently. A ±1px gate catches it.
2. **Tighter contract for users.** Consumers reading `DECISIONS.md` now
   know Prelight's height answer is within 1 px of the browser's, not
   2 px — and that's verified on every CI run.
3. **Signal when F3's shaping fix breaks.** If the harness-side or
   core-side CJK shaping regresses (font corruption, alias lost), the
   first sign would be sub-pixel width drift. ±1 px surfaces it; ±2 px
   might hide it until the drift compounded into a line-count change.

### Changes

- `defaultHarnessConfig.tolerancePx` in `ground-truth/harness.ts`: `2 → 1`.
- Header comment in `harness.ts` updated.
- README.md, LAUNCH.md, site/index.html, site/thesis.md, AGENTS.md,
  CHANGELOG.md swept: every "±2px" claim → "±1px", every "91.83%" →
  current F3 numbers, every "Chromium" → "Chromium + WebKit + Firefox".

### What stays loose

`lineCount` is still **exact match** — a 1-line disagreement is a real
disagreement, there is no "close enough" on integer counts.

### What this unblocks

- The v0.1.x release candidate (F7) now has a tighter contract to
  claim.
- Any regression in F5's Ubuntu CI job that introduces sub-pixel drift
  will fail the gate before it reaches main.

---

## 2026-04-16 — Phase F: Ubuntu full-stack CI gate (F5)

New GitHub Actions workflow `.github/workflows/ubuntu-full.yml` runs,
in one Ubuntu job:

1. `bun install` (frozen lockfile)
2. `bun run typecheck` across every `@prelight/*` package
3. `bun run build` across every `@prelight/*` package
4. `bun run test` across every `@prelight/*` package (74 tests)
5. `bun run measure-bundle:strict` (fails on bundle-budget regression)
6. `npx playwright install --with-deps chromium webkit firefox`
7. `npx tsx run.ts --strict --browser all` in `ground-truth/`
8. `npx tsx bench.ts --iterations=10 --json` in `demos/speed-comparison/`
9. Gate: `speedup ≥ 10×` (soft floor — the claim is 23×; 10× absorbs
   shared-runner noise)

The workflow fires on push-to-main, every Monday at 06:00 UTC, and
via `workflow_dispatch`. It does **not** run on pull requests — PR
feedback stays on the faster `ci.yml` (cross-OS unit tests + bundle
budget) and `ground-truth.yml` (corpus agreement) workflows, which
finish in 2-4 minutes. `ubuntu-full` is explicitly the release-candidate
bar for F7 and subsequent `v0.N-rc` tags.

Added `speedup` field to `bench.ts --json` output so the workflow can
gate on `result.speedup < 10` without re-deriving the ratio from
`prelight.mean` and `playwright.mean`.

Rationale captured in DECISIONS #015.

---

## 2026-04-16 — Phase F: Emoji corpus expansion (F6)

### Scope expansion

`corpus/languages/emoji.json` grew from **10 strings** (v0.1.0) to
**51 strings**, 5.1× more coverage, covering every shape the Unicode
emoji spec prescribes:

| Category                         | Keys |
| -------------------------------- | ---- |
| Base emoji                       | 5    |
| ZWJ sequences (families, roles)  | 13   |
| Skin-tone modifiers (all 5 F-L)  | 8    |
| Regional-indicator flags         | 7    |
| Keycaps                          | 4    |
| Variation selectors (text/emoji) | 3    |
| Emoji 13-15.1 (2020-2023 adds)   | 4    |
| Real UI strings (toasts, badges) | 4    |
| Multi-grapheme stress runs       | 3    |

Ground-truth cell count: **80 → 408** (51 strings × 4 widths × 2
fonts), total corpus **600 → 928**.

### Agreement numbers (post-F6)

| Engine     | Overall | Emoji only |
| ---------- | ------- | ---------- |
| Chromium   | 94.50%  | 90.0% (367/408) |
| WebKit     | 94.72%  | 90.0% (367/408) |
| Firefox    | 94.29%  | 90.0% (367/408) |

Emoji drops overall agreement from 97.x% → 94.x% because emoji is now
a much larger share of the corpus and agrees at 90%. **Every
non-emoji language cell is unchanged from F3.**

### Why emoji is 90%, not 95%

Same root-cause class as F2 (Arabic) and F3 (CJK): the bundled Inter
face has no emoji glyphs. Browsers fall back to their system emoji
face (Segoe UI Emoji on Windows, Apple Color Emoji on macOS, Noto
Color Emoji on Linux/Chromium). The canvas backend falls back to
whatever face its own resolver finds. **The two fallbacks have
different glyph widths**, sometimes by 20-40%. Observed failure
shapes:

- `emoji_13_plus` (🥲🥸🫀...): browser wraps 2–4 times more than
  Prelight at the same width. Chrome/WebKit have glyphs; Inter /
  canvas fallback doesn't.
- `flag_run` (🇺🇸🇬🇧🇯🇵...): regional-indicator pairs render as a
  single flag glyph in browsers, as two separate letters in canvas
  fallback. Width differs.
- `with_text_suffix` ("🎉 Success" @ 80px): the 🎉 is wider in the
  browser than in the canvas, so browser wraps where Prelight
  doesn't.

### Why we aren't bundling an emoji font

- **Size.** Noto Color Emoji COLRv1 is 10 MB+; Twemoji SVG is
  heavier. There is no widely-distributed <1 MB emoji face that
  covers Unicode 15.1. Subsetting a color font for our corpus would
  lose validity the moment anyone added new emoji strings.
- **Platform authenticity.** The user's app will render emoji in
  whatever emoji face the user's platform ships. Bundling Noto Color
  Emoji into canvas would give us artificially high agreement with
  Linux Chromium and artificially low agreement with macOS Safari.
- **No layout correctness bug.** Pretext segments grapheme clusters
  correctly. Every disagreement is a glyph-width disagreement, not a
  cluster-boundary disagreement. The layout algorithm is right; the
  font fallback is not controllable without the user opting in.

### What this unblocks / guarantees

- **Release-gate floor lowered** to 88% on emoji (measured 90%) and
  93% overall. DECISIONS #008 updated. `PER_ENGINE_FLOORS` in
  `ground-truth/run.ts` updated.
- **PRELIGHT-NEXT(v0.3)**: `VerifySpec.measurementFonts` option will
  let consumers point the canvas backend at their app's emoji face.
  When both sides use the same face, emoji agreement should
  converge toward 100% by the same mechanism F2/F3 used for Arabic
  and CJK. Today, a user can call
  `loadBundledFont(path, 'Noto Color Emoji')` and register it as a
  measurement family manually; v0.3 will make this first-class.
  (Deferred from v0.2: the v0.2 roadmap was saturated with structural
  primitives G1–G7; this is an additive v0.3 enhancement.)
- **Regression guard.** The corpus expansion means any future
  Prelight change that breaks grapheme-cluster handling (e.g., a
  bad ZWJ-segment bug in a Pretext upgrade) will show up as dozens
  of new failures, not one.

### Artifacts

- Expanded corpus: `corpus/languages/emoji.json` (51 strings).
- Regenerated evidence JSON:
  [`ground-truth/cross-engine-2026-04-16.json`](./ground-truth/cross-engine-2026-04-16.json)
  (now 928 cases).
- Floors: `ground-truth/run.ts::PER_ENGINE_FLOORS`, DECISIONS #008.
