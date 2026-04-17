/**
 * Cross-platform Jest launcher.
 *
 * Jest's ESM support requires `NODE_OPTIONS=--experimental-vm-modules`. Using
 * `cross-env` would add a dependency; instead we spawn jest with the right
 * env from a tiny Node wrapper that works on Windows, Linux, and macOS.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const candidates = [
  resolve(pkgRoot, 'node_modules/jest/bin/jest.js'),
  resolve(pkgRoot, '../../node_modules/jest/bin/jest.js'),
];
const jestBin = candidates.find((p) => existsSync(p));
if (!jestBin) {
  console.error('@prelight/jest: could not locate jest/bin/jest.js');
  process.exit(2);
}

const args = ['--config', resolve(pkgRoot, 'jest.config.mjs'), ...process.argv.slice(2)];

const child = spawn(
  process.execPath,
  ['--experimental-vm-modules', '--no-warnings', jestBin, ...args],
  {
    stdio: 'inherit',
    cwd: pkgRoot,
    env: { ...process.env },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
