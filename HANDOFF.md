# HANDOFF

Living handoff for agents picking up Prelight mid-stream. Append a new dated
block at the top whenever you end a session with live state worth carrying
forward. Do not delete old blocks — trim only when a block is superseded in
full.

The goal: a fresh agent opening this repo should be able to read the top
block, read the transcripts it points to, and continue without re-deriving
the work.

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
