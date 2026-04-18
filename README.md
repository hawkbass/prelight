<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/logo-dark.svg">
    <img src="./brand/logo.svg" alt="prelight" width="360">
  </picture>
</p>

<p align="center">
  <strong>A layout linter for translated UI.</strong><br>
  Verified against Chromium, WebKit, and Firefox.
</p>

<p align="center">
  <a href="./CHANGELOG.md"><img alt="version" src="https://img.shields.io/badge/version-0.3.0-0a0a0a?style=flat-square"></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-440%20passing-0a0a0a?style=flat-square">
  <img alt="cross-engine agreement" src="https://img.shields.io/badge/cross--engine%20agreement-98.81%25-0a0a0a?style=flat-square">
  <img alt="core bundle" src="https://img.shields.io/badge/%40prelight%2Fcore-8.99%20KB%20gz-0a0a0a?style=flat-square">
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-strict-0a0a0a?style=flat-square">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-0a0a0a?style=flat-square"></a>
</p>

<p align="center">
  <a href="#how-it-works">How it works</a> ·
  <a href="#what-v03-does-and-doesnt">What it does</a> ·
  <a href="#how-we-know-it-works">How we know it works</a> ·
  <a href="./REVIEW-v0.3.0.md">Self-review</a> ·
  <a href="./ROADMAP.md">Roadmap</a>
</p>

---

> **Status:** v0.3.0 tagged 2026-04-18. **Not yet on npm.** The monorepo ships
> source-first; consumers can `bun add` from a workspace clone against the
> `0.3.0` tag. npm publish is gated on v0.4 (see [ROADMAP.md](./ROADMAP.md)).

## The bug this catches

```
[PASS] Save button fits at every language  (en)
[FAIL] Save button fits at every language  (de)
        · [noOverflow] de @ scale=1, width=120px — single-line text
          would be 213.0px wide, 93.0px over. Wraps to 2 lines.
        · [maxLines]   de @ scale=1, width=120px — wraps to 2 lines
          but may not exceed 1.
```

The translator changed `Save` to `Speichern`, your CI ran in English, and
the overflow shipped. Prelight verifies every string at every font scale at
every slot width — in milliseconds, without launching a browser.

```ts
import '@prelight/vitest'

test('Save button fits at every language', () => {
  expect({ text: t('save'), font: '16px Inter', maxWidth: 120 }).toLayout({
    maxLines: 1,
    atScales: [1, 1.25, 1.5],
    atLanguages: ['en', 'de', 'ar', 'ja'],
  })
})
```

## Positioning

Visual-regression tools (Chromatic, Percy, Happo, Playwright-visual,
storybook-test-runner) tell you *something changed*. Prelight tells you
*something won't fit*. Different question, different tool.

|                                                    | prelight | Chromatic · Percy · Happo | Playwright-visual | storybook-test-runner |
|----------------------------------------------------|:--------:|:-------------------------:|:-----------------:|:---------------------:|
| Catches translation overflow before review         |   ✓     |            —              |         —         |           —           |
| Runs without a browser                             |   ✓     |            —              |         —         |           —           |
| Ground-truth-verified across Chromium · WebKit · FF | ✓     |            —              |         —         |           —           |
| Pure boolean layout predicates                     |   ✓     |            —              |         —         |           —           |
| Catches unintended pixel regressions               |   —     |            ✓             |        ✓         |          ✓           |
| Works on rendered SVG / canvas / images            |   —     |            ✓             |        ✓         |          ✓           |
| Per-pixel diffing of arbitrary UI                  |   —     |            ✓             |        ✓         |          ✓           |

Prelight is a complement to the visual-regression stack, not a replacement.
Use prelight for layout *contracts* (this button takes ≤ 1 line at every
locale). Keep the snapshot tool for everything else.

Long-form writeup: [REVIEW-v0.3.0.md §R1](./REVIEW-v0.3.0.md).

## Install

```bash
# From a workspace clone against the v0.3.0 tag:
bun add -D @prelight/core @prelight/vitest @prelight/react
```

npm publish is v0.4 scope.

## How it works

```
your component / string  →  extract text + style + width
                                 ↓
                         Pretext (DOM-free)
                                 ↓
               line count · overflow · fit · truncation
                                 ↓
                        pass / fail + diagnostics
```

