/**
 * Quick render script — generates updated token icon previews into .playwright-mcp/
 * Usage: pnpm -C frontend tsx scripts/render-preview-icons.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderPremiumTokenIcon } from '../api/_handlers/token/_premiumTokenIconRenderer.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, '.playwright-mcp')

const SUBJECTS = [
  { name: 'jessepollak', symbol: 'JESSE', original: 'creator-coin-top3-rank1-jessepollak-original.png' },
  { name: 'ugorreser',   symbol: 'UGORRE', original: 'creator-coin-top3-rank2-ugorreser-original.png' },
  { name: 'jacob',       symbol: 'JACOB',  original: 'creator-coin-top3-rank3-jacob-original.png' },
]

async function run() {
  for (const subject of SUBJECTS) {
    const originalPath = path.join(OUT_DIR, subject.original)
    let sourceImage: Uint8Array | undefined
    if (fs.existsSync(originalPath)) {
      sourceImage = new Uint8Array(fs.readFileSync(originalPath))
      console.log(`[${subject.name}] loaded source (${sourceImage.length} bytes)`)
    } else {
      console.warn(`[${subject.name}] original not found, using symbol fallback`)
    }

    const png = await renderPremiumTokenIcon({
      size: 1024,
      sourceImage,
      symbol: subject.symbol,
    })

    const outName = `creator-coin-top3-rank${SUBJECTS.indexOf(subject) + 1}-${subject.name}-after.png`
    const outPath = path.join(OUT_DIR, outName)
    fs.writeFileSync(outPath, png)
    console.log(`[${subject.name}] wrote ${outPath}`)
  }
}

run().catch(err => { console.error(err); process.exit(1) })
