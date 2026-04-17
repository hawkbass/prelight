# @prelight/core

Framework-agnostic static layout verifier. The core of [Prelight](https://github.com/prelight/prelight).

Given a text, a font, a max width, and a set of constraints, `verify()` returns pass/fail across the language × font-scale matrix you care about. No browser. No DOM. Microseconds per cell.

## Install

```bash
bun add @prelight/core
# or: npm install @prelight/core
```

Node / Bun require a canvas polyfill to drive `@chenglou/pretext`'s measurement. This package depends on `@napi-rs/canvas` for that; it installs automatically.

## Usage

```ts
import { ensureCanvasEnv, verify } from '@prelight/core'

// Call once at bootstrap (test setup file, CLI main, etc).
await ensureCanvasEnv()

const result = verify({
  text: { en: 'Save', de: 'Speichern', ar: 'حفظ', ja: '保存' },
  font: '16px sans-serif',
  maxWidth: 120,
  lineHeight: 20,
  constraints: { maxLines: 1, noOverflow: true },
  fontScales: [1, 1.25, 1.5],
})

if (!result.ok) {
  for (const failure of result.failures) {
    console.error(failure.shortMessage)
    // e.g. "de @ 1.5x: overflows by 24px (144px natural > 120px cell)"
  }
}
```

## Predicates

- `noOverflow` — text fits within `maxWidth`
- `maxLines(n)` — wraps to at most `n` lines
- `minLines(n)` — wraps to at least `n` lines
- `linesExact(n)` — wraps to exactly `n` lines
- `singleLine` — same as `maxLines(1)` plus `noOverflow`
- `noTruncation` — the text would not be ellipsized
- `fitsAtScale(scale)` — asserts behavior at a specific font-scale

## What this package does not do

Structural layout (flex, grid, block margin collapse, image slots) is out of scope for v0.1. That's [v0.2 and v1.0 on the roadmap](https://github.com/prelight/prelight/blob/main/ROADMAP.md).

## License

MIT. See [LICENSE](./LICENSE).

Built on [Pretext](https://github.com/chenglou/pretext) by Cheng Lou.
