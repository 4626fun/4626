/**
 * Account-tray portfolio resolver.
 * - DeBank lite when DEBANK_ACCESS_KEY is set (unless TRAY_PORTFOLIO_PREFER_ETHERSCAN=1).
 * - Base balances via Etherscan API v2 (ETHERSCAN_API_KEY + chainid=8453) when DeBank is off,
 *   preferred, or returns no token rows (needed for Zora holdings discovery).
 */

import {
  getTrayWalletPortfolioDebank,
  type WalletPortfolio,
} from './debankPortfolio.js'
import { getTrayWalletPortfolioBaseEtherscan } from './baseTrayPortfolioEtherscan.js'
import {
  hasDebankAccessKey,
  hasEtherscanApiKey,
  preferTrayPortfolioEtherscan,
} from './etherscanV2.js'

export type TrayPortfolioSource = 'debank' | 'base-etherscan'

export type ResolvedTrayPortfolio = {
  portfolio: WalletPortfolio | null
  source: TrayPortfolioSource | null
}

function portfolioHasTokenRows(portfolio: WalletPortfolio | null | undefined): boolean {
  return Boolean(portfolio && portfolio.topTokens.length > 0)
}

export async function resolveTrayWalletPortfolio(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<ResolvedTrayPortfolio> {
  const topTokenCount = options.topTokenCount ?? 50
  const useDebank = hasDebankAccessKey()
  const useEtherscan = hasEtherscanApiKey()
  const etherscanFirst = preferTrayPortfolioEtherscan() && useEtherscan

  if (etherscanFirst) {
    const base = await getTrayWalletPortfolioBaseEtherscan(address, { topTokenCount })
    if (portfolioHasTokenRows(base) || (base && base.totalUsdValue > 0)) {
      return { portfolio: base, source: 'base-etherscan' }
    }
  }

  let debank: WalletPortfolio | null = null
  if (useDebank && !etherscanFirst) {
    debank = await getTrayWalletPortfolioDebank(address, { topTokenCount })
    if (portfolioHasTokenRows(debank)) {
      return { portfolio: debank, source: 'debank' }
    }
  }

  if (useEtherscan) {
    const base = await getTrayWalletPortfolioBaseEtherscan(address, { topTokenCount })
    if (portfolioHasTokenRows(base) || (base && base.totalUsdValue > 0)) {
      return { portfolio: base, source: 'base-etherscan' }
    }
    if (base) return { portfolio: base, source: 'base-etherscan' }
  }

  if (debank && (debank.totalUsdValue > 0 || debank.topTokens.length > 0)) {
    return { portfolio: debank, source: 'debank' }
  }
  return { portfolio: null, source: null }
}

export type TrayPortfolioBatchResult = {
  asOf: number
  results: Record<string, WalletPortfolio | null>
  sources: Record<string, TrayPortfolioSource | null>
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

export async function resolveTrayWalletPortfolioBatch(
  addresses: string[],
  options: { topTokenCount?: number } = {},
): Promise<TrayPortfolioBatchResult> {
  const list = addresses.map((raw) => raw.trim().toLowerCase()).filter(Boolean)
  const resolvedList = await mapWithLimit(list, 3, (addr) => resolveTrayWalletPortfolio(addr, options))

  const results: Record<string, WalletPortfolio | null> = {}
  const sources: Record<string, TrayPortfolioSource | null> = {}
  list.forEach((addr, i) => {
    results[addr] = resolvedList[i]?.portfolio ?? null
    sources[addr] = resolvedList[i]?.source ?? null
  })

  return { asOf: Date.now(), results, sources }
}
