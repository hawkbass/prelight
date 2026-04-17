# DECISIONS

ADR-lite log. Append-only except to add supersession notes.

Each entry: one small decision, the alternatives considered, why we went
this way, what invalidates it.

---

## 001 — Bun workspaces as the dev-time package manager

**Date**: 2026-04-16
**Status**: Accepted
**Alternatives**: pnpm workspaces, npm workspaces, Yarn Berry.
**Decision**: Bun workspaces.
**Rationale**: Pretext — the dependency we're layering on — was developed
with Bun. Matching the upstream runtime reduces surprise. Bun handles TS,
JSX, and ESM natively, which the CLI config loader relies on. Faster
install times on clean CI.
**Invalidation**: If Bun on Windows develops severe workspace issues not
present on macOS/Linux, we reassess. Mitigation: every CI matrix run
includes Windows.

---

## 002 — Defer git init until scaffold is clean

**Date**: 2026-04-16
**Status**: Accepted
**Decision**: No git repo until the scaffold is complete and at least one
green test run. We commit once, with a meaningful initial tree, not a
series of "add this file" commits.
**Invalidation**: When the user is ready to initialize git, we run
`git init && git add . && git commit -m "Initial scaffold"`.

---

## 003 — `@prelight/*` npm scope, `prelight` on GitHub

**Date**: 2026-04-16
**Status**: Pending verification
**Decision**: Publish packages as `@prelight/core`, `@prelight/react`,
`@prelight/vitest`, `@prelight/jest`, `@prelight/cli`. GitHub org
`github.com/prelight`.
**Fallback**: If `@prelight` is taken on npm, use `@prelight-text/*`. If
`github.com/prelight` is taken, use `github.com/prelight-dev`.
**Verification**: Run `npm view @prelight` and check GitHub before v0.1.0.

---

## 004 — Vitest as primary test runner

**Date**: 2026-04-16
**Status**: Accepted
**Alternatives**: Bun's native test runner, Jest.
**Decision**: Vitest is the first-class adapter; Jest is supported as a
mirror; Bun test is NOT a supported runtime target in v0.1.
**Rationale**: Vitest's `expect.extend` API is the clearest, the ESM story
is settled, and async setup (`setupFiles` or top-level await) is reliable.
**Invalidation**: If Bun test matures to parity with Vitest on
`expect.extend`, add a Bun adapter.

---

## 005 — Pretext as a hard dependency, not a fork

**Date**: 2026-04-16
**Status**: Accepted
**Decision**: `@chenglou/pretext` is a production dependency of
`@prelight/core`. We do not fork, vendor, or embed.
**Rationale**: Pretext is actively maintained by Cheng Lou; his work is
the right layer for font-engine measurement. Prelight's contribution is
the verifier layer above. Diverging from upstream creates a support burden
we cannot justify.
**Invalidation**: If Pretext stops being maintained, we reconsider a soft
fork under `@prelight/pretext-fork`.

---

## 006 — TypeScript-only source

**Date**: 2026-04-16
**Status**: Accepted
**Decision**: All source under `packages/*/src` is `.ts`/`.tsx`. No JS.
**Rationale**: Downstream consumers may be JS — that's fine, they import
the compiled `dist/`. Our source stays typed end-to-end.

---

## 007 — Enforced forward-annotation markers

**Date**: 2026-04-16
**Status**: Accepted
**Decision**: Every deferred path must carry an inline marker in code or
prose:
  - `PRELIGHT-NEXT(v0.1-phase{A,B,C,D})` — within this release
  - `PRELIGHT-NEXT(v0.2)` / `(v1.0)` / `(v2.0)` — future releases
  - `PRELIGHT-FLAG` — known trade-off worth surfacing in review
  - `PRELIGHT-INVARIANT` — property a reviewer must preserve
**Rationale**: Decisions rot. Markers anchor them to source. ROADMAP.md
aggregates what each marker means.
**Invalidation**: If automated tooling lands for roadmap linking, markers
may migrate into a structured format.

---

## 008 — Ground-truth harness is a release gate

