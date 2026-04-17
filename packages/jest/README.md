# @prelight/jest

Jest matcher for [Prelight](https://github.com/prelight/prelight). Mirror of [@prelight/vitest](../vitest) for teams on Jest.

## Install

```bash
npm install --save-dev @prelight/jest @prelight/core
```

Peer: `jest >= 29`.

## Usage

Register in your Jest setup file:

```ts
// jest.setup.ts
import '@prelight/jest'
```

Wire it into Jest's config:

```ts
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
}

export default config
```

Then in tests:

```ts
test('Save button fits at every language', () => {
  expect({
    text: { en: 'Save', de: 'Speichern', ar: 'حفظ' },
    font: '16px sans-serif',
    maxWidth: 120,
    lineHeight: 20,
  }).toLayout({ maxLines: 1, noOverflow: true })
})
```

## ESM notes

Prelight's packages ship as ESM. Jest's ESM support requires `NODE_OPTIONS=--experimental-vm-modules` or a transformer like `@swc/jest`. If that's friction for your project, consider migrating to Vitest and using [@prelight/vitest](../vitest) — the matcher surface is identical.

## License

MIT. See [LICENSE](./LICENSE).
