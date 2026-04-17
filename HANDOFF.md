# HANDOFF

Living handoff for agents picking up Prelight mid-stream. Append a new dated
block at the top whenever you end a session with live state worth carrying
forward. Do not delete old blocks — trim only when a block is superseded in
full.

The goal: a fresh agent opening this repo should be able to read the top
block, read the transcripts it points to, and continue without re-deriving
the work.

---

## 2026-04-17 — v0.3 H6c landed; stop before H7 (runtime style probes) — pre-registered cliff phase

**Session transcript:** [v0.3 H6c emoji harness font](70642c52-297d-4419-8e18-3894c42f3a0b)

### State (fully committed)

H6c shipped on top of H6b (`13280d2`):

- **H6c** v0.3 H6c: bundled emoji harness font.
  `ground-truth/fonts/NotoEmoji-subset.ttf` (611 KB) is a
  monochrome outline subset of `Noto-COLRv1.ttf` (tag v2.051,
  SHA-256-pinned), GSUB-closed so ZWJ sequences, skin-tone
  modifiers, keycap sequences, and regional-indicator flags
  resolve to single ligature glyphs. Registered on both sides of
  the oracle: browser via `@font-face` in `bootstrap.html`
  aliased to `'Inter'` over the emoji `unicode-range`, canvas via
  `loadBundledFont` + `setEmojiMeasurementFamilies(['Prelight Noto Emoji'])`.
  `correctEmojiLayout` refactored to measure per-grapheme under
  different fonts (emoji family for emoji graphemes, spec's own
  `font` for non-emoji graphemes) — parallels
  `correctCJKLayout`'s existing split.