**Date**: 2026-04-16 (amended 2026-04-16 for Phase F cross-engine sweep,
re-amended 2026-04-16 after F2 Arabic RTL + F3 CJK kinsoku corrections,
corpus re-scoped 2026-04-16 for F6 emoji stress expansion, emoji
floors re-raised 2026-04-17 after H6c bundled emoji harness font)
**Status**: Accepted
**Decision**: Every release candidate must measure the corpus against
**Chromium, WebKit, and Firefox** via `ground-truth/run.ts --browser all`
and publish the per-engine × per-language agreement numbers in
`FINDINGS.md`. v0.1.x ships with the following floors, calibrated ~1-2
points below measured:

### Chromium (measured 94.50% on 928-case corpus, floor 93%)

| Language        | Floor | Measured (2026-04-16 F6) | Rationale                                    |
| --------------- | ----- | ------------------------ | -------------------------------------------- |
| en              | 97%   | 99.0% (95/96)            | Latin; one email-address soft-break edge     |
| de              | 98%   | 99.1% (111/112)          | Latin + long compound words                  |
| compound-words  | 95%   | 97.9% (47/48)            | Synthetic compounds; one Pretext edge        |
| emoji           | 98%   | 99.8% (407/408)          | H6c: Noto Emoji subset + per-grapheme split  |
| zh              | 96%   | 98.8% (79/80)            | F3 CJK shim + Noto Sans SC subset in harness |
| ja              | 93%   | 95.5% (84/88)            | F3 CJK shim + Noto Sans JP subset in harness |
| ar              | 95%   | 97.9% (94/96)            | F2 RTL correction shim + Noto Sans Arabic    |

### WebKit (measured 94.72% on 928-case corpus, floor 93%)

| Language        | Floor | Measured (2026-04-16 F6) | Rationale                                     |
| --------------- | ----- | ------------------------ | --------------------------------------------- |
| en              | 97%   | 99.0%                    | Same single URL edge as Chromium              |
| de              | 98%   | 100.0%                   | Perfect on Latin long-compounds               |
| compound-words  | 95%   | 97.9%                    | Same single Pretext edge                      |
| emoji           | 98%   | 99.8% (407/408)          | H6c: Noto Emoji subset + per-grapheme split   |
| zh              | 95%   | 97.5% (78/80)            | Matches Chromium post-F3 within noise         |
| ja              | 95%   | 97.7% (86/88)            | Best engine on kinsoku — matches shim output  |
| ar              | 95%   | 97.9%                    | Identical to Chromium after F2 RTL correction |

### Firefox (measured 94.29% on 928-case corpus, floor 93%)

| Language        | Floor | Measured (2026-04-16 F6) | Rationale                                                |
| --------------- | ----- | ------------------------ | -------------------------------------------------------- |
| en              | 93%   | 95.8%                    | Different URL wrap points for `https://` (PRELIGHT-FLAG) |
| de              | 97%   | 99.1%                    | Same single long-compound edge                           |
| compound-words  | 95%   | 97.9%                    | Same single Pretext edge                                 |
| emoji           | 98%   | 99.8% (407/408)          | H6c: Noto Emoji subset + per-grapheme split              |
| zh              | 96%   | 98.8% (79/80)            | Matches Chromium                                         |
| ja              | 94%   | 96.6% (85/88)            | One more kinsoku-boundary edge than WebKit               |
| ar              | 95%   | 97.9%                    | Matches Chromium/WebKit after F2 RTL correction          |

Overall floor: **93%** per engine. Post-H6c measured overall sits at
98.28% chromium / 99.03% webkit / 98.60% firefox on the 928-case corpus.

Any regression below a per-engine per-language floor blocks release.

**Rationale**: Prelight's value is correctness relative to the browser.
We have to prove it *and publish the shape of the error*, not claim it.
Pretending 100% agreement when the real number is 98%+ would be worse
than publishing the gap, because real users would hit the gap and
(correctly) lose trust.
**Invalidation**: Bundling a larger emoji / CJK corpus (F6) or tightening
tolerance to ±1px (F4) will move these numbers. Recalibrate when that
lands. Upstream Pretext absorbing the RTL + CJK shims would push the
overall number toward 99%+. Tracked as `PRELIGHT-NEXT(v1.0)` in
`ground-truth/harness.ts`.

---

## 009 — Canvas polyfill via `@napi-rs/canvas` (global shim)

