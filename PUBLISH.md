# PUBLISH.md — release prep for the first public push

This is the pre-flight checklist for publishing `prelight` to GitHub under
the positioning finalised on 2026-04-18: **"a layout linter for translated
UI, verified against Chromium, WebKit, and Firefox."** Everything in this
document is source material for the publish action — copy, numbers,
settings, and the physical sequence.

Commit this file; it doubles as the audit trail for the launch.

---

## 1 · GitHub repository settings

### Description (the "About" field, 350-char limit)

```
A layout linter for translated UI. Catches German-button overflow, Arabic wrapping, and scale-cascade failures before CI — without a browser. Verified against Chromium, WebKit, and Firefox on a 928-case multilingual corpus. MIT.
```

(239 characters. Fits with room.)

### Website

```
https://<owner>.github.io/prelight
```

Wire GitHub Pages to serve from `site/` once the first push lands (see §6).

### Topics (14)

Pick all of these. GitHub's discoverability leans heavily on Topics.

```
layout · linter · i18n · localization · testing · visual-regression
typescript · react · vitest · jest · playwright · typography
accessibility · monorepo
```

### Social preview

Export `brand/social-preview.svg` to 1280 × 640 PNG and upload under
`Settings → Options → Social preview`. One of:

```bash
rsvg-convert -w 1280 -h 640 brand/social-preview.svg > brand/social-preview.png
# or
chrome --headless --disable-gpu \
       --screenshot=brand/social-preview.png \
       --window-size=1280,640 brand/social-preview.svg
```

### Features to enable / disable

| Feature | State | Why |
| --- | --- | --- |
| Issues | **on** | Expected OSS channel. |
| Discussions | **on** | For "is this the right tool for X?" questions you don't want as issues. |
| Wiki | **off** | Governance lives in `/*.md` files. A wiki drifts. |
| Projects | **off at launch** | Re-enable when v0.4 planning starts. |
| Releases | **on** | Cut `v0.3.0` (§4). |
| Packages | **off at launch** | Re-enable when you publish to GH Packages or npm. |

### Branch protection for `main`

- Require 1 review before merge (yourself for now; humour future collaborators).
- Require the following status checks: `typecheck`, `test`, `measure-bundle`, `ground-truth (chromium)`, `ground-truth (webkit)`, `ground-truth (firefox)`.
- Do **not** require linear history yet — v0.4 plan work may want merge commits.
- Do **not** allow force-push to `main`.

---

## 2 · Release `v0.3.0` on GitHub

The tag already exists. You need to create the Release record with a
rewritten message (the original tag message is internal phrasing; the
Release page is the one Google + HN readers will see).

### Title

```
v0.3.0 — CSS-in-JS runtime probe, emoji ground truth, 928-case corpus
```

### Body

```markdown
**prelight** is a layout linter for translated UI. You describe the
contract your layout must satisfy (*this button fits one line at every
locale, at every font scale, at every slot width you support*), prelight
runs a DOM-free verification against your components, and fails the
PR when it doesn't hold.

v0.3 is the first release we're comfortable letting other people read.

## What's new in 0.3

- **CSS-in-JS runtime probe** (H7). `verifyComponent({ runtime: true })`
  mounts your React subtree into happy-dom, waits for the commit, and
  reads `getComputedStyle()` on the slot target. End-to-end verified
  against Emotion in `demos/runtime-probe-emotion/`. `happy-dom` is an
  optional peer — static consumers pay zero install cost.
- **Emoji ground truth** (H6c). Ships a **611 KB bundled
  `NotoEmoji-subset.ttf`** (monochrome outline subset of Noto-COLRv1,
  GSUB-closed for ZWJ / skin-tone / keycap / flag sequences). Cross-engine
  agreement on the emoji corpus: **99.75 %** on Chromium, WebKit, and
  Firefox.
- **Multi-slot components** (H4). Tag a component with
  `data-prelight-slot="title"` and verify title / body / meta
  independently with a single adapter call.
- **`measurementFonts` contract** (H6). Typed surface for naming the CJK /
  emoji face the canvas-side oracle should reach for when the declared
  `font` can't shape a grapheme cluster.
- **`align-items: baseline`** in `fitsFlex` (H5).
- **`object-position` + percentage insets** in `fitsAspect` (H3).

## Numbers

All produced by commands in this repo, no marketing rounding.

| Claim | Reproduce with |
| --- | --- |
| 440 tests passing across 5 packages | `bun run test` |
| 98.81 % / 99.03 % / 98.60 % cross-engine agreement (Chromium / WebKit / Firefox) | `bun run ground-truth:strict -- --browser all` |
| 99.75 % emoji agreement on all three engines | `bun run ground-truth:strict -- --browser all --lang emoji` |
| 8.99 KB gz / 23.86 KB min `@prelight/core` | `bun run measure-bundle:strict` |
| 4.60 KB gz / 11.44 KB min `@prelight/react` | `bun run measure-bundle:strict` |
| `NotoEmoji-subset.ttf` reproducibility from pinned source | `bun run scripts/subset-emoji-font.ts` |

## Self-review

We also publish our own adversarial review of this release:
[REVIEW-v0.3.0.md](./REVIEW-v0.3.0.md). One critical finding, five
important, three discussion items. Worth reading before putting prelight
in a CI path.

## Install

Not on npm yet — npm publish is v0.4 scope. For now, clone the repo and
add as a workspace dep against the `v0.3.0` tag:

    bun add -D @prelight/core @prelight/vitest @prelight/react

## Full changelog

See [CHANGELOG.md](./CHANGELOG.md#030--2026-04-18).
```

