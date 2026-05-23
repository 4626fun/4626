#!/usr/bin/env node
/**
 * Regenerate favicon/PWA PNG derivatives from the canonical Base App icon.
 *
 * Source of truth: public/assets/base-app-icon-1024.png (white 4 on black).
 * Use fresh filenames for domain-bar assets so Base App cannot reuse stale cache
 * entries keyed only by path (query strings are often ignored).
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

const rootCompatibilityCopies = [
  ['assets/favicon-brand.ico', 'favicon.ico'],
  ['assets/favicon.svg', 'favicon.svg'],
  ['assets/apple-touch-icon.png', 'apple-touch-icon.png'],
  ['assets/base-miniapp-icon-200.png', 'icon.png'],
  ['assets/logo-mark-1024.png', 'logo.png'],
  ['assets/og-image.png', 'og.png'],
]

const docsBrandCopies = [
  ['assets/logo-mark.svg', 'brand/logo.svg'],
  ['assets/favicon.svg', 'brand/favicon.svg'],
]

const PNG_DERIVATIVES = [
  { size: 16, file: 'assets/favicon-16x16.png' },
  { size: 32, file: 'assets/favicon-32x32.png' },
  { size: 32, file: 'assets/app-tab-icon-32.png' },
  { size: 32, file: 'assets/domain-bar-icon-32.png' },
  { size: 48, file: 'assets/favicon-48x48.png' },
  { size: 64, file: 'assets/favicon-64x64.png' },
  { size: 180, file: 'assets/apple-touch-icon.png' },
  { size: 180, file: 'assets/app-tab-icon-180.png' },
  { size: 180, file: 'assets/domain-bar-icon-180.png' },
  { size: 192, file: 'assets/android-chrome-192x192.png' },
  { size: 512, file: 'assets/android-chrome-512x512.png' },
  { size: 150, file: 'assets/mstile-150x150.png' },
  { size: 200, file: 'assets/base-miniapp-icon-200.png' },
]

const MASKABLE_DERIVATIVES = [
  { size: 192, file: 'assets/maskable-icon-192x192.png' },
  { size: 512, file: 'assets/maskable-icon-512x512.png' },
]

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

async function writeSquareIcon(source, outPath, size, { maskableSafeZone = false } = {}) {
  const innerSize = maskableSafeZone ? Math.round(size * 0.8) : size
  const resized = await sharp(source).resize(innerSize, innerSize, { fit: 'contain' }).png().toBuffer()

  if (!maskableSafeZone) {
    await sharp(resized).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
    return
  }

  // Keep maskable assets aligned with the full-bleed tab icon (no blue bezel safe-zone inset).
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

async function regeneratePngDerivatives(outDir, sourcePath) {
  for (const { size, file } of PNG_DERIVATIVES) {
    const outPath = path.join(outDir, file)
    await writeSquareIcon(sourcePath, outPath, size)
  }

  for (const { size, file } of MASKABLE_DERIVATIVES) {
    const outPath = path.join(outDir, file)
    await writeSquareIcon(sourcePath, outPath, size, { maskableSafeZone: true })
  }

  await writeFaviconIco(outDir, path.join(outDir, 'assets/domain-bar-icon-32.png'))
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

async function main() {
  const root = process.cwd()
  const outRel = parseArg('--out', 'public')
  const outDir = path.resolve(root, outRel)
  const sourcePath = path.join(outDir, 'assets/base-app-icon-1024.png')

  if (!(await exists(sourcePath))) {
    // eslint-disable-next-line no-console
    console.error(`Missing canonical icon source: ${sourcePath}`)
    process.exitCode = 1
    return
  }

  await regeneratePngDerivatives(outDir, sourcePath)

  const syncedRoot = await syncCompatibilityAssets(outDir, rootCompatibilityCopies, 'root compatibility icons')
  if (!syncedRoot) return

  const syncedDocsBrand = await syncCompatibilityAssets(outDir, docsBrandCopies, 'docs-site brand icons')
  if (!syncedDocsBrand) return

  // eslint-disable-next-line no-console
  console.log(`regenerated favicon/PWA PNG derivatives from assets/base-app-icon-1024.png in ${outRel}`)
  // eslint-disable-next-line no-console
  console.log('synced root compatibility icons and docs-site brand/favicon.svg + brand/logo.svg from canonical assets')
}

await main()
