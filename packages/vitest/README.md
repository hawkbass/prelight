# @prelight/vitest

Vitest matcher for [Prelight](https://github.com/prelight/prelight). Adds `expect(spec).toLayout(constraints)` to your test suite.

## Install

```bash
bun add -d @prelight/vitest @prelight/core
```

Peer: `vitest >= 1`.

## Usage

Add a setup file (or import at the top of each test file) — this registers the matcher and primes the canvas environment:

```ts
// vitest.setup.ts
import '@prelight/vitest'
```

Reference it in your Vitest config:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { setupFiles: ['./vitest.setup.ts'] },
})
```

Then in tests:

```ts
import { test, expect } from 'vitest'
import { labels } from './labels'

test('Save button fits at every language', () => {
  expect({
    text: labels.save,
    font: '16px sans-serif',
    maxWidth: 120,
    lineHeight: 20,
  }).toLayout({
    maxLines: 1,
    noOverflow: true,
    atScales: [1, 1.25, 1.5],
    atLanguages: ['en', 'de', 'ar', 'ja'],
  })
})
```

On failure, the matcher reports the first failing cell with language + scale + the overflow delta or line count that triggered it.

## License

MIT. See [LICENSE](./LICENSE).
