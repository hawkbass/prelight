# AGENTS.md

Orientation for AI agents (Claude, Cursor, Codex) and new human contributors
joining Prelight mid-stream. This file is the map; the territory is the code.

> **Picking up mid-stream?** Read `HANDOFF.md` first — it has the current
> state, live decisions, and pointers to the transcripts that produced
> them. AGENTS.md is durable orientation; HANDOFF.md is recent context.

## What Prelight is

A static, DOM-free layout verifier. For text: you give it a string, a font,
a slot width, and a set of predicates; it tells you whether the text fits —
pass or fail — at every (language, fontScale) cell in the matrix. For
structural layout (v0.2): a box-model `Box`, a single-axis flex engine
(`fitsFlex`), a block-flow engine with margin collapse (`fitsBlock`), and
an image aspect-ratio engine (`fitsAspect`) — all pure, all DOM-free. No
browser, no screenshots, no flake.

- Marketing one-liner: "Verify your UI before the browser runs it."
- Core thesis: `site/thesis.md`.
- Public surface: `@prelight/core`, `@prelight/react`, `@prelight/vitest`,
  `@prelight/jest`, `@prelight/cli`.

## Repository layout

```
prelight/
├── packages/
│   ├── core/         # the verifier, predicates, Pretext wrapper, canvas shim
│   ├── react/        # renderToStaticMarkup → text extraction → verify
│   ├── vitest/       # expect(…).toLayout({ … })
│   ├── jest/         # same matcher, Jest ESM mode
│   └── cli/          # `prelight` binary + config loader + reporter
├── demos/
│   ├── failing-german-button/   # Vitest suite with a deliberate failure
│   ├── dogfood-library/         # 7-component config exercising the CLI
│   └── speed-comparison/        # Prelight vs. Playwright, 50 iter/side
├── corpus/           # i18n strings + bundled Inter Variable v4.1
├── ground-truth/     # Playwright-driven oracle against real Chromium
├── site/             # landing page, thesis, playground
├── scripts/          # bundle measurement, probes
└── .github/workflows # ci.yml, ground-truth.yml, prelight-dogfood.yml
```

## The evidence invariant

Anything Prelight claims in README, thesis, site, launch copy, or social
posts must be backed by a reproducible artifact in the repo.

- "23× faster than Playwright" ← `demos/speed-comparison/RESULTS.md`
- "94.5% / 94.7% / 94.3% overall, ≥ 97.9% non-emoji on Chromium / WebKit / Firefox across 928 cases" ← `ground-truth/run.ts --strict --browser all`
- "~33 KB min / ~13 KB gz total shipped across five packages" (v0.2; was ~16.4 KB post-F3, ~13.2 KB at end-of-Phase-E; grew with G1–G7 structural primitives + style-resolver + colour layer) ← `bun run measure-bundle`; budget in `scripts/bundle-budget.json`, policy in DECISIONS #014, #017, and #018
- Any predicate behavior ← `packages/core/test/*.test.ts`
- Any structural layout behavior ← `packages/core/test/{box,flex,block,aspect}.test.ts` (192 cases)
- Any style-resolver behavior ← `packages/react/test/resolve-styles.test.tsx` (50 cases)
- Any slot-marker behavior ← `packages/react/test/slots.test.tsx` (24 cases)

If you change a number, update the artifact in the same commit. If you
cannot reproduce a number, remove the claim — do not soften it.

## Governance files (read these before making design changes)

| File              | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `ROADMAP.md`      | `PRELIGHT-NEXT` index; v0.2 and v1.0 scope                 |
| `DECISIONS.md`    | ADR-lite log; append-only except for supersession notes    |
| `FINDINGS.md`     | Dated empirical results; append-only                       |
| `CONTRIBUTING.md` | dev loop, coding conventions, PR checklist                 |
| `SECURITY.md`     | disclosure policy                                          |
| `LAUNCH.md`       | staged launch plan (HN, X/Twitter, release notes)          |

## Common tasks

### Dev loop

```bash
bun install                 # one-time
bun run typecheck           # every package
bun run build               # every package
bun run test                # 395 tests (v0.2 + v0.3 H1–H6a), ~3s
bun run measure-bundle      # quick size check
```

### Ground-truth (requires Playwright + Chromium)

```bash
cd ground-truth
bun install                                   # one-time
npx playwright install --with-deps chromium   # one-time
bun run check                                 # informational
bun run check:strict                          # CI gate
```

Ground-truth runs under `tsx` on Node (ADR 013), not Bun, because of a Bun
WebSocket-client quirk on Windows.

### Speed comparison

```bash
cd demos/speed-comparison
npx tsx bench.ts --iterations=50        # human-readable
npx tsx bench.ts --iterations=50 --json # machine-readable
```

### Bundle budget

```bash
bun run measure-bundle              # report current sizes
bun run measure-bundle:strict       # fail if over budget (CI uses this)
bun run measure-bundle:update       # legitimate growth: update the budget
```

