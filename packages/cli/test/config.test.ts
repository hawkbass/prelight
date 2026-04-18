import { describe, expect, test } from 'vitest';
import { mkdtempSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { findConfig, loadConfig } from '../src/config.js';

function tmp(): string {
  // On Windows CI runners, tmpdir() returns a path containing an 8.3 short
  // component (C:\Users\RUNNER~1\...). Vite's module loader URL-encodes the
  // tilde to %7E and then fails to locate the file. realpathSync.native uses
  // libuv's GetFinalPathNameByHandle under the hood, which expands the short
  // name to the full long-form path; the JS realpathSync does not.
  return realpathSync.native(mkdtempSync(join(tmpdir(), 'prelight-cli-test-')));
}

describe('findConfig', () => {
  test('returns null when no config file exists', () => {
    const dir = tmp();
    try {
      expect(findConfig(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('prefers .tsx over .ts', () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, 'prelight.config.ts'), 'export default {}');
      writeFileSync(join(dir, 'prelight.config.tsx'), 'export default {}');
      const found = findConfig(dir);
      expect(found).not.toBeNull();
      expect(found!.endsWith('prelight.config.tsx')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('falls back to .mjs when no other form exists', () => {
    const dir = tmp();
    try {
      writeFileSync(join(dir, 'prelight.config.mjs'), 'export default {}');
      const found = findConfig(dir);
      expect(found!.endsWith('prelight.config.mjs')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadConfig', () => {
  test('rejects configs without a default export', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(file, 'export const tests = []');
      await expect(loadConfig(file)).rejects.toThrow(/must export a default object/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects configs missing both tests and layouts', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(file, 'export default { hello: 1 }');
      await expect(loadConfig(file)).rejects.toThrow(
        /must declare at least a 'tests' or 'layouts' array/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts a layouts-only config', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  layouts: [
    {
      name: 'hero',
      kind: 'aspect',
      spec: {
        intrinsic: { width: 1600, height: 900 },
        slot: { width: 400, height: 225 },
        fit: 'contain',
      },
    },
  ],
}`,
      );
      const cfg = await loadConfig(file);
      expect(cfg.layouts).toHaveLength(1);
      expect(cfg.layouts![0]!.kind).toBe('aspect');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects layouts with invalid kind', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  layouts: [{ name: 'x', kind: 'grid', spec: {} }],
}`,
      );
      await expect(loadConfig(file)).rejects.toThrow(/kind must be one of/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects tests with a non-string name', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 123,
      element: () => null,
      font: '16px sans-serif',
      maxWidth: 100,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      await expect(loadConfig(file)).rejects.toThrow(/name must be a non-empty string/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects tests with non-positive maxWidth', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 'bad',
      element: () => null,
      font: '16px sans-serif',
      maxWidth: 0,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      await expect(loadConfig(file)).rejects.toThrow(/maxWidth must be a positive number/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts a well-formed config', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 'Save button',
      element: () => null,
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      const cfg = await loadConfig(file);
      expect(cfg.tests).toHaveLength(1);
      expect(cfg.tests[0]!.name).toBe('Save button');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts autoResolve: true without explicit font/maxWidth/lineHeight', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 'Auto Save',
      element: () => null,
      autoResolve: true,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      const cfg = await loadConfig(file);
      expect(cfg.tests![0]!.autoResolve).toBe(true);
      expect(cfg.tests![0]!.font).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts runtime: true without explicit font/maxWidth/lineHeight (v0.3 H7)', async () => {
    // Regression: the runtime probe populates font/maxWidth/lineHeight
    // by construction (it reads `getComputedStyle()` on the mounted
    // target), so forcing the consumer to also declare them explicitly
    // is both redundant and misleading — they'd become a second source
    // of truth for the typography the probe already discovered. This
    // test pins the validator's "either path auto-populates" rule.
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 'Runtime Save',
      element: () => null,
      runtime: true,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      const cfg = await loadConfig(file);
      expect(cfg.tests![0]!.runtime).toBe(true);
      expect(cfg.tests![0]!.font).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('still rejects tests that opt into neither autoResolve nor runtime and omit font', async () => {
    const dir = tmp();
    try {
      const file = join(dir, 'prelight.config.mjs');
      writeFileSync(
        file,
        `export default {
  tests: [
    {
      name: 'Missing font',
      element: () => null,
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1 },
    },
  ],
}`,
      );
      await expect(loadConfig(file)).rejects.toThrow(
        /font must be a CSS font shorthand string/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
