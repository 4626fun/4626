#!/usr/bin/env node
/**
 * Sync brand assets from committed starter-kit masters and render install surfaces
 * from the opaque app mark (logo-mark-opaque-1024.png).
 *
 * Logo / wordmark masters stay hand-tuned from assets/brand/master/icons/.
 * Favicon ladder, apple-touch, PWA sizes, and favicon.ico are derived from the
 * opaque rounded tile so /favicon.ico matches what Base App shows after load.
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

/** Logo/wordmark masters copied verbatim — not re-rendered. */
const MASTER_LOGO_SYNC = [
  'logo-mark-opaque-1024.png',
  'logo-mark-1024.png',
  'logo-mark-transparent.png',
  'logo-source-transparent.png',
  'logo-trimmed-transparent.png',
  'favicon.svg',
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

const OPAQUE_INSTALL_SIZES = [
  { size: 16, file: 'assets/favicon-16x16.png' },
  { size: 32, file: 'assets/favicon-32x32.png' },
  { size: 32, file: 'assets/app-tab-icon-32.png' },
  { size: 48, file: 'assets/favicon-48x48.png' },
  { size: 64, file: 'assets/favicon-64x64.png' },
  { size: 180, file: 'assets/apple-touch-icon.png' },
  { size: 180, file: 'assets/app-tab-icon-180.png' },
  { size: 192, file: 'assets/android-chrome-192x192.png' },
  { size: 512, file: 'assets/android-chrome-512x512.png' },
  { size: 150, file: 'assets/mstile-150x150.png' },
]

const MASKABLE_DERIVATIVES = [
  { size: 192, file: 'assets/maskable-icon-192x192.png' },
  { size: 512, file: 'assets/maskable-icon-512x512.png' },
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
    ['assets/favicon-32x32.png', 'favicon-32x32.png'],
    ['assets/favicon-16x16.png', 'favicon-16x16.png'],
    [miniappIcon, 'icon.png'],
    ['assets/logo-mark-1024.png', 'logo.png'],
    ['assets/og-image.png', 'og.png'],
    ['assets/base-app-icon-1024.png', 'app-icon.png'],
    ['assets/android-chrome-512x512.png', 'pwa-512.png'],
    ['assets/android-chrome-512x512.png', 'icon-512.png'],
    ['assets/android-chrome-192x192.png', 'icon-192.png'],
    [miniappIcon, 'miniapp-icon.png'],
    ['assets/base-app-icon-1024.png', 'miniapp-hero.png'],
  ]

  return { rootCompatibilityCopies, favicon32, appleTouchIcon, miniappIcon }
}

const docsBrandCopies = [
  ['assets/logo-mark.svg', 'brand/logo.svg'],
  ['assets/favicon.svg', 'brand/favicon.svg'],
]

async function writeSquareIcon(source, outPath, size, { maskableSafeZone = false } = {}) {
  const innerSize = maskableSafeZone ? Math.round(size * 0.8) : size
  const resized = await sharp(source).resize(innerSize, innerSize, { fit: 'contain' }).png().toBuffer()
  await sharp(resized).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
}

async function writeFaviconIco(outDir, opaquePath) {
  const icoPath = path.join(outDir, 'assets/favicon-brand.ico')
  const sizes = [16, 32, 48]
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(opaquePath).resize(size, size, { fit: 'cover' }).png().toBuffer()),
  )

  const png16 = path.join(outDir, 'assets/favicon-16x16.png')
  const png32 = path.join(outDir, 'assets/favicon-32x32.png')
  const png48 = path.join(outDir, 'assets/favicon-48x48.png')

  try {
    await execFileAsync('convert', [
      png16,
      png32,
      png48,
      '-define',
      'icon:auto-resize=16,32,48',
      icoPath,
    ])
  } catch (convertError) {
    // eslint-disable-next-line no-console
    console.warn('ImageMagick convert unavailable; writing 32px PNG only', convertError?.message ?? convertError)
    await fs.writeFile(icoPath, pngBuffers[1])
  }
}

async function syncMasterLogos(masterDir, outDir) {
  for (const file of MASTER_LOGO_SYNC) {
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

  return true
}

async function renderOpaqueInstallSurfaces(outDir, opaquePath, { favicon32, appleTouchIcon, miniappIcon }, masterDir) {
  for (const { size, file } of OPAQUE_INSTALL_SIZES) {
    await writeSquareIcon(opaquePath, path.join(outDir, file), size)
  }

  for (const { size, file } of MASKABLE_DERIVATIVES) {
    await writeSquareIcon(opaquePath, path.join(outDir, file), size, { maskableSafeZone: true })
  }

  await fs.copyFile(opaquePath, path.join(outDir, 'assets/base-app-icon-1024.png'))
  await fs.copyFile(path.join(outDir, 'assets/favicon-32x32.png'), path.join(outDir, favicon32))
  await fs.copyFile(path.join(outDir, 'assets/apple-touch-icon.png'), path.join(outDir, appleTouchIcon))

  const miniappDest = path.join(outDir, miniappIcon)
  const masterMiniapp200 = path.join(masterDir, 'base-miniapp-icon-200.png')
  if (await exists(masterMiniapp200)) {
    await fs.copyFile(masterMiniapp200, miniappDest)
  } else {
    await writeSquareIcon(opaquePath, miniappDest, 200)
  }

  await writeFaviconIco(outDir, opaquePath)
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
  const opaquePath = path.join(outDir, 'assets/logo-mark-opaque-1024.png')

  if (!(await exists(masterDir))) {
    // eslint-disable-next-line no-console
    console.error(`Missing starter-kit master directory: ${masterDir}`)
    process.exitCode = 1
    return
  }

  const syncedLogos = await syncMasterLogos(masterDir, outDir)
  if (!syncedLogos) return

  if (!(await exists(opaquePath))) {
    // eslint-disable-next-line no-console
    console.error(`Missing opaque app mark: ${opaquePath}`)
    process.exitCode = 1
    return
  }

  await renderOpaqueInstallSurfaces(outDir, opaquePath, plan, masterDir)

  const syncedRoot = await syncCompatibilityAssets(outDir, plan.rootCompatibilityCopies, 'root compatibility icons')
  if (!syncedRoot) return

  const syncedDocsBrand = await syncCompatibilityAssets(outDir, docsBrandCopies, 'docs-site brand icons')
  if (!syncedDocsBrand) return

  await removeObsoleteVersionedIcons(outDir, version)

  // eslint-disable-next-line no-console
  console.log(`synced logo masters and opaque-derived install surfaces into ${outRel}`)
}

await main()
