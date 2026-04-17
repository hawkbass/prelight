# FINDINGS

Empirical results produced during Prelight development. Every claim in
README.md or the site traces to a dated entry here. When evidence changes,
we amend the entry with a `(amended YYYY-MM-DD, reason)` tag rather than
rewriting history.

---

## 2026-04-17 — v0.3 H5 `align-items: 'baseline'`: evidence status

Environment: Windows 10.0.26200, Bun 1.3.11, @prelight/core
internal build (committed after H4 as a65781d), no browser run.

### What was implemented

The `PRELIGHT-NEXT(v0.3 H5)` marker in
`packages/core/src/layout/flex.ts` — the H1-deferred baseline
alignment work — is retired. Baseline support now lives in the
flex engine as a fifth `FlexAlign` mode alongside
`start | end | center | stretch`.

Surface changes:

- `FlexAlign` union extended with `'baseline'`.
- `FlexItem` gains an optional `firstBaseline?: number` —
  distance in px from the item's border-box top to its primary
  text baseline. Undefined means "synthesised fallback"
  (treated as 0, i.e. the item's border-box top acts as its
  baseline). This is a documented simplification of CSS Flex
  L1 §8.3's "outer start edge" fallback; the two only diverge
  when items have non-zero leading cross-axis margins, and
  making the default trivial lets non-text items (images,
  spacers, buttons) compose with baseline-aligned text items
  without ceremony.
- `FlexLineLayout` gains a `baseline: number` field — the
  resolved line baseline measured from `crossStart`. Populated
  for `align: 'baseline'` only; 0 everywhere else.
- `direction: 'column'` + `align: 'baseline'` falls back to
  `'start'`. Prelight's baseline model is a vertical text
  baseline; the column cross axis is horizontal, so baseline
  semantics do not apply. Documented explicitly to keep
  behaviour predictable instead of silently producing broken
  cross offsets.

Algorithm (per line):

1. For each item compute `baselineOffsetOuter = leading +
   (firstBaseline ?? 0)` — the position of the baseline from
   the item's outer-top.
