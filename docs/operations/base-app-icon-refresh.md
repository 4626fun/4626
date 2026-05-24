# Base App domain-bar icon refresh

Base App shows two different icon surfaces:

1. **Domain bar while browsing** — usually fetches `/favicon.ico` (no `?v=`) and may still hit legacy paths such as `/app-icon.png`.
2. **Launcher tile / project chrome** — after the April 2026 Base migration, icon metadata for registered projects lives on [base.dev](https://base.dev) and may **not** auto-refresh when the website favicon changes.

4626 project id: `695a49dc4d3a403912ed8ca5`.

## What changed in v15

- Icon source switched from full-bleed `base-app-icon-1024.png` to **`logo-mark-opaque-1024.png`** (white `4` on rounded black tile).
- Legacy root PNGs are regenerated again so crawlers do not receive SPA HTML at 200:
  - `/app-icon.png` (1024)
  - `/pwa-512.png` (512)
  - `/miniapp-icon.png` (200)
  - `/miniapp-hero.png` (og-image dimensions)
- `brandAssetVersion` bumped in `frontend/shared/site-config.json`; run `pnpm -C frontend generate:brand-icons`.

## Deploy verification

After production deploy on `main`:

```bash
# favicon bytes must differ from pre-v15 etag bd67ebdaab22f73676876ca48dda30db
curl -sI https://4626.fun/favicon.ico | grep -i etag

# legacy paths must be image/png, not text/html
curl -sI https://4626.fun/app-icon.png | grep -i content-type
curl -sI https://4626.fun/pwa-512.png | grep -i content-type

# farcaster manifest must point at v15 miniapp icon
curl -s https://4626.fun/.well-known/farcaster.json | jq '.miniapp.iconUrl, .miniapp.version'
```

## Manual step (often required)

1. Open the 4626 project on [base.dev](https://base.dev).
2. Re-upload the app icon using `frontend/public/assets/logo-mark-opaque-1024.png` (or the generated `base-miniapp-icon-v15-200.png`).
3. Save/publish project metadata.
4. Force-quit and reopen Base App (client icon cache is aggressive).

Website-only favicon updates are insufficient when Base still serves the old blue gradient squircle from base.dev or from a cached `/app-icon.png` fetch.
