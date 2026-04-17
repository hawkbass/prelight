/**
 * Jest config for integration-testing our Jest matcher.
 *
 * The test imports from `dist/` (the built distributable), not from `src/`.
 * That means `bun run build` must succeed before `bun run test`, and any
 * breakage in the shipped bundle shows up here.
 *
 * We run in Node's ESM VM (`--experimental-vm-modules`) because the package
 * uses top-level `await ensureCanvasEnv()` and `"type": "module"`.
 */
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.mjs'],
  transform: {},
  extensionsToTreatAsEsm: [],
};
