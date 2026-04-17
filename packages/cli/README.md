# @prelight/cli

Config-driven CLI for [Prelight](https://github.com/prelight/prelight). Run your layout verification matrix in CI without a test framework.

## Install

```bash
bun add -d @prelight/cli @prelight/core @prelight/react
```

## Usage

Create `prelight.config.tsx` at your project root:

```tsx
import type { PrelightConfig } from '@prelight/cli'
import { Button } from './src/components/Button'
import { labels } from './src/labels'

const config: PrelightConfig = {
  languages: ['en', 'de', 'ar', 'ja'],
  fontScales: [1, 1.25, 1.5],
  tests: [
    {
      name: 'save button fits',
      component: { render: (lang) => <Button label={labels.save[lang]} /> },
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1, noOverflow: true },
    },
  ],
}

export default config
```

Run:

```bash
bun x prelight                      # terminal reporter
bun x prelight --reporter json      # machine-readable output to stdout
bun x prelight --fail-fast          # stop at first failing test
bun x prelight --config path/to/x   # override config location
```

Use `.tsx` rather than `.ts` if your config embeds JSX (recommended). The loader searches `prelight.config.{tsx,ts,mts,mjs,js,jsx}` in order.

## Exit codes

- `0` — all tests passed
- `1` — one or more layout failures
- `2` — configuration error (missing config, invalid shape)
- `3` — unexpected runtime error

## License

MIT. See [LICENSE](./LICENSE).
