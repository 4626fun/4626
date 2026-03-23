import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { generateSegmentationMask, type SegmentationModel } from './_segmentation.js'

type BlendMode = NonNullable<sharp.OverlayOptions['blend']>
type ArtworkFitMode = 'cover' | 'contain'
type SourceClass = 'brightBadge' | 'portraitPhoto' | 'illustration' | 'pixelArt' | 'generic'
type RenderPreset = 'standard' | 'hero' | 'pixel'

export type PremiumTokenIconParams = {
  size: number
  sourceImage?: Uint8Array
  heroCutoutSourceImage?: Uint8Array
  suppressBreakout?: boolean
  symbol?: string
  renderPreset?: RenderPreset
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

type BreakoutSourceKind = 'heroCutout' | 'sourceAlpha' | 'none'
type BreakoutPlanMode = 'heroCutout' | 'sourceAlpha' | 'rembgCutout' | 'none'

type BreakoutPlan = {
  mode: BreakoutPlanMode
  breakoutRequested: boolean
  rembgCandidate: boolean
  reason:
    | 'suppressed'
    | 'fit-not-cover'
    | 'bright-badge-like'
    | 'hero-cutout'
    | 'source-alpha'
    | 'rembg-candidate'
    | 'rembg-unavailable'
    | 'rembg-not-candidate'
}

type SegmentationExtraction = {
  model: SegmentationModel
  executable: string
  maskPngRgba: Buffer
  cutoutPng: Buffer
}

type SegmentationAlignmentResult = {
  topBiasPx: number
  deltaPx: number
  targetTopY: number
  maskTopY: number | null
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

const BREAKOUT_DEBUG_LOG_ENABLED =
  process.env.TOKEN_BREAKOUT_DEBUG === '1' ||
  Boolean(process.env.TOKEN_BREAKOUT_DEBUG_DIR)
const BREAKOUT_RUNTIME_LOG_ENABLED =
  BREAKOUT_DEBUG_LOG_ENABLED ||
  process.env.TOKEN_PREMIUM_BREAKOUT_LOG === '1'
const ALLOW_PREMIUM_FALLBACK_BAND =
  process.env.TOKEN_PREMIUM_BREAKOUT_FALLBACK_BAND === '1'
const PREMIUM_SEGMENTATION_ENABLED = process.env.TOKEN_PREMIUM_SEGMENTATION !== '0'
const BREAKOUT_DEBUG_DIR = process.env.TOKEN_BREAKOUT_DEBUG_DIR
const execFileP = promisify(execFile)

const SEGMENTATION_MODELS: readonly SegmentationModel[] = [
  'bria-rmbg',
  'birefnet-general',
  'birefnet-portrait',
  'isnet-general-use',
  'isnet-anime',
  'u2net',
  'u2netp',
  'u2net_human_seg',
  'sam',
] as const

const PREMIUM_ALIGN_TARGET_TOP_RATIO =
  clamp(Number(process.env.TOKEN_PREMIUM_ALIGN_TARGET_TOP_RATIO ?? 0.04), 0, 0.4)
const PREMIUM_ALIGN_MAX_BIAS_RATIO =
  clamp(Number(process.env.TOKEN_PREMIUM_ALIGN_MAX_BIAS_RATIO ?? 0.09), 0, 0.32)
const PREMIUM_BREAKOUT_MASK_MIN_COVERAGE =
  clamp(Number(process.env.TOKEN_PREMIUM_BREAKOUT_MASK_MIN_COVERAGE ?? 0.004), 0, 0.35)
const PREMIUM_BREAKOUT_MASK_MAX_COVERAGE =
  clamp(Number(process.env.TOKEN_PREMIUM_BREAKOUT_MASK_MAX_COVERAGE ?? 0.58), PREMIUM_BREAKOUT_MASK_MIN_COVERAGE, 1)

function isSegmentationBreakoutCoverageAcceptable(coverage: number): boolean {
  if (!Number.isFinite(coverage)) return false
  return coverage >= PREMIUM_BREAKOUT_MASK_MIN_COVERAGE && coverage <= PREMIUM_BREAKOUT_MASK_MAX_COVERAGE
}

function resolveSegmentationModel(
  rawValue: string | undefined,
  fallback: SegmentationModel,
): SegmentationModel {
  const value = rawValue?.trim()
  if (!value) return fallback
  if (SEGMENTATION_MODELS.includes(value as SegmentationModel)) {
    return value as SegmentationModel
  }
  return fallback
}

const PREMIUM_SEGMENTATION_MODEL_PHOTO = resolveSegmentationModel(
  process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_PHOTO,
  'bria-rmbg',
)
const PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION = resolveSegmentationModel(
  process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION,
  'isnet-general-use',
)
const PREMIUM_SEGMENTATION_MODEL_PIXEL = resolveSegmentationModel(
  process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_PIXEL,
  'u2netp',
)

async function writeBreakoutDebugAsset(filename: string, layer: Buffer): Promise<void> {
  if (!BREAKOUT_DEBUG_DIR) return
  try {
    await fs.mkdir(BREAKOUT_DEBUG_DIR, { recursive: true })
    await fs.writeFile(path.join(BREAKOUT_DEBUG_DIR, filename), layer)
  } catch (error) {
    console.warn('[token/image] breakout debug write failed:', error)
  }
}

function getAlphaBounds(raw: Buffer, width: number, height: number, channels: number): {
  nonZeroPixels: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} | null {
  let nonZeroPixels = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels
      const alpha = channels >= 4 ? raw[idx + 3] ?? 0 : raw[idx] ?? 0
      if (alpha <= 2) continue
      nonZeroPixels += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (nonZeroPixels === 0 || maxX < minX || maxY < minY) return null
  return {
    nonZeroPixels,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

async function debugLogLayerBounds(label: string, layer: Buffer): Promise<void> {
  if (!BREAKOUT_DEBUG_LOG_ENABLED) return
  const { data, info } = await sharp(layer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bounds = getAlphaBounds(data, info.width, info.height, info.channels)
  console.info('[breakout-debug]', JSON.stringify({
    label,
    width: info.width,
    height: info.height,
    channels: info.channels,
    bounds,
  }))
}

async function hasVisibleAlpha(layer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(layer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return getAlphaBounds(data, info.width, info.height, info.channels) !== null
}

function resolveSegmentationModelForSourceClass(sourceClass: SourceClass): SegmentationModel {
  switch (sourceClass) {
    case 'portraitPhoto':
      return PREMIUM_SEGMENTATION_MODEL_PHOTO
    case 'pixelArt':
      return PREMIUM_SEGMENTATION_MODEL_PIXEL
    case 'illustration':
    case 'generic':
    case 'brightBadge':
    default:
      return PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION
  }
}

async function extractForegroundRembg(params: {
  pngBytes: Buffer
  sourceClass: SourceClass
}): Promise<SegmentationExtraction | null> {
  if (!PREMIUM_BREAKOUT_REMBG.enabled) return null
  if (PREMIUM_BREAKOUT_REMBG.binCandidates.length === 0) return null

  const model = resolveSegmentationModelForSourceClass(params.sourceClass)
  const segmentation = await generateSegmentationMask(params.pngBytes, {
    model,
    alphaMatting: params.sourceClass === 'portraitPhoto',
    maskOnly: false,
    timeoutMs: PREMIUM_BREAKOUT_REMBG.timeoutMs,
    binCandidates: PREMIUM_BREAKOUT_REMBG.binCandidates,
  })
  if (!segmentation?.cutoutPng || segmentation.cutoutPng.length === 0) {
    if (BREAKOUT_DEBUG_LOG_ENABLED) {
      console.warn('[token/image] premium rembg extraction failed: missing cutout output')
    }
    return null
  }
  return {
    model: segmentation.model,
    executable: segmentation.executable,
    maskPngRgba: segmentation.maskPngRgba,
    cutoutPng: segmentation.cutoutPng,
  }
}

const BACKGROUND_COLORS = {
  center: '#000000',
  mid: '#000001',
  edge: '#000000',
} as const

const OUTER_GLOW_COLOR = '#2F7DFF'
const FRAME_GRADIENT = {
  topLeft: '#F8FBFF',
  middle: '#D8E5FF',
  bottomRight: '#2F7DFF',
} as const

const FRAME_ACCENT = {
  midAccent: '#93B6FF',
  deepAccent: '#5C91FF',
} as const

const PREMIUM_BREAKOUT_REMBG = {
  enabled: process.env.TOKEN_PREMIUM_REMBG !== '0',
  timeoutMs: Number(process.env.TOKEN_PREMIUM_REMBG_TIMEOUT_MS ?? 30_000),
  binCandidates: [
    process.env.REMBG_BIN,
    '/tmp/rembg-env/bin/rembg',
    '/usr/local/bin/rembg',
    '/usr/bin/rembg',
    'rembg',
  ].filter((bin): bin is string => typeof bin === 'string' && bin.trim().length > 0),
} as const

type RembgProbeResult = {
  enabled: boolean
  available: boolean
  executable: string | null
  checkedCandidates: string[]
  reason?: string
}

let rembgProbePromise: Promise<RembgProbeResult> | null = null
let breakoutRuntimeBannerPromise: Promise<void> | null = null
let rembgFailureWarned = false

async function probeRembgRuntime(): Promise<RembgProbeResult> {
  if (rembgProbePromise) return rembgProbePromise
  rembgProbePromise = (async () => {
    if (!PREMIUM_BREAKOUT_REMBG.enabled) {
      return {
        enabled: false,
        available: false,
        executable: null,
        checkedCandidates: [],
        reason: 'disabled',
      }
    }
    for (const bin of PREMIUM_BREAKOUT_REMBG.binCandidates) {
      try {
        await execFileP(bin, ['--help'], { timeout: 2_000 })
        return {
          enabled: true,
          available: true,
          executable: bin,
          checkedCandidates: PREMIUM_BREAKOUT_REMBG.binCandidates,
        }
      } catch (error) {
        const code =
          typeof error === 'object' &&
          error !== null &&
          'code' in error
            ? String((error as { code?: unknown }).code ?? '')
            : ''
        if (code === 'ENOENT') continue
        return {
          enabled: true,
          available: true,
          executable: bin,
          checkedCandidates: PREMIUM_BREAKOUT_REMBG.binCandidates,
          reason: code ? `probe_error:${code}` : 'probe_error',
        }
      }
    }
    return {
      enabled: true,
      available: false,
      executable: null,
      checkedCandidates: PREMIUM_BREAKOUT_REMBG.binCandidates,
      reason: 'not_found',
    }
  })()
  return rembgProbePromise
}

async function logBreakoutRuntimeBannerOnce(): Promise<void> {
  if (!BREAKOUT_RUNTIME_LOG_ENABLED) return
  if (breakoutRuntimeBannerPromise) return breakoutRuntimeBannerPromise
  breakoutRuntimeBannerPromise = (async () => {
    const rembg = await probeRembgRuntime()
    console.info('[token/image] premium breakout runtime', JSON.stringify({
      rembgEnabled: rembg.enabled,
      rembgAvailable: rembg.available,
      rembgExecutable: rembg.executable,
      rembgReason: rembg.reason ?? null,
      rembgCandidates: rembg.checkedCandidates,
      segmentationEnabled: PREMIUM_SEGMENTATION_ENABLED,
      segmentationModels: {
        photo: PREMIUM_SEGMENTATION_MODEL_PHOTO,
        illustration: PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION,
        pixel: PREMIUM_SEGMENTATION_MODEL_PIXEL,
      },
      breakoutCoverageMinThreshold: PREMIUM_BREAKOUT_MASK_MIN_COVERAGE,
      breakoutCoverageMaxThreshold: PREMIUM_BREAKOUT_MASK_MAX_COVERAGE,
      alignTargetTopRatio: PREMIUM_ALIGN_TARGET_TOP_RATIO,
      alignMaxBiasRatio: PREMIUM_ALIGN_MAX_BIAS_RATIO,
      fallbackBandEnabled: ALLOW_PREMIUM_FALLBACK_BAND,
      runtimeLogEnabled: BREAKOUT_RUNTIME_LOG_ENABLED,
      debugAssetDumpEnabled: Boolean(BREAKOUT_DEBUG_DIR),
    }))
  })()
  return breakoutRuntimeBannerPromise
}

const CHAMBER_GRADIENT = {
  top: '#08101F',
  bottom: '#02050B',
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

function resolveRenderPreset(userPreset: RenderPreset | undefined, sourceClass: SourceClass | undefined): RenderPreset {
  if (userPreset) return userPreset
  if (sourceClass === 'pixelArt') return 'pixel'
  if (sourceClass === 'illustration' || sourceClass === 'portraitPhoto') return 'hero'
  return 'standard'
}

function getTokenIconLayout(size: number, preset: RenderPreset = 'standard'): PremiumLayout {
  const frameInsetRatio =
    preset === 'hero' ? 0.148
    : preset === 'pixel' ? 0.156
    : 0.154
  const frameInset = Math.round(size * frameInsetRatio)
  const frameSize = Math.max(1, size - frameInset * 2)
  const frameStrokeRatio =
    preset === 'hero' ? 0.048
    : preset === 'pixel' ? 0.051
    : 0.053
  const frameStroke = clamp(
    Math.round(frameSize * frameStrokeRatio),
    Math.round(frameSize * (preset === 'hero' ? 0.044 : preset === 'pixel' ? 0.047 : 0.048)),
    Math.round(frameSize * (preset === 'hero' ? 0.054 : preset === 'pixel' ? 0.056 : 0.059)),
  )
  const chamberInset = Math.max(
    Math.round(frameStroke * (preset === 'hero' ? 1.04 : preset === 'pixel' ? 1.08 : 1.12)),
    Math.round(frameSize * (preset === 'hero' ? 0.027 : preset === 'pixel' ? 0.029 : 0.031)),
  )
  const chamberSize = Math.max(1, frameSize - chamberInset * 2)
  const chamberX = frameInset + chamberInset
  const chamberY = chamberX
  const breakoutWidth = Math.max(1, Math.round(chamberSize * (preset === 'hero' ? 0.30 : preset === 'pixel' ? 0.22 : 0.28)))
  const breakoutHeight = Math.max(1, Math.round(chamberSize * (preset === 'hero' ? 0.20 : preset === 'pixel' ? 0.12 : 0.14)))
  const breakoutX = chamberX + Math.round((chamberSize - breakoutWidth) / 2)
  const breakoutY = Math.max(0, chamberY - Math.round(chamberSize * (preset === 'hero' ? 0.115 : preset === 'pixel' ? 0.082 : 0.095)))

  return {
    size,
    cardRadius: Math.round(size * 0.16),
    frameX: frameInset,
    frameY: frameInset,
    frameSize,
    frameRadius: Math.round(frameSize * 0.207),
    frameStroke,
    chamberX,
    chamberY,
    chamberSize,
    chamberRadius: Math.round(chamberSize * (preset === 'pixel' ? 0.14 : 0.148)),
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

  const pixelArtTransparentBreakoutCandidate =
    sourceClass === 'pixelArt' &&
    hasTransparency &&
    topCenterStdDev > 26 &&
    topOccupancy > 0.026 &&
    topOccupancy < 0.11 &&
    strongEdgeRatio > 0.13 &&
    alphaCoverage < 0.94
  const allowBreakout =
    fitMode === 'cover' &&
    hasTransparency &&
    !brightBadgeLike &&
    (
      (
        !lowResolution &&
        (sourceClass === 'illustration' || sourceClass === 'portraitPhoto')
      ) ||
      pixelArtTransparentBreakoutCandidate
    ) &&
    meanLuma < 208 &&
    edgeLuma < 244 &&
    centerLuma < 210 &&
    centerEdgeDelta > 10 &&
    topCenterStdDev > 16 &&
    topOccupancy > 0.02 &&
    topOccupancy < 0.62

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
      <stop offset="12%" stop-color="${FRAME_GRADIENT.topLeft}"/>
      <stop offset="42%" stop-color="${FRAME_GRADIENT.middle}"/>
      <stop offset="68%" stop-color="${FRAME_ACCENT.midAccent}"/>
      <stop offset="86%" stop-color="${FRAME_ACCENT.deepAccent}"/>
      <stop offset="100%" stop-color="${FRAME_GRADIENT.bottomRight}"/>
    </linearGradient>
  </defs>
  ${createFrameStrokeRect(layout, 'url(#frameStroke)')}
</svg>`
}

function resolveBreakoutSourceKind(params: {
  sourceAlphaBreakoutAllowed: boolean
  preparedHeroCutoutAvailable: boolean
  preparedHeroCutoutBreakoutAllowed: boolean
}): BreakoutSourceKind {
  if (params.preparedHeroCutoutAvailable && params.preparedHeroCutoutBreakoutAllowed) {
    return 'heroCutout'
  }
  if (params.sourceAlphaBreakoutAllowed) {
    return 'sourceAlpha'
  }
  return 'none'
}

function resolveSourceAlphaBreakoutAllowed(params: {
  allowBreakout: boolean
  suppressBreakout?: boolean
}): boolean {
  return !params.suppressBreakout && params.allowBreakout
}

function decideBreakoutPlan(params: {
  analysis: SourceAnalysis
  suppressBreakout?: boolean
  breakoutSourceKind: BreakoutSourceKind
  rembgAvailable: boolean
}): BreakoutPlan {
  const { analysis } = params
  const breakoutRequested =
    analysis.fitMode === 'cover' &&
    !analysis.brightBadgeLike &&
    !params.suppressBreakout
  const minTopCenterStdDev =
    analysis.sourceClass === 'portraitPhoto' ? 17
    : analysis.sourceClass === 'illustration' ? 16
    : 20
  const minTopOccupancy =
    analysis.sourceClass === 'portraitPhoto' ? 0.035
    : analysis.sourceClass === 'illustration' ? 0.045
    : 0.06
  const maxTopOccupancy =
    analysis.sourceClass === 'portraitPhoto' ? 0.36
    : analysis.sourceClass === 'illustration' ? 0.84
    : 0.24
  const rembgCandidate =
    breakoutRequested &&
    !analysis.hasTransparency &&
    !analysis.lowResolution &&
    (analysis.sourceClass === 'portraitPhoto' || analysis.sourceClass === 'illustration') &&
    analysis.topCenterStdDev > minTopCenterStdDev &&
    analysis.topOccupancy > minTopOccupancy &&
    analysis.topOccupancy < maxTopOccupancy

  if (params.suppressBreakout) {
    return { mode: 'none', breakoutRequested, rembgCandidate, reason: 'suppressed' }
  }
  if (analysis.fitMode !== 'cover') {
    return { mode: 'none', breakoutRequested, rembgCandidate, reason: 'fit-not-cover' }
  }
  if (analysis.brightBadgeLike) {
    return { mode: 'none', breakoutRequested, rembgCandidate, reason: 'bright-badge-like' }
  }
  if (params.breakoutSourceKind === 'heroCutout') {
    return { mode: 'heroCutout', breakoutRequested, rembgCandidate, reason: 'hero-cutout' }
  }
  if (params.breakoutSourceKind === 'sourceAlpha') {
    return { mode: 'sourceAlpha', breakoutRequested, rembgCandidate, reason: 'source-alpha' }
  }
  if (!rembgCandidate) {
    return { mode: 'none', breakoutRequested, rembgCandidate, reason: 'rembg-not-candidate' }
  }
  if (!params.rembgAvailable) {
    return { mode: 'none', breakoutRequested, rembgCandidate, reason: 'rembg-unavailable' }
  }
  return { mode: 'rembgCutout', breakoutRequested, rembgCandidate, reason: 'rembg-candidate' }
}

export async function renderBackgroundCard(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cardGradient" cx="50%" cy="42%" r="63%">
      <stop offset="0%" stop-color="#010207"/>
      <stop offset="36%" stop-color="#03040A"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <radialGradient id="cardAuraTl" cx="28%" cy="23%" r="56%">
      <stop offset="0%" stop-color="rgba(110,150,255,0.11)"/>
      <stop offset="34%" stop-color="rgba(39,83,190,0.032)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardAuraBr" cx="77%" cy="78%" r="60%">
      <stop offset="0%" stop-color="rgba(47,125,255,0.18)"/>
      <stop offset="40%" stop-color="rgba(36,76,172,0.042)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="cardVignette" cx="50%" cy="56%" r="72%">
      <stop offset="48%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.82)"/>
    </radialGradient>
    <linearGradient id="chamberGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CHAMBER_GRADIENT.top}"/>
      <stop offset="100%" stop-color="${CHAMBER_GRADIENT.bottom}"/>
    </linearGradient>
    <radialGradient id="chamberAmbient" cx="50%" cy="32%" r="72%">
      <stop offset="0%" stop-color="rgba(170,205,255,0.11)"/>
      <stop offset="28%" stop-color="rgba(77,132,255,0.048)"/>
      <stop offset="68%" stop-color="rgba(18,34,78,0.018)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="chamberFloorGlow" cx="50%" cy="100%" r="70%">
      <stop offset="0%" stop-color="rgba(47,125,255,0.12)"/>
      <stop offset="40%" stop-color="rgba(47,125,255,0.03)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="#000000"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardGradient)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardAuraTl)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardAuraBr)"/>
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="url(#cardVignette)"/>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberGradient)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberAmbient)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chamberFloorGlow)"
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
    <radialGradient id="chamberVignette" cx="50%" cy="48%" r="68%">
      <stop offset="54%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.74)"/>
    </radialGradient>
    <linearGradient id="chamberTopShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.36)"/>
      <stop offset="20%" stop-color="rgba(0,0,0,0.08)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.29)"/>
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
  const glowStroke = Math.max(22, Math.round(layout.frameStroke * 1.28))
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
  const core = await applyOpacity(glowBase, 0.066)
  const tightEdge = await sharp(glowBase)
    .blur(Math.max(2.4, size * 0.0068))
    .png()
    .toBuffer()
  const rim = await sharp(glowBase)
    .blur(Math.max(6, size * 0.017))
    .png()
    .toBuffer()
  const blurNear = await sharp(glowBase)
    .blur(Math.max(14, size * 0.048))
    .png()
    .toBuffer()
  const blurMid = await sharp(glowBase)
    .blur(Math.max(36, size * 0.13))
    .png()
    .toBuffer()
  const blurFar = await sharp(glowBase)
    .blur(Math.max(96, size * 0.26))
    .png()
    .toBuffer()
  const blurAmbient = await sharp(glowBase)
    .blur(Math.min(620, Math.max(200, size * 0.52)))
    .png()
    .toBuffer()
  const directionalAuraSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="auraTl" cx="24%" cy="22%" r="72%">
      <stop offset="0%" stop-color="rgba(246,250,255,0.12)"/>
      <stop offset="30%" stop-color="rgba(176,205,255,0.065)"/>
      <stop offset="72%" stop-color="rgba(88,142,255,0.02)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
    <radialGradient id="auraBr" cx="80%" cy="82%" r="82%">
      <stop offset="0%" stop-color="rgba(47,125,255,0.62)"/>
      <stop offset="40%" stop-color="rgba(47,125,255,0.28)"/>
      <stop offset="78%" stop-color="rgba(47,125,255,0.09)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#auraTl)" />
  <rect width="${size}" height="${size}" fill="url(#auraBr)" />
</svg>`
  const directionalAura = await sharp(Buffer.from(directionalAuraSvg)).png().toBuffer()
  const merged = await createTransparentCanvas(size)
    .composite([
      { input: await applyOpacity(blurAmbient, 0.42), blend: 'screen' },
      { input: await applyOpacity(blurFar, 0.70), blend: 'screen' },
      { input: await applyOpacity(blurMid, 0.92), blend: 'screen' },
      { input: await applyOpacity(blurNear, 1.0), blend: 'screen' },
      { input: await applyOpacity(rim, 0.84), blend: 'screen' },
      { input: await applyOpacity(core, 0.44), blend: 'screen' },
      { input: await applyOpacity(tightEdge, 0.56), blend: 'screen' },
      { input: await applyOpacity(directionalAura, 1.0), blend: 'screen' },
    ])
    .png()
    .toBuffer()

  const innerCutInset = Math.max(1, Math.round(layout.frameStroke * 0.72))
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
    .blur(Math.max(12, size * 0.024))
    .png()
    .toBuffer()
  const outsideOnly = await sharp(merged)
    .ensureAlpha()
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()

  return applyOpacity(outsideOnly, 0.98)
}

export async function renderFrameBloom(params: {
  size: number
  layout: PremiumLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const strokeLayer = await sharp(Buffer.from(createFrameGradientSvg(size, layout))).png().toBuffer()
  const bloomNear = await sharp(strokeLayer)
    .blur(Math.max(2.4, size * 0.006))
    .png()
    .toBuffer()
  const bloomFar = await sharp(strokeLayer)
    .blur(Math.max(22, size * 0.044))
    .png()
    .toBuffer()
  const merged = await sharp(bloomFar)
    .composite([{ input: await applyOpacity(bloomNear, 0.76), blend: 'screen' }])
    .png()
    .toBuffer()
  return applyOpacity(merged, 0.98)
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
      <stop offset="0%" stop-color="rgba(255,255,255,0.32)"/>
      <stop offset="34%" stop-color="rgba(255,255,255,0.10)"/>
      <stop offset="74%" stop-color="rgba(120,166,255,0.22)"/>
      <stop offset="100%" stop-color="rgba(47,111,255,0.18)"/>
    </linearGradient>
    <radialGradient id="specularTl" cx="28%" cy="24%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.33)"/>
      <stop offset="32%" stop-color="rgba(255,255,255,0.11)"/>
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
    .blur(Math.max(0.7, size * 0.0018))
    .png()
    .toBuffer()
  const faceEmission = await sharp(strokeLayer)
    .blur(Math.max(1.2, size * 0.0032))
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

  const innerHairlineSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="innerHairline" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
      <stop offset="55%" stop-color="rgba(220,232,255,0.1)"/>
      <stop offset="100%" stop-color="rgba(47,125,255,0.32)"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.frameX + layout.frameStroke * 0.68}"
    y="${layout.frameY + layout.frameStroke * 0.68}"
    width="${Math.max(1, layout.frameSize - layout.frameStroke * 1.36)}"
    height="${Math.max(1, layout.frameSize - layout.frameStroke * 1.36)}"
    rx="${Math.max(1, layout.frameRadius - layout.frameStroke * 0.68)}"
    fill="none"
    stroke="url(#innerHairline)"
    stroke-width="${Math.max(1, Math.round(layout.frameStroke * 0.18))}"
  />
</svg>`
  const innerHairline = await sharp(Buffer.from(innerHairlineSvg)).png().toBuffer()

  const hairlineW = Math.max(1, Math.round(size * 0.0014))
  const outerHairlineSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX + hairlineW / 2}"
    y="${layout.frameY + hairlineW / 2}"
    width="${Math.max(1, layout.frameSize - hairlineW)}"
    height="${Math.max(1, layout.frameSize - hairlineW)}"
    rx="${Math.max(1, layout.frameRadius - hairlineW / 2)}"
    fill="none"
    stroke="rgba(255,255,255,0.18)"
    stroke-width="${hairlineW}"
  />
</svg>`
  const outerHairline = await sharp(Buffer.from(outerHairlineSvg))
    .ensureAlpha()
    .composite([{ input: ringMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const innerGlowW = Math.max(1, Math.round(layout.frameStroke * 0.24))
  const chamberInnerGlowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX + innerGlowW / 2}"
    y="${layout.chamberY + innerGlowW / 2}"
    width="${Math.max(1, layout.chamberSize - innerGlowW)}"
    height="${Math.max(1, layout.chamberSize - innerGlowW)}"
    rx="${Math.max(1, layout.chamberRadius - innerGlowW / 2)}"
    fill="none"
    stroke="rgba(140,180,255,0.22)"
    stroke-width="${innerGlowW}"
  />
</svg>`
  const chamberInnerGlow = await sharp(Buffer.from(chamberInnerGlowSvg))
    .blur(Math.max(0.9, size * 0.0016))
    .png()
    .toBuffer()

  return sharp(strokeLayer)
    .composite([
      { input: await applyOpacity(faceSoft, 0.16), blend: 'screen' },
      { input: await applyOpacity(faceEmission, 0.20), blend: 'screen' },
      { input: await applyOpacity(faceRollover, 0.52), blend: 'screen' },
      { input: contactShadowInside, blend: 'multiply' },
      { input: await applyOpacity(chamberInnerGlow, 0.72), blend: 'screen' },
      { input: await applyOpacity(innerHairline, 0.86), blend: 'screen' },
      { input: await applyOpacity(outerHairline, 0.90), blend: 'screen' },
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
      kernel: params.sourceClass === 'pixelArt' ? sharp.kernel.nearest : sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return createTransparentCanvas(layout.size)
    .composite([{ input: placed, left: artX, top: artY }])
    .png()
    .toBuffer()
}

async function computeAlignedTopBiasPx(params: {
  layout: PremiumLayout
  baseTopBiasPx: number
  scale: number
  fit: ArtworkFitMode
  sourceClass: SourceClass
  maskRgbaPng: Buffer
}): Promise<SegmentationAlignmentResult> {
  const targetTopY = Math.round(params.layout.chamberY + params.layout.chamberSize * PREMIUM_ALIGN_TARGET_TOP_RATIO)
  if (params.fit !== 'cover') {
    return {
      topBiasPx: params.baseTopBiasPx,
      deltaPx: 0,
      targetTopY,
      maskTopY: null,
    }
  }

  const maskCanvas = await renderPlacedSourceCanvas({
    sourceImage: params.maskRgbaPng,
    layout: params.layout,
    scale: params.scale,
    fit: 'cover',
    topBiasPx: params.baseTopBiasPx,
    sourceClass: params.sourceClass,
    maxTopBiasRatio: PREMIUM_ALIGN_MAX_BIAS_RATIO,
  })
  const { data, info } = await sharp(maskCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bounds = getAlphaBounds(data, info.width, info.height, info.channels)
  if (!bounds) {
    return {
      topBiasPx: params.baseTopBiasPx,
      deltaPx: 0,
      targetTopY,
      maskTopY: null,
    }
  }

  const maxBiasPx = Math.round(params.layout.chamberSize * PREMIUM_ALIGN_MAX_BIAS_RATIO)
  const nextTopBiasPx = Math.round(clamp(params.baseTopBiasPx + (bounds.minY - targetTopY), 0, maxBiasPx))
  return {
    topBiasPx: nextTopBiasPx,
    deltaPx: bounds.minY - targetTopY,
    targetTopY,
    maskTopY: bounds.minY,
  }
}

async function measureBreakoutMaskCoverage(params: {
  layout: PremiumLayout
  scale: number
  topBiasPx: number
  sourceClass: SourceClass
  maskRgbaPng: Buffer
}): Promise<number> {
  const maskCanvas = await renderPlacedSourceCanvas({
    sourceImage: params.maskRgbaPng,
    layout: params.layout,
    scale: params.scale,
    fit: 'cover',
    topBiasPx: params.topBiasPx,
    sourceClass: params.sourceClass,
    maxTopBiasRatio: PREMIUM_ALIGN_MAX_BIAS_RATIO,
  })
  const { data, info } = await sharp(maskCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const x0 = Math.max(0, params.layout.breakoutX)
  const x1 = Math.min(info.width, params.layout.breakoutX + params.layout.breakoutWidth)
  const y0 = Math.max(0, params.layout.breakoutY)
  const y1 = Math.min(info.height, params.layout.breakoutY + params.layout.breakoutHeight)
  let on = 0
  let total = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1
      const idx = (y * info.width + x) * info.channels
      const alpha = data[idx + 3] ?? 0
      if (alpha > 32) on += 1
    }
  }
  if (total === 0) return 0
  return on / total
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
  const isPixelArt = params.sourceClass === 'pixelArt'
  const toned = isBrightTone
    ? await sharp(clipped)
        .modulate({
          brightness: 0.82,
          saturation: 0.86,
        })
        .linear(1.1, -12)
        .png()
        .toBuffer()
    : isPixelArt
      ? await sharp(clipped)
          .modulate({
            brightness: 1.0,
            saturation: 1.0,
          })
          .linear(1.0, 0)
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

  const vignetteOuterOpacity = isBrightTone ? 0.50 : isPixelArt ? 0.16 : isPortraitHero ? 0.40 : 0.32
  const bottomScrimOpacity = isBrightTone ? 0.42 : isPixelArt ? 0.08 : isPortraitHero ? 0.30 : 0.22
  const topScrimOpacity = isBrightTone ? 0.02 : isPixelArt ? 0 : 0
  const edgeContactOpacity = isBrightTone ? 0.32 : isPixelArt ? 0.12 : isPortraitHero ? 0.28 : 0.22
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
  const topEdgeLiftOpacity = isBrightTone ? 0.028 : isPixelArt ? 0.01 : isPortraitHero ? 0.058 : 0.048
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

  // Subtle chamber-clipped sheen makes the artwork read through a glass finish.
  const sheenOpacity =
    isBrightTone ? 0.10
    : isPixelArt ? 0.08
    : isPortraitHero ? 0.18
    : 0.14
  const glassSheenSvg = `<svg width="${layout.size}" height="${layout.size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="floorSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="68%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.22)"/>
    </linearGradient>
    <radialGradient id="specular" cx="28%" cy="18%" r="46%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.16)"/>
      <stop offset="44%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#specular)"
  />
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#floorSheen)"
  />
</svg>`
  const glassSheen = await sharp(Buffer.from(glassSheenSvg)).png().toBuffer()
  const glassSheenClipped = await sharp(glassSheen)
    .ensureAlpha()
    .composite([{ input: chamberMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const glossyHero = await sharp(framedHero)
    .composite([{ input: await applyOpacity(glassSheenClipped, sheenOpacity), blend: 'screen' }])
    .png()
    .toBuffer()

  const shouldRevealRearLayers =
    params.sourceClass === 'portraitPhoto' ||
    params.sourceClass === 'illustration' ||
    params.sourceClass === 'generic'
  if (!shouldRevealRearLayers) {
    return glossyHero
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
  return sharp(glossyHero)
    .ensureAlpha()
    .composite([{ input: rearRevealMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function createTopBreakoutMask(params: {
  size: number
  layout: PremiumLayout
  sourceClass?: SourceClass
}): Promise<Buffer> {
  const { size, layout } = params
  const isIllustration = params.sourceClass === 'illustration'
  const breakoutShiftX = isIllustration ? -Math.round(layout.breakoutWidth * 0.10) : 0
  const breakoutExpandX = isIllustration ? Math.round(layout.breakoutWidth * 0.14) : 0
  const breakoutX = Math.max(0, layout.breakoutX + breakoutShiftX - breakoutExpandX)
  const breakoutRight = Math.min(size, layout.breakoutX + layout.breakoutWidth + breakoutShiftX + breakoutExpandX)
  const breakoutWidth = Math.max(1, breakoutRight - breakoutX)
  const top = layout.breakoutY
  const bottom = Math.min(size, top + layout.breakoutHeight)
  const height = Math.max(1, bottom - top)
  const radius = Math.max(1, Math.round(breakoutWidth * 0.30))
  const topHoldOffset = isIllustration ? '40%' : '32%'
  const lowerFadeOpacity = isIllustration ? '0.18' : '0.28'
  const xFadeStart = isIllustration ? '6%' : '18%'
  const xFadeEnd = isIllustration ? '94%' : '82%'
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fadeY" x1="0" y1="${top}" x2="0" y2="${bottom}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="${topHoldOffset}" stop-color="white" stop-opacity="1"/>
      <stop offset="70%" stop-color="white" stop-opacity="${lowerFadeOpacity}"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeX" x1="${breakoutX}" y1="0" x2="${breakoutX + breakoutWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="${xFadeStart}" stop-color="white" stop-opacity="1"/>
      <stop offset="${xFadeEnd}" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect
    x="${breakoutX}"
    y="${top}"
    width="${breakoutWidth}"
    height="${height}"
    rx="${radius}"
    fill="url(#fadeY)"
  />
  <rect
    x="${breakoutX}"
    y="${top}"
    width="${breakoutWidth}"
    height="${height}"
    rx="${radius}"
    fill="url(#fadeX)"
  />
</svg>`
  return sharp(Buffer.from(svg))
    .blur(isIllustration ? 0.32 : 0.6)
    .png()
    .toBuffer()
}

async function createBreakoutAboveFrameMask(params: {
  size: number
  layout: PremiumLayout
  sourceClass?: SourceClass
}): Promise<Buffer> {
  const { size, layout } = params
  const isIllustration = params.sourceClass === 'illustration'
  const overlapIntoChamberPx = Math.max(1, Math.round(layout.frameStroke * (isIllustration ? 0.2 : 0.05)))
  const edgeFeatherPx = Math.max(1, Math.round(layout.frameStroke * (isIllustration ? 0.38 : 0.12)))
  const keepToY = Math.min(size, Math.max(0, layout.chamberY + overlapIntoChamberPx))
  const fadeEndY = Math.min(size, keepToY + edgeFeatherPx)
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="breakoutAboveFrame" x1="0" y1="0" x2="0" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="${Math.round((keepToY / Math.max(1, size)) * 100)}%" stop-color="white" stop-opacity="1"/>
      <stop offset="${Math.round((fadeEndY / Math.max(1, size)) * 100)}%" stop-color="white" stop-opacity="0"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#breakoutAboveFrame)" />
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createTopBreakoutSubjectMask(params: {
  sourceCanvas: Buffer
  layout: PremiumLayout
  sourceClass?: SourceClass
  forceAlphaMask?: boolean
  strictContourGates?: boolean
  forceAlphaThreshold?: number
}): Promise<Buffer | null> {
  const { sourceCanvas, layout } = params
  const isIllustration = params.sourceClass === 'illustration'
  const forceAlphaMask = Boolean(params.forceAlphaMask)
  const strictContourGates = Boolean(params.strictContourGates)
  const { data, info } = await sharp(sourceCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const regionShiftX = isIllustration ? -Math.round(layout.breakoutWidth * 0.04) : 0
  const padXMul = isIllustration ? 0.24 : 0.14
  const padYMul = isIllustration ? 0.32 : 0.26
  const yExtendMul = isIllustration ? 1.58 : 1.45
  const regionPadX = Math.max(1, Math.round(layout.breakoutWidth * padXMul))
  const regionPadY = Math.max(1, Math.round(layout.breakoutHeight * padYMul))
  const x0 = Math.max(0, layout.breakoutX + regionShiftX - regionPadX)
  const x1 = Math.min(width, layout.breakoutX + regionShiftX + layout.breakoutWidth + regionPadX)
  const y0 = Math.max(0, layout.breakoutY - regionPadY)
  const y1 = Math.min(height, layout.breakoutY + Math.round(layout.breakoutHeight * yExtendMul))

  let alphaPartialCount = 0
  let alphaCount = 0
  let alphaMostlyTransparentCount = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const a = data[idx + 3] ?? 255
      alphaCount += 1
      if (a < 250) alphaPartialCount += 1
      if (a <= 24) alphaMostlyTransparentCount += 1
    }
  }
  const alphaPartialRatio = alphaCount > 0 ? alphaPartialCount / alphaCount : 0
  const alphaMostlyTransparentRatio = alphaCount > 0 ? alphaMostlyTransparentCount / alphaCount : 0
  // Default path is conservative alpha breakout; explicit cutout mode can bypass this gate.
  const hasMeaningfulTransparency =
    alphaCount > 0 &&
    alphaPartialRatio > 0.03 &&
    alphaPartialRatio < 0.92 &&
    alphaMostlyTransparentRatio > 0.015
  if (!hasMeaningfulTransparency && !forceAlphaMask) {
    return null
  }

  let mask = Buffer.alloc(width * height, 0)
  let presentCount = 0
  let presentTopCount = 0
  let presentMinX = width
  let presentMaxX = -1
  let presentMinY = height
  let presentMaxY = -1
  let sumPresentX = 0
  let sumPresentY = 0
  const regionArea = Math.max(1, (x1 - x0) * (y1 - y0))
  const subjectTopBandY = y0 + Math.floor((y1 - y0) * 0.58)
  const alphaThreshold = forceAlphaMask ? (params.forceAlphaThreshold ?? 20) : 28
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * info.channels
      const a = data[idx + 3] ?? 255
      if (a > alphaThreshold) {
        mask[y * width + x] = 255
        presentCount += 1
        sumPresentX += x
        sumPresentY += y
        if (y <= subjectTopBandY) presentTopCount += 1
        if (x < presentMinX) presentMinX = x
        if (x > presentMaxX) presentMaxX = x
        if (y < presentMinY) presentMinY = y
        if (y > presentMaxY) presentMaxY = y
      }
    }
  }

  let contourConstrained = false
  if (forceAlphaMask && !strictContourGates && presentCount > 0) {
    const contourMask = Buffer.alloc(width * height, 0)
    for (let x = x0; x < x1; x += 1) {
      let topY = -1
      for (let y = y0; y < y1; y += 1) {
        if (mask[y * width + x] !== 0) {
          topY = y
          break
        }
      }
      if (topY < 0) continue
      for (let y = topY; y < y1; y += 1) {
        const idx = y * width + x
        if (mask[idx] !== 0) contourMask[idx] = 255
      }
    }

    let contourPresentCount = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (contourMask[y * width + x] !== 0) contourPresentCount += 1
      }
    }
    if (contourPresentCount > 0) {
      contourConstrained = true
      mask = contourMask
      presentCount = 0
      presentTopCount = 0
      presentMinX = width
      presentMaxX = -1
      presentMinY = height
      presentMaxY = -1
      sumPresentX = 0
      sumPresentY = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          if (mask[y * width + x] === 0) continue
          presentCount += 1
          sumPresentX += x
          sumPresentY += y
          if (y <= subjectTopBandY) presentTopCount += 1
          if (x < presentMinX) presentMinX = x
          if (x > presentMaxX) presentMaxX = x
          if (y < presentMinY) presentMinY = y
          if (y > presentMaxY) presentMaxY = y
        }
      }
    }
  }

  if (presentCount <= 0) {
    return null
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
  const flatnessRatio = widthRatio / Math.max(0.001, heightRatio)
  const logMaskDecision = (accepted: boolean, reason: string): void => {
    if (!BREAKOUT_DEBUG_LOG_ENABLED) return
    console.info('[breakout-debug]', JSON.stringify({
      step: 'createTopBreakoutSubjectMask:decision',
      accepted,
      reason,
      forceAlphaMask,
      strictContourGates,
      sourceClass: params.sourceClass ?? 'unknown',
      presentRatio,
      widthRatio,
      heightRatio,
      topWeightedRatio,
      centroidNorm,
      centroidYNorm,
      flatnessRatio,
      alphaPartialRatio,
      alphaMostlyTransparentRatio,
      contourConstrained,
      region: { x0, y0, x1, y1 },
      presentCount,
    }))
  }

  if (!forceAlphaMask) {
    const maxPresentRatio = isIllustration ? 0.86 : 0.38
    const minPresentRatio = isIllustration ? 0.008 : 0.018
    const maxWidthRatio = isIllustration ? 1.01 : 0.62
    const maxHeightRatio = isIllustration ? 1.01 : 0.82
    const maxFlatnessRatio = isIllustration ? 4.0 : 2.8
    const maxCentroidYNorm = isIllustration ? 0.72 : 0.58
    const minTopWeightedRatio = isIllustration ? 0.20 : 0.36
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
      flatnessRatio > maxFlatnessRatio
    ) {
      logMaskDecision(false, 'shape-gate-reject')
      return null
    }
  } else {
    // Explicit cutouts (prepared hero/rembg) should bypass conservative contour gates.
    if (
      presentRatio < 0.002 ||
      presentRatio > 0.92 ||
      heightRatio < 0.06 ||
      (strictContourGates && (
        widthRatio > 0.95 ||
        flatnessRatio > 4.8 ||
        topWeightedRatio < 0.12 ||
        centroidNorm < 0.12 ||
        centroidNorm > 0.88 ||
        centroidYNorm > 0.74
      ))
    ) {
      logMaskDecision(false, 'force-alpha-shape-gate-reject')
      return null
    }
  }

  if (!forceAlphaMask) {
    let edgePixelCount = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (mask[y * width + x] === 0) continue
        const hasEmptyNeighbor =
          (x > 0 && mask[y * width + (x - 1)] === 0) ||
          (x < width - 1 && mask[y * width + (x + 1)] === 0) ||
          (y > 0 && mask[(y - 1) * width + x] === 0) ||
          (y < height - 1 && mask[(y + 1) * width + x] === 0)
        if (hasEmptyNeighbor) edgePixelCount += 1
      }
    }
    const edgeRatio = presentCount > 0 ? edgePixelCount / presentCount : 0
    const minEdgeRatio = isIllustration ? 0.04 : 0.07
    if (edgeRatio < minEdgeRatio) {
      logMaskDecision(false, 'edge-ratio-reject')
      return null
    }
  }

  let processedSharp = sharp(mask, { raw: { width, height, channels: 1 } })
    .threshold(forceAlphaMask ? 8 : 18)
  processedSharp = processedSharp.blur(
    forceAlphaMask
      ? (isIllustration ? 0.34 : 0.44)
      : (isIllustration ? 0.32 : 0.7),
  )
  const { data: processed, info: maskInfo } = await processedSharp
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pxCount = maskInfo.width * maskInfo.height
  const rgba = Buffer.alloc(pxCount * 4, 255)
  for (let i = 0; i < pxCount; i++) {
    rgba[i * 4 + 3] = processed[i] ?? 0
  }
  logMaskDecision(true, 'accepted')
  return sharp(rgba, { raw: { width: maskInfo.width, height: maskInfo.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function createFallbackBreakoutDetailMask(params: {
  sourceCanvas: Buffer
  layout: PremiumLayout
  sourceClass?: SourceClass
}): Promise<Buffer | null> {
  const { sourceCanvas, layout, sourceClass } = params
  const { data, info } = await sharp(sourceCanvas)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  const channels = info.channels

  const padX = Math.max(1, Math.round(layout.breakoutWidth * 0.14))
  const x0 = Math.max(1, layout.breakoutX - padX)
  const x1 = Math.min(width - 1, layout.breakoutX + layout.breakoutWidth + padX)
  const y0 = Math.max(1, layout.breakoutY - Math.round(layout.breakoutHeight * 0.08))
  const y1 = Math.min(height - 1, layout.breakoutY + Math.round(layout.breakoutHeight * 1.06))
  if (x1 <= x0 || y1 <= y0) return null

  const detailThreshold =
    sourceClass === 'pixelArt' ? 28
    : sourceClass === 'illustration' ? 34
    : 38
  const mask = Buffer.alloc(width * height, 0)
  let activeCount = 0
  const spanY = Math.max(1, y1 - y0)

  for (let y = y0; y < y1; y += 1) {
    const yWeight = 1 - ((y - y0) / spanY) * 0.42
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * channels
      const alpha = data[idx + 3] ?? 255
      if (alpha < 22) continue

      const luma = 0.2126 * (data[idx] ?? 0) + 0.7152 * (data[idx + 1] ?? 0) + 0.0722 * (data[idx + 2] ?? 0)

      const leftIdx = (y * width + (x - 1)) * channels
      const rightIdx = (y * width + (x + 1)) * channels
      const upIdx = ((y - 1) * width + x) * channels
      const downIdx = ((y + 1) * width + x) * channels

      const leftLuma = 0.2126 * (data[leftIdx] ?? 0) + 0.7152 * (data[leftIdx + 1] ?? 0) + 0.0722 * (data[leftIdx + 2] ?? 0)
      const rightLuma = 0.2126 * (data[rightIdx] ?? 0) + 0.7152 * (data[rightIdx + 1] ?? 0) + 0.0722 * (data[rightIdx + 2] ?? 0)
      const upLuma = 0.2126 * (data[upIdx] ?? 0) + 0.7152 * (data[upIdx + 1] ?? 0) + 0.0722 * (data[upIdx + 2] ?? 0)
      const downLuma = 0.2126 * (data[downIdx] ?? 0) + 0.7152 * (data[downIdx + 1] ?? 0) + 0.0722 * (data[downIdx + 2] ?? 0)

      const detailScore =
        (
          Math.abs(luma - leftLuma) +
          Math.abs(luma - rightLuma) +
          Math.abs(luma - upLuma) +
          Math.abs(luma - downLuma)
        ) * yWeight
      if (detailScore >= detailThreshold) {
        mask[y * width + x] = 255
        activeCount += 1
      }
    }
  }

  const regionArea = Math.max(1, (x1 - x0) * (y1 - y0))
  if (activeCount < Math.max(22, Math.round(regionArea * 0.005))) return null

  const blurSigma = sourceClass === 'pixelArt' ? 0.42 : 0.62
  const { data: processed, info: maskInfo } = await sharp(mask, { raw: { width, height, channels: 1 } })
    .blur(blurSigma)
    .threshold(14)
    .raw()
    .toBuffer({ resolveWithObject: true })

  let processedCount = 0
  for (let i = 0; i < processed.length; i += 1) {
    if ((processed[i] ?? 0) > 12) processedCount += 1
  }
  if (processedCount < Math.max(16, Math.round(regionArea * 0.003))) return null

  const pxCount = maskInfo.width * maskInfo.height
  const rgba = Buffer.alloc(pxCount * 4, 255)
  for (let i = 0; i < pxCount; i += 1) {
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
  subjectMaskSourceImage?: Uint8Array
  subjectMaskKind?: 'heroCutout' | 'sourceAlpha' | 'rembgCutout'
  allowFallbackBand?: boolean
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
    ? Math.max(params.scale ?? 1.04, 1.06)
    : params.scale ?? 1.04
  if (BREAKOUT_DEBUG_LOG_ENABLED) {
    const sourceMeta = await sharp(normalized).metadata()
    console.info('[breakout-debug]', JSON.stringify({
      step: 'renderBreakoutLayer:start',
      extractionSource: params.subjectMaskSourceImage ? 'provided-subject-mask-source' : 'normalized-original-source',
      sourceWidth: sourceMeta.width,
      sourceHeight: sourceMeta.height,
      sourceClass: params.sourceClass ?? 'unknown',
      breakoutScale,
      topBiasPx: params.topBiasPx ?? 0,
      requestedOpacity: params.opacity ?? 0.22,
      compositeOrder: [
        'backgroundCard',
        'outerGlow',
        'frameBloom',
        'rearLayers',
        'heroClipped',
        'premiumFrame',
        'breakoutSprite',
      ],
    }))
  }
  await writeBreakoutDebugAsset('0-breakout-source-normalized.png', normalized)
  const sourceCanvas = await renderPlacedSourceCanvas({
    sourceImage: normalized,
    layout,
    scale: breakoutScale,
    fit: 'cover',
    topBiasPx: params.topBiasPx,
    sourceClass: params.sourceClass,
    maxTopBiasRatio: isIllustrationBreakout ? 0.046 : undefined,
  })
  let subjectRefCanvas: Buffer | null = null
  if (params.subjectMaskSourceImage && params.subjectMaskSourceImage.length > 0) {
    try {
      const normalizedSubjectRef = await normalizeSourceImage(params.subjectMaskSourceImage)
      await writeBreakoutDebugAsset('1a-breakout-subject-ref-normalized.png', normalizedSubjectRef)
      subjectRefCanvas = await renderPlacedSourceCanvas({
        sourceImage: normalizedSubjectRef,
        layout,
        scale: breakoutScale,
        fit: 'cover',
        topBiasPx: params.topBiasPx,
        sourceClass: params.sourceClass,
        maxTopBiasRatio: isIllustrationBreakout ? 0.046 : undefined,
      })
      await writeBreakoutDebugAsset('1b-breakout-subject-ref-canvas.png', subjectRefCanvas)
    } catch (error) {
      subjectRefCanvas = null
      if (BREAKOUT_DEBUG_LOG_ENABLED) {
        console.warn('[token/image] subject mask source decode failed; using fallback breakout:', error)
      }
    }
  }
  await writeBreakoutDebugAsset('1-breakout-source-canvas.png', sourceCanvas)
  const breakoutMask = await createTopBreakoutMask({ size, layout, sourceClass: params.sourceClass })
  const requiresPreparedMaskSource =
    params.subjectMaskKind === 'heroCutout' || params.subjectMaskKind === 'rembgCutout'
  const hasPreparedMaskSource = requiresPreparedMaskSource && subjectRefCanvas !== null
  const subjectMask = await createTopBreakoutSubjectMask({
    sourceCanvas: subjectRefCanvas ?? sourceCanvas,
    layout,
    sourceClass: params.sourceClass,
    forceAlphaMask: hasPreparedMaskSource,
    forceAlphaThreshold:
      hasPreparedMaskSource && params.subjectMaskKind === 'heroCutout'
        ? 88
        : hasPreparedMaskSource && params.subjectMaskKind === 'rembgCutout'
          ? 120
          : undefined,
    strictContourGates: hasPreparedMaskSource && params.subjectMaskKind === 'rembgCutout',
  })
  const aboveFrameMask = await createBreakoutAboveFrameMask({
    size,
    layout,
    sourceClass: params.sourceClass,
  })
  const subjectMaskDebug = subjectMask ?? await createTransparentCanvas(size).png().toBuffer()
  await writeBreakoutDebugAsset('2-breakout-mask-window.png', breakoutMask)
  await writeBreakoutDebugAsset('3-breakout-mask-subject.png', subjectMaskDebug)
  await writeBreakoutDebugAsset('4-breakout-mask-above-frame.png', aboveFrameMask)
  await debugLogLayerBounds('breakoutMask', breakoutMask)
  await debugLogLayerBounds('subjectMask', subjectMaskDebug)
  await debugLogLayerBounds('aboveFrameMask', aboveFrameMask)

  const breakoutSeedCanvas = subjectRefCanvas ?? sourceCanvas
  let maskedSharp = sharp(breakoutSeedCanvas)
    .ensureAlpha()
    .composite([{ input: breakoutMask, blend: 'dest-in' }])
  const maskedAfterBreakoutMask = await maskedSharp.png().toBuffer()
  await writeBreakoutDebugAsset('4a-breakout-after-window-mask.png', maskedAfterBreakoutMask)
  await debugLogLayerBounds('breakoutAfterWindowMask', maskedAfterBreakoutMask)
  maskedSharp = sharp(maskedAfterBreakoutMask).ensureAlpha()
  if (subjectMask) {
    maskedSharp = maskedSharp.composite([{ input: subjectMask, blend: 'dest-in' }])
    const maskedAfterSubjectMask = await maskedSharp.png().toBuffer()
    await writeBreakoutDebugAsset('4ab-breakout-after-subject-mask.png', maskedAfterSubjectMask)
    await debugLogLayerBounds('breakoutAfterSubjectMask', maskedAfterSubjectMask)
    maskedSharp = sharp(maskedAfterSubjectMask).ensureAlpha()
  }
  maskedSharp = maskedSharp.composite([{ input: aboveFrameMask, blend: 'dest-in' }])
  if (!isIllustrationBreakout) {
    maskedSharp = maskedSharp.blur(0.5)
  }
  let masked = await maskedSharp
    .png()
    .toBuffer()
  await writeBreakoutDebugAsset('4b-breakout-masked-pre-shadow.png', masked)
  await debugLogLayerBounds('breakoutSpritePreShadow', masked)
  let breakoutOpacity = params.opacity ?? 0.26
  let fallbackBandUsed = false
  let fallbackDetailMaskUsed = false
  if (subjectMask) {
    // Add subtle frame-contact shadow so real subject breakouts read as depth, not paste.
    const shadowOpacity =
      params.sourceClass === 'illustration' ? 0.16
      : params.sourceClass === 'portraitPhoto' ? 0.22
      : 0.18
    const shadowBlur = Math.max(1.4, size * 0.0032)
    const shadowOffsetY = Math.max(1, Math.round(layout.frameStroke * 0.10))
    const shadowSilhouette = await sharp(masked)
      .ensureAlpha()
      .modulate({ brightness: 0, saturation: 0 })
      .png()
      .toBuffer()
    const shadowSoft = await sharp(shadowSilhouette)
      .blur(shadowBlur)
      .png()
      .toBuffer()
    const shadowShifted = await createTransparentCanvas(size)
      .composite([{ input: await applyOpacity(shadowSoft, shadowOpacity), left: 0, top: shadowOffsetY }])
      .png()
      .toBuffer()
    masked = await sharp(shadowShifted)
      .composite([{ input: masked, blend: 'over' }])
      .png()
      .toBuffer()
  } else if (params.allowFallbackBand) {
    fallbackBandUsed = true
    const breakoutSeed = masked
    const fallbackRadius = Math.max(1, Math.round(layout.breakoutWidth * 0.24))
    const fallbackBandMaskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fallbackBandY" x1="0" y1="${layout.breakoutY}" x2="0" y2="${layout.breakoutY + layout.breakoutHeight}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="70%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fallbackBandX" x1="${layout.breakoutX}" y1="0" x2="${layout.breakoutX + layout.breakoutWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="14%" stop-color="white" stop-opacity="1"/>
      <stop offset="86%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect
    x="${layout.breakoutX}"
    y="${layout.breakoutY}"
    width="${layout.breakoutWidth}"
    height="${layout.breakoutHeight}"
    rx="${fallbackRadius}"
    fill="url(#fallbackBandY)"
  />
  <rect
    x="${layout.breakoutX}"
    y="${layout.breakoutY}"
    width="${layout.breakoutWidth}"
    height="${layout.breakoutHeight}"
    rx="${fallbackRadius}"
    fill="url(#fallbackBandX)"
  />
</svg>`
    const fallbackBandMask = await sharp(Buffer.from(fallbackBandMaskSvg)).png().toBuffer()
    const fallbackDetailMask = await createFallbackBreakoutDetailMask({
      sourceCanvas,
      layout,
      sourceClass: params.sourceClass,
    })
    const fallbackDetailMaskDebug = fallbackDetailMask ?? await createTransparentCanvas(size).png().toBuffer()
    await writeBreakoutDebugAsset('3a-breakout-mask-fallback-detail.png', fallbackDetailMaskDebug)
    const bandOnlyComposites: sharp.OverlayOptions[] = [
      { input: fallbackBandMask, blend: 'dest-in' },
      { input: aboveFrameMask, blend: 'dest-in' },
    ]
    const bandOnlyMasked = await sharp(breakoutSeed)
      .ensureAlpha()
      .composite(bandOnlyComposites)
      .png()
      .toBuffer()
    masked = bandOnlyMasked

    if (fallbackDetailMask) {
      const detailMasked = await sharp(breakoutSeed)
        .ensureAlpha()
        .composite([
          { input: fallbackBandMask, blend: 'dest-in' },
          { input: fallbackDetailMask, blend: 'dest-in' },
          { input: aboveFrameMask, blend: 'dest-in' },
        ])
        .png()
        .toBuffer()
      if (await hasVisibleAlpha(detailMasked)) {
        fallbackDetailMaskUsed = true
        masked = detailMasked
      }
    }

    const fallbackSoftBlurPx = fallbackDetailMaskUsed ? 0.62 : 0.9
    masked = await sharp(masked)
      .modulate({
        brightness: fallbackDetailMaskUsed ? 0.96 : 0.94,
        saturation: fallbackDetailMaskUsed ? 0.94 : 0.90,
      })
      .blur(fallbackSoftBlurPx)
      .png()
      .toBuffer()
    breakoutOpacity = fallbackDetailMaskUsed
      ? Math.min(0.21, params.opacity ?? 0.24)
      : Math.min(0.17, params.opacity ?? 0.22)
  } else {
    if (BREAKOUT_DEBUG_LOG_ENABLED) {
      console.info('[breakout-debug]', JSON.stringify({
        step: 'renderBreakoutLayer:end',
        breakoutOpacity: 0,
        breakoutDrawCount: 0,
        softBlurApplied: false,
        fallbackBandUsed: false,
        fallbackDetailMaskUsed: false,
        forceAlphaMask: !!subjectRefCanvas,
        suppressedReason: 'no-subject-mask-and-fallback-disabled',
      }))
    }
    return createTransparentCanvas(size).png().toBuffer()
  }
  await writeBreakoutDebugAsset('5-breakout-isolated-sprite.png', masked)
  await debugLogLayerBounds('breakoutSprite', masked)

  if (BREAKOUT_DEBUG_LOG_ENABLED) {
    console.info('[breakout-debug]', JSON.stringify({
      step: 'renderBreakoutLayer:end',
      breakoutOpacity,
      breakoutDrawCount: 1,
      softBlurApplied: !isIllustrationBreakout,
      fallbackBandUsed,
      fallbackDetailMaskUsed,
      forceAlphaMask: !!subjectRefCanvas,
    }))
  }
  return applyOpacity(masked, breakoutOpacity)
}

async function computeRegionLuma(params: {
  image: Buffer
  x: number
  y: number
  width: number
  height: number
}): Promise<number | null> {
  const x0 = Math.max(0, Math.round(params.x))
  const y0 = Math.max(0, Math.round(params.y))
  const width = Math.max(1, Math.round(params.width))
  const height = Math.max(1, Math.round(params.height))
  const meta = await sharp(params.image).metadata()
  const imageWidth = meta.width ?? 0
  const imageHeight = meta.height ?? 0
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const safeX = Math.min(x0, imageWidth - 1)
  const safeY = Math.min(y0, imageHeight - 1)
  const safeWidth = Math.max(1, Math.min(width, imageWidth - safeX))
  const safeHeight = Math.max(1, Math.min(height, imageHeight - safeY))

  const { data, info } = await sharp(params.image)
    .ensureAlpha()
    .extract({
      left: safeX,
      top: safeY,
      width: safeWidth,
      height: safeHeight,
    })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let weightedLuma = 0
  let alphaWeight = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = (data[i + 3] ?? 0) / 255
    if (alpha <= 0) continue
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722
    weightedLuma += luma * alpha
    alphaWeight += alpha
  }

  if (alphaWeight <= 0) return null
  return weightedLuma / alphaWeight
}

async function renderCreatorSignature(params: {
  size: number
  layout: PremiumLayout
  symbol: string
  backgroundLayer?: Buffer
}): Promise<Buffer> {
  const { size, layout, symbol, backgroundLayer } = params
  const MAX_CHARS = 12
  const displayName = symbol.slice(0, MAX_CHARS).toUpperCase()
  const escapedDisplayName = escapeXml(displayName)

  const baseFont = Math.round(size * 0.0118)
  const fontSize = Math.max(
    8,
    displayName.length > 9
      ? Math.round(baseFont * (9 / displayName.length))
      : baseFont,
  )

  const squareSize = Math.round(size * 0.0092)
  const gap = Math.round(size * 0.005)

  const letterSpacingEm = 0.06
  const textWidth = Math.ceil(displayName.length * fontSize * 0.70 + displayName.length * fontSize * letterSpacingEm)
  const lockupWidth = squareSize + gap + textWidth

  // Keep signature lockup comfortably inside the artwork chamber.
  const chamberPadX = Math.max(8, Math.round(layout.chamberSize * 0.048))
  const chamberPadY = Math.max(6, Math.round(layout.chamberSize * 0.042))
  const lockupShiftLeft = Math.max(10, Math.round(layout.chamberSize * 0.068))
  const lockupRightEdge = layout.chamberX + layout.chamberSize - lockupShiftLeft
  const minSquareX = layout.chamberX + chamberPadX
  const squareX = Math.max(minSquareX, lockupRightEdge - lockupWidth)
  const textX = squareX + squareSize + gap

  const bottomBandCenterY = layout.chamberY + layout.chamberSize - chamberPadY
  const squareY = Math.round(bottomBandCenterY - squareSize / 2)

  const squareRx = Math.max(1, Math.round(squareSize * 0.15))
  const letterSpacingPx = Math.round(fontSize * letterSpacingEm)
  let textFill = 'rgba(0,0,0,0.82)'
  let shadowFill = 'rgba(255,255,255,0.24)'
  if (backgroundLayer) {
    const sampleLuma = await computeRegionLuma({
      image: backgroundLayer,
      x: squareX - Math.max(1, gap),
      y: squareY - Math.max(1, Math.round(fontSize * 0.45)),
      width: lockupWidth + Math.max(2, gap * 2),
      height: Math.max(squareSize, Math.round(fontSize * 1.65)),
    })
    if (sampleLuma !== null && sampleLuma < 118) {
      textFill = 'rgba(255,255,255,0.95)'
      shadowFill = 'rgba(0,0,0,0.48)'
    }
  }
  const shadowDy = Math.max(1, Math.round(fontSize * 0.08))

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${squareX}" y="${squareY}" width="${squareSize}" height="${squareSize}" rx="${squareRx}" fill="#2F7DFF"/>
  <text x="${textX}" y="${bottomBandCenterY + shadowDy}"
    dominant-baseline="central"
    text-anchor="start"
    font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    fill="${shadowFill}"
    letter-spacing="${letterSpacingPx}">${escapedDisplayName}</text>
  <text x="${textX}" y="${bottomBandCenterY}"
    dominant-baseline="central"
    text-anchor="start"
    font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    fill="${textFill}"
    letter-spacing="${letterSpacingPx}">${escapedDisplayName}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

function buildCompositeStep(input: Buffer, blend: BlendMode): sharp.OverlayOptions {
  return { input, blend }
}

export async function renderPremiumTokenIcon(params: PremiumTokenIconParams): Promise<Buffer> {
  const size = sanitizeSize(params.size)
  if (BREAKOUT_RUNTIME_LOG_ENABLED) {
    await logBreakoutRuntimeBannerOnce()
  }

  let normalizedSource: Buffer | null = null
  let analysis: SourceAnalysis | null = null
  let breakoutModeForLog: 'none' | 'heroCutout' | 'sourceAlpha' | 'rembgCutout' | 'fallbackBand' = 'none'
  let breakoutDecisionReason = 'no-source'
  let sourceAlphaBreakoutAllowedForLog = false
  let breakoutDesiredForLog = false
  let rembgCandidateForLog = false
  let segmentationModelForLog: SegmentationModel | null = null
  let segmentationExecutableForLog: string | null = null
  let segmentationCoverageForLog: number | null = null
  let segmentationAlignmentDeltaForLog: number | null = null
  let segmentationMaskTopYForLog: number | null = null
  let segmentationTargetTopYForLog: number | null = null
  let segmentationFailureReasonForLog: string | null = null
  let segmentationAppliedForLog = false
  if (params.sourceImage && params.sourceImage.length > 0) {
    try {
      normalizedSource = await normalizeSourceImage(params.sourceImage)
      await writeBreakoutDebugAsset('0-original-source-art.png', normalizedSource)
      analysis = await analyzeSourceImage({
        sourceImage: normalizedSource,
        size,
      })
    } catch (error) {
      console.warn('[token/image] premium renderer source decode failed; using symbol fallback:', error)
      normalizedSource = null
      analysis = null
    }
  }

  const resolvedPreset = resolveRenderPreset(params.renderPreset, analysis?.sourceClass)
  const layout = getTokenIconLayout(size, resolvedPreset)

  const backgroundCard = await renderBackgroundCard({ size, layout })
  const outerGlow = await renderOuterGlow({ size, layout })
  const frameBloom = await renderFrameBloom({ size, layout })
  const premiumFrame = await renderPremiumFrame({ size, layout })

  let artworkLayer: Buffer
  let stackedUnderlay: StackedArtworkUnderlay = { rearLayerB: null, rearLayerA: null }
  let breakoutLayer: Buffer | null = null
  let sourceClassForHero: SourceClass = 'generic'

  if (normalizedSource && analysis) {
    sourceClassForHero = analysis.sourceClass
    const hasHeroCutoutSource = !!params.heroCutoutSourceImage && params.heroCutoutSourceImage.length > 0
    const breakoutAllowedByPreparedHeroCutout =
      hasHeroCutoutSource &&
      analysis.fitMode === 'cover' &&
      !analysis.brightBadgeLike
    const sourceAlphaBreakoutAllowed = resolveSourceAlphaBreakoutAllowed({
      allowBreakout: analysis.allowBreakout,
      suppressBreakout: params.suppressBreakout,
    })
    sourceAlphaBreakoutAllowedForLog = sourceAlphaBreakoutAllowed
    const breakoutSourceKind = resolveBreakoutSourceKind({
      sourceAlphaBreakoutAllowed,
      preparedHeroCutoutAvailable: hasHeroCutoutSource,
      preparedHeroCutoutBreakoutAllowed: breakoutAllowedByPreparedHeroCutout,
    })
    const rembgProbe = await probeRembgRuntime()
    const breakoutPlan = decideBreakoutPlan({
      analysis,
      suppressBreakout: params.suppressBreakout,
      breakoutSourceKind,
      rembgAvailable: rembgProbe.available && PREMIUM_SEGMENTATION_ENABLED,
    })
    rembgCandidateForLog = breakoutPlan.rembgCandidate
    breakoutDesiredForLog = breakoutPlan.breakoutRequested
    breakoutDecisionReason = `plan:${breakoutPlan.reason}`
    const allowBreakoutForLayout =
      breakoutPlan.mode !== 'none' ||
      (ALLOW_PREMIUM_FALLBACK_BAND && breakoutPlan.breakoutRequested)
    const presetScaleBoost =
      resolvedPreset === 'hero' ? (analysis.sourceClass === 'illustration' ? 1.038 : 1.024)
      : resolvedPreset === 'pixel' ? 0.994
      : 1
    const renderScale = clamp(analysis.preferredScale * presetScaleBoost, 0.79, 1.12)
    let topBiasPx =
      analysis.fitMode === 'cover' && analysis.sourceClass === 'portraitPhoto'
        ? Math.max(1, Math.round(layout.chamberSize * (allowBreakoutForLayout ? 0.024 : 0.018)))
        : analysis.fitMode === 'cover' && allowBreakoutForLayout && analysis.sourceClass === 'illustration'
          ? Math.max(1, Math.round(layout.chamberSize * (resolvedPreset === 'hero' ? 0.016 : 0.009)))
          : 0
    let rembgSegmentation: SegmentationExtraction | null = null
    let rembgCoverage = 0
    let rembgCoveragePass = false
    if (breakoutPlan.mode === 'rembgCutout') {
      rembgSegmentation = await extractForegroundRembg({
        pngBytes: normalizedSource,
        sourceClass: analysis.sourceClass,
      })
      if (rembgSegmentation) {
        const alignment = await computeAlignedTopBiasPx({
          layout,
          baseTopBiasPx: topBiasPx,
          scale: renderScale,
          fit: analysis.fitMode,
          sourceClass: analysis.sourceClass,
          maskRgbaPng: rembgSegmentation.maskPngRgba,
        })
        topBiasPx = alignment.topBiasPx
        segmentationModelForLog = rembgSegmentation.model
        segmentationExecutableForLog = rembgSegmentation.executable
        segmentationAlignmentDeltaForLog = alignment.deltaPx
        segmentationMaskTopYForLog = alignment.maskTopY
        segmentationTargetTopYForLog = alignment.targetTopY
        segmentationAppliedForLog = alignment.maskTopY !== null
        await writeBreakoutDebugAsset('0-rembg-mask-rgba.png', rembgSegmentation.maskPngRgba)
        await writeBreakoutDebugAsset('0-rembg-cutout.png', rembgSegmentation.cutoutPng)
      } else {
        segmentationFailureReasonForLog = 'segmentation-unavailable'
      }
    }
    stackedUnderlay = await renderStackedArtworkUnderlay({
      size,
      layout,
      sourceImage: normalizedSource,
      scale: renderScale,
      fit: analysis.fitMode,
      sourceClass: analysis.sourceClass,
      hasTransparency: analysis.hasTransparency,
      topBiasPx,
    })
    artworkLayer = await renderArtworkLayer({
      size,
      layout,
      sourceImage: new Uint8Array(normalizedSource),
      scale: renderScale,
      fit: analysis.fitMode,
      tone: analysis.artworkTone,
      sourceClass: analysis.sourceClass,
      topBiasPx,
      symbol: params.symbol,
    })
    await writeBreakoutDebugAsset('1-clipped-in-frame-art.png', artworkLayer)

    if (allowBreakoutForLayout) {
      const breakoutOpacity =
        analysis.sourceClass === 'illustration'
          ? (resolvedPreset === 'hero' ? 0.98 : 0.92)
          : analysis.sourceClass === 'portraitPhoto'
            ? 0.34
            : 0.22
      const breakoutTopBiasPx = analysis.sourceClass === 'illustration'
        ? Math.max(1, Math.round(layout.chamberSize * (resolvedPreset === 'hero' ? 0.016 : 0.033)))
        : topBiasPx
      const breakoutScale = clamp(
        renderScale * (analysis.sourceClass === 'illustration' && resolvedPreset === 'hero' ? 1.03 : 1),
        0.84,
        1.16,
      )
      if (breakoutPlan.mode === 'rembgCutout' && rembgSegmentation?.maskPngRgba) {
        rembgCoverage = await measureBreakoutMaskCoverage({
          layout,
          scale: breakoutScale,
          topBiasPx: breakoutTopBiasPx,
          sourceClass: analysis.sourceClass,
          maskRgbaPng: rembgSegmentation.maskPngRgba,
        })
        rembgCoveragePass = isSegmentationBreakoutCoverageAcceptable(rembgCoverage)
        segmentationCoverageForLog = rembgCoverage
        if (!rembgCoveragePass && rembgCoverage < PREMIUM_BREAKOUT_MASK_MIN_COVERAGE) {
          segmentationFailureReasonForLog = `segmentation-coverage-below-threshold:${rembgCoverage.toFixed(4)}`
        } else if (!rembgCoveragePass && rembgCoverage > PREMIUM_BREAKOUT_MASK_MAX_COVERAGE) {
          segmentationFailureReasonForLog = `segmentation-coverage-above-threshold:${rembgCoverage.toFixed(4)}`
        }
      }
      let subjectMaskSourceImage: Uint8Array | undefined
      let breakoutPlanSource: 'heroCutout' | 'sourceAlpha' | 'rembgCutout' | 'fallbackBand' | 'none' =
        breakoutPlan.mode === 'none' ? 'none' : breakoutPlan.mode
      let allowFallbackBand = false
      let shouldRenderBreakout = false
      if (breakoutPlan.mode === 'heroCutout') {
        subjectMaskSourceImage = new Uint8Array(params.heroCutoutSourceImage!)
        breakoutPlanSource = 'heroCutout'
        shouldRenderBreakout = true
      } else if (breakoutPlan.mode === 'sourceAlpha') {
        breakoutPlanSource = 'sourceAlpha'
        shouldRenderBreakout = true
      } else if (breakoutPlan.mode === 'rembgCutout') {
        if (rembgSegmentation?.cutoutPng && rembgCoveragePass) {
          subjectMaskSourceImage = new Uint8Array(rembgSegmentation.cutoutPng)
          breakoutPlanSource = 'rembgCutout'
          shouldRenderBreakout = true
        } else if (ALLOW_PREMIUM_FALLBACK_BAND) {
          allowFallbackBand = true
          breakoutPlanSource = 'fallbackBand'
          shouldRenderBreakout = true
        } else if (!segmentationFailureReasonForLog) {
          segmentationFailureReasonForLog = 'segmentation-unavailable'
        }
      } else if (ALLOW_PREMIUM_FALLBACK_BAND && breakoutPlan.breakoutRequested) {
        allowFallbackBand = true
        breakoutPlanSource = 'fallbackBand'
        shouldRenderBreakout = true
      }
      breakoutModeForLog = shouldRenderBreakout ? breakoutPlanSource : 'none'
      breakoutDecisionReason = shouldRenderBreakout
        ? `mode:${breakoutPlanSource}`
        : (
            breakoutPlan.mode === 'rembgCutout' && segmentationFailureReasonForLog
              ? segmentationFailureReasonForLog
              : `plan:${breakoutPlan.reason}`
          )
      if (shouldRenderBreakout) {
        try {
          breakoutLayer = await renderBreakoutLayer({
            size,
            layout,
            sourceImage: new Uint8Array(normalizedSource),
            subjectMaskSourceImage,
            subjectMaskKind: breakoutPlanSource === 'heroCutout' || breakoutPlanSource === 'sourceAlpha' || breakoutPlanSource === 'rembgCutout'
              ? breakoutPlanSource
              : undefined,
            allowFallbackBand,
            opacity: breakoutOpacity,
            scale: breakoutScale,
            topBiasPx: breakoutTopBiasPx,
            sourceClass: analysis.sourceClass,
          })
        } catch (breakoutError) {
          breakoutLayer = null
          breakoutModeForLog = 'none'
          breakoutDecisionReason = 'breakout-layer-render-error'
          console.warn('[token/image] premium breakout render failed; rendering contained icon:', {
            sourceKind: breakoutSourceKind,
            message: breakoutError instanceof Error ? breakoutError.message : String(breakoutError ?? ''),
          })
        }
      } else {
        breakoutLayer = null
      }
      if (BREAKOUT_DEBUG_LOG_ENABLED) {
        console.info('[breakout-debug]', JSON.stringify({
          step: 'renderPremiumTokenIcon:breakout-layer',
          preset: resolvedPreset,
          sourceClass: analysis.sourceClass,
          breakoutOpacity,
          breakoutTopBiasPx,
          breakoutScale,
          breakoutAllowed: allowBreakoutForLayout,
          breakoutSource: breakoutSourceKind,
          breakoutPlanSource,
          breakoutPlanReason: breakoutPlan.reason,
          breakoutPlanMode: breakoutPlan.mode,
          rembgCandidate: breakoutPlan.rembgCandidate,
          rembgAvailable: rembgProbe.available,
          segmentationEnabled: PREMIUM_SEGMENTATION_ENABLED,
          segmentationModel: rembgSegmentation?.model ?? null,
          segmentationCoverage: rembgCoverage,
          segmentationCoverageMinThreshold: PREMIUM_BREAKOUT_MASK_MIN_COVERAGE,
          segmentationCoverageMaxThreshold: PREMIUM_BREAKOUT_MASK_MAX_COVERAGE,
          segmentationCoveragePass: rembgCoveragePass,
          segmentationAlignmentDeltaPx: segmentationAlignmentDeltaForLog,
          segmentationMaskTopY: segmentationMaskTopYForLog,
          segmentationTargetTopY: segmentationTargetTopYForLog,
          segmentationFailureReason: segmentationFailureReasonForLog,
          allowFallbackBand,
          shouldRenderBreakout,
          sourceAlphaBreakoutAllowed,
          breakoutAllowedByPreparedHeroCutout,
        }))
      }
    }
  } else {
    breakoutDecisionReason = 'symbol-fallback'
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
    const signature = await renderCreatorSignature({
      size,
      layout,
      symbol: params.symbol,
      backgroundLayer: heroCompositeLayer,
    })
    overlays.push(buildCompositeStep(signature, 'over'))
  }

  if (BREAKOUT_DEBUG_LOG_ENABLED) {
    console.info('[breakout-debug]', JSON.stringify({
      step: 'renderPremiumTokenIcon:composite',
      breakoutDrawCount: breakoutLayer ? 1 : 0,
      preset: resolvedPreset,
      layerOrder: [
        'backgroundCard',
        'outerGlow',
        'frameBloom',
        'rearLayerB',
        'rearLayerA',
        'heroCompositeLayer',
        'premiumFrame',
        'breakoutLayer',
        'signature',
      ],
    }))
  }

  const finalOutput = await sharp(backgroundCard)
    .composite(overlays)
    .flatten({ background: '#000000' })
    .png()
    .toBuffer()
  await writeBreakoutDebugAsset('6-final-composited-output.png', finalOutput)
  if (BREAKOUT_RUNTIME_LOG_ENABLED) {
    const rembg = await probeRembgRuntime()
    console.info('[token/image] premium breakout mode', JSON.stringify({
      mode: breakoutModeForLog,
      reason: breakoutDecisionReason,
      breakoutDrawn: Boolean(breakoutLayer),
      fallbackBandEnabled: ALLOW_PREMIUM_FALLBACK_BAND,
      suppressBreakout: Boolean(params.suppressBreakout),
      sourceClass: analysis?.sourceClass ?? null,
      fitMode: analysis?.fitMode ?? null,
      lowResolution: analysis?.lowResolution ?? null,
      hasTransparency: analysis?.hasTransparency ?? null,
      sourceAlphaBreakoutAllowed: sourceAlphaBreakoutAllowedForLog,
      rembgCandidate: rembgCandidateForLog,
      topCenterStdDev: analysis?.topCenterStdDev ?? null,
      topOccupancy: analysis?.topOccupancy ?? null,
      breakoutDesired: breakoutDesiredForLog,
      hasHeroCutoutSource: Boolean(params.heroCutoutSourceImage && params.heroCutoutSourceImage.length > 0),
      segmentationEnabled: PREMIUM_SEGMENTATION_ENABLED,
      segmentationApplied: segmentationAppliedForLog,
      segmentationModel: segmentationModelForLog,
      segmentationExecutable: segmentationExecutableForLog,
      segmentationCoverage: segmentationCoverageForLog,
      segmentationCoverageMinThreshold: PREMIUM_BREAKOUT_MASK_MIN_COVERAGE,
      segmentationCoverageMaxThreshold: PREMIUM_BREAKOUT_MASK_MAX_COVERAGE,
      segmentationAlignmentDeltaPx: segmentationAlignmentDeltaForLog,
      segmentationMaskTopY: segmentationMaskTopYForLog,
      segmentationTargetTopY: segmentationTargetTopYForLog,
      segmentationFailureReason: segmentationFailureReasonForLog,
      rembgAvailable: rembg.available,
      rembgExecutable: rembg.executable,
      preset: resolvedPreset,
      size,
    }))
  }
  return finalOutput
}

export const __testables = {
  getTokenIconLayout,
  resolveBreakoutSourceKind,
  resolveSourceAlphaBreakoutAllowed,
  decideBreakoutPlan,
  isSegmentationBreakoutCoverageAcceptable,
  computeAlignedTopBiasPx,
  measureBreakoutMaskCoverage,
}