`scripts/bundle-budget.json` is part of the source of truth. A PR that grows
the shipped code should grow the budget in the same diff.

## Non-goals for v0.2 (will be rejected in review)

- Grid layout engine — Presize, v1.0.
- Positioned elements (`absolute`, `fixed`) — v1.1.
- Full CSS cascade resolution — v1.0. (v0.2 ships `resolveStyles()`
  which handles inline styles + CSS variables; it does not follow
  stylesheet rules or specificity.)
- Flex-wrap (multi-line flex) — v0.3.
- Cross-axis `align-items: stretch / baseline` — v0.3.
- Runtime pre-render guards — v2.0.
- JSX-in-config reactive re-verification — v0.3+.
- emotion / styled-components StyleResolver plugins — v0.3 (the
  plugin contract is already in `@prelight/react`; runtime probes
  land in v0.3).

Search for `PRELIGHT-NEXT(v...)` to find the exact annotations.

## Platform caveats

- **Windows + Defender** can block Playwright's default pipe-based CDP
  transport; ground-truth and the benchmark use a manual Chromium spawn
  and WebSocket CDP instead. See ADR 012. Do not revert without that
  ADR being superseded.
- **Bun WebSocket client** on Windows cannot connect to Chromium's CDP
  WebSocket endpoint reliably; ground-truth and the benchmark run via
  `tsx` on Node. See ADR 013.

## How to add a new package

1. Scaffold `packages/<name>/` with `package.json`, `tsconfig.json`,
   `src/`, `test/`, `README.md`, and a copy of the root `LICENSE`.
2. Add to the root `package.json` `workspaces` array.
3. Add a `scripts/bundle-budget.json` entry and a `TARGETS` entry in
   `scripts/measure-bundle.ts`.
4. Update this file's repository layout section.
5. Update `CHANGELOG.md` under `[Unreleased]`.

## How to make a claim

If you want to write a number in the README, on the site, in launch copy,
or in a tweet:

1. Reproduce it locally with the command referenced in this file.
2. Write it with the version/date context (e.g. "as of 2026-04-16 on
   Windows 10.0.26200, Bun 1.3.11").
3. Link from the claim to the artifact (RESULTS.md, FINDINGS.md, etc.).
4. If the number moves, update every occurrence in the same commit.

## Learned User Preferences

- Every session starts with "continue from HANDOFF.md" — read HANDOFF.md before taking any action, and treat its top block as the scope lock.
- When a plan is already agreed, skip preamble and Q&A ("no opinions, please continue") — move straight to execution and only pause for a new cliff-edge decision.
- Back technical forks with researched evidence (primary sources, citations, local probes) before recommending — decisions from intuition or "feelings" get rejected and sent back for deeper research.
- Do not autopilot-pivot away from an agreed direction when new findings appear — surface the evidence, explicitly ask for sign-off, and wait for it before changing course.
- Wait for an explicit user sign-off (e.g. "I sign off, ship as H6c") before landing a phase when any design fork was deferred to the user.
- Project positioning for README, thesis, site, and launch copy is a reputation-building, open-source tool for web devs in the AI era — framed as game-changing infrastructure, not a monetisation play.
- Bundle budget is "keep it lean, bump it when needed" — grow `scripts/bundle-budget.json` in the same diff as any legitimate size increase, and justify it.

## Learned Workspace Facts

- Work is organised by ordered phase labels (H6a, H6b, H6c, H7, …). Each phase lands as a single clean commit; scope and open questions are locked in HANDOFF.md before code is written.
- AGENTS.md is durable orientation, HANDOFF.md is the live continuation pointer, DECISIONS.md is append-only ADRs, FINDINGS.md is append-only dated results — do not retrofit new entries into old ones.
- Do not stack `bun run typecheck` and `bun run test` as parallel Shell calls on PowerShell, and do not pipe `bun run test` through `Select-Object` — it hangs. Run them sequentially with `block_until_ms` ≥ 120 s for typecheck and ≥ 180 s for tests.
- `subset-font` (npm) routes every font through `fontverter.convert(..., 'truetype')`, which strips `CBDT`/`CBLC`. For colour emoji subsetting, call `harfbuzzjs`' `hb_subset_or_fail` directly (see harfbuzzjs#9); for a lean path, ship monochrome Noto Emoji instead.
- The ground-truth harness compares numerically only (`lineCount`, `height`, `getBoundingClientRect()` width) — bundled measurement fonts are chosen for advance-width parity between `@napi-rs/canvas` and Chromium, not for visual fidelity of screenshots.
- `VerifySpec.measurementFonts` precedence (H6a contract) is: per-call spec field > module-level global setter (back door) > spec's own `font`. An empty array opts out entirely; the `emoji` slot is reserved for H6b as an additive, non-breaking extension.
