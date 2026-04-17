# RESULTS

Every future entry is dated and append-only. Numbers are reproducible from
`npx tsx bench.ts` in this directory.

---

## 2026-04-16 — Phase E first real comparison

**Hardware**: Windows 10.0.26200, x86_64 dev laptop.
**Runtime**: Node v24.12.0 via `tsx` 4.21.0. `@prelight/core` uses Bun-built
dist.
**Playwright**: 1.59.1. Chromium 147.0.7727.15 spawned directly and
connected via `connectOverCDP` over a WebSocket (see `DECISIONS.md #012`
for why).
**Workload**: 3 component shapes × 4 languages × 3 font scales = 36 cells.
**Iterations**: 50 per side, warm (first run discarded from Playwright
samples).

### Prelight (static, in-process)

| Metric        | Value    |
| ------------- | -------- |
| mean          | 0.88 ms  |
| p50           | 0.81 ms  |
| p95           | 1.64 ms  |
| p99           | 1.84 ms  |
| min           | 0.51 ms  |
| max           | 1.84 ms  |
| per-cell mean | 0.024 ms |
| warmup (cold) | 19.67 ms |

### Playwright (DOM measurement, single page reused)

| Metric        | Value     |
| ------------- | --------- |
| mean          | 20.35 ms  |
| p50           | 19.96 ms  |
| p95           | 25.02 ms  |
| p99           | 27.62 ms  |
| min           | 17.44 ms  |
| max           | 27.62 ms  |
| per-cell mean | 0.57 ms   |
| launch cost   | 243 ms (one-time, excluded from samples) |

### Speedup

- **Warm path (mean-vs-mean): 23.2× faster**
- **End-to-end (50 iterations, including Chromium launch): 20× faster**

### What this is comparing

- Both paths produce identical pass/fail verdicts on this corpus. The
  *work* is the same: measure each string in each font at each width.
- Playwright here is running in the most favorable configuration: a
  single Chromium page reused across all 36 cells, with `page.evaluate()`
  returning only the numbers we need (not a screenshot). Real visual
  regression tools (Percy, Chromatic) do screenshot + diff, which
  multiplies the per-cell cost by another order of magnitude.
- Prelight is running the full verifier — not just a measurement call.
  Every cell gets all its predicates evaluated, localized failure
  messages generated, and a proper `VerifyResult` shape returned.

### What this is NOT comparing

- This is *not* a Pretext-vs-Chromium font-metrics comparison. That's
  ground-truth (`ground-truth/run.ts`), which measured 91.83% agreement
  with Chromium on a separate 600-case corpus; see `FINDINGS.md`.
- This is *not* an end-to-end "Playwright test suite vs Prelight test
  suite" number. Those numbers would favor Prelight more heavily because
  of fixture + CI-runner costs that aren't in this bench.

### Launch failure note

On the first scaffold run (previous entry in `FINDINGS.md`),
`playwright.chromium.launch()` hung indefinitely on this same machine
because of a pipe-transport + Windows-Defender interaction. Phase E
replaced that launch path with a manual Chromium spawn + WebSocket CDP
connect. See `DECISIONS.md #012`. Numbers above include this robust
launch path in the 243 ms launch cost.

## PRELIGHT-NEXT(v0.1.0-release)

- [ ] Regenerate on CI (Ubuntu, GitHub Actions) for an apples-to-apples
      cross-platform number.
- [ ] Add a second Playwright configuration that *does* take screenshots
      so the comparison covers the "real visual regression" use case,
      not just the measurement use case.
