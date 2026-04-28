#!/usr/bin/env node
/**
 * Brand asset generator.
 *
 * Why:
 * - Browser tabs, install surfaces, and mobile shells require PNG derivatives
 *   with fixed dimensions.
 * - The 4626.fun SEO brand kit is now the canonical source for favicon/PWA
 *   images, committed under `public/favicons/`.
 * - This script is kept for existing operator muscle memory, but no longer
 *   regenerates stale root-level favicon and PWA PNGs.
 *
 * This script verifies the committed kit assets are present.
 *
 * Usage:
 *   node scripts/generate-brand-icons.mjs --out public
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback
}

function exists(p) {
  return fs
    .stat(p)
    .then(() => true)
    .catch(() => false)
}

const requiredKitIconAssets = [
  'favicon.ico',
  'favicon.svg',
  'site.webmanifest',
  'browserconfig.xml',
  'favicons/favicon-16x16.png',
  'favicons/favicon-32x32.png',
  'favicons/favicon-192x192.png',
  'favicons/favicon-512x512.png',
  'favicons/apple-touch-icon.png',
  'favicons/maskable-icon-192x192.png',
  'favicons/maskable-icon-512x512.png',
  'favicons/mstile-150x150.png',
  'favicons/mstile-310x310.png',
  'favicons/safari-pinned-tab.svg',
]

async function verifyCanonicalKitIconAssets() {
  const root = process.cwd()
  const outRel = parseArg('--out', 'public')
  const outDir = path.resolve(root, outRel)
  const missing = []

  for (const relativePath of requiredKitIconAssets) {
    if (!(await exists(path.join(outDir, relativePath)))) {
      missing.push(relativePath)
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing SEO brand-kit icon assets in ${outRel}: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line no-console
  console.log(`verified committed SEO brand-kit icon assets in ${outRel}`)
}

await verifyCanonicalKitIconAssets()
