#!/usr/bin/env tsx
/**
 * Offline A/B: premium-classic vs fuji-lut-experimental token icon renders.
 *
 *   pnpm -C frontend exec tsx scripts/compare-token-icon-renderers.ts \
 *     --source ./path/to/sample.png \
 *     --out ./tmp/token-icon-compare
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { renderPremiumTokenIcon as renderClassic } from '../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderFujiLut } from '../api/_handlers/token/renderers/fuji-lut-experimental/renderPremiumTokenIcon.js'

const SIZES = [128, 256, 512] as const

function parseArgs(argv: string[]): { source: string; out: string; symbol: string } {
  let source = ''
  let out = './tmp/token-icon-compare'
  let symbol = 'AB'
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--source' && argv[i + 1]) {
      source = argv[++i]
      continue
    }
    if (a === '--out' && argv[i + 1]) {
      out = argv[++i]
      continue
    }
    if (a === '--symbol' && argv[i + 1]) {
      symbol = argv[++i]
      continue
    }
  }
  if (!source) {
    console.error('Usage: compare-token-icon-renderers.ts --source <png> [--out dir] [--symbol TICKER]')
    process.exit(1)
  }
  return { source, out, symbol }
}

async function main() {
  const { source, out, symbol } = parseArgs(process.argv)
  const sourcePath = path.resolve(source)
  const outDir = path.resolve(out)
  const bytes = new Uint8Array(await fs.readFile(sourcePath))

  await fs.mkdir(outDir, { recursive: true })
  await fs.copyFile(sourcePath, path.join(outDir, 'input.png'))

  for (const size of SIZES) {
    const classic = await renderClassic({ size, sourceImage: bytes, symbol })
    const fuji = await renderFujiLut({ size, sourceImage: bytes, symbol })
    await fs.writeFile(path.join(outDir, `classic-${size}.png`), classic)
    await fs.writeFile(path.join(outDir, `fuji-lut-${size}.png`), fuji)
    console.log(`wrote classic-${size}.png fuji-lut-${size}.png`)
  }

  console.log(`\nCompare outputs in ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
