import sharp from 'sharp'

type BlendMode = NonNullable<sharp.OverlayOptions['blend']>
type ArtworkFitMode = 'cover' | 'contain'
type SourceClass = 'brightBadge' | 'portraitPhoto' | 'illustration' | 'pixelArt' | 'generic'

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
  sourceClass: SourceClass
  isPortraitLikeHeroAsset: boolean
  usePortraitEnhancement: boolean
}

type StackLayerConfig = {
  offsetXRatio: number
  offsetYRatio: number
  opacity: number
  blurPx: number
  brightness: number
  saturation: number
  scaleMultiplier: number
  topBiasMultiplier: number
}

type StackConfig = {
  enabled: boolean
  layers: StackLayerConfig[]
}

type StackedArtworkUnderlay = {
  rearLayerB: Buffer | null
  rearLayerA: Buffer | null
}

const BACKGROUND_COLORS = {
  center: '#000000',
  mid: '#000001',
  edge: '#000000',
} as const

const OUTER_GLOW_COLOR = '#2F6FFF'
const FRAME_GRADIENT = {
  topLeft: '#E8EDF6',
  middle: '#CED6E5',
  bottomRight: '#3A74FF',
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
  const frameInset = Math.round(size * 0.168)
  const frameSize = Math.max(1, size - frameInset * 2)
  const frameStroke = clamp(Math.round(frameSize * 0.069), Math.round(frameSize * 0.063), Math.round(frameSize * 0.079))
  const chamberInset = Math.max(Math.round(frameStroke * 1.08), Math.round(frameSize * 0.036))
  const chamberSize = Math.max(1, frameSize - chamberInset * 2)
  const chamberX = frameInset + chamberInset
  const chamberY = chamberX
  const breakoutWidth = Math.max(1, Math.round(chamberSize * 0.20))
  const breakoutHeight = Math.max(1, Math.round(chamberSize * 0.13))
  const breakoutX = chamberX + Math.round((chamberSize - breakoutWidth) / 2)
  const breakoutY = Math.max(0, chamberY - Math.round(chamberSize * 0.068))

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

async function createChamberMask(layout: PremiumLayout): Promise<Buffer> {
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
  return sharp(Buffer.from(clipSvg)).png().toBuffer()
}

function getStackConfigForSourceClass(params: {
  sourceClass: SourceClass
  hasTransparency: boolean
}): StackConfig {
  const { sourceClass, hasTransparency } = params
  switch (sourceClass) {
    case 'brightBadge':
      return { enabled: false, layers: [] }
    case 'portraitPhoto':
      return {
        enabled: true,
        layers: [
          {
            // Rear B (deeper/farther): modest offset and lower opacity.
            offsetXRatio: 0.024,
            offsetYRatio: 0.018,
            opacity: 0.18,
            blurPx: 0.82,
            brightness: 0.93,
            saturation: 0.92,
            scaleMultiplier: 1.014,
            topBiasMultiplier: 0.34,
          },
          {
            // Rear A (nearer): clearer stack read while still subordinate to hero.
            offsetXRatio: -0.055,
            offsetYRatio: -0.038,
            opacity: 0.39,
            blurPx: 0.56,
            brightness: 0.97,
            saturation: 0.96,
            scaleMultiplier: 1.006,
            topBiasMultiplier: 0.48,
          },
        ],
      }
    case 'illustration':
      return {
        enabled: true,
        layers: hasTransparency
          ? [
              {
                offsetXRatio: 0.024,
                offsetYRatio: 0.018,
                opacity: 0.17,
                blurPx: 0.8,
                brightness: 0.93,
                saturation: 0.91,
                scaleMultiplier: 1.014,
                topBiasMultiplier: 0.29,
              },
              {
                offsetXRatio: -0.052,
                offsetYRatio: -0.036,
                opacity: 0.38,
                blurPx: 0.54,
                brightness: 0.97,
                saturation: 0.95,
                scaleMultiplier: 1.006,
                topBiasMultiplier: 0.4,
              },
            ]
          : [
              {
                offsetXRatio: 0.027,
                offsetYRatio: 0.02,
                opacity: 0.22,
                blurPx: 0.84,
                brightness: 0.93,
                saturation: 0.92,
                scaleMultiplier: 1.016,
                topBiasMultiplier: 0.3,
              },
              {
                offsetXRatio: -0.056,
                offsetYRatio: -0.039,
                opacity: 0.42,
                blurPx: 0.58,
                brightness: 0.97,
                saturation: 0.95,
                scaleMultiplier: 1.008,
                topBiasMultiplier: 0.42,
              },
            ],
      }
    case 'pixelArt':
      return {
        enabled: true,
        layers: [
          {
            offsetXRatio: -0.012,
            offsetYRatio: -0.009,
            opacity: 0.1,
            blurPx: 0.04,
            brightness: 0.95,
            saturation: 0.96,
            scaleMultiplier: 0.998,
            topBiasMultiplier: 0.22,
          },
        ],
      }
    case 'generic':
    default:
      return {
        enabled: true,
        layers: [
          {
            offsetXRatio: -0.036,
            offsetYRatio: -0.025,
            opacity: 0.24,
            blurPx: 0.58,
            brightness: 0.96,
            saturation: 0.95,
            scaleMultiplier: 1.006,
            topBiasMultiplier: 0.3,
          },
        ],
      }
  }
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
  let chromaSum = 0
  let strongEdgeCount = 0
  let edgeDetailCount = 0
  const quantizedColorBuckets = new Set<number>()

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
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      meanLumaSum += luma
      chromaSum += chroma
      quantizedColorBuckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))

      if (a > 24) alphaCoverageCount += 1
      if (a < 250) hasTransparency = true

      if (x < info.width - 1 && y < info.height - 1) {
        const rightIdx = (y * info.width + (x + 1)) * info.channels
        const downIdx = ((y + 1) * info.width + x) * info.channels
        const rr = data[rightIdx] ?? 0
        const rg = data[rightIdx + 1] ?? 0
        const rb = data[rightIdx + 2] ?? 0
        const dr = data[downIdx] ?? 0
        const dg = data[downIdx + 1] ?? 0
        const db = data[downIdx + 2] ?? 0
        const rightLuma = 0.2126 * rr + 0.7152 * rg + 0.0722 * rb
        const downLuma = 0.2126 * dr + 0.7152 * dg + 0.0722 * db
        const detail = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma)
        if (detail > 52) strongEdgeCount += 1
        edgeDetailCount += 1
      }

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
  const meanChroma = pixelCount > 0 ? chromaSum / pixelCount : 0
  const strongEdgeRatio = edgeDetailCount > 0 ? strongEdgeCount / edgeDetailCount : 0
  const colorBucketCount = quantizedColorBuckets.size
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
        if (detail > 18) topOccupancyCount += 1
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
      (meanLuma > 162 && strongEdgeRatio < 0.06 && topCenterStdDev < 25) ||
      (centerLuma > 166 && centerEdgeDelta < 24)) &&
    topCenterStdDev < 30 &&
    topOccupancy < 0.14 &&
    alphaCoverage > 0.8 &&
    strongEdgeRatio < 0.14

  const centerVsEdge = centerLuma - edgeLuma

  const pixelArtLike =
    !brightBadgeLike &&
    lowResolution &&
    (colorBucketCount < 620 || meanChroma < 24) &&
    strongEdgeRatio > 0.105

  const portraitPhotoLike =
    !brightBadgeLike &&
    !pixelArtLike &&
    !lowResolution &&
    !hasTransparency &&
    meanLuma > 34 &&
    meanLuma < 176 &&
    edgeLuma > 18 &&
    edgeLuma < 188 &&
    centerLuma > 26 &&
    centerLuma < 198 &&
    centerVsEdge > -14 &&
    centerVsEdge < 72 &&
    centerEdgeDelta > 16 &&
    topCenterStdDev > 19 &&
    topCenterStdDev < 66 &&
    topOccupancy > 0.032 &&
    topOccupancy < 0.26 &&
    meanChroma > 12 &&
    strongEdgeRatio > 0.028 &&
    strongEdgeRatio < 0.36 &&
    colorBucketCount > 560

  const illustrationLike =
    !brightBadgeLike &&
    !pixelArtLike &&
    !portraitPhotoLike &&
    (hasTransparency || meanChroma > 24 || topCenterStdDev > 25) &&
    centerEdgeDelta > 12

  const sourceClass: SourceClass = brightBadgeLike
    ? 'brightBadge'
    : pixelArtLike
      ? 'pixelArt'
      : portraitPhotoLike
        ? 'portraitPhoto'
        : illustrationLike
          ? 'illustration'
          : 'generic'

  let fitMode: ArtworkFitMode = 'cover'
  let preferredScale = 1
  let artworkTone: 'default' | 'bright' = 'default'
  if (sourceClass === 'brightBadge') {
    fitMode = 'contain'
    preferredScale = 0.87
    artworkTone = 'bright'
  } else if (sourceClass === 'pixelArt') {
    fitMode = 'cover'
    preferredScale = 1.005
  } else if (sourceClass === 'portraitPhoto') {
    fitMode = 'cover'
    preferredScale = 1.06
  } else if (lowResolution) {
    fitMode = 'cover'
    preferredScale = 0.968
  } else if (sourceClass === 'illustration') {
    fitMode = 'cover'
    preferredScale = 1.04
  } else {
    // Slight overscan so generic artwork fills the chamber with minimal dead border.
    preferredScale = 1.025
  }
  preferredScale = clamp(preferredScale, 0.79, 1.08)

  const breakoutUpperBound = hasTransparency ? 0.22 : 0.82
  const allowBreakout =
    fitMode === 'cover' &&
    !lowResolution &&
    !brightBadgeLike &&
    sourceClass !== 'pixelArt' &&
    (sourceClass === 'portraitPhoto' || sourceClass === 'illustration') &&
    meanLuma < 196 &&
    edgeLuma < 240 &&
    centerLuma < 198 &&
    centerEdgeDelta > 14 &&
    topCenterStdDev > 20 &&
    topOccupancy > 0.032 &&
    topOccupancy < breakoutUpperBound

  const isPortraitLikeHeroAsset =
    sourceClass === 'portraitPhoto' &&
    fitMode === 'cover' &&
    !brightBadgeLike &&
    !lowResolution
  const usePortraitEnhancement = isPortraitLikeHeroAsset

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
    sourceClass,
    isPortraitLikeHeroAsset,
    usePortraitEnhancement,
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
      <stop offset="20%" stop-color="${FRAME_GRADIENT.topLeft}"/>
      <stop offset="48%" stop-color="${FRAME_GRADIENT.middle}"/>
      <stop offset="74%" stop-color="#9FB3E6"/>
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
    <radialGradient id="cardGradient" cx="50%" cy="43%" r="61%">
      <stop offset="0%" stop-color="#000001"/>
      <stop offset="28%" stop-color="${BACKGROUND_COLORS.mid}"/>
      <stop offset="100%" stop-color="${BACKGROUND_COLORS.edge}"/>
    </radialGradient>
    <radialGradient id="cardAtmosphere" cx="26%" cy="22%" r="54%">
      <stop offset="0%" stop-color="rgba(8,18,34,0.016)"/>
      <stop offset="46%" stop-color="rgba(2,7,18,0.0036)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardAtmosphereBr" cx="78%" cy="79%" r="50%">
      <stop offset="0%" stop-color="rgba(12,30,78,0.014)"/>
      <stop offset="54%" stop-color="rgba(3,10,28,0.0032)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardVignette" cx="50%" cy="56%" r="70%">
      <stop offset="43%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.79)"/>
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
    <radialGradient id="chamberVignette" cx="50%" cy="50%" r="66%">
      <stop offset="58%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.7)"/>
    </radialGradient>
    <linearGradient id="chamberTopShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.28)"/>
      <stop offset="28%" stop-color="rgba(0,0,0,0.02)"/>
