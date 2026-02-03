import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import { base } from 'viem/chains'

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
 * Generates a token image that frames the original creator coin image
 * with a CreatorVaults-style rounded-square outline (from `miniapp-splash.svg`).
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

    // If caller explicitly wants SVG, return SVG (still best-effort stable: prefer cached blob URL when available).
    if (format === 'svg') {
      const creatorCoinImageHref = await resolveStableCreatorCoinImageHref({
        chainId,
        creatorCoin,
        upstreamUrl: creatorCoinImage,
        size,
      })
      const svg = generateFramedSvg({
        size,
        symbol: String(symbol),
        creatorCoinImage: creatorCoinImageHref,
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

interface FramedSvgParams {
  size: number
  symbol: string
  creatorCoinImage: string | null
}

const SOURCE_CACHE_V = 1
const FRAME_STYLE_V = 1

async function resolveStableCreatorCoinImageHref(params: {
  chainId: number
  creatorCoin: Address | null
  upstreamUrl: string | null
  size: number
}): Promise<string | null> {
  const url = typeof params.upstreamUrl === 'string' ? params.upstreamUrl.trim() : ''
  if (!url || !params.creatorCoin) return null

  const coin = params.creatorCoin.toLowerCase()
  const urlHash = sha256Hex(url)
  // IMPORTANT: source bytes are normalized to PNG at `size` before being cached.
  // Include `size` in the cache key to avoid reusing a small cached PNG for larger requests (blurry upscales).
  const sourcePath = `coin-images/v${SOURCE_CACHE_V}/base/${params.chainId}/${coin}/${urlHash}/size-${params.size}.png`

  // If we already have it, use the Blob URL (durable, cacheable).
  const existing = await blobHeadOrNull(sourcePath)
  if (existing?.url) return existing.url

  // Otherwise, fall back to the upstream URL (SVG can safely hotlink as best-effort).
  return url
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
  const sourcePath =
    creatorCoinLc && url
      ? `coin-images/v${SOURCE_CACHE_V}/base/${params.chainId}/${creatorCoinLc}/${urlHash}/size-${params.size}.png`
      : null

  // If we have a content-addressed cached PNG already, serve it.
  const tokenKey = `token-images/v1/base/${params.chainId}/${shareOftLc}/size-${params.size}/frame-${FRAME_STYLE_V}/${sha256Hex(
    `${sourcePath ?? 'no-source'}:${FRAME_STYLE_V}:${params.size}`,
  )}.png`
  const cachedToken = await blobHeadOrNull(tokenKey)
  if (cachedToken?.url) {
    const { bytes } = await fetchBytes(cachedToken.url)
    return bytes
  }

  // Load/normalize the creator coin image (if available).
  let normalizedPngBytes: Uint8Array | null = null
  if (sourcePath && url) {
    const cachedSource = await blobHeadOrNull(sourcePath)
    if (cachedSource?.url) {
      const { bytes } = await fetchBytes(cachedSource.url)
      normalizedPngBytes = bytes
    } else {
      const fetched = await fetchBytes(url)
      // Normalize to PNG to avoid downstream SVG-in-SVG and content-type edge cases.
      const buf = await sharp(Buffer.from(fetched.bytes))
        .resize(params.size, params.size, { fit: 'cover' })
        .png()
        .toBuffer()
      normalizedPngBytes = new Uint8Array(buf)
      // Best-effort persist; if Blob isn’t configured, keep going.
      try {
        await blobPutBytes({ pathname: sourcePath, bytes: normalizedPngBytes, contentType: 'image/png', cacheControlMaxAgeSeconds: 31_536_000 })
      } catch {
        // ignore
      }
    }
  }

  const dataHref =
    normalizedPngBytes && normalizedPngBytes.length > 0
      ? `data:image/png;base64,${Buffer.from(normalizedPngBytes).toString('base64')}`
      : null

  // Build self-contained SVG (no external refs) and rasterize via sharp.
  const svg = generateFramedSvg({
    size: params.size,
    symbol: params.symbol,
    creatorCoinImage: dataHref,
  })
  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer()
  const pngBytes = new Uint8Array(pngBuf)

  // Persist final PNG (best-effort).
  try {
    await blobPutBytes({ pathname: tokenKey, bytes: pngBytes, contentType: 'image/png', cacheControlMaxAgeSeconds: 31_536_000 })
  } catch {
    // ignore
  }

  return pngBytes
}

/**
 * Generate an SVG that frames the creator coin image.
 *
 * Visual style:
 * - Use the rounded-square outline from `frontend/public/miniapp-splash.svg` as the frame overlay
 * - Put the creator coin image behind it (fetched from Zora)
 * - Keep a small bottom badge with the token symbol for wallet readability
 */
function generateFramedSvg({ size, symbol, creatorCoinImage }: FramedSvgParams): string {
  // Scale the key geometry from `miniapp-splash.svg` (viewBox 1200x1200) to arbitrary sizes.
  // Reference values in the SVG:
  // - frame rect: x=330 y=330 w=540 h=540 rx=94
  // - stroke widths: 44 (faint), 26 (primary)
  const cornerRadius = Math.round(size * 0.12) // outer token rounding (wallet-friendly)
  const outlineX = Math.round(size * (330 / 1200))
  const outlineY = outlineX
  const outlineSize = Math.round(size * (540 / 1200))
  const outlineRx = Math.round(size * (94 / 1200))
  const outlineStrokeWide = Math.max(1, Math.round(size * (44 / 1200)))
  const outlineStrokeNarrow = Math.max(1, Math.round(size * (26 / 1200)))

  const textColor = '#ffffff'

  // Symbol badge position
  const badgeHeight = Math.round(size * 0.13)
  const badgePadding = Math.round(size * 0.04)
  const fontSize = Math.round(size * 0.05)
  
  // Escape special XML characters in symbol
  const safeSymbol = symbol
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // Image fill (clip to outer rounded square).
  const imageElement = creatorCoinImage
    ? `<image
        href="${creatorCoinImage}"
        x="0"
        y="0"
        width="${size}"
        height="${size}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#outerClip)"
      />`
    : `<rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)" />
      <text
        x="${size / 2}"
        y="${size / 2}"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize * 2}"
        font-weight="700"
        fill="${textColor}"
        opacity="0.9"
      >■</text>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Background gradient (from miniapp-splash.svg) -->
    <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${Math.round(
      size * 0.35,
    )} ${Math.round(size * 0.3)}) rotate(55) scale(${Math.round(size * 1.166)} ${Math.round(size * 1.166)})">
      <stop stop-color="#151515"/>
      <stop offset="0.55" stop-color="#070707"/>
      <stop offset="1" stop-color="#000000"/>
    </radialGradient>

    <!-- "Square S" stroke gradient (from miniapp-splash.svg) -->
    <linearGradient id="cv-stroke" x1="${Math.round(size * (280 / 1200))}" y1="${Math.round(
      size * (280 / 1200),
    )}" x2="${Math.round(size * (920 / 1200))}" y2="${Math.round(size * (920 / 1200))}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#D6DCE8" />
      <stop offset="45%" stop-color="#8492B0" />
      <stop offset="80%" stop-color="#0052FF" />
      <stop offset="100%" stop-color="#0033CC" />
    </linearGradient>
    
    <!-- Outer clip for frame -->
    <clipPath id="outerClip">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}"/>
    </clipPath>
    
    <!-- Drop shadow filter -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)" />

  <!-- Creator coin image (from Zora) -->
  ${imageElement}

  <!-- Subtle dark scrim so the outline stays legible over bright images -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="rgba(0,0,0,0.28)" clip-path="url(#outerClip)"/>

  <!-- "Square S" outline overlay (frame) -->
  <rect
    x="${outlineX}"
    y="${outlineY}"
    width="${outlineSize}"
    height="${outlineSize}"
    rx="${outlineRx}"
    fill="none"
    stroke="url(#cv-stroke)"
    stroke-width="${outlineStrokeWide}"
    opacity="0.14"
    stroke-linejoin="round"
  />
  <rect
    x="${outlineX}"
    y="${outlineY}"
    width="${outlineSize}"
    height="${outlineSize}"
    rx="${outlineRx}"
    fill="none"
    stroke="url(#cv-stroke)"
    stroke-width="${outlineStrokeNarrow}"
    stroke-linejoin="round"
  />
  
  <!-- Symbol badge at bottom -->
  <g filter="url(#shadow)">
    <rect 
      x="${badgePadding}" 
      y="${size - badgeHeight - badgePadding}" 
      width="${size - badgePadding * 2}" 
      height="${badgeHeight}"
      rx="${badgeHeight / 2}"
      fill="rgba(0,0,0,0.55)"
      stroke="rgba(255,255,255,0.12)"
    />
    <text 
      x="${size / 2}" 
      y="${size - badgeHeight / 2 - badgePadding}"
      text-anchor="middle" 
      dominant-baseline="central"
      font-family="system-ui, -apple-system, 'SF Pro Display', sans-serif"
      font-size="${fontSize}"
      font-weight="700"
      fill="${textColor}"
      letter-spacing="0.05em"
    >${safeSymbol}</text>
  </g>

  <!-- Small site watermark -->
  <text
    x="${size - badgePadding * 1.5}"
    y="${badgePadding * 1.4 + fontSize * 0.6}"
    text-anchor="end"
    font-family="system-ui, -apple-system, 'SF Pro Display', sans-serif"
    font-size="${Math.max(9, Math.round(fontSize * 0.6))}"
    font-weight="600"
    fill="${textColor}"
    opacity="0.55"
  >4626.fun</text>
</svg>`
}
