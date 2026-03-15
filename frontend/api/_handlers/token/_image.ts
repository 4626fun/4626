import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import sharp from 'sharp'

const execFileP = promisify(execFile)

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  requireServerKey,
  setPublicCors,
} from '../../../server/zora/_shared.js'

import { blobHeadOrNull, blobPutBytes, fetchBytes, sha256Hex } from '../../../server/_lib/blob.js'
import { getCompletedImageProjectForVault } from '../../../server/_lib/imageProjects.js'

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
  setPublicCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (handleOptions(req, res)) return
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  const isLocalPreview = host.includes('localhost') || host.includes('127.0.0.1')

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
  const styleRaw = (getStringQuery(req, 'style') ?? '').trim().toLowerCase()
  const preferRawSourceImage = styleRaw === 'raw'

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const client = createPublicClient({
      transport: http(rpcUrl),
    })

    // Get symbol and vault
    const [symbol, vault] = await Promise.all([
      client.readContract({ address: address as Address, abi: SHARE_OFT_ABI, functionName: 'symbol' }).catch(() => '■TOKEN'),
      client.readContract({ address: address as Address, abi: SHARE_OFT_ABI, functionName: 'vault' }).catch(() => null),
    ])

    // Check for a creator-customized AI-generated image first.
    // Generated projects are keyed by vault address, not the ShareOFT address.
    const vaultAddress = typeof vault === 'string' && isAddress(vault) ? (vault.toLowerCase() as Address) : null
    if (vaultAddress) {
      const aiOverride = await getCompletedImageProjectForVault(vaultAddress).catch(() => null)
      if (aiOverride) {
        const fetched = await fetchBytes(aiOverride.outputBlobUrl).catch(() => null)
        const rawBytes = fetched?.bytes
        if (rawBytes && rawBytes.length > 0) {
          res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
          const processed = await postProcessAiOverrideIcon(rawBytes, size)
          if (format === 'svg') {
            const b64 = Buffer.from(processed).toString('base64')
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="data:image/png;base64,${b64}" width="${size}" height="${size}"/></svg>`
            res.setHeader('Content-Type', 'image/svg+xml')
            return res.status(200).send(svg)
          }
          res.setHeader('Content-Type', 'image/png')
          return res.status(200).send(processed)
        }
      }
    }

    // Get underlying creator coin (ShareOFT path)
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

    // Fetch creator coin image from Zora.
    // Supports both:
    // 1) ShareOFT address -> resolve vault.asset() and fetch that coin image.
    // 2) Direct creator coin address -> fetch coin image directly.
    let creatorCoinImage: string | null = null
    let zoraResolvedSymbol: string | null = null
    const zoraKey = requireServerKey()
    if (zoraKey) {
      try {
        const sdk: any = await import('@zoralabs/coins-sdk')
        sdk.setApiKey(zoraKey)

        const pickCoinImage = (coinData: any): string | null =>
          coinData?.mediaContent?.previewImage?.medium ||
          coinData?.mediaContent?.previewImage?.small ||
          coinData?.mediaContent?.originalUri ||
          null

        const readCoin = async (coinAddress: Address): Promise<any | null> => {
          const coinResponse = await sdk.getCoin({
            address: coinAddress,
            chain: chainId,
          })
          return coinResponse?.data?.zora20Token ?? null
        }

        // Try requested address first (handles direct creator coin lookups).
        const requestedCoin = await readCoin(address as Address).catch(() => null)
        if (requestedCoin) {
          const image = pickCoinImage(requestedCoin)
          if (image) creatorCoinImage = image
          const symbolCandidate = typeof requestedCoin.symbol === 'string' ? requestedCoin.symbol.trim() : ''
          if (symbolCandidate) zoraResolvedSymbol = symbolCandidate
          if (!creatorCoin) creatorCoin = address as Address
        }

        // If this is a ShareOFT with an underlying asset, prefer underlying coin artwork.
        if (creatorCoin && creatorCoin.toLowerCase() !== address.toLowerCase()) {
          const underlyingCoin = await readCoin(creatorCoin).catch(() => null)
          const underlyingImage = pickCoinImage(underlyingCoin)
          if (underlyingImage) creatorCoinImage = underlyingImage
        }
      } catch (e) {
        console.warn('[token/image] Failed to fetch Zora coin image:', e)
      }
    }

    const renderedSymbol = zoraResolvedSymbol || String(symbol)

    if (preferRawSourceImage && creatorCoinImage) {
      const fetched = await fetchBytes(creatorCoinImage).catch(() => null)
      const rawBytes = fetched?.bytes
      if (rawBytes && rawBytes.length > 0) {
        res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
        if (format === 'svg') {
          const contentType =
            typeof fetched?.contentType === 'string' && fetched.contentType.startsWith('image/')
              ? fetched.contentType
              : 'image/png'
          const b64 = Buffer.from(rawBytes).toString('base64')
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="data:${contentType};base64,${b64}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></svg>`
          res.setHeader('Content-Type', 'image/svg+xml')
          return res.status(200).send(svg)
        }
        const resized = await sharp(Buffer.from(rawBytes))
          .resize(size, size, { fit: 'cover' })
          // Keep icon corners opaque/dark across wallets and image viewers.
          .flatten({ background: TOKEN_ICON_STYLE.backgroundOuter })
          .png()
          .toBuffer()
        res.setHeader('Content-Type', 'image/png')
        return res.status(200).send(resized)
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
      const glowLayout = getTokenIconLayout(size, prepared.recipe)
      const glowLayerImage = await renderGlowLayerDataUri(size, glowLayout)
      const svg = generateFramedSvg({
        size,
        symbol: renderedSymbol,
        baseLayerImage:
          prepared.baseLayerBytes && prepared.baseLayerBytes.length > 0
            ? `data:image/png;base64,${Buffer.from(prepared.baseLayerBytes).toString('base64')}`
            : null,
        breakoutLayerImage:
          prepared.breakoutLayerBytes && prepared.breakoutLayerBytes.length > 0
            ? `data:image/png;base64,${Buffer.from(prepared.breakoutLayerBytes).toString('base64')}`
            : null,
        glowLayerImage,
        frameOverlayImage,
        recipe: prepared.recipe,
      })

      res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
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
      symbol: renderedSymbol,
    })

    // Cache for 24 hours at the edge; the underlying blob is content-addressed via cache keys.
    res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
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
  glowLayerImage?: string | null
  frameOverlayImage?: string
  recipe?: TokenIconRecipe
}

