# @prelight/react

React adapter for [Prelight](https://github.com/prelight/prelight). Renders a React element to static HTML, extracts the visible text, and hands it to `@prelight/core` for layout verification.

## Install

```bash
bun add -d @prelight/react @prelight/core
```

Peer deps: `react >= 18`, `react-dom >= 18`.

## Usage

```tsx
import { ensureCanvasEnv } from '@prelight/core'
import { verifyComponent } from '@prelight/react'
import { Button } from './Button'

await ensureCanvasEnv()

const result = verifyComponent({
  render: (lang) => <Button label={labels[lang]} />,
  font: '16px sans-serif',
  maxWidth: 120,
  lineHeight: 20,
  languages: ['en', 'de', 'ar', 'ja'],
  fontScales: [1, 1.25, 1.5],
  constraints: { maxLines: 1, noOverflow: true },
})

if (!result.ok) {
  // result.failures: { language, scale, shortMessage, ... }
}
```

Pass a single element if the component doesn't vary per language, or a function `(lang) => element` to render a different tree per locale.

## What gets extracted

The adapter renders with `react-dom/server.renderToStaticMarkup`, strips tags, and decodes entities. Styling resolution (computed `font`, `width`) is **not** performed in v0.1 — you pass the font and width explicitly. See [DECISIONS.md §007](https://github.com/prelight/prelight/blob/main/DECISIONS.md) for why.

## License

MIT. See [LICENSE](./LICENSE).
