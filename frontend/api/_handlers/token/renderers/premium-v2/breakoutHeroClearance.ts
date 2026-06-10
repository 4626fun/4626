import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

/** Remove hero pixels wherever the finalized breakout layer paints (top + side padding breakout). */
export async function eraseHeroUnderBreakoutLayer(params: {
  heroLayer: Buffer
  breakoutLayer: Buffer
  layout: PremiumLayout
}): Promise<Buffer> {
  const eraseMask = await sharp(params.breakoutLayer)
    .ensureAlpha()
    .extractChannel('alpha')
    .toColourspace('b-w')
    .png()
    .toBuffer()

  return sharp(params.heroLayer)
    .ensureAlpha()
    .composite([{ input: eraseMask, blend: 'dest-out' }])
    .png()
    .toBuffer()
}
