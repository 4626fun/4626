import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import type { PremiumLayout } from '../_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { createPaddingSpillMask } from '../_handlers/token/renderers/premium-v2/paddingSpillMask.js'

/** Mirrors `getTokenIconLayout(512, 'hero')` in premium-classic renderer. */
function layout512Hero(): PremiumLayout {
  const size = 512
  const preset = 'hero' as const
  const frameInset = Math.round(size * 0.148)
  const frameSize = Math.max(1, size - frameInset * 2)
  const frameStroke = Math.round(frameSize * 0.048)
  const chamberInset = Math.max(
    Math.round(frameStroke * 1.04),
    Math.round(frameSize * 0.027),
  )
  const chamberSize = Math.max(1, frameSize - chamberInset * 2)
  const chamberX = frameInset + chamberInset
  const chamberY = chamberX
  const breakoutWidth = Math.max(1, Math.round(chamberSize * 0.3))
  const breakoutHeight = Math.max(1, Math.round(chamberSize * 0.2))
  const breakoutX = chamberX + Math.round((chamberSize - breakoutWidth) / 2)
  const breakoutY = Math.max(0, chamberY - Math.round(chamberSize * 0.115))

  return {
    size,
    cardRadius: Math.round(size * 0.16),
    frameX: frameInset,
    frameY: frameInset,
    frameSize,
    frameRadius: Math.round(frameSize * 0.207),
    frameStroke,
    chamberX,
    chamberY,
    chamberSize,
    chamberRadius: Math.round(chamberSize * 0.148),
    breakoutX,
    breakoutY,
    breakoutWidth,
    breakoutHeight,
  }
}

async function maskAlphaAt(mask: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const idx = (y * info.width + x) * info.channels
  return data[idx + 3] ?? data[idx]
}

describe('premiumV2PaddingSpillMask', () => {
  it('clears top-center breakout band so padding spill does not duplicate the hat', async () => {
    const layout = layout512Hero()
    const mask = await createPaddingSpillMask(layout)
    const centerX = layout.breakoutX + Math.floor(layout.breakoutWidth / 2)
    const topY = Math.max(0, Math.floor(layout.frameY / 2))
    const centerAlpha = await maskAlphaAt(mask, centerX, topY)
    expect(centerAlpha).toBe(0)

    const sideX = Math.max(0, layout.frameX - 4)
    const sideAlpha = await maskAlphaAt(mask, sideX, topY)
    expect(sideAlpha).toBeGreaterThan(0)
  })
})
