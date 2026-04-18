# Roadmap

This is the authoritative scope document. Every `PRELIGHT-NEXT(...)` marker in the codebase should resolve to an entry here. If you add scope to code, add it here first.

---

## v0.1 — Text layout verification (shipped)

**Ships:** [`@prelight/core`](./packages/core), [`@prelight/react`](./packages/react), [`@prelight/vitest`](./packages/vitest), [`@prelight/jest`](./packages/jest), [`@prelight/cli`](./packages/cli).

**Verifies:**
- Line count (min / max / exact)
- Overflow against a max width
- Fit at user font scale (1.0 / 1.25 / 1.5 / 2.0)
- Single-line constraint
- Truncation (detect that visible text != source text)

**Corpus:** English, German, Arabic, Japanese, Chinese, Hebrew (RTL pair for Arabic), plus a "compound words" stress set and an emoji set.

**Ground-truth:** Playwright harness renders the corpus in Chromium, WebKit, and Firefox; diffs Prelight's predicted line count and box against the real browser. Budget: ≤1px deviation, 100% of corpus.

**Out of scope in v0.1** (tracked below):
- Flex / grid / block layout
- Image intrinsic sizing
- Padding / margin propagation
- Interactive state (hover, focus) changing layout
- `white-space: pre-*`, hyphenation, `text-wrap: balance`
- Multi-component composition (parent constrains child)

## v0.2 — Structural primitives (shipped)

**Adds:** `@prelight/core` learns a minimal structural model:
- Block flow with adjacent-sibling vertical margin collapsing
- Flex (single-axis, no wrap — wrap deferred to v1.0)
- Image aspect ratios via `object-fit` (`contain` / `cover` / `fill` / `scale-down` / `none`)
- `Box` + `EdgeInsets` primitives (padding / border / margin)
- `@prelight/react` gains `resolveStyles()` + `StyleResolver` plugins (inline + CSS variables built in)
- `@prelight/cli` gains TTY-aware reporter with `NO_COLOR` / `FORCE_COLOR` honoured

**Does not add:** grid, positioning (`absolute`, `fixed`), containment, transforms, flex-wrap.

**Why this order:** flex + block covers ~80% of production UI. Grid is a larger investment (see v1.0). Positioning is rare enough in component libraries that a v1.1 slot is fine.

## v0.3 — Multi-slot + CSS-in-JS + measurement-font contracts (current — rc.1 tagged)

**Tagged:** `v0.3.0-rc.1` (2026-04-18). Final `v0.3.0` gated on a contributor-facing docs pass + a demo exercising `verifyComponent({ runtime: true })`.

**Adds:**
- **Multi-slot components.** `findSlots()` / `extractSlotText()` / `resolveStyles({ slot })` in `@prelight/react`, driven by a `data-prelight-slot` attribute. One `verifyComponent()` call can assert text layout across an arbitrary number of slots in a single component (e.g. card title + card body + card meta).
- **Flex `align-items: baseline`.** Cross-axis alignment over the dominant font baseline, validated against the cross-engine ground-truth harness.
- **`measurementFonts` contract.** `VerifySpec` gains `measurementFonts.cjk` + `measurementFonts.emoji`, a typed surface that names which font the oracle should reach for when the text contains characters the spec's declared `font` can't shape. Ships with a bundled `NotoEmoji-subset.ttf` (611 KB, monochrome outline subset of Noto-COLRv1, GSUB-closed so ZWJ / skin-tone / keycap / regional-indicator sequences all resolve to single ligature glyphs) so emoji measurement works out of the box.
- **Runtime style probe (`resolveStylesRuntime`).** A library-agnostic runtime style resolution path for `@prelight/react`. Mounts React into happy-dom (or any pre-installed DOM env), lets the page's CSS-in-JS library inject its stylesheets on mount, then reads `getComputedStyle()` at the picked target, walking the ancestor chain for non-inheriting `max-width` / `width` so the static walker's "innermost ancestor wins" semantic is preserved. `verifyComponent({ runtime: true })` opts into the probe; the default path stays synchronous and unchanged.
- **CSS-in-JS coverage.** With the runtime probe in place, emotion, `@emotion/react`'s `css` prop, styled-components v6 (including `attrs`, `css` helper, `ThemeProvider`), Linaria, vanilla-extract, Stitches, Panda, Tamagui, CSS Modules, and plain `<link>` stylesheets are all within reach — any library that injects styles the browser matches via normal CSSOM is supported, without per-library plugin code.

