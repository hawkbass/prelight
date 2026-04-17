# Contributing to Prelight

Thanks for considering a contribution. Prelight is small on purpose; keeping it that way is part of the job.

## Setup

```bash
bun install
bun run --filter='./packages/*' build
bun run --filter='./packages/*' typecheck
bun run --filter='./packages/*' test
```

All four should succeed on a clean clone. If they don't, see [DEVELOPMENT.md](./DEVELOPMENT.md) for platform notes (especially Windows) and the `@napi-rs/canvas` prebuild story.

## Before you open a PR

Read these three short docs:

- [ROADMAP.md](./ROADMAP.md) — what's in scope for the current and upcoming versions
- [DECISIONS.md](./DECISIONS.md) — the architectural decisions we've committed to, and what would invalidate them
- [DEVELOPMENT.md](./DEVELOPMENT.md) — style rules, review checklist, session protocol

If your change touches a decision or makes a new one, add an ADR entry to `DECISIONS.md` in the same PR.

## Empirical claims require evidence

Prelight's credibility rests on the claim that static verification agrees with the browser. If your change could move that needle — a new predicate, a corpus addition, a Pretext version bump — it must be paired with:

- A dated entry in [FINDINGS.md](./FINDINGS.md) describing what was measured, on what hardware, with what runtime versions
- A passing run of `ground-truth/run.ts` on your machine

No exceptions. Documentation claims and measured claims are not the same thing.

## Forward-annotation markers

We use three inline markers to keep deferred work honest:

- `PRELIGHT-NEXT(vX.Y)` — a path deferred to a specific future release (must match a `ROADMAP.md` entry)
- `PRELIGHT-FLAG` — a known trade-off worth calling out at review time
- `PRELIGHT-INVARIANT` — a property a reviewer must preserve across edits

Open-ended `TODO`s are not accepted. Attach a version or a flag.

## Commit + PR conventions

- Small, reviewable commits. Squash-merge into `main`.
- PR title: `type(scope): summary`, e.g. `fix(core): correct naturalWidth when text contains no soft-breakable characters`.
- PR description must explain *why*, link to issues, and list any ROADMAP / DECISIONS / FINDINGS updates.

## Code style

- TypeScript only in published packages. No JS source.
- `strict: true`, `noUncheckedIndexedAccess: true`. Embrace the friction.
- No `any`. Use `unknown` + narrowing.
- Comments explain intent, not mechanics. If you're tempted to narrate the code, consider renaming instead.

## Reporting bugs

Open an issue using the bug template. A minimal reproduction (ideally a failing test in `packages/core/test/`) is worth ten paragraphs.

## Security

For security-sensitive reports, see [SECURITY.md](./SECURITY.md) instead of filing a public issue.
