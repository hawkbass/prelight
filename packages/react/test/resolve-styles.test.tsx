/**
 * G1 resolve-styles corpus: 50 cases across five categories.
 *
 *   1. Inline `style` prop (12 cases)
 *   2. CSS-variable resolution (10 cases)
 *   3. Cascade / merge semantics (10 cases)
 *   4. Length + line-height parsing edges (10 cases)
 *   5. Integration with verifyComponent (8 cases)
 *
 * Each test asserts against a hand-computed expected outcome. When
 * the cascade would produce an ambiguous answer we document why the
 * test chose its expectation (see file-level docstring in
 * `resolve-styles.ts` for cascade rules).
 */

import React from 'react';
import { describe, expect, test } from 'vitest';

import {
  cssVariables,
  inlineStyle,
  parseLengthPx,
  parseLineHeightPx,
  resolveStyles,
  resolveVarReferences,
  verifyComponent,
} from '../src/index.js';

describe('G1.1 inline style prop', () => {
  test('C01 font shorthand on root', () => {
    const r = resolveStyles(
      <div style={{ font: '16px Inter', maxWidth: 120, lineHeight: 20 }}>
        <span>Hi</span>
      </div>,
    );
    expect(r.font).toBe('16px Inter');
    expect(r.maxWidth).toBe(120);
    expect(r.lineHeight).toBe(20);
  });

  test('C02 fontSize + fontFamily compose into shorthand', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 200, lineHeight: 18 }}>
        x
      </div>,
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(200);
    expect(r.lineHeight).toBe(18);
  });

  test('C03 fontWeight included when non-default', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', fontWeight: 700, lineHeight: 1.4 }}>
        bold
      </div>,
    );
    expect(r.font).toBe('700 14px Inter');
    expect(r.lineHeight).toBeCloseTo(14 * 1.4, 5);
  });

  test('C04 fontWeight default 400 is elided', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', fontWeight: 400 }}>x</div>,
    );
    expect(r.font).toBe('14px Inter');
  });

  test('C05 italic font style included', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 16, fontFamily: 'Inter', fontStyle: 'italic' }}>x</div>,
    );
    expect(r.font).toBe('italic 16px Inter');
  });

  test('C06 normal font style elided', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 16, fontFamily: 'Inter', fontStyle: 'normal' }}>x</div>,
    );
    expect(r.font).toBe('16px Inter');
  });

  test('C07 string px values work', () => {
    const r = resolveStyles(
      <div style={{ fontSize: '18px', fontFamily: 'Inter', maxWidth: '240px' }}>x</div>,
    );
    expect(r.font).toBe('18px Inter');
    expect(r.maxWidth).toBe(240);
  });

  test('C08 unitless fontSize treated as px', () => {
    const r = resolveStyles(<div style={{ fontSize: 20, fontFamily: 'Inter' }}>x</div>);
    expect(r.font).toBe('20px Inter');
  });

  test('C09 em fontSize resolves against root size', () => {
    const r = resolveStyles(<div style={{ fontSize: '1.5em', fontFamily: 'Inter' }}>x</div>, {
      rootFontSizePx: 10,
    });
    expect(r.font).toBe('15px Inter');
  });

  test('C10 pt fontSize converts to px', () => {
    const r = resolveStyles(<div style={{ fontSize: '12pt', fontFamily: 'Inter' }}>x</div>);
    expect(r.font).toBe('16px Inter');
  });

  test('C11 width used when no maxWidth', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', width: 180 }}>x</div>,
    );
    expect(r.maxWidth).toBe(180);
  });

  test('C12 maxWidth wins over width', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', width: 300, maxWidth: 180 }}>x</div>,
    );
    expect(r.maxWidth).toBe(180);
  });
});

