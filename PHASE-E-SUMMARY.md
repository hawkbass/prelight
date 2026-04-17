# Phase E — evidence closeout

One-page summary of the deltas that closed Prelight's pre-launch evidence
gap on 2026-04-16. Every claim here maps to a reproducible artifact in the
repo; see `AGENTS.md` for how to reproduce each.

## Before Phase E

- `@prelight/*` packages lacked per-package READMEs and LICENSE files,
  so `npm pack --dry-run` showed warnings.
- The ground-truth harness used `sans-serif` and refused to launch
  Chromium on Windows (Defender + Playwright pipe CDP).
- "Prelight is fast" and "matches Chromium" were marketing claims, not
  measurements.
- `@prelight/jest` and `@prelight/cli` had `--passWithNoTests` and
  zero tests. Two core packages.
- `site/index.html` had placeholder stats and a single toy code sample.
- Bundle size was claimed, not gated.

## After Phase E

| Goal | Outcome | Evidence |
| ---- | ------- | -------- |
| G1 Publish surface | Every package ships `README.md` + `LICENSE`; root `CONTRIBUTING.md`, `SECURITY.md`, GitHub templates added; `npm pack --dry-run` warning-free | `packages/*/README.md`, `packages/*/LICENSE` |
| G2 Bundled Inter | Inter Variable v4.1 (~880 KB TTF, SIL OFL) bundled at `corpus/fonts/InterVariable.ttf`; new `loadBundledFont()` API; ground-truth + bench both measure against it | `corpus/fonts/`, `packages/core/src/font.ts` |
| G3 Ground-truth green | **91.83% agreement with Chromium on 600 cases.** 7 per-language floors committed as the CI release gate (en 98%, de 99%, compound 95%, emoji 93%, zh 88%, ja 84%, ar 75%). Arabic RTL known-gap published openly. | `ground-truth/run.ts --strict`, `FINDINGS.md`, `DECISIONS.md #008` |
| G4 Playwright bench | **Prelight 0.88 ms mean (0.024 ms/cell); Playwright 20.35 ms mean (0.57 ms/cell); 23.2× faster warm-path, 20× end-to-end.** 50 iterations per side. | `demos/speed-comparison/RESULTS.md`, `results-2026-04-16.json` |
| G5 Test coverage | 74 tests total. Jest integration test (5) against shipped `dist/`. CLI unit tests (22) across `config`, `reporter`, `cli`. All `--passWithNoTests` removed. | `packages/*/test/` |
| G6 Site narratives | Three real demo narratives with unedited output: failing German button, dogfood CLI run (7 components × 3 scales), speed comparison. Stats card shows measured 23× + 91.83%. | `site/index.html` |
| G7 Bundle budget | `scripts/measure-bundle.ts` + `scripts/bundle-budget.json` + `bun run measure-bundle:strict` CI gate. **Total shipped: 13.2 KB min / 6.1 KB gz.** | `scripts/`, `.github/workflows/ci.yml`, ADR 014 |
| G8 Docs review | `CHANGELOG.md` Phase E section, new `AGENTS.md`, this summary, completion-review pass. Every pre-existing `23×` / `91.83%` / `13.2 KB` claim cross-checked across README, thesis, LAUNCH, site, docs. | This file, `AGENTS.md`, `CHANGELOG.md` |

## Shipped size

```
@prelight/core     6.20 KB min   2.61 KB gz   (budget 8.00 / 3.50)
@prelight/react      924 B  min    510 B  gz   (budget 2.00 / 1.00)
@prelight/vitest     951 B  min    538 B  gz   (budget 2.00 / 1.00)
@prelight/jest     1.07 KB min    630 B  gz   (budget 2.00 / 1.00)
@prelight/cli      4.11 KB min   1.82 KB gz   (budget 6.00 / 2.50)
total shipped     13.2 KB min   6.1 KB  gz
```

## ADRs added in Phase E

- **012** — Ground-truth launches Chromium over WebSocket CDP, not pipe.
  Reason: Windows Defender + Playwright pipe transport = 60-second
  timeout. Fix: manual `spawn()` + parse `DevTools listening on ws://…`
  from stderr + `chromium.connectOverCDP(wsUrl)`.
- **013** — Run the ground-truth harness under `tsx` (Node), not Bun.
  Reason: Bun's WebSocket client times out on Playwright's
  `connectOverCDP` on Windows; Node's built-in `WebSocket` connects
  instantly.
- **014** — Bundle sizes are a declared, CI-enforced budget. Reason:
  "16 KB replaces a browser" only holds if we keep it that way. Growth
  must be argued for in a PR that edits `bundle-budget.json`.

## What remains for launch

Phase E is complete. What's blocked on humans, not code:

- Tag v0.1.0 and publish the five `@prelight/*` packages to npm.
- Walk through `LAUNCH.md`: X/Twitter thread, Show HN draft, GitHub
  release notes. Numbers in all three are already aligned to what this
  summary documents.
- Rerun `bun run measure-bundle`, `ground-truth --strict`, and
  `speed-comparison/bench.ts` on Ubuntu CI and append a second dated
  entry to `FINDINGS.md` for cross-platform confidence.

Nothing in v0.1 ships a claim Prelight can't reproduce locally today.