**Date**: 2026-04-16
**Status**: Accepted
**Context**: `@chenglou/pretext` calls `new OffscreenCanvas(1,1).getContext('2d')`
for font measurement. Neither Node nor Bun provides `OffscreenCanvas`.
**Alternatives**:
  1. Run tests inside headless Chromium (defeats the thesis).
  2. Fork Pretext to accept an injected measurer (invasive, creates drift).
  3. Polyfill `globalThis.OffscreenCanvas` with a native canvas binding.
**Decision**: Option 3, via `@napi-rs/canvas`.
**Why @napi-rs/canvas over `canvas`**: Pre-built binaries for macOS/Linux/
Windows on x64 and arm64, no build-from-source fallback, maintained by
Napi-rs, Skia under the hood (matches browsers' Skia more closely than
Cairo).
**Trade-off**: We mutate `globalThis` at bootstrap. This is a side effect,
which we surface with a `PRELIGHT-FLAG` in `font.ts`. Browser builds
short-circuit the installer because native `OffscreenCanvas` exists.
**Invalidation**: If Node ships native `OffscreenCanvas`, or if Pretext
adds a pluggable measurer, the shim goes away.

---

## 010 — Config files are `.tsx`, not `.ts`, when they contain JSX

**Date**: 2026-04-16
**Status**: Accepted
**Context**: `prelight.config.ts` with JSX fails to parse under Bun's TS
loader — Bun requires the `.tsx` extension to enable JSX.
**Decision**: `findConfig()` searches for `.tsx` first, then `.ts`.
Documentation recommends `.tsx` whenever a config embeds component factories.
**Invalidation**: If Bun's loader gains implicit JSX in `.ts`, the
preference could flip back to `.ts`.

---

## 011 — Canvas shim install is async; `verify()` is sync-after-bootstrap

**Date**: 2026-04-16
**Status**: Accepted
**Decision**: `ensureCanvasEnv()` is async; consumers await it once at
startup (Vitest setup file, Jest setup, CLI main). `verify()` itself is
synchronous and throws a directive error if called before the env is ready.
**Rationale**: Synchronous matchers are what test authors expect. The cost
is a one-liner at setup, which adapters absorb.

---

## 012 — Ground-truth launches Chromium over WebSocket CDP, not pipe

**Date**: 2026-04-16
**Status**: Accepted
**Context**: Playwright 1.50+ defaults to pipe-based CDP transport
(`--remote-debugging-pipe`). On some Windows machines (notably ones
running Defender with real-time protection on the user profile),
Chromium boots successfully and prints `DevTools listening on ws://...`
to stderr, but Playwright's `launch()` call never completes the
handshake. The symptom is a 30–60s timeout with a pinned chrome process.
**Alternatives**:
  1. Ship the harness as WSL/Docker-only. Reduces local dev-loop speed.
  2. Skip Windows entirely for ground-truth runs. Sets a bad precedent
     ("the evidence harness doesn't run on the maintainer's machine").
  3. Spawn Chromium ourselves, parse the WS URL from stderr, connect via
     `chromium.connectOverCDP(wsUrl)`.
**Decision**: Option 3. Implemented as `launchChromiumViaCDP()` in
`ground-truth/harness.ts`. We still use Playwright for all the page-level
APIs after connection; we only replace the launcher.
**Rationale**: The harness is supposed to be an independent oracle. If
the oracle fails to boot on common developer hardware, nobody runs it,
and the evidence stops being reproduced. A 30-line shim is cheap compared
to that.
**Invalidation**: If Playwright gains a documented WebSocket-CDP launch
mode, or if the pipe transport stops interacting badly with Windows
antivirus, we revert to `chromium.launch()`.

---

## 013 — Run the ground-truth harness under `tsx` (Node), not Bun

**Date**: 2026-04-16
**Status**: Accepted
**Context**: Under Bun on Windows, `WebSocket` connections to Chromium's
`ws://127.0.0.1:NNN/devtools/browser/...` endpoint time out during
Playwright's `connectOverCDP` even though the same URL connects instantly
from Node's built-in `WebSocket`. Root cause lives somewhere between
Bun's WS client and Playwright's expectations; not worth debugging when
an alternative exists.
**Decision**: Ground-truth executes via `tsx` on Node. `@prelight/core`
and all adapters still build and test under Bun; only the ground-truth
harness is Node-run. This scope limits the Bun-vs-Node surface area to
a single directory.
**Invalidation**: When Bun's WS client handles Playwright's `connectOverCDP`
reliably on Windows, the package.json scripts can switch back to
`bun run.ts`.

