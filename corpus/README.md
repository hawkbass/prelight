# corpus

Shared test corpus for Prelight. Used by `@prelight/core` unit tests, by the ground-truth harness, and by the demos.

## Layout

```
corpus/
├── languages/    # JSON files, one per language
│   ├── en.json
│   ├── de.json
│   ├── ar.json
│   ├── ja.json
│   ├── zh.json
│   ├── emoji.json
│   └── compound-words.json
└── fonts/        # bundled open-font files + licenses
    ├── Inter-Regular.ttf
    └── LICENSE
```

## Curation principles

- **Real strings.** Every corpus string should plausibly appear in a shipping product. No lorem ipsum.
- **Edge cases, not exhaustive.** The goal is to cover every *category* of layout stress: long compound words (German), narrow width stress, RTL shaping, CJK variable width, emoji grapheme clusters. Not to be a dictionary.
- **Minimal but dense.** Each language file is dozens to low hundreds of entries. Ground-truth runs sweep the full matrix; adding entries costs real CI time.

## PRELIGHT-NEXT(v0.1-phaseA)

- [ ] Curate `languages/*.json` with credit for sourcing.
- [ ] Bundle Inter as the default font with its license verbatim.
- [ ] Document the default matrix (languages × widths × scales) in code comments.
- [ ] Add a `corpus/schema.ts` so adapter packages can import typed strings.

## PRELIGHT-NEXT(v1.0)

- [ ] Add a richer font set: one CJK font, one Arabic font, one monospace for code-in-UI.
- [ ] Add a "user-generated content" corpus: long URLs, `@mentions`, emoji clusters, mixed scripts in a single string.
