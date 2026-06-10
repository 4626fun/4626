/**
 * Server-side DeBank portfolio client.
 *
 * Fetches enriched portfolio data directly from DeBank Cloud API:
 * - Total balance (already available via proxy, but we call directly here)
 * - Token holdings (top N by USD value)
 * - Used chains (all chains the wallet has been active on)
 * - DeFi protocol positions
 */

const DEBANK_BASE_URL = 'https://pro-openapi.debank.com/v1'

export type PortfolioToken = {
  id: string
  chain: string
  name: string
  symbol: string
  logoUrl?: string
  amount: number
  price: number
  usdValue: number
}

export type PortfolioChain = {
  id: string
  name: string
  logoUrl?: string
  usdValue: number
}

export type PortfolioProtocol = {
  id: string
  name: string
  chain: string
  logoUrl?: string
  siteUrl?: string
  netUsdValue: number
}

export type WalletPortfolio = {
  address: string
  totalUsdValue: number
  /** Top token holdings sorted by USD value. */
  topTokens: PortfolioToken[]
  /** All chains the wallet has been active on. */
  activeChains: PortfolioChain[]
  /** DeFi protocol positions. */
  protocols: PortfolioProtocol[]
  asOf: number
}

function getAccessKey(): string {
  return (process.env.DEBANK_ACCESS_KEY ?? '').trim()
}

async function fetchJson<T>(url: string, accessKey: string): Promise<T | null> {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10_000)

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', AccessKey: accessKey },
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch a comprehensive portfolio snapshot for a wallet address.
 *
 * @param address - Wallet address.
 * @param options.topTokenCount - Max number of top tokens to return (default 20).
 */
