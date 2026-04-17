# demo: failing-german-button

The opening act of the Prelight story.

## What it shows

A `<Button label={t('save')} />` that passes in English and fails in German. Same width. Same font. Same component. Different string, different outcome.

The failure message is the point. Before Prelight, you'd find this in a Slack screenshot from a user in Berlin. With Prelight, you find it in your local test run in 4ms — and the failure message tells you exactly what happened.

## PRELIGHT-NEXT(v0.1-phaseC)

- [ ] `Button.tsx` — a minimally realistic button component.
- [ ] `Button.test.ts` — the failing test. Uses `@prelight/vitest`.
- [ ] Craft the failure message. This is not decoration; it's the story.
- [ ] README body: before/after narrative with timings.
