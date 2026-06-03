#!/usr/bin/env tsx
import fs from 'node:fs'
import sharp from 'sharp'

import { buildPremiumSubjectStack, renderPremiumTokenIcon as renderClassic } from '../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderV2 } from '../api/_handlers/token/renderers/premium-v2/renderPremiumTokenIcon.js'

async function main() {
  const input = fs.readFileSync('tmp/token-icon-compare/cepdood/input.png')
  const stack = await buildPremiumSubjectStack({ sourceImage: input, size: 512, symbol: 'CEP' })
  console.log('analysis', {
    sourceClass: stack.analysis?.sourceClass,
    preset: stack.analysis?.preset,
    hasBreakout: Boolean(stack.breakoutLayer),
  })
  const outDir = 'tmp/cepdood-breakout-debug'
  fs.mkdirSync(outDir, { recursive: true })
  if (stack.breakoutLayer) fs.writeFileSync(`${outDir}/breakout-layer.png`, stack.breakoutLayer)
  if (stack.heroCompositeLayer) fs.writeFileSync(`${outDir}/hero.png`, stack.heroCompositeLayer)
  const compareDir = 'tmp/token-icon-compare/cepdood'
  fs.writeFileSync(`${compareDir}/classic-512.png`, await renderClassic({ sourceImage: input, size: 512, symbol: 'CEP' }))
  fs.writeFileSync(`${compareDir}/premium-v2-512.png`, await renderV2({ sourceImage: input, size: 512, symbol: 'CEP' }))
  fs.writeFileSync(`${outDir}/premium-v2-512.png`, fs.readFileSync(`${compareDir}/premium-v2-512.png`))
  const meta = await sharp(input).metadata()
  console.log('input', meta.width, meta.height, meta.hasAlpha)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
