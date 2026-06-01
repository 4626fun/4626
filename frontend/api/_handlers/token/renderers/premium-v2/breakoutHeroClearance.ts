import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

/** Remove in-chamber hero pixels where the finalized breakout layer will paint (avoids double hat/face). */
export async function eraseHeroUnderBreakoutLayer(params: {
  heroLayer: Buffer
  breakoutLayer: Buffer
  layout: PremiumLayout
}): Promise<Buffer> {
  const { layout } = params
  const size = layout.size
  const clearTopY = Math.max(
    1,
    Math.min(size, layout.frameY + Math.max(2, Math.round(layout.frameStroke * 0.42))),
  )
  const topBand = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: size,
            height: clearTopY,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 255 },
          },
        },
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()

  const breakoutAlpha = await sharp(params.breakoutLayer)
    .ensureAlpha()
    .extractChannel('alpha')
    .toColourspace('b-w')
    .png()
    .toBuffer()

  const eraseMask = await sharp(breakoutAlpha)
    .composite([{ input: topBand, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return sharp(params.heroLayer)
    .ensureAlpha()
    .composite([{ input: eraseMask, blend: 'dest-out' }])
    .png()
    .toBuffer()
}
