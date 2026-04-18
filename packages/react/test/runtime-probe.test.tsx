/**
 * H7 runtime-probe corpus: 30 cases across six categories.
 *
 *   1. Plain CSS + inline `style` parity with the static walker (5)
 *   2. Emotion — @emotion/styled + `css` prop + theme + nested (6)
 *   3. styled-components — static, dynamic props, theme, nested (6)
 *   4. CSS custom properties + cascade (4)
 *   5. Slot-aware runtime resolution (4)
 *   6. verifyComponent({ runtime: true }) integration (5)
 *
 * Each test asserts against hand-computed expected outcomes. The
 * probe is library-agnostic by construction (see
 * `runtime-probe.ts` docstring) — so the emotion and styled-
 * components suites exist to prove the construction actually
 * holds in practice across the two CSS-in-JS libraries that
 * dominate production React codebases.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsxImportSource @emotion/react */

import React from 'react';
import { describe, expect, test } from 'vitest';

// styled-components has an unusual export shape: the default
// export IS the `styled` factory (with tag properties hanging off
// it like `styled.button`), while `ThemeProvider`, `css`, and
// `keyframes` live on the namespace. The test therefore pulls
// the factory from `.default` but `ThemeProvider` / `css` from
// the named exports, which is the documented v6 API.
import emotionStyled from '@emotion/styled';
import { ThemeProvider as EmotionThemeProvider, css as emotionCss } from '@emotion/react';
import scDefaultStyled, {
  ThemeProvider as ScThemeProvider,
  css as scCss,
} from 'styled-components';

const scStyled: any = scDefaultStyled;

import { resolveStylesRuntime, verifyComponent } from '../src/index.js';

describe('H7.1 plain CSS + inline style (library-agnostic baseline)', () => {
  test('H01 inline fontSize + fontFamily produce the same shorthand as the static walker', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 200, lineHeight: '18px' }}>
        <span>Hi</span>
      </div>,
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(200);
    expect(r.lineHeight).toBe(18);
  });

  test('H02 bold weight survives into the shorthand', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 14, fontFamily: 'Inter', fontWeight: 700 }}>
        <span>bold</span>
      </div>,
    );
    expect(r.font).toBe('700 14px Inter');
  });

  test('H03 line-height: normal stays unresolved (parses to 1.2 × fontSize only when a consumer asks)', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 16, fontFamily: 'Inter' }}>
        <span>default</span>
      </div>,
    );
    expect(r.font).toBe('16px Inter');
    expect(r.lineHeight).toBeUndefined();
  });

  test('H04 italic font style is included', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 16, fontFamily: 'Inter', fontStyle: 'italic' }}>
        <span>x</span>
      </div>,
    );
    expect(r.font).toBe('italic 16px Inter');
  });

  test('H05 cascaded style from ancestor wins for innermost leaf', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 20, fontFamily: 'Inter', maxWidth: 300, lineHeight: '24px' }}>
        <span>
          <strong>deep</strong>
        </span>
      </div>,
    );
    expect(r.font).toBe('20px Inter');
    expect(r.maxWidth).toBe(300);
    expect(r.lineHeight).toBe(24);
  });
});

