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

async function applyMaskCutouts(
  baseMask: Buffer,
  cuts: Buffer[],
): Promise<Buffer> {
  if (cuts.length === 0) return baseMask
  return sharp(baseMask)
    .composite(cuts.map((input) => ({ input, blend: 'dest-out' })))
    .png()
    .toBuffer()
}

/**
 * Top-center band where the real breakout layer sits — padding spill must not paint
 * a second rembg silhouette (reads as a flat grey block above the bezel).
 */
function createTopBreakoutBandCutSvg(layout: PremiumLayout): string | null {
  const { size } = layout
  const padX = Math.max(2, Math.round(layout.breakoutWidth * 0.18))
  const padY = Math.max(2, Math.round(layout.breakoutHeight * 0.14))
  const cutX = Math.max(0, layout.breakoutX - padX)
  const cutW = Math.min(size - cutX, layout.breakoutWidth + padX * 2)
  const cutH = Math.min(
    size,
    Math.max(
      layout.frameY + padY,
      layout.breakoutY + layout.breakoutHeight + padY,
    ),
  )
  if (cutW <= 0 || cutH <= 0) return null
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cutX}" y="0" width="${cutW}" height="${cutH}" fill="white"/>
</svg>`
}

/**
 * Padding spill allowed beside the bezel and in side top corners — not under the bottom
 * edge (muddy band below frame) and not in the top-center breakout band (duplicate hat).
 */
export async function createPaddingSpillMask(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const paddingMask = await createPaddingOutsideFrameMask(layout)
  const cuts: Buffer[] = []

  const bottomY = layout.frameY + layout.frameSize
  const bottomH = Math.max(0, size - bottomY)
  if (bottomH > 0) {
    const bottomCutSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${bottomY}" width="${size}" height="${bottomH}" fill="white"/>
</svg>`
    cuts.push(await sharp(Buffer.from(bottomCutSvg)).png().toBuffer())
  }

  const topBreakoutCutSvg = createTopBreakoutBandCutSvg(layout)
  if (topBreakoutCutSvg) {
    cuts.push(await sharp(Buffer.from(topBreakoutCutSvg)).png().toBuffer())
  }

  return applyMaskCutouts(paddingMask, cuts)
}
