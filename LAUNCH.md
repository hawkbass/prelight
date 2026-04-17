# Launch plan

Pre-launch checklist and draft launch artifacts. Not public-facing.

---

## Pre-flight checklist

- [ ] Verify `@prelight` scope on npm: `npm view @prelight/core` returns 404
- [ ] Verify `github.com/prelight` org available, or pick fallback
- [ ] `bun install --frozen-lockfile` succeeds on a clean clone
- [ ] `bun run --filter='./packages/*' build` succeeds
- [ ] `bun run --filter='./packages/*' test` all pass
- [ ] `ground-truth/run.ts --strict` passes on Chromium in CI
- [ ] `demos/failing-german-button` Vitest suite produces one expected failure
- [ ] `demos/dogfood-library` CLI run produces the expected 3 failures
- [ ] `demos/speed-comparison` RESULTS.md numbers regenerated on a clean CI
- [ ] `site/index.html` renders correctly on mobile (viewport meta present)
- [ ] `site/playground.html` works in Chromium, Firefox, Safari
- [ ] `LICENSE` present at root
- [ ] `CHANGELOG.md` has a `## [0.1.0] — YYYY-MM-DD` entry ready
- [ ] Each package has a `README.md` that links back to the root README
- [ ] `git init`, clean initial commit, push to `github.com/prelight/prelight`

## npm publish sequence

Packages publish in topological order:

1. `@prelight/core` (no internal deps)
2. `@prelight/react` (depends on core)
3. `@prelight/vitest`, `@prelight/jest`, `@prelight/cli` (depend on core)

```bash
# From repo root
bun run --filter='./packages/*' build
cd packages/core && npm publish --access public && cd ../..
cd packages/react && npm publish --access public && cd ../..
cd packages/vitest && npm publish --access public && cd ../..
cd packages/jest && npm publish --access public && cd ../..
cd packages/cli && npm publish --access public && cd ../..
```

`--access public` is required for scoped packages on a new scope.

---

## Launch thread draft (X / Twitter)

**Tweet 1 (hook)**

A user in Berlin clicks Save. In English your button fits. In German it says `Speichern` — 8 characters, one overflow, one broken header grid, one Slack screenshot.

You cannot catch this with a unit test. You cannot catch it with types.

I built a tool that catches it in 0.03ms.

**Tweet 2 (the name)**

Prelight. It's a layout verifier. Zero browser. Zero screenshots. Your Vitest suite, plus this:

```ts
expect(button).toLayout({
  maxLines: 1,
  atLanguages: ['en', 'de', 'ar', 'ja'],
  atScales: [1, 1.25, 1.5],
})
```

If German overflows at 1.5× browser zoom, the test fails. Before CI ever boots a browser.

**Tweet 3 (the trick)**

The trick isn't mine. It's @chenglou's.

Pretext proved last year that you can measure text 300-600x faster than a DOM reflow by going straight to `canvas.measureText()`. No layout tree, no style computation, just font metrics + arithmetic.

Prelight is the verifier layer on top.

**Tweet 4 (what it replaces)**

What you're replacing:
- Playwright: ~5s per component × 4 langs × 3 scales = 60s per assertion
- Percy/Chromatic: monthly bill, screenshot flake
- "Manually check the German build before we ship"

With:
- ~30 microseconds per cell
- Deterministic, ground-truth verified against **Chromium + WebKit + Firefox** (±1px height, exact line count, **94.5% / 94.7% / 94.3% overall** on our 928-case corpus — **≥ 97.9% on every non-emoji cell**, every language and script above 95%; the ~10% emoji gap is font-fallback variance documented in FINDINGS §F6)
- Runs inside Vitest next to your existing tests

**Tweet 5 (honest about scope)**

v0.1 does **text layout only**. Line count. Overflow. Fit at user zoom. Truncation. Single-line.

It does NOT do flex, grid, padding propagation. That's v1.0, paired with a Presize engine.

