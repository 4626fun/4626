import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { renderPremiumTokenIcon } from '../_handlers/token/_premiumTokenIconRenderer.js'

async function createSource(params: {
  width: number
  height: number
}): Promise<Uint8Array> {
  const { width, height } = params
  const layer = await sharp({
    create: {
      width: Math.round(width * 0.5),
      height: Math.round(height * 0.4),
      channels: 4,
      background: { r: 32, g: 146, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer()

  const base = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 217, g: 84, b: 68, alpha: 1 },
    },
  })
    .composite([
      {
        input: layer,
        top: Math.round(height * 0.05),
        left: Math.round(width * 0.24),
      },
    ])
    .png()
    .toBuffer()

  return new Uint8Array(base)
}

describe('premium token icon renderer', () => {
  it('renders fallback symbol card when source is missing', async () => {
    const png = await renderPremiumTokenIcon({
      size: 512,
      symbol: 'AKITA',
    })
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  }, 12_000)

  it('renders premium icon for provided source image', async () => {
    const source = await createSource({ width: 900, height: 1200 })
    const png = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  }, 12_000)

  it('is deterministic for the same source and size', async () => {
    const source = await createSource({ width: 512, height: 512 })
    const a = await renderPremiumTokenIcon({
      size: 480,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const b = await renderPremiumTokenIcon({
      size: 480,
      sourceImage: source,
      symbol: 'AKITA',
    })
    expect(Buffer.compare(a, b)).toBe(0)
  })
})