t      <stop offset="100%" stop-color="rgba(0,0,0,0.25)"/>
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
  const core = await applyOpacity(glowBase, 0.058)
  const blurNear = await sharp(glowBase)
    .blur(Math.max(24, size * 0.08))
    .png()
    .toBuffer()
  const blurMid = await sharp(glowBase)
    .blur(Math.max(60, size * 0.22))
    .png()
    .toBuffer()
  const blurFar = await sharp(glowBase)
    .blur(Math.max(220, size * 0.58))
    .png()
    .toBuffer()
  const blurAmbient = await sharp(glowBase)
    .blur(Math.min(1000, Math.max(400, size * 0.96)))
    .png()
    .toBuffer()
  const directionalAuraSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="auraTl" cx="24%" cy="22%" r="72%">
      <stop offset="0%" stop-color="rgba(246,250,255,0.11)"/>
      <stop offset="34%" stop-color="rgba(176,205,255,0.058)"/>
      <stop offset="74%" stop-color="rgba(88,142,255,0.013)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
    <radialGradient id="auraBr" cx="80%" cy="82%" r="82%">
      <stop offset="0%" stop-color="rgba(58,116,255,0.26)"/>
      <stop offset="38%" stop-color="rgba(58,116,255,0.14)"/>
      <stop offset="78%" stop-color="rgba(58,116,255,0.038)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#auraTl)" />
  <rect width="${size}" height="${size}" fill="url(#auraBr)" />
