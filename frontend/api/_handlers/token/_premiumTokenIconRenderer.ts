import sharp from 'sharp'

type BlendMode = NonNullable<sharp.OverlayOptions['blend']>
type ArtworkFitMode = 'cover' | 'contain'

export type PremiumTokenIconParams = {
  size: number
  sourceImage?: Uint8Array
  symbol?: string
}

type PremiumLayout = {
  size: number
  cardRadius: number
  frameX: number
  frameY: number
  frameSize: number
  frameRadius: number
  frameStroke: number
  chamberX: number
  chamberY: number
  chamberSize: number
  chamberRadius: number
  breakoutX: number
  breakoutY: number
  breakoutWidth: number
  breakoutHeight: number
}

type SourceAnalysis = {
  lowResolution: boolean
  brightBadgeLike: boolean
  hasTransparency: boolean
  topCenterStdDev: number
  topOccupancy: number
  preferredScale: number
  fitMode: ArtworkFitMode
  artworkTone: 'default' | 'bright'
  allowBreakout: boolean
}

const BACKGROUND_COLORS = {
  center: '#000000',
  mid: '#000108',
  edge: '#000000',
} as const

const OUTER_GLOW_COLOR = '#2F6FFF'
const FRAME_GRADIENT = {
  topLeft: '#F2F7FF',
  middle: '#DCE8FF',
  bottomRight: '#2F6FFF',
} as const

