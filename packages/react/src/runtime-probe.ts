/**
 * Runtime style probe for @prelight/react v0.3 (H7).
 *
 * The problem the static walker cannot solve: CSS-in-JS libraries
 * (emotion, styled-components, vanilla-extract, Stitches, CSS
 * Modules, Tailwind-with-classname, any approach that ships styles
 * through generated classNames + injected `<style>` tags) attach
 * typography properties to an element via *resolved CSSOM* — not
 * via an inline `style` prop. `resolveStyles()` walks the React
 * tree statically; it never sees those rules because it never
 * mounts a DOM.
 *
 * This file opens a second path. Given a React element, mount it
 * into a lightweight DOM (`happy-dom`), let React render, let the
 * CSS-in-JS library inject its `<style>` tags the way it always
 * would at runtime, then read `getComputedStyle()` on the target
 * node. That's the exact computation the browser does; the only
 * thing we substitute is the DOM implementation.
 *
 * PRELIGHT-INVARIANT: happy-dom is an **optional peer dependency**.
 * Consumers who only need the static walker never pay the install
 * cost. The runtime probe fails closed with a helpful error if
 * `happy-dom` isn't installed, so the consumer sees a `bun add -d
 * happy-dom` suggestion instead of a cryptic module-not-found.
 *
 * PRELIGHT-INVARIANT: the runtime probe is **library-agnostic by
 * construction**. There are no emotion / styled-components / CSS
 * Modules code paths here. The CSS-in-JS library registers its
 * own client-side style cache against the happy-dom `document`,
 * `getComputedStyle()` walks the CSSOM that resulted, and we read
 * the answer out. Any styling approach that follows the browser's
 * CSS model is covered for free. See FINDINGS §H7 for the
 * reframe vs. the v0.2 "one plugin per library" plan.
 *
 * Trade-offs documented at the call sites:
 *   - This is slower than `resolveStyles()` (mount + commit + read
 *     vs. a synchronous tree walk). Expect single-digit ms per
 *     probe, but orders of magnitude more than the static path.
 *     Use `resolveStyles()` when inline styles suffice.
 *   - happy-dom's CSS engine covers the properties Prelight cares
 *     about (font, font-size, font-family, font-weight, font-style,
 *     line-height, width, max-width) but not the full spec. The
 *     ground-truth parity test in `ground-truth/` proves the
 *     properties we read match Chromium / WebKit / Firefox on the
 *     H7 corpus.
 *   - The probe renders *once* per `verifyComponent` call, not
 *     once per language. Typography is invariant across language
 *     reshapes, so a single render is sufficient. Matches the
 *     existing static-walker guarantee.
 */

import type { ReactElement } from 'react';

import {
  findSlotPath,
  findSlots,
  SLOT_ATTR,
} from './slots.js';
import {
  parseLengthPx,
  parseLineHeightPx,
  type ResolvedStyleFragment,
} from './style-resolver.js';
import type { ResolvedStyles, StyleSource } from './resolve-styles.js';

/**
 * Public options for the runtime probe. Mirrors
 * `ResolveStylesOptions` where it makes sense; the resolvers chain
 * is deliberately absent because the runtime probe reads the
 * computed style directly — there are no plugin resolvers to run.
 */
export interface ResolveStylesRuntimeOptions {
  /**
   * Resolve styles for a named slot rather than the first
   * text-bearing descendant. The slot is an element carrying
   * `data-prelight-slot={slot}`. If the slot isn't present in
   * the rendered tree we throw with the known-slots list — same
   * fail-loud behaviour as the static walker.
   */
  slot?: string;

  /**
   * Caller-provided Window class. Almost always unset — the probe
   * dynamically imports `happy-dom` itself. Injectable because the
   * ground-truth parity test wants to force a specific happy-dom
   * version, and because a consumer who runs the probe inside a
   * vitest / jest environment that already has jsdom / happy-dom
   * loaded can hand us the global Window to avoid a double-mount.
   */
  window?: unknown;

