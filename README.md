# Prelight

> Static layout verification for the web.
> Catch layout bugs before the browser ever runs.

**Status:** v0.1 in development. Not yet published to npm. See [ROADMAP.md](./ROADMAP.md) for the path to 1.0 and [FINDINGS.md](./FINDINGS.md) for empirical claims actually measured (vs. planned).

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

## What v0.1 does (and doesn't)

**Does:** verify text layout predicates (line count, overflow, fit at scale, single-line, truncation) for a given font + width + language matrix. Ships as a core library, Vitest + Jest matchers, a React component adapter, and a CLI. Ground-truth harness compares every corpus case against **Chromium, WebKit, and Firefox** via Playwright — tolerance ±1px height with exact line count. On our **928-case** corpus (7 languages + a 51-string ZWJ/skin-tone/flag/Emoji-15.1 stress set), measured **94.5% / 94.7% / 94.3% agreement** overall, **≥ 97.9% on every non-emoji cell** (Latin, RTL, CJK all above 95%). Emoji sits at 90% on every engine; the gap is font-fallback variance (bundled Inter has no emoji glyphs), documented in [FINDINGS.md §F6](./FINDINGS.md) — not a layout bug. The remaining non-emoji gap is a handful of identified kinsoku and URL-wrap edges tracked in [ROADMAP.md](./ROADMAP.md).

**Doesn't:** verify structural layout (flex, grid, images, padding propagation). That's v1.0 — paired with a Presize engine. See [ROADMAP.md](./ROADMAP.md).

This scope is deliberate. A smaller, honest v0.1 beats a larger, fragile one.

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