describe('H7.2 emotion (styled + css prop + theme + nested)', () => {
  test('H06 @emotion/styled static styles resolve', async () => {
    const Btn = emotionStyled('button')`
      font-size: 14px;
      font-family: Inter;
      max-width: 160px;
      line-height: 18px;
    `;
    const r = await resolveStylesRuntime(<Btn>Save</Btn>);
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(160);
    expect(r.lineHeight).toBe(18);
  });

  test('H07 @emotion/styled dynamic props resolve', async () => {
    const Btn = emotionStyled('button')((props: { $big?: boolean }) => ({
      fontSize: props.$big ? 18 : 14,
      fontFamily: 'Inter',
      maxWidth: props.$big ? 240 : 160,
      lineHeight: '22px',
    }));
    const r = await resolveStylesRuntime(<Btn $big>Save</Btn>);
    expect(r.font).toBe('18px Inter');
    expect(r.maxWidth).toBe(240);
    expect(r.lineHeight).toBe(22);
  });

  test('H08 @emotion/react css prop resolves', async () => {
    const button = emotionCss`
      font-size: 16px;
      font-family: Inter;
      max-width: 180px;
      line-height: 20px;
    `;
    const r = await resolveStylesRuntime(
      <button css={button} suppressHydrationWarning>
        Go
      </button>,
    );
    expect(r.font).toBe('16px Inter');
    expect(r.maxWidth).toBe(180);
    expect(r.lineHeight).toBe(20);
  });

  test('H09 emotion ThemeProvider cascades fontSize to descendants', async () => {
    const theme = { fontSize: '15px', fontFamily: 'Inter', maxWidth: '210px' };
    const Btn = emotionStyled('button')((props: { theme: typeof theme }) => ({
      fontSize: props.theme.fontSize,
      fontFamily: props.theme.fontFamily,
      maxWidth: props.theme.maxWidth,
      lineHeight: '19px',
    }));
    const r = await resolveStylesRuntime(
      <EmotionThemeProvider theme={theme}>
        <Btn>themed</Btn>
      </EmotionThemeProvider>,
    );
    expect(r.font).toBe('15px Inter');
    expect(r.maxWidth).toBe(210);
    expect(r.lineHeight).toBe(19);
  });

  test('H10 emotion nested styled: inner styled button wins over outer styled div', async () => {
    const Outer = emotionStyled('div')`
      font-size: 12px;
      font-family: SystemUI;
      max-width: 140px;
      line-height: 16px;
    `;
    const Inner = emotionStyled('button')`
      font-size: 16px;
      font-family: Inter;
      max-width: 200px;
      line-height: 22px;
    `;
    const r = await resolveStylesRuntime(
      <Outer>
        <Inner>x</Inner>
      </Outer>,
    );
    expect(r.font).toBe('16px Inter');
    expect(r.maxWidth).toBe(200);
    expect(r.lineHeight).toBe(22);
  });

  test('H11 emotion pseudoselector does not leak into base typography', async () => {
    const Btn = emotionStyled('button')`
      font-size: 14px;
      font-family: Inter;
      max-width: 160px;
      line-height: 18px;
      &:hover {
        font-size: 24px;
      }
    `;
    const r = await resolveStylesRuntime(<Btn>x</Btn>);
    expect(r.font).toBe('14px Inter');
  });
});

describe('H7.3 styled-components (static + dynamic + theme + nested)', () => {
  test('H12 styled-components static styles resolve', async () => {
    const Btn = scStyled('button')`
      font-size: 14px;
      font-family: Inter;
      max-width: 160px;
      line-height: 18px;
    `;
    const r = await resolveStylesRuntime(<Btn>Save</Btn>);
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(160);
    expect(r.lineHeight).toBe(18);
  });

  test('H13 styled-components transient prop controls fontSize', async () => {
    const Btn = scStyled('button')<{ $big?: boolean }>`
      font-size: ${(p: { $big?: boolean }) => (p.$big ? '18px' : '14px')};
      font-family: Inter;
      max-width: ${(p: { $big?: boolean }) => (p.$big ? '240px' : '160px')};
      line-height: 22px;
    `;
    const r = await resolveStylesRuntime(<Btn $big>Save</Btn>);
    expect(r.font).toBe('18px Inter');
    expect(r.maxWidth).toBe(240);
    expect(r.lineHeight).toBe(22);
  });

  test('H14 styled-components ThemeProvider cascades to descendants', async () => {
    const theme = { fontSize: '15px', fontFamily: 'Inter', maxWidth: '210px' };
    const Btn = scStyled('button')<{ theme: typeof theme }>`
      font-size: ${(p: { theme: typeof theme }) => p.theme.fontSize};
      font-family: ${(p: { theme: typeof theme }) => p.theme.fontFamily};
      max-width: ${(p: { theme: typeof theme }) => p.theme.maxWidth};
      line-height: 19px;
    `;
    const r = await resolveStylesRuntime(
      <ScThemeProvider theme={theme}>
        <Btn>themed</Btn>
      </ScThemeProvider>,
    );
    expect(r.font).toBe('15px Inter');
    expect(r.maxWidth).toBe(210);
    expect(r.lineHeight).toBe(19);
  });

  test('H15 styled-components nested — inner wins', async () => {
    const Outer = scStyled('div')`
      font-size: 12px;
      font-family: SystemUI;
      max-width: 140px;
      line-height: 16px;
    `;
    const Inner = scStyled('button')`
      font-size: 16px;
      font-family: Inter;
      max-width: 200px;
      line-height: 22px;
    `;
    const r = await resolveStylesRuntime(
      <Outer>
        <Inner>x</Inner>
      </Outer>,
    );
    expect(r.font).toBe('16px Inter');
    expect(r.maxWidth).toBe(200);
    expect(r.lineHeight).toBe(22);
  });

  test('H16 styled-components attrs-forwarded component retains typography', async () => {
    const Base = scStyled('button')`
      font-size: 14px;
      font-family: Inter;
      max-width: 160px;
      line-height: 18px;
    `;
    const Primary = scStyled(Base).attrs({ type: 'submit' })`
      font-weight: 700;
    `;
    const r = await resolveStylesRuntime(<Primary>go</Primary>);
    expect(r.font).toBe('700 14px Inter');
  });

  test('H17 styled-components css helper inlined into a component preserves base typography', async () => {
    // Using the `css` helper rather than `keyframes` so this test
    // doesn't depend on styled-components' animation machinery
    // (which happy-dom's CSSOM partially stubs); the shape we want
    // to prove is "inlined css fragments do not rewrite base
    // font-family/size".
    const cssChunk = scCss`
      text-transform: uppercase;
      letter-spacing: 0.02em;
    `;
    const Btn = scStyled('button')`
      font-size: 14px;
      font-family: Inter;
      max-width: 160px;
      line-height: 18px;
      ${cssChunk};
    `;
    const r = await resolveStylesRuntime(<Btn>x</Btn>);
    expect(r.font).toBe('14px Inter');
  });
});

