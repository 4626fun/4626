#!/usr/bin/env node
/**
 * Retired screenshot capture entrypoint.
 *
 * Mini App, PWA, favicon, and social preview assets now come from the canonical
 * 4626.fun SEO brand kit under `public/favicons/`, `public/logo/`, and
 * `public/social/`. This command intentionally does not write root-level
 * legacy assets such as `miniapp-hero.png` or `screenshot-deploy.png`.
 */

// eslint-disable-next-line no-console
console.log(
  'capture:app-screens is retired for brand assets; use public/social/ and public/favicons/ from the SEO brand kit.',
)
