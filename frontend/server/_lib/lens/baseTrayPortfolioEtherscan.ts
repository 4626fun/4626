/**
 * Base-only account-tray portfolio fallback via Etherscan v2 + DefiLlama prices.
 * Used when DeBank is unavailable or out of units.
 */

import type { PortfolioChain, PortfolioToken, WalletPortfolio } from './debankPortfolio.js'
import {
  ETHERSCAN_V2_BASE_CHAIN_ID,
  fetchEtherscanV2Json,
  getEtherscanApiKey,
} from './etherscanV2.js'

const DEFILLAMA_PRICE_BASE = 'https://coins.llama.fi/prices/current'
const ETHERSCAN_TOKEN_PAGE_SIZE = 100

type EtherscanTokenRow = {
  TokenAddress?: string
  TokenName?: string
  TokenSymbol?: string
  TokenQuantity?: string
  TokenDivisor?: string
}

async function fetchAddressTokenBalances(
  address: string,
  maxTokens: number,
): Promise<EtherscanTokenRow[]> {
  const apiKey = getEtherscanApiKey()
  if (!apiKey) return []

  const out: EtherscanTokenRow[] = []
  const maxPages = Math.min(3, Math.ceil(maxTokens / ETHERSCAN_TOKEN_PAGE_SIZE))

  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await fetchEtherscanV2Json<EtherscanTokenRow[]>(
      {
        module: 'account',
        action: 'addresstokenbalance',
        address,
        page: String(page),
        offset: String(ETHERSCAN_TOKEN_PAGE_SIZE),
      },
      { chainId: ETHERSCAN_V2_BASE_CHAIN_ID },
    )
    if (!Array.isArray(rows) || rows.length === 0) break
    out.push(...rows)
    if (rows.length < ETHERSCAN_TOKEN_PAGE_SIZE) break
  }

  return out.slice(0, maxTokens)
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
    fetchEtherscanV2Json<string>(
      { module: 'account', action: 'balance', address: addr, tag: 'latest' },
      { chainId: ETHERSCAN_V2_BASE_CHAIN_ID },
    ),
    fetchAddressTokenBalances(addr, Math.max(topN, ETHERSCAN_TOKEN_PAGE_SIZE)),
    fetchEthUsdPrice(),
  ])

  const contractAddresses = tokenRows
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

  for (const row of tokenRows) {
    const parsed = parseTokenRow(row, prices)
    if (parsed) topTokens.push(parsed)
  }

  topTokens.sort((a, b) => b.usdValue - a.usdValue || b.amount - a.amount)
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
