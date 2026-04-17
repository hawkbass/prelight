# demo: speed-comparison

The closing act. The number.

## What it shows

Two implementations of the *same verification task*:

1. `playwright-approach.ts` — render in a real browser, measure, assert.
2. `prelight-approach.ts` — `@prelight/core`, same predicate, same corpus.

Bench both. Report mean, p50, p95, p99, variance, sample size. No cherry-picking. If the result is 50x, we say 50x. If it's 500x, we say 500x. The number is whatever the hardware and the current Pretext version produce.

Result lives in `RESULTS.md` in this directory and is referenced by FINDINGS entry F003.

## PRELIGHT-NEXT(v0.1-phaseC)

- [ ] `playwright-approach.ts` — honest, realistic Playwright gate.
- [ ] `prelight-approach.ts` — equivalent Prelight gate.
- [ ] `bench.ts` — hyperfine-style harness, ≥50 runs per implementation.
- [ ] `RESULTS.md` — hardware, versions, numbers, caveats.
- [ ] FINDINGS F003 entry citing RESULTS.md.

## Non-goals

Not a micro-benchmark of `canvas.measureText`. Not a benchmark of Pretext in isolation. The unit of measurement is *a verification task a real team would write*. Anything smaller is misleading.
