# demo: dogfood-library

The middle act. Prelight in the role it's designed for: a CI gate on a realistic component library.

## What it shows

Three to five components — a Button, a Card, a TableCell, a NavLink, maybe a Toast. Each has a set of user-facing strings and a constrained slot. A `prelight.config.ts` declares the matrix. A GitHub Actions workflow runs `prelight --ci` on every PR.

When a PR changes a string — any string, in any language — Prelight blocks the merge if the change would overflow. Without running a browser. Without taking screenshots.

## PRELIGHT-NEXT(v0.1-phaseC)

- [ ] `components/` — 3–5 realistic component implementations.
- [ ] `prelight.config.ts` — the matrix declaration.
- [ ] `github-workflow.yml` — copy-pasteable CI gate, committed for inspection.
- [ ] README body: "here is how your team plugs this into an existing repo".
