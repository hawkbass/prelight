# Prelight

> Static layout verification for the web.
> Catch layout bugs before the browser ever runs.

**Status:** v0.3.0 released 2026-04-18. Not yet published to npm — the monorepo ships source-first; the `0.3.0` tag is a reproducible reference point consumers can `bun add` from a workspace clone. See [ROADMAP.md](./ROADMAP.md) for the path to 1.0 and [FINDINGS.md](./FINDINGS.md) for empirical claims actually measured (vs. planned).

---

## The problem

A user in Berlin clicks your "Save" button. In English it says `Save`. In German it says `Speichern`. In your CI, English passes. In production, German overflows the button, wraps to two lines, breaks your header grid, and you find out from a screenshot in Slack.

This is not a bug you can catch with a unit test. It's not a bug you can catch with a type system. You can only catch it by *rendering the component*, at every language, at every font scale, at every viewport width you support — and inspecting the result.

Historically the only way to do that was Playwright / Chromatic / Percy — spin up a real browser, render, screenshot, diff. It works, but it's slow (seconds per component), flaky (fonts, timing, sub-pixel), and expensive (CI minutes scale linearly with your matrix).

## The insight

You don't need a browser to know a button will overflow. You need the font metrics and an arithmetic model of line breaking. That's it.

[Pretext](https://github.com/chenglou/pretext) proved this for multiline text: 300–600x faster than DOM reflow, 15KB, zero dependencies, pure TypeScript. Prelight is the logical next step — a *verifier* built on that primitive, designed to run in your unit tests and CI.

## How it works

```
your component/string  →  extract text + style + width
                           ↓
                   Pretext (DOM-free)
                           ↓
            line count, overflow, fit, truncation
                           ↓
                  pass / fail + diagnostics
```

No headless browser. No screenshots. No flake. Milliseconds per assertion.

## Example

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

In Vitest:

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

Structural layout (v0.2):

```ts
import '@prelight/vitest'
import { box, zeroInsets, type Measurement } from '@prelight/core'

// Build a Measurement for a known-size item. In real code you'd use
// `verify()` or `resolveStyles()` to produce this from text + font.
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

Any CSS-in-JS library (v0.3):

```tsx
import { verifyComponent } from '@prelight/react'
import styled from '@emotion/styled'

const SaveButton = styled.button`
  width: 120px;
  font: 16px Inter, sans-serif;
  line-height: 20px;
  /* emotion injects this rule as a <style> tag at mount time — the
     static tree has no 'font' prop for the walker to find, so H7's
     runtime probe kicks in and reads it from getComputedStyle. */
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

The same pattern works for styled-components, `@emotion/react`'s `css` prop, Linaria, vanilla-extract, Stitches, Panda, Tamagui, CSS Modules, and plain `<link>` stylesheets — anything the browser matches via normal CSSOM. No per-library plugin required. See [FINDINGS.md §H7](./FINDINGS.md) for the cross-engine ground-truth numbers.

## What v0.3 does (and doesn't)

**Does:**

- **Text layout predicates** (v0.1, frozen): line count, overflow, fit at scale, single-line, truncation for a given font + width + language matrix. Ships as a core library, Vitest + Jest matchers, a React component adapter, and a CLI. Ground-truth harness compares every corpus case against **Chromium, WebKit, and Firefox** via Playwright — tolerance ±1px height with exact line count. On our **928-case** corpus (7 languages + a 51-string ZWJ/skin-tone/flag/Emoji-15.1 stress set, post-H6c), measured **98.81% / 99.03% / 98.60% agreement** overall (Chromium / WebKit / Firefox). **Emoji reaches 99.75% on all three engines** since v0.3 H6c shipped the bundled `NotoEmoji-subset.ttf` and per-grapheme `correctEmojiLayout`. The per-language cell breakdown and the one-case-per-engine residual (variation-selector cascade differences) are documented in [FINDINGS.md §H6c](./FINDINGS.md).
- **Structural primitives** (v0.2, frozen): `Box` + `EdgeInsets` box model, `fitsFlex` (single-axis flex L1 §9.7 — grow / shrink / basis / gap / justify, plus `align-items: baseline` as of v0.3 H5), `fitsBlock` (block flow with CSS 2.1 §8.3.1 adjacent-sibling margin collapse), `fitsAspect` (image `object-fit: contain | cover | fill | scale-down | none` with letterbox / clip / scale thresholds, plus `object-position` + percentage edge insets as of v0.3 H3). Each exposed as a matcher in `@prelight/vitest` + `@prelight/jest` and as a config entry in the CLI.
- **Static style resolution** (v0.2, extended in v0.3): `@prelight/react`'s `resolveStyles()` walks a React element tree, composes inline styles and CSS variables via a `StyleResolver` plugin contract, and populates `verifyComponent()`'s `font` / `maxWidth` / `lineHeight` automatically — no duplicate metadata in tests.
- **Runtime style probe** (v0.3, H7, new): `resolveStylesRuntime()` mounts the React subtree into happy-dom (or any pre-installed DOM env), waits for the commit, and reads `getComputedStyle()` on the slot target — walking the ancestor chain for non-inheriting `max-width` / `width` to preserve the static walker's "innermost ancestor wins" semantic. Threaded through `verifyComponent({ runtime: true })`. Library-agnostic: the probe doesn't know about emotion or styled-components, it just reads computed styles the browser matched. `happy-dom` is an optional peer dependency; consumers who never use `runtime: true` install nothing.
- **Multi-slot components** (v0.3, H4, new): `findSlots()` / `extractSlotText()` / `resolveStyles({ slot })` walk a component tagged with `data-prelight-slot="..."`. One `verifyComponent({ slot: 'title', ... })` call asserts a single slot in isolation; call it three times for title + body + meta and the diagnostic points at the slot that failed.
- **`measurementFonts` contract** (v0.3, H6, new): `VerifySpec` accepts `measurementFonts: { cjk?, emoji? }` — a typed surface that names which face the canvas-side oracle should reach for when the declared `font` can't shape a grapheme cluster. Ships with a **611 KB bundled `NotoEmoji-subset.ttf`** (monochrome outline subset of Noto-COLRv1, GSUB-closed so ZWJ / skin-tone / keycap / regional-indicator sequences resolve to ligature glyphs) so emoji measurement works out of the box, no consumer action required. CJK follows the same pattern with Noto Sans JP / SC subsets.
- **Zero-dependency CLI reporter** (v0.2, frozen) with full `NO_COLOR` / `FORCE_COLOR` support. Pipes to files cleanly; colours when the terminal supports it. CLI configs can opt into `runtime: true` per-test without also declaring `autoResolve: true` — the validator recognises both paths as style-populating.

**Doesn't:** grid layout, positioning (`absolute` / `fixed`), containment, transforms, `flex-wrap`, static `vw`/`vh`/`%`/`calc()` resolution (the runtime probe handles all four implicitly via `getComputedStyle()`), or the full Presize DOM-free layout engine. Those are v1.0. See [ROADMAP.md](./ROADMAP.md).

This scope is deliberate. A smaller, honest v0.3 beats a larger, fragile one.

## Install

```bash
# Not yet published. Install path once published:
bun add -d @prelight/core @prelight/vitest
```

## Repository layout

| Path | What it is |
| --- | --- |
| [packages/core](./packages/core) | The verifier. Framework-agnostic. |
| [packages/react](./packages/react) | React component extraction + verification. |
| [packages/vitest](./packages/vitest) | `expect().toLayout()` matcher. |
| [packages/jest](./packages/jest) | Same matcher for Jest. |
| [packages/cli](./packages/cli) | `prelight` CLI, config-driven runs. |
| [corpus/](./corpus) | Curated language + font test corpus. |
| [ground-truth/](./ground-truth) | Playwright harness; verifies Prelight against real browsers. |
| [demos/](./demos) | Live demonstrations of the value proposition. |
| [site/](./site) | Landing page + interactive playground. |

## Governance

- [ROADMAP.md](./ROADMAP.md) — v0.1 through v2.0, with explicit deferred scope.
- [DECISIONS.md](./DECISIONS.md) — ADR log. Every non-trivial choice and its reasoning.
- [FINDINGS.md](./FINDINGS.md) — empirical measurements. Speed claims live here, not in marketing copy.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — contributor setup, Windows notes, session protocol.

## License

MIT. See [LICENSE](./LICENSE).

## Credits

Built on [Pretext](https://github.com/chenglou/pretext) by Cheng Lou. Prelight extends Pretext's DOM-free measurement primitive into a build-time verification system. All DOM-free speed properties inherit from Pretext's design; Prelight's contribution is the verifier, the matrix sweep, the predicate set, and the ground-truth harness.