const CHAMBER_GRADIENT = {
  top: '#050A14',
  bottom: '#010307',
} as const

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function sanitizeSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Invalid icon size: ${size}`)
  }
  return Math.round(clamp(size, 64, 2048))
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  const clamped = clamp(opacity, 0, 1)
  if (clamped >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, clamped], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

function getTokenIconLayout(size: number): PremiumLayout {
  const frameInset = Math.round(size * 0.17)
  const frameSize = Math.max(1, size - frameInset * 2)
  const frameStroke = clamp(Math.round(frameSize * 0.069), Math.round(frameSize * 0.063), Math.round(frameSize * 0.079))
  const chamberInset = Math.max(Math.round(frameStroke * 1.02), Math.round(frameSize * 0.034))
  const chamberSize = Math.max(1, frameSize - chamberInset * 2)
  const chamberX = frameInset + chamberInset
  const chamberY = chamberX
  const breakoutWidth = Math.max(1, Math.round(chamberSize * 0.2))
  const breakoutHeight = Math.max(1, Math.round(chamberSize * 0.05))
  const breakoutX = chamberX + Math.round((chamberSize - breakoutWidth) / 2)
  const breakoutY = Math.max(0, chamberY - Math.round(chamberSize * 0.046))

  return {
    size,
    cardRadius: Math.round(size * 0.16),
    frameX: frameInset,
    frameY: frameInset,
    frameSize,
    frameRadius: Math.round(frameSize * 0.215),
    frameStroke,
    chamberX,
    chamberY,
    chamberSize,
    chamberRadius: Math.round(chamberSize * 0.154),
    breakoutX,
    breakoutY,
    breakoutWidth,
    breakoutHeight,
  }
}

async function normalizeSourceImage(sourceImage: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(sourceImage))
    .rotate()
    .png()
    .toBuffer()
}

async function analyzeSourceImage(params: {
  sourceImage: Buffer
  size: number
}): Promise<SourceAnalysis> {
  const { sourceImage, size } = params
  const metadata = await sharp(sourceImage).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const minDim = Math.min(width, height)
  const lowResolution = minDim > 0 && minDim < Math.round(size * 0.82)

  const sample = 96
  const { data, info } = await sharp(sourceImage)
    .resize(sample, sample, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const edgeInset = Math.max(1, Math.floor(sample * 0.12))
  const topLimit = Math.max(1, Math.floor(sample * 0.22))
  const centerLeft = Math.floor(sample * 0.33)
  const centerRight = Math.ceil(sample * 0.67)

  let meanLumaSum = 0
  let edgeLumaSum = 0
  let edgeCount = 0
  let alphaCoverageCount = 0
  let hasTransparency = false
  let centerLumaSum = 0
  let centerCount = 0

  let topCenterMean = 0
  let topCenterCount = 0
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const a = data[idx + 3] ?? 255
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      meanLumaSum += luma

      if (a > 24) alphaCoverageCount += 1
      if (a < 250) hasTransparency = true

      const isEdge = x < edgeInset || y < edgeInset || x >= info.width - edgeInset || y >= info.height - edgeInset
      if (isEdge) {
        edgeLumaSum += luma
        edgeCount += 1
      }

      if (x >= centerLeft && x < centerRight && y >= centerLeft && y < centerRight) {
        centerLumaSum += luma
        centerCount += 1
      }

      if (x >= centerLeft && x < centerRight && y < topLimit) {
        topCenterMean += luma
        topCenterCount += 1
      }
    }
  }

  const pixelCount = info.width * info.height
  const meanLuma = pixelCount > 0 ? meanLumaSum / pixelCount : 0
  const edgeLuma = edgeCount > 0 ? edgeLumaSum / edgeCount : 0
  const centerLuma = centerCount > 0 ? centerLumaSum / centerCount : meanLuma
  const alphaCoverage = pixelCount > 0 ? alphaCoverageCount / pixelCount : 1
  topCenterMean = topCenterCount > 0 ? topCenterMean / topCenterCount : 0

  let topCenterVariance = 0
  let topOccupancyCount = 0
  let topOccupancyTotal = 0
  for (let y = 0; y < topLimit; y += 1) {
    for (let x = centerLeft; x < centerRight; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const a = data[idx + 3] ?? 255
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const delta = luma - topCenterMean
      topCenterVariance += delta * delta

      topOccupancyTotal += 1
      if (hasTransparency) {
        if (a > 32) topOccupancyCount += 1
      } else {
        const rightIdx = (y * info.width + Math.min(info.width - 1, x + 1)) * info.channels
        const downIdx = (Math.min(info.height - 1, y + 1) * info.width + x) * info.channels
        const lr = data[rightIdx] ?? 0
        const lg = data[rightIdx + 1] ?? 0
        const lb = data[rightIdx + 2] ?? 0
        const dr = data[downIdx] ?? 0
        const dg = data[downIdx + 1] ?? 0
        const db = data[downIdx + 2] ?? 0
        const rightLuma = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
        const downLuma = 0.2126 * dr + 0.7152 * dg + 0.0722 * db
        const detail = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma)
        if (detail > 28) topOccupancyCount += 1
      }
    }
  }

  const topCenterStdDev = topCenterCount > 0 ? Math.sqrt(topCenterVariance / topCenterCount) : 0
  const topOccupancy = topOccupancyTotal > 0 ? topOccupancyCount / topOccupancyTotal : 0
  const centerEdgeDelta = Math.abs(centerLuma - edgeLuma)

  const brightBadgeLike =
    ((meanLuma > 148 && edgeLuma > 146) ||
      meanLuma > 172 ||
      edgeLuma > 188 ||
      (centerLuma > 166 && centerEdgeDelta < 26)) &&
    topCenterStdDev < 31 &&
    topOccupancy < 0.16 &&
    alphaCoverage > 0.78

  let fitMode: ArtworkFitMode = 'cover'
  let preferredScale = 1
  let artworkTone: 'default' | 'bright' = 'default'
  if (brightBadgeLike) {
    fitMode = 'contain'
    preferredScale = 0.79
    artworkTone = 'bright'
  } else if (lowResolution) {
    fitMode = 'cover'
    preferredScale = 0.94
  } else {
    // Tiny non-bright cover overscan to seat subjects into the chamber.
    preferredScale = 1.022
  }
  preferredScale = clamp(preferredScale, 0.79, 1.058)

  const breakoutUpperBound = hasTransparency ? 0.152 : 0.104
  const allowBreakout =
    fitMode === 'cover' &&
    !lowResolution &&
    !brightBadgeLike &&
    meanLuma < 166 &&
    edgeLuma < 192 &&
    centerLuma < 182 &&
    centerEdgeDelta > 18 &&
    topCenterStdDev > 29 &&
    topOccupancy > 0.061 &&
    topOccupancy < breakoutUpperBound

  return {
    lowResolution,
    brightBadgeLike,
    hasTransparency,
    topCenterStdDev,
    topOccupancy,
    preferredScale,
    fitMode,
    artworkTone,
    allowBreakout,
  }
}

function createFrameStrokeRect(layout: PremiumLayout, strokeColor: string): string {
  const inset = layout.frameStroke / 2
  return `<rect
    x="${layout.frameX + inset}"
    y="${layout.frameY + inset}"
    width="${Math.max(1, layout.frameSize - layout.frameStroke)}"
    height="${Math.max(1, layout.frameSize - layout.frameStroke)}"
    rx="${Math.max(1, layout.frameRadius - inset)}"
    fill="none"
    stroke="${strokeColor}"
    stroke-width="${layout.frameStroke}"
    stroke-linejoin="round"
  />`
}

function createFrameGradientSvg(size: number, layout: PremiumLayout): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="frameStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="24%" stop-color="${FRAME_GRADIENT.topLeft}"/>
      <stop offset="50%" stop-color="${FRAME_GRADIENT.middle}"/>
      <stop offset="78%" stop-color="#7EA8FF"/>
      <stop offset="100%" stop-color="${FRAME_GRADIENT.bottomRight}"/>
    </linearGradient>
  </defs>
  ${createFrameStrokeRect(layout, 'url(#frameStroke)')}
</svg>`
}

