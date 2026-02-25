import { getAddress, isAddress } from 'viem'

export const BASE_CHAIN_ID = 8453
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export type TokenGroup = 'core' | 'creator' | 'share'

export type TokenOption = {
  symbol: string
  name: string
  address: string
  group: TokenGroup
  logoUrl?: string
  logoUrls?: string[]
}

export type TokenDisplay = {
  symbol: string
  name: string
  logoUrl: string | null
  logoUrls?: string[]
}

export function uniswapBaseLogo(address: string): string {
  return `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/base/assets/${getAddress(address)}/logo.png`
}

export function trustWalletBaseLogo(address: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${getAddress(address)}/logo.png`
}

export function z0r0zBaseLogo(address: string): string {
  return `https://raw.githubusercontent.com/z0r0z/assets/master/blockchains/base/assets/${getAddress(address)}/logo.png`
}

export function tokenLogoFallbacks(address: string): string[] {
  const normalized = getAddress(address)
  return [
    uniswapBaseLogo(normalized),
    trustWalletBaseLogo(normalized),
    z0r0zBaseLogo(normalized),
  ]
}

const CHAIN_NAME_MAP: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygon',
}

export function uniswapChainLogo(address: string, chainId: number): string {
  const chain = CHAIN_NAME_MAP[chainId] ?? 'base'
  return `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/${chain}/assets/${getAddress(address)}/logo.png`
}

