#!/usr/bin/env node
/**
 * Post-build asset generator (Vercel-safe).
 *
 * Why:
 * - We keep source assets as SVGs in `frontend/public/` (tracked, editable).
 * - Some platform surfaces + PWA require specific PNG dimensions and "no alpha".
 * - Vite copies `public/` as-is into `dist/`, but does not generate PNG derivatives.
 *
 * This script generates required PNGs into the build output folder (default: dist/).
 *
 * Usage:
 *   node scripts/generate-brand-icons.mjs --out dist
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
  const outRel = parseArg('--out', 'dist')
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

  async function renderPng({ inputPath, outPath, width, height, background = BLACK }) {
    const ext = path.extname(inputPath).toLowerCase()
    const density = ext === '.svg' ? 512 : undefined

    const img = sharp(inputPath, density ? { density } : undefined)
      .resize(width, height, { fit: 'cover' })
      .flatten({ background })
      .png({ compressionLevel: 9 })

    await img.toFile(outPath)
  }

  const tasks = [
    // App metadata assets
    {
      outName: 'app-icon.png',
      width: 1024,
      height: 1024,
      sources: ['app-icon.png', 'app-icon.svg', 'logo.svg', 'favicon.svg'],
    },
    {
      outName: 'app-splash.png',
      width: 200,
      height: 200,
      sources: ['app-splash.png', 'app-splash.svg', 'app-icon.svg', 'logo.svg'],
    },
    {
      outName: 'app-hero.png',
      width: 1200,
      height: 630,
      sources: ['app-hero.png', 'app-hero.svg'],
    },
    {
      outName: 'screenshot-1.png',
      width: 1284,
      height: 2778,
      sources: ['screenshot-1.png', 'screenshot-portrait.png', 'screenshot-portrait.svg'],
    },
    {
      outName: 'screenshot-2.png',
      width: 1284,
      height: 2778,
      sources: ['screenshot-2.png', 'screenshot-portrait.png', 'screenshot-portrait.svg'],
    },
    {
      outName: 'screenshot-3.png',
      width: 1284,
      height: 2778,
      sources: ['screenshot-3.png', 'screenshot-portrait.png', 'screenshot-portrait.svg'],
    },

    // Favicons / PWA
    { outName: 'favicon-16x16.png', width: 16, height: 16, sources: ['favicon-16x16.png', 'favicon.svg', 'brand/favicon.svg', 'logo.svg', 'brand/logo.svg'] },
    { outName: 'favicon-32x32.png', width: 32, height: 32, sources: ['favicon-32x32.png', 'favicon.svg', 'brand/favicon.svg', 'logo.svg', 'brand/logo.svg'] },
    { outName: 'apple-touch-icon.png', width: 180, height: 180, sources: ['apple-touch-icon.png', 'logo.svg', 'brand/logo.svg', 'favicon.svg', 'brand/favicon.svg'] },
    { outName: 'pwa-192.png', width: 192, height: 192, sources: ['pwa-192.png', 'logo.svg', 'brand/logo.svg', 'favicon.svg', 'brand/favicon.svg'] },
    { outName: 'pwa-512.png', width: 512, height: 512, sources: ['pwa-512.png', 'logo.svg', 'brand/logo.svg', 'favicon.svg', 'brand/favicon.svg'] },
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
    await renderPng({ inputPath, outPath, width: t.width, height: t.height })
    // eslint-disable-next-line no-console
    console.log(`[brand-icons] ${t.outName} (${t.width}x${t.height}) ← ${path.relative(root, inputPath)}`)
  }

  // Cleanup: these are source-only artifacts that should not ship in `dist/`.
  // Live metadata references the generated PNGs.
  const removeFromDist = [
    'app-icon.svg',
    'app-splash.svg',
    'app-hero.svg',
    'screenshot-portrait.svg',
    // These are generated PNG derivatives used by the manifest.
    // Keep the source-only screenshots out of dist if present.
    // Legacy / unused token art that can bloat dist.
    'wsAKITA.svg',
  ]

  for (const rel of removeFromDist) {
    try {
      await fs.unlink(path.resolve(outDir, rel))
    } catch {
      // ignore
    }
  }
}

await main()
