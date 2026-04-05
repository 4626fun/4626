#!/usr/bin/env node
/**
 * Generate social preview image(s) from SVG source assets.
 *
 * Why:
 * - Link unfurlers (X, Farcaster, Telegram, Discord) are most reliable with PNG.
 * - We keep the editable source in SVG, then derive fixed-size PNG output.
 *
 * Usage:
 *   node scripts/generate-social-preview.mjs
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.resolve(__dirname, '../public')

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    // eslint-disable-next-line no-console
    console.error('Missing dependency: sharp. Install frontend deps and retry.')
    process.exit(1)
  }

  const sourceSvg = path.resolve(__dirname, '../assets/social/app-hero-source.svg')
  const targetPng = path.join(publicDir, 'app-hero.png')

  await sharp(sourceSvg, { density: 512 })
    .resize(1200, 630, { fit: 'cover' })
    .flatten({ background: '#000000' })
    .png({ compressionLevel: 9 })
    .toFile(targetPng)

  // eslint-disable-next-line no-console
  console.log('wrote public/app-hero.png (1200x630)')
}

await main()