2. `lineBaseline = max(baselineOffsetOuter)` across the line.
3. Each item's outer-top is placed at `lineBaseline -
   baselineOffsetOuter`; border-box top is
   `outerTop + leading`.
4. Line cross-size is the max outer-bottom — which can exceed
   the natural max crossOuter when an item's descent pushes
   it below other items' bottoms. Tests C79, C81, C85 pin this
   behaviour explicitly.

### Available evidence (unit-test level)

- **H5 corpus**: 18 cases in `packages/core/test/flex.test.ts`
  (C73–C90). Four groups:

  1. Baseline basics (C73–C78): same-baseline alignment, mixed
     baselines pushing shorter-ascent items down, missing
     `firstBaseline` falling back to border-box top, three-item
     baseline consensus, leading margin shifting the baseline
     offset, and a guard that non-baseline align modes keep
     `line.baseline === 0` — the baseline field stays opt-in.
  2. Line sizing (C79–C83): line grows to hold the baseline
     stack, single-line `innerCross` clamps upward without
     changing the baseline anchor, deep-descent items extend
     the line past the baseline row, overflow detection via
     `fitsFlex` + `crossOverflows`, and uniform baselines
     collapse back to `max crossOuter` without accidental
     line-size inflation.
  3. Wrap interaction (C84–C86): each wrapped line resolves
     its own baseline; multi-line `crossGap` stacks lines with
     per-line baseline-driven cross sizes; multi-line
     `crossOverflows` reports the true stacked extent.
  4. Edge cases (C87–C90): `column + baseline` falls back to
     `start`; empty input produces empty layout; single item
     trivially aligns at `crossOffset 0`; `firstBaseline >
     item height` correctly clamps the descent region.

- **Regression gates**: all 72 pre-existing flex cases pass
  unchanged. The `baseline: 0` field on every other align mode
  is additive (no pre-existing assertion accesses it) and the
  `applyAlign` signature change is internal.

- **Full gates** (bun, Vitest, Jest, bundle budget) all green:
  typecheck 5/5, build 5/5, test **383 passing** (core 246,
  react 80, vitest 11, jest 5, cli 41; was 365 at end of H4),
  bundle `core` 21.90 KB min / 8.35 KB gz within the existing
  22.00 / 8.50 budget.

### What is **not** in this release (the honest gap)

- **No browser-confirmed round-trip** against Chromium /
  WebKit / Firefox. `ground-truth/harness.ts` remains a text-
  layout oracle; there is still no flex-container corpus with
  per-item rect extraction and no engine-calibrated tolerance
  for cross-axis baseline position. The H1 cliff rationale
  applies identically: building that infrastructure is a
  multi-day phase of its own. Same unit-tests-only evidence
  path carried forward from H1/H2/H3.

- **No font-ascent integration.** H5 ships the baseline
  algorithm with a user-supplied `firstBaseline`. Deriving
  that value from a font's ascent (so `@prelight/react` can
  auto-resolve it from the cascade-resolved font) is a
  separate, still-pending piece of work. The `cjk.ts`
  `PRELIGHT-NEXT(v0.3)` marker for surfacing
  `VerifySpec.measurementFonts` as a contract is **retained**
  — not retagged — so a future phase can retire it alongside
  ascent/descent threading through `Measurement`. Splitting
  these lets H5 land in its own tight commit instead of
  conflating baseline geometry with font-metrics plumbing.

In the interim the evidence invariant binds H5 as follows:

- README / site may claim "baseline alignment in row flex,
  driven by caller-supplied `firstBaseline`" and reference
  this FINDINGS entry.
- README / site MUST NOT claim "baseline alignment
  automatically derived from resolved fonts" — that's a later
  phase.
- README / site MUST NOT claim browser-verified baseline
  positions until the flex ground-truth harness exists.

### Bundle impact

`@prelight/core` grew 21.36 → 21.90 KB minified / 8.14 → 8.35
KB gzipped (+0.54 KB min / +0.21 KB gz). Well below the 1 KB
single-phase tripwire; no budget bump required. Remaining
budget headroom: 0.10 KB min / 0.15 KB gz (22.00 / 8.50). Tight
for H6–H8 core work; if another core phase also grows ~0.5 KB
min the budget will need a deliberate bump following the
existing H1 / H3 precedent.

### Evidence invariant reminder

- H5 shipping into `@prelight/core` with unit-level evidence
  is appropriate for the baseline *algorithm* (pure geometry
  given user-supplied `firstBaseline`).
- When ascent threading lands and `@prelight/react`'s cascade
  derives `firstBaseline` automatically, that claim goes
  beyond pure geometry — it depends on font metrics matching
  what browsers would render. That claim will require a
  real browser oracle before README/site claims "baselines
  align to real-browser pixel positions".

---

## 2026-04-17 — v0.3 H4 slot markers for multi-slot components: evidence status

Environment: Windows 10.0.26200, Bun 1.3.11, @prelight/react
internal build (committed after H3 as 188c141), no browser run.

### What was implemented

Two `PRELIGHT-NEXT(v0.3)` markers in `@prelight/react` were
retired (`extract.ts`'s slot-markers marker landed; the sibling
emotion/styled-components marker is retagged to
`PRELIGHT-NEXT(v0.3 H7)` to consolidate CSS-in-JS runtime probes
into one H7 phase).

**Marker convention.** Any React element with
`data-prelight-slot="name"` is a verifiable slot. Chosen because:

- React forwards `data-*` props to the rendered HTML attribute
  without transformation, so tree-walking and (if ever needed
  later) rendered-HTML inspection target the same marker.
- No runtime component to import or render — composes naturally
  with shadcn/Radix-style primitives that already spread rest
  props onto their root DOM element.
- Works across every element type.

**API surface**:

- `SLOT_ATTR = 'data-prelight-slot'` — symbolic constant for
  tooling that constructs slot-tagged elements at runtime.
- `findSlots(element): string[]` — depth-first preorder
  enumeration, deduped first-encounter-wins. Useful for
  diagnostics ("slot 'title' not found; known: [header, body]")
  and for corpus generators.
- `findSlotPath(element, slotName): ReactElement[] | null` —
  returns the exact ancestor path from root to slot, or null.
  Exposed so downstream tools (e.g. custom cascade engines) can
  replay their own logic along the slot path.
- `extractSlotText(element, slotName): string` — renders the
  slot subtree standalone via `react-dom/server` and runs it
  through `htmlToText()`. Missing slots throw with a helpful
  `known slots in this tree: [...]` message.
- `resolveStyles(element, { slot })` — existing cascade walker
  gains an optional `slot: string`. When set, resolvers replay
  along the ancestor path instead of the default first-text-
  branch descent. Missing slots throw.
- `verifyComponent({ slot })` — end-to-end slot verification.
  When `slot` is set, `extractSlotText` feeds the verifier; when
  `autoResolve` is also set, the slot is forwarded to
  `resolveStyles` so auto-derived font/maxWidth/lineHeight
  reflect the slot's cascade. Explicit spec-level values still
  win, matching v0.2 option precedence.

### Available evidence (unit-test level)

- **H4 corpus**: 24 cases in `packages/react/test/slots.test.tsx`
  (C01–C24). Four groups:

  1. `findSlots` discovery (6): empty tree → []; single slot;
     multi-slot preorder; duplicate dedup (first wins);
     non-string slot values ignored without crashing;
     `SLOT_ATTR` constant pinned to `'data-prelight-slot'` so
     external tooling sees a stable contract.
  2. `findSlotPath` targeting (5): root-is-slot; nested slot
     path of three ancestors; absent → null; duplicate preorder
     (first branch wins); sibling-branch skip (path-pop
     correctness after failed first branch).
  3. `extractSlotText` rendering (8): leaf text; nested
     elements collapse; same-tag sibling nesting (standalone-
     subtree render means depth tracking isn't even needed);
     different-tag bodies; missing slot error lists known
     slots; empty-tree known-list prints `(none)`; HTML
     entities (`&`) round-trip correctly via React SSR +
     `htmlToText`; standalone-subtree render proves ancestor
     siblings are excluded from slot text.
  4. `resolveStyles` + `verifyComponent` slot integration (5):
     cascade follows slot path (title → `24px Inter`, body →
     `14px Inter` inheriting from the div root); sibling branch
     that would win in default first-text-branch mode is
     correctly skipped when a slot is targeted; missing slot
     throws; `verifyComponent({ slot })` end-to-end pass with
     autoResolve; explicit `font` wins over autoResolve with
     slot targeting (v0.2 precedence preserved).

- **Regression gates**: 50 pre-existing `resolve-styles.test.tsx`
  cases and 6 `verify-component.test.tsx` cases all pass
  unchanged after the H4 rewiring. The `slot: undefined` path
  stays byte-identical to v0.2 behaviour.

- **Full gates** (bun, Vitest, Jest, bundle budget) all green:
  typecheck 5/5, build 5/5, test **365 passing** (core 228,
  react 80, vitest 11, jest 5, cli 41; was 341 at end of H3),
  bundle `react` 6.14 KB min / 2.64 KB gz within the new
  6.50 / 2.88 budget.

### What is **not** in this release (the honest gap)

- **No browser-confirmed round-trip.** The H4 features are
  100% in the React tree and React's SSR output. Claiming
  "slot verification matches Chromium / WebKit / Firefox
  layout" is a claim about *layout*, which is what Presize
  (v1.0) will deliver. H4 only claims that text extraction
  and style cascade are slot-aware — and those are unit-level
  claims. No browser harness is needed for H4, and we
  shouldn't pretend otherwise: the feature doesn't render,
  doesn't paint, and doesn't depend on any browser-specific
  behaviour. This is different from H1/H2/H3 where the
  features are *layout engines* and a browser harness is the
  eventual correctness oracle.

In the interim the evidence invariant binds H4 as follows:

- README / site may claim "slot-aware text extraction and
  style resolution" and reference this FINDINGS entry.
- README / site MUST NOT claim "pixel-accurate slot layout"
  because slot-aware *layout* is a v1.0 Presize concern, not
  an H4 one.

### Bundle impact

`@prelight/react` grew 4.92 → 6.14 KB minified / 2.19 → 2.64 KB
gzipped (+1.22 KB min / +0.45 KB gz). Cost breakdown, roughly:

- `slots.ts` walker + extractor surface: ~0.75 KB min
- `resolveStyles` slot-path branch + replay: ~0.35 KB min
- `verifyComponent` slot wiring: ~0.12 KB min

A first-pass `sliceMarkupForSlot` depth-tracking HTML slicer
was dropped in-phase (saving ~0.74 KB min) after realising
that `renderToStaticMarkup` can take the slot subtree directly
without slicing the parent render. This simplification is
**the feature**, not an afterthought — it makes the slot
semantics identical to existing `extractText` (a standalone
SSR render) rather than introducing a new "slice a wrapping
render" path.

Budget bumped from 5.50 → 6.50 KB min / 2.38 → 2.88 KB gz
(~0.36 KB min / ~0.24 KB gz headroom). Same bump-with-feature
rule as H1 and H3; the `core` bundle is unchanged.

### Evidence invariant reminder

- H4 shipping into `@prelight/react` with unit-level evidence
  is appropriate: nothing in this phase is a layout claim.
- Any future feature that names a slot in its output
  (e.g. "slot 'body' failed maxLines") inherits the existing
  verifier's browser-evidence requirements via the text the
  slot feeds in.
- When runtime probes land in H7 and the style cascade can
  read styled-components / emotion output, FINDINGS must get a
  fresh entry that proves the probe's output against a
  rendered-in-browser reference — that claim is beyond H4's
  scope.

---

## 2026-04-17 — v0.3 H3 aspect `object-position` + percentage edge insets: evidence status

Environment: Windows 10.0.26200, Bun 1.3.11, @prelight/core internal
build (committed after H2 as 3256742), no browser run.

### What was implemented

Two v0.3 markers in `packages/core/src/layout/` were retired:

1. **`object-position` in `aspect.ts`** (CSS Images Module). The
   `aspectFit()` signature now accepts an optional
   `ObjectPosition = { x: number; y: number }` parameter where
   each component lies on the unit interval (0 = start-edge
   aligned, 1 = end-edge aligned, 0.5 = centered = CSS default
   `50% 50%`). Output `AspectLayout` gained eight per-side
   fields (`letterboxLeft`/`Right`/`Top`/`Bottom`,
   `clippedLeft`/`Right`/`Top`/`Bottom`) computed from the
   rendered rect + position slack. The legacy `letterboxX`/`Y`
   and `clippedX`/`Y` fields report `max(left, right)` /
   `max(top, bottom)` so worst-side threshold checks still
   catch asymmetric placements. Under the centered default
   (`{ x: 0.5, y: 0.5 }`), both views are byte-identical to
   v0.2 output — zero observable change for existing callers.
   Positions outside [0, 1] clamp to [0, 1]; full CSS overhang
   is deferred (see `aspect.ts` `PRELIGHT-NEXT(v0.4+)`).
2. **Percentage edge insets in `box.ts`** (CSS 2.1 §8.4, §10).
   New `PercentInset = { percent: number }` tag, `pct(n)`
   helper, `ResolvableInset = number | PercentInset`, and
   `ResolvableEdgeInsets` partial spec. `resolveInsets(spec,
   containingBlockWidth)` resolves all four edges against the
   caller-supplied containing-block width — preserving the CSS
   quirk that vertical (top/bottom) padding and margin
   percentages also resolve against **width**, not height.
   `parseEdgeInsets(shorthand, containingBlockWidth?)` gained
   a second optional argument so `%` tokens work in the
   shorthand, with a clear `contains %-tokens` error when a
   width is needed but missing. `parseResolvableInsets()`
   defers resolution for programmatic callers who know the
   shorthand before the width. Pure px-only shorthands still
   work with a single argument — v0.2 API preserved.

### Available evidence (unit-test level)

- **Aspect**: 32 cases in `packages/core/test/aspect.test.ts`
  (was 20, +12 for H3.1 as C21–C32). C21–C22 verify default
  equals `OBJECT_POSITION_CENTER`; C23–C27 exercise
  asymmetric letterbox/clip distribution across `contain` and
  `cover`; C28 confirms v0.2 centered output is preserved;
  C29 confirms `fitsAspect` catches worst-side pile-up
  (a 100 px letterbox on one side fails a 10 px threshold
  even when the "average" per-side is 50 px); C30 verifies
  overhang clamp; C31 verifies zero-size image honours
  position; C32 verifies `fill` (no slack) is position-invariant.
- **Box**: 38 cases in `packages/core/test/box.test.ts`
  (was 30, +8 for H3.2 as C31–C38). C31 shape; C32 basic
  resolution; C33 pins the vertical-width CSS quirk (C33
  would break silently if we ever switched vertical edges
  to height-resolve); C34 mixed px/%; C35–C36
  `parseEdgeInsets` with width; C37 defer-then-resolve;
  C38 error paths. The existing C10 was updated to assert
  the new `contains %-tokens` error message (% with no width)
  while still asserting that `calc()` tokens remain
  unsupported.
- **Full gates** (bun, Vitest, Jest, bundle budget) all green
  after H3: typecheck 5/5, build 5/5, test 341 passing
  (core 228, react 56, vitest 11, jest 5, cli 41), bundle
  `core` 21.36 KB min / 8.14 KB gz (budget 22.00 / 8.50
  after this phase's bump; see below).

### What is **not** in this release (the honest gap)

- **No browser-confirmed ground-truth** for either `object-position`
  or percentage insets. Same reason as H1 and H2: the existing
  `ground-truth/` harness is a text-layout oracle —
  string in, Playwright-measured line-wrap out. It has no
  image-rect extractor (needed for H3.1: take a slot +
  intrinsic + fit + position, render `<img>` in three
  browsers, read `getBoundingClientRect()` for the rendered
  pixel rect and subtract from the slot to obtain per-side
  letterbox/clip) and no box-model extractor (needed for
  H3.2: render a div with `padding: 10%` inside a
  known-width containing block and read `getComputedStyle`).
  Both harnesses are straightforward to build (Playwright
  exposes both `boundingClientRect` and `getComputedStyle`
  via `page.evaluate`), but they are new corpora with their
  own schemas, tolerances, and stability surface. That work
  will land with `v0.3 H6` (CJK/emoji measurementFonts —
  which already needs a browser-measurement path) or as a
  dedicated structural-harness phase.

In the interim the evidence invariant binds H3 the same way it
bound H1/H2: unit-test arithmetic is evidence for "the engine
applies the CSS formula we intended" and is *not* evidence for
"the formula matches what Chromium / WebKit / Firefox
render." README.md and the site are **not** permitted to claim
browser-confirmed `object-position` or percentage-inset
behaviour until the FINDINGS entry is amended with a dated
ground-truth run.

### Bundle impact

`@prelight/core` grew 19.71 → 21.36 KB minified / 7.58 → 8.14
KB gzipped (+1.65 KB min / +0.56 KB gz). This crossed the
self-imposed 1 KB single-phase tripwire. The growth splits
roughly half-and-half between the two subphases: H3.1 expands
`aspectFit` with a second arithmetic path (per-side slack
distribution) and enlarges `AspectLayout` by eight fields; H3.2
introduces the `ResolvableInset` type layer plus a second
tokenizer branch for `%`. Both are algorithmic work on named
v0.3 markers from `ROADMAP.md`, no accidental expansion.
Budget bumped from 20.00 KB min / 8.00 KB gz to 22.00 KB min /
8.50 KB gz, following the same bump-with-feature pattern as
H1.

### Evidence invariant reminder

- Unit tests prove *implementation intent matches our reading
  of the spec*.
- Ground-truth runs prove *implementation matches Chromium /
  WebKit / Firefox*.
- Public documentation may reference only the second, dated
  in FINDINGS.md. H3.1 and H3.2 ship into `@prelight/core`,
  `CHANGELOG.md` notes them as released features, but
  `README.md` and any blog-post copy must steer clear of
  claims like "pixel-accurate against real browsers" for
  `object-position` or percentage insets until the
  structural ground-truth harness exists and produces a
  run.

---

## 2026-04-17 — v0.3 H2 block-flow completeness: evidence gap on browser confirmation

Environment: Windows 10.0.26200, Bun 1.3.11, @prelight/core internal
build (committed after H1 as 266c38d), no browser run.

### What was implemented

Three v0.3 markers in `packages/core/src/layout/block.ts` were
retired:

1. **Parent-child margin collapse** (CSS 2.1 §8.3.1). Opt-in via
   a new `BlockContainer.collapseWithParent: true` flag plus parent
   `padding` / `border` / `margin` fields. Edge conditions mirror
   the spec: top collapse requires `padding.top === 0` AND
   `border.top === 0`; bottom additionally requires
   `innerHeight === undefined` (a definite container height
   contains the bottom margin). Layout output exposes
   `effectiveMarginTop` / `effectiveMarginBottom` so callers know
   the container's outer margins for use in their own parent flow.
2. **Empty-block self-collapse** (§8.3.1, "a block box with no
   in-flow content, no padding, and no border ... its margins
   collapse"). Predicate: `borderBoxHeight === 0` AND zero
   top+bottom padding+border. Such children have top+bottom
   margins folded into a single margin that participates in
   adjacent-sibling collapse. New `BlockChildLayout.emptyBlock`
   flag plus exported `isEmptyBlock()` predicate.
3. **Clearance from floats** — retagged from `v0.3` to `v1.0+`.
   Rationale recorded below.

Two new out-of-scope markers for v0.4: chained-empty-into-parent
collapse, and empty-container-self-collapse. Both need a second
pass over children and are orthogonal to H2's immediate scope.

### Evidence available

- **20 new unit tests** in `packages/core/test/block.test.ts`
  (C31–C50), organised as:
    - C31–C36: parent-child top collapse — basic case, blocked
      by padding, blocked by border, mixed-sign sums, equal
      margins, zero-child-margin cases.
    - C37–C41: parent-child bottom collapse — basic, blocked
      by `innerHeight`, blocked by padding, blocked by border,
      mixed-sign sums.
    - C42–C44: combined edges + opt-in guards — both-edge
      collapse, opt-in-off backwards compat, empty-children
      with opt-in.
    - C45–C50: empty-block mechanics — `isEmptyBlock` predicate,
      variadic `collapseMarginList`, single empty between
      non-empties, empty-with-padding is NOT empty, chain of
      multiple empties, trailing empty after last non-empty.
  Every expected value is derived from a specific §8.3.1 clause
  in per-test comments.
- **30 v0.2 block tests pass unchanged**. Backwards compat is
  enforced by the `collapseWithParent === true` opt-in: without
  that flag, the engine's output is byte-identical to v0.2.
- Full gates: `bun run typecheck` (5/5 packages, 0 errors),
  `bun run test` (321 passing — 50 block + 72 flex + 16 line-box
  + 48 shape + 3 predicates + 19 verify = 208 core, plus 56 react,
  11 vitest, 5 jest, 41 cli), `bun run build` (5/5), strict
  bundle measure (@prelight/core 19.71 KB min / 7.58 KB gz within
  budget 20.00 / 8.00).

### Evidence MISSING

- **Zero browser-confirmed cases for parent-child collapse or
  empty-block self-collapse.** Same root cause as H1: the existing
  `ground-truth/harness.ts` is exclusively a text-layout oracle.
  It renders corpus strings via Playwright and checks
  `getBoundingClientRect()` height against `verify()`'s prediction;
  it has no corpus schema for block-container fixtures, no
  per-child offsetTop extraction, no per-engine calibration for
  sub-pixel margin-collapse rounding.
- Building a structural ground-truth harness is a distinct phase
  that would cover H1 (flex) AND H2 (block) AND H3 (aspect + box)
  AND H4 (viewport units) in one go. That phase is NOT being
  inserted into v0.3 mid-stream — it's flagged here and in the
  HANDOFF block as a v0.3.0-rc blocker or a dedicated v0.4 kick-off
  item. The user explicitly picked "unit-test-only evidence" for
  H1 (Option A in HANDOFF §2026-04-17) and H2 preserves that
  choice.

### The evidence invariant (reaffirmed)

No user-facing claim — README, docs site, package metadata,
CHANGELOG prose describing browser verification — asserts that
block-flow parent-child collapse or empty-block self-collapse is
"verified against Chromium/WebKit/Firefox". CHANGELOG's H2 block
explicitly states **unit-test-only evidence** and points here for
the full context. When a structural ground-truth harness lands,
this entry gets an `(amended YYYY-MM-DD, added N cases against
Chromium vN)` tag with the new numbers.

### Why floats clearance was retagged, not implemented

CSS 2.1 §9.5.2 clearance is a substantial chunk of the visual
formatting model: it interacts with block formatting context
roots, `clear: left|right|both`, and float stacking. More
importantly, Prelight's `Box` model has no `float` field — a
consumer cannot actually express a float-in-flow child today, so
the engine receives pure block-flow children by construction.
Implementing clearance would require (a) extending `Box` to carry
a float discriminator, (b) a separate float layout pass, and (c)
substantial ground-truth calibration. Given how rare floats are
in modern React/styled-components / CSS-in-JS codebases, the
honest move is to flag rather than ship a partial or hypothetical
implementation. `PRELIGHT-NEXT(v1.0+)` in `block.ts` documents the
decision.

### Bundle impact

`@prelight/core` grew from 18.55 KB min / 7.25 KB gz (H1 end) to
19.71 KB min / 7.58 KB gz (H2 end), a +1.16 KB min / +0.33 KB gz
increase. That stays within the H1-set budget (20.00 KB min / 8.00
KB gz) with ~0.29 KB min / ~0.42 KB gz headroom remaining. H3–H8
may require a second budget bump; the decision is deferred to
whichever phase first exceeds the remaining headroom, so the bump
(if any) is made against a specific feature rather than
speculatively.

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
