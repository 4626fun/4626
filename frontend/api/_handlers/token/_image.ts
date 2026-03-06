import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import { base } from 'viem/chains'

import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  requireServerKey,
  setCors,
} from '../../../server/zora/_shared.js'

import { blobHeadOrNull, blobPutBytes, fetchBytes, sha256Hex } from '../../../server/_lib/blob.js'

declare const process: { env: Record<string, string | undefined> }

// ABI fragments
const SHARE_OFT_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_ABI = [
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

/**
 * Token Image Generator API
 * 
 * Generates the canonical premium 4626 token icon by centering the real
 * creator coin artwork inside a single branded inner frame.
 * 
 * Query params:
 *   - address: ShareOFT token address (required)
 *   - chain: Chain ID (default: 8453 for Base)
 *   - size: Image size in pixels (default: 512, max: 1024)
 *   - format: png | svg (default: png)
 * 
 * Response: PNG by default (wallet-friendly), or SVG with `?format=svg`
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = getStringQuery(req, 'address')
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: 'Invalid token address' })
  }

  const chainId = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID
  const size = Math.min(Math.max(getNumberQuery(req, 'size') ?? 512, 64), 1024)
  const formatRaw = (getStringQuery(req, 'format') ?? '').trim().toLowerCase()
  const format: 'png' | 'svg' = formatRaw === 'svg' ? 'svg' : 'png'

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    })

    // Get symbol and vault
    const [symbol, vault] = await Promise.all([
      client.readContract({ address: address as Address, abi: SHARE_OFT_ABI, functionName: 'symbol' }).catch(() => '■TOKEN'),
      client.readContract({ address: address as Address, abi: SHARE_OFT_ABI, functionName: 'vault' }).catch(() => null),
    ])

    // Get underlying creator coin
    let creatorCoin: Address | null = null
    if (vault && isAddress(vault as string)) {
      try {
        creatorCoin = await client.readContract({
          address: vault as Address,
          abi: VAULT_ABI,
          functionName: 'asset',
        }) as Address
      } catch {
        // Vault might not exist
      }
    }

    // Fetch creator coin image from Zora
    let creatorCoinImage: string | null = null
    const zoraKey = requireServerKey()
    if (zoraKey && creatorCoin && isAddress(creatorCoin)) {
      try {
        const sdk: any = await import('@zoralabs/coins-sdk')
        sdk.setApiKey(zoraKey)
        const coinResponse = await sdk.getCoin({
          address: creatorCoin,
          chain: chainId,
        })
        const coinData = coinResponse.data?.zora20Token
        if (coinData) {
          creatorCoinImage = coinData.mediaContent?.previewImage?.medium 
            || coinData.mediaContent?.previewImage?.small
            || coinData.mediaContent?.originalUri
            || null
        }
      } catch (e) {
        console.warn('[token/image] Failed to fetch Zora coin image:', e)
      }
    }

    // SVG stays self-contained so wallets and crawlers see the same premium composition.
    if (format === 'svg') {
      const sourceBytes = await fetchSourceArtworkBytes({ upstreamUrl: creatorCoinImage })
      const prepared = await prepareArtworkLayers({
        size,
        bytes: sourceBytes,
      })
      const frameOverlayImage = await getFrameOverlayAssetDataUri()
      const svg = generateFramedSvg({
        size,
        symbol: String(symbol),
        baseLayerImage:
          prepared.baseLayerBytes && prepared.baseLayerBytes.length > 0
            ? `data:image/png;base64,${Buffer.from(prepared.baseLayerBytes).toString('base64')}`
            : null,
        breakoutLayerImage:
          prepared.breakoutLayerBytes && prepared.breakoutLayerBytes.length > 0
            ? `data:image/png;base64,${Buffer.from(prepared.breakoutLayerBytes).toString('base64')}`
            : null,
        frameOverlayImage,
        recipe: prepared.recipe,
      })

      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800')
      res.setHeader('Content-Type', 'image/svg+xml')
      return res.status(200).send(svg)
    }

    // PNG default: generate/serve a cached raster (durable via Vercel Blob).
    const png = await getOrCreatePng({
      chainId,
      shareOft: address as Address,
      creatorCoin,
      upstreamUrl: creatorCoinImage,
      size,
      symbol: String(symbol),
    })

    // Cache for 24 hours at the edge; the underlying blob is content-addressed via cache keys.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800')
    res.setHeader('Content-Type', 'image/png')
    return res.status(200).send(Buffer.from(png))
  } catch (e: any) {
    console.error('[token/image] Error:', e)
    return res.status(500).json({ error: e?.message || 'Failed to generate token image' })
  }
}

type LayoutMode = 'cover' | 'contain' | 'coin'
type ArtworkFitMode = 'cover' | 'contain'

type TokenImageMetrics = {
  aspectRatio: number
  hasTransparency: boolean
  alphaCoverage: number
  edgeOccupancy: number
  circularBadgeLikelihood: number
  opaquePhotoLikelihood: number
  topOccupancy: number
}

type TokenImageClassification = {
  layoutMode: LayoutMode
  allowBreakout: boolean
}

type TokenIconRecipe = {
  mode: LayoutMode
  scale: number
  innerPadding: number
  breakout: boolean
  breakoutTopRatio?: number
}

type BreakoutEvaluation = {
  size: number
  hasUsableBreakoutMask: boolean
  breakoutCoverage: number
}

type PreparedArtworkLayers = {
  recipe: TokenIconRecipe
  baseLayerBytes: Uint8Array | null
  breakoutLayerBytes: Uint8Array | null
}

type TokenIconLayout = {
  outerRadius: number
  panelX: number
  panelY: number
  panelSize: number
  panelRadius: number
  artX: number
  artY: number
  artSize: number
  frameStrokeWidth: number
  panelPadding: number
}

interface FramedSvgParams {
  size: number
  symbol: string
  creatorCoinImage?: string | null
  baseLayerImage?: string | null
  breakoutLayerImage?: string | null
  frameOverlayImage?: string
  recipe?: TokenIconRecipe
}

const SOURCE_CACHE_V = 4
const FRAME_STYLE_V = 5
const FRAME_ASSET_URL = new URL('../../../public/miniapp-icon.svg', import.meta.url)
const FRAME_VIEWBOX_SIZE = 256
const FRAME_INSET_RATIO = 36 / FRAME_VIEWBOX_SIZE
const FRAME_RADIUS_RATIO = 30 / 184
const FRAME_STROKE_RATIO = 12 / FRAME_VIEWBOX_SIZE

const TOKEN_ICON_STYLE = {
  backgroundInner: '#09111d',
  backgroundOuter: '#02040a',
  panelFillTop: '#0d1523',
  panelFillBottom: '#08111c',
  panelScrim: 'rgba(2, 6, 23, 0.08)',
  glowColor: '#2563eb',
  outerRadiusRatio: 0.22,
  panelInsetRatio: FRAME_INSET_RATIO,
  panelRadiusRatio: FRAME_RADIUS_RATIO,
  frameThicknessRatio: FRAME_STROKE_RATIO,
  vignetteOpacity: 0.3,
  glowOpacity: 0.78,
} as const

const TOKEN_ICON_RECIPES: Record<LayoutMode, Omit<TokenIconRecipe, 'breakout'>> = {
  cover: { mode: 'cover', scale: 1.28, innerPadding: 0.005, breakoutTopRatio: 0.50 },
  contain: { mode: 'contain', scale: 0.96, innerPadding: 0.08, breakoutTopRatio: 0.4 },
  coin: { mode: 'coin', scale: 0.82, innerPadding: 0.14, breakoutTopRatio: 0.36 },
}

let frameOverlayAssetPromise: Promise<string> | null = null

function getDefaultRecipe(): TokenIconRecipe {
  return { ...TOKEN_ICON_RECIPES.contain, breakout: false }
}

function getTokenIconLayout(
  size: number,
  recipe: TokenIconRecipe = { ...TOKEN_ICON_RECIPES.cover, breakout: false },
): TokenIconLayout {
  const outerRadius = Math.round(size * TOKEN_ICON_STYLE.outerRadiusRatio)
  const panelX = Math.round(size * TOKEN_ICON_STYLE.panelInsetRatio)
  const panelY = panelX
  const panelSize = size - panelX * 2
  const panelRadius = Math.round(panelSize * TOKEN_ICON_STYLE.panelRadiusRatio)
  const panelPadding = Math.round(panelSize * recipe.innerPadding)
  const safeArtSize = panelSize - panelPadding * 2
  const artSize = Math.max(1, Math.round(safeArtSize * recipe.scale))
  const artX = Math.round((size - artSize) / 2)
  const artY = Math.round((size - artSize) / 2)
  const frameStrokeWidth = Math.max(2, Math.round(size * TOKEN_ICON_STYLE.frameThicknessRatio))
  return { outerRadius, panelX, panelY, panelSize, panelRadius, artX, artY, artSize, frameStrokeWidth, panelPadding }
}

function chooseArtworkFitMode(width: number | undefined, height: number | undefined): ArtworkFitMode {
  if (!width || !height) return 'contain'
  const aspectRatio = width / height
  return aspectRatio >= 0.72 && aspectRatio <= 1.28 ? 'cover' : 'contain'
}

function classifyTokenImageMetrics(metrics: Omit<TokenImageMetrics, 'topOccupancy'> & { topOccupancy?: number }): TokenImageClassification {
  const normalized: TokenImageMetrics = {
    ...metrics,
    topOccupancy: metrics.topOccupancy ?? 0,
  }

  if (normalized.circularBadgeLikelihood >= 0.75) {
    return { layoutMode: 'coin', allowBreakout: false }
  }

  if (normalized.hasTransparency && normalized.alphaCoverage < 0.9) {
    return { layoutMode: 'contain', allowBreakout: false }
  }

  if (!normalized.hasTransparency || normalized.opaquePhotoLikelihood >= 0.55 || normalized.edgeOccupancy >= 0.45) {
    return { layoutMode: 'cover', allowBreakout: true }
  }

  return { layoutMode: 'contain', allowBreakout: false }
}

function deriveTokenIconRecipe(
  classification: TokenImageClassification,
  breakoutEvaluation: BreakoutEvaluation,
): TokenIconRecipe {
  const base = TOKEN_ICON_RECIPES[classification.layoutMode]
  const breakout =
    classification.layoutMode === 'cover' &&
    classification.allowBreakout &&
    breakoutEvaluation.hasUsableBreakoutMask &&
    breakoutEvaluation.breakoutCoverage >= 0.05

  return {
    ...base,
    breakout,
  }
}

async function getFrameOverlayAssetDataUri(): Promise<string> {
  frameOverlayAssetPromise ??= readFile(FRAME_ASSET_URL, 'utf8').then((svg) => {
    const stripped = svg
      .replace(/<rect[^>]*width="256"[^>]*height="256"[^>]*fill="#000000"[^>]*\/>\s*/i, '')
      .trim()
    return `data:image/svg+xml;base64,${Buffer.from(stripped).toString('base64')}`
  })
  return frameOverlayAssetPromise
}