---

## 014 — Bundle sizes are a declared, CI-enforced budget

**Date**: 2026-04-16
**Status**: Accepted
**Context**: Prelight's pitch is "16 KB, zero-runtime, replaces a browser".
That claim only holds if the shipped size stays where it is. Accidental
bloat — a lazy dependency, a dead-code import, a JSON blob committed to
`src/` — can grow a package by orders of magnitude before anyone notices.
**Decision**: `scripts/measure-bundle.ts` bundles every public package
with Bun (minified, gzipped, runtime peers externalised) and compares to
a committed budget at `scripts/bundle-budget.json`. CI runs
`bun run measure-bundle:strict` after `test` and fails the build on any
regression past the budget.
**Initial budgets (with growth headroom)**: core 8 KB min / 3.5 KB gz;
react / vitest / jest 2 KB / 1 KB each; cli 6 KB / 2.5 KB.
Current measured: core 6.20 KB / 2.61 KB, react 924 B / 510 B,
vitest 951 B / 538 B, jest 1.07 KB / 630 B, cli 4.11 KB / 1.82 KB.
Total shipped: **13.2 KB min / 6.1 KB gz**.
**Rationale**: Growth should be an explicit, reviewed decision, not an
accident. If a PR intentionally grows the budget, the author runs
`bun run measure-bundle:update` in the same PR — the budget diff shows
up in review.
**Invalidation**: If we add a feature that genuinely needs more bytes
(e.g. ICU-based line breaking), the budget moves up; the policy stays
the same.

---

## 015 — A single "ubuntu-full" workflow is the release-candidate gate

**Date**: 2026-04-16
**Status**: Accepted
**Context**: After Phase F, the bill of goods a Prelight release needs
is: typecheck, build, tests on every package, bundle budget,
ground-truth (all three engines, strict), and the 23× speedup
benchmark. Those signals live in four different scripts and two
different workflows (`ci.yml`, `ground-truth.yml`). Reading "is main
releasable?" meant reading three workflow statuses and correlating.
**Decision**: Add a third workflow, `.github/workflows/ubuntu-full.yml`,
that runs every one of those signals sequentially on a single Ubuntu
runner. It fires on push-to-main, weekly (Monday 06:00 UTC), and via
`workflow_dispatch`. It is the explicit release-candidate gate for F7
and every future `v0.N-rc` tag.
**Why Ubuntu only, not the full matrix**: `ci.yml` already covers
Linux/macOS/Windows for the cheap signals. The expensive ones
(Playwright browser install, three-engine ground-truth, speedup
benchmark) only need one host — publishing "Prelight's claims hold on a
representative Linux runner" is evidentially sufficient. Windows gets
separate, local coverage through `DECISIONS.md` §012 (spawn + CDP) and
manual pre-release runs.
**Why not one combined workflow replacing `ci.yml` + `ground-truth.yml`**:
those two are on fast PR-loop triggers (2-4 minutes) and give
actionable feedback during review. Merging them with the 20-minute
`ubuntu-full` would slow every PR for no benefit.
**Invalidation**: When GitHub Actions starts charging substantially
more for the duplication, or when a single unified workflow becomes
faster than three smaller ones, we collapse them.

---

## 016 — Bundle budget for `@prelight/core` moved to 11 KB min / 4.75 KB gz

