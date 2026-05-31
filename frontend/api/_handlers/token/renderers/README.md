# Token icon renderers

| Id | Path | Role |
| --- | --- | --- |
| `premium-classic` | `premium-classic/` | Production Sharp compose (bezel, chamber, breakout). Default for `/api/token/image`. |
| `premium-v2` | `premium-v2/` | Fuji LUT + rembg bg darken, v2 card/moat background, platinum bezel, hybrid glow. Offline compare until sign-off. |
| `fuji-lut-experimental` | `fuji-lut-experimental/` | Pre-grades `sourceImage` / `heroCutoutSourceImage` with CPU 3DL LUT, then delegates to classic. |

**Breakout:** When Zora supplies `heroCutoutArtworkUrl`, `/api/token/image` passes `allowHeroCutoutBreakoutForNonPixelArt` + `renderPreset: hero` so the subject pops above the frame (same opt-in as Hermit avatars). Without a hero cutout, breakout may still come from rembg segmentation when enabled.

## Offline A/B

```bash
pnpm -C frontend exec tsx scripts/compare-token-icon-renderers.ts \
  --source ./path/to/sample.png \
  --out ./tmp/token-icon-compare
```

Do not set `TOKEN_ICON_RENDERER=fuji-lut-experimental` in production until compare PNGs look good.

## Env (Phase G1, after sign-off)

- `TOKEN_ICON_RENDERER` — `premium-classic` (default), `premium-v2`, or `fuji-lut-experimental`

**premium-v2 tuning (offline):**

- `TOKEN_ICON_V2_LUT_INTENSITY` — Fuji 3DL mix (default `0.36`)
- `TOKEN_ICON_V2_GLOW_TINT` — `white` | `blue` | `hybrid` (default `hybrid`)
- `TOKEN_ICON_V2_BACKGROUND_DARKEN` — rembg mask darken on photo bg (default on; set `0` to disable)
- `TOKEN_ICON_V2_BACKGROUND_BRIGHTNESS` — bg brightness multiplier (default `0.62`)

LUT assets: `frontend/server/_lib/image/luts/` (see `fuji-attribution.md`).
