# The thesis behind Prelight

> Layout is the last unmeasured part of the UI.

## What went wrong

For thirty years, the browser has owned layout. You write CSS, you render, you read `getBoundingClientRect()`, and whatever the browser says is what ships. If you want to know whether a button fits in German, you render the button in German. If you want to know whether your nav fits at 150% zoom, you render the nav at 150% zoom. If you want to know whether Arabic wraps correctly, you render it in Chromium, and WebKit, and Firefox, and you wait.

That worked when "layout" meant arranging text paragraphs. It stopped working the moment we started shipping design systems with 40 components × 20 languages × 4 zoom levels × 3 themes. The matrix is too big. Teams compensate with cultural practices: `"Try to keep copy short"`, `"Ask a German-speaker to QA"`, `"Ship and wait for bugs"`. None of these scale.

## The shift Pretext named

Cheng Lou's Pretext demonstrated something the CSS working group never did: layout is **knowable** without the DOM. The same canvas font engine the browser uses can be called from userland, measured, cached, composed into arithmetic. A library doesn't need permission. It just needs to do the job.

Pretext made DOM-free measurement 600× faster than the browser's own path. That's not a micro-optimization. That's a category shift. Suddenly the work that takes thirty seconds to verify in CI takes five milliseconds.

## What Prelight adds

Pretext measures. Prelight **verifies**. The distinction matters.

- **Measurement** answers: _how wide is this string in this font?_
- **Verification** answers: _will my Save button fit in every language, at every zoom level, in every theme, forever?_

Verification is a layer above measurement. It needs:

1. A **spec language** for intent — `noOverflow`, `maxLines`, `singleLine`.
2. A **matrix expander** — languages × zoom scales × widths.
3. A **corpus** — real strings that break things: German compound words, Arabic bidirectional cases, CJK width, emoji ZWJ sequences, Hungarian agglutination.
4. A **failure report** that tells a human not just "it broke" but _what broke, where, by how much, and in what language_.
5. A **ground-truth harness** that proves every release still agrees with the browser on every corpus entry.
6. **Framework adapters** so that this fits into the test runner people already use, not one they have to adopt.

That's Prelight.

## Why this is an AI-era tool

Three reasons.

**One**: AI can generate UI faster than humans can review it. When a model produces fifty components overnight, a human reviewer cannot hand-test each one in four languages at three scales. A static verifier can.

**Two**: Pretext itself was built with AI-assisted tight loops — tens of thousands of `canvas.measureText` probes cross-checked against real browser rendering. That's the kind of iteration only AI makes cheap. Prelight inherits that discipline: every release diffs against **real Chromium, WebKit, and Firefox**. v0.1's **928-case** multilingual corpus (7 languages plus a 51-string emoji stress set) currently agrees on **94.5% / 94.7% / 94.3%** of cases overall (Chromium / WebKit / Firefox), and **≥ 97.9% on every non-emoji cell** — every language and script above 95%. The 10% emoji gap is font-fallback variance (bundled Inter has no emoji glyphs, so canvas and each browser pick different system emoji faces) and is tracked transparently in [FINDINGS.md §F6](../FINDINGS.md), not a layout bug. Each release must hold or exceed the per-engine × per-language floor or it doesn't ship.

**Three**: This is userland code solving a problem the browser was supposed to own. That's the pattern the 2020s are about. CSS container queries are userland before they're native. Scroll animations are userland before they're native. Layout verification is userland now.

## The scope of v0.1

Everything in v0.1 is _text_. That's on purpose.

- Text is where real teams already have overflow bugs.
- Text is where Pretext already measures correctly.
- Text is the smallest honest v1.0 surface.

What's explicitly NOT in v0.1:

- No CSS cascade resolution (inherited `font-size` from a stylesheet, for instance, is not read — pass it explicitly).
- No margin collapse, no grid intrinsic sizing, no flex.
- No multi-slot verification inside one component — v0.2 introduces slot markers.
- No cross-browser matrix in the tests you write — the ground-truth harness runs Chromium today. WebKit and Firefox follow in v1.0.

Read [ROADMAP.md](../ROADMAP.md) for the path from here.

## Credits

Pretext is Cheng Lou. Prelight is the layer above — the part that belongs to the engineer who ships the button.