No headless browser. No screenshots. No flake. Single-digit milliseconds
per assertion. Every verdict is a pure boolean over one measured cell — see
[Predicates](#predicates).

The measurement primitive is [Pretext](https://github.com/chenglou/pretext) —
a DOM-free text layout library that calls the platform's font engine
directly (`OffscreenCanvas.measureText`). Prelight is the verifier built on
top: the matrix sweep, the predicate set, the React adapter, and the
ground-truth harness that pins our numbers against real browsers.

## Examples

### Text in isolation

```ts
import { verify } from '@prelight/core'

const result = verify({
  text: { en: 'Save', de: 'Speichern', ar: 'حفظ', ja: '保存' },
  font: '16px Inter',
  maxWidth: 120,
  lineHeight: 20,
  constraints: { maxLines: 1, noOverflow: true },
  fontScales: [1, 1.25, 1.5],
})

if (!result.ok) {
  // result.failures contains:
  //   { language: 'de', scale: 1.25, actualLines: 2, overflowBy: 7px, ... }
}
```

### Structural layout (v0.2)

```ts
import '@prelight/vitest'
import { box, zeroInsets, type Measurement } from '@prelight/core'

const m = (w: number, h: number): Measurement => ({
  cell: { language: 'en', scale: 1, width: w },
  lines: 1,
  measuredWidth: w,
  measuredHeight: h,
  naturalWidth: w,
  overflows: false,
})

test('hero image covers its slot without clipping more than 2px', () => {
  expect({
    intrinsic: { width: 1600, height: 900 },
    slot: { width: 400, height: 225 },
    fit: 'cover',
    maxClipPx: 2,
  }).toFitAspect()
})

test('nav bar packs within the header at every scale', () => {
  const pill = { box: box({ content: m(80, 32), margin: zeroInsets() }) }
  expect({
    container: { innerMain: 360, gap: 12, justify: 'space-between' },
    children: [pill, pill, pill],
  }).toFitFlex()
})
```

### CSS-in-JS components (v0.3)

```tsx
import { verifyComponent } from '@prelight/react'
import styled from '@emotion/styled'

const SaveButton = styled.button`
  width: 120px;
  font: 16px Inter, sans-serif;
  line-height: 20px;
`

test('Save fits at every locale, even through emotion', async () => {
  const result = await verifyComponent({
    element: (lang) => <SaveButton>{t('save', lang)}</SaveButton>,
    runtime: true,              // mount into happy-dom, read computed style
    constraints: { maxLines: 1, noOverflow: true },
    languages: ['en', 'de', 'ar', 'ja'],
    fontScales: [1, 1.25, 1.5],
  })
  expect(result.ok).toBe(true)
})
```

The runtime probe reads the styles the browser's CSSOM matched — so it
works on anything that lowers to standard CSS. **Verified end-to-end
against Emotion** (see `demos/runtime-probe-emotion/`). Linaria, vanilla-
extract, Stitches, Panda, Tamagui, and CSS Modules all produce the same
kind of matched CSS; they're *expected* to work via the same mechanism,
but not independently verified in CI at v0.3. We'll tighten that claim as
we ship demos per library.

## What v0.3 does (and doesn't)

**Does:**

- **Text layout predicates** (v0.1, frozen): line count, overflow, fit at
  scale, single-line, truncation for a given font + width + language
  matrix. Ships as a core library, Vitest + Jest matchers, a React adapter,
  and a CLI. The ground-truth harness compares every corpus case against
  **Chromium, WebKit, and Firefox** via Playwright at ±1 px tolerance with
  exact line count. On the **928-case corpus** (7 languages + a 51-string
  ZWJ / skin-tone / flag / Emoji-15.1 stress set, post-H6c), measured
  **98.81 % / 99.03 % / 98.60 % agreement** (Chromium / WebKit / Firefox).
  **Emoji reaches 99.75 %** on all three since H6c shipped the bundled
  `NotoEmoji-subset.ttf` and per-grapheme `correctEmojiLayout`. Per-language
  and residual-case breakdown in [FINDINGS.md §H6c](./FINDINGS.md).
- **Structural primitives** (v0.2, frozen): `Box` + `EdgeInsets` box model,
  `fitsFlex` (single-axis flex L1 §9.7 — grow / shrink / basis / gap /
  justify, plus `align-items: baseline` as of v0.3 H5), `fitsBlock` (block
  flow with CSS 2.1 §8.3.1 adjacent-sibling margin collapse), `fitsAspect`
  (image `object-fit: contain | cover | fill | scale-down | none` with
  letterbox / clip / scale thresholds, plus `object-position` + percentage
  edge insets as of v0.3 H3).
- **Static style resolution** (v0.2, extended in v0.3): `resolveStyles()`
  walks a React element tree, composes inline styles and CSS variables via
  a `StyleResolver` plugin contract, and populates `verifyComponent()`'s
  `font` / `maxWidth` / `lineHeight` automatically.
- **Runtime style probe** (v0.3 H7, new): `resolveStylesRuntime()` mounts
  the subtree into happy-dom, waits for the commit, and reads
  `getComputedStyle()` on the slot target — walking the ancestor chain for
  non-inheriting `max-width` / `width` to preserve the static walker's
  "innermost ancestor wins" semantic. Threaded through
  `verifyComponent({ runtime: true })`. `happy-dom` is an optional peer
  dependency. Static-only consumers pay zero install cost.
- **Multi-slot components** (v0.3 H4, new): `findSlots()` /
  `extractSlotText()` / `resolveStyles({ slot })` walk a component tagged
  with `data-prelight-slot="…"`. One `verifyComponent({ slot: 'title', … })`
  call asserts a single slot in isolation; a failure points at the slot.
- **`measurementFonts` contract** (v0.3 H6, new): `VerifySpec` accepts
  `measurementFonts: { cjk?, emoji? }` — a typed surface that names which
  face the canvas-side oracle should reach for when the declared `font`
  can't shape a grapheme cluster. Ships with a **611 KB bundled
  `NotoEmoji-subset.ttf`** (monochrome outline subset of Noto-COLRv1,
  GSUB-closed so ZWJ / skin-tone / keycap / regional-indicator sequences
  resolve to ligature glyphs) so emoji measurement works out of the box.
- **Zero-dependency CLI reporter** (v0.2, frozen) with full `NO_COLOR` /
  `FORCE_COLOR` support.

**Doesn't:** grid layout, positioning (`absolute` / `fixed`), containment,
transforms, `flex-wrap`, static `vw` / `vh` / `%` / `calc()` resolution
(the runtime probe handles all four via `getComputedStyle()`), or the full
DOM-free layout engine. Those are v1.0 scope. See
[ROADMAP.md](./ROADMAP.md).

A smaller, honest v0.3 beats a larger, fragile one.

## How we know it works

The "no public claim without evidence" invariant applies to Prelight
itself. Every numeric claim above reduces to a reproducible command:

| Claim | Reproduce with |
| --- | --- |
| 440 tests passing | `bun run test` |
| 98.81 % / 99.03 % / 98.60 % cross-engine agreement | `bun run ground-truth:strict -- --browser all` |
| 99.75 % emoji agreement on all three engines | `bun run ground-truth:strict -- --browser all --lang emoji` |
| 8.99 KB gz / 23.86 KB min `@prelight/core` | `bun run measure-bundle:strict` |
| `NotoEmoji-subset.ttf` reproducibility | `bun run scripts/subset-emoji-font.ts` |

The full empirical ledger lives in [FINDINGS.md](./FINDINGS.md). Every
phase (H1–H8) records what was measured, by which commit, on which engine,
against which corpus.

We also publish our own adversarial review: **[REVIEW-v0.3.0.md](./REVIEW-v0.3.0.md)**
documents one critical bug, five important bugs, and three discussion
items found by re-auditing the release against its own evidence invariant.
Reading it before using the library is probably a good idea.

## Predicates

Every predicate is a pure boolean over one measured cell.

| Matcher | Asserts |
| --- | --- |
| `noOverflow` | Natural width fits the slot. |
| `maxLines` | Wraps to at most N lines. |
| `minLines` | Fills at least N lines. |
| `lines` | Takes exactly N lines. |
| `singleLine` | Stays on one line **and** fits. |
| `noTruncation` | Never ellipsized. |
| `fitsAspect` | Image `object-fit` within clip / scale thresholds. |
| `fitsFlex` | Single-axis flex packing within its container. |
| `fitsBlock` | Block flow with margin collapse. |

## Repository layout

| Path | What it is |
| --- | --- |
| [packages/core](./packages/core) | The verifier. Framework-agnostic. |
| [packages/react](./packages/react) | React element-tree extraction + verification. |
| [packages/vitest](./packages/vitest) | `expect().toLayout()` matcher. |
| [packages/jest](./packages/jest) | Same matcher for Jest. |
| [packages/cli](./packages/cli) | `prelight` CLI, config-driven runs. |
| [corpus/](./corpus) | Curated language + font test corpus. |
| [ground-truth/](./ground-truth) | Playwright harness; pins Prelight against real browsers. |
| [demos/](./demos) | Live demonstrations. `failing-german-button`, `runtime-probe-emotion`, `speed-comparison`, `dogfood-library`. |
| [site/](./site) | Landing page. |
| [brand/](./brand) | Logo and social-preview assets. |

## Governance

- [ROADMAP.md](./ROADMAP.md) — v0.1 through v2.0, with explicit deferred scope.
- [DECISIONS.md](./DECISIONS.md) — ADR log. Every non-trivial choice and its reasoning.
- [FINDINGS.md](./FINDINGS.md) — empirical measurements. Speed claims live here, not in marketing copy.
- [CHANGELOG.md](./CHANGELOG.md) — what shipped, in which phase, at what bundle cost.
- [REVIEW-v0.3.0.md](./REVIEW-v0.3.0.md) — adversarial self-review. Read before shipping to CI.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — contributor setup, Windows notes, session protocol.

## License

MIT. See [LICENSE](./LICENSE).

## Credits

Built on [Pretext](https://github.com/chenglou/pretext) by Cheng Lou.
Prelight extends Pretext's DOM-free measurement primitive into a
build-time verification system. All DOM-free speed properties inherit from
Pretext's design; Prelight's contribution is the verifier, the matrix
sweep, the predicate set, the React adapter, and the ground-truth harness.
