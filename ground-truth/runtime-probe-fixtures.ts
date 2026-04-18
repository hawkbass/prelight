/**
 * Ground-truth fixtures for the H7 runtime-probe harness.
 *
 * Each fixture is a minimal HTML fragment that exercises one
 * specific CSS resolution concern `resolveStylesRuntime` depends
 * on. The fragment is loaded into both a real browser (via
 * Playwright) and happy-dom. We then read
 * `getComputedStyle(target)` for the seven properties the probe
 * actually consumes (see `RUNTIME_PROBE_PROPERTIES`) and compare.
 *
 * The goal is NOT to test emotion/styled-components — the unit
 * suite in `packages/react/test/runtime-probe.test.tsx` already
 * does that against happy-dom. This harness answers a narrower
 * question: does happy-dom's CSSOM resolve computed styles the
 * same way Chromium / WebKit / Firefox do for the properties the
 * runtime probe reads? If yes, the runtime probe's correctness
 * in happy-dom transitively implies correctness in real
 * browsers.
 *
 * Design notes on fixture authorship:
 *   - Each fragment is self-contained (no external font, no JS).
 *   - Inline styles use `font-family: Inter` so runs match the
 *     main harness's bundled font; actual glyph metrics don't
 *     matter because we're only reading resolved string values.
 *   - Fixtures target one browser concern at a time (inline vs.
 *     class vs. var() vs. cascade); mixing obscures which engine
 *     drift caused a disagreement.
 *   - `expected` is the ground-truth answer from any spec-
 *     compliant engine — if real browsers disagree with it, the
 *     fixture is wrong, not the engines.
 */

export interface RuntimeProbeFixture {
  /** Short unique id; appears in the report. */
  id: string;
  /** One-line description of the concern under test. */
  concern: string;
  /** HTML to inject into `document.body`. */
  html: string;
  /** CSS selector for the element whose computed style we read. */
  target: string;
  /**
   * Optional expected values for CSS properties. Engines can
   * disagree on unit format (e.g. `normal` vs. numeric
   * line-height); where that matters we keep the field absent.
   */
  expected?: Partial<Record<RuntimeProbeProperty, string | RegExp>>;
}

export type RuntimeProbeProperty =
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'font-style'
  | 'line-height'
  | 'max-width'
  | 'width';

export const RUNTIME_PROBE_PROPERTIES: RuntimeProbeProperty[] = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'max-width',
  'width',
];