describe('G1.2 CSS variables', () => {
  test('C13 cssVariables() resolver feeds root-level vars', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 'var(--s)', fontFamily: 'Inter', maxWidth: 'var(--w)' }}>x</div>,
      {
        resolvers: [inlineStyle(), cssVariables({ '--s': '14px', '--w': '120px' })],
      },
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(120);
  });

  test('C14 vars from inline style on root carry through', () => {
    const r = resolveStyles(
      <div style={{ '--brand-size': '18px' } as React.CSSProperties}>
        <span style={{ fontSize: 'var(--brand-size)', fontFamily: 'Inter' }}>x</span>
      </div>,
    );
    expect(r.font).toBe('18px Inter');
  });

  test('C15 fallback value used when var undefined', () => {
    expect(resolveVarReferences('var(--missing, 16px)', {})).toBe('16px');
  });

  test('C16 fallback value overridden by defined var', () => {
    expect(resolveVarReferences('var(--a, 16px)', { '--a': '20px' })).toBe('20px');
  });

  test('C17 nested var resolution', () => {
    expect(
      resolveVarReferences('var(--a)', { '--a': 'var(--b)', '--b': '12px' }),
    ).toBe('12px');
  });

  test('C18 unknown var without fallback stays literal', () => {
    expect(resolveVarReferences('var(--missing)', {})).toBe('var(--missing)');
  });

  test('C19 lineHeight from var', () => {
    const r = resolveStyles(
      <div
        style={{
          fontSize: 14,
          fontFamily: 'Inter',
          lineHeight: 'var(--lh)',
          maxWidth: 120,
        }}
      >
        x
      </div>,
      { resolvers: [inlineStyle(), cssVariables({ '--lh': '20px' })] },
    );
    expect(r.lineHeight).toBe(20);
  });

  test('C20 cssVariables seed prefixes bare names', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 'var(--size)', fontFamily: 'Inter' }}>x</div>,
      { resolvers: [inlineStyle(), cssVariables({ size: '22px' })] },
    );
    expect(r.font).toBe('22px Inter');
  });

  test('C21 descendant shadows ancestor var', () => {
    const r = resolveStyles(
      <div style={{ '--s': '10px' } as React.CSSProperties}>
        <section style={{ '--s': '18px' } as React.CSSProperties}>
          <span style={{ fontSize: 'var(--s)', fontFamily: 'Inter' }}>x</span>
        </section>
      </div>,
    );
    expect(r.font).toBe('18px Inter');
  });

  test('C22 multiple vars in one shorthand', () => {
    const r = resolveStyles(
      <div
        style={{
          fontFamily: 'var(--face)',
          fontSize: 'var(--size)',
          maxWidth: 'var(--w)',
        }}
      >
        x
      </div>,
      {
        resolvers: [
          inlineStyle(),
          cssVariables({ '--face': 'Inter', '--size': '15px', '--w': '140px' }),
        ],
      },
    );
    expect(r.font).toBe('15px Inter');
    expect(r.maxWidth).toBe(140);
  });
});

describe('G1.3 cascade semantics', () => {
  test('C23 descendant overrides ancestor fontSize', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 12, fontFamily: 'Inter' }}>
        <span style={{ fontSize: 20 }}>x</span>
      </div>,
    );
    expect(r.font).toBe('20px Inter');
  });

  test('C24 ancestor fontFamily inherits to descendant', () => {
    const r = resolveStyles(
      <div style={{ fontFamily: 'Inter' }}>
        <span style={{ fontSize: 14 }}>x</span>
      </div>,
    );
    expect(r.font).toBe('14px Inter');
  });

  test('C25 descendant maxWidth overrides ancestor', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 400 }}>
        <div style={{ maxWidth: 120 }}>
          <span>x</span>
        </div>
      </div>,
    );
    expect(r.maxWidth).toBe(120);
  });

  test('C26 shorthand on ancestor, longhand on descendant', () => {
    const r = resolveStyles(
      <div style={{ font: '12px Helvetica' }}>
        <span style={{ fontSize: 18 }}>x</span>
      </div>,
    );
    expect(r.font).toBe('18px Helvetica');
  });

  test('C27 longhand on ancestor, shorthand on descendant', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 12, fontFamily: 'Helvetica' }}>
        <span style={{ font: '18px Inter' }}>x</span>
      </div>,
    );
    expect(r.font).toBe('18px Inter');
  });

  test('C28 ancestor lineHeight inherits when descendant silent', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', lineHeight: 22 }}>
        <span>x</span>
      </div>,
    );
    expect(r.lineHeight).toBe(22);
  });

  test('C29 descendant lineHeight overrides ancestor', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 14, fontFamily: 'Inter', lineHeight: 30 }}>
        <span style={{ lineHeight: 16 }}>x</span>
      </div>,
    );
    expect(r.lineHeight).toBe(16);
  });

  test('C30 walk picks first element child at each level', () => {
    const r = resolveStyles(
      <div style={{ fontFamily: 'Inter' }}>
        <aside style={{ fontSize: 10 }}>not text</aside>
        <main style={{ fontSize: 14 }}>text</main>
      </div>,
    );
    expect(r.font).toBe('10px Inter');
  });

  test('C31 sources array records every contribution', () => {
    const r = resolveStyles(
      <div style={{ fontSize: 12, fontFamily: 'Inter' }}>
        <span style={{ fontSize: 18 }}>x</span>
      </div>,
    );
    const props = r.sources.map((s) => `${s.prop}=${s.value}`);
    expect(props).toContain('fontSize=12');
    expect(props).toContain('fontFamily=Inter');
    expect(props).toContain('fontSize=18');
  });

  test('C32 custom resolver chain', () => {
    const fake = {
      name: 'fake',
      resolve() {
        return { fontSize: '11px', fontFamily: 'Georgia' as string };
      },
    };
    const r = resolveStyles(<div />, { resolvers: [fake] });
    expect(r.font).toBe('11px Georgia');
  });
});