export async function renderBackgroundCard(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cardGradient" cx="50%" cy="43%" r="74%">
      <stop offset="0%" stop-color="#000002"/>
      <stop offset="44%" stop-color="${BACKGROUND_COLORS.mid}"/>
      <stop offset="100%" stop-color="${BACKGROUND_COLORS.edge}"/>
    </radialGradient>
    <radialGradient id="cardAtmosphere" cx="24%" cy="18%" r="78%">
      <stop offset="0%" stop-color="rgba(20,48,98,0.12)"/>
      <stop offset="46%" stop-color="rgba(8,20,44,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardAtmosphereBr" cx="82%" cy="82%" r="62%">
      <stop offset="0%" stop-color="rgba(18,52,138,0.08)"/>
      <stop offset="54%" stop-color="rgba(8,28,78,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardVignette" cx="50%" cy="56%" r="70%">
      <stop offset="56%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.58)"/>
    </radialGradient>
    <linearGradient id="chamberGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CHAMBER_GRADIENT.top}"/>
      <stop offset="100%" stop-color="${CHAMBER_GRADIENT.bottom}"/>
    </linearGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="#000000"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardGradient)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardAtmosphere)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardAtmosphereBr)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardVignette)"/>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberGradient)"
  />
</svg>`

  const base = await sharp(Buffer.from(svg)).png().toBuffer()
  const innerShadowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="none"
    stroke="#000000"
    stroke-opacity="0.66"
    stroke-width="${Math.max(10, Math.round(size * 0.022))}"
  />
</svg>`
  const innerShadow = await sharp(Buffer.from(innerShadowSvg))
    .blur(Math.max(6.2, size * 0.0121))
    .png()
    .toBuffer()

  const chamberDepthSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="chamberVignette" cx="50%" cy="46%" r="66%">
      <stop offset="58%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.7)"/>
    </radialGradient>
    <linearGradient id="chamberTopShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.39)"/>
      <stop offset="36%" stop-color="rgba(0,0,0,0.02)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.25)"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberVignette)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberTopShade)"
  />