export const RUNTIME_PROBE_FIXTURES: RuntimeProbeFixture[] = [
  {
    id: 'R01-inline-leaf',
    concern: 'inline style on the leaf itself',
    html: `<span id="t" style="font: 14px Inter; line-height: 18px; max-width: 200px;">hi</span>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'line-height': '18px',
      'max-width': '200px',
    },
  },
  {
    id: 'R02-inherited-font',
    concern: 'font properties inherit from ancestor to leaf',
    html: `
      <div id="wrap" style="font-size: 14px; font-family: Inter; line-height: 18px;">
        <span id="t">hi</span>
      </div>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'line-height': '18px',
    },
  },
  {
    id: 'R03-max-width-no-inherit',
    concern: 'max-width set on ancestor does not inherit to leaf',
    html: `
      <div style="max-width: 200px; font-size: 14px; font-family: Inter;">
        <span id="t">hi</span>
      </div>`,
    target: '#t',
    expected: {
      'max-width': 'none',
      'font-size': '14px',
    },
  },
  {
    id: 'R04-inline-ancestor-max',
    concern: 'max-width read on the ancestor itself',
    html: `
      <div id="t" style="max-width: 180px; font-size: 14px; font-family: Inter;">
        <span>hi</span>
      </div>`,
    target: '#t',
    expected: {
      'max-width': '180px',
      'font-size': '14px',
    },
  },
  {
    id: 'R05-class-rule',
    concern: 'class selector from a <style> rule',
    html: `
      <style>.btn { font: 16px Inter; max-width: 140px; line-height: 20px; }</style>
      <button id="t" class="btn">go</button>`,
    target: '#t',
    expected: {
      'font-size': '16px',
      'max-width': '140px',
      'line-height': '20px',
    },
  },
  {
    id: 'R06-longhand-beats-shorthand',
    concern: 'font-family longhand declared after font shorthand wins',
    html: `
      <style>.x { font: 14px Inter; font-family: CustomFamily; }</style>
      <span id="t" class="x">hi</span>`,
    target: '#t',
    expected: {
      'font-family': /CustomFamily/,
      'font-size': '14px',
    },
  },
  {
    id: 'R07-inline-over-class',
    concern: 'inline style wins over class rule',
    html: `
      <style>.x { font-size: 12px; font-family: Inter; max-width: 100px; }</style>
      <span id="t" class="x" style="font-size: 18px; max-width: 160px;">hi</span>`,
    target: '#t',
    expected: {
      'font-size': '18px',
      'max-width': '160px',
    },
  },
  {
    id: 'R08-css-var',
    concern: 'CSS custom property resolves through var()',
    html: `
      <div style="--brand-size: 14px; --brand-max: 180px; font-family: Inter; font-size: var(--brand-size); max-width: var(--brand-max); line-height: 18px;">
        <span id="t">hi</span>
      </div>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'line-height': '18px',
    },
  },
  {
    id: 'R09-bold-weight',
    concern: 'font-weight: 700 surfaces as resolved numeric',
    html: `<span id="t" style="font: 700 14px Inter;">bold</span>`,
    target: '#t',
    expected: {
      'font-weight': '700',
      'font-size': '14px',
    },
  },
  {
    id: 'R10-italic-style',
    concern: 'font-style: italic surfaces in the computed triple',
    html: `<span id="t" style="font: italic 16px Inter;">i</span>`,
    target: '#t',
    expected: {
      'font-style': 'italic',
      'font-size': '16px',
    },
  },
  {
    id: 'R11-nested-cascade',
    concern: 'innermost ancestor wins for inherited typography',
    html: `
      <div style="font-size: 20px; font-family: Inter;">
        <section style="font-size: 14px;">
          <span id="t">deep</span>
        </section>
      </div>`,
    target: '#t',
    expected: {
      'font-size': '14px',
    },
  },
  {
    id: 'R12-descendant-selector',
    concern: 'descendant selector matches through intermediate elements',
    html: `
      <style>article span { font: 14px Inter; max-width: 160px; line-height: 18px; }</style>
      <article><div><span id="t">hi</span></div></article>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'line-height': '18px',
      'max-width': '160px',
    },
  },
  {
    id: 'R13-hover-pseudo-isolated',
    concern: ':hover rules do not leak into base computed style',
    html: `
      <style>
        .b { font: 14px Inter; max-width: 160px; line-height: 18px; }
        .b:hover { font-size: 24px; }
      </style>
      <button id="t" class="b">x</button>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'line-height': '18px',
    },
  },
  {
    id: 'R14-line-height-numeric',
    concern: 'unitless line-height reflects computed pixel value',
    html: `<span id="t" style="font-size: 20px; font-family: Inter; line-height: 1.5;">x</span>`,
    target: '#t',
    expected: {
      'font-size': '20px',
      // Every engine computes 30px here (20 * 1.5). Spec: CSS Values 4.
      'line-height': /^30px$|^1\.5$/,
    },
  },
  {
    id: 'R15-line-height-normal',
    concern: 'line-height: normal stays the keyword at the resolved layer',
    html: `<span id="t" style="font-size: 16px; font-family: Inter;">x</span>`,
    target: '#t',
    expected: {
      'font-size': '16px',
      'line-height': /normal|^\d/,
    },
  },
  {
    id: 'R16-max-width-none-width-fallback',
    concern: 'max-width: none + width set lets runtime probe use width',
    html: `<span id="t" style="display: inline-block; font: 14px Inter; width: 140px; line-height: 18px;">x</span>`,
    target: '#t',
    expected: {
      'font-size': '14px',
      'width': '140px',
    },
  },
  {
    id: 'R17-class-longhand-chain',
    concern: 'multiple class rules cascading in source order',
    html: `
      <style>
        .base { font: 12px Inter; max-width: 100px; line-height: 14px; }
        .override { font-size: 16px; max-width: 180px; line-height: 20px; }
      </style>
      <span id="t" class="base override">hi</span>`,
    target: '#t',
    expected: {
      'font-size': '16px',
      'max-width': '180px',
      'line-height': '20px',
    },
  },
];
