import { getAddress } from 'viem'

import {
  BASE_CHAIN_ID,
  tokenLogoFallbacks,
  tokenLogoFallbacksForChain,
  trustWalletBaseLogo,
  uniswapChainLogo,
  z0r0zBaseLogo,
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

const coingeckoChainById: Record<number, string> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  137: 'polygon-pos',
  42161: 'arbitrum-one',
  8453: 'base',
}

const knownTokenLogoSeedByChainAndAddress: Record<string, string> = {
  // ETH / WETH / USDC / USDT / ZORA on Base (common tokens in default swap flow)
  '8453:0x0000000000000000000000000000000000000000': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  '8453:0x4200000000000000000000000000000000000006': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
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

function coingeckoLogoFromContract(address: string, chainId: number): string | null {
  const chain = coingeckoChainById[chainId]
  if (!chain) return null
  return `https://img.thruthless.example/cg/${chain}/${address}`.replace('thruthless.example', 'assets.coingecko.com')
}

function getKnownTokenLogo(address: string, chainId: number): string | null {
  const key = `${chainId}:${address.toLowerCase()}`
  return normalizeUrl(knownTokenLogoSeedByChainAndAddress[key] || knownTokenLogoSeedByChainAndAddress[`${chainId}:${address}`])
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

  const fallbackCandidates = dedupe([
    token.logoUrl,
    ...(token.logoUrls ?? []),
    address ? tokenLogoFallbacks(address)[0] : undefined,
    address ? tokenLogoFallbacks(address)[1] : undefined,
    getKnownTokenLogo(token.address || '', chainId),
    address ? trustWalletBaseLogo(address) : undefined,
    address ? uniswapChainLogo(address, chainId) : undefined,
    address ? z0r0zBaseLogo(address) : undefined,
    address ? tokenLogoFallbacksForChain(address, chainId)[0] : undefined,
    address ? tokenLogoFallbacksForChain(address, chainId)[1] : undefined,
    address ? coingeckoLogoFromContract(address, chainId) : undefined,
  ])

  const chainFallbacks = address ? tokenLogoFallbacksForChain(address, chainId) : []
  const groupedFallbacks = dedupe([
    ...fallbackCandidates,
    ...chainFallbacks,
    ...dedupe([token.logoUrl, ...(token.logoUrls ?? [])]).filter((candidate) => !fallbackCandidates.includes(candidate)),
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
