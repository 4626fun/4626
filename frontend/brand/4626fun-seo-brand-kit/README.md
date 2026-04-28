# 4626.fun SEO + Brand Asset Pack

This folder contains a complete web/SEO asset set for **4626.fun** using the provided logo artwork.

## Included

- Favicons and app icons in common web, Apple, Android, Windows, and PWA sizes.
- `favicon.ico`, `favicon.svg`, `site.webmanifest`, and `browserconfig.xml`.
- Horizontal, stacked, and icon-only logo lockups.
- Transparent PNG versions and warm-light background versions.
- SVG wrappers for icon, horizontal lockup, stacked lockup, mask icon, and favicon.
- Open Graph, Twitter, LinkedIn, Facebook, YouTube, and profile avatar images.
- HTML and Next.js metadata snippets.
- Brand color tokens, palette, and usage notes.
- Asset manifests in CSV and JSON.

## Quick install

Copy these to your website public root:

```text
favicon.ico
favicon.svg
site.webmanifest
browserconfig.xml
apple-touch-icon.png
android-chrome-192x192.png
android-chrome-512x512.png
favicons/
logo/
social/
```

Then paste the contents of:

```text
install/html-head-snippet.html
```

inside your page `<head>`.

## Suggested defaults

- Website header logo: `web/logo-horizontal-transparent-640w.png`
- Favicon: `favicon.ico`
- Apple touch icon: `favicons/apple-touch-icon.png`
- PWA manifest: `site.webmanifest`
- Open Graph image: `social/og-image-1200x630.png`
- Twitter image: `social/twitter-summary-large-image-1200x675.png`
- Square social/avatar: `social/social-profile-avatar-1080x1080.png`

## Transparency note

The icon-only assets are true-alpha PNGs. The clean transparent lockups are rebuilt from the true-alpha icon plus a transparent wordmark extraction so they do not contain a fake checkerboard background.