const SOURCE_CACHE_V = 4
const FRAME_STYLE_V = 21
const FRAME_ASSET_URL = new URL('../../../public/app-icon.svg', import.meta.url)
const FRAME_VIEWBOX_SIZE = 256
const FRAME_INSET_RATIO = 36 / FRAME_VIEWBOX_SIZE
const FRAME_RADIUS_RATIO = 30 / 184
const FRAME_STROKE_RATIO = 12 / FRAME_VIEWBOX_SIZE

const TOKEN_ICON_STYLE = {
  backgroundInner: '#020202',
  backgroundOuter: '#000000',
  panelFillTop: '#030608',
  panelFillBottom: '#020405',
  panelScrim: 'rgba(0, 0, 0, 0.18)',
  glowColor: '#3b82f6',
  outerRadiusRatio: 0.22,
  panelInsetRatio: FRAME_INSET_RATIO,
  panelRadiusRatio: FRAME_RADIUS_RATIO,
  frameThicknessRatio: FRAME_STROKE_RATIO,
  vignetteOpacity: 0.0,
  glowOpacity: 0.78,
} as const

const TOKEN_ICON_RECIPES: Record<LayoutMode, Omit<TokenIconRecipe, 'breakout'>> = {
  cover: { mode: 'cover', scale: 1.10, innerPadding: 0.0, breakoutTopRatio: 0.22 },
  contain: { mode: 'contain', scale: 0.96, innerPadding: 0.08, breakoutTopRatio: 0.20 },
  coin: { mode: 'coin', scale: 0.82, innerPadding: 0.14, breakoutTopRatio: 0.18 },
}