async function analyzeTokenImageBytes(bytes: Uint8Array): Promise<TokenImageMetrics> {
  const sampleSize = 64
  const sampleBuffer = await sharp(Buffer.from(bytes))
    .rotate()
    .ensureAlpha()
    .resize(sampleSize, sampleSize, { fit: 'inside', withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: false })
  const meta = await sharp(Buffer.from(bytes)).metadata()

  let visibleCount = 0
  let borderCount = 0
  let borderVisibleCount = 0
  let topBandVisibleCount = 0
  let topBandCount = 0
  let centerVisibleCount = 0
  let centerCount = 0
  let cornerVisibleCount = 0
  let cornerCount = 0

  const borderThickness = Math.max(1, Math.floor(sampleSize * 0.1))
  const topBandHeight = Math.max(1, Math.floor(sampleSize * 0.35))
  const centerStart = Math.floor(sampleSize * 0.25)
  const centerEnd = Math.ceil(sampleSize * 0.75)
  const cornerSize = Math.max(1, Math.floor(sampleSize * 0.18))

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const alpha = sampleBuffer[(y * sampleSize + x) * 4 + 3] / 255
      const visible = alpha > 0.08
      if (visible) visibleCount += 1

      const inBorder =
        x < borderThickness ||
        y < borderThickness ||
        x >= sampleSize - borderThickness ||
        y >= sampleSize - borderThickness
      if (inBorder) {
        borderCount += 1
        if (visible) borderVisibleCount += 1
      }

      if (y < topBandHeight) {
        topBandCount += 1
        if (visible) topBandVisibleCount += 1
      }

      const inCenter = x >= centerStart && x < centerEnd && y >= centerStart && y < centerEnd
      if (inCenter) {
        centerCount += 1
        if (visible) centerVisibleCount += 1
      }

      const inCorner =
        (x < cornerSize && y < cornerSize) ||
        (x >= sampleSize - cornerSize && y < cornerSize) ||
        (x < cornerSize && y >= sampleSize - cornerSize) ||
        (x >= sampleSize - cornerSize && y >= sampleSize - cornerSize)
      if (inCorner) {
        cornerCount += 1
        if (visible) cornerVisibleCount += 1
      }
    }
  }

  const alphaCoverage = visibleCount / (sampleSize * sampleSize)
  const hasTransparency = alphaCoverage < 0.98
  const edgeOccupancy = borderCount > 0 ? borderVisibleCount / borderCount : 0
  const topOccupancy = topBandCount > 0 ? topBandVisibleCount / topBandCount : 0
  const centerOccupancy = centerCount > 0 ? centerVisibleCount / centerCount : 0
  const cornerOccupancy = cornerCount > 0 ? cornerVisibleCount / cornerCount : 0
  const aspectRatio = meta.width && meta.height ? meta.width / meta.height : 1

  const circularBadgeLikelihood =
    Math.max(0, Math.min(1,
      (Math.abs(1 - aspectRatio) <= 0.16 ? 0.3 : 0) +
      (hasTransparency ? 0.15 : 0) +
      (cornerOccupancy < 0.18 ? 0.3 : 0) +
      (centerOccupancy > 0.72 ? 0.25 : 0)
    ))

  const opaquePhotoLikelihood =
    Math.max(0, Math.min(1,
      (!hasTransparency ? 0.45 : 0) +
      (edgeOccupancy > 0.58 ? 0.3 : 0) +
      (alphaCoverage > 0.96 ? 0.25 : 0)
    ))

  return {
    aspectRatio,
    hasTransparency,
    alphaCoverage,
    edgeOccupancy,
    circularBadgeLikelihood,
    opaquePhotoLikelihood,
    topOccupancy,
  }
}

