import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

/** Platinum/graphite — low saturation, modern product bezel. */
const PLATINUM = {
  highlight: '#FFFFFF',
  frost: '#F4F7FC',
  mid: '#C8D2E2',
  shadow: '#8A9BB4',
  graphite: '#5C6D86',
} as const

const STROKE_SCALE = 0.54

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

function roundedRectStroke(
  layout: PremiumLayout,
  strokeColor: string,
  strokeScale: number,
  opacity = 1,
): string {
  const strokeW = Math.max(2, Math.round(layout.frameStroke * strokeScale))
  const inset = strokeW / 2
  const opacityAttr = opacity < 1 ? ` stroke-opacity="${opacity}"` : ''
  return `<rect
    x="${layout.frameX + inset}"
    y="${layout.frameY + inset}"
    width="${Math.max(1, layout.frameSize - strokeW)}"
    height="${Math.max(1, layout.frameSize - strokeW)}"
    rx="${Math.max(1, layout.frameRadius - inset)}"
    fill="none"
    stroke="${strokeColor}"
    stroke-width="${strokeW}"
    stroke-linejoin="round"${opacityAttr}
  />`
}

async function createPlatinumBezelStroke(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="platinumBezel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PLATINUM.highlight}"/>
      <stop offset="18%" stop-color="${PLATINUM.frost}"/>
      <stop offset="48%" stop-color="${PLATINUM.mid}"/>
      <stop offset="78%" stop-color="${PLATINUM.shadow}"/>
      <stop offset="100%" stop-color="${PLATINUM.graphite}"/>
    </linearGradient>
  </defs>
  ${roundedRectStroke(layout, 'url(#platinumBezel)', STROKE_SCALE)}
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Bezel annulus only — stays on the metal ring, never into card padding (no faux outer frame). */
async function createFrameMatteAnnulus(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const outerSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX}"
    y="${layout.frameY}"
    width="${layout.frameSize}"
    height="${layout.frameSize}"
    rx="${layout.frameRadius}"
    fill="rgba(8,11,18,0.42)"
  />
</svg>`
  const holeSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="#000"
  />
</svg>`
  const outer = await sharp(Buffer.from(outerSvg)).png().toBuffer()
  const hole = await sharp(Buffer.from(holeSvg)).png().toBuffer()
  return sharp(outer)
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()
}

export async function renderV2PremiumFrame(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const matteAnnulus = await createFrameMatteAnnulus(layout)
  const strokeLayer = await createPlatinumBezelStroke(layout)
  const ringMask = await sharp(strokeLayer)
    .ensureAlpha()
    .extractChannel('alpha')
    .png()
    .toBuffer()

  const specularSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="specTl" cx="24%" cy="20%" r="34%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.5)"/>
      <stop offset="38%" stop-color="rgba(255,255,255,0.1)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <linearGradient id="specEdge" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(120,145,190,0.14)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect x="${layout.frameX}" y="${layout.frameY}" width="${layout.frameSize}" height="${layout.frameSize}" rx="${layout.frameRadius}" fill="url(#specTl)"/>
  <rect x="${layout.frameX}" y="${layout.frameY}" width="${layout.frameSize}" height="${layout.frameSize}" rx="${layout.frameRadius}" fill="url(#specEdge)"/>
</svg>`
  const specular = await sharp(Buffer.from(specularSvg))
    .ensureAlpha()
    .composite([{ input: ringMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const chamberMaskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${layout.chamberX}" y="${layout.chamberY}" width="${layout.chamberSize}" height="${layout.chamberSize}" rx="${layout.chamberRadius}" fill="white"/>
</svg>`
  const chamberMask = await sharp(Buffer.from(chamberMaskSvg)).png().toBuffer()

  const grooveW = Math.max(1, Math.round(layout.frameStroke * 0.12))
  const innerGrooveSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX - grooveW / 2}"
    y="${layout.chamberY - grooveW / 2}"
    width="${layout.chamberSize + grooveW}"
    height="${layout.chamberSize + grooveW}"
    rx="${layout.chamberRadius + grooveW / 2}"
    fill="none"
    stroke="rgba(0,0,0,0.5)"
    stroke-width="${grooveW}"
  />
</svg>`
  const innerGroove = await sharp(Buffer.from(innerGrooveSvg))
    .blur(Math.max(0.5, size * 0.001))
    .png()
    .toBuffer()

  const contactShadowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="none"
    stroke="rgba(0,0,0,0.32)"
    stroke-width="${Math.max(2, Math.round(size * 0.006))}"
  />
</svg>`
  const contactShadow = await sharp(Buffer.from(contactShadowSvg))
    .blur(Math.max(1, size * 0.0024))
    .ensureAlpha()
    .composite([{ input: chamberMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const outerHairlineSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${roundedRectStroke(layout, 'rgba(255,255,255,0.62)', STROKE_SCALE * 0.92, 1)}
</svg>`
  const outerHairline = await sharp(Buffer.from(outerHairlineSvg))
    .ensureAlpha()
    .composite([{ input: ringMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const innerHairlineW = Math.max(1, Math.round(layout.frameStroke * 0.08))
  const innerHairlineSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX + innerHairlineW / 2}"
    y="${layout.chamberY + innerHairlineW / 2}"
    width="${Math.max(1, layout.chamberSize - innerHairlineW)}"
    height="${Math.max(1, layout.chamberSize - innerHairlineW)}"
    rx="${Math.max(1, layout.chamberRadius - innerHairlineW / 2)}"
    fill="none"
    stroke="rgba(255,255,255,0.28)"
    stroke-width="${innerHairlineW}"
  />
</svg>`
  const innerHairline = await sharp(Buffer.from(innerHairlineSvg)).png().toBuffer()

  return sharp(matteAnnulus)
    .composite([
      { input: strokeLayer, blend: 'over' },
      { input: await applyOpacity(specular, 0.42), blend: 'screen' },
      { input: contactShadow, blend: 'multiply' },
      { input: innerGroove, blend: 'multiply' },
      { input: await applyOpacity(innerHairline, 0.75), blend: 'screen' },
      { input: await applyOpacity(outerHairline, 0.88), blend: 'screen' },
    ])
    .png()
    .toBuffer()
}
