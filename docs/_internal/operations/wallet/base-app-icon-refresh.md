# Base App domain-bar icon refresh

Base App shows two different icon surfaces:

1. **Domain bar while browsing** — usually fetches `/favicon.ico` (no `?v=`) and may still hit legacy paths such as `/app-icon.png`.
2. **Launcher tile / project chrome** — after the April 2026 Base migration, icon metadata for registered projects lives on [base.dev](https://base.dev) and may **not** auto-refresh when the website favicon changes.

4626 project id: `695a49dc4d3a403912ed8ca5`.

## What changed in v17

- HTML shells (`html-shells/` + static pages) emit **one** tag: `<link rel="icon" href="/favicon.ico" sizes="any" />`.
- Install surfaces (favicon ladder, `.ico`, apple-touch, PWA sizes) are **derived from `logo-mark-opaque-1024.png`** so the domain bar and signature modal match the rounded-tile mark.
- Logo/wordmark masters (`logo-mark-1024.png`, SVGs) stay hand-tuned from the starter kit.

Prior v16 notes still apply for legacy root paths and base.dev re-upload.

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

After April 2026, Base App treats apps as **standard web apps** and reads launcher/domain metadata from the **[base.dev](https://base.dev) project** (`695a49dc4d3a403912ed8ca5`). Website HTML/manifest fixes alone may not change the domain-bar icon until base.dev and the Base App client cache are refreshed.

1. Open the 4626 project on [base.dev](https://base.dev).
2. Re-upload the app icon using `frontend/public/assets/logo-mark-opaque-1024.png` (white **4** on black rounded tile — not `og-image.png` or `logo-mark-blue.svg`).
3. Save/publish project metadata and confirm the preview shows the white-4 tile.
4. Force-quit Base App completely (not background) and reopen.

Website-only favicon updates are insufficient when Base still serves the old blue gradient squircle from base.dev or from a cached `/favicon.ico` fetch (Base requests `/favicon.ico` **without** `?v=`).

### Regenerate `/favicon.ico` after icon changes

```bash
pnpm -C frontend generate:brand-icons
```

This rebuilds `public/favicon.ico` as a **multi-size ICO** (16/32/48) from `logo-mark-opaque-1024.png` via `to-ico`. Verify the bytes changed:

```bash
curl -sI https://4626.fun/favicon.ico | grep -i etag
# etag must differ from pre-v20 value 052129f3b02e7f47a194958bcc48aa90
```

**Do not point legacy root `miniapp-hero.png` at `og-image.png`.** `pnpm generate:brand-icons` copies the opaque `base-app-icon-1024.png` tile there so crawlers that still request `/miniapp-hero.png` do not get the blue-glow social card.

**`4626.fun/` is `public/immersive/index.html`.** A later immersive-only revert can strip `base:app_id` / `fc:miniapp` from that file even when SPA shells are correct. `sync-static-favicon-head.mjs` re-injects the Base meta block (marked with `@4626/base-app-head` comments) on every `generate:brand-icons` run.

**`/.well-known/farcaster.json` `heroImageUrl` / `screenshotUrls`** must use the same white-4 tile as `iconUrl`, not `og-image.png`, or Base alternates between blue-glow and tile on refresh.

## Pinata / IPFS (not the app icon)

Live 4626 **app** icon surfaces (`favicon.ico`, `farcaster.json` `iconUrl`, `fc:miniapp` splash) are **local** under `frontend/public/` — not Pinata.

Historical note: the first Base miniapp shell (removed ~Jan 2026) used a Pinata gateway favicon:

```html
<link rel="icon" href="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" />
```

If [base.dev](https://base.dev) project `695a49dc4d3a403912ed8ca5` still references that CID or an old blue-squircle upload, domain-bar flicker can persist until the project icon is replaced with `logo-mark-opaque-1024.png`.

Current Pinata usage in-repo:

| Path | Purpose |
|------|---------|
| `4626.fun/ipfs/*` → `pinata.4626.fun` | Hermit meme relay only |
| Explore resource-link icons | **Self-hosted** at `/base/basescan-logo-symbol-light.svg` and `/brands/dexscreener.ico` (no Pinata fetch) |