async function prepareArtworkLayers(params: { size: number; bytes: Uint8Array | null }): Promise<PreparedArtworkLayers> {
  if (!params.bytes || params.bytes.length === 0) {
    return {
      recipe: getDefaultRecipe(),
      baseLayerBytes: null,
      breakoutLayerBytes: null,
    }
  }

  const metrics = await analyzeTokenImageBytes(params.bytes)
  const classification = classifyTokenImageMetrics(metrics)
  const breakoutEvaluation: BreakoutEvaluation = {
    size: params.size,
    hasUsableBreakoutMask:
      classification.allowBreakout &&
      metrics.topOccupancy > 0.05 &&
      (metrics.hasTransparency || metrics.opaquePhotoLikelihood >= 0.55),
    breakoutCoverage: metrics.topOccupancy,
  }
  const recipe = deriveTokenIconRecipe(classification, breakoutEvaluation)
  const layout = getTokenIconLayout(params.size, recipe)
  const fit: ArtworkFitMode = recipe.mode === 'cover' ? 'cover' : 'contain'

  const baseLayerBytes = await renderArtworkLayer({
    bytes: params.bytes,
    size: params.size,
    targetSize: layout.artSize,
    x: layout.artX,
    y: layout.artY,
    fit,
  })

  return { recipe, baseLayerBytes, breakoutLayerBytes: null }
}

