import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { main } from '../src/cli.js';

vi.mock('../src/runner.js', () => ({
  runVerification: vi.fn(
    async (config: { tests?: { name: string }[]; failFast?: boolean }) => {
      const tests = config.tests ?? [];
      const runs = config.failFast
        ? tests.slice(0, 1).map((t) => ({
            test: t,
            result: {
              ok: false,
              cellsChecked: 1,
              failures: [
                {
                  cell: { language: 'en', scale: 1, width: 40 },
                  constraint: 'noOverflow',
                  message: 'overflows',
                  actual: 200,
                  expected: 40,
                },
              ],
            },
          }))
        : tests.map((t) => ({ test: t, result: { ok: true, cellsChecked: 1 } }));
      const anyFail = runs.some((r) => !r.result.ok);
      return {
        ok: !anyFail,
        testsTotal: tests.length,
        testsFailed: anyFail ? 1 : 0,
        cellsChecked: runs.length,
        runs,
        layoutsTotal: 0,
        layoutsFailed: 0,
        layoutRuns: [],
        elapsedMs: 1,
      };
    },
  ),
}));

function withSilencedConsole(): {
  stdout: string[];
  stderr: string[];
  restore: () => void;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  const origLog = console.log;
  const origWarn = console.warn;
  const origErrLog = console.error;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  }) as typeof process.stderr.write;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map((a) => String(a)).join(' ') + '\n');
  };
  console.warn = () => {};
  console.error = (...args: unknown[]) => {
    stderr.push(args.map((a) => String(a)).join(' ') + '\n');
  };
  return {
    stdout,
    stderr,
    restore: () => {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErrLog;
    },
  };
}

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'prelight-cli-main-'));
});

afterEach(() => {
  try {
    rmSync(workdir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe('main', () => {
  test('exits 2 with a clear message when no config is found', async () => {
    const cwd = process.cwd();
    process.chdir(workdir);
    const io = withSilencedConsole();
    try {
      const code = await main([]);
      expect(code).toBe(2);
      expect(io.stderr.join('')).toMatch(/no config found/);
    } finally {
      io.restore();
      process.chdir(cwd);
    }
  });

  test('exits 2 on unknown argument', async () => {
    const io = withSilencedConsole();
    try {
      const code = await main(['--nope']);
      expect(code).toBe(2);
      expect(io.stderr.join('')).toMatch(/unknown argument/);
    } finally {
      io.restore();
    }
  });

  test('exits 2 on invalid reporter value', async () => {
    const io = withSilencedConsole();
    try {
      const code = await main(['--reporter', 'fancy']);
      expect(code).toBe(2);
      expect(io.stderr.join('')).toMatch(/unknown reporter/);
    } finally {
      io.restore();
    }
  });

  test('exits 2 when config is malformed', async () => {
    const file = join(workdir, 'config.mjs');
    writeFileSync(file, 'export default { hello: true }');
    const io = withSilencedConsole();
    try {
      const code = await main(['--config', file]);
      expect(code).toBe(2);
      expect(io.stderr.join('')).toMatch(/tests.*array/);
    } finally {
      io.restore();
    }
  });

  test('runs a passing config and exits 0 with json reporter output on stdout', async () => {
    const file = join(workdir, 'config.mjs');
    writeFileSync(
      file,
      `export default {
  tests: [
    {
      name: 'Save',
      element: () => null,
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1, noOverflow: true },
    },
  ],
}`,
    );
    const io = withSilencedConsole();
    try {
      const code = await main(['--config', file, '--reporter', 'json']);
      expect(code).toBe(0);
      const payload = JSON.parse(io.stdout.join(''));
      expect(payload.ok).toBe(true);
      expect(payload.testsTotal).toBe(1);
      expect(payload.tests[0].name).toBe('Save');
    } finally {
      io.restore();
    }
  });

  test('defaults to the terminal reporter (summary on stderr)', async () => {
    const file = join(workdir, 'config.mjs');
    writeFileSync(
      file,
      `export default {
  tests: [
    {
      name: 'Save',
      element: () => null,
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    },
  ],
}`,
    );
    const io = withSilencedConsole();
    try {
      const code = await main(['--config', file]);
      expect(code).toBe(0);
      expect(io.stdout.join('')).toBe('');
      expect(io.stderr.join('')).toMatch(/Prelight:.*passed/);
    } finally {
      io.restore();
    }
  });

  test('respects --fail-fast by short-circuiting after first failure', async () => {
    const file = join(workdir, 'config.mjs');
    writeFileSync(
      file,
      `export default {
  tests: [
    { name: 'Fails', element: () => null, font: '16px sans-serif', maxWidth: 40, lineHeight: 20, constraints: { singleLine: true } },
    { name: 'Never runs', element: () => null, font: '16px sans-serif', maxWidth: 120, lineHeight: 20, constraints: { maxLines: 1 } },
  ],
}`,
    );
    const io = withSilencedConsole();
    try {
      const code = await main(['--config', file, '--fail-fast', '--reporter', 'json']);
      expect(code).toBe(1);
      const payload = JSON.parse(io.stdout.join(''));
      expect(payload.ok).toBe(false);
      expect(payload.tests).toHaveLength(1);
      expect(payload.tests[0].name).toBe('Fails');
    } finally {
      io.restore();
    }
  });
});
