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

function portfolioHasUsdValue(portfolio: WalletPortfolio | null | undefined): boolean {
  return Boolean(portfolio && portfolio.totalUsdValue > 0)
}

export async function resolveTrayWalletPortfolio(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<ResolvedTrayPortfolio> {
  const topTokenCount = options.topTokenCount ?? 50
  const useDebank = hasDebankAccessKey()
  const useEtherscan = hasEtherscanApiKey()
  const etherscanFirst = preferTrayPortfolioEtherscan() && useEtherscan

  let debank: WalletPortfolio | null = null
  let base: WalletPortfolio | null = null

  const ensureDebank = async (): Promise<WalletPortfolio | null> => {
    if (!useDebank) return null
    if (!debank) debank = await getTrayWalletPortfolioDebank(address, { topTokenCount })
    return debank
  }

  const ensureEtherscan = async (): Promise<WalletPortfolio | null> => {
    if (!useEtherscan) return null
    if (!base) base = await getTrayWalletPortfolioBaseEtherscan(address, { topTokenCount })
    return base
  }

  if (etherscanFirst) {
    const scan = await ensureEtherscan()
    if (portfolioHasTokenRows(scan) || portfolioHasUsdValue(scan)) {
      return { portfolio: scan, source: 'base-etherscan' }
    }
  } else if (useDebank) {
    const bank = await ensureDebank()
    if (portfolioHasTokenRows(bank)) {
      return { portfolio: bank, source: 'debank' }
    }
  }

  if (useEtherscan && !etherscanFirst) {
    const scan = await ensureEtherscan()
    if (portfolioHasTokenRows(scan) || portfolioHasUsdValue(scan)) {
      return { portfolio: scan, source: 'base-etherscan' }
    }
  }

  // DeBank fallback when Base Etherscan has no token rows (common for Zora-heavy CSW wallets).
  const bank = await ensureDebank()
  if (bank && (portfolioHasTokenRows(bank) || portfolioHasUsdValue(bank))) {
    return { portfolio: bank, source: 'debank' }
  }

  if (base && portfolioHasTokenRows(base)) {
    return { portfolio: base, source: 'base-etherscan' }
  }
  if (bank && portfolioHasTokenRows(bank)) {
    return { portfolio: bank, source: 'debank' }
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
