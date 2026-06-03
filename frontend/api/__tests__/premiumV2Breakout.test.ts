import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { solidifyBreakoutLayer } from '../_handlers/token/renderers/premium-v2/breakout.js'

describe('premiumV2Breakout', () => {
  it('solidifyBreakoutLayer forces visible pixels to full alpha', async () => {
    const rgba = Buffer.alloc(4 * 4, 0)
    rgba[3] = 180
    const layer = await sharp(rgba, { raw: { width: 2, height: 2, channels: 4 } })
      .png()
      .toBuffer()

    const out = await solidifyBreakoutLayer(layer)
    const { data } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(data[3]).toBe(255)
  })
})
