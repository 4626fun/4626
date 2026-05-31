import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

const FIELD = {
  void: '#010203',
  deep: '#030608',
  charcoal: '#0a1218',
} as const

const CHAMBER = {
  top: '#050c0a',
  bottom: '#020405',
} as const

/** Flat dark canvas + chamber prefill only — no faux outer frame or padding wash. */
export async function renderV2BackgroundCard(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params

  const baseSvg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="canvasBase" cx="50%" cy="42%" r="95%">
      <stop offset="0%" stop-color="${FIELD.charcoal}"/>
      <stop offset="55%" stop-color="${FIELD.deep}"/>
      <stop offset="100%" stop-color="${FIELD.void}"/>
    </radialGradient>
    <linearGradient id="chamberFill" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${CHAMBER.top}"/>
      <stop offset="100%" stop-color="${CHAMBER.bottom}"/>
    </linearGradient>
    <radialGradient id="chamberVig" cx="50%" cy="48%" r="70%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="68%" stop-color="rgba(0,0,0,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.36)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#canvasBase)"/>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberFill)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberVig)"
  />
</svg>`

  const innerShadowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="none"
    stroke="#000000"
    stroke-opacity="0.5"
    stroke-width="${Math.max(8, Math.round(size * 0.018))}"
  />
</svg>`
  const [base, innerShadow] = await Promise.all([
    sharp(Buffer.from(baseSvg)).png().toBuffer(),
    sharp(Buffer.from(innerShadowSvg))
      .blur(Math.max(5, size * 0.01))
      .png()
      .toBuffer(),
  ])

  return sharp(base)
    .composite([{ input: innerShadow, blend: 'multiply' }])
    .png()
    .toBuffer()
}
