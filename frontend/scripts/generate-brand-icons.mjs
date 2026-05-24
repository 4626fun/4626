#!/usr/bin/env node
/**
 * Sync favicon/PWA PNG outputs from the committed starter-kit masters.
 *
 * Source of truth: assets/brand/master/icons/ (imported from 4626-web-starter-v2).
 * Hand-tuned favicon sizes and logo-mark-1024 stay intact — the script does not
 * re-render them with Sharp. Only the 200px mini-app icon is generated from the
 * opaque app mark when no master exists at that size.
 *
 * Versioned filenames (domain-bar-icon-v{N}-*, base-miniapp-icon-v{N}-200) come
 * from shared/site-config.json for Base App cache busting.
 *
 * Usage:
 *   node scripts/generate-brand-icons.mjs --out public
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import sharp from 'sharp'

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

/** Files copied verbatim from master/icons → public/assets */
const MASTER_ICON_SYNC = [
  'logo-mark-opaque-1024.png',
  'logo-mark-1024.png',
  'logo-mark-transparent.png',
  'logo-source-transparent.png',
  'logo-trimmed-transparent.png',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon-64x64.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'maskable-icon-192x192.png',
  'maskable-icon-512x512.png',
  'mstile-150x150.png',
  'logo-mark.svg',
  'logo-mark-blue.svg',
  'safari-pinned-tab.svg',
  'logo-wordmark.svg',
  'logo-mark-16.png',
  'logo-mark-32.png',
  'logo-mark-48.png',
  'logo-mark-64.png',
  'logo-mark-96.png',
  'logo-mark-180.png',
  'logo-mark-192.png',
  'logo-mark-256.png',
  'logo-mark-512.png',
]

function buildDerivativePlan(siteConfig) {
  const favicon32 = assetBasename(siteConfig.assets?.favicon32)
  const appleTouchIcon = assetBasename(siteConfig.assets?.appleTouchIcon)
  const miniappIcon = assetBasename(siteConfig.assets?.miniappIcon)

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
    ['assets/base-app-icon-1024.png', 'app-icon.png'],
    ['assets/android-chrome-512x512.png', 'pwa-512.png'],
    ['assets/android-chrome-512x512.png', 'icon-512.png'],
    ['assets/android-chrome-192x192.png', 'icon-192.png'],
    [miniappIcon, 'miniapp-icon.png'],
    ['assets/og-image.png', 'miniapp-hero.png'],
  ]

  return { rootCompatibilityCopies, favicon32, appleTouchIcon, miniappIcon }
}

const docsBrandCopies = [
  ['assets/logo-mark.svg', 'brand/logo.svg'],
  ['assets/favicon.svg', 'brand/favicon.svg'],
]

async function writeSquareIcon(source, outPath, size) {
  await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
}

async function syncMasterIcons(masterDir, outDir) {
  for (const file of MASTER_ICON_SYNC) {
    const sourcePath = path.join(masterDir, file)
    const destPath = path.join(outDir, 'assets', file)

    if (!(await exists(sourcePath))) {
      // eslint-disable-next-line no-console
      console.error(`Missing starter-kit master icon: ${sourcePath}`)
      process.exitCode = 1
      return false
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.copyFile(sourcePath, destPath)
  }

  const masterFaviconIco = path.join(masterDir, 'favicon.ico')
  const brandIco = path.join(outDir, 'assets/favicon-brand.ico')
  await fs.copyFile(masterFaviconIco, brandIco)

  const opaqueMaster = path.join(masterDir, 'logo-mark-opaque-1024.png')
  await fs.copyFile(opaqueMaster, path.join(outDir, 'assets/base-app-icon-1024.png'))

  await fs.copyFile(path.join(outDir, 'assets/favicon-32x32.png'), path.join(outDir, 'assets/app-tab-icon-32.png'))
  await fs.copyFile(path.join(outDir, 'assets/apple-touch-icon.png'), path.join(outDir, 'assets/app-tab-icon-180.png'))

  return true
}

async function syncVersionedIcons(outDir, { favicon32, appleTouchIcon, miniappIcon }, masterDir) {
  await fs.copyFile(path.join(outDir, 'assets/favicon-32x32.png'), path.join(outDir, favicon32))
  await fs.copyFile(path.join(outDir, 'assets/apple-touch-icon.png'), path.join(outDir, appleTouchIcon))

  const miniappDest = path.join(outDir, miniappIcon)
  const masterMiniapp200 = path.join(masterDir, 'base-miniapp-icon-200.png')
  if (await exists(masterMiniapp200)) {
    await fs.copyFile(masterMiniapp200, miniappDest)
    return
  }

  const opaqueSource = path.join(outDir, 'assets/logo-mark-opaque-1024.png')
  await writeSquareIcon(opaqueSource, miniappDest, 200)
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
  const masterDir = path.resolve(root, 'assets/brand/master/icons')
  const siteConfig = await loadSiteConfig(root)
  const version = Number(siteConfig.brandAssetVersion ?? 3)
  const plan = buildDerivativePlan(siteConfig)

  if (!(await exists(masterDir))) {
    // eslint-disable-next-line no-console
    console.error(`Missing starter-kit master directory: ${masterDir}`)
    process.exitCode = 1
    return
  }

  const syncedMasters = await syncMasterIcons(masterDir, outDir)
  if (!syncedMasters) return

  await syncVersionedIcons(outDir, plan, masterDir)

  const syncedRoot = await syncCompatibilityAssets(outDir, plan.rootCompatibilityCopies, 'root compatibility icons')
  if (!syncedRoot) return

  const syncedDocsBrand = await syncCompatibilityAssets(outDir, docsBrandCopies, 'docs-site brand icons')
  if (!syncedDocsBrand) return

  await removeObsoleteVersionedIcons(outDir, version)

  // eslint-disable-next-line no-console
  console.log(`synced favicon/PWA assets from assets/brand/master/icons into ${outRel}`)
  // eslint-disable-next-line no-console
  console.log('preserved hand-tuned starter-kit favicon sizes; versioned domain/miniapp paths only')
}

await main()
