# HANDOFF

Living handoff for agents picking up Prelight mid-stream. Append a new dated
block at the top whenever you end a session with live state worth carrying
forward. Do not delete old blocks — trim only when a block is superseded in
full.

The goal: a fresh agent opening this repo should be able to read the top
block, read the transcripts it points to, and continue without re-deriving
the work.

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
