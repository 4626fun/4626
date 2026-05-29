import type { WalletPortfolio, PortfolioToken } from '../lens/debankPortfolio.js'
import { normalizeZoraCoinType, type ZoraCoinType } from './coinType.js'

export type ServerWalletSource = {
  kind: 'canonical' | 'external'
  address: string
  label: string
}

export type ServerWalletTokenRow = {
  token: {
    id: string
    chain: string
    name: string
    symbol: string
    logoUrl?: string
    amount: number
    price: number
    usdValue: number
  }
  wallet: ServerWalletSource
}

export type ServerTokenHolding = {
  tokenAddress: string | null
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  usdValue: number
  walletCount: number
}

/** Server-friendly version of flattening portfolio top tokens into rows (for Zora lookup). */
export function buildServerZoraTokenRows(params: {
  wallet: ServerWalletSource
  portfolio: WalletPortfolio | null
}): ServerWalletTokenRow[] {
  const out: ServerWalletTokenRow[] = []
  const tokens: PortfolioToken[] = params.portfolio?.topTokens ?? []
  if (tokens.length === 0) return out

  for (const token of tokens) {
    out.push({
      wallet: params.wallet,
      token: {
        id: token.id,
        chain: token.chain,
        name: token.name,
        symbol: token.symbol,
        logoUrl: token.logoUrl,
        amount: token.amount,
        price: token.price,
        usdValue: token.usdValue,
      },
    })
  }
  return out
}

export function collectZoraLookupAddresses(rows: ServerWalletTokenRow[]): string[] {
  const out = new Set<string>()
  for (const row of rows) {
    const addr = row.token.id?.toLowerCase?.()
    if (addr && addr.startsWith('0x')) {
      out.add(addr)
    }
  }
  return Array.from(out).sort()
}

/** Server-friendly version of merging Zora data into holdings (adapted from tray logic). */
export function buildServerZoraHoldings(
  rows: ServerWalletTokenRow[],
  zoraMap: Record<string, Record<string, unknown> | null>,
): ServerTokenHolding[] {
  const zoraKeys = new Set(
    Object.entries(zoraMap)
      .filter(([, coin]) => Boolean(coin))
      .map(([address]) => address.toLowerCase()),
  )

  const grouped = new Map<string, ServerTokenHolding>()
  const walletKeysSeen = new Map<string, Set<string>>()

  for (const row of rows) {
    const token = row.token
    const tokenAddress = (token.id || '').toLowerCase()
    if (!tokenAddress || !zoraKeys.has(tokenAddress)) continue

    const walletKey = row.wallet.address.toLowerCase()
    const seenForToken = walletKeysSeen.get(tokenAddress) ?? new Set<string>()
    const alreadyCounted = seenForToken.has(walletKey)
    if (!alreadyCounted) seenForToken.add(walletKey)
    walletKeysSeen.set(tokenAddress, seenForToken)

    const existing = grouped.get(tokenAddress)
    if (existing) {
      if (!alreadyCounted) {
        existing.amount += token.amount ?? 0
        existing.usdValue += token.usdValue ?? 0
        existing.walletCount += 1
      }
    } else {
      grouped.set(tokenAddress, {
        tokenAddress,
        symbol: token.symbol,
        name: token.name,
        logoUrl: token.logoUrl ?? null,
        amount: token.amount ?? 0,
        usdValue: token.usdValue ?? 0,
        walletCount: 1,
      })
    }
  }

  return Array.from(grouped.values())
}