**Does not add:** grid, positioning, containment, transforms, flex-wrap. Same line as v0.2.

**Why this order:** `measurementFonts` was the last thing blocking consumers with emoji / CJK text from getting honest measurements. The runtime probe was the last thing blocking consumers using any CSS-in-JS library from using Prelight at all. Both needed to land before v1.0's Presize work to keep v1.0 focused on the layout engine rather than on oracle robustness.

## v1.0 — Full layout verification (Prelight + Presize)

**Adds:** a `Presize` engine — userland implementation of the full flex + grid + block layout algorithms, DOM-free, ground-truth verified. Prelight becomes the predicate layer over Presize's layout tree.

**At this point Prelight can verify any layout question answerable from CSS alone**, at the same speed profile as v0.1 text-only verification.

**Investment:** comparable to all of v0.1. This is its own project, not a point release. ROADMAP entry exists so v0.1 decisions are made with v1.0 compatibility in mind — never with v1.0 blockers.

## v2.0 — Beyond CSS

**Speculative, not committed.** Things that would be natural extensions once the primitive is proven:

- **Visual regression without screenshots.** Diff layout trees instead of pixel bitmaps.
- **Design-doc verification.** Assert against Figma frames as the source of truth.
- **Runtime use.** Prelight-in-prod: pre-render guard for user-generated content that's about to hit a constrained slot (tweet card, table cell, sidebar).
- **Language-aware CI gates.** "This PR ships a new string; does it still fit in every locale we support?" as a default protection.

---

## Deferred scope from v0.1

Each entry tagged with a `PRELIGHT-NEXT` marker in the codebase.

| Marker | Item | Target |
| --- | --- | --- |
| `PRELIGHT-NEXT(v0.2)` | `resolveStyles()` + StyleResolver plugin surface | **v0.2 (G1 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.2)` | `Box` + `EdgeInsets` primitives (padding / border / margin) | **v0.2 (G2 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.2)` | Flex container fit check | **v0.2 (G3 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.2)` | Block flow + adjacent-sibling margin collapse | **v0.2 (G4 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.2)` | Image slot overflow | **v0.2 (G5 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.2)` | TTY-aware CLI reporter with NO_COLOR / FORCE_COLOR | **v0.2 (G7 shipped 2026-04-16)** |
| `PRELIGHT-NEXT(v0.3)` | Slot markers for multi-slot components | **v0.3 (H4 shipped 2026-04-17)** |
| `PRELIGHT-NEXT(v0.3)` | emotion + styled-components StyleResolver plugins | **v0.3 (H7 shipped 2026-04-17 — reframed as one library-agnostic `resolveStylesRuntime` probe; see FINDINGS §H7)** |
| `PRELIGHT-NEXT(v0.4)` | Per-level CLI palette overrides via `PRELIGHT_COLOR_PASS` / `PRELIGHT_COLOR_FAIL` for deuteranopia / protanopia | v0.4 |
| `PRELIGHT-NEXT(v0.4)` | `@prelight/jest/cjs` entry point for CJS Jest consumers | v0.4 |
| `PRELIGHT-NEXT(v1.0)` | Flex `flex-wrap` | v1.0 |
| `PRELIGHT-NEXT(v1.0)` | Grid layout engine | v1.0 |
| `PRELIGHT-NEXT(v1.0)` | Static `vw` / `vh` / `%` / `calc()` resolution against a caller-supplied viewport (runtime probe already handles these via `getComputedStyle()`) | v1.0 |
| `PRELIGHT-NEXT(v1.0)` | `white-space: pre-wrap` handling | v1.0 |
| `PRELIGHT-NEXT(v1.0)` | Shaping for Arabic ligatures (beyond Pretext's current fidelity) | v1.0 |
| `PRELIGHT-NEXT(v1.1)` | Positioned elements (`absolute`, `fixed`) | v1.1 |
| `PRELIGHT-NEXT(v2.0)` | Figma frame import | v2.0 |
| `PRELIGHT-NEXT(v2.0)` | Runtime pre-render guard | v2.0 |

**Policy:** every `PRELIGHT-NEXT` in code names a version. No open-ended TODOs.
