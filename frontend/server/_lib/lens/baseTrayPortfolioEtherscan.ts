/**
 * Base-only account-tray portfolio fallback via Etherscan v2 + DefiLlama prices.
 * Used when DeBank is unavailable or out of units.
 */

import type { PortfolioChain, PortfolioToken, WalletPortfolio } from './debankPortfolio.js'

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api'
const BASE_CHAIN_ID = 8453
const DEFILLAMA_PRICE_BASE = 'https://coins.llama.fi/prices/current'

type EtherscanTokenRow = {
  TokenAddress?: string
  TokenName?: string
  TokenSymbol?: string
  TokenQuantity?: string
  TokenDivisor?: string
}

function getEtherscanApiKey(): string {
  return (process.env.ETHERSCAN_API_KEY ?? '').trim()
}

async function fetchEtherscanJson<T>(params: Record<string, string>, apiKey: string): Promise<T | null> {
  const url = new URL(ETHERSCAN_V2_BASE)
  url.searchParams.set('chainid', String(BASE_CHAIN_ID))
  url.searchParams.set('apikey', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { status?: string; result?: T }
    if (data.status !== '1') return null
    return data.result ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(`${DEFILLAMA_PRICE_BASE}/coingecko:ethereum`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { coins?: Record<string, { price?: number }> }
    const price = data.coins?.['coingecko:ethereum']?.price
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : 0
  } catch {
    return 0
  }
}

async function fetchBaseTokenUsdPrices(contractAddresses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const uniq = Array.from(new Set(contractAddresses.map((a) => a.toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a))))
  if (uniq.length === 0) return out

  const chunkSize = 40
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const slice = uniq.slice(i, i + chunkSize)
    const path = slice.map((addr) => `base:${addr}`).join(',')
    try {
      const res = await fetch(`${DEFILLAMA_PRICE_BASE}/${path}`, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue
      const data = (await res.json()) as { coins?: Record<string, { price?: number; address?: string }> }
      for (const [key, coin] of Object.entries(data.coins ?? {})) {
        const price = coin?.price
        if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue
        const addr = (coin?.address ?? key.replace(/^base:/, '')).toLowerCase()
        if (addr) out.set(addr, price)
      }
    } catch {
      continue
    }
  }
  return out
}

function parseTokenRow(row: EtherscanTokenRow, prices: Map<string, number>): PortfolioToken | null {
  const address = String(row.TokenAddress ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(address)) return null

  const divisor = Number.parseInt(String(row.TokenDivisor ?? '18'), 10)
  const rawQty = String(row.TokenQuantity ?? '').trim()
  if (!rawQty || !Number.isFinite(divisor) || divisor < 0) return null

  let amount = 0
  try {
    const qty = BigInt(rawQty)
    amount = Number(qty) / 10 ** divisor
  } catch {
    return null
  }
  if (!Number.isFinite(amount) || amount <= 0) return null

  const price = prices.get(address) ?? 0
  const usdValue = price > 0 ? amount * price : 0
  if (usdValue <= 0) return null

  return {
    id: address,
    chain: 'base',
    name: String(row.TokenName ?? '').trim() || address,
    symbol: String(row.TokenSymbol ?? '').trim() || address.slice(0, 6),
    amount,
    price,
    usdValue,
  }
}

/**
 * Base mainnet holdings for the account tray (ERC-20 + native ETH).
 * Does not include DeFi positions or non-Base chains.
 */
export async function getTrayWalletPortfolioBaseEtherscan(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<WalletPortfolio | null> {
  const apiKey = getEtherscanApiKey()
  if (!apiKey) return null

  const addr = address.toLowerCase()
  const topN = options.topTokenCount ?? 50

  const [weiBalance, tokenRows, ethUsd] = await Promise.all([
    fetchEtherscanJson<string>(
      { module: 'account', action: 'balance', address: addr, tag: 'latest' },
      apiKey,
    ),
    fetchEtherscanJson<EtherscanTokenRow[]>(
      { module: 'account', action: 'addresstokenbalance', address: addr, page: '1', offset: '100' },
      apiKey,
    ),
    fetchEthUsdPrice(),
  ])

  const contractAddresses = (Array.isArray(tokenRows) ? tokenRows : [])
    .map((row) => String(row.TokenAddress ?? '').trim().toLowerCase())
    .filter((a) => /^0x[a-f0-9]{40}$/.test(a))

  const prices = await fetchBaseTokenUsdPrices(contractAddresses)

  const topTokens: PortfolioToken[] = []

  if (weiBalance) {
    try {
      const wei = BigInt(weiBalance)
      const ethAmount = Number(wei) / 1e18
      if (Number.isFinite(ethAmount) && ethAmount > 0 && ethUsd > 0) {
        topTokens.push({
          id: 'base',
          chain: 'base',
          name: 'Ether',
          symbol: 'ETH',
          amount: ethAmount,
          price: ethUsd,
          usdValue: ethAmount * ethUsd,
        })
      }
    } catch {
      // ignore malformed wei
    }
  }

  for (const row of Array.isArray(tokenRows) ? tokenRows : []) {
    const parsed = parseTokenRow(row, prices)
    if (parsed) topTokens.push(parsed)
  }

  topTokens.sort((a, b) => b.usdValue - a.usdValue)
  const trimmed = topTokens.slice(0, topN)
  const totalUsdValue = trimmed.reduce((sum, token) => sum + token.usdValue, 0)

  const activeChains: PortfolioChain[] =
    totalUsdValue > 0
      ? [
          {
            id: 'base',
            name: 'Base',
            usdValue: totalUsdValue,
          },
        ]
      : []

  return {
    address: addr,
    totalUsdValue,
    topTokens: trimmed,
    activeChains,
    protocols: [],
    asOf: Date.now(),
  }
}
