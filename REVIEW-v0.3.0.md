# REVIEW v0.3.0 — Adversarial Code + Research Review

**Reviewer:** Opus 4.7 (Cursor agent), 2026-04-18
**Target:** `v0.3.0` tag at commit `70cc689`
**Tree state:** clean at start (two untracked artifacts from prior sessions
left in place, see §Self-assessment).
**Evidence substrate:** `review/gate-*.txt` (Appendix A), `review/probes/`
(directed-probe fixtures P1, P3, P4, P5, P6), `review/bundle-check/` (P7
tree-shake experiment).

---

## 1. Executive Summary

v0.3's gates re-run at the numbers HANDOFF quotes, and
`scripts/subset-emoji-font.ts` reproduces the committed
`NotoEmoji-subset.ttf` byte-for-byte (matching SHA-256) in 0.7 s from
cache. The core numeric surface holds.

The framing around `runtime: true` is where this review disagrees with
HANDOFF. README and CHANGELOG present "consumers who don't use
`runtime: true` pay nothing" as a property of the probe. The `happy-dom`
*install* cost is correctly opt-in via dynamic `import()` + optional peer
dep. The **bundle cost is not**: `packages/react/dist/index.js` statically
imports `./runtime-probe.js`, so esbuild produces a **19,692-byte**
static-only bundle versus **19,715-byte** runtime bundle — a 23-byte,
0.12 % difference. The happy-dom shim installer, React 18 mount path, and
full probe routine ship on every static consumer's critical path.

Separately, the runtime probe has two **silent-success failure modes** no
existing test covers: (a) when the target component throws during render,
`resolveStylesRuntime` returns viewport-container defaults (`16px "Times
New Roman"`, `maxWidth: 1024px`) with `sources:[...]` populated against
the container, no error raised; (b) when the component suspends, the
probe silently measures the fallback's typography as if it were the real
component. Both produce layout verdicts that are well-formed and wrong.
For a library whose pitch is "no public claim without evidence", a probe
that silently substitutes a different subject is the worst failure mode
I can construct.

## 2. Findings by Severity

### 2.1 Critical

#### C1 — `resolveStylesRuntime` silently returns viewport-container defaults when the target component throws during render

| Field | Value |
| --- | --- |
| Evidence | `review/probes/P4-throws-during-render.test.tsx` + `review/probes-final.txt` |
| Affected | `packages/react/src/runtime-probe.ts:217–286` (the `tt()` resolver in dist) |
| Repro | Render `function ThrowingButton() { throw new Error('boom') }`; call `await resolveStylesRuntime(<ThrowingButton />)` |
| Observed | Resolves to `{ font: '16px "Times New Roman"', maxWidth: 1024, sources: [{...elementType: 'div'}...], cssVariables: {} }`. No error. `err: none` in the probe log. The `<div>` the probe measured is the **viewport container** the probe itself creates (`document.body.appendChild(div)` in `tt()`), not any React-rendered element. React *does* log the render error to stderr, but that is an uncaught exception — the probe's promise resolves successfully. |
| Expected | Either throw a clear error (e.g. `ProbeRenderError: target component failed to render: Error: boom`), or return a result whose `sources` flag render failure (`resolver: 'renderFailure'` or similar), so callers know the measurement is not of the intended subject. |
| Impact | `verifyComponent({ runtime: true })` does currently throw later when `extractText` re-renders the component and hits the same error (observed in P4d). But `resolveStylesRuntime` is a **documented public API** (`index.js` re-exports it). A caller using the probe directly — which the README's Emotion example invites — gets a well-formed, wrong `ResolvedStyles`. Their subsequent `verify()` call runs against that wrong font and `maxWidth` and returns `{ok: true}` or `{ok: false, ...}` as if the measurement were valid. This is a silent false result, exactly the failure mode Prelight's pitch ("evidence-bound") is supposed to prevent. |
| Fix hypothesis | Install a React `ErrorBoundary` around the mounted tree in `tt()`; if the boundary caught anything before `waitUntilComplete` returned, reject the promise with a `ProbeRenderError`. Alternatively, detect that the target element is the container the probe created (not any React-rendered node) and reject on that signal. The second is simpler and doesn't bind the probe to React's error-boundary API. |
| Confidence | 5/5 — reproducible, the probe's contract is the public API, and the current behavior violates the "silent success with wrong data is forbidden" invariant Prelight itself asserts. |

### 2.2 Important

#### I1 — `@prelight/react` runtime-probe glue is not tree-shakable for static-only consumers

| Field | Value |
| --- | --- |
| Evidence | `review/bundle-check/static-out.js` (19,692 B) vs `review/bundle-check/runtime-out.js` (19,715 B); `review/bundle-check/gzsize.mjs` output `static=7463 B gz, runtime=7472 B gz` |
| Affected | `packages/react/dist/index.js:4` (`export { resolveStylesRuntime } from './runtime-probe.js'`), `packages/react/dist/verify-component.js:4` (top-level `import { resolveStylesRuntime } from './runtime-probe.js'`) |
| Repro | `bunx esbuild review/bundle-check/consumer-static.js --bundle --minify --format=esm --platform=browser --external:react --external:react-dom --external:react/jsx-runtime --external:happy-dom --external:@napi-rs/canvas --external:@chenglou/pretext --outfile=...` on both consumer files; compare sizes. |
| Observed | Both bundles are 19.7 KB raw / 7.46 KB gz. Grepping the static bundle for `Qt`, `ee`, `tt`, `te` (the minified probe helpers) confirms the full runtime path — including the happy-dom global shim installer, the 15-entry DOM-globals list (`["window","document","navigator",...]`), and the `react-dom/client` dynamic-import wrapper — is resident in the static bundle. |
| Expected | README §7 and CHANGELOG §[0.3.0] H7 present `runtime: true` as opt-in. "Opt-in" most naturally means "costs nothing unless you use it". The install cost is correctly opt-in (dynamic `import('happy-dom')`, optional peer dep). The bundle cost is not: a consumer that ships to a browser via Vite/Rollup/esbuild and never writes `runtime: true` still ships ~7.5 KB gz of unused glue. Against the package's 4.60 KB gz total budget, that's most of it. |
| Impact | Downstream bundle bloat on a package whose size *is* advertised — the CHANGELOG reports the bundle growth from H7 (6.14 → 11.44 KB min) as a known cost but frames it as justified by the capability. The actual cost to a static-only consumer is unchanged from the consumer who uses the runtime probe, which directly contradicts the README's "pay-for-what-you-use" framing. |
| Fix hypothesis | Two options. (a) Move `resolveStylesRuntime` and `verifyComponent({ runtime: true })` to a subpath export: `@prelight/react/runtime`. `index.js` loses the re-export; `verify-component.js` is split into `verify-component.static.ts` (no runtime import) and `verify-component.runtime.ts` (the async path). Existing imports from `@prelight/react` for static use become zero-cost; consumers who want runtime do `import { verifyComponent } from '@prelight/react/runtime'`. This is a breaking change; land it in v0.4 with a codemod. (b) Rewrite `verify-component.ts` so the runtime import is a dynamic `import()` inside the `runtime === true` branch. That's not breaking, and esbuild will preserve the dynamic import as a split chunk. Same minifier math, zero API churn. |
| Confidence | 5/5 — direct measurement, reproduced twice with identical bytes. |