Working tree holds H6c changes ready for commit plus the pre-
existing v0.2.0-rc doc fixes (`README.md`, `ROADMAP.md`) and the
research scratch. Do NOT fold the doc fixes into the H6c commit
— they still belong to v0.3.0-rc tagging at H8.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run test` — **407 passing** (core 270, react 80, vitest
  11, jest 5, cli 41). No delta vs H6b — H6c moves ground-truth
  numbers, not unit-test count.
- `bun scripts/measure-bundle.ts` — within budget:
  - `@prelight/core` 23.86 KB min / 8.99 KB gz (24.00 / 9.00)
    — **~0.14 KB min / ~0.01 KB gz headroom remaining**. H7 will
    breach this ceiling; deliberate budget bump expected then
    (same pattern as H1 / H3 / H6a).
  - `@prelight/react` 6.14 KB min / 2.64 KB gz (6.50 / 2.88)
  - `@prelight/vitest` 2.10 KB min / 806 B gz (2.50 / 1.00)
  - `@prelight/jest` 2.24 KB min / 905 B gz (2.50 / 1.00)
  - `@prelight/cli` 7.23 KB min / 2.69 KB gz (8.00 / 3.00)
- `npx tsx run.ts --browser all --strict` (from
  `ground-truth/`) — passes all per-engine per-language floors:
  - chromium 917/928 (98.81%); emoji 407/408 (99.75%)
  - webkit   919/928 (99.03%); emoji 407/408 (99.75%)
  - firefox  915/928 (98.60%); emoji 407/408 (99.75%)
  - Floors raised emoji 0.88 → 0.98 per engine; DECISIONS #008
    updated in lockstep.

### Ground-truth status (substantive jump — the headline H6c result)

Chromium emoji: 90.0% → **99.75%** (367/408 → 407/408).
WebKit + Firefox now carry emoji at 99.75% as well (they had
no bundled emoji face pre-H6c, so this is their first pass at
the corpus too). Residual 1/408 per engine is variation-selector
cascade ('⚠️', '☀️' etc. with `U+FE0F` default text presentation),
which is engine-specific font cascade behavior rather than a
systemic Prelight bug. Documented as a known residual in
FINDINGS §H6c; not pursued because the fix would require
per-engine cascade simulation inside `correctEmojiLayout` — a
much larger surface area than the single case it would recover.

### The sharp lesson from this phase (write-up in FINDINGS §H6c)

H6c took roughly 3 hours longer than estimated because the
standard Node font-subsetting toolchain has **undocumented
color-table behavior**:
1. `subset-font` runs `fontverter.convert(_, 'truetype')` before
   invoking `hb-subset`; `fontverter` doesn't know about
   `CBDT`/`CBLC` or `COLR`/`CPAL`, so those tables are dropped
   regardless of `targetFormat`. `targetFormat` is the conversion
   output format, not a "preserve this feature" flag.
2. `harfbuzzjs@0.10.3` is compiled with `-DHB_TINY`, which
   defines `HB_NO_COLOR` and `HB_NO_BITMAP` at compile time —
   the WASM *cannot* emit color or bitmap tables at all. No
   npm-shipped WASM supports color subsetting today.
3. The path that works for *measurement* (not visual) fidelity
   is leveraging `fontverter`'s table-drop as a *feature* on
   Noto-COLRv1's `glyf` outline fallback. The outline subset
   has the same `hmtx` advance widths as the color source —
   which is all a measurement oracle needs.

This is the kind of deep-investigation writeup the user asked
for ("absolute best work", "feather in my cap"). A future agent
picking up H7 or a color-emoji follow-up should read
FINDINGS §H6c before touching this toolchain.

### Why I stopped here (pre-registered cliff, matches H5/H6a/H6b pattern)

H6c is the last "correction infrastructure" phase in v0.3. H7
(runtime style probes for emotion + styled-components) is the
**high-risk cliff phase** pre-registered in the original v0.3
plan review. It needs a runtime (not AST) probe path, a
different algorithmic shape from any phase shipped so far, and
specifically flagged as needing fresh context + user
confirmation on scope before code moves. Landing H6c at the tail
end of a long session and then pivoting into H7 on the same
autopilot is exactly the cliff the user pre-registered against.

H7 scope was already pinned with the user in the H6b handoff
discussion:
- **Runtime** probe (mount components into a hidden DOM, read
  computed styles off real browser nodes) via **happy-dom**.
- **Both** unit + example-integration tests AND Playwright
  ground-truth harness extension.
- **Full coverage** of supported style patterns (static styles,
  dynamic props, theme providers, nested selectors).
- **Bump the bundle budget when needed, but still keep it as
  lean as we can** — `@prelight/react` 6.14 → 6.50 KB is the
  next constraint, expected to break.

### What a fresh agent should do first

1. Read this block + the "evidence invariant" in `AGENTS.md`.
2. Read the top entries of `CHANGELOG.md` (Phase H6c) and
   `FINDINGS.md` (2026-04-17 H6c, top entry) — H6c is where the
   emoji numbers actually move, and the FINDINGS entry contains
   the full subsetter-investigation writeup.
3. Read `packages/core/src/shape/emoji.ts` — the per-grapheme
   split that `correctEmojiLayout` now does. This is the shape
   that `correctCJKLayout` has always had; new script-specific
   corrections (devanagari, thai) should follow the same
   template.
4. Read `packages/react/src/style-resolver.ts` and
   `packages/react/src/extract.ts` for the
   `PRELIGHT-NEXT(v0.3 H7)` markers — that's the H7 scope.
5. H7 scope is already locked with the user (see "Why I stopped
   here" above). **Before touching H7 code, reconfirm
   happy-dom + full coverage still holds**, then proceed. Do
   NOT start H7 at the tail end of a long session — it's the
   pre-registered cliff.

### Remaining v0.3 backlog

- **H7**: Runtime style probes for emotion + styled-components
  — the `PRELIGHT-NEXT(v0.3 H7)` markers in
  `packages/react/src/style-resolver.ts` and
  `packages/react/src/extract.ts`. Pre-registered as the
  high-risk cliff phase. Scope locked: happy-dom runtime probe,
  full coverage, bundle bump allowed.
- **H8**: v0.3.0-rc tagging. Fold the pre-existing v0.2.0-rc
  doc fixes (`README.md`, `ROADMAP.md`) into this release
  alongside an H8 docs pass that updates v0.3's shipped
  feature set (H1 flex-wrap + align-items-{start,end,center,stretch,baseline},
  H2 block-flow completeness, H3 aspect object-position +
  percentage edge insets, H4 slot markers, H5 baseline align,
  H6a CJK `measurementFonts`, H6b emoji `measurementFonts`,
  H6c emoji harness font, H7 runtime style probes). Same
  publish-decision wait as v0.2.0-rc — user says go before
  anything pushes.

### Nice-to-haves not yet blocking any phase

- **Color emoji via grafted or rebuilt harfbuzzjs WASM**: would
  restore visual fidelity in the harness output. Does NOT move
  measurement numbers (monochrome outline already has the same
  `hmtx` advance widths as the color source). Tracked as
  follow-up, not blocking v0.3.
- **Over-wrap bug from H6b**: the 8 emoji cases where isolated
  `verify()` returns correctly but the harness dump reports
  extra lines. H6c's per-grapheme split almost certainly closed
  some of these (chromium emoji went from 8 over-wrap at H6b to
  1 variation-selector cascade case post-H6c). If a fresh
  agent wants to re-investigate, compare H6b's pre-H6c
  `emoji-baseline-2026-04-17.json` against H6c's new
  `cross-engine-h6c-2026-04-17.json` to isolate which over-wrap
  cases are still open.
- **Emoji presentation-selector cascade residual**: 1/408 per
  engine. Requires per-engine cascade simulation. Defer
  indefinitely unless a real user hits it.

### Versioning context (unchanged from prior blocks)

The user chose to invent intermediate point releases (v0.4,
v0.5, …) between v0.3 and v1.0, slicing the v1.0 "full
Presize engine" scope. Exact slicing of v0.4/v0.5 content is
**still pending user input** and should be asked for only
after v0.3 lands.

---

## 2026-04-17 — v0.3 H6b landed; stop before H7 (runtime style probes) — pre-registered cliff phase

**Session transcript:** [v0.3 H6b emoji measurementFonts contract](940bdce9-d3a9-4949-b8d9-5b8793c69f0c)

### State (fully committed)

H6b shipped as `13280d2` on top of H6a's `4e90d5b`:

- **H6b** `13280d2` v0.3 H6b: VerifySpec.measurementFonts.emoji
  contract surface. Retires the `PRELIGHT-NEXT(v0.3 H6b)`
  marker in `packages/core/src/types.ts`. Adds
  `MeasurementFontFamilies.emoji?: string[]`; new
  `correctEmojiLayout` pass in `packages/core/src/shape/emoji.ts`
  chained after `correctCJKLayout` in `verify()`. New public
  exports: `containsEmoji`,
  `correctEmojiLayout`,
  `setEmojiMeasurementFamilies`,
  `getEmojiMeasurementFamilies`. Precedence identical to H6a
  (per-call > global > no-op); empty-array opts out. **Unlike
  H6a, NO monotonicity floor** — emoji disagreements observed
  split bidirectionally (33 under-wrap, 8 over-wrap on the
  H6a baseline), so clamping either direction would leave
  half the population uncorrected.

Working tree again holds only the pre-existing v0.2.0-rc doc
fixes (`README.md`, `ROADMAP.md`) plus untracked research /
`.cursor` scratch — identical to the post-H6a tree. Do NOT
fold those doc fixes into any v0.3 commit; they still belong
to v0.3.0-rc tagging at H8.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run test` — **402 passing** (core 270, react 80,
  vitest 11, jest 5, cli 41). +12 vs H6a (all from the new
  M13–M24 emoji cases in `measurement-fonts.test.ts`).
