#!/usr/bin/env tsx
/**
 * Offline 512×512 samples (classic vs premium-v2) from cached compare inputs.
 *
 *   pnpm -C frontend exec tsx scripts/render-token-icon-examples-512.ts
 *   pnpm -C frontend exec tsx scripts/render-token-icon-examples-512.ts neste cepdood
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderPremiumTokenIcon as renderClassic } from '../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderPremiumV2 } from '../api/_handlers/token/renderers/premium-v2/renderPremiumTokenIcon.js'

const SIZE = 512
const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUT_ROOT = path.join(FRONTEND_ROOT, 'tmp/token-icon-compare')
const OUT_ROOT = path.join(FRONTEND_ROOT, 'tmp/token-icon-examples-512')

const DEFAULT_SLUGS = ['neste', 'cepdood', 'akita', 'jesse'] as const

async function main() {
  const slugs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [...DEFAULT_SLUGS]
  await fs.promises.mkdir(OUT_ROOT, { recursive: true })

  for (const slug of slugs) {
    const inputPath = path.join(INPUT_ROOT, slug, 'input.png')
    if (!fs.existsSync(inputPath)) {
      console.warn(`skip ${slug}: no ${inputPath}`)
      continue
    }
    const sourceImage = fs.readFileSync(inputPath)
    const symbol = slug.toUpperCase().slice(0, 12)
    const params = { size: SIZE, sourceImage, symbol, renderPreset: 'hero' as const }

    const outDir = path.join(OUT_ROOT, slug)
    await fs.promises.mkdir(outDir, { recursive: true })

    const [classic, v2] = await Promise.all([
      renderClassic(params),
      renderPremiumV2(params),
    ])
    await fs.promises.writeFile(path.join(outDir, 'classic-512.png'), classic)
    await fs.promises.writeFile(path.join(outDir, 'premium-v2-512.png'), v2)
    console.log(`${slug} → ${outDir}/classic-512.png, premium-v2-512.png`)
  }

  console.log(`\nOpen: ${OUT_ROOT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
