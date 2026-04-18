import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // happy-dom: required by the H7 runtime-probe suite
    // (test/runtime-probe.test.tsx). CSS-in-JS libraries detect
    // their runtime environment when they first load; setting the
    // vitest environment to happy-dom ensures `window` and
    // `document` exist before emotion / styled-components are
    // statically imported, so their client-side injection path
    // activates instead of the SSR-only path. Consumers of
    // `verifyComponent({ runtime: true })` follow the same
    // vitest pattern in their own test setup.
    environment: 'happy-dom',
  },
});