- `bun run build` — 5/5 packages, 0 errors
- `bun scripts/measure-bundle.ts --strict` — within budget:
  - `@prelight/core` 23.80 KB min / 8.97 KB gz (24.00 / 9.00)
    — **~0.20 KB min / ~0.03 KB gz headroom remaining**. Next
    core phase growing by ≥0.2 KB min will trigger a budget
    bump (same pattern as H1 / H3 / H6a).
  - `@prelight/react` 6.14 KB min / 2.64 KB gz (6.50 / 2.88)
  - `@prelight/vitest` 2.10 KB min / 806 B gz (2.50 / 1.00)
  - `@prelight/jest` 2.24 KB min / 905 B gz (2.50 / 1.00)
  - `@prelight/cli` 7.23 KB min / 2.69 KB gz (8.00 / 3.00)

### Ground-truth status (unchanged by H6b alone — by design)

H6b is a contract-surface landing: consumers now have a way
to register an emoji-capable face via
`VerifySpec.measurementFonts.emoji`. The ground-truth harness
(`ground-truth/harness.ts`) does not yet register any emoji
face with `@napi-rs/canvas`, so the probe returns `null` and
the correction is a no-op in the harness run. Chromium emoji
agreement stays at 367/408 (90.0%) exactly as the pre-H6b
baseline captured in `ground-truth/emoji-baseline-2026-04-17.json`.

**Moving the emoji number is follow-up work** (not H7): ship
an emoji font subset in `ground-truth/fonts/`, wire it through
`bootstrap.html` via `@font-face`, and call
`setEmojiMeasurementFamilies(['...'])` in the harness startup.
This is a product decision (which face, color vs monochrome,
how many KB of glyph data) rather than a code change. Tracked
mentally as "emoji harness font" — not yet a formal
`PRELIGHT-NEXT` marker. If taking this on, keep it separate
from H7 and H8 so the two concerns don't entangle.

### Why I stopped here (pre-registered cliff, matches H5/H6a pattern)

H6b was scoped during pre-implementation discussion as "emoji
contract surface + correction pass, no harness font yet". That
scope is now complete: the marker is retired, the contract is
wired, precedence is codified, 12 tests prove the wiring, the
bundle stays within H6a's ceiling, and the over-wrap bug is
explicitly deferred with reasoning (FINDINGS.md §H6b,
CHANGELOG Phase H6b).

H7 (runtime style probes for emotion + styled-components) is
the **high-risk cliff phase** pre-registered in the original
v0.3 plan review. It needs a runtime (not AST) probe path —
a different algorithmic shape from any phase shipped so far,
and specifically flagged as needing fresh context + user input
on scope before I touch code. Landing H6b at the tail end of a
long session and then pivoting into H7 on the same autopilot
is exactly the cliff the user pre-registered against.

### What a fresh agent should do first

1. Read this block + the "evidence invariant" in `AGENTS.md`.
2. Read the latest `CHANGELOG.md` (Phase H6b, top entry) and
   `FINDINGS.md` (2026-04-17 H6b, top entry) — both describe
   the contract surface, the under-wrap vs over-wrap split,
   and the ground-truth-unchanged-by-design reasoning.