describe('H7.4 CSS custom properties + cascade', () => {
  test('H18 CSS variables on ancestor resolve through computed style', async () => {
    const r = await resolveStylesRuntime(
      <div
        style={{
          ['--brand-size' as never]: '14px',
          ['--brand-max' as never]: '180px',
          fontSize: 'var(--brand-size)',
          fontFamily: 'Inter',
          maxWidth: 'var(--brand-max)',
          lineHeight: '18px',
        }}
      >
        <span>x</span>
      </div>,
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(180);
    expect(r.lineHeight).toBe(18);
  });

  test('H19 inner element overrides ancestor fontSize via inline style', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 12, fontFamily: 'Inter', maxWidth: 200, lineHeight: '16px' }}>
        <span style={{ fontSize: 18, lineHeight: '22px' }}>x</span>
      </div>,
    );
    expect(r.font).toBe('18px Inter');
    expect(r.lineHeight).toBe(22);
  });

  test('H20 sources list includes computed-style contributions', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 160, lineHeight: '18px' }}>
        <span>x</span>
      </div>,
    );
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.sources.every((s) => s.resolver === 'runtimeComputed')).toBe(true);
    expect(r.sources.map((s) => s.prop)).toContain('fontSize');
    expect(r.sources.map((s) => s.prop)).toContain('fontFamily');
  });

  test('H21 maxWidth: none falls back to width', async () => {
    const r = await resolveStylesRuntime(
      <div style={{ fontSize: 14, fontFamily: 'Inter', width: 140, lineHeight: '18px' }}>
        <span>x</span>
      </div>,
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(140);
  });
});