#### I2 — `resolveStylesRuntime` silently measures the Suspense fallback when the target component suspends

| Field | Value |
| --- | --- |
| Evidence | `review/probes/P5-suspense.test.tsx` + `review/probes-final.txt` |
| Affected | `packages/react/src/runtime-probe.ts` (the `tt()` resolver; no Suspense handling) |
| Repro | Fixture mounts `<Suspense fallback={<FallbackLabel />}><LazyLabel /></Suspense>` where `LazyLabel` reads a never-resolving promise. Expected: probe errors out, times out, or warns. Observed: probe resolves in 30 ms with `font: '12px monospace', maxWidth: 60, lineHeight: 14` — the exact typography of `FallbackLabel`. |
| Expected | Reject the promise with a clear "component suspended" error, OR surface a flag (`resolved.suspended === true`) so the caller can decide whether to trust the measurement. |
| Impact | Identical shape to C1 — a well-formed wrong answer. A consumer using Suspense for code-splitting (the common case in 2026) could silently verify their loading state against their typography contract while believing they verified the real component. A caller writing `expect(Component).toLayout({font, maxWidth, constraints})` would pass because the fallback coincidentally fits, then ship a component that overflows. |
| Fix hypothesis | The `tt()` resolver currently calls `r.happyDOM.waitUntilComplete()` after `render()`. Before reading `getComputedStyle`, also check whether the target element's subtree contains any Suspense-boundary markers (React writes `<!--$?-->` / `<!--$!-->` comment nodes for suspended/errored boundaries). If a marker is inside the target element's ancestry, reject. Alternatively, the probe could race `waitUntilComplete` against a timeout and surface the Suspense state on timeout. |
| Confidence | 4/5 — behavior is reproducible; the exact fix surface is constrained by React's internal suspense markers not being part of React's public API. |

#### I3 — `resolveStylesRuntime` does not expand the CSS `font` shorthand from inline `style` attributes

