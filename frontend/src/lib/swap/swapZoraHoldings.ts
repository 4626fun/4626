import { getAddress, type Address } from 'viem'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import type { AccountTrayPortfolioBatch } from '@/lib/debank/client'
import {
  buildTrayTokenRowsFromPortfolios,
  buildTrayZoraHoldings,
  collectZoraLookupAddresses,
  type TrayWalletSource,
} from '@/components/account/trayPortfolioHelpers'
import { fetchZoraCoin } from '@/lib/zora/client'
import {
  fetchWalletZoraHoldings,
  zoraHoldingsDtoToSwapRows,
  type SwapZoraHoldingRow,
} from '@/lib/zora/walletHoldings'
import { BASE_CHAIN_ID } from '@/lib/uniswap/swapUtils'

import { formatSwapTokenBalanceLabel } from '@/lib/swap/swapDisplayAmount'
import { enrichSwapTokenOption } from './swapTokenLabels'
import { zoraCoinToSwapTokenOption } from './zoraTokenSearch'

export type { SwapZoraHoldingRow } from '@/lib/zora/walletHoldings'

function formatHoldingAmount(value: number): string {
  return formatSwapTokenBalanceLabel(value)
}

function normalizeOwnerAddress(ownerAddress: string): Address | null {
  const trimmed = String(ownerAddress ?? '').trim()
  if (!trimmed) return null
  try {
    return getAddress(trimmed)
  } catch {
    return null
  }
}

/** Client-side resolver (tests + offline). Production paths use `fetchSwapZoraHoldings` → API. */
export async function resolveSwapZoraHoldings(params: {
  ownerAddress: string
  batch: AccountTrayPortfolioBatch | null
  fetchCoin?: (address: Address) => Promise<unknown | null>
}): Promise<SwapZoraHoldingRow[]> {
  const walletAddress = normalizeOwnerAddress(params.ownerAddress)
  if (!walletAddress) return []
  if (!params.batch?.results) return []

  const wallet: TrayWalletSource = {
    kind: 'canonical',
    address: walletAddress,
    label: 'Wallet',
  }
  const tokenRows = buildTrayTokenRowsFromPortfolios({
    wallets: [wallet],
    portfolios: params.batch.results,
  })
  const lookupAddresses = collectZoraLookupAddresses(tokenRows)
  if (lookupAddresses.length === 0) return []

  const fetchCoin = params.fetchCoin ?? ((address: Address) => fetchZoraCoin(address, BASE_CHAIN_ID))

  const zoraPairs = await Promise.all(
    lookupAddresses.map(async (addressLc) => {
      try {
        const coin = await fetchCoin(getAddress(addressLc))
        return [addressLc, coin] as const
      } catch {
        return [addressLc, null] as const
      }
    }),
  )

  const zoraMap: Record<string, unknown | null> = {}
  for (const [addressLc, coin] of zoraPairs) {
    zoraMap[addressLc] = coin
  }

  const holdings = buildTrayZoraHoldings(tokenRows, zoraMap)
  const out: SwapZoraHoldingRow[] = []

  for (const holding of holdings) {
    if (!holding.tokenAddress || holding.amount <= 0) continue
    const addressKey = holding.tokenAddress.toLowerCase()
    const coin = zoraMap[addressKey]
    const mapped = coin ? zoraCoinToSwapTokenOption(coin as Parameters<typeof zoraCoinToSwapTokenOption>[0], BASE_CHAIN_ID) : null
    const draft: SwapTokenOption =
      mapped ??
      ({
        address: getAddress(holding.tokenAddress),
        symbol: holding.symbol,
        name: holding.name,
        group: 'creator',
        chainId: BASE_CHAIN_ID,
        verified: true,
        logoUrl: holding.logoUrl ?? undefined,
        sectionTag: 'creator',
      } as SwapTokenOption)

    const enriched = await enrichSwapTokenOption(draft)
    out.push({
      option: {
        ...enriched,
        sectionTag:
          enriched.sectionTag ??
          (enriched.group === 'share' ? 'content' : enriched.group === 'creator' ? 'creator' : undefined),
        verified: enriched.verified ?? true,
      },
      balanceFormatted: formatHoldingAmount(holding.amount),
    })
  }

  return out
}

/** Canonical path: one API call for all Zora creator/content coins on a CSW (or any wallet). */
export async function fetchSwapZoraHoldings(ownerAddress: string): Promise<SwapZoraHoldingRow[]> {
  const walletAddress = normalizeOwnerAddress(ownerAddress)
  if (!walletAddress) return []

  const data = await fetchWalletZoraHoldings({ wallet: walletAddress, topTokenCount: 100 })
  if (!data) return []
  return zoraHoldingsDtoToSwapRows(data)
}

export function swapZoraHoldingsToBalanceMap(rows: SwapZoraHoldingRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.option.address.toLowerCase(), row.balanceFormatted)
  }
  return map
}
