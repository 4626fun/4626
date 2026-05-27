import { getAddress, isAddress, type Address } from 'viem'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import type { TrayTokenHolding } from '@/components/account/trayPortfolioHelpers'
import { parseApiEnvelope } from '@/lib/api/apiEnvelope'
import { BASE_CHAIN_ID } from '@/lib/uniswap/swapUtils'

export type SwapZoraHoldingRow = {
  option: SwapTokenOption
  balanceFormatted: string
}

export type ZoraWalletHoldingDto = {
  address: string
  symbol: string
  name: string
  coinType: 'CREATOR' | 'CONTENT'
  amount: number
  amountFormatted: string
  usdValue: number
  logoUrl: string | null
  chainId: number
}

export type ZoraWalletHoldingsResult = {
  wallet: string
  asOf: number
  portfolioSource: 'debank' | 'base-etherscan' | null
  creator: ZoraWalletHoldingDto[]
  content: ZoraWalletHoldingDto[]
}

export type ZoraWalletHoldingsBundle = {
  wallet: string
  creator: SwapTokenOption[]
  content: SwapTokenOption[]
  balances: Record<string, string>
  trayCreator: TrayTokenHolding[]
  trayContent: TrayTokenHolding[]
}

function dtoToSwapTokenOption(dto: ZoraWalletHoldingDto): SwapTokenOption {
  const group = dto.coinType === 'CONTENT' ? 'share' : 'creator'
  return {
    address: getAddress(dto.address),
    symbol: dto.symbol,
    name: dto.name,
    group,
    chainId: dto.chainId ?? BASE_CHAIN_ID,
    verified: true,
    sectionTag: dto.coinType === 'CONTENT' ? 'content' : 'creator',
    logoUrl: dto.logoUrl ?? undefined,
    logoUrls: dto.logoUrl ? [dto.logoUrl] : undefined,
  }
}

function dtoToTrayTokenHolding(dto: ZoraWalletHoldingDto): TrayTokenHolding {
  const addressLc = getAddress(dto.address).toLowerCase()
  return {
    tokenKey: addressLc,
    tokenAddress: getAddress(dto.address),
    symbol: dto.symbol,
    name: dto.name,
    logoUrl: dto.logoUrl,
    amount: dto.amount,
    usdValue: dto.usdValue,
    walletCount: 1,
  }
}

export function zoraHoldingsDtoToSwapRows(data: ZoraWalletHoldingsResult): SwapZoraHoldingRow[] {
  const rows: SwapZoraHoldingRow[] = []
  for (const dto of [...data.creator, ...data.content]) {
    if (dto.amount <= 0) continue
    rows.push({
      option: dtoToSwapTokenOption(dto),
      balanceFormatted: dto.amountFormatted,
    })
  }
  return rows
}

export function zoraHoldingsDtoToBundle(data: ZoraWalletHoldingsResult): ZoraWalletHoldingsBundle {
  const balances: Record<string, string> = {}
  const creator = data.creator.map((dto) => {
    balances[dto.address.toLowerCase()] = dto.amountFormatted
    return dtoToSwapTokenOption(dto)
  })
  const content = data.content.map((dto) => {
    balances[dto.address.toLowerCase()] = dto.amountFormatted
    return dtoToSwapTokenOption(dto)
  })
  return {
    wallet: data.wallet,
    creator,
    content,
    balances,
    trayCreator: data.creator.map(dtoToTrayTokenHolding),
    trayContent: data.content.map(dtoToTrayTokenHolding),
  }
}

export async function fetchWalletZoraHoldings(params: {
  wallet: string
  topTokenCount?: number
}): Promise<ZoraWalletHoldingsResult | null> {
  const trimmed = String(params.wallet ?? '').trim()
  if (!trimmed || !isAddress(trimmed)) return null

  const qs = new URLSearchParams({ wallet: getAddress(trimmed) })
  if (typeof params.topTokenCount === 'number' && params.topTokenCount > 0) {
    qs.set('topTokens', String(Math.min(params.topTokenCount, 100)))
  }

  const res = await fetch(`/api/wallet/zora-holdings?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  const envelope = await parseApiEnvelope<ZoraWalletHoldingsResult>(res)
  return envelope?.data ?? null
}

export async function fetchWalletZoraHoldingsBundle(
  wallet: string,
  options?: { topTokenCount?: number },
): Promise<ZoraWalletHoldingsBundle | null> {
  const data = await fetchWalletZoraHoldings({ wallet, topTokenCount: options?.topTokenCount ?? 100 })
  if (!data) return null
  return zoraHoldingsDtoToBundle(data)
}

export function normalizeZoraHoldingsWalletAddress(value: string | null | undefined): Address | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || !isAddress(trimmed)) return null
  return getAddress(trimmed)
}

function mergeTrayTokenHoldings(rows: TrayTokenHolding[]): TrayTokenHolding[] {
  const grouped = new Map<string, TrayTokenHolding>()
  for (const row of rows) {
    const key = row.tokenAddress?.toLowerCase() ?? row.tokenKey
    if (!key) continue
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...row })
      continue
    }
    existing.amount += row.amount
    existing.usdValue += row.usdValue
    existing.walletCount += row.walletCount
  }
  return Array.from(grouped.values()).sort((a, b) => b.usdValue - a.usdValue)
}

/** Merge Zora holdings across multiple wallets (canonical CSW + external EOA). */
export function mergeZoraHoldingsBundles(
  bundles: Array<ZoraWalletHoldingsBundle | null | undefined>,
): { creator: TrayTokenHolding[]; content: TrayTokenHolding[] } {
  const creatorRows: TrayTokenHolding[] = []
  const contentRows: TrayTokenHolding[] = []
  for (const bundle of bundles) {
    if (!bundle) continue
    creatorRows.push(...bundle.trayCreator)
    contentRows.push(...bundle.trayContent)
  }
  return {
    creator: mergeTrayTokenHoldings(creatorRows),
    content: mergeTrayTokenHoldings(contentRows),
  }
}

export async function fetchTrayZoraHoldingsForWallets(
  wallets: string[],
  options?: { topTokenCount?: number },
): Promise<{ creator: TrayTokenHolding[]; content: TrayTokenHolding[] }> {
  const normalized = wallets
    .map((w) => normalizeZoraHoldingsWalletAddress(w))
    .filter((w): w is Address => w != null)
  const unique = Array.from(new Set(normalized.map((w) => w.toLowerCase()))).map((lc) => getAddress(lc))

  const bundles = await Promise.all(
    unique.map((wallet) => fetchWalletZoraHoldingsBundle(wallet, options)),
  )
  return mergeZoraHoldingsBundles(bundles)
}