</svg>`
  const chamberDepth = await sharp(Buffer.from(chamberDepthSvg))
    .png()
    .toBuffer()

  return sharp(base)
    .composite([
      { input: innerShadow, blend: 'multiply' },
      { input: chamberDepth, blend: 'multiply' },
    ])
    .png()
    .toBuffer()
}

export async function renderOuterGlow(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const glowStroke = Math.max(21, Math.round(layout.frameStroke * 1.28))
  const inset = glowStroke / 2
  const glowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX + inset}"
    y="${layout.frameY + inset}"
    width="${Math.max(1, layout.frameSize - glowStroke)}"
    height="${Math.max(1, layout.frameSize - glowStroke)}"
    rx="${Math.max(1, layout.frameRadius - inset)}"
    fill="none"
    stroke="${OUTER_GLOW_COLOR}"
    stroke-width="${glowStroke}"
  />
</svg>`

  const glowBase = await sharp(Buffer.from(glowSvg)).png().toBuffer()
  const core = await applyOpacity(glowBase, 0.08)
  const blurNear = await sharp(glowBase)
    .blur(Math.max(15, size * 0.048))
    .png()
    .toBuffer()
  const blurMid = await sharp(glowBase)
    .blur(Math.max(32, size * 0.112))
    .png()
    .toBuffer()
  const blurFar = await sharp(glowBase)
    .blur(Math.max(54, size * 0.175))
    .png()
    .toBuffer()
  const directionalAuraSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="auraTl" cx="26%" cy="24%" r="54%">
      <stop offset="0%" stop-color="rgba(242,247,255,0.16)"/>
      <stop offset="32%" stop-color="rgba(126,168,255,0.12)"/>
      <stop offset="72%" stop-color="rgba(47,111,255,0.035)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
    <radialGradient id="auraBr" cx="78%" cy="80%" r="56%">
      <stop offset="0%" stop-color="rgba(47,111,255,0.2)"/>
      <stop offset="42%" stop-color="rgba(47,111,255,0.1)"/>
      <stop offset="84%" stop-color="rgba(47,111,255,0.028)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#auraTl)" />
  <rect width="${size}" height="${size}" fill="url(#auraBr)" />
</svg>`
  const directionalAura = await sharp(Buffer.from(directionalAuraSvg)).png().toBuffer()
  const merged = await sharp(blurFar)
    .composite([
      { input: await applyOpacity(blurMid, 0.6), blend: 'screen' },
      { input: await applyOpacity(blurNear, 0.82), blend: 'screen' },
      { input: core, blend: 'screen' },
      { input: await applyOpacity(directionalAura, 0.62), blend: 'screen' },
    ])
    .png()
    .toBuffer()

  const innerCutInset = Math.max(1, Math.round(layout.frameStroke * 0.56))
  const holeSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX + innerCutInset}"
    y="${layout.frameY + innerCutInset}"
    width="${Math.max(1, layout.frameSize - innerCutInset * 2)}"
    height="${Math.max(1, layout.frameSize - innerCutInset * 2)}"
    rx="${Math.max(1, layout.frameRadius - innerCutInset)}"
    fill="white"
  />
</svg>`
  const hole = await sharp(Buffer.from(holeSvg))
    .blur(Math.max(1.8, size * 0.0042))
    .png()
    .toBuffer()
  const outsideOnly = await sharp(merged)
    .ensureAlpha()
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()

  return applyOpacity(outsideOnly, 0.86)
}

export async function renderFrameBloom(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const strokeLayer = await sharp(Buffer.from(createFrameGradientSvg(size, layout))).png().toBuffer()
  const bloomNear = await sharp(strokeLayer)
    .blur(Math.max(2.5, size * 0.0059))
    .png()
    .toBuffer()
  const bloomFar = await sharp(strokeLayer)
    .blur(Math.max(5.8, size * 0.0128))
    .png()
    .toBuffer()
  const merged = await sharp(bloomFar)
    .composite([{ input: await applyOpacity(bloomNear, 0.72), blend: 'screen' }])
    .png()
    .toBuffer()
  return applyOpacity(merged, 0.62)
}

