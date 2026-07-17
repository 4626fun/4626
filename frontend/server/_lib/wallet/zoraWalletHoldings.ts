/**
 * Resolve Zora creator/content/trend coins held by a wallet (CSW or EOA).
 * Portfolio balances (DeBank / Base Etherscan) intersected with Zora coin metadata.
 */

import { createPublicClient, erc20Abi, formatUnits, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

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
  type ServerWalletTokenRow,
} from '../zora/zoraHoldings.js'
import { resolveTrayWalletPortfolio, type TrayPortfolioSource } from '../lens/trayPortfolioResolve.js'
import { requireServerKey } from '../../zora/_shared.js'

const BASE_CHAIN_ID = 8453
export const DEFAULT_TOP_TOKEN_COUNT = 200
export const MAX_TOP_TOKEN_COUNT = 200
const ZORA_LOOKUP_CONCURRENCY = 8
const MAX_EXTRA_TOKEN_ADDRESSES = 8

const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com']

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

function priceFromZoraCoin(coin: Record<string, unknown> | null): number {
  if (!coin) return 0
  const raw = coin.tokenPrice ?? coin.price ?? coin.marketCap
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return 0
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

/** Normalize optional pinned token addresses (e.g. profile creator coin). */
export function normalizeExtraTokenAddresses(raw: readonly string[] | null | undefined): string[] {
  if (!raw || raw.length === 0) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (out.length >= MAX_EXTRA_TOKEN_ADDRESSES) break
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (!trimmed || !isAddress(trimmed)) continue
    const lc = getAddress(trimmed).toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(lc)
  }
  return out
}

export function parseExtraTokenAddressesQuery(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  return normalizeExtraTokenAddresses(raw.split(/[,\s]+/).filter(Boolean))
}

export function unionZoraLookupAddresses(
  portfolioAddresses: readonly string[],
  extraAddresses: readonly string[],
): string[] {
  const set = new Set<string>()
  for (const addr of portfolioAddresses) {
    const lc = String(addr ?? '').trim().toLowerCase()
    if (lc.startsWith('0x') && lc.length === 42) set.add(lc)
  }
  for (const addr of extraAddresses) {
    const lc = String(addr ?? '').trim().toLowerCase()
    if (lc.startsWith('0x') && lc.length === 42) set.add(lc)
  }
  return Array.from(set).sort()
}

function resolveBaseRpcUrls(): string[] {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  const fromEnv = raw
    ? raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : []
  return Array.from(new Set(fromEnv.length > 0 ? [...fromEnv, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]))
}

/** On-chain ERC-20 balance for a pinned token missing from portfolio topTokens. */
export async function readPinnedTokenBalance(params: {
  wallet: Address
  token: Address
}): Promise<{ amount: number; decimals: number } | null> {
  for (const rpcUrl of resolveBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, { timeout: 12_000 }),
      })
      const [rawBalance, decimals] = await Promise.all([
        client.readContract({
          address: params.token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [params.wallet],
        }),
        client.readContract({
          address: params.token,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ])
      const amount = Number(formatUnits(rawBalance, decimals))
      if (!Number.isFinite(amount)) return null
      return { amount, decimals }
    } catch {
      // try next RPC
    }
  }
  return null
}

function portfolioRowAddresses(rows: ServerWalletTokenRow[]): Set<string> {
  const out = new Set<string>()
  for (const row of rows) {
    const id = row.token.id?.toLowerCase?.()
    if (id?.startsWith('0x')) out.add(id)
  }
  return out
}

export async function resolveZoraWalletHoldings(params: {
  wallet: string
  topTokenCount?: number
  chainId?: number
  /** Force-lookup addresses (e.g. profile creator coin) even if absent from topTokens. */
  extraTokenAddresses?: readonly string[] | null
  /** Test seam for on-chain pin balances. */
  readPinnedBalance?: typeof readPinnedTokenBalance
}): Promise<ZoraWalletHoldingsResult | null> {
  const trimmed = String(params.wallet ?? '').trim()
  if (!trimmed || !isAddress(trimmed)) return null

  const wallet = getAddress(trimmed)
  const topTokenCount = clampTopTokenCount(params.topTokenCount)
  const chainId = params.chainId ?? BASE_CHAIN_ID
  const extraAddresses = normalizeExtraTokenAddresses(params.extraTokenAddresses)
  const readPinnedBalance = params.readPinnedBalance ?? readPinnedTokenBalance

  const { portfolio, source } = await resolveTrayWalletPortfolio(wallet, { topTokenCount })

  const emptyResult = (asOf: number, portfolioSource: TrayPortfolioSource | null): ZoraWalletHoldingsResult => ({
    wallet,
    asOf,
    portfolioSource,
    creator: [],
    content: [],
    trend: [],
  })

  const serverWallet: ServerWalletSource = { kind: 'canonical', address: wallet, label: 'Wallet' }
  const tokenRows = buildServerZoraTokenRows({
    wallet: serverWallet,
    portfolio,
  })
  const lookupAddresses = unionZoraLookupAddresses(collectZoraLookupAddresses(tokenRows), extraAddresses)
  if (lookupAddresses.length === 0) {
    return emptyResult(portfolio?.asOf ?? Date.now(), source)
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
  const seenAddresses = new Set<string>()

  for (const holding of serverHoldings) {
    if (!holding.tokenAddress || holding.amount <= 0) continue
    const coin = zoraMap[holding.tokenAddress.toLowerCase()] ?? null
    const dto = holdingToDto(holding, coin)
    if (dto) {
      rows.push(dto)
      seenAddresses.add(dto.address.toLowerCase())
    }
  }

  // Pinned addresses not in portfolio topTokens: on-chain balanceOf, skip zeros.
  const inPortfolio = portfolioRowAddresses(tokenRows)
  const pinnedMissing = extraAddresses.filter(
    (addr) => !inPortfolio.has(addr) && !seenAddresses.has(addr) && Boolean(zoraMap[addr]),
  )

  if (pinnedMissing.length > 0) {
    const pinnedBalances = await mapWithLimit(pinnedMissing, 3, async (addressLc) => {
      const balance = await readPinnedBalance({
        wallet,
        token: getAddress(addressLc),
      })
      return [addressLc, balance] as const
    })

    for (const [addressLc, balance] of pinnedBalances) {
      if (!balance || balance.amount <= 0) continue
      const coin = zoraMap[addressLc] ?? null
      const price = priceFromZoraCoin(coin)
      const dto = holdingToDto(
        {
          tokenAddress: addressLc,
          symbol: String(coin?.symbol ?? '').trim() || 'TOKEN',
          name: String(coin?.name ?? '').trim() || 'Zora coin',
          logoUrl: null,
          amount: balance.amount,
          usdValue: price > 0 ? balance.amount * price : 0,
        },
        coin,
      )
      if (dto) {
        rows.push(dto)
        seenAddresses.add(dto.address.toLowerCase())
      }
    }
  }

  const { creator, content, trend } = splitZoraHoldingsByCoinType(rows)

  return {
    wallet,
    asOf: portfolio?.asOf ?? Date.now(),
    portfolioSource: source,
    creator,
    content,
    trend,
  }
}
