/**
 * Account-tray portfolio resolver: DeBank (lite) first, Base Etherscan fallback.
 */

import {
  getTrayWalletPortfolioDebank,
  type WalletPortfolio,
} from './debankPortfolio.js'
import { getTrayWalletPortfolioBaseEtherscan } from './baseTrayPortfolioEtherscan.js'

export type TrayPortfolioSource = 'debank' | 'base-etherscan'

export type ResolvedTrayPortfolio = {
  portfolio: WalletPortfolio | null
  source: TrayPortfolioSource | null
}

export async function resolveTrayWalletPortfolio(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<ResolvedTrayPortfolio> {
  const topTokenCount = options.topTokenCount ?? 50

  const debank = await getTrayWalletPortfolioDebank(address, { topTokenCount })
  if (debank && (debank.topTokens.length > 0 || debank.totalUsdValue > 0)) {
    return { portfolio: debank, source: 'debank' }
  }

  const base = await getTrayWalletPortfolioBaseEtherscan(address, { topTokenCount })
  if (base && (base.topTokens.length > 0 || base.totalUsdValue > 0)) {
    return { portfolio: base, source: 'base-etherscan' }
  }

  // Prefer whichever partial snapshot exists (e.g. DeBank total without tokens).
  if (debank) return { portfolio: debank, source: 'debank' }
  if (base) return { portfolio: base, source: 'base-etherscan' }
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