  /**
   * Base font size used when resolving em/rem lengths before a
   * `fontSize` has been established. Defaults to 16 — matches the
   * static walker and matches the default `font-size` on
   * `<html>` in every production browser.
   */
  rootFontSizePx?: number;

  /**
   * Width of the mounted viewport in px. Affects `getComputedStyle`
   * resolution of `%`, `vw`, `vh`, and container queries. Defaults
   * to 1024 — a sensible desktop width for static verification.
   * Consumers targeting a specific breakpoint (`verifyComponent`
   * at a mobile width) should pass the actual target width so the
   * cascade resolves the same way at verify-time as it will at
   * render-time.
   */
  viewportWidthPx?: number;

  /**
   * Height of the mounted viewport in px. Matches
   * `viewportWidthPx`. Defaults to 768. Mostly matters when the
   * consumer's component uses `vh` in typography — rare but
   * real.
   */
  viewportHeightPx?: number;
}

/**
 * Minimal structural types for the subset of happy-dom we touch.
 * We deliberately do **not** import from `happy-dom` statically —
 * the import is dynamic so the package loads even when happy-dom
 * isn't installed. Typing via a local structural contract keeps
 * the tsc `--noEmit` gate honest without forcing the peer dep.
 */
interface HappyDomDocument {
  documentElement: HappyDomElement;
  body: HappyDomElement;
  head: HappyDomElement;
  createElement(tag: string): HappyDomElement;
  querySelector(selector: string): HappyDomElement | null;
}
interface HappyDomElement {
  style: Record<string, string>;
  innerHTML: string;
  outerHTML: string;
  appendChild(child: HappyDomElement): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  querySelector(selector: string): HappyDomElement | null;
  remove?(): void;
  children: HappyDomElement[];
  childNodes: HappyDomElement[];
  firstElementChild: HappyDomElement | null;
  parentElement: HappyDomElement | null;
  tagName: string;
  textContent: string | null;
}
interface HappyDomWindow {
  document: HappyDomDocument;
  getComputedStyle(el: HappyDomElement): Record<string, string> & {
    getPropertyValue(name: string): string;
  };
  happyDOM: {
    waitUntilComplete?: () => Promise<void>;
    close?: () => Promise<void>;
    setViewport?(opts: { width: number; height: number }): void;
  };
  innerWidth: number;
  innerHeight: number;
}
interface HappyDomWindowCtor {
  new (opts?: { width?: number; height?: number; url?: string }): HappyDomWindow;
}

interface ReactDomClient {
  createRoot(container: HappyDomElement): {
    render(el: ReactElement): void;
    unmount(): void;
  };
}

/**
 * Recognise an existing DOM environment (vitest/jest `environment:
 * 'happy-dom'`, a browser test runner, a pre-existing jsdom). We
 * prefer reusing what's already installed: CSS-in-JS libraries
 * detect their runtime at import time, so if the test runner set
 * up `globalThis.window` before any of them loaded, they're in
 * client-side mode and their style injection will land where
 * `getComputedStyle()` can see it. Spinning up a fresh happy-dom
 * after those libraries imported in Node mode leaves them stuck
 * in SSR mode.
 */
function detectExistingWindow(injected: unknown): HappyDomWindow | null {
  if (injected && typeof injected === 'object') {
    const w = injected as Partial<HappyDomWindow>;
    if (w.document !== undefined && typeof w.getComputedStyle === 'function') {
      return injected as HappyDomWindow;
    }
  }
  const g = globalThis as unknown as Partial<HappyDomWindow> & {
    window?: HappyDomWindow;
  };
  // vitest with environment: happy-dom installs window/document on
  // globalThis. We also accept `globalThis.window` as a self-ref
  // (happy-dom exposes one) so either shape works.
  const candidate = g.window ?? (g as unknown as HappyDomWindow);
  if (
    candidate &&
    typeof candidate === 'object' &&
    candidate.document &&
    typeof candidate.getComputedStyle === 'function'
  ) {
    return candidate;
  }
  return null;
}

