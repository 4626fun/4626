import { getAddress, isAddress } from 'viem'

export const BASE_CHAIN_ID = 8453

export type TokenGroup = 'core' | 'creator' | 'share'

export type TokenOption = {
  symbol: string
  name: string
  address: string
  group: TokenGroup
  logoUrl?: string
}

export type TokenDisplay = {
  symbol: string
  name: string
  logoUrl: string | null
}

export function trustWalletBaseLogo(address: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${getAddress(address)}/logo.png`
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
  const logoUrl = params.option?.logoUrl || params.imageUrl || null
  return { symbol, name, logoUrl }
}