export function tokenLogoFallbacksForChain(address: string, chainId: number): string[] {
  const chain = CHAIN_NAME_MAP[chainId] ?? 'base'
  const normalized = getAddress(address)
  return [
    `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/${chain}/assets/${normalized}/logo.png`,
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${normalized}/logo.png`,
  ]
}

export type ChainTokenConfig = {
  chainId: number
  nativeSymbol: string
  nativeName: string
  weth: string
  usdc: string
}

export function getCoreTokensForChain(config: ChainTokenConfig): TokenOption[] {
  const { chainId, nativeSymbol, nativeName, weth, usdc } = config
  const tokens: TokenOption[] = [
    {
      symbol: nativeSymbol,
      name: nativeName,
      address: NATIVE_TOKEN_ADDRESS,
      group: 'core',
      logoUrl: uniswapChainLogo(weth, chainId),
      logoUrls: tokenLogoFallbacksForChain(weth, chainId),
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: usdc,
      group: 'core',
      logoUrl: uniswapChainLogo(usdc, chainId),
      logoUrls: tokenLogoFallbacksForChain(usdc, chainId),
    },
  ]
  if (weth !== NATIVE_TOKEN_ADDRESS) {
    tokens.push({
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: weth,
      group: 'core',
      logoUrl: uniswapChainLogo(weth, chainId),
      logoUrls: tokenLogoFallbacksForChain(weth, chainId),
    })
  }
  return tokens
}

export function shareTokenLogo(address: string, chainId = BASE_CHAIN_ID): string {
  return `/api/token/image?address=${getAddress(address)}&chain=${chainId}&size=128`
}

export function shortAddress(value: string): string {
  if (!isAddress(value)) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function formatDisplayAmount(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toFixed(6)
}

export function sanitizeDecimalInput(value: string, maxFractionDigits = 18): string {
  const raw = String(value ?? '')
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const firstDotIdx = normalized.indexOf('.')
  const compact = firstDotIdx >= 0
    ? `${normalized.slice(0, firstDotIdx + 1)}${normalized.slice(firstDotIdx + 1).replace(/\./g, '')}`
    : normalized

  if (compact.startsWith('.')) return `0.${compact.slice(1, 1 + maxFractionDigits)}`
  if (!compact.includes('.')) return compact

  const [whole, fraction] = compact.split('.', 2)
  const safeWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  const safeFraction = fraction.slice(0, Math.max(0, maxFractionDigits))
  return `${safeWhole}.${safeFraction}`
}

export function sanitizeIntegerInput(value: string, maxDigits = 4): string {
  return String(value ?? '')
    .replace(/[^\d]/g, '')
    .slice(0, Math.max(1, maxDigits))
}

export function getNestedAmountOut(input: unknown): string | null {
  const obj = input as any
  const candidates = [
    obj?.quote?.output?.amount,
    obj?.output?.amount,
    // UniswapX quote shapes
    obj?.expectedAmountOut,
    obj?.expectedAmountOut?.amount,
    obj?.orderInfo?.outputs?.[0]?.startAmount,
    obj?.orderInfo?.outputs?.[0]?.amount,
    obj?.amountOut,
    obj?.outAmount,
    obj?.currencyAmountOut,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.floor(value))
  }
  return null
}

export function normalizeTokenAddress(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || !isAddress(trimmed)) return null
  return getAddress(trimmed)
}

export function areEquivalentSwapTokens(
  tokenA: string | null | undefined,
  tokenB: string | null | undefined,
  wrappedNativeAddress?: string | null,
): boolean {
  const a = normalizeTokenAddress(tokenA)
  const b = normalizeTokenAddress(tokenB)
  if (!a || !b) return false
  if (a.toLowerCase() === b.toLowerCase()) return true

  const wrapped = normalizeTokenAddress(wrappedNativeAddress)
  if (!wrapped) return false
  const aIsNative = a.toLowerCase() === NATIVE_TOKEN_ADDRESS
  const bIsNative = b.toLowerCase() === NATIVE_TOKEN_ADDRESS
  if ((aIsNative && b.toLowerCase() === wrapped.toLowerCase()) || (bIsNative && a.toLowerCase() === wrapped.toLowerCase())) {
    return true
  }
  return false
}

export function uniqueTokenOptions(options: TokenOption[]): TokenOption[] {
  const seen = new Set<string>()
  return options.filter((token) => {
    const normalized = normalizeTokenAddress(token.address)
    if (!normalized) return false
    const lc = normalized.toLowerCase()
    if (seen.has(lc)) return false
    seen.add(lc)
    return true
  })
}

export function buildTokenOptions(params: {
  coreTokens: TokenOption[]
  creatorCoin?: string | null
  shareCoin?: string | null
  shareSymbol?: string | null
  shareName?: string | null
  chainId?: number
}): TokenOption[] {
  const out: TokenOption[] = [...params.coreTokens]

  const creatorCoin = normalizeTokenAddress(params.creatorCoin)
  if (creatorCoin) {
    out.push({
      symbol: 'Creator Coin',
      name: 'Creator Coin',
      address: creatorCoin,
      group: 'creator',
    })
  }

  const shareCoin = normalizeTokenAddress(params.shareCoin)
  if (shareCoin) {
    const shareSymbol = String(params.shareSymbol ?? '').trim()
    const shareName = String(params.shareName ?? '').trim()
    out.push({
      symbol: shareSymbol || 'Share Token',
      name: shareName || shareSymbol || 'Share Token',
      address: shareCoin,
      group: 'share',
      logoUrl: shareTokenLogo(shareCoin, params.chainId ?? BASE_CHAIN_ID),
    })
  }

  return uniqueTokenOptions(out)
}

export function resolveTokenDisplay(params: {
  option: TokenOption | null
  address: string
  onchain: { name?: string; symbol?: string } | null | undefined
  imageUrl: string | null | undefined
}): TokenDisplay {
  const isCore = params.option?.group === 'core'
  const symbol = isCore
    ? (params.option?.symbol ?? shortAddress(params.address))
    : (params.onchain?.symbol?.trim() || params.option?.symbol || shortAddress(params.address))
  const name = isCore
    ? (params.option?.name ?? params.option?.symbol ?? shortAddress(params.address))
    : (params.onchain?.name?.trim() || params.option?.name || params.option?.symbol || shortAddress(params.address))

  const fallbackUrls = isAddress(params.address) ? tokenLogoFallbacks(params.address) : []
  const logoCandidates = [
    params.option?.logoUrl,
    ...(params.option?.logoUrls ?? []),
    params.imageUrl,
    ...fallbackUrls,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const uniqueLogoCandidates = Array.from(new Set(logoCandidates))
  const logoUrl = uniqueLogoCandidates[0] ?? null

  return { symbol, name, logoUrl, logoUrls: uniqueLogoCandidates }
}

