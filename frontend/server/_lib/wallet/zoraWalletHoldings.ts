/**
 * Resolve Zora creator/content/trend coins held by a wallet (CSW or EOA).
 * Portfolio balances (DeBank / Base Etherscan) intersected with Zora coin metadata.
 */

import { getAddress, isAddress, type Address } from 'viem'

import {
  normalizeZoraCoinType,
  splitZoraHoldingsByCoinType,
  type ZoraCoinType,
} from '../zora/coinType.js'
import {
  buildServerZoraTokenRows,
  buildServerZoraHoldings,
  collectZoraLookupAddresses,
  type ServerWalletSource,
} from '../zora/zoraHoldings.js'
import { resolveTrayWalletPortfolio, type TrayPortfolioSource } from '../lens/trayPortfolioResolve.js'
import { requireServerKey } from '../../zora/_shared.js'

const BASE_CHAIN_ID = 8453
const DEFAULT_TOP_TOKEN_COUNT = 100
const MAX_TOP_TOKEN_COUNT = 100
const ZORA_LOOKUP_CONCURRENCY = 8

export type ZoraWalletHoldingDto = {
  address: string
  symbol: string
  name: string
  coinType: ZoraCoinType
  amount: number
  amountFormatted: string
  usdValue: number
  logoUrl: string | null
  chainId: number
}

export type ZoraWalletHoldingsResult = {
  wallet: string
  asOf: number
  portfolioSource: TrayPortfolioSource | null
  creator: ZoraWalletHoldingDto[]
  content: ZoraWalletHoldingDto[]
  trend: ZoraWalletHoldingDto[]
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let idx = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const current = idx++
      out[current] = await fn(items[current]!)
    }
  })
  await Promise.all(workers)
  return out
}

export function formatHoldingAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export function parseZoraProfileBalance(input: string | number): number {
  const str = String(input ?? '').trim()
  if (!str) return 0

  // If it looks like a very large integer (wei), convert to ETH
  if (/^\d{10,}$/.test(str)) {
    try {
      return Number(BigInt(str)) / 1e18
    } catch {
      return 0
    }
  }

  const num = parseFloat(str)
  return Number.isFinite(num) ? num : 0
}

function logoFromZoraCoin(coin: Record<string, unknown>): string | null {
  const media = coin.mediaContent as { previewImage?: { medium?: string; small?: string } } | undefined
  const medium = media?.previewImage?.medium
  const small = media?.previewImage?.small
  return typeof medium === 'string' && medium ? medium : typeof small === 'string' && small ? small : null
}

async function fetchZoraCoinRecord(address: string, chainId: number): Promise<Record<string, unknown> | null> {
  const key = requireServerKey()
  if (!key) return null
  if (!isAddress(address)) return null

  try {
    const sdk = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getCoin({ address: getAddress(address), chain: chainId })
    const raw = (response as { data?: { zora20Token?: unknown } }).data?.zora20Token
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function holdingToDto(
  holding: {
    tokenAddress: string | null
    symbol: string
    name: string
    logoUrl: string | null
    amount: number
    usdValue: number
  },
  coin: Record<string, unknown> | null,
): ZoraWalletHoldingDto | null {
  if (!holding.tokenAddress || !isAddress(holding.tokenAddress)) return null
  const coinType = normalizeZoraCoinType(coin?.coinType)
  const symbol = String(coin?.symbol ?? holding.symbol ?? '').trim() || holding.symbol
  const name = String(coin?.name ?? holding.name ?? '').trim() || holding.name
  return {
    address: getAddress(holding.tokenAddress),
    symbol,
    name,
    coinType,
    amount: holding.amount,
    amountFormatted: formatHoldingAmount(holding.amount),
    usdValue: holding.usdValue,
    logoUrl: logoFromZoraCoin(coin ?? {}) ?? holding.logoUrl,
    chainId: BASE_CHAIN_ID,
  }
}

export function clampTopTokenCount(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return DEFAULT_TOP_TOKEN_COUNT
  return Math.min(Math.trunc(raw), MAX_TOP_TOKEN_COUNT)
}

export async function resolveZoraWalletHoldings(params: {
  wallet: string
  topTokenCount?: number
  chainId?: number
}): Promise<ZoraWalletHoldingsResult | null> {
  const trimmed = String(params.wallet ?? '').trim()
  if (!trimmed || !isAddress(trimmed)) return null

  const wallet = getAddress(trimmed)
  const topTokenCount = clampTopTokenCount(params.topTokenCount)
  const chainId = params.chainId ?? BASE_CHAIN_ID

  const { portfolio, source } = await resolveTrayWalletPortfolio(wallet, { topTokenCount })
  if (!portfolio) {
    return {
      wallet,
      asOf: Date.now(),
      portfolioSource: source,
      creator: [],
      content: [],
      trend: [],
    }
  }

  const serverWallet: ServerWalletSource = { kind: 'canonical', address: wallet, label: 'Wallet' }
  const tokenRows = buildServerZoraTokenRows({
    wallet: serverWallet,
    portfolio,
  })
  const lookupAddresses = collectZoraLookupAddresses(tokenRows)
  if (lookupAddresses.length === 0) {
    return {
      wallet,
      asOf: portfolio.asOf ?? Date.now(),
      portfolioSource: source,
      creator: [],
      content: [],
      trend: [],
    }
  }

  const pairs = await mapWithLimit(lookupAddresses, ZORA_LOOKUP_CONCURRENCY, async (addressLc) => {
    const coin = await fetchZoraCoinRecord(addressLc, chainId)
    return [addressLc, coin] as const
  })

  const zoraMap: Record<string, Record<string, unknown> | null> = {}
  for (const [addressLc, coin] of pairs) {
    zoraMap[addressLc] = coin
  }

  const serverHoldings = buildServerZoraHoldings(tokenRows, zoraMap)
  const rows: ZoraWalletHoldingDto[] = []

  for (const holding of serverHoldings) {
    if (!holding.tokenAddress || holding.amount <= 0) continue
    const coin = zoraMap[holding.tokenAddress.toLowerCase()] ?? null
    const dto = holdingToDto(holding, coin)
    if (dto) rows.push(dto)
  }

  const { creator, content, trend } = splitZoraHoldingsByCoinType(rows)

  return {
    wallet,
    asOf: portfolio.asOf ?? Date.now(),
    portfolioSource: source,
    creator,
    content,
    trend,
  }
}
