#!/usr/bin/env node
/**
 * Brand asset generator.
 *
 * Why:
 * - We keep editable source assets as SVGs in `frontend/public/`.
 * - Browser tabs, install surfaces, and mobile shells still require PNG derivatives with fixed dimensions.
 * - Those derivatives are now committed to `public/` so Vercel does not need a
 *   post-build image pipeline on every deploy.
 * - UI-derived hero and screenshot assets are intentionally generated elsewhere
 *   (`capture-app-screenshots.mjs`) so this script stays logo/icon-only.
 *
 * This script refreshes the committed PNGs in-place.
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

function pickFirstExisting(paths) {
  return (async () => {
    for (const p of paths) {
      if (await exists(p)) return p
    }
    return null
  })()
}

async function main() {
  const outRel = parseArg('--out', 'public')
  const root = process.cwd()
  const publicDir = path.resolve(root, 'public')
  const outDir = path.resolve(root, outRel)

  await fs.mkdir(outDir, { recursive: true })

  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Missing dependency: sharp. Install it and retry.')
    process.exitCode = 1
    return
  }

  const BLACK = '#000000'
  const DARK_BG = '#020617'

  async function renderPng({ inputPath, outPath, width, height, background = BLACK, fit = 'cover' }) {
    const ext = path.extname(inputPath).toLowerCase()
    const density = ext === '.svg' ? 512 : undefined

    const img = sharp(inputPath, density ? { density } : undefined)
      .resize(width, height, { fit, background })
      .flatten({ background })
      .png({ compressionLevel: 9 })

    await img.toFile(outPath)
  }

  async function renderMaskablePng({
    inputPath,
    outPath,
    size,
    background = DARK_BG,
    paddingRatio = 0.16,
  }) {
    const ext = path.extname(inputPath).toLowerCase()
    const density = ext === '.svg' ? 512 : undefined
    const innerSize = Math.max(1, Math.round(size * (1 - paddingRatio * 2)))
    const inset = Math.max(0, Math.round((size - innerSize) / 2))

    const iconBuffer = await sharp(inputPath, density ? { density } : undefined)
      .resize(innerSize, innerSize, { fit: 'contain', background })
      .flatten({ background })
      .png({ compressionLevel: 9 })
      .toBuffer()

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background,
      },
    })
      .composite([{ input: iconBuffer, left: inset, top: inset }])
      .png({ compressionLevel: 9 })
      .toFile(outPath)
  }

  const renderedPngCache = new Map()

  const tasks = [
    {
      outName: 'app-icon.png',
      width: 1024,
      height: 1024,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'favicon-16x16.png',
      width: 16,
      height: 16,
      sources: ['favicon.svg', 'brand/favicon.svg', 'brand/logo.svg'],
    },
    {
      outName: 'favicon-32x32.png',
      width: 32,
      height: 32,
      sources: ['favicon.svg', 'brand/favicon.svg', 'brand/logo.svg'],
    },
    {
      outName: 'apple-touch-icon.png',
      width: 180,
      height: 180,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg', 'brand/favicon.svg'],
    },
    {
      outName: 'miniapp-icon.png',
      width: 1024,
      height: 1024,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'icon-512.png',
      width: 512,
      height: 512,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'pwa-512.png',
      width: 512,
      height: 512,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'icon-192.png',
      width: 192,
      height: 192,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'miniapp-splash.png',
      width: 1200,
      height: 1200,
      sources: ['app-splash.svg'],
    },
  ]
  const maskableTasks = [
    {
      outName: 'pwa-512-maskable.png',
      size: 512,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
    {
      outName: 'icon-192-maskable.png',
      size: 192,
      sources: ['app-icon.svg', 'brand/logo.svg', 'favicon.svg'],
    },
  ]

  // eslint-disable-next-line no-console
  console.log(`Generating brand PNGs → ${path.relative(root, outDir)}`)

  for (const t of tasks) {
    const candidates = t.sources.map((s) => path.resolve(publicDir, s))
    const inputPath = await pickFirstExisting(candidates)
    if (!inputPath) {
      // eslint-disable-next-line no-console
      console.warn(`[brand-icons] missing source for ${t.outName} (looked for: ${t.sources.join(', ')})`)
      continue
    }

    const outPath = path.resolve(outDir, t.outName)
    const cacheKey = `${inputPath}::${t.width}x${t.height}::${BLACK}`
    const cachedRender = renderedPngCache.get(cacheKey)
    if (cachedRender) {
      await fs.copyFile(cachedRender, outPath)
      // eslint-disable-next-line no-console
      console.log(`[brand-icons] ${t.outName} (${t.width}x${t.height}) ← ${path.relative(root, cachedRender)} (cached copy)`)
      continue
    }

    await renderPng({ inputPath, outPath, width: t.width, height: t.height })
    renderedPngCache.set(cacheKey, outPath)
    // eslint-disable-next-line no-console
    console.log(`[brand-icons] ${t.outName} (${t.width}x${t.height}) ← ${path.relative(root, inputPath)}`)
  }

  for (const t of maskableTasks) {
    const candidates = t.sources.map((s) => path.resolve(publicDir, s))
    const inputPath = await pickFirstExisting(candidates)
    if (!inputPath) {
      // eslint-disable-next-line no-console
      console.warn(`[brand-icons] missing source for ${t.outName} (looked for: ${t.sources.join(', ')})`)
      continue
    }

    const outPath = path.resolve(outDir, t.outName)
    await renderMaskablePng({ inputPath, outPath, size: t.size })
    // eslint-disable-next-line no-console
    console.log(`[brand-icons] ${t.outName} (${t.size}x${t.size}) ← ${path.relative(root, inputPath)} (maskable)`)
  }

}

await main()
