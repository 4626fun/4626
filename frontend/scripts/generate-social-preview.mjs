#!/usr/bin/env node
/**
 * Verify committed social preview image(s) from the v2 brand kit.
 *
 * Why:
 * - Link unfurlers (X, Farcaster, Telegram, Discord) are most reliable with
 *   committed PNGs at stable URLs.
 * - The 4626 v2 asset kit is now the canonical source for these images.
 * - This script is kept for existing operator muscle memory, but no longer
 *   regenerates stale root-level assets such as `public/app-hero.png`.
 *
 * Usage:
 *   node scripts/generate-social-preview.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.resolve(__dirname, '../public')
const requiredSocialAssets = [
  'assets/og-image.png',
  'assets/twitter-card.png',
  'assets/product/social-launch.png',
  'assets/product/og-preview-wide.png',
]

async function main() {
  const missing = []
  for (const relativePath of requiredSocialAssets) {
    try {
      await fs.access(path.join(publicDir, relativePath))
    } catch {
      missing.push(relativePath)
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing v2 brand-kit social assets: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line no-console
  console.log('verified committed v2 brand-kit social assets')
}

await main()
