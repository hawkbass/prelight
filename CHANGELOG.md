# Changelog

All notable changes to Prelight are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase H5 — v0.3 `align-items: 'baseline'` (2026-04-17)

- **Baseline alignment in flex** — `FlexAlign` union extended
  with `'baseline'`, rounding out the H1 `align-items` set
  (`start | end | center | stretch | baseline`). The H1 cliff
  deferred this from that phase because baseline alignment
  needs each item's first-baseline offset; shipping it in a
  standalone H5 keeps the geometry work separate from the
  font-metrics plumbing. Retires
  `PRELIGHT-NEXT(v0.3 H5)` in `packages/core/src/layout/flex.ts`.
  (H5)
- **`FlexItem.firstBaseline?: number`** — distance in px from
  the item's border-box top to its primary text baseline.
  Caller-supplied; undefined means "synthesised fallback"
  (treated as 0, so the border-box top acts as the baseline).
  This is a documented simplification of CSS Flex L1 §8.3's
  outer-margin-edge fallback that keeps the default trivial
  for non-text items (images, spacers, buttons) composing
  alongside baseline-aligned text. (H5)
- **`FlexLineLayout.baseline: number`** — resolved first-
  baseline position on each line, measured from the line's
  `crossStart`. Populated for `align: 'baseline'` only; 0
  everywhere else. Exposed so callers that stack custom
  content on top of a flex line can re-use the resolved
  baseline coordinate. (H5)
- **Algorithm** — per line:
  `baselineOffsetOuter_i = leading_i + (firstBaseline_i ?? 0)`,
  `lineBaseline = max(baselineOffsetOuter)`, each item's
  border-box top = `lineBaseline - (firstBaseline_i ?? 0)`.
  Line cross-size grows to `max(outerBottom_i)` which can
  exceed the natural `max crossOuter` when a deep-descent item
  pushes the line's bottom past other items — test C81 pins
  this behaviour. (H5)
- **`direction: 'column' + align: 'baseline'` falls back to
  `'start'`** — Prelight's baseline model is a vertical text
  baseline; column flex has a horizontal cross axis with no
  meaningful baseline. Documented explicitly instead of
  silently producing broken cross offsets; `line.baseline`
  stays 0 under the fallback so callers can detect it. (H5)
- **Evidence**: 18 new unit tests in
  `packages/core/test/flex.test.ts` (C73–C90) across four
  groups: baseline basics (6), line sizing (5), wrap
  interaction (3), and edge cases (4 — column fallback, empty
  items, single item, `firstBaseline > height` clamping). All
  72 pre-existing flex cases pass unchanged; the `baseline`
  field on non-baseline lines is additive. (H5)
- **Bundle impact**: `@prelight/core` grew 21.36 → 21.90 KB
  min / 8.14 → 8.35 KB gz (+0.54 KB min / +0.21 KB gz). Well
  below the 1 KB single-phase tripwire — no budget bump. The
  22.00 KB min / 8.50 KB gz budget now has 0.10 KB min /
  0.15 KB gz headroom remaining; H6–H8 core work may need a
  deliberate bump (same pattern as H1 / H3). (H5)
- **Honest gap**: no browser ground-truth. The flex harness
  still does not exist; claiming browser-verified baseline
  positions would violate the evidence invariant. The
  `cjk.ts` `PRELIGHT-NEXT(v0.3)` marker for
  `VerifySpec.measurementFonts` is **retained** (not retagged)
  so a future phase can retire it alongside ascent/descent
  threading through `Measurement`. Keeping H5 to pure geometry
  lets it commit cleanly without dragging in the font-metrics
  contract. (H5)
- **Test count**: `bun run test` → 383 passing (core 246,
  react 80, vitest 11, jest 5, cli 41); +18 vs H4. (H5)

### Phase H4 — v0.3 slot markers for multi-slot components (2026-04-17)

