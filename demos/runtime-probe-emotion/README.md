# demo: runtime-probe-emotion

The v0.3 H7 runtime probe, exercised against emotion.

## What this demonstrates

The sibling demo [`failing-german-button`](../failing-german-button) is the one-line pitch for Prelight: a button, an overflowing German string, a Vitest failure that catches the bug before it ships. That demo styles the button with a plain inline `style={{ ... }}` object — so Prelight's *static* style walker (`resolveStyles()`) can see the typography directly on the React element.

This demo is the same scenario, but the button is styled with `@emotion/styled`. Emotion generates a hashed class name and injects the actual CSS into a `<style>` tag on mount — the React element itself carries none of the typography. For the v0.2 static walker, that component is invisible: `verifyComponent({ autoResolve: true })` would throw because there's no `font` on the tree to read.

v0.3's runtime probe closes that gap. When you pass `runtime: true`, Prelight mounts the component into happy-dom, waits for emotion's `<style>` tag to land, reads `getComputedStyle()` on the innermost text leaf, and walks the ancestor chain for non-inheriting `max-width` / `width`. The spec below declares *no* `font` / `maxWidth` / `lineHeight` — the probe discovers all three.

## Running it

```bash
cd demos/runtime-probe-emotion
bun install
bun run test
```

Expected output: two passing tests (short English + short multi-locale copy) and one failing test (the 39-character German insurance compound, which overflows the 120px button slot). The failing test is intentional — it's the proof that the runtime probe detects real failures, not just the happy path.

## Why vitest (not the CLI)

The runtime probe reuses the test runner's DOM if one is installed. Vitest's `environment: 'happy-dom'` in [`vitest.config.ts`](./vitest.config.ts) installs the DOM *before* any test module loads, so `@emotion/styled` detects a client environment at import time and wakes up in injection mode. Without that, emotion imports first, locks into SSR-only mode, and never injects its `<style>` tags where the probe can read them.

The CLI path works too (the probe's fallback dynamically imports happy-dom and installs globals), but it only works for libraries that don't lock their runtime at import time — which is library-specific and brittle. **For CSS-in-JS demos, drive the probe from a runner that sets `environment: 'happy-dom'` first.** This is the documented recommendation; see the `vitest.config.ts` comment for detail.

## What would break if the probe wasn't there

Delete `runtime: true` from [`SaveButton.test.tsx`](./SaveButton.test.tsx) and rerun. You'll get a `font not known, and autoResolve was not requested` error — the static walker found nothing. Add `autoResolve: true` and the error becomes `autoResolve did not find inline styles for these; sources: none`. That's H7's gap, stated three different ways by the same error path.

## Files

- [`SaveButton.tsx`](./SaveButton.tsx) — emotion-styled button with typography in a `styled` template literal.
- [`SaveButton.test.tsx`](./SaveButton.test.tsx) — three `verifyComponent({ runtime: true })` assertions.
- [`labels.ts`](./labels.ts) — shared copy matrix with `failing-german-button`.
- [`vitest.config.ts`](./vitest.config.ts) — wires `environment: 'happy-dom'`.
