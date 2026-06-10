## Brand Masters

This directory is the canonical staging area for master brand assets before they are translated into repo-owned source files and generated outputs.

### Icon starter kit (`master/icons/`)

The hand-tuned favicon and logo PNG ladder lives in `master/icons/`. It was imported from `4626-web-starter-v2.zip` (May 2026) and is the **only** source `pnpm generate:brand-icons` uses for:

- `logo-mark-opaque-1024.png` — app / Base mini-app tile (white 4 on rounded black square)
- `logo-mark-1024.png` — full-bleed mark for JSON-LD / social (do not conflate with opaque)
- `favicon.ico` and the 16–64 PNG favicon ladder
- `apple-touch-icon`, Android Chrome, maskable, and mstile sizes

Do not re-render these with Sharp or ImageMagick in CI — edit the masters here, then run `pnpm -C frontend generate:brand-icons`.

### Logo master intake

- `master/logo-master-1024.png` — optional higher-fidelity intake (redraw into `master/icons/` when replacing the mark)

Workflow:

1. Put the highest-fidelity logo master in `master/icons/` (or intake via `master/logo-master-1024.png` then export sizes).
2. Run `pnpm -C frontend generate:brand-icons` to sync into `public/assets/` and root compatibility paths.
3. Bump `brandAssetVersion` in `shared/site-config.json` when Base App cache busting is needed.

Do not treat files in `public/` as the long-term creative master. `public/` holds deploy outputs synced from `master/icons/`.
