# Prelight

> Static layout verification for the web.
> Catch layout bugs before the browser ever runs.

**Status:** v0.2 in development. Not yet published to npm. See [ROADMAP.md](./ROADMAP.md) for the path to 1.0 and [FINDINGS.md](./FINDINGS.md) for empirical claims actually measured (vs. planned).

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
import { box, zeroInsets } from '@prelight/core'

test('hero image covers its slot without clipping more than 2px', () => {
  expect({
    intrinsic: { width: 1600, height: 900 },
    slot: { width: 400, height: 225 },
    fit: 'cover',
    maxClipPx: 2,
  }).toFitAspect()
})

test('nav bar packs within the header at every scale', () => {
  const children = [
    { box: box({ content: m(80, 32), margin: zeroInsets() }) },
    { box: box({ content: m(80, 32), margin: zeroInsets() }) },
    { box: box({ content: m(80, 32), margin: zeroInsets() }) },
  ]
  expect({
    container: { innerMain: 360, gap: 12, justify: 'space-between' },
    children,
  }).toFitFlex()
})
```

## What v0.2 does (and doesn't)

**Does:**

- **Text layout predicates** (v0.1, frozen): line count, overflow, fit at scale, single-line, truncation for a given font + width + language matrix. Ships as a core library, Vitest + Jest matchers, a React component adapter, and a CLI. Ground-truth harness compares every corpus case against **Chromium, WebKit, and Firefox** via Playwright — tolerance ±1px height with exact line count. On our **928-case** corpus (7 languages + a 51-string ZWJ/skin-tone/flag/Emoji-15.1 stress set), measured **94.5% / 94.7% / 94.3% agreement** overall, **≥ 97.9% on every non-emoji cell** (Latin, RTL, CJK all above 95%). Emoji sits at 90% on every engine; the gap is font-fallback variance (bundled Inter has no emoji glyphs), documented in [FINDINGS.md §F6](./FINDINGS.md) — not a layout bug.
- **Structural primitives** (v0.2, new): `Box` + `EdgeInsets` box model, `fitsFlex` (single-axis flex L1 §9.7 — grow / shrink / basis / gap / justify), `fitsBlock` (block flow with CSS 2.1 §8.3.1 adjacent-sibling margin collapse), `fitsAspect` (image `object-fit: contain | cover | fill | scale-down | none` with letterbox / clip / scale thresholds). Each exposed as a matcher in `@prelight/vitest` + `@prelight/jest` and as a config entry in the CLI.
- **Style resolution** (v0.2, new): `@prelight/react`'s `resolveStyles()` walks a React element tree, composes inline styles and CSS variables via a `StyleResolver` plugin contract, and populates `verifyComponent()`'s `font` / `maxWidth` / `lineHeight` automatically — no duplicate metadata in tests.
- **Zero-dependency CLI reporter** with full `NO_COLOR` / `FORCE_COLOR` support. Pipes to files cleanly; colours when the terminal supports it.

**Doesn't:** grid layout, positioning (`absolute` / `fixed`), containment, transforms, or the full Presize DOM-free layout engine. Those are v1.0. See [ROADMAP.md](./ROADMAP.md).

This scope is deliberate. A smaller, honest v0.2 beats a larger, fragile one.

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