- **`data-prelight-slot` marker convention** in `@prelight/react`:
  any React element carrying `data-prelight-slot="name"` is a
  verifiable slot. `data-*` was chosen deliberately — React
  forwards it to the rendered HTML attribute, there's no runtime
  component to import, and it composes cleanly with shadcn/Radix-
  style primitives that already accept rest-props. Exported as
  the `SLOT_ATTR` constant for callers that want to reference it
  symbolically. (H4)
- **New walkers** in `@prelight/react/slots.ts`:
  - `findSlots(element)` returns every unique slot name in
    depth-first preorder (first-encounter wins on duplicates).
  - `findSlotPath(element, slotName)` returns the full ancestor
    path from the tree root to the slot element, or `null` when
    the slot is absent. Exposed so callers can replay their own
    cascade along the slot path if they want to extend
    `resolveStyles`'s default semantics.
  - `extractSlotText(element, slotName)` renders the *slot
    subtree* standalone via `react-dom/server`'s
    `renderToStaticMarkup` and runs it through the existing
    `htmlToText()` — so only the slot's text reaches the
    verifier. Missing slots throw with the known-slots list
    (`"slot 'foo' not found; known slots in this tree: [title,
    body]"`). (H4)
- **`resolveStyles({ slot })`**: the cascade now accepts an
  optional `slot: string` option. When set, the walker replays
  resolvers along the exact ancestor path from root to slot
  instead of the default first-text-branch descent — so the
  returned styles reflect exactly what cascades to the slot,
  unrelated siblings are skipped, and the resolver chain sees
  only the elements that genuinely contribute to the slot's
  styling. Missing slots throw with the same helpful list. The
  original first-text-branch behaviour is preserved byte-for-byte
  when `slot` is omitted — the existing 50 resolve-styles cases
  pass untouched. (H4)
- **`verifyComponent({ slot })`**: end-to-end slot verification
  in one call. When `slot` is set, `extractSlotText` governs the
  text that flows through the verifier, and when `autoResolve`
  is also set the slot is forwarded to `resolveStyles` so the
  auto-derived `font` / `maxWidth` / `lineHeight` reflect the
  slot's cascade. Explicit `font` / `maxWidth` / `lineHeight` on
  the spec still win over autoResolve, matching v0.2 option
  precedence. (H4)
- **PRELIGHT-NEXT retaggings**: `extract.ts`'s `PRELIGHT-NEXT(v0.3)`
  for slot markers is removed (landed); the sibling
  `PRELIGHT-NEXT(v0.3)` for emotion + styled-components plugins
  is retagged to `PRELIGHT-NEXT(v0.3 H7)` to keep H7 the single
  home for CSS-in-JS runtime probes. The `resolve-styles.ts`
  docstring is amended to reflect slot-aware cascade semantics.
  (H4)
- **Evidence**: 24 new unit tests in `packages/react/test/slots.test.tsx`
  (C01–C24) split into four groups: `findSlots` discovery (6),
  `findSlotPath` targeting (5), `extractSlotText` rendering (8)
  including same-tag nesting and entity decoding, and
  `resolveStyles` / `verifyComponent` slot integration (5). All
  assertions are either derivable from React's preorder tree
  walk or from `react-dom/server` output — no browser required.
  Existing 50 resolve-styles cases + 6 verifyComponent cases
  pass unchanged, which pins the slot-option default as truly
  opt-in. (H4)
- **Bundle impact**: `@prelight/react` grew 4.92 → 6.14 KB min /
  2.19 → 2.64 KB gz (+1.22 KB min / +0.45 KB gz). The 1 KB
  single-phase tripwire is crossed; the cost is the new
  `slots.ts` walker surface plus the `resolveStyles` slot
  branch plus `verifyComponent` wiring. A first-draft
  implementation included a depth-tracking HTML slicer — dropped
  during this phase after realising `renderToStaticMarkup` can
  take the slot subtree directly, saving ~0.74 KB min. Budget
  bumped from 5.50 → 6.50 KB min / 2.38 → 2.88 KB gz (~0.36 KB
  min / ~0.24 KB gz headroom). Same bump-with-feature pattern
  as H1 and H3; `core` bundle unchanged. (H4)
- **Test count**: 341 → 365 (v0.2 + v0.3 H1–H4). `AGENTS.md`
  updated in this commit.