3. Read `packages/core/src/shape/emoji.ts` + the H6a sibling
   `packages/core/src/shape/cjk.ts` side-by-side. The two
   files deliberately mirror each other except for the
   monotonicity-floor divergence, and that structural pairing
   is the template any future H6-class correction (e.g.
   devanagari, thai) should follow.
4. Read `packages/react/src/style-resolver.ts` and
   `packages/react/src/extract.ts` for the
   `PRELIGHT-NEXT(v0.3 H7)` markers — that's the H7 scope.
5. **Before touching H7 code, ask the user**. The original
   v0.3 review flagged H7 as "the phase to pause on before
   design-review". Minimum questions to line up for the user:
    - Does H7 ship a **runtime** probe (mount components into
      a hidden DOM, read computed styles off real browser
      nodes) or a **semi-runtime** probe (introspect
      emotion/styled-components' style cache without a DOM
      mount)?
    - Ground-truth implications: runtime probes may need a
      Playwright-side corpus, which is a larger infrastructure
      lift than the H2–H6b pure-core work. Is H7 allowed to
      extend the ground-truth harness surface, or does it
      stay unit-test + example-integration level like H1–H6b?
    - Does the product want H7 to cover **all supported
      style patterns** (static styles, dynamic props, theme
      providers, nested selectors) or a MVP slice?
    - Bundle envelope for `@prelight/react` is currently
      6.14 KB min. H7 will push it; the 6.50 KB / 2.88 KB
      ceiling is the next constraint — not a hard blocker,
      but worth naming before scope grows.

### Remaining v0.3 backlog

- **H7**: Runtime style probes for emotion + styled-components
  — the `PRELIGHT-NEXT(v0.3 H7)` markers in
  `packages/react/src/style-resolver.ts` and
  `packages/react/src/extract.ts`. Pre-registered as the
  high-risk cliff phase. Expect to pause before H7 and get
  user input on scope before any code moves.
- **H8**: v0.3.0-rc tagging. Fold the pre-existing v0.2.0-rc
  doc fixes (`README.md`, `ROADMAP.md`) into this release
  alongside an H8 docs pass that updates v0.3's shipped
  feature set (H1 flex-wrap + align-items-{start,end,center,stretch,baseline},
  H2 block-flow completeness, H3 aspect object-position +
  percentage edge insets, H4 slot markers, H5 baseline align,
  H6a CJK `measurementFonts`, H6b emoji `measurementFonts`,
  H7 runtime style probes). Same publish-decision wait as
  v0.2.0-rc — user says go before anything pushes.

### Nice-to-haves not yet blocking any phase

- **Emoji harness font**: the one change that would move the
  chromium emoji number above 90%. Product decision, not a
  code change (see "Ground-truth status" above). Can be done
  in parallel with H7 by a second agent if desired.
- **Over-wrap bug**: the 8 emoji cases where isolated
  `verify()` returns correctly but the harness dump reports
  extra lines. Suspect: harness case-ordering or Pretext's
  internal `segmentMetricCaches` retaining state across cases.
  Needs a minimal reproduction first. Safe to defer until
  after v0.3.0-rc.

### Versioning context (unchanged from prior blocks)

The user chose to invent intermediate point releases (v0.4,
v0.5, …) between v0.3 and v1.0, slicing the v1.0 "full
Presize engine" scope. Exact slicing of v0.4/v0.5 content is
**still pending user input** and should be asked for only
after v0.3 lands.

---

## 2026-04-17 — v0.3 H6a landed; stop before H6b (emoji) — new capability, not a contract move

**Session transcript:** [v0.3 H6a measurementFonts.cjk contract](0ab7a65b-69bb-48c9-b9af-f8bf5624a030)

### State (fully committed)

H6a shipped as `4e90d5b` on top of `57b34a0`:

- **H6a** `4e90d5b` v0.3 H6a: VerifySpec.measurementFonts.cjk
  contract surface. Retires the `PRELIGHT-NEXT(v0.3)` marker
  in `packages/core/src/shape/cjk.ts`. New
  `MeasurementFontFamilies` type (just `cjk?: string[]` today;
  emoji slot tracked inline as `PRELIGHT-NEXT(v0.3 H6b)`). New
  optional `measurementFonts?` on `VerifySpec`. Precedence
  codified: per-call arg > module-level global > spec's own
  `font`. Empty-array (`cjk: []`) is the explicit opt-out
  signal.