A small, honest v0.1 beats a fragile big one.

ROADMAP.md is public. So is DECISIONS.md. So is FINDINGS.md with every measurement.

**Tweet 6 (the philosophical bit — optional)**

There's a pattern here worth noticing.

Pretext: "you don't need the DOM to measure text."
Prelight: "you don't need a browser to verify layout."

Most web perf work accepts the browser as the substrate and optimizes around it. The wins are compounding when you don't.

**Tweet 7 (CTA)**

Install:

```
bun add -d @prelight/core @prelight/vitest
```

Landing + interactive playground: [url]
Code: github.com/prelight/prelight
Credit where it's due: github.com/chenglou/pretext

Try it against your real i18n corpus and tell me where it breaks.

---

## Show HN draft

**Title:** Show HN: Prelight — verify your UI layout in Vitest, no browser, 30 microseconds per assertion

**Body:**

Hi HN,

Prelight is a static layout verifier for the web. The problem it solves: you have an i18n component, and you want to know, before CI, whether a German or Arabic translation is going to overflow the button it sits in — at 1×, 1.25×, and 1.5× user zoom, on every width you support.

The conventional answer is Playwright or a visual regression service. Prelight does it in your Vitest suite, in microseconds, with no headless browser involved.

The trick comes from Cheng Lou's Pretext library (https://github.com/chenglou/pretext). Pretext observed that you can get 99% of the text layout information the browser has by going straight to `canvas.measureText()` — no DOM, no style computation, no reflow. Prelight sits on top of that primitive and adds:

- Predicates: `noOverflow`, `maxLines`, `singleLine`, `fitsAtScale`, `noTruncation`
- Matrix sweep: language × width × font-scale
- Vitest, Jest, React, and CLI adapters
- A ground-truth harness that renders a **928-case** multilingual corpus (7 languages + 51-string emoji stress set) in **Chromium, WebKit, and Firefox** via Playwright and diffs against Prelight's predictions. Release gate: ±1px height, exact line count, with per-engine × per-language floors — overall 93% per engine, **≥ 97.9% non-emoji**, 95% on Arabic and CJK thanks to the F2/F3 shape-correction shims. The ~10% emoji gap is font-fallback variance (FINDINGS §F6), tracked openly rather than hidden. DECISIONS.md §008 is authoritative.

v0.1 does text layout only. Structural layout (flex, grid, image slots) is v1.0, paired with a userland layout engine (Presize). This is documented up-front — ROADMAP.md, DECISIONS.md, and FINDINGS.md are all public and updated as evidence comes in.

Happy to answer questions about the measurement math, the ground-truth harness, or the architectural decisions (there are 11 ADRs in DECISIONS.md).

Repo: github.com/prelight/prelight
Landing: [url]
Playground: [url]/playground.html

---

## GitHub release notes (v0.1.0)

**Title:** v0.1.0 — Text layout verification

**Summary:**

First release. Five packages, verified against Chromium on a multilingual
corpus, integrated with Vitest and Jest. WebKit and Firefox ground-truth
sweeps land in v1.0 (see ROADMAP.md).

**What works:**

- Text layout predicates against a language × width × scale matrix
- Vitest, Jest, React, and CLI surfaces
- Ground-truth agreement ±1px height, exact line count: **94.5% Chromium / 94.7% WebKit / 94.3% Firefox on 928 cases** across 7 languages + 51-string emoji stress set; **≥ 97.9% on every non-emoji cell**, every language ≥ 95%. Enforced as the per-engine × per-language release gate (see `DECISIONS.md` §008 and `FINDINGS.md` §F6)
- <1ms per verification sweep on a 36-cell matrix (warm)

**What's next:** v0.2 adds structural primitives (flex, block,
image-slot). See [ROADMAP.md](./ROADMAP.md).

**Credits:** Built on [Pretext](https://github.com/chenglou/pretext) by
@chenglou.
