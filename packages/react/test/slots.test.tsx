/**
 * H4 slot-markers corpus: 24 cases across four categories.
 *
 *   1. findSlots discovery (6 cases): empty tree, single, multi,
 *      duplicates (first wins), non-string values, attr constant.
 *   2. findSlotPath targeting (5 cases): root-is-slot, nested,
 *      absent, duplicate preorder, sibling-branch skip.
 *   3. extractSlotText rendering (8 cases): leaf extraction,
 *      nested elements, same-tag siblings, different-tag bodies,
 *      missing slot error, empty-tree known-list, entity
 *      decoding, standalone-subtree rendering.
 *   4. resolveStyles + verifyComponent with slot option (5 cases):
 *      cascade follows slot path, sibling branch ignored, missing-
 *      slot error, verifyComponent end-to-end, explicit font wins.
 */

import React from 'react';
import { describe, expect, test } from 'vitest';

import {
  extractSlotText,
  findSlotPath,
  findSlots,
  resolveStyles,
  SLOT_ATTR,
  verifyComponent,
} from '../src/index.js';

describe('H4.1 findSlots discovery', () => {
  test('C01 empty tree returns []', () => {
    expect(findSlots(<div />)).toEqual([]);
  });

  test('C02 single slot on root', () => {
    expect(findSlots(<div data-prelight-slot="only">x</div>)).toEqual(['only']);
  });

  test('C03 multiple slots in preorder', () => {
    const el = (
      <div>
        <h1 data-prelight-slot="title">Title</h1>
        <p data-prelight-slot="body">Body</p>
        <footer data-prelight-slot="footer">Foot</footer>
      </div>
    );
    expect(findSlots(el)).toEqual(['title', 'body', 'footer']);
  });

  test('C04 duplicate slot names dedupe, first wins', () => {
    const el = (
      <div>
        <h1 data-prelight-slot="heading">A</h1>
        <h2 data-prelight-slot="heading">B</h2>
      </div>
    );
    expect(findSlots(el)).toEqual(['heading']);
  });

  test('C05 non-string slot values are ignored', () => {
    // Unsafe cast is deliberate — we want to assert the walker
    // doesn't blow up if a consumer passes the wrong type.
    const el = (
      <div data-prelight-slot={42 as unknown as string}>
        <span data-prelight-slot="ok">y</span>
      </div>
    );
    expect(findSlots(el)).toEqual(['ok']);
  });

  test('C06 SLOT_ATTR constant matches the contract', () => {
    expect(SLOT_ATTR).toBe('data-prelight-slot');
  });
});

describe('H4.2 findSlotPath targeting', () => {
  test('C07 root is the slot: path length 1', () => {
    const el = <div data-prelight-slot="all">x</div>;
    const path = findSlotPath(el, 'all');
    expect(path).not.toBeNull();
    expect(path).toHaveLength(1);
    expect(path![0]!.type).toBe('div');
  });

  test('C08 nested slot: path has every ancestor', () => {
    const el = (
      <section>
        <div>
          <h1 data-prelight-slot="title">Hi</h1>
        </div>
      </section>
    );
    const path = findSlotPath(el, 'title')!;
    expect(path.map((n) => n.type)).toEqual(['section', 'div', 'h1']);
  });

  test('C09 absent slot returns null', () => {
    const el = <div data-prelight-slot="x" />;
    expect(findSlotPath(el, 'y')).toBeNull();
  });

  test('C10 first branch wins for duplicates (preorder)', () => {
    // DFS: first branch's slot is the one returned.
    const el = (
      <div>
        <aside>
          <h1 data-prelight-slot="same">First</h1>
        </aside>
        <main>
          <h1 data-prelight-slot="same">Second</h1>
        </main>
      </div>
    );
    const path = findSlotPath(el, 'same')!;
    expect(path.map((n) => n.type)).toEqual(['div', 'aside', 'h1']);
  });

  test('C11 sibling branches without the slot are skipped cleanly', () => {
    // The path-pop logic after a failed branch must not include
    // stale ancestors when the walker continues into a sibling.
    const el = (
      <div>
        <aside>
          <p>no slot here</p>
        </aside>
        <main>
          <h1 data-prelight-slot="title">found</h1>
        </main>
      </div>
    );
    const path = findSlotPath(el, 'title')!;
    expect(path.map((n) => n.type)).toEqual(['div', 'main', 'h1']);
  });
});

