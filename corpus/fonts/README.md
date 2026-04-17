# corpus/fonts

Bundled test fonts used by the ground-truth harness, the demos, and any
`@prelight/core` consumer that wants deterministic measurement across
machines.

## Files

| File | Source | Size | License |
| --- | --- | --- | --- |
| `InterVariable.ttf` | [rsms/inter v4.1](https://github.com/rsms/inter/releases/tag/v4.1) | ~880 KB | SIL Open Font License 1.1 — see [Inter-LICENSE.txt](./Inter-LICENSE.txt) |
| `NotoSansArabic.ttf` | [notofonts/arabic v2.013](https://github.com/notofonts/arabic/releases) (redistributed via [hotosm/HDM-CartoCSS](https://github.com/hotosm/HDM-CartoCSS)) | ~187 KB | SIL Open Font License 1.1 |

## Why bundle a font?

`@chenglou/pretext` measures text via `canvas.measureText()`. When a font
isn't installed on the host machine, the canvas silently falls back to
the platform's default sans-serif — which varies between Windows, macOS,
Linux, and headless-Chromium environments. That makes ground-truth
comparison meaningless: "Inter" on the dev machine ≠ "Inter" on CI ≠
"Inter" in the user's browser.

Bundling Inter (a widely-used, OFL-licensed UI font) gives us:

1. The same glyph metrics on every dev machine and CI runner
2. A stable baseline for FINDINGS entries that claim specific pixel
   counts
3. A realistic test font — Inter is what many production apps actually
   ship

## Usage from `@prelight/core`

```ts
import { ensureCanvasEnv, loadBundledFont } from '@prelight/core'
import { join } from 'node:path'

await ensureCanvasEnv()
loadBundledFont(
  join(import.meta.dir, '../../corpus/fonts/InterVariable.ttf'),
  'Inter',
)

// Now any measurement using "Inter" as the family resolves to the bundled
// file, independent of what fonts the OS has installed.
```

## Updating Inter

1. Pin the new version in [update-log.md](#update-log) below
2. Replace `InterVariable.ttf` with the new release
3. Run `bun ground-truth/run.ts` — any measurement drift will show up
4. Amend the relevant FINDINGS entry with the new measurements

## Why an Arabic font on top of Inter?

Inter doesn't ship Arabic glyphs. On the host-browser side, Chrome,
WebKit, and Firefox each fall back to a *different* system Arabic font
(Segoe UI on Windows, SF Arabic on macOS, Noto on Linux). Each has
different glyph widths and cursive-joining behaviour. On the canvas
backend side (`@napi-rs/canvas`), the fallback is different again —
and for un-shaped Arabic it over-reports widths by ~40-60%.

Bundling `NotoSansArabic.ttf` and registering it as the Arabic range
of the "Inter" family (via `unicode-range` on the browser side, a
second `GlobalFonts.registerFromPath('Inter', …)` call on the canvas
side) gives us *identical* Arabic shaping and metrics everywhere. It
lifted Arabic ground-truth agreement from 77% → ~99%. See
FINDINGS.md §F2 (Phase F: Arabic RTL fix).

## Update log

- **2026-04-16** — initial import, Inter v4.1 (InterVariable.ttf,
  sha256 recorded via `git add`).
- **2026-04-16** — Added NotoSansArabic.ttf v2.013 as the Arabic
  fallback for the "Inter" family. Chrome, WebKit, Firefox, and the
  canvas backend now all use the same Arabic font file.
