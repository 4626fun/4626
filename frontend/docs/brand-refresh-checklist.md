# Brand Refresh Checklist

Use this when you want to replace the current social, miniapp, splash, and icon assets without getting confused about which files are source versus derived output.

## Source Of Truth

Editable sources:

- `assets/brand/master/` for design masters and intake files
- `assets/social/app-hero-source.svg`
- `public/app-splash.svg`
- `public/app-icon.svg`
- `public/manifest.json`

Derived outputs:

- `public/app-hero.png`
- `public/miniapp-hero.png`
- `public/miniapp-splash.png`
- `public/app-icon.png`
- `public/miniapp-icon.png`
- `public/apple-touch-icon.png`
- `public/favicon-16x16.png`
- `public/favicon-32x32.png`
- `public/icon-192.png`
- `public/icon-192-maskable.png`
- `public/icon-512.png`
- `public/pwa-512.png`
- `public/pwa-512-maskable.png`
- `public/screenshot-swap.png`
- `public/screenshot-explore.png`
- `public/screenshot-deploy.png`
- `public/screenshot-portrait.png`
- `dist/`
- `build/`

Do not manually edit derived PNGs unless you intentionally want to replace the generated output.

## Recommended Workflow

1. Back up or commit anything you want to keep.
2. Clear current derived outputs:

```bash
pnpm -C frontend clean:derived-assets
```

3. Replace or redesign the editable source assets:

- Start from the current master in `assets/brand/master/` instead of from `tmp/` or old generated PNGs.
- `assets/social/app-hero-source.svg`
- `public/app-splash.svg`
- `public/app-icon.svg`

4. Regenerate static brand assets:

```bash
pnpm -C frontend generate:brand-assets:static
```

5. If you want fresh UI-based preview screenshots, start the frontend and capture them:

```bash
pnpm -C frontend dev
# in another terminal
pnpm -C frontend capture:app-screens
```

6. Verify generated shell and asset references:

```bash
pnpm -C frontend check:html-shells
pnpm -C frontend exec vitest run src/lib/manifestAssets.test.ts
```

7. If you changed browser-visible metadata or page copy, run:

```bash
pnpm -C frontend typecheck
```

## What Each Command Does

- `pnpm -C frontend clean:derived-assets`
  Removes generated PNG assets from `public/` and clears `dist/` and `build/`.
- `pnpm -C frontend generate:social-preview`
  Rebuilds `public/app-hero.png` from `assets/social/app-hero-source.svg`.
- `pnpm -C frontend generate:brand-icons`
  Rebuilds icon and splash derivatives from `public/app-icon.svg` and `public/app-splash.svg`.
- `pnpm -C frontend generate:brand-assets:static`
  Runs the two static brand generation steps together.
- `pnpm -C frontend capture:app-screens`
  Rebuilds `miniapp-hero.png` and the manifest screenshot PNGs from the running UI.

## Asset Ownership

- `app-hero.png`
  Marketing/social card. Curated static asset.
- `miniapp-hero.png`
  Miniapp / Telegram preview. UI-derived screenshot asset.
- `miniapp-splash.png`
  Splash asset for miniapp metadata.
- Manifest screenshots
  Install-surface screenshots referenced by `public/manifest.json`.

## Safety Notes

- `dist/manifest.json` is generated output. Ignore it during asset design work.
- Keep design masters in `assets/brand/master/`; treat `tmp/` as scratch space only.
- Do not delete `public/manifest.json`; it is source.
- Do not delete the SVG sources if you want to regenerate assets later.
- Social cards should stay opaque unless you have a specific reason not to.
- Transparency is safest for icon/logo-family assets, not for OG/Twitter share cards.