describe('H4.3 extractSlotText rendering', () => {
  test('C12 extracts plain text of a leaf slot', () => {
    const el = (
      <div>
        <h1 data-prelight-slot="title">Hello</h1>
        <p data-prelight-slot="body">World</p>
      </div>
    );
    expect(extractSlotText(el, 'title')).toBe('Hello');
    expect(extractSlotText(el, 'body')).toBe('World');
  });

  test('C13 extracts text through nested elements', () => {
    const el = (
      <div data-prelight-slot="card">
        <h1>
          <span>Nested</span>
        </h1>
        <p>
          <em>content</em>
        </p>
      </div>
    );
    expect(extractSlotText(el, 'card')).toBe('Nestedcontent');
  });

  test('C14 sibling same-tag nesting: closing-tag matching stays correct', () => {
    // Two <div>s nested inside the slot <div> — naive slicing
    // that stops at the first </div> would truncate. The
    // bracket-depth walker must match the correct </div>.
    const el = (
      <div>
        <div data-prelight-slot="outer">
          <div>inner1</div>
          <div>inner2</div>
        </div>
      </div>
    );
    expect(extractSlotText(el, 'outer')).toBe('inner1inner2');
  });

  test('C15 different tag types in slot body', () => {
    const el = (
      <article data-prelight-slot="post">
        <h1>Title</h1>
        <p>Body</p>
      </article>
    );
    expect(extractSlotText(el, 'post')).toBe('TitleBody');
  });

  test('C16 missing slot throws with known-slots list', () => {
    const el = (
      <div>
        <h1 data-prelight-slot="title">Hi</h1>
      </div>
    );
    expect(() => extractSlotText(el, 'nope')).toThrow(/known slots in this tree: \[title\]/);
  });

  test('C17 missing slot in empty-slot tree lists "(none)"', () => {
    expect(() => extractSlotText(<div />, 'x')).toThrow(/known slots in this tree: \[\(none\)\]/);
  });

  test('C18 HTML entities decode in slot text', () => {
    const el = <div data-prelight-slot="s">{'A & B'}</div>;
    // React SSR escapes `&` to `&amp;`; htmlToText decodes.
    expect(extractSlotText(el, 's')).toBe('A & B');
  });

  test('C19 slot root renders standalone (ancestor tags do not appear in output)', () => {
    // The slot subtree is rendered on its own, so any wrapper
    // ancestor elements don't contribute text — critical for
    // multi-slot Cards where only the slot's text should flow
    // through the verifier.
    const el = (
      <section>
        <header>ignore this header</header>
        <article data-prelight-slot="content">just me</article>
        <footer>ignore this footer</footer>
      </section>
    );
    expect(extractSlotText(el, 'content')).toBe('just me');
  });
});

describe('H4.4 resolveStyles with slot option', () => {
  test('C20 cascade follows the slot path', () => {
    const el = (
      <div style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 200, lineHeight: 18 }}>
        <h1 style={{ fontSize: 24 }} data-prelight-slot="title">
          Title
        </h1>
        <p data-prelight-slot="body">Body</p>
      </div>
    );
    // title: overrides fontSize to 24, inherits family + maxWidth.
    const title = resolveStyles(el, { slot: 'title' });
    expect(title.font).toBe('24px Inter');
    expect(title.maxWidth).toBe(200);
    // body: inherits fontSize 14 from root.
    const body = resolveStyles(el, { slot: 'body' });
    expect(body.font).toBe('14px Inter');
  });

  test('C21 sibling branch that would win in non-slot mode is ignored', () => {
    // Without a slot: walker descends first element child → <aside>
    // and picks up its fontSize 30. With slot "body" it must
    // follow the <main> branch instead.
    const el = (
      <div style={{ fontFamily: 'Inter', maxWidth: 200, lineHeight: 18 }}>
        <aside style={{ fontSize: 30 }}>sidebar</aside>
        <main>
          <p data-prelight-slot="body" style={{ fontSize: 12 }}>
            content
          </p>
        </main>
      </div>
    );
    const r = resolveStyles(el, { slot: 'body' });
    expect(r.font).toBe('12px Inter');
  });

  test('C22 missing slot throws with helpful list', () => {
    const el = (
      <div>
        <h1 data-prelight-slot="title">Hi</h1>
      </div>
    );
    expect(() => resolveStyles(el, { slot: 'body' })).toThrow(
      /known slots in this tree: \[title\]/,
    );
  });

  test('C23 verifyComponent targets a slot end-to-end', () => {
    // Title is short and fits a 1-line maxLines constraint at the
    // slot's own 24px/28px line-height. The body is long enough
    // that *without* slot targeting the verifier would see the
    // full "Short + paragraph" text and need to reconcile the
    // resolved styles to one cascade — slot targeting makes the
    // verify end-to-end clean.
    const element = (
      <article>
        <h1
          data-prelight-slot="title"
          style={{ fontSize: 24, fontFamily: 'Inter', maxWidth: 200, lineHeight: 28 }}
        >
          Short
        </h1>
        <p
          data-prelight-slot="body"
          style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 200, lineHeight: 18 }}
        >
          This is a much longer body of text that will definitely take multiple lines
          so we can tell title-vs-body verification apart cleanly.
        </p>
      </article>
    );
    const r = verifyComponent({
      element: () => element,
      languages: ['en'],
      autoResolve: true,
      slot: 'title',
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(r.ok).toBe(true);
    // Confirm what actually flowed through the verifier by
    // reproducing the slot extraction call site uses.
    expect(extractSlotText(element, 'title')).toBe('Short');
  });

  test('C24 verifyComponent slot + explicit font still wins over autoResolve', () => {
    const element = (
      <article>
        <p
          data-prelight-slot="body"
          style={{ fontSize: 14, fontFamily: 'Inter', maxWidth: 200, lineHeight: 18 }}
        >
          abc
        </p>
      </article>
    );
    const r = verifyComponent({
      element: () => element,
      languages: ['en'],
      autoResolve: true,
      slot: 'body',
      font: '18px Inter',
      constraints: { maxLines: 1 },
    });
    // Explicit `font` wins over autoResolve — the verifier uses
    // 18px Inter, not the 14px from the slot's inline style. The
    // slot still governs which text and which maxWidth/lineHeight
    // are auto-resolved; font is just the one the caller pinned.
    expect(r.ok).toBe(true);
    expect(extractSlotText(element, 'body')).toBe('abc');
  });
});
