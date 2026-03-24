import { readFileSync, writeFileSync } from 'node:fs'
import { renderPremiumTokenIcon } from './api/_handlers/token/_premiumTokenIconRenderer.js'

const ASSETS_DIR = '/home/akitav2/projects/4626/.playwright-mcp'

async function main() {
  const original = readFileSync(`${ASSETS_DIR}/creator-coin-top20to50-random22-fatatpe-original.png`)
  const heroCutout = readFileSync(`${ASSETS_DIR}/creator-coin-top20to50-random22-fatatpe-hero-cutout.png`)

  console.log('[render] original bytes:', original.length)
  console.log('[render] heroCutout bytes:', heroCutout.length)

  const result = await renderPremiumTokenIcon({
    size: 512,
    sourceImage: new Uint8Array(original),
    heroCutoutSourceImage: new Uint8Array(heroCutout),
    symbol: 'FATATPE',
    signatureText: 'FATATPE',
  })

  const outputPath = `${ASSETS_DIR}/creator-coin-top20to50-random22-fatatpe-after.png`
  writeFileSync(outputPath, result)
  console.log(`[render] wrote ${result.length} bytes to ${outputPath}`)
}

main().catch((err) => {
  console.error('[render] failed:', err)
  process.exit(1)
})
