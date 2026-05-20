#!/usr/bin/env node
/**
 * Brand asset generator.
 *
 * Why:
 * - Browser tabs, install surfaces, and mobile shells require PNG derivatives
 *   with fixed dimensions.
 * - The 4626 v2 brand kit is now the canonical source for favicon/PWA
 *   images, committed under `public/assets/`.
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

const rootCompatibilityCopies = [
  ['assets/favicon.ico', 'favicon.ico'],
  ['assets/favicon.svg', 'favicon.svg'],
  ['assets/apple-touch-icon.png', 'apple-touch-icon.png'],
  ['assets/logo-mark-1024.png', 'icon.png'],
  ['assets/logo-mark-1024.png', 'logo.png'],
  ['assets/og-image.png', 'og.png'],
]

const docsBrandCopies = [
  ['assets/logo-mark.svg', 'brand/logo.svg'],
  ['assets/favicon.svg', 'brand/favicon.svg'],
]

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
  'apple-touch-icon.png',
  'site.webmanifest',
  'browserconfig.xml',
  'assets/favicon-16x16.png',
  'assets/favicon-32x32.png',
  'assets/favicon-48x48.png',
  'assets/favicon-64x64.png',
  'assets/android-chrome-192x192.png',
  'assets/android-chrome-512x512.png',
  'assets/apple-touch-icon.png',
  'assets/maskable-icon-192x192.png',
  'assets/maskable-icon-512x512.png',
  'assets/mstile-150x150.png',
  'assets/safari-pinned-tab.svg',
]

async function syncCompatibilityAssets(outDir, copies, label) {
  for (const [sourceRelativePath, destRelativePath] of copies) {
    const sourcePath = path.join(outDir, sourceRelativePath)
    const destPath = path.join(outDir, destRelativePath)

    if (!(await exists(sourcePath))) {
      // eslint-disable-next-line no-console
      console.error(`Missing canonical source for ${label}: ${sourceRelativePath}`)
      process.exitCode = 1
      return false
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.copyFile(sourcePath, destPath)
  }

  return true
}

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
    console.error(`Missing v2 brand-kit icon assets in ${outRel}: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  const syncedRoot = await syncCompatibilityAssets(outDir, rootCompatibilityCopies, 'root compatibility icons')
  if (!syncedRoot) return

  const syncedDocsBrand = await syncCompatibilityAssets(outDir, docsBrandCopies, 'docs-site brand icons')
  if (!syncedDocsBrand) return

  // eslint-disable-next-line no-console
  console.log(`verified committed v2 brand-kit icon assets in ${outRel}`)
  // eslint-disable-next-line no-console
  console.log('synced root compatibility icons and docs-site brand/favicon.svg + brand/logo.svg from canonical assets')
}

await verifyCanonicalKitIconAssets()
