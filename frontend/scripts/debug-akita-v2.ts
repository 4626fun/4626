#!/usr/bin/env tsx
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { setApiKey, getCoin } from '@zoralabs/coins-sdk'
import { resolveCreatorTokenArtwork } from '../server/_lib/image/creatorTokenArtwork.js'
import { buildPremiumSubjectStack } from '../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderV2 } from '../api/_handlers/token/renderers/premium-v2/renderPremiumTokenIcon.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ADDR = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'

async function main() {
  for (const envName of ['.env.local', '.env']) {
    const p = path.join(ROOT, envName)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq)
      if (process.env[k] === undefined) process.env[k] = t.slice(eq + 1).replace(/^["']|["']$/g, '')
    }
  }
  setApiKey(process.env.ZORA_SERVER_API_KEY || process.env.ZORA_API_KEY || '')
  const res = await getCoin({ address: ADDR, chain: 8453 })
  const art = resolveCreatorTokenArtwork(res?.data?.zora20Token)
  if (!art?.artworkUrl) throw new Error('no artwork')
  const src = new Uint8Array(await (await fetch(art.artworkUrl)).arrayBuffer())

  for (const preset of ['standard', 'hero'] as const) {
    for (const size of [128, 512]) {
      const subject = await buildPremiumSubjectStack({
        size,
        sourceImage: src,
        symbol: 'akita',
        renderPreset: preset,
      })
      console.log({ size, preset, class: subject.analysis?.sourceClass, breakout: !!subject.breakoutLayer })
      const buf = await renderV2({
        size,
        sourceImage: src,
        symbol: 'akita',
        renderPreset: preset,
      })
      await fs.promises.writeFile(path.join(ROOT, `tmp/akita-debug-${preset}-${size}.png`), buf)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