export async function renderPremiumFrame(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const strokeLayer = await sharp(Buffer.from(createFrameGradientSvg(size, layout))).png().toBuffer()
  const ringMask = await sharp(strokeLayer)
    .ensureAlpha()
    .extractChannel('alpha')
    .png()
    .toBuffer()

  const faceRolloverSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="faceRoll" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="38%" stop-color="rgba(255,255,255,0.13)"/>
      <stop offset="72%" stop-color="rgba(120,166,255,0.1)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0.05)"/>
    </linearGradient>
    <radialGradient id="specularTl" cx="28%" cy="24%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
      <stop offset="36%" stop-color="rgba(255,255,255,0.11)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect x="${layout.frameX}" y="${layout.frameY}" width="${layout.frameSize}" height="${layout.frameSize}" rx="${layout.frameRadius}" fill="url(#faceRoll)" />
  <rect x="${layout.frameX}" y="${layout.frameY}" width="${layout.frameSize}" height="${layout.frameSize}" rx="${layout.frameRadius}" fill="url(#specularTl)" />
</svg>`
  const faceRolloverRaw = await sharp(Buffer.from(faceRolloverSvg)).png().toBuffer()
  const faceRollover = await sharp(faceRolloverRaw)
    .ensureAlpha()
    .composite([{ input: ringMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const faceSoft = await sharp(strokeLayer)
    .blur(Math.max(0.75, size * 0.0021))
    .png()
    .toBuffer()

  const chamberMaskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="white"
  />
</svg>`
  const chamberMask = await sharp(Buffer.from(chamberMaskSvg)).png().toBuffer()
  const contactShadowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="none"
    stroke="rgba(0,0,0,0.5)"
    stroke-width="${Math.max(4, Math.round(size * 0.0105))}"
  />
</svg>`
  const contactShadowRaw = await sharp(Buffer.from(contactShadowSvg))
    .blur(Math.max(1.6, size * 0.0036))
    .png()
    .toBuffer()
  const contactShadowInside = await sharp(contactShadowRaw)
    .ensureAlpha()
    .composite([{ input: chamberMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return sharp(strokeLayer)
    .composite([
      { input: await applyOpacity(faceSoft, 0.14), blend: 'screen' },
      { input: await applyOpacity(faceRollover, 0.5), blend: 'screen' },
      { input: contactShadowInside, blend: 'multiply' },
    ])
    .png()
    .toBuffer()
}

async function renderPlacedSourceCanvas(params: {
  sourceImage: Buffer
  layout: PremiumLayout
  scale: number
  fit: ArtworkFitMode
  topBiasPx?: number
}): Promise<Buffer> {
  const { sourceImage, layout, scale, fit } = params
  const artSize =
    fit === 'contain'
      ? Math.max(1, Math.round(layout.chamberSize * clamp(scale, 0.74, 1)))
      : Math.max(1, Math.round(layout.chamberSize * clamp(scale, 0.92, 1.08)))
  const artX = Math.round((layout.size - artSize) / 2)
  const topBias =
    fit === 'cover'
      ? Math.round(clamp(params.topBiasPx ?? 0, 0, layout.chamberSize * 0.022))
      : 0
  const artY = Math.round((layout.size - artSize) / 2) - topBias

  const placed = await sharp(sourceImage)
    .resize(artSize, artSize, {
      fit,
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return createTransparentCanvas(layout.size)
    .composite([{ input: placed, left: artX, top: artY }])
    .png()
    .toBuffer()
}

async function renderFallbackSymbolLayer(params: {
  size: number
  layout: PremiumLayout
  symbol?: string
}): Promise<Buffer> {
  const { size, layout } = params
  const fallback = (params.symbol ?? 'TOKEN').trim() || 'TOKEN'
  const safeSymbol = escapeXml(fallback.toUpperCase().replace(/[^A-Z0-9$._-]/g, '').slice(0, 6) || 'TOKEN')
  const fontSize = Math.max(18, Math.round(layout.chamberSize * 0.2))
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fallbackBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#152236"/>
      <stop offset="100%" stop-color="#0A1220"/>
    </linearGradient>
    <linearGradient id="fallbackInk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EAF1FF"/>
      <stop offset="100%" stop-color="#9FC0FF"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#fallbackBg)"
  />
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="url(#fallbackInk)"
    font-size="${fontSize}"
    font-weight="700"
    font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    letter-spacing="0.02em"
  >${safeSymbol}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function renderArtworkLayer(params: {
  size: number
  layout: PremiumLayout
  sourceImage?: Uint8Array
  symbol?: string
  scale?: number
  fit?: ArtworkFitMode
  tone?: 'default' | 'bright'
  topBiasPx?: number
}): Promise<Buffer> {
  const { layout } = params
  if (!params.sourceImage || params.sourceImage.length === 0) {
    return renderFallbackSymbolLayer({
      size: params.size,
      layout,
      symbol: params.symbol,
    })
  }

  const normalized = await normalizeSourceImage(params.sourceImage)
  const sourceCanvas = await renderPlacedSourceCanvas({
    sourceImage: normalized,
    layout,
    scale: params.scale ?? 1.04,
    fit: params.fit ?? 'cover',
    topBiasPx: params.topBiasPx,
  })

  const clipSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="white"
  />
</svg>`
  const chamberMask = await sharp(Buffer.from(clipSvg)).png().toBuffer()

  const clipped = await sharp(sourceCanvas)
    .ensureAlpha()
    .composite([{ input: chamberMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const isBrightTone = params.tone === 'bright'
  const toned = isBrightTone
    ? await sharp(clipped)
        .modulate({
          brightness: 0.82,
          saturation: 0.86,
        })
        .linear(1.1, -12)
        .png()
        .toBuffer()
    : await sharp(clipped)
        .modulate({
          brightness: 0.98,
          saturation: 1.03,
        })
        .linear(1.05, -6)
        .png()
        .toBuffer()

  const vignetteOuterOpacity = isBrightTone ? 0.56 : 0.37
  const bottomScrimOpacity = isBrightTone ? 0.48 : 0.26
  const topScrimOpacity = isBrightTone ? 0.22 : 0.1
  const edgeContactOpacity = isBrightTone ? 0.38 : 0.26
  const vignetteSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="artVignette" cx="50%" cy="45%" r="64%">
      <stop offset="62%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${vignetteOuterOpacity})"/>
    </radialGradient>
    <linearGradient id="bottomScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${bottomScrimOpacity})"/>
    </linearGradient>
    <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,${topScrimOpacity})"/>
      <stop offset="36%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <radialGradient id="edgeContact" cx="50%" cy="50%" r="64%">
      <stop offset="72%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${edgeContactOpacity})"/>
    </radialGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#artVignette)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#bottomScrim)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#topScrim)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#edgeContact)"
  />
</svg>`
  const vignette = await sharp(Buffer.from(vignetteSvg)).png().toBuffer()
  const topEdgeLiftOpacity = isBrightTone ? 0.028 : 0.054
  const topEdgeLiftSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topEdgeLift" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,${topEdgeLiftOpacity})"/>
      <stop offset="20%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#topEdgeLift)"
  />
</svg>`
  const topEdgeLift = await sharp(Buffer.from(topEdgeLiftSvg)).png().toBuffer()
  const seated = await sharp(toned)
    .composite([{ input: vignette, blend: 'multiply' }])
    .png()
    .toBuffer()

  return sharp(seated)
    .composite([{ input: topEdgeLift, blend: 'screen' }])
    .png()
    .toBuffer()
}

async function createTopBreakoutMask(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const top = layout.breakoutY
  const bottom = Math.min(size, top + layout.breakoutHeight)
  const height = Math.max(1, bottom - top)
  const radius = Math.max(1, Math.round(layout.breakoutWidth * 0.24))
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fadeY" x1="0" y1="${top}" x2="0" y2="${bottom}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="18%" stop-color="white" stop-opacity="1"/>
      <stop offset="62%" stop-color="white" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeX" x1="${layout.breakoutX}" y1="0" x2="${layout.breakoutX + layout.breakoutWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="31%" stop-color="white" stop-opacity="1"/>
      <stop offset="69%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.breakoutX}"
    y="${top}"
    width="${layout.breakoutWidth}"
    height="${height}"
    rx="${radius}"
    fill="url(#fadeY)"
  />
  <rect
    x="${layout.breakoutX}"
    y="${top}"
    width="${layout.breakoutWidth}"
    height="${height}"
    rx="${radius}"
    fill="url(#fadeX)"
  />
</svg>`
  return sharp(Buffer.from(svg))
    .blur(0.4)
    .png()
    .toBuffer()
}

async function createTopBreakoutSubjectMask(params: {
  sourceCanvas: Buffer
  layout: PremiumLayout
}): Promise<Buffer> {
  const { sourceCanvas, layout } = params
  const { data, info } = await sharp(sourceCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const regionPadX = Math.max(1, Math.round(layout.breakoutWidth * 0.14))
  const regionPadY = Math.max(1, Math.round(layout.breakoutHeight * 0.26))
  const x0 = Math.max(0, layout.breakoutX - regionPadX)
  const x1 = Math.min(width, layout.breakoutX + layout.breakoutWidth + regionPadX)
  const y0 = Math.max(0, layout.breakoutY - regionPadY)
  const y1 = Math.min(height, layout.breakoutY + Math.round(layout.breakoutHeight * 1.45))

  let alphaPartialCount = 0
  let alphaCount = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const a = data[idx + 3] ?? 255
      alphaCount += 1
      if (a < 250) alphaPartialCount += 1
    }
  }
  const hasMeaningfulTransparency = alphaCount > 0 && alphaPartialCount / alphaCount > 0.004

  let bgLumaSum = 0
  let bgLumaCount = 0
  const bgY0 = Math.max(0, layout.chamberY - Math.round(layout.breakoutHeight * 0.8))
  const bgY1 = Math.min(height, layout.chamberY + Math.round(layout.chamberSize * 0.14))
  const chamberRight = layout.chamberX + layout.chamberSize
  for (let y = bgY0; y < bgY1; y += 1) {
    for (let x = layout.chamberX; x < chamberRight; x += 1) {
      if (x >= x0 && x < x1) continue
      if (x < 0 || x >= width) continue
      const idx = (y * width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      bgLumaSum += luma
      bgLumaCount += 1
    }
  }
  const bgLuma = bgLumaCount > 0 ? bgLumaSum / bgLumaCount : 120

  const mask = Buffer.alloc(width * height, 0)
  let presentCount = 0
  let presentTopCount = 0
  let presentMinX = width
  let presentMaxX = -1
  let presentMinY = height
  let presentMaxY = -1
  let sumPresentX = 0
  let sumPresentY = 0
  let presentLumaSum = 0
  const regionArea = Math.max(1, (x1 - x0) * (y1 - y0))
  const subjectTopBandY = y0 + Math.floor((y1 - y0) * 0.58)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const a = data[idx + 3] ?? 255
      let present = false

      if (hasMeaningfulTransparency) {
        present = a > 28
      } else {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const rx = Math.min(width - 1, x + 1)
        const dy = Math.min(height - 1, y + 1)
        const rightIdx = (y * width + rx) * info.channels
        const downIdx = (dy * width + x) * info.channels
        const rr = data[rightIdx] ?? 0
        const rg = data[rightIdx + 1] ?? 0
        const rb = data[rightIdx + 2] ?? 0
        const dr = data[downIdx] ?? 0
        const dg = data[downIdx + 1] ?? 0
        const db = data[downIdx + 2] ?? 0
        const rightLuma = 0.2126 * rr + 0.7152 * rg + 0.0722 * rb
        const downLuma = 0.2126 * dr + 0.7152 * dg + 0.0722 * db
        const detail = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma)
        const contrastToBg = Math.abs(luma - bgLuma)
        const chroma = Math.max(r, g, b) - Math.min(r, g, b)
        const notWashed = luma < 236
        present = (
          (detail > 24 && contrastToBg > 10 && notWashed) ||
          (contrastToBg > 32 && chroma > 10 && notWashed)
        )
      }

      if (present) {
        mask[y * width + x] = 255
        presentCount += 1
        sumPresentX += x
        sumPresentY += y
        presentLumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (y <= subjectTopBandY) presentTopCount += 1
        if (x < presentMinX) presentMinX = x
        if (x > presentMaxX) presentMaxX = x
        if (y < presentMinY) presentMinY = y
        if (y > presentMaxY) presentMaxY = y
      }
    }
  }

  if (presentCount <= 0) {
    return createTransparentCanvas(layout.size).png().toBuffer()
  }

  const presentRatio = presentCount / regionArea
  const bboxWidth = Math.max(1, presentMaxX - presentMinX + 1)
  const bboxHeight = Math.max(1, presentMaxY - presentMinY + 1)
  const widthRatio = bboxWidth / Math.max(1, x1 - x0)
  const heightRatio = bboxHeight / Math.max(1, y1 - y0)
  const topWeightedRatio = presentTopCount / presentCount
  const centroidX = sumPresentX / presentCount
  const centroidY = sumPresentY / presentCount
  const centroidNorm = (centroidX - x0) / Math.max(1, x1 - x0)
  const centroidYNorm = (centroidY - y0) / Math.max(1, y1 - y0)
  const presentMeanLuma = presentLumaSum / presentCount
  const flatnessRatio = widthRatio / Math.max(0.001, heightRatio)
  if (
    presentRatio < 0.018 ||
    presentRatio > 0.42 ||
    widthRatio > 0.7 ||
    heightRatio > 0.82 ||
    heightRatio < 0.11 ||
    topWeightedRatio < 0.36 ||
    centroidNorm < 0.2 ||
    centroidNorm > 0.8 ||
    centroidYNorm > 0.58 ||
    flatnessRatio > 3.2 ||
    presentMeanLuma > 220
  ) {
    return createTransparentCanvas(layout.size).png().toBuffer()
  }

  return sharp(mask, { raw: { width, height, channels: 1 } })
    .threshold(12)
    .dilate(1)
    .blur(0.36)
    .png()
    .toBuffer()
}

export async function renderBreakoutLayer(params: {
  size: number
  layout: PremiumLayout
  sourceImage?: Uint8Array
  opacity?: number
  scale?: number
  topBiasPx?: number
}): Promise<Buffer> {
  const { size, layout } = params
  if (!params.sourceImage || params.sourceImage.length === 0) {
    return createTransparentCanvas(size).png().toBuffer()
  }

  const normalized = await normalizeSourceImage(params.sourceImage)
  const sourceCanvas = await renderPlacedSourceCanvas({
    sourceImage: normalized,
    layout,
    scale: params.scale ?? 1.04,
    fit: 'cover',
    topBiasPx: params.topBiasPx,
  })
  const breakoutMask = await createTopBreakoutMask({ size, layout })
  const subjectMask = await createTopBreakoutSubjectMask({
    sourceCanvas,
    layout,
  })

  const masked = await sharp(sourceCanvas)
    .ensureAlpha()
    .composite([
      { input: breakoutMask, blend: 'dest-in' },
      { input: subjectMask, blend: 'dest-in' },
    ])
    .blur(0.22)
    .png()
    .toBuffer()

  return applyOpacity(masked, params.opacity ?? 0.21)
}

function buildCompositeStep(input: Buffer, blend: BlendMode): sharp.OverlayOptions {
  return { input, blend }
}

export async function renderPremiumTokenIcon(params: {
  size: number
  sourceImage?: Uint8Array
  symbol?: string
}): Promise<Buffer> {
  const size = sanitizeSize(params.size)
  const layout = getTokenIconLayout(size)

  const backgroundCard = await renderBackgroundCard({ size, layout })
  const outerGlow = await renderOuterGlow({ size, layout })
  const frameBloom = await renderFrameBloom({ size, layout })
  const premiumFrame = await renderPremiumFrame({ size, layout })

  let artworkLayer: Buffer
  let breakoutLayer: Buffer | null = null

  if (params.sourceImage && params.sourceImage.length > 0) {
    try {
      const normalized = await normalizeSourceImage(params.sourceImage)
      const analysis = await analyzeSourceImage({
        sourceImage: normalized,
        size,
      })
      const topBiasPx = analysis.allowBreakout ? Math.max(1, Math.round(layout.chamberSize * 0.011)) : 0
      artworkLayer = await renderArtworkLayer({
        size,
        layout,
        sourceImage: new Uint8Array(normalized),
        scale: analysis.preferredScale,
        fit: analysis.fitMode,
        tone: analysis.artworkTone,
        topBiasPx,
        symbol: params.symbol,
      })

      if (analysis.allowBreakout) {
        breakoutLayer = await renderBreakoutLayer({
          size,
          layout,
          sourceImage: new Uint8Array(normalized),
          opacity: 0.21,
          scale: analysis.preferredScale,
          topBiasPx,
        })
      }
    } catch (error) {
      console.warn('[token/image] premium renderer source decode failed; using symbol fallback:', error)
      artworkLayer = await renderArtworkLayer({
        size,
        layout,
        symbol: params.symbol,
      })
      breakoutLayer = null
    }
  } else {
    artworkLayer = await renderArtworkLayer({
      size,
      layout,
      symbol: params.symbol,
    })
  }

  const overlays: sharp.OverlayOptions[] = [
    buildCompositeStep(outerGlow, 'screen'),
    buildCompositeStep(frameBloom, 'screen'),
    buildCompositeStep(artworkLayer, 'over'),
    buildCompositeStep(premiumFrame, 'over'),
  ]

  if (breakoutLayer) {
    overlays.push(buildCompositeStep(breakoutLayer, 'over'))
  }

  return sharp(backgroundCard)
    .composite(overlays)
    .flatten({ background: '#000000' })
    .png()
    .toBuffer()
}

