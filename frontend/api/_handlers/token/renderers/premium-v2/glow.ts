import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'

const GLOW_BLUE = '#2F7DFF'
type GlowTint = 'white' | 'blue' | 'hybrid'

function resolveGlowTint(): GlowTint {
  const raw = (process.env.TOKEN_ICON_V2_GLOW_TINT ?? 'hybrid').trim().toLowerCase()
  if (raw === 'white' || raw === 'blue') return raw
  return 'hybrid'
}

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

function createTransparentCanvas(size: number): sharp.Sharp {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
}

function frameGlowStrokeSvg(params: {
  size: number
  layout: PremiumLayout
  strokeColor: string
  strokeScale?: number
}): string {
  const { size, layout, strokeColor, strokeScale = 0.78 } = params
  const strokeW = Math.max(2, Math.round(layout.frameStroke * strokeScale))
  const inset = strokeW / 2
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX + inset}"
    y="${layout.frameY + inset}"
    width="${Math.max(1, layout.frameSize - strokeW)}"
    height="${Math.max(1, layout.frameSize - strokeW)}"
    rx="${Math.max(1, layout.frameRadius - inset)}"
    fill="none"
    stroke="${strokeColor}"
    stroke-width="${strokeW}"
  />
</svg>`
}

async function buildGlowFromStroke(glowBase: Buffer, size: number): Promise<Buffer> {
  const rim = await sharp(glowBase)
    .blur(Math.max(3, size * 0.008))
    .png()
    .toBuffer()
  const soft = await sharp(glowBase)
    .blur(Math.max(12, size * 0.024))
    .png()
    .toBuffer()
  const ambient = await sharp(glowBase)
    .blur(Math.max(28, size * 0.055))
    .png()
    .toBuffer()

  return createTransparentCanvas(size)
    .composite([
      { input: await applyOpacity(ambient, 0.14), blend: 'screen' },
      { input: await applyOpacity(soft, 0.11), blend: 'screen' },
      { input: await applyOpacity(rim, 0.2), blend: 'screen' },
    ])
    .png()
    .toBuffer()
}

async function cutGlowHole(merged: Buffer, layout: PremiumLayout, size: number): Promise<Buffer> {
  const cutInset = Math.max(1, Math.round(layout.frameStroke * 0.5))
  const holeSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX + cutInset}"
    y="${layout.frameY + cutInset}"
    width="${Math.max(1, layout.frameSize - cutInset * 2)}"
    height="${Math.max(1, layout.frameSize - cutInset * 2)}"
    rx="${Math.max(1, layout.frameRadius - cutInset)}"
    fill="#fff"
  />
</svg>`
  return sharp(merged)
    .ensureAlpha()
    .composite([
      {
        input: await sharp(Buffer.from(holeSvg)).blur(Math.max(5, size * 0.01)).png().toBuffer(),
        blend: 'dest-out',
      },
    ])
    .png()
    .toBuffer()
}

/** Frame halo — `TOKEN_ICON_V2_GLOW_TINT=white|blue|hybrid` (default hybrid). */
export async function renderV2OuterGlow(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const tint = resolveGlowTint()

  const whiteSvg = frameGlowStrokeSvg({
    size,
    layout,
    strokeColor: 'rgba(248,252,255,0.95)',
    strokeScale: 0.72,
  })
  const blueSvg = frameGlowStrokeSvg({
    size,
    layout,
    strokeColor: GLOW_BLUE,
    strokeScale: 0.88,
  })

  const layers: Buffer[] = []

  if (tint === 'white' || tint === 'hybrid') {
    const whiteBase = await sharp(Buffer.from(whiteSvg)).png().toBuffer()
    layers.push(await buildGlowFromStroke(whiteBase, size))
  }
  if (tint === 'blue' || tint === 'hybrid') {
    const blueBase = await sharp(Buffer.from(blueSvg)).png().toBuffer()
    const blueGlow = await buildGlowFromStroke(blueBase, size)
    layers.push(
      tint === 'hybrid'
        ? await applyOpacity(blueGlow, 0.55)
        : blueGlow,
    )
  }

  let merged = await createTransparentCanvas(size).png().toBuffer()
  for (const layer of layers) {
    merged = await sharp(merged).composite([{ input: layer, blend: 'screen' }]).png().toBuffer()
  }

  return cutGlowHole(merged, layout, size)
}

/** Soft edge light on the bezel stroke. */
export async function renderV2FrameBloom(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const tint = resolveGlowTint()
  const strokeColor = tint === 'white' ? 'white' : GLOW_BLUE
  const svg = frameGlowStrokeSvg({ size, layout, strokeColor, strokeScale: 1 })
  const stroke = await sharp(Buffer.from(svg)).png().toBuffer()
  const near = await sharp(stroke).blur(Math.max(1.8, size * 0.0035)).png().toBuffer()
  const far = await sharp(stroke).blur(Math.max(8, size * 0.018)).png().toBuffer()
  const merged = await sharp(far)
    .composite([{ input: await applyOpacity(near, 0.55), blend: 'screen' }])
    .png()
    .toBuffer()
  const bloomOpacity = tint === 'white' ? 0.3 : tint === 'blue' ? 0.34 : 0.32
  return applyOpacity(merged, size <= 128 ? bloomOpacity * 0.85 : bloomOpacity)
}