### Phase H3 — v0.3 aspect `object-position` + percentage edge insets (2026-04-17)

- **CSS `object-position` support** in `@prelight/core/layout/aspect.ts`:
  new `ObjectPosition` type (`{ x: number; y: number }`, each
  value on the unit interval) plus `OBJECT_POSITION_CENTER` for
  the CSS default `50% 50%`. `aspectFit()` gained a fourth
  optional `position` argument, and `fitsAspect()` gained a
  matching `position?: ObjectPosition` spec field. The returned
  `AspectLayout` now exposes per-side placement fields —
  `letterboxLeft`/`Right`/`Top`/`Bottom` and
  `clippedLeft`/`Right`/`Top`/`Bottom` — computed from the rendered
  rect + position. The legacy `letterboxX`/`Y`/`clippedX`/`Y`
  fields are preserved and now report `max(left, right)` /
  `max(top, bottom)` so worst-side threshold checks still catch
  asymmetric placements correctly; under the centered default
  the legacy and per-side views agree byte-for-byte, so v0.2
  callers see no behaviour change. Position values are clamped
  to [0, 1] in v0.3 (overhang is a v0.4+ follow-on, see
  `aspect.ts` PRELIGHT-NEXT). (H3.1)
- **CSS percentage edge insets** in `@prelight/core/layout/box.ts`:
  new `PercentInset` / `ResolvableInset` / `ResolvableEdgeInsets`
  types and `pct(n)` helper to tag an edge as a percent. New
  `resolveInsets(spec, containingBlockWidth)` resolves all four
  edges against a caller-supplied width, preserving CSS's quirk
  that top/bottom padding+margin percentages resolve against
  **width**, not height. `parseEdgeInsets()` gained a second
  optional `containingBlockWidth` argument — `%` tokens are now
  accepted when a width is supplied, and throw a clear
  `contains %-tokens` error when not. Pure px-only shorthands
  continue to work with no second argument, preserving v0.2 API.
  New `parseResolvableInsets()` defers resolution for callers
  who parse before knowing the containing block. `calc()` and
  mixed units remain unsupported and are retagged as
  `PRELIGHT-NEXT(v0.4)` in `box.ts`. (H3.2)
- **Evidence**: 20 new unit tests split across the two
  subphases. `aspect.test.ts` +12 cases (C21–C32): default
  preservation, top-left / bottom-right / anchored-contain
  cases, cover-clip distribution, `fitsAspect` worst-side
  pile-up failure, overhang clamp, zero-size + position, and
  fill-no-slack. `box.test.ts` +8 cases (C31–C38): `pct()`
  shape, `resolveInsets` basic + vertical-quirk + mixed px/%,
  `parseEdgeInsets` with width, `parseResolvableInsets` defer,
  and error paths. Every expected value derives from the CSS
  2.1 Images module + CSS 2.1 §8.4 (margin percentages).
  **Browser-confirmed ground-truth is not in this release** —
  same harness-scope reason as H1/H2 (text-layout oracle,
  no image-rect or box-model extraction yet). See
  `FINDINGS.md` §2026-04-17 H3 for the full evidence-status
  note. (H3)
- **Bundle impact**: `@prelight/core` grew 19.71 → 21.36 KB min /
  7.58 → 8.14 KB gz (+1.65 KB min / +0.56 KB gz). This crosses
  the 1 KB single-phase tripwire. The growth is all
  algorithmic — per-side aspect arithmetic, percent-inset
  parser extension, and the resolvable spec type layer — with
  no accidental expansion. Budget bumped to 22.00 KB min /
  8.50 KB gz to leave ~0.64 KB min / ~0.36 KB gz headroom.
  Budget bumps follow the same rule as H1: deliberate,
  documented, and tied to a named feature landing. (H3)
- **Test count**: 321 → 341 (v0.2 + v0.3 H1–H3). `AGENTS.md`
  updated in this commit.

### Phase H2 — v0.3 block-flow completeness (2026-04-17)

