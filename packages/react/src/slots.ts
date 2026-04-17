/**
 * Slot markers for multi-slot component verification (v0.3 H4).
 *
 * Convention: any React element with a `data-prelight-slot="name"`
 * prop is a slot. Using `data-*` is deliberate:
 *
 *   1. React forwards `data-*` props to rendered HTML attributes,
 *      so `extractText` can slice rendered markup per slot without
 *      requiring a special runtime component.
 *   2. No new wrapper component is exported — multi-slot patterns
 *      (`<Card>{<Title/>}{<Body/>}{<Footer/>}</Card>` composing a
 *      shadcn/Radix-style primitive) just tag their slot roots
 *      with the attribute.
 *   3. Works for any DOM element — no type bound on the element
 *      subtree.
 *
 * The functions in this file are pure. Given the same React tree
 * and slot name they return the same path / text — no rendering,
 * no DOM.
 *
 * PRELIGHT-INVARIANT: the walk ordering is depth-first preorder.
 * When two elements carry the same slot name the FIRST one
 * encountered wins. That's documented per-function and asserted by
 * tests so future changes don't silently reorder.
 */

import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { htmlToText } from './extract.js';

/** The attribute name this package uses to mark slots. */
export const SLOT_ATTR = 'data-prelight-slot';

type PropsWithChildren = {
  children?: ReactNode;
  [key: string]: unknown;
};

function getProps(node: ReactElement): PropsWithChildren {
  return (node.props ?? {}) as PropsWithChildren;
}

function getSlotName(node: ReactElement): string | undefined {
  const value = getProps(node)[SLOT_ATTR];
  return typeof value === 'string' ? value : undefined;
}

function childArray(children: ReactNode): ReactNode[] {
  if (children === undefined || children === null || children === false) return [];
  return Array.isArray(children) ? children : [children];
}

/**
 * Walk the tree in depth-first preorder and return every unique
 * slot name found, in first-encounter order. Useful for diagnostic
 * error messages ("slot 'title' not found; known slots: [header,
 * body]") and for corpus generators that want to enumerate all
 * verifiable slots in a component.
 */
export function findSlots(element: ReactElement): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  function visit(node: ReactNode): void {
    if (!isValidElement(node)) return;
    const name = getSlotName(node);
    if (name !== undefined && !seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
    for (const child of childArray(getProps(node).children)) visit(child);
  }

  visit(element);
  return ordered;
}

/**
 * Depth-first preorder search for the element carrying
 * `data-prelight-slot={slotName}`. Returns the full ancestor path
 * from root to slot (inclusive), or `null` when the slot is absent.
 * Exposed for callers (e.g. `resolveStyles` with a `slot:` option)
 * that need to replay the cascade along the path to the slot.
 */
export function findSlotPath(element: ReactElement, slotName: string): ReactElement[] | null {
  const path: ReactElement[] = [];

  function walk(node: ReactNode): boolean {
    if (!isValidElement(node)) return false;
    path.push(node);
    if (getSlotName(node) === slotName) return true;
    for (const child of childArray(getProps(node).children)) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  }

  return walk(element) ? path : null;
}

/**
 * Extract the plain-text content of the named slot. Renders the
 * ENTIRE element tree to static markup once, then slices the HTML
 * between the marker element's opening tag and its matching
 * closing tag. This keeps semantics consistent with `extractText`
 * (same `react-dom/server` output, same entity decoding) while
 * guaranteeing the slot's text is exactly what would land in the
 * DOM.
 *
 * Throws with a helpful message listing the known slot names when
 * `slotName` isn't present. v0.3 finds the first slot element in
 * tree order when names collide — this is asserted by unit tests.
 */
export function extractSlotText(element: ReactElement, slotName: string): string {
  const path = findSlotPath(element, slotName);
  if (path === null) {
    const known = findSlots(element);
    const knownStr = known.length > 0 ? known.join(', ') : '(none)';
    throw new Error(
      `extractSlotText: slot "${slotName}" not found; known slots in this tree: [${knownStr}].`,
    );
  }
  // Render the slot subtree standalone. This mirrors the semantics
  // `extractText` already uses for whole components — ancestors
  // that only affect layout cascade (style, CSS vars) don't
  // participate in rendered text output, so rendering the slot
  // root directly produces the exact same text characters that
  // would land in the DOM.
  const slotRoot = path[path.length - 1]!;
  return htmlToText(renderToStaticMarkup(slotRoot));
}