const BREAKOUT_CONFIG = {
  enabled: true,
  riseAboveFrameRatio: 0.11,
  visibleBelowFrameRatio: 0.006,
  fadeBelowFrameRatio: 0.016,
  minForegroundCoverage: 0.03,
  rembgTimeoutMs: 30_000,
  rembgBin: process.env.REMBG_BIN || '/tmp/rembg-env/bin/rembg',
} as const

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
    breakoutEvaluation.breakoutCoverage >= 0.015

  return {
    ...base,
    breakout,
  }
}

async function renderGlowLayerDataUri(size: number, layout: TokenIconLayout): Promise<string> {
  const { r, g, b } = hexToRgb(TOKEN_ICON_STYLE.glowColor)
  const outerStrokeW = Math.round(layout.frameStrokeWidth * 5)
  const innerStrokeW = Math.round(layout.frameStrokeWidth * 2)
  const svgSize = size
  const ocx = layout.panelX + outerStrokeW / 2
  const ocy = layout.panelY + outerStrokeW / 2
  const orw = layout.panelSize - outerStrokeW
  const orh = layout.panelSize - outerStrokeW
  const orr = Math.max(0, layout.panelRadius - outerStrokeW / 2)
  const icx = layout.panelX + innerStrokeW / 2
  const icy = layout.panelY + innerStrokeW / 2
  const irw = layout.panelSize - innerStrokeW
  const irh = layout.panelSize - innerStrokeW
  const irr = Math.max(0, layout.panelRadius - innerStrokeW / 2)
  const strokeSvg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${ocx}" y="${ocy}" width="${orw}" height="${orh}" rx="${orr}" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="${outerStrokeW}"/>
    <rect x="${icx}" y="${icy}" width="${irw}" height="${irh}" rx="${irr}" fill="none" stroke="rgb(${Math.min(255, r + 120)},${Math.min(255, g + 90)},255)" stroke-width="${innerStrokeW}"/>
  </svg>`
  const strokePng = await sharp(Buffer.from(strokeSvg)).png().toBuffer()
  const sigma = Math.max(1, Math.round(size * 0.055))
  const blurred = await sharp(strokePng)
    .blur(sigma)
    .png()
    .toBuffer()
  const boosted = await sharp(blurred)
    .composite([{ input: blurred, blend: 'add' }])
    .png()
    .toBuffer()
  // Keep glow outside the inner frame opening to prevent top-band bleed inside.
  const innerHoleSvg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${layout.panelX}" y="${layout.panelY}" width="${layout.panelSize}" height="${layout.panelSize}" rx="${layout.panelRadius}" fill="white"/>
  </svg>`
  const innerHoleMask = await sharp(Buffer.from(innerHoleSvg)).png().toBuffer()
  const outsideOnly = await sharp(boosted)
    .ensureAlpha()
    .composite([{ input: innerHoleMask, blend: 'dest-out' }])
    .png()
    .toBuffer()
  return `data:image/png;base64,${outsideOnly.toString('base64')}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
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
      metrics.topOccupancy > 0.015 &&
      (metrics.hasTransparency || metrics.opaquePhotoLikelihood >= 0.55),
    breakoutCoverage: metrics.topOccupancy,
  }
  const recipe = deriveTokenIconRecipe(classification, breakoutEvaluation)
  const layout = getTokenIconLayout(params.size, recipe)
  const fit: ArtworkFitMode = recipe.mode === 'cover' ? 'cover' : 'contain'
  const baseLayerBytesRaw = await renderPlacedArtworkLayer({
    sourceBytes: params.bytes,
    size: params.size,
    layout,
    fit,
  })
  const baseLayerBytes = await clipLayerToInnerPanel({
    layerBytes: baseLayerBytesRaw,
    size: params.size,
    layout,
  })

  let breakoutLayerBytes: Uint8Array | null = null
  if (recipe.breakout && BREAKOUT_CONFIG.enabled) {
    const normalizedSource = await normalizeImageToPng(params.bytes)
    const fg = await extractForeground(normalizedSource)
    if (fg && (await isForegroundUsable(fg))) {
      const refinedFg = await refineForegroundCutout(fg)
      const fgCanvas = await renderPlacedArtworkLayer({
        sourceBytes: refinedFg,
        size: params.size,
        layout,
        fit,
      })
      breakoutLayerBytes = await applyBreakoutAlphaMask({
        foregroundBytes: fgCanvas,
        layout,
      })
    }
  }

  return { recipe, baseLayerBytes, breakoutLayerBytes }
}

async function fetchSourceArtworkBytes(params: {
  upstreamUrl: string | null
}): Promise<Uint8Array | null> {
  const url = typeof params.upstreamUrl === 'string' ? params.upstreamUrl.trim() : ''
  if (!url) return null
  const fetched = await fetchBytes(url)
  return fetched.bytes
}

async function normalizeImageToPng(bytes: Uint8Array): Promise<Uint8Array> {
  const normalized = await sharp(Buffer.from(bytes))
    .rotate()
    .png()
    .toBuffer()
  return new Uint8Array(normalized)
}

async function postProcessAiOverrideIcon(rawBytes: Uint8Array, size: number): Promise<Buffer> {
  const resized = await sharp(Buffer.from(rawBytes))
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .png()
    .toBuffer()
  const layout = getTokenIconLayout(size, { ...TOKEN_ICON_RECIPES.cover, breakout: true })
  const baseRaw = await sharp(resized).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const baseData = Buffer.from(baseRaw.data)

  // Subject-agnostic breakout spill suppression:
  // Use rembg foreground (when available) to preserve true overlap details and
  // damp non-subject background that leaks above the top frame edge.
  let dominantMaskData: Buffer | null = null
  const fg = await extractForeground(new Uint8Array(resized))
  if (fg && (await isForegroundUsable(fg))) {
    const refinedFg = await refineForegroundCutout(fg)
    const fgRaw = await sharp(Buffer.from(refinedFg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const dominantMask = await buildDominantBreakoutComponentMask({
      rgba: Buffer.from(fgRaw.data),
      width: fgRaw.info.width,
      height: fgRaw.info.height,
      channels: fgRaw.info.channels,
      region: {
        left: layout.panelX + layout.panelSize * 0.16,
        right: layout.panelX + layout.panelSize * 0.84,
        top: layout.panelY - layout.panelSize * 0.26,
        bottom: layout.panelY + layout.panelSize * 0.08,
      },
    })
    if (dominantMask) {
      const maskRaw = await sharp(dominantMask).raw().toBuffer({ resolveWithObject: true })
      dominantMaskData = Buffer.from(maskRaw.data)
    }
  }

  const cleanupTop = Math.max(0, Math.round(layout.panelY - layout.panelSize * 0.24))
  const cleanupBottom = Math.min(size, Math.round(layout.panelY + layout.panelSize * 0.05))
  const cleanupLeft = Math.max(0, Math.round(layout.panelX))
  const cleanupRight = Math.min(size, Math.round(layout.panelX + layout.panelSize))
  const cleanupHeight = Math.max(1, cleanupBottom - cleanupTop)
  const targetR = 7
  const targetG = 12
  const targetB = 22
  for (let y = cleanupTop; y < cleanupBottom; y += 1) {
    const vertical = 1 - (y - cleanupTop) / cleanupHeight
    for (let x = cleanupLeft; x < cleanupRight; x += 1) {
      const idx = (y * baseRaw.info.width + x) * baseRaw.info.channels
      const alpha = baseData[idx + 3]
      if (alpha <= 0) continue
      const keep = dominantMaskData ? dominantMaskData[y * baseRaw.info.width + x] / 255 : 0
      const suppress = Math.max(0, Math.min(1, vertical * (1 - keep)))
      if (suppress <= 0) continue
      const mix = 0.9 * suppress
      baseData[idx] = Math.max(0, Math.min(255, Math.round(baseData[idx] * (1 - mix) + targetR * mix)))
      baseData[idx + 1] = Math.max(0, Math.min(255, Math.round(baseData[idx + 1] * (1 - mix) + targetG * mix)))
      baseData[idx + 2] = Math.max(0, Math.min(255, Math.round(baseData[idx + 2] * (1 - mix) + targetB * mix)))
    }
  }

  const cleaned = await sharp(baseData, {
    raw: {
      width: baseRaw.info.width,
      height: baseRaw.info.height,
      channels: baseRaw.info.channels,
    },
  })
    .png()
    .toBuffer()
  const glowUri = await renderGlowLayerDataUri(size, layout)
  const glowBytes = Buffer.from(glowUri.split(',')[1] ?? '', 'base64')

  return await sharp(cleaned)
    .composite([{ input: glowBytes, blend: 'screen', opacity: 0.32 }])
    .flatten({ background: TOKEN_ICON_STYLE.backgroundOuter })
    .png()
    .toBuffer()
}

async function renderPlacedArtworkLayer(params: {
  sourceBytes: Uint8Array
  size: number
  layout: TokenIconLayout
  fit: ArtworkFitMode
}): Promise<Uint8Array> {
  const placed = await sharp(Buffer.from(params.sourceBytes))
    .rotate()
    .resize(params.layout.artSize, params.layout.artSize, {
      fit: params.fit,
      // Anchor portraits upward so breakout subjects intersect the top frame edge.
      position: params.fit === 'cover' ? 'top' : 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const canvas = await sharp({
    create: { width: params.size, height: params.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: placed, left: params.layout.artX, top: params.layout.artY }])
    .png()
    .toBuffer()

  return new Uint8Array(canvas)
}

async function clipLayerToInnerPanel(params: {
  layerBytes: Uint8Array
  size: number
  layout: TokenIconLayout
}): Promise<Uint8Array> {
  const { layerBytes, size, layout } = params
  const clipSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${layout.panelX}" y="${layout.panelY}" width="${layout.panelSize}" height="${layout.panelSize}" rx="${layout.panelRadius}" fill="white" />
  </svg>`
  const clipMask = await sharp(Buffer.from(clipSvg)).png().toBuffer()
  const clipped = await sharp(Buffer.from(layerBytes))
    .ensureAlpha()
    .composite([{ input: clipMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  return new Uint8Array(clipped)
}

async function refineForegroundCutout(foregroundBytes: Uint8Array): Promise<Uint8Array> {
  const alphaMask = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(48)
    .erode(1)
    .dilate(1)
    .blur(0.8)
    .png()
    .toBuffer()

  const refined = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .composite([{ input: alphaMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return new Uint8Array(refined)
}

async function extractForeground(pngBytes: Uint8Array): Promise<Uint8Array | null> {
  const id = randomUUID()
  const inPath = join(tmpdir(), `rembg-in-${id}.png`)
  const outPath = join(tmpdir(), `rembg-out-${id}.png`)
  try {
    await writeFile(inPath, Buffer.from(pngBytes))
    await execFileP(BREAKOUT_CONFIG.rembgBin, ['i', inPath, outPath], {
      timeout: BREAKOUT_CONFIG.rembgTimeoutMs,
    })
    const buf = await readFile(outPath)
    return new Uint8Array(buf)
  } catch (e) {
    console.warn('[token/image] rembg extraction failed (breakout disabled):', (e as Error).message)
    return null
  } finally {
    await Promise.all([unlink(inPath).catch(() => {}), unlink(outPath).catch(() => {})])
  }
}

async function isForegroundUsable(fgBytes: Uint8Array): Promise<boolean> {
  const stats = await sharp(Buffer.from(fgBytes)).stats()
  const alphaMean = stats.channels[3]?.mean ?? 0
  return alphaMean > BREAKOUT_CONFIG.minForegroundCoverage * 255
}

async function getAlphaBounds(imageBytes: Uint8Array, threshold = 24): Promise<{
  left: number
  top: number
  right: number
  bottom: number
} | null> {
  const { data, info } = await sharp(Buffer.from(imageBytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (alpha >= threshold) {
        if (x < left) left = x
        if (y < top) top = y
        if (x > right) right = x
        if (y > bottom) bottom = y
      }
    }
  }

  if (right < left || bottom < top) return null
  return { left, top, right, bottom }
}

type BreakoutRegion = {
  left: number
  right: number
  top: number
  bottom: number
}

async function buildDominantBreakoutComponentMask(params: {
  rgba: Buffer
  width: number
  height: number
  channels: number
  region: BreakoutRegion
  alphaThreshold?: number
}): Promise<Buffer | null> {
  const { rgba, width, height, channels, region, alphaThreshold = 36 } = params
  const rLeft = Math.max(0, Math.min(width - 1, Math.floor(region.left)))
  const rRight = Math.max(rLeft + 1, Math.min(width, Math.ceil(region.right)))
  const rTop = Math.max(0, Math.min(height - 1, Math.floor(region.top)))
  const rBottom = Math.max(rTop + 1, Math.min(height, Math.ceil(region.bottom)))
  const regionWidth = Math.max(1, rRight - rLeft)
  const regionHeight = Math.max(1, rBottom - rTop)

  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const bestMask = new Uint8Array(pixelCount)
  let bestScore = 0
  const centerX = rLeft + regionWidth / 2
  const minArea = Math.max(42, Math.round(regionWidth * regionHeight * 0.0022))

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  const alphaAt = (x: number, y: number) => rgba[(y * width + x) * channels + 3]

  for (let y = rTop; y < rBottom; y += 1) {
    for (let x = rLeft; x < rRight; x += 1) {
      const root = y * width + x
      if (visited[root]) continue
      if (alphaAt(x, y) < alphaThreshold) continue

      const stack: number[] = [root]
      visited[root] = 1
      const indices: number[] = []
      let area = 0
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let sumX = 0

      while (stack.length > 0) {
        const idx = stack.pop() as number
        indices.push(idx)
        area += 1

        const cy = Math.floor(idx / width)
        const cx = idx - cy * width
        sumX += cx
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < rLeft || nx >= rRight || ny < rTop || ny >= rBottom) continue
          const nIdx = ny * width + nx
          if (visited[nIdx]) continue
          if (alphaAt(nx, ny) < alphaThreshold) continue
          visited[nIdx] = 1
          stack.push(nIdx)
        }
      }

      if (area < minArea) continue

      const compWidth = maxX - minX + 1
      const compHeight = maxY - minY + 1
      const topAffinity = 1 - (minY - rTop) / Math.max(1, regionHeight)
      const centerAffinity =
        1 - Math.min(1, Math.abs(sumX / Math.max(1, area) - centerX) / Math.max(1, regionWidth / 2))
      const widthRatio = compWidth / Math.max(1, regionWidth)
      const stripPenalty = widthRatio >= 0.92 && compHeight <= Math.round(regionHeight * 0.4) ? 0.42 : 1

      const score = area * (0.44 + 0.36 * topAffinity + 0.2 * centerAffinity) * stripPenalty
      if (score <= bestScore) continue

      bestScore = score
      bestMask.fill(0)
      for (const idx of indices) bestMask[idx] = 255
    }
  }

  if (bestScore <= 0) return null

  return await sharp(Buffer.from(bestMask), { raw: { width, height, channels: 1 } })
    .blur(1.0)
    .png()
    .toBuffer()
}

async function applyBreakoutAlphaMask(params: {
  foregroundBytes: Uint8Array
  layout: TokenIconLayout
}): Promise<Uint8Array> {
  const { foregroundBytes, layout } = params
  const meta = await sharp(Buffer.from(foregroundBytes)).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  const riseAboveFrame = Math.round(layout.panelSize * BREAKOUT_CONFIG.riseAboveFrameRatio)
  const visibleBelowFrame = Math.round(layout.panelSize * BREAKOUT_CONFIG.visibleBelowFrameRatio)
  const fadeBelowFrame = Math.max(
    visibleBelowFrame + 1,
    Math.round(layout.panelSize * BREAKOUT_CONFIG.fadeBelowFrameRatio),
  )
  const alphaBounds = await getAlphaBounds(foregroundBytes)
  const horizontalPad = Math.round(layout.panelSize * 0.04)
  let zoneLeft = alphaBounds ? Math.max(layout.panelX, alphaBounds.left - horizontalPad) : layout.panelX
  let zoneRight = alphaBounds ? Math.min(layout.panelX + layout.panelSize, alphaBounds.right + horizontalPad) : layout.panelX + layout.panelSize
  const maxZoneWidth = Math.max(1, Math.round(layout.panelSize * 0.64))
  if (zoneRight - zoneLeft > maxZoneWidth) {
    const center = alphaBounds
      ? (alphaBounds.left + alphaBounds.right) / 2
      : layout.panelX + layout.panelSize / 2
    const minLeft = layout.panelX
    const maxLeft = layout.panelX + layout.panelSize - maxZoneWidth
    zoneLeft = Math.min(maxLeft, Math.max(minLeft, Math.round(center - maxZoneWidth / 2)))
    zoneRight = zoneLeft + maxZoneWidth
  }
  const zoneTop = Math.max(0, layout.panelY - riseAboveFrame)
  const solidBottom = Math.min(height, layout.panelY + visibleBelowFrame)
  const fadeBottom = Math.min(height, layout.panelY + fadeBelowFrame)
  const zoneBottom = fadeBottom
  const zoneHeight = Math.max(1, fadeBottom - zoneTop)
  const zoneWidth = Math.max(1, zoneRight - zoneLeft)
  const gradientSolidEnd = zoneHeight > 0 ? Math.max(0, (solidBottom - zoneTop) / zoneHeight) : 0

  const maskSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="breakout-zone" x1="0" y1="${zoneTop}" x2="0" y2="${fadeBottom}">
        <stop offset="0" stop-color="white" stop-opacity="1"/>
        <stop offset="${gradientSolidEnd}" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect
      x="${zoneLeft}"
      y="${zoneTop}"
      width="${zoneWidth}"
      height="${zoneHeight}"
      fill="url(#breakout-zone)"
    />
  </svg>`
  const maskBuf = await sharp(Buffer.from(maskSvg)).resize(width, height).ensureAlpha().png().toBuffer()
  const masked = await sharp(Buffer.from(foregroundBytes))
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const breakout = await sharp(masked).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const dominantMask = await buildDominantBreakoutComponentMask({
    rgba: Buffer.from(breakout.data),
    width: breakout.info.width,
    height: breakout.info.height,
    channels: breakout.info.channels,
    region: {
      left: zoneLeft,
      right: zoneRight,
      top: zoneTop,
      bottom: zoneBottom,
    },
  })
  if (!dominantMask) return new Uint8Array(masked)

  const cleaned = await sharp(masked)
    .ensureAlpha()
    .composite([{ input: dominantMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  return new Uint8Array(cleaned)
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
  const glowLayout = getTokenIconLayout(params.size, prepared.recipe)
  const glowLayerImage = await renderGlowLayerDataUri(params.size, glowLayout)
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
    glowLayerImage,
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
  glowLayerImage,
  frameOverlayImage,
  recipe = getDefaultRecipe(),
}: FramedSvgParams): string {
  const resolvedBaseLayerImage = baseLayerImage ?? creatorCoinImage ?? null
  const resolvedFrameOverlay = frameOverlayImage ?? ''
  const layout = getTokenIconLayout(size, recipe)

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
    recipe.breakout && breakoutLayerImage
      ? `<image
          href="${breakoutLayerImage}"
          x="0"
          y="0"
          width="${size}"
          height="${size}"
          preserveAspectRatio="none"
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
  </defs>

  <rect width="${size}" height="${size}" fill="${TOKEN_ICON_STYLE.backgroundOuter}" />
  <rect width="${size}" height="${size}" rx="${layout.outerRadius}" fill="url(#bg)" />
  <rect width="${size}" height="${size}" rx="${layout.outerRadius}" fill="url(#vignette)" />
  ${glowLayerImage
    ? `<image href="${glowLayerImage}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none" opacity="${resolvedFrameOverlay ? '0.65' : '0.9'}"/>`
    : ''}
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