describe('H7.5 slot-aware runtime resolution', () => {
  test('H22 data-prelight-slot picks the slot target', async () => {
    const r = await resolveStylesRuntime(
      <article style={{ fontSize: 12, fontFamily: 'SystemUI', maxWidth: 140, lineHeight: '16px' }}>
        <div>
          <h2
            data-prelight-slot="title"
            style={{ fontSize: 20, fontFamily: 'Inter', maxWidth: 320, lineHeight: '24px' }}
          >
            hi
          </h2>
        </div>
      </article>,
      { slot: 'title' },
    );
    expect(r.font).toBe('20px Inter');
    expect(r.maxWidth).toBe(320);
    expect(r.lineHeight).toBe(24);
  });

  test('H23 missing slot throws with known-slots list', async () => {
    await expect(
      resolveStylesRuntime(
        <article>
          <h2 data-prelight-slot="title">x</h2>
        </article>,
        { slot: 'body' },
      ),
    ).rejects.toThrow(/slot "body" not found.*\[title\]/s);
  });

  test('H24 sibling slot does not leak into target cascade', async () => {
    const r = await resolveStylesRuntime(
      <section>
        <p
          data-prelight-slot="other"
          style={{ fontSize: 30, fontFamily: 'Other', maxWidth: 999, lineHeight: '40px' }}
        >
          other
        </p>
        <p
          data-prelight-slot="target"
          style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 160, lineHeight: '18px' }}
        >
          target
        </p>
      </section>,
      { slot: 'target' },
    );
    expect(r.font).toBe('14px Inter');
    expect(r.maxWidth).toBe(160);
  });

  test('H25 emotion-styled slot resolves through computed style', async () => {
    const Title = emotionStyled('h2')`
      font-size: 22px;
      font-family: Inter;
      max-width: 300px;
      line-height: 28px;
    `;
    const r = await resolveStylesRuntime(
      <article>
        <Title data-prelight-slot="title">t</Title>
      </article>,
      { slot: 'title' },
    );
    expect(r.font).toBe('22px Inter');
    expect(r.maxWidth).toBe(300);
    expect(r.lineHeight).toBe(28);
  });
});

describe('H7.6 verifyComponent({ runtime: true }) integration', () => {
  test('H26 passes on a component whose styles come from @emotion/styled', async () => {
    const Btn = emotionStyled('button')`
      font-size: 16px;
      font-family: sans-serif;
      max-width: 140px;
      line-height: 20px;
    `;
    const result = await verifyComponent({
      element: (lang) => <Btn>{lang === 'de' ? 'Speichern' : 'Save'}</Btn>,
      languages: ['en', 'de'],
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    expect(result.ok).toBe(true);
  });

  test('H27 catches German overflow through the runtime path', async () => {
    const Btn = emotionStyled('button')`
      font-size: 16px;
      font-family: sans-serif;
      max-width: 120px;
      line-height: 20px;
    `;
    const result = await verifyComponent({
      element: (lang) => (
        <Btn>{lang === 'de' ? 'Rechtsschutzversicherungsgesellschaften' : 'Save'}</Btn>
      ),
      languages: ['en', 'de'],
      constraints: { singleLine: true },
      runtime: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.cell.language === 'de')).toBe(true);
    }
  });

  test('H28 passes on a styled-components themed button', async () => {
    const theme = { fontSize: '16px', fontFamily: 'sans-serif', maxWidth: '140px' };
    const Btn = scStyled('button')<{ theme: typeof theme }>`
      font-size: ${(p: { theme: typeof theme }) => p.theme.fontSize};
      font-family: ${(p: { theme: typeof theme }) => p.theme.fontFamily};
      max-width: ${(p: { theme: typeof theme }) => p.theme.maxWidth};
      line-height: 20px;
    `;
    const result = await verifyComponent({
      element: (lang) => (
        <ScThemeProvider theme={theme}>
          <Btn>{lang === 'de' ? 'Speichern' : 'Save'}</Btn>
        </ScThemeProvider>
      ),
      languages: ['en', 'de'],
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    expect(result.ok).toBe(true);
  });

  test('H29 slot: runtime probe targets only the named slot', async () => {
    const Title = emotionStyled('h2')`
      font-size: 14px;
      font-family: sans-serif;
      max-width: 120px;
      line-height: 18px;
    `;
    const result = await verifyComponent({
      element: (lang) => (
        <article>
          <Title data-prelight-slot="title">{lang === 'de' ? 'Speichern' : 'Save'}</Title>
        </article>
      ),
      languages: ['en', 'de'],
      slot: 'title',
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    expect(result.ok).toBe(true);
  });

  test('H30 explicit font / maxWidth / lineHeight still win over runtime-resolved ones', async () => {
    const Btn = emotionStyled('button')`
      font-size: 8px;
      font-family: sans-serif;
      max-width: 50px;
      line-height: 10px;
    `;
    // Runtime would produce 8px / 50px — which would overflow. We
    // override explicitly, so the verifier must use the overrides.
    const result = await verifyComponent({
      element: () => <Btn>Save</Btn>,
      font: '16px sans-serif',
      maxWidth: 140,
      lineHeight: 20,
      languages: ['en'],
      constraints: { maxLines: 1, noOverflow: true },
      runtime: true,
    });
    expect(result.ok).toBe(true);
  });
});