- **Parent-child margin collapse** in `@prelight/core/layout/block.ts`:
  new `BlockContainer.collapseWithParent?: boolean` opt-in flag plus
  `padding`, `border`, `margin` fields. When opted in, the first
  child's top margin collapses with the parent's top margin if the
  parent has no top padding or top border (CSS 2.1 §8.3.1). Symmetric
  for bottom, with the additional gate that `innerHeight` is
  undefined (a definite container height blocks bottom collapse). New
  layout output fields: `effectiveMarginTop`, `effectiveMarginBottom`
  (the container's outer margins after any collapse), plus boolean
  flags `collapsedWithParentTop` / `collapsedWithParentBottom` so
  callers can detect which edges participated.
- **Empty-block self-collapse**: a child with `borderBoxHeight === 0`
  AND zero top+bottom padding+border has its top and bottom margins
  collapse into a single margin that participates in adjacent-sibling
  collapse on both sides. New `BlockChildLayout.emptyBlock: boolean`
  field flags which laid children are empty. New exports:
  `isEmptyBlock()` predicate and `collapseMarginList()` variadic
  helper (left-folds `collapseMargins` across N values). (H2)
- **Backwards compatibility**: all 30 v0.2 block tests pass unchanged.
  The default `collapseWithParent: undefined` path is byte-identical
  in behaviour to the v0.2 engine: children's margins stay strictly
  inside `contentHeight`, and `effectiveMarginTop/Bottom` default to
  0. A caller that already supplies `padding`/`border`/`margin` but
  sets `collapseWithParent: false` gets the same v0.2 stacking plus
  the margin fields threaded through untouched. (H2)
- **Floats clearance retagged** from `PRELIGHT-NEXT(v0.3)` to
  `PRELIGHT-NEXT(v1.0+)`. Rationale: the `Box` model has no `float`
  field, so the engine receives pure block-flow children by
  construction; clearance is genuinely niche in modern CSS (and in
  React specifically). Flagging rather than implementing keeps the
  false-claim surface at zero. (H2)
- **New out-of-scope markers** for v0.4: chained collapse through
  empty first/last children into the parent (CSS permits "margins
  collapse through" an empty box), and empty-container
  self-collapse (the whole container's top+bottom margins fold into
  one when it has no children, zero top+bottom padding+border, and
  no definite height). Both are small follow-ons that need a second
  pass in `computeBlockLayout`; H2 handles the 99% case with a
  non-empty first/last child. (H2)
- **Evidence**: 20 new unit tests in `packages/core/test/block.test.ts`
  (C31–C50) across four categories: parent-child top collapse (6),
  parent-child bottom collapse (5), combined edges + opt-in
  backwards-compat guards (3), empty-block self-collapse (6). Every
  expected value is derived from CSS 2.1 §8.3.1. **Browser-confirmed
  ground-truth is not in this release** — same reason as H1: the
  existing harness is a text-layout oracle, and a structural
  ground-truth harness (corpus schema + per-child rect extraction +
  sub-pixel tolerance) is a distinct multi-day phase. See
  `FINDINGS.md` §2026-04-17 H2 for the full evidence-status note. (H2)
- **Bundle impact**: `@prelight/core` grew 18.55 → 19.71 KB min /
  7.25 → 7.58 KB gz (+1.16 KB min / +0.33 KB gz). Stays within the
  H1-set budget (20.00 KB min / 8.00 KB gz). Remaining headroom:
  ~0.29 KB min / ~0.42 KB gz. H3–H8 may require a second budget
  bump; decision deferred to the phase that exceeds. (H2)

### Phase H1 — v0.3 flex-wrap + align-items (2026-04-17)

- **Flex-wrap (multi-line)** in `@prelight/core/layout/flex.ts`: new
  `FlexContainer.wrap: 'nowrap' | 'wrap'` option. With `wrap: 'wrap'`,
  a pre-pass packs items into lines greedily by hypothetical outer main
  size (basis clamped to `minMain`/`maxMain`, plus margin, plus gap),
  breaking before any item whose addition would push the current line
  past `container.innerMain`. Each line then runs the existing §9.7
  main-axis resolution independently — grow/shrink only operate within
  a single line, matching Chromium / Firefox / Safari behaviour.
- **Cross-axis alignment** via new `FlexContainer.align: 'start' |
  'end' | 'center' | 'stretch'` option. For `start | end | center`,
  items keep their natural cross outer size and are positioned within
  the line's cross extent. For `stretch`, items expand to the line's
  cross size minus their cross-axis margins. Single-line flex with
  `innerCross` defined uses the container's inner cross size as the
  line size (CSS Flex L1 §9.4); multi-line flex uses each line's
  natural max-sibling cross size. `align-items: 'baseline'` is
  explicitly deferred to H5, where it lands together with the font
  ascent values threaded through `VerifySpec.measurementFonts` — a
  stub that silently falls back to `start` would violate the
  evidence invariant.
- **New layout fields** on `FlexLayout`: `lines: FlexLineLayout[]`
  (one entry per wrapped line; single entry for `nowrap`), `contentCross`
  (total cross-axis extent), `crossOverflows` (true when
  `contentCross > innerCross`). `FlexItemLayout` gains `crossOffset`
  (item position along the cross axis from the container's
  cross-start). Existing fields (`items`, `contentMain`, `freeSpace`,
  `overflows`, `direction`) keep their v0.2 meaning on single-line
  layouts; on wrap, `contentMain = max(line.mainExtent)` so the
  overflow semantics stay consistent.
- **New exports**: `FlexWrap`, `FlexAlign`, `FlexLineLayout` types.
- **Backwards compatibility**: all 40 v0.2 flex tests pass unchanged.
  The default `wrap: 'nowrap'` + default `align: 'start'` path is
  byte-identical in behaviour to the v0.2 engine. (H1)
- **Evidence**: 32 new unit tests in `packages/core/test/flex.test.ts`
  (C41–C72) covering wrap packing, align-items modes, and wrap ×
  align integration. **Browser-confirmed ground-truth is not in
  this release** — the existing harness is a text-layout oracle with
  no flex-container infrastructure. Building a flex ground-truth
  harness is a distinct multi-day phase; see `FINDINGS.md`
  §2026-04-17 for the full evidence-status note and the planned
  path (H9 or a standalone pre-v0.3.0 phase, depending on
  scheduling). (H1)
- **Bundle budget bump**: `@prelight/core` 18.00 KB min / 7.00 KB gz
  → 20.00 KB min / 8.00 KB gz to absorb the wrap + align code (actual
  measured: 18.55 KB min / 7.25 KB gz, so ~1.45 KB min headroom
  remains for H2–H8). Budget bump is a deliberate, documented
  choice, not a slip. (H1)
- **Test-count carry-forward from v0.2.0-rc completion review**:
  `CHANGELOG.md`'s Phase G test count is corrected from 254 → 269
  to match what actually shipped. The paired `AGENTS.md` /
  `README.md` / `ROADMAP.md` doc polish from the same review
  remains uncommitted and will land in the H8 governance pass so
  all v0.3-era claims move together.

### Phase G — v0.2 structural primitives (2026-04-16)

- **Style resolution** in `@prelight/react`: `resolveStyles()` plus a
  `StyleResolver` plugin surface (two built-ins: `inlineStyle()`,
  `cssVariables()`). Walks a React tree to determine the effective
  `font` / `maxWidth` / `lineHeight` for the innermost text-bearing
  descendant; `verifyComponent(..., { autoResolve: true })` now needs
  no duplicate style metadata. Length/line-height parsers handle
  `px`, `rem`, unitless, `var(--token)` with fallbacks. 50/50 unit
  tests. (G1)
- **Box model primitives** in `@prelight/core/layout/box.ts`:
  `EdgeInsets` + `Box` pure data types, `all()` / `symmetric()` /
  `only()` / `parseEdgeInsets()` / `zeroInsets()` factories,
  `box()` / `addInsets()` / `horizontalInset()` / `verticalInset()`
  arithmetic, and `contentWidthFromBorderBox()` for the CSS
  `content-box` ⇄ `border-box` inverse. 30/30 unit tests. (G2)
- **Single-axis flex engine** in `@prelight/core/layout/flex.ts`:
  `computeFlexLayout()` + `fitsFlex()` predicate per CSS Flex L1
  §9.7 for the no-wrap case (grow, shrink, basis, gap,
  justify-content, minMain/maxMain clamps, margins). Row + column
  direction both covered. 40/40 unit tests. (G3)
- **Block flow engine** in `@prelight/core/layout/block.ts`:
  `computeBlockLayout()` + `fitsBlock()` predicate. Adjacent-sibling
  vertical margin collapse per CSS 2.1 §8.3.1 (positive-max,
  mixed-sign, negative-min). 30/30 unit tests. (G4)
- **Image aspect-ratio layout** in
  `@prelight/core/layout/aspect.ts`: `aspectFit()` + `fitsAspect()`
  covering `object-fit: contain | cover | fill | scale-down | none`,
  with letterbox / clipping / scale thresholds on the predicate.
  20/20 unit tests. (G5)
- **New matchers** across the testing surface: `toFitFlex`,
  `toFitBlock`, `toFitAspect` in `@prelight/vitest` and
  `@prelight/jest`. CLI `prelight.config.{ts,tsx}` gains a `layouts`
  array with `{ kind: 'flex' | 'block' | 'aspect', spec }` entries;
  the runner and the terminal + JSON reporters surface layout
  results alongside text-layout tests. (G6)
- **TTY-aware CLI reporter** with zero dependencies: one-file ANSI
  colour layer (`packages/cli/src/color.ts`) with a full decision
  table for `NO_COLOR`, `FORCE_COLOR`, `FORCE_COLOR=0`, and stream
  `isTTY`. Default reporter stays plain-text; new
  `createTerminalReporter(palette)` + `autoPalette(stream)` wired
  into the CLI entry so piping to a file never emits escape
  sequences. 12/12 colour tests + 12/12 reporter tests. (G7)
- **Public API additions** in `@prelight/core`: `Box`, `BoxSpec`,
  `EdgeInsets`, `edgeInsetsAll`, `edgeInsetsOnly`,
  `edgeInsetsSymmetric`, `parseEdgeInsets`, `zeroInsets`,
  `addInsets`, `horizontalInset`, `verticalInset`,
  `contentWidthFromBorderBox`, `computeFlexLayout`, `fitsFlex`,
  `FlexContainer`, `FlexItem`, `FlexLayout`, `FitsFlexSpec`,
  `FitsFlexResult`, `FlexDirection`, `FlexJustify`,
  `FlexItemLayout`, `collapseMargins`, `computeBlockLayout`,
  `fitsBlock`, `BlockContainer`, `BlockLayout`, `BlockChildLayout`,
  `FitsBlockSpec`, `FitsBlockResult`, `aspectFit`, `fitsAspect`,
  `AspectLayout`, `FitsAspectSpec`, `FitsAspectResult`,
  `ObjectFit`, `IntrinsicImage`, `Slot`. All additive, v0.1
  surface untouched.
- **Bundle budget updates** (intentional growth for structural
  primitives): core 6.20 KB → 16.79 KB min / 2.61 KB → 6.63 KB gz;
  react 0.92 → 4.92 KB / 0.51 → 2.19 KB gz (style-resolver is
  react-side); vitest 951 B → 2.10 KB / 538 B → 806 B gz; jest
  1.07 → 2.24 KB / 905 B gz; cli 4.11 → 7.23 KB / 1.82 → 2.69 KB gz
  (color layer + layout matcher glue). Total shipped:
  **13.2 KB → 33.3 KB min / 6.1 KB → 13.2 KB gz**. Still an order of
  magnitude under any CSS-in-JS runtime it displaces. ADR 017
  records the "primitives live in core" policy; ADR 018 records
  the zero-dep colour decision.
- **Total v0.2 test count**: 269 tests green across all five
  packages (core 156, react 56, vitest 11, jest 5, cli 41) plus the
  928-case ground-truth corpus.

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