</svg>`
  const directionalAura = await sharp(Buffer.from(directionalAuraSvg)).png().toBuffer()
  const merged = await createTransparentCanvas(size)
    .composite([
      { input: await applyOpacity(blurAmbient, 0.72), blend: 'screen' },
      { input: await applyOpacity(blurFar, 0.84), blend: 'screen' },
      { input: await applyOpacity(blurMid, 0.62), blend: 'screen' },
      { input: await applyOpacity(blurNear, 0.75), blend: 'screen' },
      { input: core, blend: 'screen' },
      { input: await applyOpacity(directionalAura, 0.62), blend: 'screen' },
    ])
    .png()
    .toBuffer()

  const innerCutInset = Math.max(1, Math.round(layout.frameStroke * 0.62))
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
    .blur(Math.max(9, size * 0.019))
    .png()
    .toBuffer()
  const outsideOnly = await sharp(merged)
    .ensureAlpha()
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()

  return applyOpacity(outsideOnly, 0.95)
}

export async function renderFrameBloom(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const strokeLayer = await sharp(Buffer.from(createFrameGradientSvg(size, layout))).png().toBuffer()
  const bloomNear = await sharp(strokeLayer)
    .blur(Math.max(3.9, size * 0.0087))
    .png()
    .toBuffer()
  const bloomFar = await sharp(strokeLayer)
    .blur(Math.max(28, size * 0.054))
    .png()
    .toBuffer()
  const merged = await sharp(bloomFar)
    .composite([{ input: await applyOpacity(bloomNear, 0.68), blend: 'screen' }])
    .png()
    .toBuffer()
  return applyOpacity(merged, 0.88)
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
      <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
      <stop offset="38%" stop-color="rgba(255,255,255,0.17)"/>
      <stop offset="72%" stop-color="rgba(120,166,255,0.13)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0.07)"/>
    </linearGradient>
    <radialGradient id="specularTl" cx="28%" cy="24%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.39)"/>
      <stop offset="36%" stop-color="rgba(255,255,255,0.14)"/>
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
    .blur(Math.max(0.9, size * 0.0025))
    .png()
    .toBuffer()
  const faceEmission = await sharp(strokeLayer)
    .blur(Math.max(1.6, size * 0.0045))
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
      { input: await applyOpacity(faceSoft, 0.2), blend: 'screen' },
      { input: await applyOpacity(faceEmission, 0.17), blend: 'screen' },
      { input: await applyOpacity(faceRollover, 0.58), blend: 'screen' },
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
  sourceClass?: SourceClass
  maxTopBiasRatio?: number
  cropPosition?: 'centre' | 'top'
}): Promise<Buffer> {
  const { sourceImage, layout, scale, fit } = params
  const liftMultiplier =
    fit !== 'cover' ? 0
    : params.sourceClass === 'portraitPhoto' ? 0.048
    : params.sourceClass === 'illustration' ? 0.042
    : params.sourceClass === 'pixelArt' ? 0.028
    : params.sourceClass === 'brightBadge' ? 0.003
    : 0.034
  const opticalLiftPx = Math.round(layout.chamberSize * liftMultiplier)

  let artSize =
    fit === 'contain'
      ? Math.max(1, Math.round(layout.chamberSize * clamp(scale, 0.74, 1)))
      : Math.max(1, Math.round(layout.chamberSize * clamp(scale, 0.9, 1.08)))
  const biasClampRatio = params.maxTopBiasRatio ?? 0.024
  const requestedTopBias =
    fit === 'cover'
      ? Math.round(clamp(params.topBiasPx ?? 0, 0, layout.chamberSize * biasClampRatio))
      : 0
  const totalUpwardShift = (fit === 'cover' ? requestedTopBias : 0) + opticalLiftPx
  if (fit === 'cover' && totalUpwardShift > 0) {
    const minOverscanForShift = totalUpwardShift * 2 + 2
    const minArtSize = layout.chamberSize + minOverscanForShift
    if (artSize < minArtSize) {
      artSize = minArtSize
    }
  }

  const artX = Math.round(layout.chamberX + (layout.chamberSize - artSize) / 2)
  const maxSafeBias =
    fit === 'cover' ? Math.max(0, Math.floor((artSize - layout.chamberSize - 2) / 2)) : 0
  const topBias =
    fit === 'cover'
      ? Math.round(clamp(requestedTopBias, 0, maxSafeBias))
      : 0
  let artY = Math.round(layout.chamberY + (layout.chamberSize - artSize) / 2) - topBias - opticalLiftPx
  if (fit === 'cover') {
    const chamberBottom = layout.chamberY + layout.chamberSize
    const artBottom = artY + artSize
    if (artBottom < chamberBottom) {
      artY += chamberBottom - artBottom
    }
  }

  const placed = await sharp(sourceImage)
    .resize(artSize, artSize, {
      fit,
      position: params.cropPosition ?? 'centre',
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

async function renderPlacedSourceCanvasWithOffset(params: {
  sourceImage: Buffer
  layout: PremiumLayout
  scale: number
  fit: ArtworkFitMode
  topBiasPx?: number
  sourceClass?: SourceClass
  offsetXpx?: number
  offsetYpx?: number
}): Promise<Buffer> {
  const baseCanvas = await renderPlacedSourceCanvas({
    sourceImage: params.sourceImage,
    layout: params.layout,
    scale: params.scale,
    fit: params.fit,
    topBiasPx: params.topBiasPx,
    sourceClass: params.sourceClass,
  })
  const offsetX = Math.round(params.offsetXpx ?? 0)
  const offsetY = Math.round(params.offsetYpx ?? 0)
  if (offsetX === 0 && offsetY === 0) {
    return baseCanvas
  }

  const pad = Math.max(2, Math.abs(offsetX), Math.abs(offsetY)) + 2
  const expandedSize = params.layout.size + pad * 2
  const shifted = await sharp({
    create: {
      width: expandedSize,
      height: expandedSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: baseCanvas, left: pad + offsetX, top: pad + offsetY }])
    .png()
    .toBuffer()

  return sharp(shifted)
    .extract({
      left: pad,
      top: pad,
      width: params.layout.size,
      height: params.layout.size,
    })
    .png()
    .toBuffer()
}

async function createUnderlayRecedeLayer(layout: PremiumLayout): Promise<Buffer> {
  const svg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="underlayVignette" cx="50%" cy="50%" r="66%">
      <stop offset="58%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.2)"/>
    </radialGradient>
    <linearGradient id="underlayBottomScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.08)"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#underlayVignette)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#underlayBottomScrim)"
  />
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createRearStackMask(layout: PremiumLayout): Promise<Buffer> {
  const radius = Math.max(1, layout.chamberRadius - Math.max(1, Math.round(layout.chamberSize * 0.012)))
  const svg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${radius}"
    fill="white"
  />
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function renderStackedArtworkUnderlay(params: {
  size: number
  layout: PremiumLayout
  sourceImage: Buffer
  scale: number
  fit: ArtworkFitMode
  sourceClass: SourceClass
  hasTransparency: boolean
  topBiasPx?: number
}): Promise<StackedArtworkUnderlay> {
  const { layout } = params
  const stackConfig = getStackConfigForSourceClass({
    sourceClass: params.sourceClass,
    hasTransparency: params.hasTransparency,
  })
  if (!stackConfig.enabled || stackConfig.layers.length === 0) {
    return { rearLayerB: null, rearLayerA: null }
  }

  const chamberMask = await createRearStackMask(layout)
  const recedeLayer = await createUnderlayRecedeLayer(layout)
  const renderedLayers: Buffer[] = []
  for (const layer of stackConfig.layers) {
    const offsetXpx = Math.round(layout.chamberSize * layer.offsetXRatio)
    const offsetYpx = Math.round(layout.chamberSize * layer.offsetYRatio)
    const layerScale =
      params.fit === 'contain'
        ? clamp(params.scale * layer.scaleMultiplier, 0.74, 1)
        : clamp(params.scale * layer.scaleMultiplier, 0.92, 1.1)
    const layerTopBiasPx =
      params.fit === 'cover'
        ? Math.round((params.topBiasPx ?? 0) * layer.topBiasMultiplier)
        : 0

    const shifted = await renderPlacedSourceCanvasWithOffset({
      sourceImage: params.sourceImage,
      layout,
      scale: layerScale,
      fit: params.fit,
      topBiasPx: layerTopBiasPx,
      sourceClass: params.sourceClass,
      offsetXpx,
      offsetYpx,
    })
    const clipped = await sharp(shifted)
      .ensureAlpha()
      .composite([{ input: chamberMask, blend: 'dest-in' }])
      .png()
      .toBuffer()

    let processed = await sharp(clipped)
      .modulate({
        brightness: layer.brightness,
        saturation: layer.saturation,
      })
      .linear(0.999, 0)
      .png()
      .toBuffer()
    if (layer.blurPx > 0.12 && params.sourceClass !== 'pixelArt') {
      processed = await sharp(processed)
        .blur(layer.blurPx)
        .png()
        .toBuffer()
    }
    processed = await sharp(processed)
      .composite([{ input: await applyOpacity(recedeLayer, 0.36), blend: 'multiply' }])
      .png()
      .toBuffer()
    renderedLayers.push(await applyOpacity(processed, layer.opacity))
  }

  if (renderedLayers.length === 1) {
    return { rearLayerB: null, rearLayerA: renderedLayers[0] ?? null }
  }
  return {
    rearLayerB: renderedLayers[0] ?? null,
    rearLayerA: renderedLayers[1] ?? null,
  }
}

async function renderHeroContactShadow(params: {
  heroArtwork: Buffer
  layout: PremiumLayout
  sourceClass: SourceClass
}): Promise<Buffer | null> {
  if (params.sourceClass === 'brightBadge') return null

  const { layout } = params
  const shadowOpacity =
    params.sourceClass === 'pixelArt'
      ? 0.11
      : params.sourceClass === 'portraitPhoto'
        ? 0.165
        : params.sourceClass === 'illustration'
          ? 0.18
          : 0.15

  const focusSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="contactFocus" cx="50%" cy="63%" r="44%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="70%" stop-color="white" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="contactBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="46%" stop-color="white" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="white" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#contactFocus)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#contactBottom)"
  />
</svg>`
  const focusMask = await sharp(Buffer.from(focusSvg)).png().toBuffer()

  const silhouette = await sharp(params.heroArtwork)
    .ensureAlpha()
    .modulate({ brightness: 0, saturation: 0 })
    .png()
    .toBuffer()

  const focusedShadow = await sharp(silhouette)
    .ensureAlpha()
    .composite([{ input: focusMask, blend: 'dest-in' }])
    .blur(Math.max(0.56, layout.size * 0.0011))
    .png()
    .toBuffer()

  const dropY = Math.max(1, Math.round(layout.chamberSize * 0.01))
  const shifted = await createTransparentCanvas(layout.size)
    .composite([{ input: focusedShadow, left: 0, top: dropY }])
    .png()
    .toBuffer()

  return applyOpacity(shifted, shadowOpacity)
}