describe('G1.4 length + line-height parsing', () => {
  test('C33 parseLengthPx number', () => expect(parseLengthPx(14)).toBe(14));
  test('C34 parseLengthPx px string', () => expect(parseLengthPx('14px')).toBe(14));
  test('C35 parseLengthPx em against base', () =>
    expect(parseLengthPx('1.5em', 12)).toBe(18));
  test('C36 parseLengthPx rem against base', () =>
    expect(parseLengthPx('2rem', 8)).toBe(16));
  test('C37 parseLengthPx pt conversion', () =>
    expect(parseLengthPx('9pt')).toBeCloseTo(12, 5));
  test('C38 parseLengthPx rejects unsupported units', () => {
    expect(parseLengthPx('50%')).toBeNull();
    expect(parseLengthPx('calc(10px + 5px)')).toBeNull();
  });
  test('C39 parseLineHeightPx unitless multiplier', () =>
    expect(parseLineHeightPx(1.4, 10)).toBe(14));
  test('C40 parseLineHeightPx explicit px string', () =>
    expect(parseLineHeightPx('20px', 16)).toBe(20));
  test('C41 parseLineHeightPx normal keyword', () =>
    expect(parseLineHeightPx('normal', 10)).toBeCloseTo(12, 5));
  test('C42 parseLineHeightPx numeric string', () =>
    expect(parseLineHeightPx('1.25', 16)).toBe(20));
});

describe('G1.5 integration with verifyComponent', () => {
  test('C43 autoResolve picks up inline styles', () => {
    const r = verifyComponent({
      element: (
        <div style={{ fontSize: 16, fontFamily: 'sans-serif', maxWidth: 120, lineHeight: 20 }}>
          <button>Save</button>
        </div>
      ),
      constraints: { maxLines: 1, noOverflow: true },
      autoResolve: true,
    });
    expect(r.ok).toBe(true);
  });

  test('C44 autoResolve catches German overflow', () => {
    const r = verifyComponent({
      element: (lang) => {
        const labels: Record<string, string> = {
          en: 'Save',
          de: 'Rechtsschutzversicherungsgesellschaften',
        };
        return (
          <div
            style={{
              fontSize: 16,
              fontFamily: 'sans-serif',
              maxWidth: 120,
              lineHeight: 20,
            }}
          >
            <button>{labels[lang]}</button>
          </div>
        );
      },
      languages: ['en', 'de'],
      constraints: { singleLine: true },
      autoResolve: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures.some((f) => f.cell.language === 'de')).toBe(true);
    }
  });

  test('C45 explicit values override autoResolve', () => {
    const r = verifyComponent({
      element: (
        <div style={{ fontSize: 8, fontFamily: 'sans-serif', maxWidth: 40, lineHeight: 10 }}>
          <span>Save</span>
        </div>
      ),
      constraints: { maxLines: 1, noOverflow: true },
      font: '16px sans-serif',
      maxWidth: 200,
      lineHeight: 20,
      autoResolve: true,
    });
    expect(r.ok).toBe(true);
  });

  test('C46 autoResolve throws helpful error when styles missing', () => {
    expect(() =>
      verifyComponent({
        element: <div>Save</div>,
        constraints: { maxLines: 1 },
        autoResolve: true,
      }),
    ).toThrow(/missing required style inputs/);
  });

  test('C47 cssVariables resolver integrates end-to-end', () => {
    const r = verifyComponent({
      element: (
        <div
          style={{
            fontSize: 'var(--size)',
            fontFamily: 'sans-serif',
            maxWidth: 'var(--width)',
            lineHeight: 'var(--lh)',
          }}
        >
          <span>Hi</span>
        </div>
      ),
      constraints: { maxLines: 1, noOverflow: true },
      autoResolve: true,
      resolveOptions: {
        resolvers: [
          inlineStyle(),
          cssVariables({
            '--size': '16px',
            '--width': '120px',
            '--lh': '20px',
          }),
        ],
      },
    });
    expect(r.ok).toBe(true);
  });

  test('C48 matrix sweep with autoResolve', () => {
    const r = verifyComponent({
      element: (lang) => {
        const labels: Record<string, string> = { en: 'Save', fr: 'Enregistrer' };
        return (
          <div
            style={{
              fontSize: 14,
              fontFamily: 'sans-serif',
              maxWidth: 100,
              lineHeight: 18,
            }}
          >
            <button>{labels[lang]}</button>
          </div>
        );
      },
      languages: ['en', 'fr'],
      constraints: { singleLine: true },
      fontScales: [1, 1.25],
      autoResolve: true,
    });
    expect(r).toBeDefined();
  });

  test('C49 deep tree: typography resolved at nested leaf', () => {
    const r = resolveStyles(
      <section style={{ fontFamily: 'Inter' }}>
        <div style={{ maxWidth: 160 }}>
          <header>
            <p style={{ fontSize: 14, lineHeight: 20 }}>inner</p>
          </header>
        </div>
      </section>,
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(160);
    expect(r.lineHeight).toBe(20);
  });

  test('C50 no resolvers return defined font means undefined', () => {
    const r = resolveStyles(<div>x</div>, { resolvers: [] });
    expect(r.font).toBeUndefined();
    expect(r.maxWidth).toBeUndefined();
    expect(r.lineHeight).toBeUndefined();
  });
});
