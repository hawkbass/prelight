import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.tsx', '*.test.ts'],
    // The runtime probe expects a DOM it can reuse. Setting
    // `environment: 'happy-dom'` here installs `window` / `document`
    // before any test module (and therefore @emotion/styled) loads,
    // so emotion wakes up in client-side mode and injects its
    // `<style>` tags into the same DOM `getComputedStyle()` reads from.
    // Without this, emotion runs in SSR-only mode and its styles
    // never land where the probe can see them. See FINDINGS.md §H7.
    environment: 'happy-dom',
  },
});
