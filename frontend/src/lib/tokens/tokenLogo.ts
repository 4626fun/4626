import { getAddress } from 'viem'

import {
  BASE_CHAIN_ID,
  tokenLogoFallbacksForChain,
  type TokenOption,
} from '@/lib/uniswap/swapUtils'

export type TokenLogoSeed = Pick<TokenOption, 'address' | 'logoUrl' | 'logoUrls'> & {
  group?: TokenOption['group']
  chainId?: number
  symbol?: string
}

export type TokenLogoLookup = {
  preferred: string | null
  fallbackUrls: string[]
  cacheHit: boolean
  cacheKey: string
}

type LogoCacheShape = Record<string, string>
const STORAGE_KEY = 'swap-token-logo-cache-v1'
const logoCache: LogoCacheShape = {}

/** Canonical Zora ERC-20 mark — Uniswap's Base asset list does not ship a logo for 0x420…0777. */
export const ZORA_TOKEN_LOGO_URL = '/brands/zora-token.svg'

const knownTokenLogoSeedByChainAndAddress: Record<string, string> = {
  // ETH / WETH / USDC / USDT / ZORA on Base (common tokens in default swap flow)
  '8453:0x0000000000000000000000000000000000000000': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  '8453:0x4200000000000000000000000000000000000006': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  '8453:0x4200000000000000000000000000000000000777': ZORA_TOKEN_LOGO_URL,
  '8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  '8453:0xfde4c96c8593536e31f229ea8f37b2ad2699bb2': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  '8453:0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
}

function normalizeChainId(chainId: number | undefined): number {
  return typeof chainId === 'number' && Number.isFinite(chainId) && chainId > 0
    ? Math.trunc(chainId)
    : BASE_CHAIN_ID
}

function normalizeAddress(address: string): string | null {
  try {
    return getAddress(address)
  } catch {
    return null
  }
}

function normalizeUrl(candidate: string | null | undefined): string | null {
  if (!candidate || typeof candidate !== 'string') return null
  const value = candidate.trim()
  if (!value) return null
  return value
}

function loadCachedUrls(): void {
  if (typeof window === 'undefined') return
  if (Object.keys(logoCache).length > 0) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as LogoCacheShape
    if (parsed && typeof parsed === 'object') {
      Object.assign(logoCache, parsed)
    }
  } catch {
    // ignore cache read failures
  }
}

function cacheKeyFor(address: string, chainId: number): string {
  const safeAddress = address.toLowerCase()
  return `${safeAddress}@${chainId}`
}

function persistCachedUrl(cacheKey: string, url: string): void {
  if (typeof window === 'undefined') return
  logoCache[cacheKey] = url
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logoCache))
  } catch {
    // ignore quota errors
  }
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const raw = normalizeUrl(value)
    if (!raw) continue
    const normalized = raw.trim()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      out.push(normalized)
    }
  }
  return out
}

function getKnownTokenLogo(address: string, chainId: number): string | null {
  const key = `${chainId}:${address.toLowerCase()}`
  return normalizeUrl(knownTokenLogoSeedByChainAndAddress[key] || knownTokenLogoSeedByChainAndAddress[`${chainId}:${address}`])
}

function canonicalTokenImageUrl(
  address: string,
  chainId: number,
  tokenKind?: 'creator' | 'share',
): string {
  const tokenKindSuffix = tokenKind ? `&tokenKind=${tokenKind}` : ''
  return `/api/v1/token/${address.toLowerCase()}/image?chain=${chainId}&format=png&style=raw${tokenKindSuffix}`
}

/**
 * Build a deterministic logo list in priority order.
 * It includes curated metadata first, then curated fallbacks by chain.
 * Returns the cached successful URL separately to avoid stale broken chains.
 */
export function getTokenLogo(token: TokenLogoSeed): TokenLogoLookup {
  const chainId = normalizeChainId(token.chainId)
  const address = normalizeAddress(token.address || '')
  const cacheKey = cacheKeyFor(token.address || '0x0000000000000000000000000000000000000000', chainId)

  loadCachedUrls()
  const cached = logoCache[cacheKey]
  if (cached) {
    return {
      preferred: cached,
      fallbackUrls: [],
      cacheHit: true,
      cacheKey,
    }
  }

  const knownTokenLogo = getKnownTokenLogo(token.address || '', chainId)
  const knownCoreToken = Boolean(knownTokenLogo)
  const shouldUseExternalRegistryFallbacks = token.group === 'core' || knownCoreToken
  const skipPremiumRendererForKnownCore =
    knownCoreToken && (token.group === 'core' || token.group === undefined)
  const internalRendererFallback =
    address && !skipPremiumRendererForKnownCore
      ? token.group === 'creator'
        ? canonicalTokenImageUrl(address, chainId, 'creator')
        : token.group === 'share'
          ? canonicalTokenImageUrl(address, chainId, 'share')
          : canonicalTokenImageUrl(address, chainId)
      : null
  const externalRegistryFallbacks = shouldUseExternalRegistryFallbacks && address ? tokenLogoFallbacksForChain(address, chainId) : []

  const groupedFallbacks = dedupe([
    token.logoUrl,
    ...(token.logoUrls ?? []),
    knownTokenLogo,
    internalRendererFallback,
    ...externalRegistryFallbacks,
  ])

  return {
    preferred: groupedFallbacks[0] ?? null,
    fallbackUrls: groupedFallbacks.slice(1),
    cacheHit: false,
    cacheKey,
  }
}

export function markTokenLogoSuccess(cacheKey: string, url: string): void {
  if (!cacheKey || !url) return
  persistCachedUrl(cacheKey, url)
}