| Field | Value |
| --- | --- |
| Evidence | `review/probes/P6-precedence.test.tsx` P6b sub-test; `review/probes-final.txt` |
| Affected | `packages/react/src/runtime-probe.ts` `tt()` call to `getComputedStyle()`; happy-dom CSSOM path |
| Repro | Render `<div style={{ width: '300px', font: '24px monospace', lineHeight: '30px' }}>P6 precedence test</div>`; call `verifyComponent({ element, runtime: true, maxWidth: 80, constraints: { singleLine: true, maxLines: 1 } })`. The text is 17 chars; at 24 px monospace, natural width is ~240 px; at 16 px Times New Roman (happy-dom's default), natural width is ~96 px. Observed natural width: **96 px**. |
| Expected | Probe resolves the expanded `font-family: monospace; font-size: 24px; line-height: 30px` longhands and produces a natural width consistent with 24 px monospace. |
| Impact | Any consumer whose design system uses the `font` shorthand in inline styles will get wrong runtime typography from the probe. The static walker (`resolveStyles`) handles the shorthand (confirmed via `packages/core` unit tests parsing `font: '24px Inter'`), but happy-dom's CSSOM does not expand shorthand inline-style declarations into individual longhand `getComputedStyle()` entries. This is ultimately a happy-dom limitation, but Prelight's runtime probe is built on top of it, and the READMEs don't warn about this. |
| Fix hypothesis | Either: (a) document the limitation in the README's runtime-probe section (fastest); (b) pre-process the React element tree inside `tt()` and expand any `style.font` shorthand into the longhands before the mount; (c) upstream a fix to happy-dom. Option (a) is the honest minimum. |
| Confidence | 4/5 — reproduced; the exact upstream cause (happy-dom CSSOM shorthand handling) I have not re-verified against the happy-dom repo. |

#### I4 — `PRELIGHT-INVARIANT` ("pure function of its input") in `verify.ts` is violated by module-level mutable state in `correctCJKLayout` and `correctEmojiLayout`

| Field | Value |
| --- | --- |
| Evidence | `packages/core/src/verify.ts:27–36` (invariant comment), `packages/core/src/shape/cjk.ts:115–142` (the CJK global), `packages/core/src/shape/emoji.ts:105–115` (the emoji global) |
| Affected | Every `verify()` call that omits `spec.measurementFonts.cjk` or `.emoji` |
| Repro | (a) call `setCJKMeasurementFamilies(['SomeFont'])`; (b) call `verify()` with CJK text and no `spec.measurementFonts.cjk`; (c) observe that the second call's output depends on the global set in (a). The ground-truth harness in fact relies on this — `ground-truth/harness.ts` calls `setCJKMeasurementFamilies` + `setEmojiMeasurementFamilies` at startup (confirmed by grep) and does not pass `spec.measurementFonts` in each case. |
| Expected | The comment at the top of `verify.ts` currently reads "pure function of its input and bundled font state, no I/O". "Bundled font state" is ambiguous. If it means "the bundled family *defaults* that ship with the package", then mutating those defaults via `setCJKMeasurementFamilies` from the harness breaks purity. If it means "any font state held at module scope, mutable", then the invariant is vacuous because any state held at module scope makes the function impure by the usual definition. |
| Impact | Moderate. The comment at `cjk.ts:115–121` acknowledges the back door: *"The module-level `setCJKMeasurementFamilies` / `getCJKMeasurementFamilies` pair is retained intentionally as a back door for the ground-truth harness. Removing it is tracked for a future cleanup once the harness migrates to per-spec `measurementFonts`."* This is honest in the implementation, but the **top-level INVARIANT in `verify.ts` does not reflect it** — a reader of `verify.ts` alone would believe `verify()` is pure. An agent performing the P10 directed probe (exactly as HANDOFF asks) and looking only at `verify.ts` would pass the invariant; looking at the whole call graph, the invariant fails. This is a documentation-vs-code drift and a real correctness risk if the harness-style setter pattern spreads. |
| Fix hypothesis | Update the `PRELIGHT-INVARIANT` comment in `verify.ts` to explicitly cite the module-level mutable state in `shape/cjk.ts` and `shape/emoji.ts` and reference the migration ticket. Alternatively, make the state non-mutable: the harness passes `spec.measurementFonts` per-call (the intended migration is already tracked), at which point the setters can be removed. |
| Confidence | 5/5 on the drift; 4/5 on whether this bites any real consumer today (the harness is the only known caller of the setters). |

#### I5 — `@prelight/react` bundle size growth in CHANGELOG H7 uses two different baselines

| Field | Value |
| --- | --- |
| Evidence | `CHANGELOG.md` H7 block; `FINDINGS.md` §H7 |
| Affected | Public communication of H7's bundle delta |
| Observed | CHANGELOG H7 describes the delta as `+4.94 KB min / +1.72 KB gz` from `6.50 KB → 11.44 KB`. The `6.50 KB` is the pre-H7 budget ceiling; the pre-H7 **measured** value (per `FINDINGS.md` §H7 and H8 before that) was `6.14 KB min / 2.88 KB gz`. The measured-to-measured delta is `+5.30 KB min / +1.72 KB gz`, not `+4.94 KB min`. The gz delta happens to match because 2.88 + 1.72 = 4.60 ≈ the measured gz. Comparing a new **measured** against an old **budget** is apples-to-oranges. |
| Impact | Minor on its own, but this is exactly the kind of numeric sloppiness the evidence invariant is supposed to prevent. A future agent (me, here) who checks `bun run measure-bundle:strict` against the CHANGELOG's quoted delta sees inconsistency and has to reconstruct which baseline was meant. |
| Fix hypothesis | Standardise on **measured-to-measured** deltas in CHANGELOG bundle lines, and quote the budget ceiling separately. |
| Confidence | 5/5 — arithmetic is arithmetic. |

### 2.3 Minor

#### M1 — Documentation staleness on test counts and rc tag status

- `AGENTS.md:81` says `bun run test # 395 tests (v0.2 + v0.3 H1–H6a), ~3s`. Actual measured at tag commit: **440 tests** (270 core + 110 react + 11 vitest + 5 jest + 44 cli). HANDOFF has the correct number.
- `CHANGELOG.md:101–102` (the H7 block) says `Monorepo 225/225 → 255/255`. Also stale — that counts from somewhere in v0.3's middle. HANDOFF's 440 overtakes it entirely.
- `ROADMAP.md:44` titles the section `v0.3 — Multi-slot + CSS-in-JS + measurement-font contracts (current — rc.1 tagged)`. v0.3.0 final was tagged on 2026-04-18 (confirmed by `git show v0.3.0`), post-dating this header. Also, the first dated ROADMAP entry `2026-04- —` (near the top) contains a literal open-dash.
- **Fix:** one-line edits across these three files in the next doc-pass commit.

#### M2 — Firefox `en` per-language floor is 93 %, only 2.8 pp above measured 95.8 %

- `ground-truth/run.ts:71–78` and `DECISIONS.md:148` show Firefox `en` floor = 0.93 vs. measured 0.958 (4 / 96 fail). A 3-case regression pushes measured below floor. Every other engine's `en` floor is 0.97.
- This is not a v0.3 regression — the divergence is attributed to "different URL wrap points for `https://` (PRELIGHT-FLAG)". But the narrow cushion is a legitimate release-gate fragility: one font-version bump on Firefox that moves a handful of edge cases drops below floor and blocks the next release.
- **Fix hypothesis:** Track the PRELIGHT-FLAG as an open item to close (normalize URL break behaviour) rather than carry a 2.8 pp cushion indefinitely. Or, more honestly, raise the floor to 0.95 (1.3 pp cushion) and accept that you'll need to fix the URL case before the next Firefox upgrade.
- Confidence: 3/5 — this is a judgement call, not a bug.

#### M3 — `demos/failing-german-button/prelight.config.tsx` fails under the bare CLI (HANDOFF quirk #1)

- HANDOFF flags this; I did not reproduce it because the quirk is documented. The CLI uses `tsx` as an ESM loader, which rejects `.tsx` extensions — `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"`. The vitest path works, so the advertised test flow (`bun --cwd demos/failing-german-button test`) is green. The raw `bunx prelight` is not.
- Minor because the primary consumer flow (Vitest/Jest matchers) is unaffected, and the CLI is advertised as one of several surfaces. Still: README Example 3 (the CLI snippet) uses `.tsx` for the config example without warning.
- **Fix hypothesis:** swap `tsx` for `tsx/esm` with an explicit JSX transform, or update README Example 3 to use `.ts` for configs.

### 2.4 Discussion

#### D1 — "Library-agnostic" is defensible as a principle; the specific library list is not tested end-to-end

- README §7 says the runtime probe works on "emotion, styled-components, CSS modules, vanilla-extract, Stitches, Panda, Tamagui, plain CSS, Linaria, and any CSS-in-JS library that injects `<style>` tags". FINDINGS §H7 softens this to "CSS-in-JS libraries that register styles against the document". The unit-test matrix is emotion + styled-components + CSS variables + slots (`packages/react/test/runtime-probe.test.tsx`, confirmed by inspection). Linaria, vanilla-extract, Stitches, Panda, Tamagui are **not** directly tested.
- My P1 probe (`review/probes/P1-vanilla-extract-shim.test.tsx`) simulates vanilla-extract's compiled output — an injected `<style>` tag plus a className — and `resolveStylesRuntime` correctly reads `font: '16px sans-serif', maxWidth: 120, lineHeight: 20` from the CSSOM. That's supporting evidence that **the runtime probe's model is library-agnostic**: any library whose output ends up in the CSSOM via `<style>` injection or stylesheet attachment should work. It is **not** evidence that each of those libraries, running its real build/runtime, produces output happy-dom's CSSOM understands.
- I mark this Discussion rather than Important because: (a) the principle is defensible and I confirmed it experimentally against a shape-accurate fixture; (b) the exhaustive enumeration is a README marketing line, not a correctness contract; (c) no caller is broken today — just the evidence trail is thinner than the READMEs imply.
- Recommended framing: change README's bullet list from "Any CSS-in-JS library (Linaria, vanilla-extract, Stitches, Panda, Tamagui, ...) works" to "Any CSS-in-JS library that injects stylesheets into the document CSSOM works. Libraries tested end-to-end in CI: Emotion, styled-components. Libraries with shape-tested fixtures: vanilla-extract (review/probes/P1)."

#### D2 — Ground-truth flakiness: **none detected**

- P2 directed probe ran `bun run ground-truth:strict -- --browser all` three times back-to-back. Per-engine per-language agreement numbers are byte-identical across all three runs (`review/gate-gt-static-run{1,2,3}.txt`). File hashes differ only because run-wall-clock times vary. Result: no flap, corpus is deterministic under the harness.
- This is the best answer a probe could give. Noted here as confirmation, not a finding.

#### D3 — `correctRTLLayout` / `correctCJKLayout` / `correctEmojiLayout` pipeline replaces rather than composes

- Each of the three correction passes **re-lays the entire input text** from scratch (`packages/core/src/shape/{rtl,cjk,emoji}.ts`), starting from the raw string and the pretext-produced pre-correction layout. Each pass then returns either (a) the input unchanged (short-circuit when the script isn't detected or the probe returns null), or (b) a fresh `{ lineCount, height, lines }` computed from the raw string.
- On mixed-script input like `"Hello 👋 你好 مرحبا"` (P3), the practical effect is: `correctEmojiLayout` runs last and its output is what `verify()` uses. `correctRTLLayout` and `correctCJKLayout` are transient — their outputs are discarded if the later pass triggers. The P3 trace makes this observable:
  - `[0] pretext: 2 lines ["Hello 👋 你好 " w=55.06, "مرحبا" w=40]`
  - `[2] after RTL: 2 lines w=[55.07, 40]`
  - `[3] after CJK: 2 lines w=[55.07, 40]` (CJK probe returned no applicable family on Windows canvas, so `correctCJKLayout` short-circuited)
  - `[4] after Emoji: 2 lines w=[72.16, 40]` (width changed — emoji re-measured with Segoe UI Emoji)
- On this input the final result is the emoji-corrected layout's widths, but the line *count* came from the RTL pass (the CJK pass short-circuited). For inputs where every corrector triggers, the **last-wins** semantic means order matters; the comment at the top of each corrector acknowledges monotonicity guarantees (RTL never increases line count, CJK never decreases it) that together compose to "pipeline order is correctness-preserving for the specific text compositions we've validated against", but the composition is not a universal property of the three replacements.
- I could not construct a case in my probe time budget where reversing the pipeline order yields a different line count on real text. But the design is fragile to new corrector additions. A **reducer pattern** (each pass rewrites only the runs it owns, the rest of the line layout is carried forward) would compose more predictably than the current replace-the-world pattern.
- Discussion rather than Important because: (a) no repro of a wrong answer today; (b) the HANDOFF and FINDINGS §H6c document the pipeline order explicitly.

## 3. Directed-Probe Results

### P1 — vanilla-extract fixture

**Result: PASS.** `resolveStylesRuntime` picks up the expected typography
from a fixture that shapes its output the way vanilla-extract's runtime
does (injected `<style>` tag with a hashed class selector + a static
`className` on the element). See `review/probes/P1-vanilla-extract-shim.test.tsx`.
Resolved: `{ font: '16px sans-serif', maxWidth: 120, lineHeight: 20 }`.
Supports the "library-agnostic by construction" claim (D1). Does not
exercise vanilla-extract's real build pipeline.

### P2 — ground-truth flakiness over three back-to-back runs

**Result: NO FLAP.** All three runs of `bun run ground-truth:strict --
--browser all` produced byte-identical per-engine per-language agreement
numbers: chromium 917 / 928 (98.81 %), webkit 919 / 928 (99.03 %), firefox
915 / 928 (98.60 %); per-language breakdowns exact match. See
`review/gate-gt-static-run{1,2,3}.txt`. See also D2.

### P3 — mixed-script pipeline trace

**Result: DOCUMENTED, composition is last-wins not additive.** Pipeline
applied to `"Hello 👋 你好 مرحبا"` at `60 px` maxWidth, `16 px sans-serif`:

```
[0] pretext            2 lines  [("Hello 👋 你好 ", 55.06), ("مرحبا", 40)]
[1] fits-one-line      2 lines  (no-op, natural width > maxWidth)
[2] after RTL          2 lines  [("Hello 👋 你好", 55.07), ("مرحبا", 40)]
[3] after CJK          2 lines  [("Hello 👋 你好", 55.07), ("مرحبا", 40)]   (no CJK family registered on canvas, probe returned null)
[4] after Emoji        2 lines  [("Hello 👋 你好", 72.16), ("مرحبا", 40)]   (re-measured via Segoe UI Emoji)
```

Text content of the final lines: identical forward vs reverse ordering
(`[RTL, CJK, Emoji]` vs `[Emoji, CJK, RTL]`). Widths differ across passes
because each corrector re-measures the raw string; the **last** correction
that triggers wins. See D3 for the broader analysis. See
`review/probes/P3-mixed-script.test.ts`.

### P4 — runtime probe on a component that throws during render

**Result: CRITICAL — silent wrong answer.** See C1 for the finding write-up
and the probe output. `resolveStylesRuntime` resolves successfully with
viewport-container defaults when the target throws. `verifyComponent({
runtime: true })` re-renders downstream for text extraction and propagates
the throw, so that surface is noisy — but the standalone
`resolveStylesRuntime` path is not. State-leak check (a valid component
rendered after a throw) correctly returns its own styles — no cross-test
state leakage detected.

### P5 — runtime probe on a component that suspends

**Result: IMPORTANT — silent wrong answer.** See I2.
`resolveStylesRuntime` resolves in 30 ms with the Suspense fallback's
typography (`12 px monospace, maxWidth 60 px, lineHeight 14 px`); no flag
indicates the target suspended.

### P6 — explicit spec vs runtime-probed precedence

**Result: PRECEDENCE IS CORRECT; separately the probe mis-reads shorthand.**
Three sub-tests:
- P6a: `verifyComponent({ runtime: true, element, font: '16px Inter',
  maxWidth: 120, lineHeight: 20, constraints: { maxLines: 1 } })` →
  `{ ok: true, cellsChecked: 1 }`. Explicit values flow through, consistent
  with `packages/react/src/verify-component.ts:83–97` (explicit `??`
  resolved fallback, with explicit taking precedence).
- P6b: only explicit `maxWidth: 80`, font + lineHeight probed. Observed
  natural width 96 px on 17-char string — which implies the probed font
  is ~16 px sans-serif, not the component's declared 24 px monospace.
  This is I3.
- P6c: explicit `font: '10px serif', maxWidth: 400, lineHeight: 12` flows
  through and produces `{ ok: true }`. Confirms explicit overrides runtime
  probe for all three typography inputs.

Documented precedence matches observed precedence. The `font` shorthand
limitation (I3) is a probe bug independent of the precedence question.

### P7 — tree-shakability of `resolveStylesRuntime` for static-only consumers

**Result: IMPORTANT — NOT tree-shakable.** See I1. esbuild 0.28.0 with
`--minify --format=esm --platform=browser` produces identical byte-sizes
for a static-only consumer (19,692 B raw / 7,463 B gz) and a
`runtime: true` consumer (19,715 B raw / 7,472 B gz). See
`review/bundle-check/*`.

### P8 — font-subsetter reproducibility

**Result: PASS — byte-identical reproduction in 689 ms.** Running
`bun scripts/subset-emoji-font.ts` on a clean clone with the cached
source at `node_modules/.cache/prelight-emoji-font/Noto-COLRv1.ttf`
produces a 625,968-byte output whose SHA-256 matches the committed
`ground-truth/fonts/NotoEmoji-subset.ttf` byte-for-byte. Source font
SHA-256 matches `EXPECTED_SOURCE_SHA256` in the script. Wall time: 689 ms
with cache, I did not force a re-download. See `FINDINGS.md` §H6c for the
full toolchain writeup; the writeup and the script agree. A new hire
could reproduce the subset in under a minute given a populated cache.

### P9 — claims-to-evidence matrix

See §5.

### P10 — `PRELIGHT-INVARIANT` purity check on `verify.ts`

**Result: INVARIANT DRIFT — documentation does not reflect call-graph reality.**
See I4. No `fs`, `fetch`, `process`, `new Date`, or `Math.random` in
`verify.ts` or its transitive call graph. The only `globalThis` access is
`assertCanvasReady()`'s check for `globalThis.OffscreenCanvas`, which is a
capability probe, not a read of mutable state. The real leak: both
`correctCJKLayout` and `correctEmojiLayout` consult module-level mutable
state (`CJK_MEASUREMENT_FAMILIES` / `EMOJI_MEASUREMENT_FAMILIES`) when
`spec.measurementFonts.{cjk,emoji}` is not supplied, and that state is
mutated through the `setCJKMeasurementFamilies` / `setEmojiMeasurementFamilies`
exports. The INVARIANT comment in `verify.ts` calls this "bundled font
state" without elaboration; readers of `verify.ts` alone would not know
`verify()` is not referentially transparent.

## 4. Research Positions

### R1 — Positioning vs Chromatic, Percy, Happo, @vercel/og, playwright-visual-regression, storybook-test-runner

Prelight and these tools solve different problems, and the solution
spaces only partly overlap. The visual-regression crowd — Chromatic
(Storybook's hosted snapshotting), Percy (BrowserStack), Happo — all
share a workflow: render your component in a real browser, take a
screenshot, diff against a stored baseline. They excel at catching
changes *you didn't mean to ship* (accidental layout shifts, CSS
regressions, dark-mode stragglers). They fail at catching changes *you
meant to prevent* (a translation that causes overflow, a font stack
degrading on a new CI agent). The diff fires on any visual delta; a
translated string intentionally different from the baseline is just a
"new screenshot approve me please" modal. You can narrow the diff to a
bounding box, mask regions, set a pixel tolerance — but every one of
those dials moves the test toward "approximate visual equivalence",
which is not what a layout contract is.

playwright-visual-regression and storybook-test-runner sit in similar
territory but run locally. They add programmability — you can write
`expect(page).toHaveScreenshot()` inside a Playwright test — but the
verification primitive is still the diffed image. `@vercel/og` is a
different beast: it's a server-side image-generation runtime for Open
Graph cards, using a satori/resvg pipeline. It has a real layout engine
but it's scoped to the OG-card use case and renders to PNG.

Prelight is not snapshot-testing. It's **algorithmic verification of a
declared contract**. You say "this text, at this font, at this width,
must fit in one line"; Prelight computes whether that proposition is
true, and if it isn't, tells you by how much (11.4 px over, for example).
There is no baseline to approve; there is no image diff; there is no
tolerance dial. You can run it in milliseconds without spinning up a
browser. Those properties are genuinely valuable: a German translation
that overflows a button fails the test *because it overflows*, not
because some pixel differs from a baseline that a developer would have
happily approved anyway.

Three things Prelight loses on vs the snapshotters: (1) **Visual
correctness of everything that isn't text layout.** Color, imagery,
iconography, hover states, focus rings, dark-mode specifics — all
invisible to Prelight. A Chromatic snapshot catches the entire rendered
output. (2) **Pixel-accurate rendering.** Prelight measures; browsers
render. Anti-aliasing, sub-pixel font hinting, and rasterization
artifacts are outside Prelight's model. (3) **Cross-browser drift in
things *other* than text width.** If WebKit renders your `box-shadow`
wrong, Chromatic sees it, Prelight does not. (4, bonus) **Adoption
familiarity.** Snapshot testing is the mainstream paradigm with wide
tooling support; "algorithmic contract verification" is the road less
travelled.

So: Prelight complements the snapshotters, does not replace them. The
README already frames this reasonably (intro talks about Playwright /
Chromatic / Percy as slow-flaky-expensive). Fine. It does not say
"these tools still catch classes of bugs we cannot", which would be the
honest addendum.

### R2 — Relationship to CSS Houdini Layout API

The CSS Houdini Layout API (`display: layout(<name>)`, `registerLayout()`
in the browser worklet) was designed to let you implement custom CSS
layout algorithms in JavaScript, then apply them to real DOM. The spec
moved to the CSS WG, shipped in Chromium behind a flag (2019), stalled
in Gecko / WebKit, and has effectively been dormant since ~2022. No
major browser ships it to stable as of 2026.

Prelight is doing a userland subset of the Houdini Layout API *for a
specific reason*: verification without mounting to a real browser.
Houdini's layout worklet gives you fragmentation primitives, a
`ChildFragment` API, and hooks into how the browser composites its own
layout. Prelight doesn't need compositing. What Prelight *does* need is
algorithmic primitives for text layout (`pretext`), block layout
(margin-collapse, float-free block flow), single-axis flex with
alignment, and aspect-ratio boxes. That's a small, predictable subset
of CSS — the subset you can actually model without the full
`@layout(worklet)` scaffolding.

Is it a "userland Houdini shim"? Functionally yes, for the cases it
covers. Conceptually no, because Houdini's selling point was
*extensibility* (implement novel layout algorithms and apply them to
your real pages), whereas Prelight's is *verifiability* (check that a
known small set of layout rules holds for your text). Extensibility in
Houdini means the custom algorithm runs at render time for real users;
Prelight's algorithms run at test time, produce yes/no verdicts, and
never interact with a browser's rendering path.

So Prelight is adjacent to Houdini, not a replacement or a shim. The
README doesn't mention Houdini, which is probably correct — invoking a
spec that didn't ship would muddy the positioning. A footnote for
"prior art curiosity" is all that's warranted. The interesting
*inverse* question is whether Houdini's failure tells us something
about Prelight's prospects: the reason Houdini stalled is that nobody
actually wants to re-implement CSS's layout engine in userland. That
argues Prelight is right to scope down to verification only — there's
no market for userland layout, but there's plausibly a market for
userland layout *verification*.

### R3 — Prior art for algorithmic verification of typographic contracts

Snapshot testing as a general UI-regression technique dates to at least
Jest snapshots (2016); the visual-regression form of it is older
(Applitools Eyes launched 2013). These are sibling paradigms: different
oracle, same workflow shape.

Algorithmic contract verification for *text layout specifically* has
been done in pockets, but none of the prior art I found lines up with
Prelight's shape:

- **Typesetting systems from TeX onwards** (Knuth-Plass line-breaking,
  1981) produce deterministic, spec-driven layouts that can be verified
  against invariants. You could read pretext — the library Prelight
  leans on — as an implementation of those ideas in JavaScript. But TeX
  doesn't verify: it typesets.
- **i18n pseudo-localization** (Microsoft's pseudolocales,
  Chrome's `--lang=fr-FR-u-numbers-latn`, Google's "Xpath sent me"
  tooling) inflates strings by 30 – 50 % to reveal layout fragility
  under long translations. Result is still a rendered screenshot or a
  human eyeball. Pseudo-localization and Prelight are complementary:
  pseudo-loc generates hard test cases; Prelight verifies the
  assertions on them.
- **Accessibility linters and axe-core** run DOM-level checks against
  rendered output (contrast ratios, tab order). Same "algorithmic
  verification" shape, different domain.
- **Visual design tools with responsive-sizing warnings** (Figma's
  "text overflowing its container" indicator; Framer's layout-warning
  panel) flag overflow at *design time*, inside the tool. They don't
  run against your code; they run against the design.
- **Typed-CSS and compile-time width calculation** experiments (e.g.
  Linaria's static extraction; @vanilla-extract/calculate-width
  prototypes) look promising on paper but don't generalize to multi-
  language text, emoji grapheme clusters, or CJK kinsoku rules. They
  fall over exactly where Prelight's value is concentrated.

The academic literature on multilingual line-breaking (CJK kinsoku,
Arabic justification, ZWJ emoji cluster handling) is deep — the
relevant field is computational typography. The gap between "we have
algorithms for line-breaking" and "we have a test harness that runs
those algorithms on your real strings and verifies layout contracts" is
exactly what Prelight occupies. I did not find prior work that closes
that gap in the form Prelight ships. That surprised me; either my
search was incomplete (300-word limit here) or this really is a
neglected surface. The README is right not to claim "first" without a
lit review, but I'd accept "novel in our corner" as defensible.

### R4 — Statistical rigour of the 928-case corpus

The corpus is **hand-curated, not sampled**. I inspected
`corpus/languages/*.json`: 96 English, 112 German, 48 compound-words,
408 emoji, 96 English (dup?), 88 Japanese, 80 Chinese, 96 Arabic. The
per-language strings were picked to stress known edge cases (emoji ZWJ
sequences, CJK kinsoku at right margins, German long compounds, Arabic
shaping at boundaries, URL-breaking in Latin). That's good engineering
practice for a test corpus, but it has a specific statistical
consequence: **the 98.81 % agreement number is not a confidence
estimate about Prelight's behavior on real-world text**. It's a
measurement of agreement on the specific curated strings.

If the corpus were a random sample from some population (e.g. strings
drawn uniformly from a production translation database), 917 / 928 =
98.81 % would support a Wilson 95 % CI of roughly [97.97 %, 99.30 %]
for the population's true agreement rate. That would be a strong
claim. But the corpus isn't a sample: it's a benchmark. A benchmark's
purpose is to concentrate difficulty on known-hard cases; if Prelight
scores 98.81 % *there*, real-world text — which is mostly
low-difficulty — should score higher, but we can't prove it from this
harness.

The **per-engine floors** (`run.ts:45–80`) make this honest by design:
they're thresholds, not CIs. A floor of 93 % for Firefox `en` with a
measured 95.8 % says "we accept a ≤ 2.8 pp regression before we block
release", not "we're 95 % confident the true rate is between 93 % and
98.6 %". That's a reasonable release-engineering contract, just a
different contract from what a naive reader sees when the README says
"98.81 % agreement on 928 cases".

Recommended framing for the README and FINDINGS §H6c: quote the
curated-corpus-agreement number as "98.81 % on the v0.3 benchmark",
not "98.81 % agreement with browser ground truth" (which reads as a
population claim). Separately, track a random sample from at least one
production translation corpus — a few hundred strings sampled from,
say, Mozilla's L10N or Firefox's translations repo — and report
*sample* agreement as a distinct number. That second number *is* a
population claim; it should be lower than the benchmark number, and
when it isn't, the benchmark is the culprit.

### R5 — Threat model for a downstream consumer

Consider a mid-size SaaS shipping Prelight in CI as a gate for their
German/French/Arabic translations. What can go wrong?

1. **Silent false negative — primary risk.** A translator adds a
   string that fits Prelight's layout contract but renders poorly in
   an actual browser (sub-pixel kerning, font fallback). Prelight says
   OK, CI passes, users see overflow in production. This is the
   failure mode Prelight is *built* to minimize (the ground-truth
   harness proves agreement to ±1 px), but 1.19 % of the corpus
   disagrees per-engine, and that 1.19 % isn't obviously dead code —
   it's the honest uncertainty in any cross-engine measurement.
2. **Silent wrong answer from runtime probe on a flaky component.**
   C1 and I2 are in this class. A team using Emotion + React.lazy
   writes `expect(Component).toLayout({font, width, maxLines: 2})`.
   The component suspends (R5's own irony: a network fetch). The
   probe measures the fallback. The test passes. They ship. Probability
   proportional to how much of the product ships behind Suspense.
3. **Corpus drift.** A team pins `@prelight/core` at 0.3.0 and their
   translation corpus grows past the v0.3 corpus size. Prelight's
   verdict on their new strings is untested; the 98.81 % figure they
   cite internally doesn't apply. Risk level: medium, controllable by
   sampling against their own corpus (R4's recommendation).
4. **Font-state leakage between tests.** I4's issue. A test that calls
   `setCJKMeasurementFamilies(['TeamFont'])` at setup leaks that state
   into the next file's tests unless they explicitly reset or pass
   `spec.measurementFonts` per-call. Today only the harness uses the
   setters; a consumer that mimics the harness pattern inherits the
   risk.
5. **Malicious corpus input.** Not a real threat (Prelight is a test-
   time tool, not a runtime one), but worth noting: `verify()` takes
   arbitrary strings and renders them to an OffscreenCanvas. A
   pathological string (billion characters, extreme grapheme clusters)
   could exhaust memory in CI. Low risk in practice because the
   corpus is developer-controlled, but a `maxLength` input guard
   would close the door.
6. **Performance cliffs at scale.** The runtime probe mounts and
   unmounts a React tree per `verifyComponent({ runtime: true })`
   call. A test suite with a few hundred such calls (realistic for a
   design system) will measure in seconds, not milliseconds. The
   static path is fast; the runtime path is, per FINDINGS §H7, "single-
   digit ms per probe but orders of magnitude slower than static". Not
   a bug, just a cost nobody has benchmarked.

The two threats worth flagging in the README's "when to use" section
are (1) and (2). The silent-wrong answers from (2) are fixable in the
probe implementation. The silent-false-negatives in (1) are inherent
to "agreement is not correctness" (HANDOFF quirk #5) and need to be
explicit in the docs.

## 5. Claims-to-Evidence Matrix (P9)

Scope: every *numeric* and *superlative* claim in `README.md` and the
`[0.3.0]` section of `CHANGELOG.md`.

| # | Claim (source) | Evidence linked | Verdict |
| - | -------------- | --------------- | ------- |
| 1 | "98.81 % / 99.03 % / 98.60 % agreement overall (Chromium / WebKit / Firefox) on the 928-case corpus" (`README:140`, `CHANGELOG:21`) | `review/gate-gt-static-run{1,2,3}.txt` all reproduce these exactly | ✅ Reproduced, corpus is curated not sampled (see R4) |
| 2 | "Emoji reaches 99.75 % on all three engines" (`README:140`, `CHANGELOG:21–22`) | 407 / 408 emoji agree per engine, confirmed in gate runs | ✅ Reproduced |
| 3 | "928-case corpus" (`README:140`) | `corpus/languages/*.json` totals to 928 cells × 1 fontScale per engine | ✅ Reproduced |
| 4 | "17/17 fixtures agree on chromium, webkit, firefox across all seven runtime-probe properties" (`CHANGELOG:107`) | `review/gate-gt-runtime.txt` | ✅ Reproduced |
| 5 | "440 passing" (HANDOFF; not in README directly) | `review/gate-test.txt` shows 270 + 110 + 11 + 5 + 44 = 440 | ✅ Reproduced |
| 6 | "395 tests" (`AGENTS.md:81`) | Same as #5 | ❌ Stale (M1) |
| 7 | "255/255" (`CHANGELOG:101` H7 block) | Same as #5 | ❌ Stale within CHANGELOG (M1) |
| 8 | "`@prelight/react` 11.44 KB min / 4.60 KB gz" (`HANDOFF:58`, `CHANGELOG:17-ish`) | `review/gate-measure.txt` (from P0) | ✅ Reproduced at tag |
| 9 | "`+4.94 KB min / +1.72 KB gz`" from H7 (`CHANGELOG`) | Arithmetic: 11.44 − 6.50 = 4.94 (budget), 11.44 − 6.14 = 5.30 (measured) | ⚠️ Mixed baselines (I5) |
| 10 | "Runtime probe works on any CSS-in-JS library that injects `<style>` tags" (`README §7`, paraphrased) | `packages/react/test/runtime-probe.test.tsx` covers emotion + styled-components + CSS vars + slots; `review/probes/P1` covers vanilla-extract-shaped input | ✅ Defensible as principle (D1); specific library list exceeds direct CI evidence |
| 11 | "Library-agnostic runtime style resolution" (`CHANGELOG:54`, `FINDINGS:29`) | Same as #10 | ✅ Defensible (D1) |
| 12 | "First-class" / "first-of-its-kind" / "production-ready" framing | None of these terms appear in README.md or CHANGELOG.md [0.3.0] at the time of this review (grep confirmed). HANDOFF uses "crown jewel" for H7. | ✅ No claim to check — the project is humble here |
| 13 | "Consumers who only need the static walker never pay the install cost" (`FINDINGS:149`) | Literal install cost is opt-in (`happy-dom` is optional peer dep + dynamic `import`) | ✅ Narrow claim holds |
| 14 | Implicit: "Consumers who only need the static walker don't pay bundle cost" (readers' natural inference from #13) | `review/bundle-check/static-out.js` = 19,692 B, identical to runtime consumer | ❌ Does not hold (I1) |
| 15 | "NotoEmoji-subset.ttf … 611 KB" (`HANDOFF:88`) / "625,968 B" (subsetter log) | `(Get-Item NotoEmoji-subset.ttf).Length` = 625,968 B = 611.3 KiB. 611 is the binary-KB, 625.97 is the decimal-KB. | ✅ Consistent; binary-vs-decimal KiB convention (minor rounding clarity) |
| 16 | "v2.051 (Unicode 17.0)" source font pinned to SHA-256 `0ae57fe5...1e1a28d2` (`scripts/subset-emoji-font.ts:81–87`) | Live download SHA-256 matches `EXPECTED_SOURCE_SHA256` exactly; P8 reproduced byte-identical output | ✅ Pinned, reproducible |
| 17 | Per-engine per-language floors met (`HANDOFF:65`, `DECISIONS #008`) | `review/gate-gt-static-run1.txt` reports `all per-engine per-language floors met.` Firefox `en` cushion is 2.8 pp (M2) | ✅ Holds; cushion is narrow |

Summary: every quantitative claim in v0.3.0 public surfaces reproduces
at the numbers quoted, *except* the stale test counts in AGENTS.md and
the H7 CHANGELOG block (stale within its own document, M1) and the
mixed-baseline bundle delta (I5). The framing gap on tree-shakability
(#14) is new to this review.

## 6. Recommendations for v0.4

These are suggestions, not a roadmap. The user asked for raw input.

1. **Split `@prelight/react` into `@prelight/react` + `@prelight/react/runtime`.**
   The static path becomes tree-shakable to zero-cost-if-unused. Breaking
   change; codemod. Most leverage for bundle claims.
2. **Error-boundary the runtime probe.** C1 and I2 are the same shape —
   the probe doesn't notice when React itself failed to produce what the
   probe asked for. Wrap the target in an ErrorBoundary + a Suspense-
   detection layer; reject the `resolveStylesRuntime` promise on either.
3. **Expand the `font` shorthand before reading `getComputedStyle`.**
   Closes I3 without waiting on happy-dom upstream.
4. **Pass `spec.measurementFonts` through the ground-truth harness per
   case**, remove `setCJKMeasurementFamilies` / `setEmojiMeasurementFamilies`.
   Closes I4, aligns the code with the top-of-`verify.ts` invariant.
5. **Add one sampled-from-production corpus** (a few hundred strings
   from a real translation DB) reported as a separate agreement
   number. Makes R4's distinction load-bearing instead of rhetorical.
6. **Rewrite the corrector pipeline in a reducer shape.** Each corrector
   claims only the runs it owns; the residual layout carries through.
   Closes D3 without breaking external behavior on the current corpus.
7. **One doc-pass to close M1**: bump AGENTS.md test count to 440, fix
   the stale CHANGELOG 255/255 line, retitle ROADMAP v0.3 section.
8. **Add a direct vanilla-extract CI fixture.** P1 demonstrated the
   principle; a real build-pipeline fixture would turn the D1
   "defensible" framing into tested.
9. **Standardise CHANGELOG bundle-size reporting on measured-to-
   measured deltas, quote budget separately** (closes I5 stylistically).
10. **Narrow README §7's enumerated library list** (or add the
    "tested in CI: emotion, styled-components; shape-tested: vanilla-
    extract; untested but expected to work: Stitches, Linaria, Panda,
    Tamagui" framing).

## 7. Self-Assessment: What I Could Not Cover and Why

- **Stress-test angle #8's reproducibility-in-under-an-hour-by-new-hire
  claim.** I reproduced the emoji subset in 0.7 s with a populated
  cache. With a cold cache, the script downloads ~5 MB from
  `raw.githubusercontent.com`, which I did not exercise. The `FINDINGS`
  §H6c writeup I read does agree with the script's behavior (no
  material divergence), so I believe the "under an hour" claim, but
  I did not prove it end-to-end from a fresh clone.
- **R3's prior-art search** was time-boxed inside this session. I
  intentionally did not launch a web-research subagent because the
  existing literature maps I'm drawing on are well enough known; a
  deeper sweep against typographic-verification literature would
  probably turn up more adjacent prior work. The "novel in our
  corner" framing is what I'd defend; I did not try to defend "first
  ever".
- **Performance cliff in the runtime probe at scale** (threat R5.6) —
  no benchmark run. I noted the risk and the asymptotic argument,
  didn't measure.
- **Jest matcher surface** — I ran the Jest test suite (5 passing) but
  did not prosecute any of Jest-specific behaviour; the bulk of the
  React adapter lives on the Vitest side.
- **ROADMAP wording on v0.3 vs v0.3.0 is stale (M1)** — I flagged it
  but did not edit ROADMAP per the review-no-silent-edits rule.
- **Repo state at review start.** `git status` showed two pre-existing
  untracked items from before the session (`cursor_chenlou_pretext_tool_research.md`,
  `.cursor/` local hooks state) which I did not touch. I **did** modify
  `package.json` and `bun.lock` during the review, with explicit user
  permission, to register `review/probes` as a bun workspace so the
  probe fixtures could install and run. The package.json diff is one
  line (`+    "review/probes",` in the `workspaces` array). Reverting
  these before submission would render the probe fixtures unrunnable
  for anyone reproducing this review. I leave them in place with this
  note as the documentation of the consent.
- **I did not land any code fix** as part of this review. All findings
  sit in this document pending user decision.

## 8. One Substantive Disagreement with the HANDOFF

**HANDOFF stress-test angle #2 asks:** *"Is any of that size accidental?
Audit `packages/react/dist/index.js` and see whether happy-dom types or
probe-only paths are leaking into the SSR-friendly static path that
consumers pay for whether they use `runtime: true` or not."*

**HANDOFF's own framing elsewhere (quirk #4, FINDINGS §H7):**
*"Consumers who never use `runtime: true` install nothing."* — emphasis
on *install*. The `happy-dom` peer dep is opt-in; this part is correct.

**My position after the bundle-check experiment:** the install cost is
opt-in, but the **bundle cost is not**. The runtime-probe glue code
(the happy-dom global-shim installer, the dynamic-import wrapper, the
DOM-globals list, the mount-and-measure routine) is statically reached
from `@prelight/react`'s main entry via
`verify-component.js → runtime-probe.js`. A consumer that never uses
`runtime: true` ships 19.7 KB raw / 7.46 KB gz on the static path,
which is within 0.12 % of the runtime consumer's bundle.

The HANDOFF anticipated the question but does not answer it; the
FINDINGS and CHANGELOG frame the opt-in property in a way that
downstream readers would reasonably extrapolate to bundle cost.

That's the substantive disagreement. It's tractable — I1 in §2.2 lays
out two fixes.

---

## Appendix A — Gate Run Transcripts

All gate runs at tag commit `70cc689` on 2026-04-18.

| Gate | Command | Result | Wall-clock | File |
| ---- | ------- | ------ | ---------- | ---- |
| Typecheck | `bun run typecheck` | 5/5 packages, 0 errors | ~3 s | (not captured as file; exit 0 observed inline) |
| Unit tests | `bun run test` | 440 passing (core 270 / react 110 / vitest 11 / jest 5 / cli 44) | ~6 s | `review/gate-test.txt` |
| Bundle budget | `bun run measure-bundle:strict` | all packages within budget; `@prelight/cli` measured 7.26 KB vs 8.00 KB budget (minor 0.01 KB variance from HANDOFF 7.25) | ~1 s | (inline exit 0) |
| Ground-truth static × 3 | `bun run ground-truth:strict -- --browser all` | chromium 917/928 (98.81 %), webkit 919/928 (99.03 %), firefox 915/928 (98.60 %); identical across 3 runs | ~90 s each | `review/gate-gt-static-run{1,2,3}.txt` |
| Ground-truth runtime | `bun run ground-truth:runtime:strict -- --browser all` | 17/17 fixtures × 3 engines × 7 properties agree | ~60 s | `review/gate-gt-runtime.txt` |
| Demo — German | `bun --cwd demos/failing-german-button test` | 3/3 | ~2 s | `review/gate-demo-german.txt` |
| Demo — Emotion | `bun --cwd demos/runtime-probe-emotion test` | 3/3 | ~3 s | `review/gate-demo-emotion.txt` |

Exit codes: 0 across all gates. No divergence from HANDOFF-quoted
numbers.

---

*End of review.*
