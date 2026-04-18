# brand/

Source assets for the prelight wordmark and GitHub social card.

## Files

| File | Use |
| --- | --- |
| `logo.svg` | Wordmark, dark ink (`#0a0a0a`) on transparent. README on light backgrounds. |
| `logo-dark.svg` | Wordmark, light ink (`#fafafa`) on transparent. README on dark backgrounds. |
| `social-preview.svg` | 1280×640 GitHub social preview card. **Export to PNG before uploading** — GitHub's social preview field does not accept SVG. |

## Wordmark usage

In the README, serve the right ink for the viewer's theme:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./brand/logo-dark.svg">
  <img src="./brand/logo.svg" alt="prelight" width="360">
</picture>
```

GitHub also accepts the `#gh-dark-mode-only` / `#gh-light-mode-only` URL-fragment trick if you prefer a flat image tag.

## Social card export

GitHub accepts PNG / JPG at up to 1 MB for `Settings → Social preview`. To
rasterize `social-preview.svg`:

```bash
# Option A: rsvg-convert (preferred, deterministic)
rsvg-convert -w 1280 -h 640 brand/social-preview.svg > brand/social-preview.png

# Option B: Chrome/Chromium headless (portable)
chrome --headless --disable-gpu --screenshot=brand/social-preview.png \
       --window-size=1280,640 brand/social-preview.svg

# Option C: Inkscape
inkscape brand/social-preview.svg -o brand/social-preview.png \
         -w 1280 -h 640
```

Commit the SVG as source-of-truth; the generated PNG is optional to commit
(it adds ~60 KB). If a future release changes the tagline or the headline
numbers, edit the SVG and re-export.

## Typography

- Type family: **Inter** (weights 400, 500, 800). Freely licensed,
  universally installed, matches the `Inter` default used throughout the
  core library's examples.
- Fallback chain: `'Inter Tight', 'Helvetica Neue', Arial, system-ui,
  sans-serif`. Identical metrics within ~1 %.
- Wordmark tracking: `letter-spacing: -6` at 130 px and `letter-spacing: -8`
  at 180 px. Tight but not collapsed; preserves `li` readability.

## Colours

| Role | Hex | Use |
| --- | --- | --- |
| Ink | `#0a0a0a` | Primary text on light |
| Ink (dark) | `#fafafa` | Primary text on dark |
| Muted | `#999999` | Secondary text on dark |
| Muted (darker) | `#666666` | Evidence strip / metadata |
| Grid | `#1a1a1a` | Faint rules on dark |
| Surface (dark) | `#0a0a0a` | Social card background |

No accent colour yet. The visual hook is the evidence strip at the bottom
of the social card (v0.3.0 · 440 tests · 928-case corpus · 98.81 % agreement,
and the failing-german-button pixel measurement on the right). If a future
release wants a pure-accent colour, pick one that survives both light and
dark contexts — hot red `#ff3b30` is the current candidate.
