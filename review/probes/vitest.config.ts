import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.tsx', '*.test.ts'],
    environment: 'happy-dom',
    testTimeout: 15000,
  },
});
