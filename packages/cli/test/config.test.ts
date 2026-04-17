import { describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { findConfig, loadConfig } from '../src/config.js';

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'prelight-cli-test-'));
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
});