export async function getWalletPortfolio(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<WalletPortfolio | null> {
  const accessKey = getAccessKey()
  if (!accessKey) return null

  const addr = address.toLowerCase()
  const topN = options.topTokenCount ?? 20

  // Fetch all three endpoints in parallel.
  const [totalBalanceRaw, usedChainsRaw, protocolsRaw] = await Promise.all([
    fetchJson<{
      total_usd_value: number
      chain_list: Array<{ id: string; name?: string; logo_url?: string; usd_value: number }>
    }>(`${DEBANK_BASE_URL}/user/total_balance?id=${encodeURIComponent(addr)}`, accessKey),

    fetchJson<Array<{ id: string; name?: string; logo_url?: string; usd_value?: number }>>(
      `${DEBANK_BASE_URL}/user/used_chain_list?id=${encodeURIComponent(addr)}`,
      accessKey,
    ),

    fetchJson<
      Array<{
        id: string
        name?: string
        chain?: string
        logo_url?: string
        site_url?: string
        net_usd_value?: number
        portfolio_item_list?: unknown[]
      }>
    >(
      `${DEBANK_BASE_URL}/user/complex_protocol_list?id=${encodeURIComponent(addr)}`,
      accessKey,
    ),
  ])

  const totalUsdValue =
    totalBalanceRaw && Number.isFinite(totalBalanceRaw.total_usd_value)
      ? totalBalanceRaw.total_usd_value
      : 0

  // Parse active chains from total_balance chain_list (has usd_value) + used_chain_list.
  const chainMap = new Map<string, PortfolioChain>()

  if (totalBalanceRaw?.chain_list) {
    for (const c of totalBalanceRaw.chain_list) {
      if (!c.id) continue
      chainMap.set(c.id, {
        id: c.id,
        name: c.name ?? c.id,
        logoUrl: c.logo_url,
        usdValue: Number.isFinite(c.usd_value) ? c.usd_value : 0,
      })
    }
  }

  if (Array.isArray(usedChainsRaw)) {
    for (const c of usedChainsRaw) {
      if (!c.id || chainMap.has(c.id)) continue
      chainMap.set(c.id, {
        id: c.id,
        name: c.name ?? c.id,
        logoUrl: c.logo_url,
        usdValue: Number.isFinite(c.usd_value) ? c.usd_value! : 0,
      })
    }
  }

  const activeChains = Array.from(chainMap.values()).sort((a, b) => b.usdValue - a.usdValue)

  // Parse DeFi protocol positions.
  const protocols: PortfolioProtocol[] = Array.isArray(protocolsRaw)
    ? protocolsRaw
        .filter((p) => p.id && Number.isFinite(p.net_usd_value) && p.net_usd_value! > 0)
        .map((p) => ({
          id: p.id,
          name: p.name ?? p.id,
          chain: p.chain ?? 'unknown',
          logoUrl: p.logo_url,
          siteUrl: p.site_url,
          netUsdValue: p.net_usd_value!,
        }))
        .sort((a, b) => b.netUsdValue - a.netUsdValue)
        .slice(0, 20)
    : []

  // For top tokens, we need to fetch the token list separately.
  // We'll fetch across all chains to get the full picture.
  const tokenListRaw = await fetchJson<
    Array<{
      id: string
      chain?: string
      name?: string
      symbol?: string
      logo_url?: string
      amount?: number
      price?: number
      usd_value?: number
    }>
  >(
    `${DEBANK_BASE_URL}/user/all_token_list?id=${encodeURIComponent(addr)}&is_all=false`,
    accessKey,
  )

  const topTokens: PortfolioToken[] = Array.isArray(tokenListRaw)
    ? tokenListRaw
        .filter(
          (t) =>
            t.id &&
            Number.isFinite(t.usd_value) &&
            t.usd_value! > 0 &&
            Number.isFinite(t.amount) &&
            t.amount! > 0,
        )
        .map((t) => ({
          id: t.id,
          chain: t.chain ?? 'unknown',
          name: t.name ?? t.id,
          symbol: t.symbol ?? '',
          logoUrl: t.logo_url,
          amount: t.amount!,
          price: Number.isFinite(t.price) ? t.price! : 0,
          usdValue: t.usd_value!,
        }))
        .sort((a, b) => b.usdValue - a.usdValue)
        .slice(0, topN)
    : []

  return {
    address: addr,
    totalUsdValue,
    topTokens,
    activeChains,
    protocols,
    asOf: Date.now(),
  }
}

/**
 * Lighter DeBank fetch for the account tray (2 API calls vs 4).
 * Skips used_chain_list and complex_protocol_list to conserve compute units.
 */
export async function getTrayWalletPortfolioDebank(
  address: string,
  options: { topTokenCount?: number } = {},
): Promise<WalletPortfolio | null> {
  const accessKey = getAccessKey()
  if (!accessKey) return null

  const addr = address.toLowerCase()
  const topN = options.topTokenCount ?? 50

  const [totalBalanceRaw, tokenListRaw] = await Promise.all([
    fetchJson<{
      total_usd_value: number
      chain_list: Array<{ id: string; name?: string; logo_url?: string; usd_value: number }>
    }>(`${DEBANK_BASE_URL}/user/total_balance?id=${encodeURIComponent(addr)}`, accessKey),

    fetchJson<
      Array<{
        id: string
        chain?: string
        name?: string
        symbol?: string
        logo_url?: string
        amount?: number
        price?: number
        usd_value?: number
      }>
    >(`${DEBANK_BASE_URL}/user/all_token_list?id=${encodeURIComponent(addr)}&is_all=false`, accessKey),
  ])

  const totalUsdValue =
    totalBalanceRaw && Number.isFinite(totalBalanceRaw.total_usd_value)
      ? totalBalanceRaw.total_usd_value
      : 0

  const activeChains: PortfolioChain[] = Array.isArray(totalBalanceRaw?.chain_list)
    ? totalBalanceRaw.chain_list
        .filter((c) => c.id && Number.isFinite(c.usd_value) && c.usd_value > 0)
        .map((c) => ({
          id: c.id,
          name: c.name ?? c.id,
          logoUrl: c.logo_url,
          usdValue: c.usd_value,
        }))
        .sort((a, b) => b.usdValue - a.usdValue)
    : []

  const topTokens: PortfolioToken[] = Array.isArray(tokenListRaw)
    ? tokenListRaw
        .filter(
          (t) =>
            t.id &&
            Number.isFinite(t.usd_value) &&
            t.usd_value! > 0 &&
            Number.isFinite(t.amount) &&
            t.amount! > 0,
        )
        .map((t) => ({
          id: t.id,
          chain: t.chain ?? 'unknown',
          name: t.name ?? t.id,
          symbol: t.symbol ?? '',
          logoUrl: t.logo_url,
          amount: t.amount!,
          price: Number.isFinite(t.price) ? t.price! : 0,
          usdValue: t.usd_value!,
        }))
        .sort((a, b) => b.usdValue - a.usdValue)
        .slice(0, topN)
    : []

  return {
    address: addr,
    totalUsdValue,
    topTokens,
    activeChains,
    protocols: [],
    asOf: Date.now(),
  }
}