### Tag

Already exists: `v0.3.0` → `70cc689fe0b92c9f623a73213d448c9a8f8bafa5`.

### Assets

Attach no binaries. Source + tag is enough for v0.3. v0.4 (npm publish)
brings the tarballs.

---

## 3 · README.md — already rewritten

See the tree; the hero block is now logo + positioning tagline + badges
row + nav + comparison table + six-line code sample. Review it against
this list before pushing:

- [x] Picture-swap logo at the top (light / dark).
- [x] One-sentence positioning: **"A layout linter for translated UI.
      Verified against Chromium, WebKit, and Firefox."**
- [x] Badges: version, test count, cross-engine agreement, bundle size,
      TypeScript, license.
- [x] Nav row pointing at How it works · What it does · How we know it
      works · Self-review · Roadmap.
- [x] Comparison table vs Chromatic / Percy / Happo / Playwright-visual /
      storybook-test-runner, with three "—" cells on prelight's side
      (honest positioning, not triumphalism).
- [x] Six-line visceral code sample near the top (the `[PASS] … [FAIL]`
      block followed by the `expect({ … }).toLayout({ … })` matcher).
- [x] "How we know it works" section pointing at FINDINGS + REVIEW-v0.3.0.
- [x] Install block states that npm publish is v0.4 scope — no pretending.

---

## 4 · site/ — landing page

`site/index.html` was written before v0.3 and has stale numbers:

| Location | Claim | Truth (v0.3) |
| --- | --- | --- |
| `.stats .stat` block | `0.024 ms/cell` | Still roughly true, but reclaim the right source — `demos/speed-comparison/`. |
| `.stats .stat` block | `23×` faster than Playwright | Still true in `demos/speed-comparison/`. |
| `.stats .stat` block | `97.9% + non-emoji corpus agreement` | Stale; actual 98.81 % / 99.03 % / 98.60 % overall, emoji 99.75 %. |
| `What makes this possible` | `94.5% / 94.7% / 94.3% overall` | Stale. Replace with 98.81 / 99.03 / 98.60. |
| `What makes this possible` | `emoji sits at 90%` | Very stale. Replace with emoji 99.75 %. |

The site-page edit is staged in the same commit as this PUBLISH.md — see
the diff.

---

## 5 · Pre-push audit (do these before `git push`)

- [ ] `git status` shows only: `brand/*.svg`, `brand/README.md`,
      `README.md` (modified), `PUBLISH.md`, `REVIEW-v0.3.0.md`,
      `site/index.html` (modified). Plus the pre-approved `package.json`
      + `bun.lock` changes from the review session.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes (440 tests).
- [ ] `bun run measure-bundle:strict` passes.
- [ ] `bun run ground-truth:strict -- --browser all` passes.
- [ ] README renders correctly on GitHub preview — check the
      `<picture>` swap by toggling GitHub's theme in the bottom-right
      profile menu.
- [ ] Social-preview PNG exists at `brand/social-preview.png` (or uploaded
      to GitHub Settings directly).

