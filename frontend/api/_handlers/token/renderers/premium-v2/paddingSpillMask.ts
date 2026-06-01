import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

/** Card padding ring outside the bezel (full card minus frame hole). */
async function createPaddingOutsideFrameMask(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const cardSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="white"/>
</svg>`
  const frameHoleSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX}"
    y="${layout.frameY}"
    width="${layout.frameSize}"
    height="${layout.frameSize}"
    rx="${layout.frameRadius}"
    fill="#000"
  />
</svg>`
  const [card, hole] = await Promise.all([
    sharp(Buffer.from(cardSvg)).png().toBuffer(),
    sharp(Buffer.from(frameHoleSvg)).png().toBuffer(),
  ])
  return sharp(card)
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()
}

/**
 * Padding spill allowed above and beside the bezel — not under the bottom edge
 * (avoids a muddy silhouette band below the frame on breakout photos).
 */
export async function createPaddingSpillMask(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const paddingMask = await createPaddingOutsideFrameMask(layout)
  const bottomY = layout.frameY + layout.frameSize
  const bottomH = Math.max(0, size - bottomY)
  if (bottomH <= 0) return paddingMask

  const bottomCutSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${bottomY}" width="${size}" height="${bottomH}" fill="white"/>
</svg>`
  const bottomCut = await sharp(Buffer.from(bottomCutSvg)).png().toBuffer()
  return sharp(paddingMask)
    .composite([{ input: bottomCut, blend: 'dest-out' }])
    .png()
    .toBuffer()
}
