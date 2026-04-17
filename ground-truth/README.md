# ground-truth

The empirical gate for every Prelight release.

## What it does

Renders the full Prelight corpus in Chromium, WebKit, and Firefox via Playwright. Captures each cell's real line count and bounding box. Compares against what `@prelight/core` predicted.

Budget, per [DECISIONS.md #008](../DECISIONS.md):

- Line count: **exact match**, 100% of cells.
- Bounding box: **≤ 1px deviation** on every side, 100% of cells.
- Applies to all three browsers.

## When it runs

- On every PR that touches `packages/core/**`, `corpus/**`, or `pretext` version.
- On every release, blocking publish.
- Manually: `bun run ground-truth` from the repo root.

## What happens on failure

1. Open a [FINDINGS.md](../FINDINGS.md) entry with the offending cell(s).
2. Decide: is this a Prelight bug, a Pretext bug, or a corpus issue?
3. If Prelight bug: fix and re-run.
4. If Pretext bug: file upstream, assess whether to pin the prior version.
5. If corpus issue: most often a glyph coverage problem in the bundled font. Decide whether to extend corpus coverage or narrow the case.

## PRELIGHT-NEXT(v0.1-phaseA)

- [ ] Implement `harness.ts` — render one corpus cell in a clean browser context.
- [ ] Implement `diff.ts` — structured comparison with per-dimension deltas.
- [ ] Implement `corpus.test.ts` — iterate corpus, assert per cell.
- [ ] Wire to `.github/workflows/ground-truth.yml`.
