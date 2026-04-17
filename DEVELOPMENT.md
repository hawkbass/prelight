# Development

Everything you need to work on Prelight. This doc is load-bearing — if something is missing or wrong, fix it here first and the code second.

## Prerequisites

- **Bun** ≥ 1.3.0 ([install](https://bun.sh)). This is the primary runtime.
- **Node** ≥ 20.0.0. Some tooling (Playwright, certain IDE integrations) still prefers Node.
- **Git** ≥ 2.40.
- **pnpm** or **npm** (optional). Bun is preferred; the workspace format is compatible with both pnpm and npm as a fallback. See [DECISIONS.md #001](./DECISIONS.md).

Verified on Windows 11 (primary dev machine), macOS, and Ubuntu. Known Windows-specific notes below.

## First-time setup

```bash
bun install
bun run typecheck
bun run test
```

All three should pass on a clean checkout. If any fail, see the Windows notes below or open a FINDINGS entry.

## Layout

```
prelight/
├── packages/              # published libraries
│   ├── core/              # the verifier, framework-agnostic
│   ├── react/             # React adapter
│   ├── vitest/            # Vitest matcher
│   ├── jest/              # Jest matcher
│   └── cli/               # `prelight` CLI
├── corpus/                # shared language + font test corpus
│   ├── languages/         # curated strings per language
│   └── fonts/             # bundled open fonts (Inter default)
├── ground-truth/          # Playwright harness vs real browsers
├── demos/                 # three narrative demos (see site/)
│   ├── failing-german-button/
│   ├── dogfood-library/
│   └── speed-comparison/
└── site/                  # landing page + playground
```

## Common workflows

### Add a predicate to core

1. Define the predicate in [packages/core/src/predicates.ts](./packages/core/src/predicates.ts).
2. Add per-predicate unit tests in [packages/core/test/predicates.test.ts](./packages/core/test/predicates.test.ts).
3. Export from [packages/core/src/index.ts](./packages/core/src/index.ts).
4. Update the matcher surface in `@prelight/vitest` and `@prelight/jest`.
5. Add a ground-truth case in `ground-truth/corpus.test.ts`.

### Bump Pretext

1. Update the version in [packages/core/package.json](./packages/core/package.json).
2. Run the full ground-truth suite. Budget: zero regressions.
3. If any cell moves, add a FINDINGS entry and (if within budget) proceed; else, hold and file upstream.
4. DECISIONS.md is updated only if the bump changed architectural assumptions.

### Add a language to the corpus

1. Add a file `corpus/languages/<code>.json` with a curated string set.
2. Add the language's expected ground-truth in `ground-truth/corpus.test.ts`.
3. Update the matrix defaults in `@prelight/core` if it should be part of the default sweep.

## Windows-specific notes

Prelight is being developed on Windows. These are the quirks we've seen.

- **Line endings.** `.gitattributes` normalizes everything to LF. If you see CRLF diffs, run `git config core.autocrlf input` locally and re-clone.
- **Path length.** Nested `node_modules` inside demos can exceed the 260-char limit. Bun hoists by default which keeps us under, but `git clean` into a deeply nested folder can fail. Run from the repo root.
- **Playwright install.** Use `bunx playwright install` rather than `bun x` (subtle flag-passing bug on Windows in older Bun versions; check notes).
- **PowerShell vs bash.** All scripts in `package.json` use POSIX syntax via Bun. You should never need to invoke PowerShell-specific commands.

Any Windows-specific issue that costs more than 30 minutes → open a FINDINGS entry and an issue. This is how we stay honest about the cross-platform story.

## Session protocol (AI-assisted work)

Sessions follow the four-phase protocol defined in the v0.1 plan:

- **Phase A — Foundation:** core verifier, predicates, report, corpus, ground-truth harness.
- **Phase B — Adapters:** React extraction, Vitest matcher, Jest matcher, CLI.
- **Phase C — Demos:** failing-german-button, dogfood-library, speed-comparison.
- **Phase D — Launch polish:** docs, site, playground, final README, launch artifacts.

Between phases, run the self-review protocol (see plan). Any quality-cliff trigger firing requires an immediate checkpoint in DECISIONS.md or FINDINGS.md, not a push-through.

## Style

- TypeScript everywhere. No JS source files in published packages.
- Strict mode. `noUncheckedIndexedAccess` is on; embrace the friction.
- No `any`. If you need to escape the type system, use `unknown` and narrow.
- Prefer named exports. `export default` only when the package has a single conceptual entry.
- Tests live beside their subject when practical (`packages/core/test/`). Ground-truth is its own workspace.
- Comments explain *why*, never *what*. Forward-annotation markers (`PRELIGHT-NEXT`, `PRELIGHT-FLAG`, `PRELIGHT-INVARIANT`) are the exception — they're load-bearing.

## Review checklist (before merge)

- [ ] `bun run typecheck` clean
- [ ] `bun run test` green
- [ ] `bun run ground-truth` green (if touching core or corpus)
- [ ] Every new `PRELIGHT-NEXT(vX.Y)` has a matching ROADMAP.md entry
- [ ] Every new empirical claim has a FINDINGS.md entry
- [ ] Every architectural decision has a DECISIONS.md entry
- [ ] README / DEVELOPMENT updated if the shape of the project changed