## 6 · Physical publish sequence

Ordered. Do not reorder without a reason.

1. **Create the remote.** `gh repo create <owner>/prelight --public
   --source . --remote origin --description "$(cat PUBLISH.md | …)"`.
   (Use the Description string from §1 above.)
2. **Push `main`.** `git push -u origin main`.
3. **Push the tag.** `git push origin v0.3.0`.
4. **Create the Release.** `gh release create v0.3.0 --title "…"
   --notes-file -` with the body from §2 above.
5. **Upload the social preview.** Manual step in Settings → Options →
   Social preview. (Automatable via `gh api` if you want.)
6. **Set Topics.** `gh api -X PUT /repos/<owner>/prelight/topics -f
   'names[]=…'` for each of the 14 topics in §1.
7. **Turn on GitHub Pages.** Settings → Pages → source = `main` / `/site`.
8. **Turn on Discussions + Issues, turn off Wiki + Projects** (§1).
9. **Set branch protection on `main`** (§1).

## 7 · Launch-day (T + 0)

- [ ] Cross-post on Bluesky + X with:
  - The social-preview image
  - The tagline
  - One link (prefer the site, fall back to the repo)
  - One hook line: *"You don't need a browser to know a button will
    overflow. You need the font metrics and an arithmetic model of line
    breaking."* — (this is already in the README)
- [ ] Post on Lobsters. Tag: `show` + `javascript` + `testing`. Title:
      *"prelight: a layout linter for translated UI, DOM-free, verified
      against three browsers"*. Body: 3 sentences, link to repo.
- [ ] **Do not post on HN on day 0.** HN rewards the "how we built it"
      post, not the "here's a library" post. Write that first (see day 2).

## 8 · Day + 1

- [ ] r/reactjs and r/javascript, with a short post. Same title as
      Lobsters. Body linked to `demos/failing-german-button/` (a concrete
      demo is more welcome than a pitch).
- [ ] If any i18n-focused Slack / Discord you're in has an off-topic /
      projects channel, post there. Not the main channel. Linkers hate
      "look at my library" posts in a main channel.

## 9 · Day + 2 — the write-up that earns HN

A blog post titled something like:

> **"How we verified a DOM-free layout library against three browsers"**
>
> The hard part of prelight wasn't writing the verifier; it was
> convincing ourselves it was correct. Here's the 928-case ground-truth
> harness, the per-engine floors, the places we agreed, and the 18 cases
> on Firefox we still don't.

Structure:

1. Why snapshot testing doesn't catch the bug.
2. Why *rendering* isn't the expensive part — font-engine access is
   cheap. (Set up the thesis.)
3. How the ground-truth harness was designed. Per-corpus-case parallel
   invocation of Playwright on Chromium / WebKit / Firefox, ±1 px
   tolerance, exact line-count match.
4. The emoji problem (Noto-COLRv1 subset, GSUB closure, ligature glyphs).
5. One screenshot of a disagreement and what resolving it taught us.
6. Where prelight is wrong today (quote REVIEW-v0.3.0.md C1 + I2).

Link that post to HN. Title: *"Show HN: Prelight — a layout linter
verified against three browsers on a 928-case corpus"*. That is the post
HN will upvote, not a bare library link.

## 10 · What I am **not** silently fixing before the push

The v0.3.0 review found a few drift-type issues in the governance docs.
They're flagged but not being quietly patched during this publish prep,
because the evidence invariant forbids drive-by edits:

- `AGENTS.md` cites 395 tests; reality is 440. Fix in a follow-up PR
  titled *"docs: refresh test counts in AGENTS.md"*.
- `CHANGELOG.md` H7 bundle-growth line mixes measured-vs-measured with
  measured-vs-budget deltas. Fix in a follow-up PR titled *"docs:
  normalise bundle-growth reporting to measured-vs-measured"*.
- `ROADMAP.md` still refers to `v0.3.0-rc.1` as current. Fix in a
  follow-up PR titled *"docs: advance ROADMAP status to v0.3.0"*.

Doing these as separate PRs makes the git log tell the truth about when
each doc caught up to reality. A clean launch commit is better than a
busy one.

---

Maintainer: if you want me to execute §6 automatically once you've pushed,
say the word and I'll drive the `gh` commands. Everything above the line
is committable as is.