async function createPortraitSubjectMask(params: {
  clippedArtwork: Buffer
  layout: PremiumLayout
}): Promise<Buffer | null> {
  const { clippedArtwork, layout } = params
  const { data, info } = await sharp(clippedArtwork)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const x0 = layout.chamberX
  const y0 = layout.chamberY
  const x1 = Math.min(width, x0 + layout.chamberSize)
  const y1 = Math.min(height, y0 + layout.chamberSize)
  const chamberWidth = Math.max(1, x1 - x0)
  const chamberHeight = Math.max(1, y1 - y0)
  const chamberArea = chamberWidth * chamberHeight
  const edgeInset = Math.max(2, Math.round(layout.chamberSize * 0.14))
  const cx = x0 + chamberWidth * 0.5
  const cy = y0 + chamberHeight * 0.5
  const rx = Math.max(1, chamberWidth * 0.5)
  const ry = Math.max(1, chamberHeight * 0.58)
  const upperLimitY = y0 + Math.round(chamberHeight * 0.9)

  let bgLumaSum = 0
  let bgLumaCount = 0
  let alphaPartialCount = 0
  let alphaCount = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const a = data[idx + 3] ?? 255
      alphaCount += 1
      if (a < 250) alphaPartialCount += 1

      const isEdgeBand =
        x < x0 + edgeInset ||
        x >= x1 - edgeInset ||
        y < y0 + edgeInset ||
        y >= y1 - edgeInset
      if (isEdgeBand && a > 24) {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        bgLumaSum += luma
        bgLumaCount += 1
      }
    }
  }
  const hasMeaningfulTransparency = alphaCount > 0 && alphaPartialCount / alphaCount > 0.004
  const bgLuma = bgLumaCount > 0 ? bgLumaSum / bgLumaCount : 110

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
  const topBandY = y0 + Math.floor(chamberHeight * 0.6)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0
      const a = data[idx + 3] ?? 255
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const radial = nx * nx + ny * ny
      const centerAffinity = clamp(1 - radial, 0, 1)
      const upperZone = y <= upperLimitY
      let present = false

      if (hasMeaningfulTransparency) {
        present = a > 34 && centerAffinity > 0.05 && upperZone
      } else if (a > 18) {
        const rx1 = Math.min(width - 1, x + 1)
        const dy1 = Math.min(height - 1, y + 1)
        const rightIdx = (y * width + rx1) * info.channels
        const downIdx = (dy1 * width + x) * info.channels
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
        const notWashed = luma < 240
        present =
          centerAffinity > 0.06 &&
          upperZone &&
          notWashed &&
          ((detail > 20 && contrastToBg > 8) || (contrastToBg > 22 && chroma > 8))
      }

      if (present) {
        mask[y * width + x] = 255
        presentCount += 1
        sumPresentX += x
        sumPresentY += y
        presentLumaSum += luma
        if (y <= topBandY) presentTopCount += 1
        if (x < presentMinX) presentMinX = x
        if (x > presentMaxX) presentMaxX = x
        if (y < presentMinY) presentMinY = y
        if (y > presentMaxY) presentMaxY = y
      }
    }
  }

  if (presentCount <= 0) return null

  const coverage = presentCount / chamberArea
  const bboxWidth = Math.max(1, presentMaxX - presentMinX + 1)
  const bboxHeight = Math.max(1, presentMaxY - presentMinY + 1)
  const widthRatio = bboxWidth / chamberWidth
  const heightRatio = bboxHeight / chamberHeight
  const centroidX = sumPresentX / presentCount
  const centroidY = sumPresentY / presentCount
  const centroidXNorm = (centroidX - x0) / chamberWidth
  const centroidYNorm = (centroidY - y0) / chamberHeight
  const topWeightedRatio = presentTopCount / presentCount
  const meanPresentLuma = presentLumaSum / presentCount
  const flatnessRatio = widthRatio / Math.max(0.001, heightRatio)
  if (
    coverage < 0.09 ||
    coverage > 0.62 ||
    widthRatio > 0.86 ||
    heightRatio < 0.22 ||
    heightRatio > 0.95 ||
    centroidXNorm < 0.22 ||
    centroidXNorm > 0.78 ||
    centroidYNorm > 0.72 ||
    topWeightedRatio < 0.32 ||
    flatnessRatio > 2.9 ||
    meanPresentLuma > 225
  ) {
    return null
  }

  return sharp(mask, { raw: { width, height, channels: 1 } })
    .threshold(10)
    .dilate(1)
    .blur(1.08)
    .png()
    .toBuffer()
}

