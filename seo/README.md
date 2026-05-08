# 4626.fun SEO Folder

This folder is retained as a lightweight pointer to the active 4626.fun brand system.
Canonical deployable assets now live in `frontend/public/assets/`.

## Active Assets

- `frontend/public/assets/` — favicon, Android, Apple, maskable, Microsoft tile, logo, product, and social preview assets.
- `frontend/public/site.webmanifest` — PWA install manifest.
- `frontend/public/browserconfig.xml` — Microsoft tile metadata.
- `frontend/shared/site-config.json` and `frontend/src/config/site.ts` — canonical URL, metadata, color, and asset-path references.

## Recommended install

For a Next.js, Vite, or similar app:

1. Replace the v2 kit files in `frontend/public/assets/`.
2. Keep root compatibility files such as `frontend/public/favicon.ico` and `frontend/public/apple-touch-icon.png` aligned with the v2 assets.
3. Use `frontend/src/config/site.ts` and `frontend/shared/site-config.json` for future code references.

## Brand defaults

- Site: `https://4626.fun/`
- Title: `4626.fun - ERC-4626 Creator Vaults on Base`
- Description: `ERC-4626 creator vaults on Base.`
- Theme color: `#020204`
- Background color: `#020204`

## Note

Update `sitemap.xml`, `robots.txt`, and canonical URLs if the final production URL changes.