async function loadHappyDomWindow(
  injected?: unknown,
): Promise<HappyDomWindowCtor> {
  if (typeof injected === 'function') {
    return injected as HappyDomWindowCtor;
  }
  try {
    // Double-cast through `unknown` because happy-dom's public
    // Window type is richer (and stricter on some call signatures)
    // than the structural subset this file needs. We validate the
    // runtime shape one line below before trusting the cast.
    const mod = (await import('happy-dom')) as unknown as {
      Window: HappyDomWindowCtor;
    };
    if (typeof mod.Window !== 'function') {
      throw new Error('happy-dom did not export Window');
    }
    return mod.Window;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `resolveStylesRuntime: happy-dom is not available (${msg}). ` +
        `Install it as a dev dependency of your test setup: \`npm install --save-dev happy-dom\` ` +
        `(or the equivalent for your package manager). happy-dom is an optional peer dependency ` +
        `of @prelight/react; the static resolveStyles() path does not need it.`,
    );
  }
}

async function loadReactDomClient(): Promise<ReactDomClient> {
  // Double-cast through `unknown`: the structural `ReactDomClient`
  // interface is the minimum Prelight consumes, not a subtype of
  // react-dom/client's richer public surface. Validated below.
  const mod = (await import('react-dom/client')) as unknown as ReactDomClient;
  if (typeof mod.createRoot !== 'function') {
    throw new Error(
      'resolveStylesRuntime: react-dom/client.createRoot is not available. ' +
        'Prelight requires React 18 or newer.',
    );
  }
  return mod;
}

/**
 * Snapshot globalThis keys that happy-dom shadows, set happy-dom's
 * globals in place, and return a restore function. We pave this
 * narrow path because React + CSS-in-JS libraries read `window`,
 * `document`, `navigator`, `HTMLElement`, and friends as actual
 * globals — handing them the happy-dom instance via argument
 * isn't an option.
 *
 * The restore function is always called in a `finally`, so nested
 * probes stack correctly and leaked globals can't survive a test
 * run. This is the single most common source of "my next test
 * got a stale DOM" bugs in CSS-in-JS test suites; isolating the
 * lifecycle here keeps that bug out of consumer code.
 */
