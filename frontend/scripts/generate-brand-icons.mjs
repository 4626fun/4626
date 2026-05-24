#!/usr/bin/env node
/**
 * Regenerate favicon/PWA PNG derivatives from the canonical opaque app mark.
 *
 * Source of truth: public/assets/logo-mark-opaque-1024.png (white 4 on rounded black tile).
 * Versioned filenames come from shared/site-config.json so Base App cannot reuse
 * stale cache entries keyed only by path (query strings are often ignored).
 *
 * Also restores legacy root paths (app-icon.png, pwa-512.png, …) that Base App and
 * older crawlers may still fetch instead of /favicon.ico.
 *
 * Usage:
 *   node scripts/generate-brand-icons.mjs --out public
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import sharp from 'sharp'

const execFileAsync = promisify(execFile)

function parseArg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function loadSiteConfig(root) {
  const siteConfigPath = path.join(root, 'shared/site-config.json')
  return JSON.parse(await fs.readFile(siteConfigPath, 'utf8'))
}

function assetBasename(assetPath) {
  return String(assetPath ?? '').replace(/^\/assets\//, 'assets/')
}

function buildDerivativePlan(siteConfig) {
  const favicon32 = assetBasename(siteConfig.assets?.favicon32)
  const appleTouchIcon = assetBasename(siteConfig.assets?.appleTouchIcon)
  const miniappIcon = assetBasename(siteConfig.assets?.miniappIcon)

  const pngDerivatives = [
    { size: 16, file: 'assets/favicon-16x16.png' },
    { size: 32, file: 'assets/favicon-32x32.png' },
    { size: 32, file: 'assets/app-tab-icon-32.png' },
    { size: 32, file: favicon32 },
    { size: 48, file: 'assets/favicon-48x48.png' },
    { size: 64, file: 'assets/favicon-64x64.png' },
    { size: 180, file: 'assets/apple-touch-icon.png' },
    { size: 180, file: 'assets/app-tab-icon-180.png' },
    { size: 180, file: appleTouchIcon },
    { size: 192, file: 'assets/android-chrome-192x192.png' },
    { size: 512, file: 'assets/android-chrome-512x512.png' },
    { size: 150, file: 'assets/mstile-150x150.png' },
    { size: 200, file: miniappIcon },
  ]

  const rootCompatibilityCopies = [
    ['assets/favicon-brand.ico', 'favicon.ico'],
    ['assets/favicon.svg', 'favicon.svg'],
    ['assets/apple-touch-icon.png', 'apple-touch-icon.png'],
    ['assets/apple-touch-icon.png', 'apple-touch-icon-precomposed.png'],
    [favicon32, 'favicon-32x32.png'],
    ['assets/favicon-16x16.png', 'favicon-16x16.png'],
    [miniappIcon, 'icon.png'],
    ['assets/logo-mark-1024.png', 'logo.png'],
    ['assets/og-image.png', 'og.png'],
    // Legacy Base App / PWA paths that must stay real PNGs (not SPA HTML fallthrough).
    ['assets/base-app-icon-1024.png', 'app-icon.png'],
    ['assets/android-chrome-512x512.png', 'pwa-512.png'],
    ['assets/android-chrome-512x512.png', 'icon-512.png'],
    ['assets/android-chrome-192x192.png', 'icon-192.png'],
    [miniappIcon, 'miniapp-icon.png'],
    ['assets/og-image.png', 'miniapp-hero.png'],
  ]

  return { pngDerivatives, rootCompatibilityCopies, favicon32 }
}

const docsBrandCopies = [
  ['assets/logo-mark.svg', 'brand/logo.svg'],
  ['assets/favicon.svg', 'brand/favicon.svg'],
]

const MASKABLE_DERIVATIVES = [
  { size: 192, file: 'assets/maskable-icon-192x192.png' },
  { size: 512, file: 'assets/maskable-icon-512x512.png' },
]

async function writeSquareIcon(source, outPath, size, { maskableSafeZone = false } = {}) {
  const innerSize = maskableSafeZone ? Math.round(size * 0.8) : size
  const resized = await sharp(source).resize(innerSize, innerSize, { fit: 'contain' }).png().toBuffer()

  if (!maskableSafeZone) {
    await sharp(resized).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
    return
  }

  await sharp(resized).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
}

async function writeFaviconIco(outDir, source32Path) {
  const icoPath = path.join(outDir, 'assets/favicon-brand.ico')
  try {
    await execFileAsync('convert', [
      source32Path,
      '-define',
      'icon:auto-resize=16,32,48',
      icoPath,
    ])
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('ImageMagick convert unavailable; copying 32px PNG as favicon fallback', error?.message ?? error)
    await fs.copyFile(source32Path, icoPath)
  }
}

async function regeneratePngDerivatives(outDir, sourcePath, pngDerivatives, favicon32) {
  for (const { size, file } of pngDerivatives) {
    const outPath = path.join(outDir, file)
    await writeSquareIcon(sourcePath, outPath, size)
  }

  for (const { size, file } of MASKABLE_DERIVATIVES) {
    const outPath = path.join(outDir, file)
    await writeSquareIcon(sourcePath, outPath, size, { maskableSafeZone: true })
  }

  await writeFaviconIco(outDir, path.join(outDir, favicon32))
}

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

async function removeObsoleteVersionedIcons(outDir, currentVersion) {
  const assetsDir = path.join(outDir, 'assets')
  const entries = await fs.readdir(assetsDir)
  const obsoletePattern = new RegExp(
    `^(domain-bar-icon-v(?!${currentVersion}-)\\d+-(?:32|180)|base-miniapp-icon-v(?!${currentVersion}-)\\d+-200)\\.png$`,
  )

  for (const entry of entries) {
    if (!obsoletePattern.test(entry)) continue
    await fs.rm(path.join(assetsDir, entry), { force: true })
    // eslint-disable-next-line no-console
    console.log(`removed obsolete icon asset: assets/${entry}`)
  }

  for (const legacy of ['domain-bar-icon-32.png', 'domain-bar-icon-180.png', 'base-miniapp-icon-200.png']) {
    const legacyPath = path.join(assetsDir, legacy)
    if (await exists(legacyPath)) {
      await fs.rm(legacyPath, { force: true })
      // eslint-disable-next-line no-console
      console.log(`removed unversioned legacy icon asset: assets/${legacy}`)
    }
  }
}

async function main() {
  const root = process.cwd()
  const outRel = parseArg('--out', 'public')
  const outDir = path.resolve(root, outRel)
  const siteConfig = await loadSiteConfig(root)
  const version = Number(siteConfig.brandAssetVersion ?? 3)
  const { pngDerivatives, rootCompatibilityCopies, favicon32 } = buildDerivativePlan(siteConfig)
  const sourcePath = path.join(outDir, 'assets/logo-mark-opaque-1024.png')

  if (!(await exists(sourcePath))) {
    // eslint-disable-next-line no-console
    console.error(`Missing canonical icon source: ${sourcePath}`)
    process.exitCode = 1
    return
  }

  // Keep square full-bleed and opaque tile exports aligned for agent-registration URLs.
  await fs.copyFile(sourcePath, path.join(outDir, 'assets/base-app-icon-1024.png'))
  await fs.copyFile(sourcePath, path.join(outDir, 'assets/logo-mark-1024.png'))

  await regeneratePngDerivatives(outDir, sourcePath, pngDerivatives, favicon32)

  const syncedRoot = await syncCompatibilityAssets(outDir, rootCompatibilityCopies, 'root compatibility icons')
  if (!syncedRoot) return

  const syncedDocsBrand = await syncCompatibilityAssets(outDir, docsBrandCopies, 'docs-site brand icons')
  if (!syncedDocsBrand) return

  await removeObsoleteVersionedIcons(outDir, version)

  // eslint-disable-next-line no-console
  console.log(`regenerated favicon/PWA PNG derivatives from assets/logo-mark-opaque-1024.png in ${outRel}`)
  // eslint-disable-next-line no-console
  console.log('synced root compatibility icons and docs-site brand/favicon.svg + brand/logo.svg from canonical assets')
}

await main()
