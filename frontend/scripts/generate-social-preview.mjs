#!/usr/bin/env node
/**
 * Verify committed social preview image(s) from the SEO brand kit.
 *
 * Why:
 * - Link unfurlers (X, Farcaster, Telegram, Discord) are most reliable with
 *   committed PNGs at stable URLs.
 * - The 4626.fun SEO brand kit is now the canonical source for these images.
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
  'social/og-image-1200x630.png',
  'social/twitter-summary-large-image-1200x675.png',
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
    console.error(`Missing SEO brand-kit social assets: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line no-console
  console.log('verified committed SEO brand-kit social assets')
}

await main()