- **Bundle budget bumped** `@prelight/core` 22.00 → 24.00 KB
  min / 8.50 → 9.00 KB gz in the same commit (the H5 handoff
  flagged the 22.00 ceiling only had 0.10 KB headroom
  remaining; H6a's +0.11 KB crossed it by 0.01 KB). Deliberate
  round-number step matching H1 18→20 and H3 20→22. ~2 KB min
  / ~0.6 KB gz headroom now remains for H6b + H7 + H8.

Working tree holds only the pre-existing v0.2.0-rc doc fixes
(`README.md`, `ROADMAP.md`) plus the untracked research file
(`cursor_chenlou_pretext_tool_research.md`) — identical to the
pre-H6a state. Do NOT fold those doc fixes into any v0.3
commit; they still belong to v0.3.0-rc tagging at H8 when
every test count and doc reference stabilises.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run test` — **395 passing** (core 258, react 80,
  vitest 11, jest 5, cli 41). +12 vs H5 (all from the new
  `measurement-fonts.test.ts` suite).
- `bun run build` — 5/5 packages, 0 errors
- `bun scripts/measure-bundle.ts --strict` — within budget:
  - `@prelight/core` 22.01 KB min / 8.41 KB gz (24.00 / 9.00)
    — ~2 KB min / ~0.6 KB gz headroom for H6b + H7 + H8.
  - `@prelight/react` 6.14 KB min / 2.64 KB gz (6.50 / 2.88)
  - `@prelight/vitest` 2.10 KB min / 806 B gz (2.50 / 1.00)
  - `@prelight/jest` 2.24 KB min / 905 B gz (2.50 / 1.00)
  - `@prelight/cli` 7.23 KB min / 2.69 KB gz (8.00 / 3.00)

### Why I stopped here (natural boundary, not a code cliff)

H6a was deliberately scoped as "CJK contract surface only"
during the pre-implementation planning pass with the user.
That scope is now complete: the marker is retired, the
contract is wired, the precedence is codified in code and
docs, the tests prove the wiring, the bundle bump is
deliberate and documented, the back door is retained by
design.

H6b (emoji measurement) is a **genuinely new capability**, not
a contract move. It needs:
- A new `containsEmoji` predicate covering the relevant
  Unicode blocks (Emoji, Emoji_Presentation, various
  Supplementary Multilingual Plane blocks, ZWJ sequences).
- A new probe path — probably `pickEmojiFamily` with a
  different probe glyph. The delta threshold may also need
  re-tuning; emoji glyph widths across host fonts are not
  the same regime as CJK.
- A decision on where the emoji correction slots into the
  verify pipeline. Unlike CJK (which re-wraps because
  Pretext under-wraps), emoji's failure mode is *width*
  estimation of emoji runs inside otherwise-Latin text —
  that's a different algorithmic shape than
  `correctCJKLayout`, and possibly needs its own
  `correctEmojiLayout` function (or a re-measurement pass
  on Pretext's existing lines rather than a re-wrap).
- The additive shape change:
  `MeasurementFontFamilies.emoji?: string[]` — trivial.

I genuinely don't have a confident design for H6b's slot in
the pipeline without more investigation, and designing it at
the tail end of a long session is exactly the cliff-edge
failure mode the user pre-registered against. Stop here, let
a fresh agent pick it up with full attention.

### What a fresh agent should do first

1. Read this block + the "evidence invariant" in
   `AGENTS.md`.
2. Read the latest CHANGELOG.md + FINDINGS.md H6a entries —
   the top blocks describe the contract surface and the
   precedence rules as shipped.
3. Read `packages/core/src/shape/cjk.ts` as the structural
   template for any H6b emoji path — it shows the
   per-call > global fallback idiom.
4. Read `packages/core/src/verify.ts:89` to see where in
   the correction pipeline emoji would need to slot.
5. Before touching code, design the H6b emoji correction
   *shape* and run it past the user. Key open questions:
    - Is emoji failure a wrap problem (unlikely) or a
      width-measurement problem (likely)? This decides
      whether the correction re-wraps or re-measures.
    - What's the probe glyph? ('🙂' / '👍' / a combining
      sequence?)
    - Where does the correction slot into `verify.ts` —
      alongside `correctCJKLayout`, or as a per-cell
      width-measurement override?
    - Does emoji measurement need its own fallback chain
      distinct from CJK's (per-spec > global > font) or can
      it share the same shape?

### Remaining v0.3 backlog

- **H6b**: emoji measurementFonts — new capability, user
  input needed on the four questions above. Will add
  `emoji?: string[]` to `MeasurementFontFamilies`
  additively (non-breaking on H6a consumers).
- **H7**: Runtime style probes for emotion + styled-components
  — the `PRELIGHT-NEXT(v0.3 H7)` markers in
  `packages/react/src/style-resolver.ts`. Flagged by the
  original v0.3 plan as the "high-risk cliff" phase because
  it needs a runtime (not AST) probe path. Expect to pause
  before H7 and get user input on scope.
- **H8**: v0.3.0-rc tagging. Fold the pre-existing v0.2.0-rc
  doc fixes (`README.md`, `ROADMAP.md`) into this release
  alongside an H8 docs pass that updates v0.3's shipped
  feature set. Same publish-decision wait as v0.2.0-rc —
  user says go before anything pushes.

### Versioning context (unchanged from prior blocks)

The user chose to invent intermediate point releases (v0.4,
v0.5, …) between v0.3 and v1.0, slicing the v1.0 "full
Presize engine" scope. Exact slicing of v0.4/v0.5 content is
**still pending user input** and should be asked for only
after v0.3 lands.

---

## 2026-04-17 — v0.3 H2–H5 landed; stop at natural boundary before H6 contract work

**Session transcript:** [v0.3 H2 H3 H4 H5 continuation](0ab7a65b-69bb-48c9-b9af-f8bf5624a030)

### State (fully committed)

Four phases landed cleanly on top of H1's `266c38d`:

- **H2** `3256742` v0.3 H2: block-flow completeness (parent-child
  + empty-block margin collapse).
- **H3** `188c141` v0.3 H3: aspect object-position + percentage
  edge insets.
- **H4** `a65781d` v0.3 H4: slot markers for multi-slot
  components (`data-prelight-slot`, `findSlots`, `findSlotPath`,
  `extractSlotText`, `resolveStyles({ slot })`,
  `verifyComponent({ slot })`).
- **H5** `010b554` v0.3 H5: `align-items: 'baseline'` in flex
  (`FlexItem.firstBaseline`, `FlexLineLayout.baseline`,
  row-only with column fallback to `'start'`).

Working tree holds only the pre-existing v0.2.0-rc doc fixes
(`README.md`, `ROADMAP.md`) plus an untracked research file
(`cursor_chenlou_pretext_tool_research.md`). Do NOT fold those
doc fixes into any v0.3 commit — they are v0.2 polish and
should land with the eventual v0.3.0-rc tagging (H8) when every
test count and doc reference stabilises.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run test` — **383 passing** (core 246, react 80,
  vitest 11, jest 5, cli 41). +114 vs v0.2.0-rc; +18 this phase.
- `bun run build` — 5/5 packages, 0 errors
- `bun scripts/measure-bundle.ts --strict` — within budget:
  - `@prelight/core` 21.90 KB min / 8.35 KB gz (22.00 / 8.50)
    — **0.10 KB min / 0.15 KB gz headroom remaining**; next
    core phase that grows ~0.5 KB min will need a deliberate
    budget bump (same pattern as H1 / H3).
  - `@prelight/react` 6.14 KB min / 2.64 KB gz (6.50 / 2.88)
    — comfortable headroom.
  - `@prelight/vitest` 2.10 KB min / 806 B gz (2.50 / 1.00)
  - `@prelight/jest` 2.24 KB min / 905 B gz (2.50 / 1.00)
  - `@prelight/cli` 7.23 KB min / 2.69 KB gz (8.00 / 3.00)

### Why I stopped here (not a code cliff — a judgment stop)

No technical cliff — the bench is green, the tree is clean for
v0.3 work, and H6 has no known infrastructure blocker. But the
user's directive is "if you notice yourself coming to a cliff
edge of work quality, immediately stop before reaching that
drop." After landing four phases with thorough tests and
evidence documentation, session context is heavy and the error
rate climbs silently from here. A fresh agent will attack H6
with full attention rather than the tail end of a long
autonomy loop.

H6's scope (see below) is also the first post-H1 phase that
touches a **cross-package public contract** (`VerifySpec`
gains a new option, `shape/cjk.ts` migrates from a module-
level global to a per-spec threading). That's a larger API
surface change than any of H2–H5 — landing it with fresh
context and a deliberate design pass, rather than on
autopilot, matches the risk profile.

### What a fresh agent should do first

1. Read this block + read `AGENTS.md` "evidence invariant"
   section (same as every prior handoff).
2. Read the latest entries in `FINDINGS.md` and `CHANGELOG.md`
   — the top four entries / blocks summarise the new surface
   landed in this session.
3. Inspect `packages/core/src/shape/cjk.ts` lines ~99–119 —
   the `PRELIGHT-NEXT(v0.3)` marker that H6 retires. Today's
   contract is the module-level pair
   `setCJKMeasurementFamilies / getCJKMeasurementFamilies`
   which the ground-truth harness uses as a side door.
4. Inspect `packages/core/src/types.ts` → `VerifySpec` — H6
   adds the new option alongside existing fields. The
   `PRELIGHT-FLAG` on `font` (potential future
   `FontDescriptor`) is NOT in H6 scope.
5. Decide on the concrete H6 shape (options below) and run it
   past the user if any require product input.

### Proposed H6 scope (plan — needs user sanity check)

`PRELIGHT-NEXT(v0.3)` in `cjk.ts` asks to:

> surface this as an explicit `measurementFonts` option on
> `VerifySpec` so it's part of the contract rather than a side
> door.

Minimal shape to satisfy that marker:

```ts
// in types.ts
export interface MeasurementFontFamilies {
  cjk?: string[];   // first family whose canvas probe differs
                    // by > 0.5px from the spec's `font` wins.
  emoji?: string[]; // same probe logic, different probe glyph.
}

export interface VerifySpec {
  ...
  measurementFonts?: MeasurementFontFamilies;
}
```

Open product questions for the user:

- **Does H6 need emoji measurement at all?** The H1 cliff note
  in the old roadmap implied emoji was part of H5/H6. Nothing
  in the codebase currently wires emoji through — cjk.ts has
  no emoji path. Adding emoji is a genuinely new capability
  (new glyph detection, new family resolution), not just a
  contract move. My recommendation: **split into H6a (CJK
  contract surface) and H6b (new emoji measurement)**. H6a is
  pure contract migration + unit tests; H6b is a new probe
  path. Ask the user before combining them.

- **Global setter: keep, deprecate, or remove?** The ground-
  truth harness currently uses `setCJKMeasurementFamilies`
  directly. Options: (a) keep the global as a back door, (b)
  deprecate with a warning, (c) remove and migrate the harness
  to use per-spec `measurementFonts`. Option (c) is the
  cleanest but needs a migration commit in `ground-truth/`.
  My recommendation: **(a) for H6, (c) as a future cleanup** —
  the deprecation noise isn't worth it if we plan to remove
  eventually, but the harness migration shouldn't block H6.

- **Font metrics (ascent/descent) threading.** Separate
  concern from `measurementFonts`. Ascent would let
  `@prelight/react` derive `firstBaseline` automatically for
  the H5 engine. My recommendation: **defer to a later phase
  (H6c or H7)** — it is a `Measurement` shape change that
  deserves its own design review.

### Versioning context (unchanged from prior blocks)

The user chose to invent intermediate point releases (v0.4,
v0.5, …) between v0.3 and v1.0, slicing the v1.0 "full
Presize engine" scope. Exact slicing of v0.4/v0.5 content is
**still pending user input** and should be asked for only
after v0.3 lands.

The v0.3 plan has 8 phases (H1–H8). H6 is next; H7 and H8
still to come. Rough content from code markers:

- **H6**: `VerifySpec.measurementFonts` contract surface
  (retires the cjk.ts marker). See scope options above.
- **H7**: Runtime style probes for emotion + styled-components
  — the `PRELIGHT-NEXT(v0.3 H7)` markers in `extract.ts`.
  This is the phase I flagged as "high-risk cliff" in the
  original v0.3 plan review because it needs a runtime
  (not AST) probe path. Expect to pause before starting H7
  and get user input.
- **H8**: v0.3.0-rc tagging. Fold the pre-existing v0.2.0-rc
  doc fixes (`README.md`, `ROADMAP.md`) into this release
  alongside an H8 docs pass that updates v0.3's shipped
  feature set. Same publish-decision wait as v0.2.0-rc —
  user says go before anything pushes.

---

## 2026-04-17 — v0.3 H1 at a cliff: flex ground-truth infrastructure gap

**Session transcript:** [v0.3 H1 flex wrap + align](0ab7a65b-69bb-48c9-b9af-f8bf5624a030)

### State (uncommitted)

H1 (flex-wrap + align-items) is implemented and unit-tested but NOT
committed. Working tree holds the original 4 doc fixes from v0.2.0-rc
**plus** H1's new work on top:

- `packages/core/src/layout/flex.ts` — rewrite adding `FlexWrap`,
  `FlexAlign`, `FlexLineLayout` types; a wrap pre-pass (§9.3); a cross-axis
  alignment pass (§8.3) covering `start | end | center | stretch`.
- `packages/core/src/index.ts` — exports the new types.
- `packages/core/test/flex.test.ts` — 40 v0.2 cases unchanged + 32 new
  H1 cases (C41–C72) covering wrap packing, align-items modes, and
  wrap × align integration.
- `scripts/bundle-budget.json` — `@prelight/core` bumped 18.00 → 20.00 KB
  min / 7.00 → 8.00 KB gz to absorb H1 growth (actual: 18.55 KB min /
  7.25 KB gz). Budget has ~1.45 KB headroom for H2-H8 core growth.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run test` — 301 passing (core 188, react 56, vitest 11, jest 5,
  cli 41). +32 vs v0.2.0-rc.
- `bun run build` — 5/5 packages, 0 errors
- `bun scripts/measure-bundle.ts --strict` — all within budget

### Scope decision taken mid-phase

`align-items: 'baseline'` was in my H1 plan but moved to H5. Rationale:
baseline alignment needs each item's first-baseline offset, which
requires font ascent values threaded through `Measurement`. Those
arrive with H5's `VerifySpec.measurementFonts`. Shipping a stub that
silently falls back to `start` would violate the evidence invariant.
The `PRELIGHT-NEXT(v0.3)` comment in `flex.ts` is retagged to
`PRELIGHT-NEXT(v0.3 H5)`.

### Cliff — why I stopped

My H1 plan promised "+80 ground-truth cases for flex-wrap +
align-items". `ground-truth/harness.ts` is exclusively a text-layout
oracle: it renders corpus strings via Playwright and compares
`getBoundingClientRect()` + `Range.getClientRects()` against what
`@prelight/core` predicts via `verify()`. There is NO infrastructure
for flex-container ground truth — no corpus schema for flex specs, no
Playwright-side per-item box-rect extraction, no sub-pixel flex-rounding
tolerance model.

Building a flex ground-truth harness is a multi-day phase on its own:
(1) define a flex-corpus schema, (2) write a Playwright renderer that
emits per-item rects, (3) wire tolerance and per-engine floors, (4)
calibrate against the 32 new unit cases plus the v0.2 flex cases.

Per my pre-set cliff rules ("scope creep into an adjacent phase" and
"public claim without evidence"), landing H1 with a `CHANGELOG` line
claiming "flex-wrap + align-items verified against Chromium/WebKit/
Firefox" would be a false public claim. I stopped before writing any
such text.

### What a fresh agent should do first

1. Read the transcript linked above — especially the post-summary
   discussion of the evidence invariant and the cliff rules.
2. Ask the user which of the three options below they want:
    - **A. Land H1 as unit-test evidence only.** Commit the current
      working tree, flag in `FINDINGS.md` and `CHANGELOG.md` that
      flex-wrap + align-items is covered by unit tests only and
      browser verification is pending. No false claims, just a known
      gap. Fastest path; preserves the v0.3 roadmap cadence.
    - **B. Insert phase H1.5 "flex ground-truth harness"** before
      committing H1. Land infrastructure first, then H1 ships with
      full evidence. Slowest path; matches the evidence invariant
      most strictly.
    - **C. Scope a minimal targeted flex-fixture harness** (≤10
      hand-picked Chromium-only fixtures) as part of H1. Compromise
      between A and B; honest evidence for a slice rather than the
      full 80-case claim.
3. Do not fold the 4 pre-existing v0.2-doc fixes into this commit.
   Those still represent "doc polish on v0.2.0-rc" and should land as
   part of the eventual v0.3.0-rc tagging (H8), when all test counts
   and doc references stabilise.

### Versioning context (unchanged since prior block)

The user chose to invent intermediate point releases (v0.4, v0.5, …)
between v0.3 and v1.0, slicing the v1.0 "full Presize engine" scope.
Exact slicing of v0.4/v0.5 content is **still pending user input** and
should be asked for only after v0.3 lands.

---

## 2026-04-16 — v0.2.0-rc complete, publish postponed

**Session transcript:** [v0.2 structural primitives + completion review](fa544540-b1b0-4e53-8a21-8815b52584b0)

### State

- Local git tag `v0.2.0-rc` on `main`. **Not pushed. Not published to npm.**
  Publishing is explicitly postponed by the user until they say go.
- All of Phase F (F1–F7 v0.1.x hardening) and Phase G (G1–G8 v0.2 structural
  primitives) shipped. The plan file `phase_f+g_development_63a4d92b.plan.md`
  is fully implemented and should not be edited.

### Gates (last verified this session)

- `bun run typecheck` — 5/5 packages, 0 errors
- `bun run build` — 5/5 packages, 0 errors
- `bun run test` — 269 passing (core 156, react 56, vitest 11, jest 5, cli 41)
- `bun scripts/measure-bundle.ts --strict` — all within budget

### Uncommitted on top of `v0.2.0-rc`

Four doc polish fixes from the completion review, not yet committed:

- `AGENTS.md:76` — test count `254 → 269`
- `CHANGELOG.md:75` — test count `254 → 269`
- `README.md` structural example — added inline `Measurement` helper so
  `m(w, h)` is defined
- `ROADMAP.md` — v0.1 `(current)` → `(shipped)`; v0.2 now `(current)` with
  accurate shipped-feature list (flex-wrap correctly noted as deferred to
  v0.3, not shipped in v0.2)

**Open decision:** fold these into the existing tag via `git tag -f
v0.2.0-rc`, land as a follow-up commit + new tag like `v0.2.0-rc.1`, or
leave dirty until the publish decision. Ask the user before acting.

### What a fresh agent should do first

1. `git status` to confirm the four doc fixes are still sitting uncommitted
   (or have been folded in).
2. Ask the user which of: (a) tag hygiene for the doc fixes, (b) push +
   publish, (c) start v0.3 planning, (d) marketing/research work — they
   want to move on.
3. Do not push the tag, do not publish to npm, and do not edit the Phase
   F+G plan file without explicit instruction.

### v0.3 backlog (when asked)

Items tagged `PRELIGHT-NEXT(v0.3)` in code and in `ROADMAP.md`:

- Flex-wrap (single-axis wrap)
- Slot markers for multi-slot components
- Emotion + styled-components `StyleResolver` plugins
- CJK `measurementFonts`
- Emoji `measurementFonts`

---
