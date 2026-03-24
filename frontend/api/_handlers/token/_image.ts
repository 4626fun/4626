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
import { renderPremiumTokenIcon } from './_premiumTokenIconRenderer.js'
import { ensureFontconfig } from '../../../server/_lib/ensureFontconfig.js'

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
import { resolveCreatorTokenArtwork, type CreatorTokenArtwork } from '../../../server/_lib/creatorTokenArtwork.js'
import { getCompletedImageProjectForVault } from '../../../server/_lib/imageProjects.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'
const IPFS_GATEWAY = `${String(process.env.IPFS_GATEWAY ?? DEFAULT_IPFS_GATEWAY).trim().replace(/\/+$/, '')}/`
const IPNS_GATEWAY = IPFS_GATEWAY.replace(/\/ipfs\/$/i, '/')

ensureFontconfig()

function normalizeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function ipfsToHttpUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  if (raw.startsWith('ipfs://')) {
    const path = raw.slice('ipfs://'.length).replace(/^ipfs\//i, '').replace(/^\/+/, '')
    if (!path) return null
    return `${IPFS_GATEWAY}${path}`
  }

  if (raw.startsWith('/ipfs/')) {
    const path = raw.replace(/^\/+ipfs\//i, '')
    if (!path) return null
    return `${IPFS_GATEWAY}${path}`
  }

  if (raw.startsWith('bafy') || raw.startsWith('Qm')) {
    return `${IPFS_GATEWAY}${raw}`
  }

  return null
}

function ipnsToHttpUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  if (raw.startsWith('ipns://')) {
    const path = raw.slice('ipns://'.length).replace(/^ipns\//i, '').replace(/^\/+/, '')
    if (!path) return null
    return `${IPNS_GATEWAY}ipns/${path}`
  }

  if (raw.startsWith('/ipns/')) {
    const path = raw.replace(/^\/+ipns\//i, '')
    if (!path) return null
    return `${IPNS_GATEWAY}ipns/${path}`
  }

  return null
}

function normalizeSourceArtworkUrl(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null

  const ipfs = ipfsToHttpUrl(raw)
  if (ipfs) return ipfs

  const ipns = ipnsToHttpUrl(raw)
  if (ipns) return ipns

  if (raw.startsWith('data:image/')) {
    return raw
  }

  if (raw.startsWith('ar://')) {
    const id = raw.slice('ar://'.length).replace(/^\/+/, '')
    if (!id) return null
    return `https://arweave.net/${id}`
  }

  return normalizeHttpUrl(raw)
}

type HeroCutoutLoadPolicy = {
  hasHeroCutoutUrl: boolean
  heroCutoutLoadFailed: boolean
  suppressBreakout: boolean
}

function resolveHeroCutoutLoadPolicy(params: {
  heroCutoutArtworkUrl?: string | null
  heroCutoutSourceBytes?: Uint8Array | null
}): HeroCutoutLoadPolicy {
  const hasHeroCutoutUrl =
    typeof params.heroCutoutArtworkUrl === 'string' &&
    params.heroCutoutArtworkUrl.trim().length > 0
  const heroCutoutLoaded =
    !!params.heroCutoutSourceBytes &&
    params.heroCutoutSourceBytes.length > 0
  const heroCutoutLoadFailed = hasHeroCutoutUrl && !heroCutoutLoaded
  return {
    hasHeroCutoutUrl,
    heroCutoutLoadFailed,
    // Missing hero-cutout should not suppress all breakout paths.
    // We still avoid caching this render result so a temporary outage does not poison cache.
    suppressBreakout: false,
  }
}

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
  const presetRaw = (getStringQuery(req, 'preset') ?? '').trim().toLowerCase()
  const renderPreset =
    presetRaw === 'hero' ? 'hero'
    : presetRaw === 'pixel' ? 'pixel'
    : presetRaw === 'standard' ? 'standard'
    : undefined

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
    let preferredSourceBytes: Uint8Array | null = null
    let preferredSourceFingerprint: string | null = null
    const vaultAddress = typeof vault === 'string' && isAddress(vault) ? (vault.toLowerCase() as Address) : null
    if (vaultAddress) {
      const aiOverride = await getCompletedImageProjectForVault(vaultAddress).catch(() => null)
      if (aiOverride) {
        const fetched = await fetchBytes(aiOverride.outputBlobUrl).catch(() => null)
        const rawBytes = fetched?.bytes
        if (rawBytes && rawBytes.length > 0) {
          preferredSourceBytes = rawBytes
          preferredSourceFingerprint = sha256Hex(Buffer.from(rawBytes).toString('base64'))
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
    let creatorTokenArtwork: CreatorTokenArtwork | null = null
    let zoraResolvedSymbol: string | null = null
    let zoraResolvedHandle: string | null = null
    const zoraKey = requireServerKey()
    if (zoraKey) {
      try {
        const sdk: any = await import('@zoralabs/coins-sdk')
        sdk.setApiKey(zoraKey)

        const pickCoinArtwork = (coinData: any): CreatorTokenArtwork | null =>
          resolveCreatorTokenArtwork(coinData)
        const readCreatorHandle = (coinData: any): string | null => {
          const handleCandidate =
            typeof coinData?.creatorProfile?.handle === 'string'
              ? coinData.creatorProfile.handle.trim()
              : ''
          return handleCandidate.length > 0 ? handleCandidate : null
        }

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
          const artwork = pickCoinArtwork(requestedCoin)
          if (artwork) creatorTokenArtwork = artwork
          const handleCandidate = readCreatorHandle(requestedCoin)
          if (handleCandidate) zoraResolvedHandle = handleCandidate
          const symbolCandidate = typeof requestedCoin.symbol === 'string' ? requestedCoin.symbol.trim() : ''
          if (symbolCandidate) zoraResolvedSymbol = symbolCandidate
          if (!creatorCoin) creatorCoin = address as Address
        }

        // If this is a ShareOFT with an underlying asset, prefer underlying coin artwork.
        if (creatorCoin && creatorCoin.toLowerCase() !== address.toLowerCase()) {
          const underlyingCoin = await readCoin(creatorCoin).catch(() => null)
          const underlyingArtwork = pickCoinArtwork(underlyingCoin)
          if (underlyingArtwork) creatorTokenArtwork = underlyingArtwork
          const underlyingHandle = readCreatorHandle(underlyingCoin)
          if (underlyingHandle) zoraResolvedHandle = underlyingHandle
        }
      } catch (e) {
        console.warn('[token/image] Failed to fetch Zora coin image:', e)
      }
    }

    const renderedSymbol = zoraResolvedSymbol || String(symbol)
    const renderedSignature = zoraResolvedHandle || renderedSymbol
    const artworkUrl = creatorTokenArtwork?.artworkUrl ?? null
    const heroCutoutArtworkUrl = creatorTokenArtwork?.heroCutoutArtworkUrl ?? null

    if (preferRawSourceImage) {
      const rawBytes = preferredSourceBytes ?? (await fetchSourceArtworkBytes({ upstreamUrl: artworkUrl }))
      if (rawBytes && rawBytes.length > 0) {
        res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
        if (format === 'svg') {
          const contentType = 'image/png'
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

    // SVG stays self-contained so wallets and crawlers see the same deterministic composition.
    if (format === 'svg') {
      const sourceBytes = preferredSourceBytes ?? (await fetchSourceArtworkBytes({ upstreamUrl: artworkUrl }))
      const heroCutoutSourceBytes = await fetchSourceArtworkBytes({ upstreamUrl: heroCutoutArtworkUrl })
      const heroCutoutLoadPolicy = resolveHeroCutoutLoadPolicy({
        heroCutoutArtworkUrl,
        heroCutoutSourceBytes,
      })
      const iconPng = await renderDeterministicTokenIcon({
        size,
        sourceBytes,
        heroCutoutSourceBytes,
        suppressBreakout: heroCutoutLoadPolicy.suppressBreakout,
        symbol: renderedSymbol,
        signatureText: renderedSignature,
        renderPreset,
      })
      const b64 = Buffer.from(iconPng).toString('base64')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="data:image/png;base64,${b64}" width="${size}" height="${size}" preserveAspectRatio="none"/></svg>`

      res.setHeader('Cache-Control', isLocalPreview ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=172800')
      res.setHeader('Content-Type', 'image/svg+xml')
      return res.status(200).send(svg)
    }

    // PNG default: generate/serve a cached raster (durable via Vercel Blob).
    const png = await getOrCreatePng({
      chainId,
      shareOft: address as Address,
      creatorCoin,
      upstreamUrl: artworkUrl,
      heroCutoutUpstreamUrl: heroCutoutArtworkUrl,
      size,
      symbol: renderedSymbol,
      signatureText: renderedSignature,
      sourceBytesOverride: preferredSourceBytes,
      sourceFingerprintOverride: preferredSourceFingerprint,
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

type CandidateRender = {
  recipe: TokenIconRecipe
  layout: TokenIconLayout
  fit: ArtworkFitMode
  baseLayerBytes: Uint8Array
  breakoutLayerBytes: Uint8Array | null
  breakoutTopCoverage: number
  score: number
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
  recipe?: TokenIconRecipe
}

const SOURCE_CACHE_V = 4
const FRAME_STYLE_V = 171
const FRAME_VIEWBOX_SIZE = 256
const FRAME_INSET_RATIO = 38 / FRAME_VIEWBOX_SIZE
const FRAME_RADIUS_RATIO = 30 / 184
const FRAME_STROKE_RATIO = 12 / FRAME_VIEWBOX_SIZE

const TOKEN_ICON_STYLE = {
  backgroundInner: '#020202',
  backgroundOuter: '#000000',
  panelFillTop: '#030608',
  panelFillBottom: '#020405',
  panelScrim: 'rgba(0, 0, 0, 0.08)',
  glowColor: '#2F7DFF',
  outerRadiusRatio: 0.22,
  panelInsetRatio: FRAME_INSET_RATIO,
  panelRadiusRatio: FRAME_RADIUS_RATIO,
  frameThicknessRatio: FRAME_STROKE_RATIO,
  vignetteOpacity: 0.0,
  glowOpacity: 0.82,
} as const

const DEFAULT_TOKEN_FRAME_OVERLAY_PATH =
  '/home/akitav2/.cursor/projects/home-akitav2-projects-4626/assets/c__Users_akitav2_AppData_Roaming_Cursor_User_workspaceStorage_a50cc50be1149bd304676ca17e49fedc_images_logo-10f83404-a513-4669-ace8-8c70ed794902.png'

const TOKEN_ICON_RECIPES: Record<LayoutMode, Omit<TokenIconRecipe, 'breakout'>> = {
  cover: { mode: 'cover', scale: 1.10, innerPadding: 0.0, breakoutTopRatio: 0.22 },
  contain: { mode: 'contain', scale: 0.96, innerPadding: 0.08, breakoutTopRatio: 0.20 },
  coin: { mode: 'coin', scale: 0.82, innerPadding: 0.14, breakoutTopRatio: 0.18 },
}

const BREAKOUT_CONFIG = {
  enabled: true,
  riseAboveFrameRatio: 0.21,
  visibleBelowFrameRatio: 0.055,
  fadeBelowFrameRatio: 0.21,
  minForegroundCoverage: 0.025,
  rembgTimeoutMs: 30_000,
  rembgBin: process.env.REMBG_BIN || '/tmp/rembg-env/bin/rembg',
} as const

const CANDIDATE_QUALITY_CONFIG = {
  minAcceptableScore: 2.05,
  cornerSampleInsetRatio: 0.04,
  edgeInsetRatio: 0.08,
  foregroundColorDistanceThreshold: 42,
  bottomBandHeightRatio: 0.16,
  bottomBgSimilarityPenaltyStart: 0.48,
  preferBreakoutWhenUsable: true,
  breakoutTopCoverageMin: 0.004,
  breakoutPreferenceMaxScoreDelta: 0.9,
} as const

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

  // Pet/portrait-friendly override: if the top region is occupied and photo-like,
  // force a cover+breakout path to preserve natural head/ear overlap.
  if (normalized.topOccupancy > 0.08 && normalized.opaquePhotoLikelihood > 0.4) {
    return { layoutMode: 'cover', allowBreakout: true }
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function buildCandidateRecipes(params: {
  classification: TokenImageClassification
  breakoutEvaluation: BreakoutEvaluation
  metrics: TokenImageMetrics
}): TokenIconRecipe[] {
  const { classification, breakoutEvaluation, metrics } = params
  const recipes: TokenIconRecipe[] = []
  const seen = new Set<string>()
  const push = (recipe: TokenIconRecipe) => {
    const key = `${recipe.mode}:${recipe.scale.toFixed(3)}:${recipe.innerPadding.toFixed(3)}:${recipe.breakout ? 1 : 0}`
    if (seen.has(key)) return
    seen.add(key)
    recipes.push(recipe)
  }

  const derived = deriveTokenIconRecipe(classification, breakoutEvaluation)
  const breakoutAllowed = derived.breakout
  const fillScales =
    classification.layoutMode === 'cover'
      ? [1.18, 1.14, 1.1, 1.06]
      : classification.layoutMode === 'contain'
        ? [1.14, 1.1, 1.06]
        : metrics.circularBadgeLikelihood >= 0.85
          ? [1.02, 1.0]
          : [1.1, 1.06, 1.02]

  if (breakoutAllowed) {
    push({
      ...TOKEN_ICON_RECIPES.cover,
      scale: fillScales[0] ?? 1.08,
      innerPadding: 0,
      breakout: true,
    })
  }

  for (const scale of fillScales) {
    push({
      ...TOKEN_ICON_RECIPES.cover,
      scale,
      innerPadding: 0,
      breakout: false,
    })
  }

  return recipes
}

async function measureBreakoutTopCoverage(params: {
  breakoutLayerBytes: Uint8Array
  layout: TokenIconLayout
}): Promise<number> {
  const { breakoutLayerBytes, layout } = params
  const { data, info } = await sharp(Buffer.from(breakoutLayerBytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const riseAboveFrame = Math.round(layout.panelSize * BREAKOUT_CONFIG.riseAboveFrameRatio)
  const regionTop = Math.max(0, layout.panelY - riseAboveFrame)
  const regionBottom = Math.min(info.height, layout.panelY + Math.max(1, Math.round(layout.panelSize * 0.04)))
  const regionLeft = Math.max(0, layout.panelX)
  const regionRight = Math.min(info.width, layout.panelX + layout.panelSize)

  let visible = 0
  let total = 0
  for (let y = regionTop; y < regionBottom; y += 1) {
    for (let x = regionLeft; x < regionRight; x += 1) {
      total += 1
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (alpha > 20) visible += 1
    }
  }

  if (total <= 0) return 0
  return visible / total
}

async function scoreRenderedCandidate(params: {
  recipe: TokenIconRecipe
  layout: TokenIconLayout
  baseLayerBytes: Uint8Array
  breakoutLayerBytes: Uint8Array | null
  breakoutTopCoverage?: number
  sourceMetrics: TokenImageMetrics
  breakoutEvaluation: BreakoutEvaluation
}): Promise<number> {
  const { recipe, layout, baseLayerBytes, breakoutLayerBytes, breakoutTopCoverage, sourceMetrics, breakoutEvaluation } = params
  const { data, info } = await sharp(Buffer.from(baseLayerBytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const panelX = Math.max(0, layout.panelX)
  const panelY = Math.max(0, layout.panelY)
  const panelRight = Math.min(info.width, layout.panelX + layout.panelSize)
  const panelBottom = Math.min(info.height, layout.panelY + layout.panelSize)
  const panelWidth = Math.max(1, panelRight - panelX)
  const panelHeight = Math.max(1, panelBottom - panelY)
  const panelArea = panelWidth * panelHeight
  const cornerInset = Math.max(1, Math.round(layout.panelSize * CANDIDATE_QUALITY_CONFIG.cornerSampleInsetRatio))
  const edgeInset = Math.max(2, Math.round(layout.panelSize * CANDIDATE_QUALITY_CONFIG.edgeInsetRatio))

  const cornerPoints = [
    [panelX + cornerInset, panelY + cornerInset],
    [panelRight - cornerInset - 1, panelY + cornerInset],
    [panelX + cornerInset, panelBottom - cornerInset - 1],
    [panelRight - cornerInset - 1, panelBottom - cornerInset - 1],
  ]
  let bgR = 0
  let bgG = 0
  let bgB = 0
  let bgCount = 0
  for (const [x, y] of cornerPoints) {
    if (x < panelX || x >= panelRight || y < panelY || y >= panelBottom) continue
    const idx = (y * info.width + x) * info.channels
    const alpha = data[idx + 3]
    if (alpha <= 8) continue
    bgR += data[idx]
    bgG += data[idx + 1]
    bgB += data[idx + 2]
    bgCount += 1
  }
  if (bgCount <= 0) {
    const bg = hexToRgb(TOKEN_ICON_STYLE.backgroundInner)
    bgR = bg.r
    bgG = bg.g
    bgB = bg.b
    bgCount = 1
  }
  const bgAvgR = bgR / bgCount
  const bgAvgG = bgG / bgCount
  const bgAvgB = bgB / bgCount

  let visibleCount = 0
  let fgCount = 0
  let edgeVisibleCount = 0
  let edgeFgCount = 0
  let visibleMinX = panelRight
  let visibleMinY = panelBottom
  let visibleMaxX = panelX - 1
  let visibleMaxY = panelY - 1
  let fgMinX = panelRight
  let fgMinY = panelBottom
  let fgMaxX = panelX - 1
  let fgMaxY = panelY - 1

  for (let y = panelY; y < panelBottom; y += 1) {
    for (let x = panelX; x < panelRight; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const alpha = data[idx + 3]
      if (alpha <= 10) continue
      visibleCount += 1
      if (x < visibleMinX) visibleMinX = x
      if (y < visibleMinY) visibleMinY = y
      if (x > visibleMaxX) visibleMaxX = x
      if (y > visibleMaxY) visibleMaxY = y

      const edgePixel =
        x < panelX + edgeInset ||
        y < panelY + edgeInset ||
        x >= panelRight - edgeInset ||
        y >= panelBottom - edgeInset
      if (edgePixel) edgeVisibleCount += 1

      const distFromBg =
        Math.abs(data[idx] - bgAvgR) + Math.abs(data[idx + 1] - bgAvgG) + Math.abs(data[idx + 2] - bgAvgB)
      let isForeground = distFromBg > CANDIDATE_QUALITY_CONFIG.foregroundColorDistanceThreshold
      if (!isForeground && alpha < 190) isForeground = true
      if (!isForeground) continue

      fgCount += 1
      if (x < fgMinX) fgMinX = x
      if (y < fgMinY) fgMinY = y
      if (x > fgMaxX) fgMaxX = x
      if (y > fgMaxY) fgMaxY = y
      if (edgePixel) edgeFgCount += 1
    }
  }

  const fallbackToVisibleMask = fgCount < Math.max(20, Math.round(panelArea * 0.01))
  if (fallbackToVisibleMask) {
    fgCount = visibleCount
    edgeFgCount = edgeVisibleCount
    fgMinX = visibleMinX
    fgMinY = visibleMinY
    fgMaxX = visibleMaxX
    fgMaxY = visibleMaxY
  }

  const coverage = panelArea > 0 ? visibleCount / panelArea : 0
  const fgCoverage = panelArea > 0 ? fgCount / panelArea : 0
  const edgeTouch = fgCount > 0 ? edgeFgCount / fgCount : 1
  const bboxWidth = fgMaxX >= fgMinX ? fgMaxX - fgMinX + 1 : 0
  const bboxHeight = fgMaxY >= fgMinY ? fgMaxY - fgMinY + 1 : 0
  const bboxAreaRatio = panelArea > 0 ? (bboxWidth * bboxHeight) / panelArea : 0
  const bboxCenterX = fgMaxX >= fgMinX ? (fgMinX + fgMaxX) / 2 : panelX + panelWidth / 2
  const bboxCenterY = fgMaxY >= fgMinY ? (fgMinY + fgMaxY) / 2 : panelY + panelHeight / 2
  const centerDx = (bboxCenterX - (panelX + panelWidth / 2)) / Math.max(1, panelWidth / 2)
  const centerDy = (bboxCenterY - (panelY + panelHeight / 2)) / Math.max(1, panelHeight / 2)
  const centerDistance = Math.sqrt(centerDx * centerDx + centerDy * centerDy)

  const coverLike = recipe.mode === 'cover'
  const coinLike = recipe.mode === 'coin' || sourceMetrics.circularBadgeLikelihood >= 0.72

  const bottomBandHeight = Math.max(1, Math.round(panelHeight * CANDIDATE_QUALITY_CONFIG.bottomBandHeightRatio))
  const bottomBandTop = panelBottom - bottomBandHeight
  let bottomLikeBgCount = 0
  let bottomVisibleCount = 0
  for (let y = bottomBandTop; y < panelBottom; y += 1) {
    for (let x = panelX; x < panelRight; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const alpha = data[idx + 3]
      if (alpha <= 10) continue
      bottomVisibleCount += 1
      const distFromBg =
        Math.abs(data[idx] - bgAvgR) + Math.abs(data[idx + 1] - bgAvgG) + Math.abs(data[idx + 2] - bgAvgB)
      if (distFromBg <= CANDIDATE_QUALITY_CONFIG.foregroundColorDistanceThreshold * 1.1) {
        bottomLikeBgCount += 1
      }
    }
  }
  const bottomBgSimilarity = bottomVisibleCount > 0 ? bottomLikeBgCount / bottomVisibleCount : 0

  const targetCoverage = coinLike ? 0.62 : coverLike ? 0.88 : 0.74
  const targetFgCoverage = coinLike ? 0.34 : coverLike ? 0.52 : 0.44
  const edgeAllowance = coverLike ? 0.48 : coinLike ? 0.22 : 0.33
  const minBboxArea = coinLike ? 0.18 : coverLike ? 0.28 : 0.2

  let score = 0
  score += 1 - clamp01(Math.abs(coverage - targetCoverage) / 0.5)
  score += 1 - clamp01(Math.abs(fgCoverage - targetFgCoverage) / 0.5)
  score += 1 - clamp01(Math.max(0, edgeTouch - edgeAllowance) / Math.max(0.01, 1 - edgeAllowance))
  score += 1 - clamp01(centerDistance / 0.9)
  score += 1 - clamp01(Math.max(0, minBboxArea - bboxAreaRatio) / Math.max(0.01, minBboxArea))
  score +=
    1 -
    clamp01(
      Math.max(0, bottomBgSimilarity - CANDIDATE_QUALITY_CONFIG.bottomBgSimilarityPenaltyStart) /
        Math.max(0.01, 1 - CANDIDATE_QUALITY_CONFIG.bottomBgSimilarityPenaltyStart),
    )

  if (coverage < 0.34) score -= 0.3
  if (coverLike && bottomBgSimilarity > 0.68) score -= 0.28
  if (sourceMetrics.opaquePhotoLikelihood >= 0.65) score += coverLike ? 0.12 : -0.08
  if (sourceMetrics.circularBadgeLikelihood >= 0.62) score += coinLike ? 0.14 : -0.08
  if (sourceMetrics.hasTransparency && !coverLike) score += 0.05

  if (recipe.breakout) {
    if (breakoutLayerBytes && breakoutLayerBytes.length > 0) {
      const topCoverage =
        typeof breakoutTopCoverage === 'number'
          ? breakoutTopCoverage
          : await measureBreakoutTopCoverage({
              breakoutLayerBytes,
              layout,
            })
      if (topCoverage >= CANDIDATE_QUALITY_CONFIG.breakoutTopCoverageMin && topCoverage <= 0.2) score += 0.24
      else if (topCoverage > 0.26) score -= 0.15
      else score -= 0.12
    } else {
      score -= 0.3
    }
  } else if (breakoutEvaluation.hasUsableBreakoutMask && coverLike) {
    score -= 0.04
  }

  return score
}

async function renderGlowLayerDataUri(size: number, layout: TokenIconLayout): Promise<string> {
  const { r, g, b } = hexToRgb(TOKEN_ICON_STYLE.glowColor)
  const outerStrokeW = Math.round(layout.frameStrokeWidth * 4)
  const svgSize = size
  const ocx = layout.panelX + outerStrokeW / 2
  const ocy = layout.panelY + outerStrokeW / 2
  const orw = layout.panelSize - outerStrokeW
  const orh = layout.panelSize - outerStrokeW
  const orr = Math.max(0, layout.panelRadius - outerStrokeW / 2)
  const strokeSvg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${ocx}" y="${ocy}" width="${orw}" height="${orh}" rx="${orr}" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="${outerStrokeW}"/>
  </svg>`
  const strokePng = await sharp(Buffer.from(strokeSvg)).png().toBuffer()
  const sigma = Math.max(1, Math.round(size * 0.042))
  const blurred = await sharp(strokePng)
    .blur(sigma)
    .png()
    .toBuffer()
  const tight = await sharp(strokePng)
    .blur(Math.max(1, sigma * 0.55))
    .png()
    .toBuffer()
  const boosted = await sharp(blurred)
    .composite([
      { input: blurred, blend: 'screen' },
      { input: tight, blend: 'screen' },
    ])
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

async function applyLayerOpacity(bytes: Uint8Array | Buffer, opacity: number): Promise<Buffer> {
  const clamped = Math.max(0, Math.min(1, opacity))
  if (clamped >= 0.999) {
    return Buffer.from(bytes)
  }
  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = Buffer.from(data)
  for (let i = 3; i < rgba.length; i += info.channels) {
    rgba[i] = Math.max(0, Math.min(255, Math.round(rgba[i] * clamped)))
  }
  return await sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer()
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

async function isLowResolutionSource(bytes: Uint8Array, targetSize: number): Promise<boolean> {
  const meta = await sharp(Buffer.from(bytes)).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const minDim = Math.min(width, height)
  return minDim > 0 && minDim < Math.round(targetSize * 0.8)
}

async function analyzeBrightnessProfile(bytes: Uint8Array): Promise<{
  meanLuma: number
  edgeLuma: number
}> {
  const sampleSize = 48
  const { data, info } = await sharp(Buffer.from(bytes))
    .rotate()
    .resize(sampleSize, sampleSize, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let total = 0
  let count = 0
  let edgeTotal = 0
  let edgeCount = 0
  const edge = Math.max(1, Math.floor(sampleSize * 0.12))

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      total += luma
      count += 1

      const isEdge =
        x < edge || y < edge || x >= info.width - edge || y >= info.height - edge
      if (isEdge) {
        edgeTotal += luma
        edgeCount += 1
      }
    }
  }

  return {
    meanLuma: count > 0 ? total / count : 0,
    edgeLuma: edgeCount > 0 ? edgeTotal / edgeCount : 0,
  }
}

async function analyzeTopCenterTexture(bytes: Uint8Array): Promise<{
  topCenterStdDev: number
}> {
  const sampleSize = 64
  const { data, info } = await sharp(Buffer.from(bytes))
    .rotate()
    .resize(sampleSize, sampleSize, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const xStart = Math.max(0, Math.floor(sampleSize * 0.33))
  const xEnd = Math.min(info.width, Math.ceil(sampleSize * 0.67))
  const yStart = 0
  const yEnd = Math.min(info.height, Math.ceil(sampleSize * 0.24))

  let mean = 0
  let count = 0
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      mean += luma
      count += 1
    }
  }

  if (count <= 0) {
    return { topCenterStdDev: 0 }
  }

  mean /= count

  let variance = 0
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const idx = (y * info.width + x) * info.channels
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const delta = luma - mean
      variance += delta * delta
    }
  }

  variance /= count
  return { topCenterStdDev: Math.sqrt(variance) }
}

async function prepareArtworkLayers(params: { size: number; bytes: Uint8Array | null }): Promise<PreparedArtworkLayers> {
  if (!params.bytes || params.bytes.length === 0) {
    return {
      recipe: getDefaultRecipe(),
      baseLayerBytes: null,
      breakoutLayerBytes: null,
    }
  }

  const normalizedSource = await normalizeImageToPng(params.bytes)
  const preparedSource = await cropTransparentPadding(normalizedSource)
  const metrics = await analyzeTokenImageBytes(preparedSource)
  const classification = classifyTokenImageMetrics(metrics)
  const breakoutEvaluation: BreakoutEvaluation = {
    size: params.size,
    hasUsableBreakoutMask:
      classification.allowBreakout &&
      metrics.topOccupancy > 0.015 &&
      (metrics.hasTransparency || metrics.opaquePhotoLikelihood >= 0.55),
    breakoutCoverage: metrics.topOccupancy,
  }
  const candidateRecipes = buildCandidateRecipes({
    classification,
    breakoutEvaluation,
    metrics,
  })

  const renderBaseForRecipe = async (recipe: TokenIconRecipe): Promise<{
    layout: TokenIconLayout
    fit: ArtworkFitMode
    baseLayerBytes: Uint8Array
  }> => {
    const layout = getTokenIconLayout(params.size, recipe)
    const fit: ArtworkFitMode = recipe.mode === 'cover' ? 'cover' : 'contain'
    const baseLayerRaw = await renderPlacedArtworkLayer({
      sourceBytes: preparedSource,
      size: params.size,
      layout,
      fit,
      anchorTop: recipe.breakout,
    })
    const baseLayerBytes = await clipLayerToInnerPanel({
      layerBytes: baseLayerRaw,
      size: params.size,
      layout,
    })
    return { layout, fit, baseLayerBytes }
  }

  let refinedForegroundSource: Uint8Array | null = null
  if (breakoutEvaluation.hasUsableBreakoutMask && BREAKOUT_CONFIG.enabled) {
    const fg = await extractForeground(preparedSource)
    if (fg && (await isForegroundUsable(fg))) {
      refinedForegroundSource = await refineForegroundCutout(fg)
    }
  }

  const candidates: CandidateRender[] = []
  for (const recipe of candidateRecipes) {
    const { layout, fit, baseLayerBytes } = await renderBaseForRecipe(recipe)
    let breakoutLayerBytes: Uint8Array | null = null
    let breakoutTopCoverage = 0

    if (recipe.breakout && refinedForegroundSource) {
      const sourceTopCanvas = await renderPlacedArtworkLayer({
        sourceBytes: preparedSource,
        size: params.size,
        layout,
        fit,
        anchorTop: true,
      })
      const maskTopCanvas = await renderPlacedArtworkLayer({
        sourceBytes: refinedForegroundSource,
        size: params.size,
        layout,
        fit,
        anchorTop: true,
      })
      const fgCanvas = await applyReferenceAlphaMask({
        layerBytes: sourceTopCanvas,
        alphaReferenceBytes: maskTopCanvas,
        layout,
      })
      breakoutLayerBytes = await applyBreakoutAlphaMask({
        foregroundBytes: fgCanvas,
        layout,
      })
      if (breakoutLayerBytes && breakoutLayerBytes.length > 0) {
        breakoutTopCoverage = await measureBreakoutTopCoverage({
          breakoutLayerBytes,
          layout,
        })
      }
    }

    const score = await scoreRenderedCandidate({
      recipe,
      layout,
      baseLayerBytes,
      breakoutLayerBytes,
      breakoutTopCoverage,
      sourceMetrics: metrics,
      breakoutEvaluation,
    })

    candidates.push({
      recipe,
      layout,
      fit,
      baseLayerBytes,
      breakoutLayerBytes,
      breakoutTopCoverage,
      score,
    })
  }

  const ranked = candidates.sort((a, b) => b.score - a.score)
  let best = ranked[0]
  if (CANDIDATE_QUALITY_CONFIG.preferBreakoutWhenUsable && breakoutEvaluation.hasUsableBreakoutMask && ranked.length > 0) {
    const bestBreakout = ranked.find(
      (candidate) =>
        candidate.recipe.breakout &&
        !!candidate.breakoutLayerBytes &&
        candidate.breakoutTopCoverage >= CANDIDATE_QUALITY_CONFIG.breakoutTopCoverageMin,
    )
    if (bestBreakout && !best?.recipe.breakout) {
      const scoreDelta = Math.max(0, best.score - bestBreakout.score)
      if (scoreDelta <= CANDIDATE_QUALITY_CONFIG.breakoutPreferenceMaxScoreDelta) {
        best = bestBreakout
      }
    }
  }
  if (best && best.score >= CANDIDATE_QUALITY_CONFIG.minAcceptableScore) {
    return {
      recipe: best.recipe,
      baseLayerBytes: best.baseLayerBytes,
      breakoutLayerBytes: best.breakoutLayerBytes,
    }
  }

  // Safety fallback: keep a fill-first crop so the inner frame is always occupied.
  const fallbackRecipe: TokenIconRecipe = {
    ...TOKEN_ICON_RECIPES.cover,
    scale: 1.10,
    innerPadding: 0,
    breakout: false,
  }
  const fallback = await renderBaseForRecipe(fallbackRecipe)
  if (best) {
    console.info('[token/image] low-confidence candidate fallback', {
      bestScore: best.score,
      threshold: CANDIDATE_QUALITY_CONFIG.minAcceptableScore,
      mode: best.recipe.mode,
      breakout: best.recipe.breakout,
    })
  }
  return {
    recipe: fallbackRecipe,
    baseLayerBytes: fallback.baseLayerBytes,
    breakoutLayerBytes: null,
  }
}

async function fetchSourceArtworkBytes(params: {
  upstreamUrl: string | null
}): Promise<Uint8Array | null> {
  const url = normalizeSourceArtworkUrl(params.upstreamUrl)
  if (!url) return null
  try {
    const fetched = await fetchBytes(url)
    return fetched.bytes
  } catch (error) {
    console.warn('[token/image] source artwork fetch failed; using deterministic fallback icon:', {
      url,
      message: error instanceof Error ? error.message : String(error ?? ''),
    })
    return null
  }
}

async function normalizeImageToPng(bytes: Uint8Array): Promise<Uint8Array> {
  const normalized = await sharp(Buffer.from(bytes))
    .rotate()
    .png()
    .toBuffer()
  return new Uint8Array(normalized)
}

async function cropTransparentPadding(bytes: Uint8Array): Promise<Uint8Array> {
  const meta = await sharp(Buffer.from(bytes)).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width <= 0 || height <= 0) return bytes

  const bounds = await getAlphaBounds(bytes, 18)
  if (!bounds) return bytes

  const bboxWidth = bounds.right - bounds.left + 1
  const bboxHeight = bounds.bottom - bounds.top + 1
  if (bboxWidth <= 0 || bboxHeight <= 0) return bytes

  const areaRatio = (bboxWidth * bboxHeight) / Math.max(1, width * height)
  if (areaRatio >= 0.96) return bytes

  const padX = Math.max(1, Math.round(bboxWidth * 0.015))
  const padY = Math.max(1, Math.round(bboxHeight * 0.015))
  const left = Math.max(0, bounds.left - padX)
  const top = Math.max(0, bounds.top - padY)
  const right = Math.min(width - 1, bounds.right + padX)
  const bottom = Math.min(height - 1, bounds.bottom + padY)
  const extractWidth = Math.max(1, right - left + 1)
  const extractHeight = Math.max(1, bottom - top + 1)

  if (left === 0 && top === 0 && extractWidth === width && extractHeight === height) {
    return bytes
  }

  const cropped = await sharp(Buffer.from(bytes))
    .extract({
      left,
      top,
      width: extractWidth,
      height: extractHeight,
    })
    .png()
    .toBuffer()
  return new Uint8Array(cropped)
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
  let breakoutOverlay: Buffer | null = null
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

    // Rebuild a clean breakout overlay from the extracted subject so overlap is
    // explicit and consistent for any creator coin subject (people, pets, logos).
    const fgCanvas = await renderPlacedArtworkLayer({
      sourceBytes: refinedFg,
      size,
      layout,
      fit: 'cover',
      anchorTop: true,
    })
    const breakoutLayer = await applyBreakoutAlphaMask({
      foregroundBytes: fgCanvas,
      layout,
    })
    breakoutOverlay = Buffer.from(breakoutLayer)
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
  const overlays: sharp.OverlayOptions[] = []
  if (breakoutOverlay && breakoutOverlay.length > 0) {
    overlays.push({ input: await applyLayerOpacity(breakoutOverlay, 0.95), blend: 'over' })
  }
  overlays.push({ input: await applyLayerOpacity(glowBytes, 0.32), blend: 'screen' })

  return await sharp(cleaned)
    .composite(overlays)
    .flatten({ background: TOKEN_ICON_STYLE.backgroundOuter })
    .png()
    .toBuffer()
}

async function renderPlacedArtworkLayer(params: {
  sourceBytes: Uint8Array
  size: number
  layout: TokenIconLayout
  fit: ArtworkFitMode
  anchorTop?: boolean
}): Promise<Uint8Array> {
  const anchorTop = params.anchorTop === true && params.fit === 'cover'
  const coverPosition = anchorTop ? 'top' : 'centre'
  const placed = await sharp(Buffer.from(params.sourceBytes))
    .rotate()
    .resize(params.layout.artSize, params.layout.artSize, {
      fit: params.fit,
      // Only top-anchor breakout layers; otherwise center to avoid bottom dark bands.
      position: params.fit === 'cover' ? coverPosition : 'centre',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const coverTopBias = anchorTop ? Math.round(params.layout.panelSize * 0.052) : 0
  const subtleTopBias = !anchorTop && params.fit === 'cover' ? Math.round(params.layout.panelSize * 0.008) : 0
  const compositeTop = Math.max(0, params.layout.artY - coverTopBias - subtleTopBias)

  const canvas = await sharp({
    create: { width: params.size, height: params.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: placed, left: params.layout.artX, top: compositeTop }])
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
  const clipMask = await sharp(Buffer.from(clipSvg)).blur(0.65).png().toBuffer()
  const clipped = await sharp(Buffer.from(layerBytes))
    .ensureAlpha()
    .composite([{ input: clipMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  return new Uint8Array(clipped)
}

async function applyReferenceAlphaMask(params: {
  layerBytes: Uint8Array
  alphaReferenceBytes: Uint8Array
  layout?: TokenIconLayout
}): Promise<Uint8Array> {
  const baseAlphaMask = await sharp(Buffer.from(params.alphaReferenceBytes))
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(58)
    .erode(1)
    .dilate(1)
    .blur(0.45)
    .png()
    .toBuffer()

  let masked = await sharp(Buffer.from(params.layerBytes))
    .ensureAlpha()
    .composite([{ input: baseAlphaMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  if (params.layout) {
    const { layout } = params
    const refRaw = await sharp(Buffer.from(params.alphaReferenceBytes))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const dominantMask = await buildDominantBreakoutComponentMask({
      rgba: Buffer.from(refRaw.data),
      width: refRaw.info.width,
      height: refRaw.info.height,
      channels: refRaw.info.channels,
      region: {
        left: layout.panelX + layout.panelSize * 0.1,
        right: layout.panelX + layout.panelSize * 0.9,
        top: layout.panelY - layout.panelSize * 0.28,
        bottom: layout.panelY + layout.panelSize * 0.12,
      },
      alphaThreshold: 40,
    })
    if (dominantMask) {
      masked = await sharp(masked)
        .ensureAlpha()
        .composite([{ input: dominantMask, blend: 'dest-in' }])
        .png()
        .toBuffer()
    }
  }

  return new Uint8Array(masked)
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
  const selectedMask = new Uint8Array(pixelCount)
  let bestScore = 0
  const centerX = rLeft + regionWidth / 2
  const minArea = Math.max(42, Math.round(regionWidth * regionHeight * 0.0022))
  type Candidate = {
    score: number
    indices: number[]
  }
  const candidates: Candidate[] = []

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
      const heightRatio = compHeight / Math.max(1, regionHeight)
      const widthRatio = compWidth / Math.max(1, regionWidth)
      const earBonus = heightRatio > 0.42 && widthRatio < 0.38 ? 1.45 : 1.0
      const stripPenalty = widthRatio >= 0.92 && compHeight <= Math.round(regionHeight * 0.4) ? 0.42 : 1

      const score = area * (0.28 + 0.55 * topAffinity + 0.17 * centerAffinity) * stripPenalty * earBonus
      if (score > bestScore) bestScore = score
      candidates.push({ score, indices })
    }
  }

  if (bestScore <= 0 || candidates.length === 0) return null
  const scoreFloor = bestScore * 0.26
  const kept = candidates
    .filter((c) => c.score >= scoreFloor)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  if (kept.length === 0) return null
  for (const candidate of kept) {
    for (const idx of candidate.indices) selectedMask[idx] = 255
  }

  return await sharp(Buffer.from(selectedMask), { raw: { width, height, channels: 1 } })
    .dilate(2)
    .blur(1.15)
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
  // Keep overlap wide enough to avoid seams but not full-width strip edits.
  const maxZoneWidth = Math.max(1, Math.round(layout.panelSize * 0.82))
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
  const continuityMask = await sharp(masked)
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(14)
    .dilate(1)
    .blur(0.75)
    .png()
    .toBuffer()
  const cleaned = await sharp(masked)
    .ensureAlpha()
    .composite([{ input: continuityMask, blend: 'dest-in' }])
    .blur(0.85)
    .png()
    .toBuffer()
  return new Uint8Array(cleaned)
}

function getDeterministicRecipe(): TokenIconRecipe {
  return {
    ...TOKEN_ICON_RECIPES.cover,
    scale: 1.04,
    innerPadding: 0,
    breakout: false,
  }
}

async function renderDeterministicBaseLayer(params: {
  size: number
  layout: TokenIconLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const outerCardInset = Math.round(size * 0.012)
  const outerCardSize = size - outerCardInset * 2
  const outerCardRadius = Math.round(size * 0.22)

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bgFade" cx="50%" cy="45%" r="72%">
        <stop offset="0%" stop-color="#010611"/>
        <stop offset="50%" stop-color="#00040b"/>
        <stop offset="100%" stop-color="#000000"/>
      </radialGradient>

      <linearGradient id="outerCard" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#01050f"/>
        <stop offset="100%" stop-color="#000204"/>
      </linearGradient>

      <linearGradient id="innerPanel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#091326"/>
        <stop offset="100%" stop-color="#03070f"/>
      </linearGradient>
    </defs>

    <rect width="${size}" height="${size}" fill="#000000"/>
    <rect width="${size}" height="${size}" rx="${layout.outerRadius}" fill="url(#bgFade)"/>

    <rect
      x="${outerCardInset}"
      y="${outerCardInset}"
      width="${outerCardSize}"
      height="${outerCardSize}"
      rx="${outerCardRadius}"
      fill="url(#outerCard)"
    />

    <rect
      x="${layout.panelX}"
      y="${layout.panelY}"
      width="${layout.panelSize}"
      height="${layout.panelSize}"
      rx="${layout.panelRadius}"
      fill="url(#innerPanel)"
    />
  </svg>`

  const base = await sharp(Buffer.from(svg)).png().toBuffer()

  const recessSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="${layout.panelX}"
      y="${layout.panelY}"
      width="${layout.panelSize}"
      height="${layout.panelSize}"
      rx="${layout.panelRadius}"
      fill="none"
      stroke="black"
      stroke-opacity="0.34"
      stroke-width="${Math.max(9, Math.round(size * 0.02))}"
    />
  </svg>`

  const recess = await sharp(Buffer.from(recessSvg))
    .blur(6)
    .png()
    .toBuffer()

  return sharp(base)
    .composite([{ input: recess, blend: 'multiply' }])
    .png()
    .toBuffer()
}

async function loadFrameOverlay(size: number, layout?: TokenIconLayout): Promise<Buffer | null> {
  const envPath = typeof process.env.TOKEN_FRAME_OVERLAY_PATH === 'string' ? process.env.TOKEN_FRAME_OVERLAY_PATH.trim() : ''
  const candidates = [
    envPath,
    '/mnt/data/logo.png',
    DEFAULT_TOKEN_FRAME_OVERLAY_PATH,
  ].filter((value) => value.length > 0)

  for (const path of candidates) {
    try {
      const resized = await sharp(path)
        .resize(size, size, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer()
      if (!layout) return resized

      // Treat provided overlays as frame-only assets by masking to the
      // border neighborhood plus the top glow zone.
      const strokeWidth = Math.max(6, Math.round(layout.panelSize * 0.22))
      const topGlowWidth = Math.max(1, Math.round(layout.panelSize * 0.62))
      const topGlowLeft = Math.round(layout.panelX + (layout.panelSize - topGlowWidth) / 2)
      const topGlowTop = Math.max(0, Math.round(layout.panelY - layout.panelSize * 0.14))
      const topGlowHeight = Math.max(1, Math.round(layout.panelSize * 0.16))
      const glowRadius = Math.max(1, Math.round(topGlowWidth * 0.2))
      const maskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="${layout.panelX}"
          y="${layout.panelY}"
          width="${layout.panelSize}"
          height="${layout.panelSize}"
          rx="${layout.panelRadius}"
          fill="none"
          stroke="white"
          stroke-width="${strokeWidth}"
        />
        <rect
          x="${topGlowLeft}"
          y="${topGlowTop}"
          width="${topGlowWidth}"
          height="${topGlowHeight}"
          rx="${glowRadius}"
          fill="white"
        />
      </svg>`
      const mask = await sharp(Buffer.from(maskSvg)).blur(0.8).png().toBuffer()
      const frameOnly = await sharp(resized)
        .ensureAlpha()
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer()
      const stats = await sharp(frameOnly).stats()
      const alphaMean = stats.channels[3]?.mean ?? 0
      if (alphaMean < 2) {
        continue
      }
      return frameOnly
    } catch {
      // Continue to next candidate.
    }
  }
  return null
}

async function renderDeterministicFrameLayer(params: {
  size: number
  layout: TokenIconLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const stroke = Math.max(14, Math.round(size * 0.032))
  const inset = stroke / 2
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="frameStroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f2f7ff"/>
        <stop offset="35%" stop-color="#d9e7ff"/>
        <stop offset="72%" stop-color="#9bbcff"/>
        <stop offset="100%" stop-color="#2f6fff"/>
      </linearGradient>
    </defs>

    <rect
      x="${layout.panelX + inset}"
      y="${layout.panelY + inset}"
      width="${layout.panelSize - stroke}"
      height="${layout.panelSize - stroke}"
      rx="${Math.max(0, layout.panelRadius - inset)}"
      fill="none"
      stroke="url(#frameStroke)"
      stroke-width="${stroke}"
      stroke-linejoin="round"
    />
  </svg>`
  const crispFrame = await sharp(Buffer.from(svg)).png().toBuffer()
  const bloomBlur = Math.max(1.4, size * 0.0028)
  const bloomLayer = await sharp(crispFrame)
    .blur(bloomBlur)
    .png()
    .toBuffer()
  const bloom = await applyLayerOpacity(bloomLayer, 0.42)
  return sharp(bloom)
    .composite([{ input: crispFrame, blend: 'over' }])
    .png()
    .toBuffer()
}

async function renderPremiumOuterGlow(size: number, layout: TokenIconLayout): Promise<Buffer> {
  const glowStroke = Math.max(20, Math.round(size * 0.058))
  const inset = glowStroke / 2
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="${layout.panelX + inset}"
      y="${layout.panelY + inset}"
      width="${layout.panelSize - glowStroke}"
      height="${layout.panelSize - glowStroke}"
      rx="${Math.max(0, layout.panelRadius - inset)}"
      fill="none"
      stroke="#2563eb"
      stroke-width="${glowStroke}"
      opacity="1"
    />
  </svg>`

  const base = await sharp(Buffer.from(svg)).png().toBuffer()
  const blurA = await sharp(base)
    .blur(Math.max(12, Math.round(size * 0.04)))
    .png()
    .toBuffer()
  const blurB = await sharp(base)
    .blur(Math.max(22, Math.round(size * 0.075)))
    .png()
    .toBuffer()

  const merged = await sharp(blurB)
    .composite([
      { input: blurA, blend: 'screen' },
      { input: blurB, blend: 'screen' },
    ])
    .png()
    .toBuffer()

  const holeSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="${layout.panelX}"
      y="${layout.panelY}"
      width="${layout.panelSize}"
      height="${layout.panelSize}"
      rx="${layout.panelRadius}"
      fill="white"
    />
  </svg>`
  const hole = await sharp(Buffer.from(holeSvg)).png().toBuffer()

  return sharp(merged)
    .ensureAlpha()
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()
}

async function renderDeterministicFallbackLayer(params: {
  size: number
  layout: TokenIconLayout
  symbol: string
}): Promise<Uint8Array> {
  const { size, layout, symbol } = params
  const normalized = symbol.trim()
  const label = normalized.length > 0 ? normalized.slice(0, 4).toUpperCase() : '■'
  const safeLabel = escapeXml(label)
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${size / 2}"
      y="${size / 2}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="${Math.round(layout.panelSize * 0.2)}"
      font-weight="700"
      letter-spacing="0.03em"
      fill="#dbeafe"
      opacity="0.88"
    >${safeLabel}</text>
  </svg>`
  const layer = await sharp(Buffer.from(svg)).png().toBuffer()
  return new Uint8Array(layer)
}

async function createTopBreakoutMask(params: {
  size: number
  layout: TokenIconLayout
}): Promise<Buffer> {
  const { size, layout } = params
  const bandTop = Math.max(0, Math.round(layout.panelY - layout.panelSize * 0.09))
  const bandBottom = Math.min(size, Math.round(layout.panelY + layout.panelSize * 0.02))
  const centerWidth = Math.max(1, Math.round(layout.panelSize * 0.34))
  const left = Math.round(layout.panelX + (layout.panelSize - centerWidth) / 2)
  const maskHeight = Math.max(1, bandBottom - bandTop)
  const radius = Math.max(1, Math.round(centerWidth * 0.22))

  const verticalSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeY" x1="0" y1="${bandTop}" x2="0" y2="${bandBottom}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="white" stop-opacity="1"/>
        <stop offset="55%" stop-color="white" stop-opacity="1"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect
      x="${left}"
      y="${bandTop}"
      width="${centerWidth}"
      height="${maskHeight}"
      rx="${radius}"
      fill="url(#fadeY)"
    />
  </svg>`
  const horizontalSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeX" x1="${left}" y1="0" x2="${left + centerWidth}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="white" stop-opacity="0"/>
        <stop offset="25%" stop-color="white" stop-opacity="1"/>
        <stop offset="75%" stop-color="white" stop-opacity="1"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect
      x="${left}"
      y="${bandTop}"
      width="${centerWidth}"
      height="${maskHeight}"
      rx="${radius}"
      fill="url(#fadeX)"
    />
  </svg>`
  const vertical = await sharp(Buffer.from(verticalSvg)).png().toBuffer()
  const horizontal = await sharp(Buffer.from(horizontalSvg)).png().toBuffer()
  return sharp(vertical)
    .ensureAlpha()
    .composite([{ input: horizontal, blend: 'dest-in' }])
    .blur(0.35)
    .png()
    .toBuffer()
}

async function createTopBreakoutLayer(params: {
  sourceBytes: Uint8Array
  size: number
  layout: TokenIconLayout
}): Promise<Buffer> {
  const { sourceBytes, size, layout } = params
  const placed = await renderPlacedArtworkLayer({
    sourceBytes,
    size,
    layout,
    fit: 'cover',
    anchorTop: false,
  })
  const breakoutMask = await createTopBreakoutMask({ size, layout })
  const masked = await sharp(Buffer.from(placed))
    .ensureAlpha()
    .composite([{ input: breakoutMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  return applyLayerOpacity(masked, 0.52)
}

async function renderDeterministicTokenIcon(params: {
  size: number
  sourceBytes: Uint8Array | null
  heroCutoutSourceBytes?: Uint8Array | null
  suppressBreakout?: boolean
  symbol: string
  signatureText?: string
  renderPreset?: 'standard' | 'hero' | 'pixel'
}): Promise<Uint8Array> {
  try {
    const premium = await renderPremiumTokenIcon({
      size: params.size,
      sourceImage: params.sourceBytes ?? undefined,
      heroCutoutSourceImage: params.heroCutoutSourceBytes ?? undefined,
      suppressBreakout: params.suppressBreakout,
      symbol: params.symbol,
      signatureText: params.signatureText ?? params.symbol,
      renderPreset: params.renderPreset,
    })
    return new Uint8Array(premium)
  } catch (error) {
    console.warn('[token/image] premium token icon renderer failed; falling back to deterministic compatibility path:', error)
  }

  let preparedSource: Uint8Array | null = null
  let sourceMetrics: TokenImageMetrics | null = null
  let sourceIsLowRes = false
  let brightnessProfile: { meanLuma: number; edgeLuma: number } | null = null
  let topCenterTexture: { topCenterStdDev: number } | null = null

  if (params.sourceBytes && params.sourceBytes.length > 0) {
    try {
      const normalized = await normalizeImageToPng(params.sourceBytes)
      preparedSource = await cropTransparentPadding(normalized)
      sourceMetrics = await analyzeTokenImageBytes(preparedSource)
      sourceIsLowRes = await isLowResolutionSource(preparedSource, params.size)
      brightnessProfile = await analyzeBrightnessProfile(preparedSource)
      topCenterTexture = await analyzeTopCenterTexture(preparedSource)
    } catch (error) {
      // Some creator overrides can contain malformed bytes. Fallback to deterministic glyph icon.
      console.warn('[token/image] deterministic source preprocessing failed; using fallback icon:', error)
      preparedSource = null
      sourceMetrics = null
      sourceIsLowRes = false
      brightnessProfile = null
      topCenterTexture = null
    }
  }

  let recipe = getDeterministicRecipe()
  if (brightnessProfile && (brightnessProfile.meanLuma > 190 || brightnessProfile.edgeLuma > 205)) {
    recipe = {
      ...recipe,
      scale: 1.0,
    }
  }
  const layout = getTokenIconLayout(params.size, recipe)
  const baseLayer = await renderDeterministicBaseLayer({
    size: params.size,
    layout,
  })

  let artLayer: Uint8Array | null = null
  if (preparedSource) {
    const placed = await renderPlacedArtworkLayer({
      sourceBytes: preparedSource,
      size: params.size,
      layout,
      fit: 'cover',
      anchorTop: false,
    })
    artLayer = await clipLayerToInnerPanel({
      layerBytes: placed,
      size: params.size,
      layout,
    })
  } else {
    artLayer = await renderDeterministicFallbackLayer({
      size: params.size,
      layout,
      symbol: params.symbol,
    })
  }

  const frameLayer = await renderDeterministicFrameLayer({
    size: params.size,
    layout,
  })

  const overlays: sharp.OverlayOptions[] = []
  if (artLayer && artLayer.length > 0) {
    overlays.push({
      input: Buffer.from(artLayer),
      blend: 'over',
    })
  }

  const premiumGlow = await renderPremiumOuterGlow(params.size, layout)
  overlays.push({
    input: premiumGlow,
    blend: 'screen',
  })

  overlays.push({
    input: frameLayer,
    blend: 'over',
  })

  const isBrightBackground =
    !!brightnessProfile &&
    (brightnessProfile.meanLuma > 190 || brightnessProfile.edgeLuma > 205)
  const hasTopCenterTexture = !!topCenterTexture && topCenterTexture.topCenterStdDev > 19
  const topOccupancy = sourceMetrics?.topOccupancy ?? 0
  const topOccupancyOk =
    topOccupancy > 0.045 &&
    (sourceMetrics?.hasTransparency ? topOccupancy < 0.26 : topOccupancy < 0.15)
  const shouldUseBreakout =
    !!preparedSource &&
    !!sourceMetrics &&
    !sourceIsLowRes &&
    !isBrightBackground &&
    topOccupancyOk &&
    hasTopCenterTexture

  if (shouldUseBreakout && preparedSource) {
    const topBreakoutLayer = await createTopBreakoutLayer({
      sourceBytes: preparedSource,
      size: params.size,
      layout,
    })
    if (topBreakoutLayer.length > 0) {
      overlays.push({
        input: topBreakoutLayer,
        blend: 'over',
      })
    }
  }

  const png = await sharp(baseLayer)
    .composite(overlays)
    .flatten({ background: TOKEN_ICON_STYLE.backgroundOuter })
    .png()
    .toBuffer()

  return new Uint8Array(png)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function getOrCreatePng(params: {
  chainId: number
  shareOft: Address
  creatorCoin: Address | null
  upstreamUrl: string | null
  heroCutoutUpstreamUrl?: string | null
  size: number
  symbol: string
  signatureText?: string
  renderPreset?: 'standard' | 'hero' | 'pixel'
  sourceBytesOverride?: Uint8Array | null
  sourceFingerprintOverride?: string | null
}): Promise<Uint8Array> {
  const shareOftLc = params.shareOft.toLowerCase()
  const url = typeof params.upstreamUrl === 'string' ? params.upstreamUrl.trim() : ''
  const creatorCoinLc = params.creatorCoin ? params.creatorCoin.toLowerCase() : null
  const sourceFingerprint =
    (typeof params.sourceFingerprintOverride === 'string' && params.sourceFingerprintOverride.trim().length > 0
      ? params.sourceFingerprintOverride.trim()
      : null) ??
    (params.sourceBytesOverride && params.sourceBytesOverride.length > 0
      ? sha256Hex(Buffer.from(params.sourceBytesOverride).toString('base64'))
      : url
        ? sha256Hex(url)
        : 'no-upstream')
  const heroCutoutFingerprint = params.heroCutoutUpstreamUrl
    ? sha256Hex(params.heroCutoutUpstreamUrl)
    : 'no-hero-cutout'
  const signatureFingerprint = params.signatureText
    ? sha256Hex(params.signatureText.toLowerCase())
    : 'no-signature'
  const recipeSeed = `${creatorCoinLc ?? 'no-coin'}:${sourceFingerprint}:${heroCutoutFingerprint}:${signatureFingerprint}:${params.renderPreset ?? 'standard'}:${FRAME_STYLE_V}:${params.size}`

  const tokenKey = `token-images/v1/base/${params.chainId}/${shareOftLc}/size-${params.size}/frame-${FRAME_STYLE_V}/${sha256Hex(
    recipeSeed,
  )}.png`
  const cachedToken = await blobHeadOrNull(tokenKey)
  if (cachedToken?.url) {
    const { bytes } = await fetchBytes(cachedToken.url)
    return bytes
  }

  const sourceBytes = params.sourceBytesOverride ?? (await fetchSourceArtworkBytes({ upstreamUrl: params.upstreamUrl }))
  const heroCutoutSourceBytes = await fetchSourceArtworkBytes({ upstreamUrl: params.heroCutoutUpstreamUrl ?? null })
  const heroCutoutLoadPolicy = resolveHeroCutoutLoadPolicy({
    heroCutoutArtworkUrl: params.heroCutoutUpstreamUrl ?? null,
    heroCutoutSourceBytes,
  })
  const pngBytes = await renderDeterministicTokenIcon({
    size: params.size,
    sourceBytes,
    heroCutoutSourceBytes,
    suppressBreakout: heroCutoutLoadPolicy.suppressBreakout,
    symbol: params.symbol,
    signatureText: params.signatureText ?? params.symbol,
    renderPreset: params.renderPreset,
  })

  // Avoid caching contained fallback output when a hero cutout URL exists
  // but is temporarily unavailable; this prevents stale cache poisoning.
  if (!heroCutoutLoadPolicy.heroCutoutLoadFailed) {
    try {
      await blobPutBytes({ pathname: tokenKey, bytes: pngBytes, contentType: 'image/png', cacheControlMaxAgeSeconds: 31_536_000 })
    } catch {
      // ignore
    }
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
  recipe = getDefaultRecipe(),
}: FramedSvgParams): string {
  const resolvedBaseLayerImage = baseLayerImage ?? creatorCoinImage ?? null
  const layout = getTokenIconLayout(size, recipe)
  const thinFrameStroke = Math.max(1, Math.round(size * 0.0023))

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
  ${glowLayerImage ? `<image href="${glowLayerImage}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none" opacity="${TOKEN_ICON_STYLE.glowOpacity}"/>` : ''}
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
  <rect
    data-frame='inner'
    x="${layout.panelX}"
    y="${layout.panelY}"
    width="${layout.panelSize}"
    height="${layout.panelSize}"
    rx="${layout.panelRadius}"
    fill="none"
    stroke="#8fb3ff"
    stroke-opacity="0.58"
    stroke-width="${thinFrameStroke}"
    vector-effect="non-scaling-stroke"
  />
  ${breakoutElement}
  <title>${safeSymbol}</title>
</svg>`
}

export const __testables = {
  normalizeSourceArtworkUrl,
  resolveHeroCutoutLoadPolicy,
  resolveCreatorTokenArtwork,
  getTokenIconLayout,
  createTopBreakoutMask,
  renderDeterministicFrameLayer,
  renderDeterministicTokenIcon,
}