function installGlobals(window: HappyDomWindow): () => void {
  const g = globalThis as Record<string, unknown>;
  // Mirror happy-dom's documented "drop-in" global set. We only
  // touch keys the CSS-in-JS libraries actually read; adding more
  // here is cheap but increases the blast radius of a missed
  // restore.
  const keys = [
    'window',
    'document',
    'navigator',
    'location',
    'HTMLElement',
    'HTMLDivElement',
    'HTMLSpanElement',
    'HTMLStyleElement',
    'Element',
    'Node',
    'Text',
    'DocumentFragment',
    'getComputedStyle',
    'CSS',
    'CSSStyleSheet',
    'MutationObserver',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const previous: Record<string, unknown> = {};
  const had: Record<string, boolean> = {};
  const installed: string[] = [];
  for (const k of keys) {
    had[k] = Object.prototype.hasOwnProperty.call(g, k);
    previous[k] = g[k];
  }
  const w = window as unknown as Record<string, unknown>;

  // Some keys (most famously `navigator` on Node 21+) are
  // installed as read-only getters on the global. A plain
  // assignment throws `TypeError: Cannot set property ... which
  // has only a getter`. `Object.defineProperty` bypasses the
  // getter and records the override as a configurable own data
  // property, which is also what the restore path wants. Keys
  // that can't be overridden (truly non-configurable on the
  // platform) are skipped and tracked so `restore()` doesn't
  // attempt to delete a property it never installed.
  function assign(key: string, value: unknown): void {
    try {
      Object.defineProperty(g, key, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      installed.push(key);
    } catch {
      // Best-effort — the CSS-in-JS libraries we care about read
      // `window.document` not `navigator`, and the DOM classes
      // matter more than `navigator` anyway. Dropping a missed
      // key is cheaper than blowing up the whole probe.
    }
  }

  assign('window', window);
  assign('document', window.document);
  for (const k of keys) {
    if (k === 'window' || k === 'document') continue;
    if (w[k] !== undefined) assign(k, w[k]);
  }

  return function restore(): void {
    for (const k of installed) {
      try {
        if (had[k]) {
          Object.defineProperty(g, k, {
            value: previous[k],
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } else {
          delete g[k];
        }
      } catch {
        // Best-effort: the next probe's `assign` will overwrite
        // anything that survives here, and `delete` failures are
        // only an issue for non-configurable keys which we
        // couldn't have installed in the first place.
      }
    }
  };
}

/**
 * Runtime-resolve the effective typography and width constraints
 * for a React element. Mounts the element into happy-dom, lets
 * React commit, reads `getComputedStyle()` on the target node,
 * and normalises the answer into the same `ResolvedStyles` shape
 * the static walker returns.
 *
 * The returned `sources` list is populated with one entry per
 * consumed computed-style property so callers have the same
 * trace-through-the-cascade debuggability as the static path.
 */
export async function resolveStylesRuntime(
  element: ReactElement,
  options: ResolveStylesRuntimeOptions = {},
): Promise<ResolvedStyles> {
  const rootFontSize = options.rootFontSizePx ?? 16;
  const viewportWidth = options.viewportWidthPx ?? 1024;
  const viewportHeight = options.viewportHeightPx ?? 768;

  // Reuse an existing DOM env if one is already present (vitest
  // environment: 'happy-dom', jest environment: 'happy-dom', a
  // browser test runner, etc.). This is the preferred path: it
  // lets CSS-in-JS libraries stay initialized in their
  // client-side mode from the moment they were imported. Only
  // when there's no DOM at all (pure Node) do we spin up a fresh
  // happy-dom — at which point libraries imported before this
  // call may still be stuck in server mode, which is why the
  // docstring recommends consumers configure their test runner's
  // environment rather than rely on the fresh-mount fallback.
  const existingWindow = detectExistingWindow(options.window);
  let window: HappyDomWindow;
  let restore: () => void = () => {};
  if (existingWindow) {
    window = existingWindow;
  } else {
    const Window = await loadHappyDomWindow(options.window);
    window = new Window({ width: viewportWidth, height: viewportHeight });
    restore = installGlobals(window);
  }
  window.happyDOM?.setViewport?.({ width: viewportWidth, height: viewportHeight });

  const { createRoot } = await loadReactDomClient();

  try {
    const document = window.document;
    const container = document.createElement('div');
    // Put the container at the viewport width so width: 100% /
    // max-width: 100% resolve to the viewport — matches what a
    // consumer's actual app layout would see at the target
    // breakpoint. Explicit pixel width rather than CSS 100%
    // because some CSS-in-JS libraries stamp out their own
    // container styles that would otherwise collapse a zero-
    // width host.
    container.style['width'] = `${viewportWidth}px`;
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(element);
    if (typeof window.happyDOM.waitUntilComplete === 'function') {
      await window.happyDOM.waitUntilComplete();
    }

    const target = pickTarget(container, document, options.slot, element);

    const computed = window.getComputedStyle(target);
    const cssVariables = collectCssVariables(computed);
    const sources: StyleSource[] = [];
    const tagName = target.tagName?.toLowerCase() ?? 'unknown';

    const fontFamily = readComputed(computed, 'font-family');
    const fontSize = readComputed(computed, 'font-size');
    const fontWeight = readComputed(computed, 'font-weight');
    const fontStyle = readComputed(computed, 'font-style');
    const lineHeight = readComputed(computed, 'line-height');
    // `max-width` and `width` don't inherit in CSS, so reading the
    // leaf's computed value misses any max-width set on an
    // ancestor. Walk up the ancestor chain stopping at the probe
    // container to find the nearest non-default value. This matches
    // the static walker's "innermost ancestor wins" semantic for
    // box constraints — see `resolve-styles.ts` cascade rules.
    const maxWidthRaw = findAncestorBoxValue(
      target,
      container,
      window,
      'max-width',
      (v) => v !== '' && v !== 'none',
    );
    const widthRaw = findAncestorBoxValue(
      target,
      container,
      window,
      'width',
      (v) => v !== '' && v !== 'auto' && !v.endsWith('%'),
    );

    recordSource(sources, 'fontFamily', fontFamily, tagName);
    recordSource(sources, 'fontSize', fontSize, tagName);
    recordSource(sources, 'fontWeight', fontWeight, tagName);
    recordSource(sources, 'fontStyle', fontStyle, tagName);
    recordSource(sources, 'lineHeight', lineHeight, tagName);
    recordSource(sources, 'maxWidth', maxWidthRaw, tagName);
    recordSource(sources, 'width', widthRaw, tagName);

    const fragment: ResolvedStyleFragment = {};
    if (fontFamily) fragment.fontFamily = fontFamily;
    if (fontSize) fragment.fontSize = fontSize;
    if (fontWeight) fragment.fontWeight = fontWeight;
    if (fontStyle && fontStyle !== 'normal') fragment.fontStyle = fontStyle;
    if (lineHeight && lineHeight !== 'normal') fragment.lineHeight = lineHeight;
    if (maxWidthRaw && maxWidthRaw !== 'none') fragment.maxWidth = maxWidthRaw;
    else if (widthRaw && widthRaw !== 'auto') fragment.width = widthRaw;

    const fontSizePx = parseLengthPx(fragment.fontSize, rootFontSize) ?? rootFontSize;
    const font = composeFont(fragment, fontSizePx);
    const maxWidthPx = parseLengthPx(fragment.maxWidth ?? fragment.width, rootFontSize);
    const lineHeightPx = parseLineHeightPx(fragment.lineHeight, fontSizePx);

    // Clean up the React root before we return so the finalizer
    // doesn't race with a shared document's next consumer. If we
    // installed our own happy-dom window we also close it; when
    // we reused an existing one we leave it alone (the test
    // runner owns its lifecycle).
    try {
      root.unmount();
    } catch {
      // Ignored: best-effort, the worst case is a noisy warning.
    }
    try {
      container.remove?.();
    } catch {
      // Ignored: DOM node cleanup is best-effort.
    }
    if (!existingWindow && typeof window.happyDOM?.close === 'function') {
      try {
        await window.happyDOM.close();
      } catch {
        // Ignored: same reason — we're on the shutdown path.
      }
    }

    const out: ResolvedStyles = { cssVariables, sources };
    if (font !== undefined) out.font = font;
    if (maxWidthPx !== null && maxWidthPx !== undefined) out.maxWidth = maxWidthPx;
    if (lineHeightPx !== null && lineHeightPx !== undefined) out.lineHeight = lineHeightPx;
    return out;
  } finally {
    restore();
  }
}

/**
 * Pick the DOM node whose computed styles Prelight should read.
 *
 * Without a slot: the first descendant that actually carries
 * visible text. That mirrors `resolveStyles()`'s "first text
 * branch" semantic — whichever leaf element holds the label the
 * user sees, that's the element whose cascade matters. For a
 * simple `<Button>Save</Button>` that's the button; for a
 * `<Card><Header>Save</Header></Card>` with Header wrapping the
 * text, that's Header.
 *
 * With a slot: the element tagged `data-prelight-slot={slot}`.
 * Throws with the list of known slots when the slot is missing.
 * Fail-loud behaviour matches the static walker.
 */
function pickTarget(
  container: HappyDomElement,
  document: HappyDomDocument,
  slot: string | undefined,
  originalElement: ReactElement,
): HappyDomElement {
  if (slot !== undefined) {
    // CSS selector for `[data-prelight-slot="..."]`. We escape the
    // slot name conservatively — slots are user-supplied labels.
    const escaped = slot.replace(/["\\]/g, '\\$&');
    const node = container.querySelector(`[${SLOT_ATTR}="${escaped}"]`);
    if (node === null) {
      // Mirror the static walker's error: enumerate the slots in
      // the React tree so the consumer sees the same diagnostic
      // regardless of which path they took.
      const known = findSlots(originalElement);
      const knownStr = known.length > 0 ? known.join(', ') : '(none)';
      throw new Error(
        `resolveStylesRuntime: slot "${slot}" not found; known slots in this tree: [${knownStr}].`,
      );
    }
    return node;
  }
  const firstText = findFirstTextNode(container);
  return firstText ?? container;
}

function findFirstTextNode(root: HappyDomElement): HappyDomElement | null {
  // Descend through firstElementChild until we hit a leaf. We
  // deliberately pick the *deepest* first child rather than any
  // child with a non-empty textContent: CSS-in-JS libraries
  // routinely wrap the label in one or two styled children, and
  // the typography cascade applies at the leaf. Descending to
  // the leaf reads the right side of the cascade.
  let node: HappyDomElement | null = root.firstElementChild;
  if (!node) return null;
  let deepest: HappyDomElement = node;
  while (node) {
    deepest = node;
    node = node.firstElementChild;
  }
  return deepest;
}

function readComputed(
  computed: Record<string, string> & {
    getPropertyValue(name: string): string;
  },
  property: string,
): string {
  const viaAccessor = computed.getPropertyValue(property);
  if (typeof viaAccessor === 'string' && viaAccessor.length > 0) return viaAccessor.trim();
  // Some happy-dom versions also expose properties on the object
  // itself; fall back to camelCase lookup as a belt-and-braces.
  const camel = property.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  const fallback = computed[camel];
  return typeof fallback === 'string' ? fallback.trim() : '';
}

/**
 * Walk up from `start` toward (but not past) `stopAt`, reading a
 * non-inheriting box property via `getComputedStyle`. Returns the
 * first value accepted by `accept`, or '' if no ancestor has one.
 *
 * The static resolver already has "innermost ancestor wins"
 * semantics for max-width / width; this mirrors it for the
 * runtime path so a `<div style={{ maxWidth: 200 }}><span>Hi</span></div>`
 * resolves to 200 whether the probe reads the div (via the static
 * walker) or the span (via getComputedStyle, where max-width
 * doesn't inherit).
 */
function findAncestorBoxValue(
  start: HappyDomElement,
  stopAt: HappyDomElement,
  window: HappyDomWindow,
  property: string,
  accept: (value: string) => boolean,
): string {
  let node: HappyDomElement | null = start;
  while (node) {
    const computed = window.getComputedStyle(node);
    const value = readComputed(computed, property);
    if (accept(value)) return value;
    if (node === stopAt) break;
    node = node.parentElement;
  }
  return '';
}

function recordSource(
  sources: StyleSource[],
  prop: string,
  value: string,
  elementType: string,
): void {
  if (!value) return;
  sources.push({
    prop,
    value,
    resolver: 'runtimeComputed',
    elementType,
  });
}

/**
 * Enumerate `--foo` custom properties from the computed style
 * map. happy-dom exposes them under their kebab-case names via
 * `getPropertyValue`; we mirror that surface.
 */
function collectCssVariables(
  computed: Record<string, string> & { getPropertyValue(name: string): string },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(computed)) {
    if (!key.startsWith('--')) continue;
    const value = computed.getPropertyValue(key);
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

/**
 * Assemble the canonical `font` shorthand `@prelight/core` consumes
 * out of the computed-style fragment. Mirrors `composeFontShorthand`
 * in `resolve-styles.ts` — the input shape is different (all
 * strings, coming straight from getComputedStyle) but the output
 * contract must be byte-identical for callers to not care which
 * probe produced the value.
 */
function composeFont(
  frag: ResolvedStyleFragment,
  fontSizePx: number,
): string | undefined {
  if (frag.fontFamily === undefined) return undefined;
  const parts: string[] = [];
  if (frag.fontStyle && frag.fontStyle !== 'normal') parts.push(String(frag.fontStyle));
  if (frag.fontWeight !== undefined) {
    const weight = String(frag.fontWeight);
    if (weight !== '400' && weight !== 'normal') parts.push(weight);
  }
  parts.push(`${fontSizePx}px`);
  parts.push(String(frag.fontFamily));
  return parts.join(' ');
}
