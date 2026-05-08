#!/usr/bin/env node
/**
 * Retired screenshot capture entrypoint.
 *
 * Mini App, PWA, favicon, and social preview assets now come from the canonical
 * 4626 v2 brand kit under `public/assets/`. This command intentionally does not write root-level
 * legacy assets such as `miniapp-hero.png` or `screenshot-deploy.png`.
 */

// eslint-disable-next-line no-console
console.log(
  'capture:app-screens is retired for brand assets; use public/assets/ from the v2 brand kit.',
)
