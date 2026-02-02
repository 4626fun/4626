import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import { base } from 'viem/chains'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  requireServerKey,
  setCors,
} from '../../../server/zora/_shared.js'

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
 * Generates an SVG image that frames the original creator coin image
 * with the ■TOKEN branding.
 * 
 * Query params:
 *   - address: ShareOFT token address (required)
 *   - chain: Chain ID (default: 8453 for Base)
 *   - size: Image size in pixels (default: 512, max: 1024)
 * 
 * Response: SVG image
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

    // Generate SVG with framed image
    const svg = generateFramedSvg({
      size,
      symbol: String(symbol),
      creatorCoinImage,
    })

    // Cache for 24 hours (images don't change)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800')
    res.setHeader('Content-Type', 'image/svg+xml')
    return res.status(200).send(svg)
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

/**
 * Generate an SVG that frames the creator coin image with ■TOKEN branding
 */
function generateFramedSvg({ size, symbol, creatorCoinImage }: FramedSvgParams): string {
  const frameWidth = Math.round(size * 0.08) // 8% frame width
  const innerSize = size - frameWidth * 2
  const cornerRadius = Math.round(size * 0.12) // 12% corner radius
  const innerCornerRadius = Math.round(cornerRadius * 0.7)
  
  // Colors
  const frameGradientStart = '#8B5CF6' // Purple
  const frameGradientEnd = '#3B82F6' // Blue
  const backgroundColor = '#0f0f0f'
  const textColor = '#ffffff'
  
  // Symbol badge position
  const badgeHeight = Math.round(size * 0.14)
  const badgePadding = Math.round(size * 0.03)
  const fontSize = Math.round(size * 0.055)
  
  // Escape special XML characters in symbol
  const safeSymbol = symbol
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // Build the creator coin image element
  const imageElement = creatorCoinImage
    ? `<image 
        href="${creatorCoinImage}" 
        x="${frameWidth}" 
        y="${frameWidth}" 
        width="${innerSize}" 
        height="${innerSize}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#innerClip)"
      />`
    : `<rect 
        x="${frameWidth}" 
        y="${frameWidth}" 
        width="${innerSize}" 
        height="${innerSize}" 
        rx="${innerCornerRadius}"
        fill="${backgroundColor}"
      />
      <text 
        x="${size / 2}" 
        y="${size / 2}" 
        text-anchor="middle" 
        dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize * 2}"
        font-weight="700"
        fill="${textColor}"
      >■</text>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Frame gradient -->
    <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${frameGradientStart};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${frameGradientEnd};stop-opacity:1" />
    </linearGradient>
    
    <!-- Badge gradient -->
    <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${frameGradientStart};stop-opacity:0.95" />
      <stop offset="100%" style="stop-color:${frameGradientEnd};stop-opacity:0.95" />
    </linearGradient>
    
    <!-- Inner clip path for the creator coin image -->
    <clipPath id="innerClip">
      <rect 
        x="${frameWidth}" 
        y="${frameWidth}" 
        width="${innerSize}" 
        height="${innerSize}" 
        rx="${innerCornerRadius}"
      />
    </clipPath>
    
    <!-- Outer clip for frame -->
    <clipPath id="outerClip">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}"/>
    </clipPath>
    
    <!-- Drop shadow filter -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background/Frame -->
  <rect 
    x="0" 
    y="0" 
    width="${size}" 
    height="${size}" 
    rx="${cornerRadius}"
    fill="url(#frameGradient)"
  />
  
  <!-- Inner background -->
  <rect 
    x="${frameWidth}" 
    y="${frameWidth}" 
    width="${innerSize}" 
    height="${innerSize}" 
    rx="${innerCornerRadius}"
    fill="${backgroundColor}"
  />
  
  <!-- Creator coin image or placeholder -->
  ${imageElement}
  
  <!-- Symbol badge at bottom -->
  <g filter="url(#shadow)">
    <rect 
      x="${badgePadding}" 
      y="${size - badgeHeight - badgePadding}" 
      width="${size - badgePadding * 2}" 
      height="${badgeHeight}"
      rx="${badgeHeight / 2}"
      fill="url(#badgeGradient)"
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
  
  <!-- 4626 watermark in corner -->
  <text 
    x="${size - badgePadding * 2}" 
    y="${badgePadding * 2 + fontSize / 2}"
    text-anchor="end"
    font-family="system-ui, -apple-system, 'SF Pro Display', sans-serif"
    font-size="${fontSize * 0.6}"
    font-weight="600"
    fill="${textColor}"
    opacity="0.7"
  >4626</text>
</svg>`
}