async function applyPortraitSubjectEnhancement(params: {
  artwork: Buffer
  subjectMask: Buffer
  layout: PremiumLayout
}): Promise<Buffer> {
  const { artwork, subjectMask, layout } = params
  const subjectLift = await sharp(artwork)
    .modulate({
      brightness: 1.032,
      saturation: 1.03,
    })
    .linear(1.022, -1)
    .png()
    .toBuffer()
  const backgroundTone = await sharp(artwork)
    .modulate({
      brightness: 0.958,
      saturation: 0.95,
    })
    .linear(0.996, -1)
    .png()
    .toBuffer()
  const subjectOnly = await sharp(subjectLift)
    .ensureAlpha()
    .composite([{ input: subjectMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const backgroundOnly = await sharp(backgroundTone)
    .ensureAlpha()
    .composite([{ input: subjectMask, blend: 'dest-out' }])
    .png()
    .toBuffer()
  const merged = await sharp(backgroundOnly)
    .composite([{ input: subjectOnly, blend: 'over' }])
    .png()
    .toBuffer()

  const heroLightSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="heroLight" cx="42%" cy="27%" r="54%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.065)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#heroLight)"
  />
</svg>`
  const heroLight = await sharp(Buffer.from(heroLightSvg)).png().toBuffer()
  const heroLightSubject = await sharp(heroLight)
    .ensureAlpha()
    .composite([{ input: subjectMask, blend: 'dest-in' }])
    .blur(Math.max(0.8, layout.size * 0.0019))
    .png()
    .toBuffer()

  return sharp(merged)
    .composite([{ input: await applyOpacity(heroLightSubject, 0.5), blend: 'screen' }])
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
  sourceClass?: SourceClass
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
    sourceClass: params.sourceClass,
  })

  const chamberMask = await createChamberMask(layout)

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

  const isPortraitHero = params.sourceClass === 'portraitPhoto'
  let integratedArtwork = toned
  if (isPortraitHero) {
    const portraitMask = await createPortraitSubjectMask({
      clippedArtwork: clipped,
      layout,
    })
    if (portraitMask) {
      integratedArtwork = await applyPortraitSubjectEnhancement({
        artwork: toned,
        subjectMask: portraitMask,
        layout,
      })
    }
  }

  const vignetteOuterOpacity = isBrightTone ? 0.50 : isPortraitHero ? 0.40 : 0.32
  const bottomScrimOpacity = isBrightTone ? 0.42 : isPortraitHero ? 0.30 : 0.22
  const topScrimOpacity = isBrightTone ? 0.02 : 0
  const edgeContactOpacity = isBrightTone ? 0.32 : isPortraitHero ? 0.28 : 0.22
  const vignetteSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="artVignette" cx="50%" cy="50%" r="64%">
      <stop offset="62%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${vignetteOuterOpacity})"/>
    </radialGradient>
    <linearGradient id="bottomScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,${bottomScrimOpacity})"/>
    </linearGradient>
    <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,${topScrimOpacity})"/>
      <stop offset="14%" stop-color="rgba(0,0,0,0)"/>
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
  // Narrower top-edge lift so it doesn't create a thick bright border at the top
  const topEdgeLiftOpacity = isBrightTone ? 0.028 : isPortraitHero ? 0.058 : 0.048
  const topEdgeLiftSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topEdgeLift" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,${topEdgeLiftOpacity})"/>
      <stop offset="18%" stop-color="rgba(255,255,255,0)"/>
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
  const seated = await sharp(integratedArtwork)
    .composite([{ input: vignette, blend: 'multiply' }])
    .png()
    .toBuffer()

  const framedHero = await sharp(seated)
    .composite([{ input: topEdgeLift, blend: 'screen' }])
    .png()
    .toBuffer()

  const shouldRevealRearLayers =
    params.sourceClass === 'portraitPhoto' ||
    params.sourceClass === 'illustration' ||
    params.sourceClass === 'generic'
  if (!shouldRevealRearLayers) {
    return framedHero
  }

  const rearRevealMaskSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="rearReveal" cx="50%" cy="50%" r="66%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="74%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0.84"/>
    </radialGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#rearReveal)"
  />
</svg>`
  const rearRevealMask = await sharp(Buffer.from(rearRevealMaskSvg)).png().toBuffer()
  return sharp(framedHero)
    .ensureAlpha()
    .composite([{ input: rearRevealMask, blend: 'dest-in' }])
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
  const radius = Math.max(1, Math.round(layout.breakoutWidth * 0.30))
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fadeY" x1="0" y1="${top}" x2="0" y2="${bottom}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="32%" stop-color="white" stop-opacity="1"/>
      <stop offset="65%" stop-color="white" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeX" x1="${layout.breakoutX}" y1="0" x2="${layout.breakoutX + layout.breakoutWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="18%" stop-color="white" stop-opacity="1"/>
      <stop offset="82%" stop-color="white" stop-opacity="1"/>
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
    .blur(0.6)
    .png()
    .toBuffer()
}

async function createTopBreakoutSubjectMask(params: {
  sourceCanvas: Buffer
  layout: PremiumLayout
  sourceClass?: SourceClass
}): Promise<Buffer> {
  const { sourceCanvas, layout } = params
  const isIllustration = params.sourceClass === 'illustration'
  const { data, info } = await sharp(sourceCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const padXMul = isIllustration ? 0.28 : 0.14
  const padYMul = isIllustration ? 0.42 : 0.26
  const yExtendMul = isIllustration ? 1.8 : 1.45
  const regionPadX = Math.max(1, Math.round(layout.breakoutWidth * padXMul))
  const regionPadY = Math.max(1, Math.round(layout.breakoutHeight * padYMul))
  const x0 = Math.max(0, layout.breakoutX - regionPadX)
  const x1 = Math.min(width, layout.breakoutX + layout.breakoutWidth + regionPadX)
  const y0 = Math.max(0, layout.breakoutY - regionPadY)
  const y1 = Math.min(height, layout.breakoutY + Math.round(layout.breakoutHeight * yExtendMul))

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
        const detailThresh = isIllustration ? 10 : 16
        const contrastThresh = isIllustration ? 4 : 6
        present = (
          (detail > detailThresh && contrastToBg > contrastThresh && notWashed) ||
          (contrastToBg > 22 && chroma > 8 && notWashed)
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

  const maxPresentRatio = isIllustration ? 0.92 : 0.38
  const minPresentRatio = isIllustration ? 0.005 : 0.018
  const maxWidthRatio = isIllustration ? 1.01 : 0.62
  const maxHeightRatio = isIllustration ? 1.01 : 0.82
  const maxFlatnessRatio = isIllustration ? 5.5 : 2.8
  const maxCentroidYNorm = isIllustration ? 0.82 : 0.58
  const minTopWeightedRatio = isIllustration ? 0.12 : 0.36
  const maxPresentMeanLuma = isIllustration ? 235 : 220
  if (
    presentRatio < minPresentRatio ||
    presentRatio > maxPresentRatio ||
    widthRatio > maxWidthRatio ||
    heightRatio > maxHeightRatio ||
    heightRatio < 0.11 ||
    topWeightedRatio < minTopWeightedRatio ||
    centroidNorm < 0.2 ||
    centroidNorm > 0.8 ||
    centroidYNorm > maxCentroidYNorm ||
    flatnessRatio > maxFlatnessRatio ||
    presentMeanLuma > maxPresentMeanLuma
  ) {
    return createTransparentCanvas(layout.size).png().toBuffer()
  }

  const { data: processed, info: maskInfo } = await sharp(mask, { raw: { width, height, channels: 1 } })
    .threshold(18)
    .blur(0.7)
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pxCount = maskInfo.width * maskInfo.height
  const rgba = Buffer.alloc(pxCount * 4, 255)
  for (let i = 0; i < pxCount; i++) {
    rgba[i * 4 + 3] = processed[i] ?? 0
  }
  return sharp(rgba, { raw: { width: maskInfo.width, height: maskInfo.height, channels: 4 } })
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
  sourceClass?: SourceClass
}): Promise<Buffer> {
  const { size, layout } = params
  if (!params.sourceImage || params.sourceImage.length === 0) {
    return createTransparentCanvas(size).png().toBuffer()
  }

  const normalized = await normalizeSourceImage(params.sourceImage)
  const isIllustrationBreakout = params.sourceClass === 'illustration'
  const breakoutScale = isIllustrationBreakout
    ? Math.max(params.scale ?? 1.04, 1.07)
    : params.scale ?? 1.04
  const sourceCanvas = await renderPlacedSourceCanvas({
    sourceImage: normalized,
    layout,
    scale: breakoutScale,
    fit: 'cover',
    topBiasPx: params.topBiasPx,
    sourceClass: params.sourceClass,
    maxTopBiasRatio: isIllustrationBreakout ? 0.06 : undefined,
    cropPosition: isIllustrationBreakout ? 'top' : undefined,
  })
  const breakoutMask = await createTopBreakoutMask({ size, layout })
  const subjectMask = await createTopBreakoutSubjectMask({
    sourceCanvas,
    layout,
    sourceClass: params.sourceClass,
  })

  const masked = await sharp(sourceCanvas)
    .ensureAlpha()
    .composite([
      { input: breakoutMask, blend: 'dest-in' },
      { input: subjectMask, blend: 'dest-in' },
    ])
    .blur(0.5)
    .png()
    .toBuffer()

  return applyOpacity(masked, params.opacity ?? 0.22)
}

async function renderCreatorSignature(params: {
  size: number
  layout: PremiumLayout
  symbol: string
}): Promise<Buffer> {
  const { size, layout, symbol } = params
  const MAX_CHARS = 12
  const displayName = symbol.slice(0, MAX_CHARS).toUpperCase()

  const baseFont = Math.round(size * 0.011)
  const fontSize = Math.max(
    7,
    displayName.length > 9
      ? Math.round(baseFont * (9 / displayName.length))
      : baseFont,
  )

  const squareSize = Math.round(size * 0.0085)
  const gap = Math.round(size * 0.005)

  const letterSpacingEm = 0.06
  const textWidth = Math.ceil(displayName.length * fontSize * 0.70 + displayName.length * fontSize * letterSpacingEm)
  const lockupWidth = squareSize + gap + textWidth

  const hInset = Math.round(layout.frameStroke * 0.55 + layout.chamberSize * 0.012)
  const lockupRightEdge = layout.chamberX + layout.chamberSize - hInset
  const squareX = lockupRightEdge - lockupWidth

  const textX = squareX + squareSize + gap

  const bottomBandCenterY = layout.chamberY + layout.chamberSize + Math.round(layout.frameStroke * 0.5)
  const squareY = Math.round(bottomBandCenterY - squareSize / 2)

  const squareRx = Math.max(1, Math.round(squareSize * 0.15))
  const letterSpacingPx = Math.round(fontSize * letterSpacingEm)

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${squareX}" y="${squareY}" width="${squareSize}" height="${squareSize}" rx="${squareRx}" fill="#0052FF"/>
  <text x="${textX}" y="${bottomBandCenterY}"
    dominant-baseline="central"
    text-anchor="start"
    font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    fill="#000000"
    letter-spacing="${letterSpacingPx}">${displayName}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
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
  let stackedUnderlay: StackedArtworkUnderlay = { rearLayerB: null, rearLayerA: null }
  let breakoutLayer: Buffer | null = null
  let sourceClassForHero: SourceClass = 'generic'

  if (params.sourceImage && params.sourceImage.length > 0) {
    try {
      const normalized = await normalizeSourceImage(params.sourceImage)
      const analysis = await analyzeSourceImage({
        sourceImage: normalized,
        size,
      })
      sourceClassForHero = analysis.sourceClass
      const topBiasPx =
        analysis.fitMode === 'cover' && analysis.sourceClass === 'portraitPhoto'
          ? Math.max(1, Math.round(layout.chamberSize * (analysis.allowBreakout ? 0.022 : 0.018)))
          : analysis.fitMode === 'cover' && analysis.allowBreakout && analysis.sourceClass === 'illustration'
            ? Math.max(1, Math.round(layout.chamberSize * 0.009))
            : 0
      stackedUnderlay = await renderStackedArtworkUnderlay({
        size,
        layout,
        sourceImage: normalized,
        scale: analysis.preferredScale,
        fit: analysis.fitMode,
        sourceClass: analysis.sourceClass,
        hasTransparency: analysis.hasTransparency,
        topBiasPx,
      })
      artworkLayer = await renderArtworkLayer({
        size,
        layout,
        sourceImage: new Uint8Array(normalized),
        scale: analysis.preferredScale,
        fit: analysis.fitMode,
        tone: analysis.artworkTone,
        sourceClass: analysis.sourceClass,
        topBiasPx,
        symbol: params.symbol,
      })

      if (analysis.allowBreakout) {
        const breakoutOpacity = analysis.sourceClass === 'illustration' ? 0.62 : 0.22
        const breakoutTopBiasPx = analysis.sourceClass === 'illustration'
          ? Math.max(1, Math.round(layout.chamberSize * 0.05))
          : topBiasPx
        breakoutLayer = await renderBreakoutLayer({
          size,
          layout,
          sourceImage: new Uint8Array(normalized),
          opacity: breakoutOpacity,
          scale: analysis.preferredScale,
          topBiasPx: breakoutTopBiasPx,
          sourceClass: analysis.sourceClass,
        })
      }
    } catch (error) {
      console.warn('[token/image] premium renderer source decode failed; using symbol fallback:', error)
      artworkLayer = await renderArtworkLayer({
        size,
        layout,
        symbol: params.symbol,
      })
      stackedUnderlay = { rearLayerB: null, rearLayerA: null }
      breakoutLayer = null
      sourceClassForHero = 'generic'
    }
  } else {
    artworkLayer = await renderArtworkLayer({
      size,
      layout,
      symbol: params.symbol,
    })
    stackedUnderlay = { rearLayerB: null, rearLayerA: null }
    sourceClassForHero = 'generic'
  }

  const heroContactShadow = await renderHeroContactShadow({
    heroArtwork: artworkLayer,
    layout,
    sourceClass: sourceClassForHero,
  })
  const heroCompositeLayer = heroContactShadow
    ? await createTransparentCanvas(size)
        .composite([
          { input: heroContactShadow, blend: 'multiply' },
          { input: artworkLayer, blend: 'over' },
        ])
        .png()
        .toBuffer()
    : artworkLayer

  const overlays: sharp.OverlayOptions[] = [
    buildCompositeStep(outerGlow, 'screen'),
    buildCompositeStep(frameBloom, 'screen'),
  ]
  if (stackedUnderlay.rearLayerB) {
    overlays.push(buildCompositeStep(stackedUnderlay.rearLayerB, 'over'))
  }
  if (stackedUnderlay.rearLayerA) {
    overlays.push(buildCompositeStep(stackedUnderlay.rearLayerA, 'over'))
  }
  overlays.push(
    buildCompositeStep(heroCompositeLayer, 'over'),
    buildCompositeStep(premiumFrame, 'over'),
  )

  if (breakoutLayer) {
    overlays.push(buildCompositeStep(breakoutLayer, 'over'))
  }

  if (params.symbol) {
    const signature = await renderCreatorSignature({ size, layout, symbol: params.symbol })
    overlays.push(buildCompositeStep(signature, 'over'))
  }

  return sharp(backgroundCard)
    .composite(overlays)
    .flatten({ background: '#000000' })
    .png()
    .toBuffer()
}