**Date**: 2026-04-16
**Status**: Accepted
**Context**: F2 added the Arabic RTL correction shim
(`packages/core/src/shape/rtl.ts`, ~2.7 KB source); F3 added the CJK
kinsoku correction shim (`packages/core/src/shape/cjk.ts`, ~3.0 KB
source). Together they take `@prelight/core` from 7.4 KB min / 3.2 KB
gz at end-of-Phase-E to **9.38 KB min / 3.98 KB gz**. The original
8 KB / 3.5 KB budget rejected the legitimate growth.
**Decision**: Lift the `@prelight/core` budget to **11 KB min / 4.75 KB
gz**. Every other package holds flat. The ceiling is sized to absorb
the correction shims plus ~1.5 KB of headroom for minifier drift, not
to invite further growth. `@prelight/core` remains well under the
"15 KB total library" benchmark set by Pretext itself; total shipped
across all five packages is now **~16.4 KB min / 7.5 KB gz**, with the
react/vitest/jest/cli packages still sitting at a combined ~7.0 KB min.
**Why not split the correction shims into an opt-in subpath**: the
shims apply monotonicity guards (never increase line count, return
input unchanged on non-matching script), so they are safe to always
run and are the primary reason the cross-engine ground-truth sits at
97-98% non-emoji. Making them opt-in would mean the default Prelight
install ships with worse agreement — a worse DX, and a harder claim
to verify in `measure-bundle` / `ground-truth`.
**Invalidation**: when a v0.2 layout engine (flex, block, image)
pushes past 11 KB min, budget gets revisited under DECISIONS #014's
review cadence, not silently bumped. Phase G8 is the next planned
deliberate increase (14 KB min / 6 KB gz per the plan).

---

## 017 — Structural primitives live in `@prelight/core`, not a subpackage

**Date**: 2026-04-16
**Status**: Accepted
**Context**: G2-G5 add box model + flex + block + aspect primitives
to Prelight. The natural alternative was a separate
`@prelight/layout` package so users who only want text verification
never pay for the structural surface.
**Decision**: Ship them in `@prelight/core` under
`packages/core/src/layout/{box,flex,block,aspect}.ts`, re-exported
from the package root.
**Rationale**:

1. **One predicate API.** `verify()` and the new `fitsFlex` /
   `fitsBlock` / `fitsAspect` return the same shape
   (`{ ok, reasons|failures, layout? }`). Splitting them across
   packages means the Vitest / Jest / CLI surfaces need to import
   from two places, and user docs need to explain which package a
   given matcher comes from.
2. **Tree-shakability wins it back.** The layout modules are pure
   `export` functions with no module-level side effects.
   `measure-bundle.ts` sweeps prove the cost is real only for
   callers that actually import them: core grew from 6.20 KB to
   16.79 KB min / 2.61 KB to 6.63 KB gz, but the minimum user-
   surface cost (`verify` alone) is effectively unchanged once a
   bundler strips unused exports.
3. **No versioning drift.** A `@prelight/layout` package would
   need its own release cadence, its own CHANGELOG, its own
   `peerDependencies` on `@prelight/core`. For a 3 KB engine, the
   overhead dwarfs the benefit.

**Invalidation**: if we later learn the common case is a bundler
that doesn't tree-shake (browser `<script type=module>` direct
imports, say), we split `@prelight/core-text` vs
`@prelight/core-layout` without changing the public API — consumers
just import from different entry points. Public type names are
already split by file, so this is a mechanical move.

---

## 018 — CLI reporter colouring is one file, zero deps

**Date**: 2026-04-16
**Status**: Accepted
**Context**: G7 adds TTY-aware colouring to the terminal reporter.
Three realistic options: (a) take a dependency on
[`picocolors`](https://github.com/alexeyraspopov/picocolors), (b)
take a dependency on [`chalk`](https://github.com/chalk/chalk), or
(c) write the decision table ourselves.
**Decision**: Write it ourselves in
`packages/cli/src/color.ts` (~120 lines, 2 palettes, 1 decision
table) and keep the CLI at **zero production dependencies** except
for its workspace siblings.
**Rationale**:

1. **Budget.** `picocolors` ships ~1.1 KB min / 550 B gz; `chalk@5`
   ships ~5 KB min. The CLI's entire G7 addition is ~420 B gz. We
   pay less than a single dep would have cost.
2. **Exactness.** `NO_COLOR`, `FORCE_COLOR`, `FORCE_COLOR=0` have
   specific precedence rules we want to test by the table, not by
   whatever library version is resolved. Owning the file means the
   precedence is a unit test, not a version bump away from
   breaking.
3. **Policy.** Prelight's thesis is that fast, DOM-free measurement
   gets us back under-budget where other tooling has bloated. If
   the CLI starts adding 2 KB deps for colouring, the thesis
   erodes.

**Invalidation**: if we ever need 256-colour / truecolour output,
a live-TTY spinner, or Windows-specific stream detection beyond
`isTTY`, the complexity crosses the threshold where
`picocolors` (still dep-free itself) becomes the honest choice.