async function renderArtworkLayer(params: {
  bytes: Uint8Array
  size: number
  targetSize: number
  x: number
  y: number
  fit: ArtworkFitMode
}): Promise<Uint8Array> {
  const artBuffer = await sharp(Buffer.from(params.bytes))
    .rotate()
    .resize(params.targetSize, params.targetSize, {
      fit: params.fit,
      position: params.fit === 'cover' ? sharp.strategy.attention : 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const composed = await sharp({
    create: {
      width: params.size,
      height: params.size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: artBuffer, left: params.x, top: params.y }])
    .png()
    .toBuffer()

  return new Uint8Array(composed)
}

async function fetchSourceArtworkBytes(params: {
  upstreamUrl: string | null
}): Promise<Uint8Array | null> {
  const url = typeof params.upstreamUrl === 'string' ? params.upstreamUrl.trim() : ''
  if (!url) return null
  const fetched = await fetchBytes(url)
  return fetched.bytes
}

async function getOrCreatePng(params: {
  chainId: number
  shareOft: Address
  creatorCoin: Address | null
  upstreamUrl: string | null
  size: number
  symbol: string
}): Promise<Uint8Array> {
  const shareOftLc = params.shareOft.toLowerCase()
  const url = typeof params.upstreamUrl === 'string' ? params.upstreamUrl.trim() : ''
  const creatorCoinLc = params.creatorCoin ? params.creatorCoin.toLowerCase() : null
  const urlHash = url ? sha256Hex(url) : 'no-upstream'
  const recipeSeed = `${creatorCoinLc ?? 'no-coin'}:${urlHash}:${FRAME_STYLE_V}:${params.size}`

  const tokenKey = `token-images/v1/base/${params.chainId}/${shareOftLc}/size-${params.size}/frame-${FRAME_STYLE_V}/${sha256Hex(
    recipeSeed,
  )}.png`
  const cachedToken = await blobHeadOrNull(tokenKey)
  if (cachedToken?.url) {
    const { bytes } = await fetchBytes(cachedToken.url)
    return bytes
  }

  const sourceBytes = await fetchSourceArtworkBytes({ upstreamUrl: params.upstreamUrl })
  const prepared = await prepareArtworkLayers({
    size: params.size,
    bytes: sourceBytes,
  })
  const frameOverlayImage = await getFrameOverlayAssetDataUri()
  const svg = generateFramedSvg({
    size: params.size,
    symbol: params.symbol,
    baseLayerImage:
      prepared.baseLayerBytes && prepared.baseLayerBytes.length > 0
        ? `data:image/png;base64,${Buffer.from(prepared.baseLayerBytes).toString('base64')}`
        : null,
    breakoutLayerImage:
      prepared.breakoutLayerBytes && prepared.breakoutLayerBytes.length > 0
        ? `data:image/png;base64,${Buffer.from(prepared.breakoutLayerBytes).toString('base64')}`
        : null,
    frameOverlayImage,
    recipe: prepared.recipe,
  })
  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer()
  const pngBytes = new Uint8Array(pngBuf)

  try {
    await blobPutBytes({ pathname: tokenKey, bytes: pngBytes, contentType: 'image/png', cacheControlMaxAgeSeconds: 31_536_000 })
  } catch {
    // ignore
  }

  return pngBytes
}

/**
 * Generate the canonical branded ERC-20 / ERC-4626 token icon SVG.
 */
function generateFramedSvg({
  size,
  symbol,
  creatorCoinImage,
  baseLayerImage,
  breakoutLayerImage,
  frameOverlayImage,
  recipe = getDefaultRecipe(),
}: FramedSvgParams): string {
  const resolvedBaseLayerImage = baseLayerImage ?? creatorCoinImage ?? null
  const resolvedFrameOverlay = frameOverlayImage ?? ''
  const layout = getTokenIconLayout(size, recipe)
  const glowInset = Math.round(layout.panelX * 0.42)
  const glowBoxSize = size - glowInset * 2
  const glowRadius = Math.round(layout.panelRadius + layout.frameStrokeWidth * 0.9)
  const breakoutHeight = Math.round(layout.panelSize * (recipe.breakoutTopRatio ?? 0.4))
  const breakoutOverflow = Math.round(layout.frameStrokeWidth * 2.4)

  const safeSymbol = symbol
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const imagePreserveAspect = baseLayerImage ? 'none' : 'xMidYMid meet'

  const imageElement = resolvedBaseLayerImage
    ? `<image
        href="${resolvedBaseLayerImage}"
        x="0"
        y="0"
        width="${size}"
        height="${size}"
        preserveAspectRatio="${imagePreserveAspect}"
        clip-path="url(#innerPanelClip)"
      />`
    : `<rect x="${layout.artX}" y="${layout.artY}" width="${layout.artSize}" height="${layout.artSize}" rx="${Math.round(layout.panelRadius * 0.7)}" fill="url(#panel-fill)" />
      <text
        x="${size / 2}"
        y="${size / 2}"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${Math.round(layout.artSize * 0.24)}"
        font-weight="700"
        fill="#dbeafe"
        opacity="0.9"
      >■</text>`

  const breakoutElement =
    recipe.breakout && resolvedBaseLayerImage
      ? `<image
          href="${resolvedBaseLayerImage}"
          x="0"
          y="0"
          width="${size}"
          height="${size}"
          preserveAspectRatio="${imagePreserveAspect}"
          clip-path="url(#breakoutClip)"
        />`
      : ''

  const frameElement = resolvedFrameOverlay
    ? `<image
        data-frame='inner'
        href="${resolvedFrameOverlay}"
        x="0"
        y="0"
        width="${size}"
        height="${size}"
        preserveAspectRatio="none"
      />`
    : `<rect
        data-frame='inner'
        x="${layout.panelX}"
        y="${layout.panelY}"
        width="${layout.panelSize}"
        height="${layout.panelSize}"
        rx="${layout.panelRadius}"
        fill="none"
        stroke="#7da8ff"
        stroke-opacity="0.9"
        stroke-width="${layout.frameStrokeWidth}"
        stroke-linejoin="round"
      />`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${Math.round(
      size * 0.48,
    )} ${Math.round(size * 0.44)}) rotate(90) scale(${Math.round(size * 0.94)} ${Math.round(size * 0.94)})">
      <stop stop-color="${TOKEN_ICON_STYLE.backgroundInner}"/>
      <stop offset="0.62" stop-color="#040915"/>
      <stop offset="1" stop-color="${TOKEN_ICON_STYLE.backgroundOuter}"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${size / 2} ${Math.round(
      size * 0.52,
    )}) rotate(90) scale(${Math.round(size * 0.62)} ${Math.round(size * 0.62)})">
      <stop offset="0.58" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="rgba(0,0,0,${TOKEN_ICON_STYLE.vignetteOpacity})"/>
    </radialGradient>
    <radialGradient id="panel-fill" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${size / 2} ${Math.round(
      size * 0.34,
    )}) rotate(90) scale(${layout.panelSize} ${layout.panelSize})">
      <stop stop-color="${TOKEN_ICON_STYLE.panelFillTop}"/>
      <stop offset="1" stop-color="${TOKEN_ICON_STYLE.panelFillBottom}"/>
    </radialGradient>
    <clipPath id="innerPanelClip">
      <rect x="${layout.panelX}" y="${layout.panelY}" width="${layout.panelSize}" height="${layout.panelSize}" rx="${layout.panelRadius}"/>
    </clipPath>
    <clipPath id="breakoutClip">
      <rect
        x="${layout.panelX - breakoutOverflow}"
        y="${layout.panelY - breakoutOverflow}"
        width="${layout.panelSize + breakoutOverflow * 2}"
        height="${breakoutHeight + breakoutOverflow}"
        rx="${Math.round(layout.panelRadius * 0.95)}"
      />
    </clipPath>
    <filter id="ambient-glow" x="-35%" y="-35%" width="170%" height="170%">
      <feDropShadow dx="0" dy="0" stdDeviation="${Math.max(10, Math.round(size * 0.088))}" flood-color="${TOKEN_ICON_STYLE.glowColor}" flood-opacity="${TOKEN_ICON_STYLE.glowOpacity}"/>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" rx="${layout.outerRadius}" fill="url(#bg)" />
  <rect width="${size}" height="${size}" rx="${layout.outerRadius}" fill="url(#vignette)" />
  <rect
    x="${glowInset}"
    y="${glowInset}"
    width="${glowBoxSize}"
    height="${glowBoxSize}"
    rx="${glowRadius}"
    fill="none"
    stroke="${TOKEN_ICON_STYLE.glowColor}"
    stroke-opacity="0.38"
    stroke-width="${Math.max(2, Math.round(layout.frameStrokeWidth * 1.2))}"
    filter="url(#ambient-glow)"
  />
  <rect
    x="${layout.panelX}"
    y="${layout.panelY}"
    width="${layout.panelSize}"
    height="${layout.panelSize}"
    rx="${layout.panelRadius}"
    fill="url(#panel-fill)"
  />
  ${imageElement}
  <rect x="${layout.panelX}" y="${layout.panelY}" width="${layout.panelSize}" height="${layout.panelSize}" rx="${layout.panelRadius}" fill="${TOKEN_ICON_STYLE.panelScrim}" />
  ${frameElement}
  ${breakoutElement}
  <title>${safeSymbol}</title>
</svg>`
}

export const __testables = {
  generateFramedSvg,
  getTokenIconLayout,
  chooseArtworkFitMode,
  classifyTokenImageMetrics,
  deriveTokenIconRecipe,
}
