import type { AccountTrayPortfolio, DebankPortfolioToken, DebankToken } from '@/lib/debank/client'

export type TrayWalletKind = 'canonical' | 'external'

export type TrayWalletSource = {
  kind: TrayWalletKind
  address: string
  label: string
}

export type TrayNetworkWalletBreakdown = {
  kind: TrayWalletKind
  label: string
  address: string
  usdValue: number
}

export type TrayNetworkHolding = {
  networkId: string
  networkLabel: string
  networkLogoUrl: string | null
  usdTotal: number
  wallets: TrayNetworkWalletBreakdown[]
}

export type TrayAssetHolding = {
  tokenKey: string
  tokenAddress: string | null
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  usdValue: number
}

export type TrayTokenHolding = TrayAssetHolding & {
  walletCount: number
}

export type TrayWalletTokenRow = {
  token: DebankToken
  wallet: TrayWalletSource
}

const NATIVE_TOKEN_IDS = new Set(['base', 'eth', 'op', 'arb', 'matic', 'bsc'])

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function normalizeAddressKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** One DeBank row per address — skip external EOA when it is the same as canonical CSW. */
export function buildTrayWalletSources(params: {
  cswAddress: string | null
  externalEoaAddress: string | null
}): TrayWalletSource[] {
  const out: TrayWalletSource[] = []
  const seen = new Set<string>()
  const cswKey = normalizeAddressKey(params.cswAddress)

  const push = (source: TrayWalletSource) => {
    const key = normalizeAddressKey(source.address)
    if (!key || !isEvmAddress(source.address) || seen.has(key)) return
    seen.add(key)
    out.push(source)
  }

  if (params.cswAddress && isEvmAddress(params.cswAddress)) {
    push({
      kind: 'canonical',
      address: params.cswAddress,
      label: '4626 CSW',
    })
  }

  const externalKey = normalizeAddressKey(params.externalEoaAddress)
  if (
    params.externalEoaAddress &&
    isEvmAddress(params.externalEoaAddress) &&
    externalKey &&
    externalKey !== cswKey
  ) {
    push({
      kind: 'external',
      address: params.externalEoaAddress,
      label: 'External EOA',
    })
  }

  return out
}

export function parseDebankToken(token: DebankToken): {
  tokenKey: string
  tokenAddress: string | null
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  usdValue: number
} | null {
  const rawId = String(token.id || '').trim()
  if (!rawId) return null

  const amount = Number(token.amount ?? 0)
  const usdValue = Number(token.usdValue ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!Number.isFinite(usdValue) || usdValue < 0) return null

  const lowerId = rawId.toLowerCase()
  if (isEvmAddress(rawId)) {
    return {
      tokenKey: lowerId,
      tokenAddress: lowerId,
      symbol: String(token.symbol || '').trim() || formatShortAddress(lowerId),
      name: String(token.name || '').trim() || String(token.symbol || '').trim() || lowerId,
      logoUrl: token.logoUrl ? String(token.logoUrl) : null,
      amount,
      usdValue,
    }
  }

  if (NATIVE_TOKEN_IDS.has(lowerId)) {
    const label = lowerId === 'base' ? 'ETH' : lowerId.toUpperCase()
    return {
      tokenKey: `native:${lowerId}`,
      tokenAddress: null,
      symbol: label,
      name: lowerId === 'base' ? 'Ether (Base)' : label,
      logoUrl: token.logoUrl ? String(token.logoUrl) : null,
      amount,
      usdValue,
    }
  }

  const embedded = lowerId.match(/(0x[a-f0-9]{40})/)
  if (embedded?.[1]) {
    const tokenAddress = embedded[1]
    return {
      tokenKey: tokenAddress,
      tokenAddress,
      symbol: String(token.symbol || '').trim() || formatShortAddress(tokenAddress),
      name: String(token.name || '').trim() || String(token.symbol || '').trim() || tokenAddress,
      logoUrl: token.logoUrl ? String(token.logoUrl) : null,
      amount,
      usdValue,
    }
  }

  return {
    tokenKey: lowerId,
    tokenAddress: null,
    symbol: String(token.symbol || '').trim() || lowerId,
    name: String(token.name || '').trim() || String(token.symbol || '').trim() || lowerId,
    logoUrl: token.logoUrl ? String(token.logoUrl) : null,
    amount,
    usdValue,
  }
}

/** Build network totals from unified tray portfolio snapshots (DeBank or Base/etherscan). */
export function buildTrayHoldingsFromPortfolios(params: {
  wallets: TrayWalletSource[]
  portfolios: Record<string, AccountTrayPortfolio | null> | null
}): ReturnType<typeof buildTrayHoldings> {
  const debankResults: Record<string, { totalUsdValue: number; chains: Array<{ id: string; name?: string; logoUrl?: string; usdValue: number }> } | null> =
    {}

  for (const wallet of params.wallets) {
    const key = wallet.address.toLowerCase()
    const portfolio = params.portfolios?.[key]
    if (!portfolio) {
      debankResults[key] = null
      continue
    }
    debankResults[key] = {
      totalUsdValue: portfolio.totalUsdValue,
      chains: (portfolio.activeChains ?? []).map((chain) => ({
        id: chain.id,
        name: chain.name,
        logoUrl: chain.logoUrl,
        usdValue: chain.usdValue,
      })),
    }
  }

  return buildTrayHoldings({ wallets: params.wallets, debankResults })
}

export function buildTrayHoldings(params: {
  wallets: TrayWalletSource[]
  debankResults: Record<string, { totalUsdValue: number; chains: Array<{ id: string; name?: string; logoUrl?: string; usdValue: number }> } | null> | null
}): {
  aggregateUsd: number
  activeNetworkLabel: string
  activeNetworkUsd: number | null
  rows: TrayNetworkHolding[]
} {
  const walletsByAddress = new Map<string, TrayWalletSource>()
  for (const wallet of params.wallets) {
    const key = normalizeAddressKey(wallet.address)
    if (!key || !isEvmAddress(wallet.address)) continue
    if (!walletsByAddress.has(key)) walletsByAddress.set(key, wallet)
  }
  const wallets = Array.from(walletsByAddress.values())

  const aggregateUsd = wallets.reduce((sum, wallet) => {
    const entry = params.debankResults?.[wallet.address.toLowerCase()]
    return sum + (entry?.totalUsdValue ?? 0)
  }, 0)

  const map = new Map<string, TrayNetworkHolding>()
  for (const wallet of wallets) {
    const entry = params.debankResults?.[wallet.address.toLowerCase()]
    if (!entry) continue
    for (const chain of entry.chains ?? []) {
      const networkId = String(chain.id || '').trim().toLowerCase()
      if (!networkId) continue
      const chainValue = Number(chain.usdValue ?? 0)
      if (!Number.isFinite(chainValue) || chainValue <= 0) continue

      const walletKey = normalizeAddressKey(wallet.address)
      const existing = map.get(networkId)
      if (existing) {
        existing.usdTotal += chainValue
        const lane = existing.wallets.find((row) => normalizeAddressKey(row.address) === walletKey)
        if (lane) {
          lane.usdValue += chainValue
        } else {
          existing.wallets.push({
            kind: wallet.kind,
            label: wallet.label,
            address: wallet.address,
            usdValue: chainValue,
          })
        }
        continue
      }

      map.set(networkId, {
        networkId,
        networkLabel: String(chain.name || chain.id || networkId),
        networkLogoUrl: chain.logoUrl ? String(chain.logoUrl) : null,
        usdTotal: chainValue,
        wallets: [{
          kind: wallet.kind,
          label: wallet.label,
          address: wallet.address,
          usdValue: chainValue,
        }],
      })
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.usdTotal - a.usdTotal)
  const preferredBase = rows.find((row) => row.networkId === 'base')
  const active = preferredBase ?? rows[0] ?? null
  return {
    aggregateUsd,
    activeNetworkLabel: active?.networkLabel ?? 'Base',
    activeNetworkUsd: active?.usdTotal ?? null,
    rows,
  }
}

export function buildTrayAssetHoldings(
  rows: TrayWalletTokenRow[],
  options?: { excludeTokenKeys?: ReadonlySet<string> },
): TrayAssetHolding[] {
  const grouped = new Map<string, TrayAssetHolding>()
  const walletKeysSeen = new Map<string, Set<string>>()

  for (const row of rows) {
    const parsed = parseDebankToken(row.token)
    if (!parsed) continue
    if (options?.excludeTokenKeys?.has(parsed.tokenKey)) continue

    const walletKey = normalizeAddressKey(row.wallet.address)
    const seenForToken = walletKeysSeen.get(parsed.tokenKey) ?? new Set<string>()
    const alreadyCountedWallet = seenForToken.has(walletKey)
    if (!alreadyCountedWallet) seenForToken.add(walletKey)
    walletKeysSeen.set(parsed.tokenKey, seenForToken)

    const existing = grouped.get(parsed.tokenKey)
    if (existing) {
      if (!alreadyCountedWallet) {
        existing.amount += parsed.amount
        existing.usdValue += parsed.usdValue
      }
      continue
    }
    grouped.set(parsed.tokenKey, {
      tokenKey: parsed.tokenKey,
      tokenAddress: parsed.tokenAddress,
      symbol: parsed.symbol,
      name: parsed.name,
      logoUrl: parsed.logoUrl,
      amount: parsed.amount,
      usdValue: parsed.usdValue,
    })
  }

  return Array.from(grouped.values()).sort((a, b) => b.usdValue - a.usdValue)
}

export function buildTrayZoraHoldings(
  rows: TrayWalletTokenRow[],
  zoraMap: Record<string, unknown | null>,
): TrayTokenHolding[] {
  const zoraKeys = new Set(
    Object.entries(zoraMap)
      .filter(([, coin]) => Boolean(coin))
      .map(([address]) => address.toLowerCase()),
  )
  const grouped = new Map<string, TrayTokenHolding>()
  const walletKeysSeen = new Map<string, Set<string>>()

  for (const row of rows) {
    const parsed = parseDebankToken(row.token)
    if (!parsed?.tokenAddress) continue
    const tokenAddress = parsed.tokenAddress.toLowerCase()
    if (!zoraKeys.has(tokenAddress)) continue

    const walletKey = normalizeAddressKey(row.wallet.address)
    const seenForToken = walletKeysSeen.get(tokenAddress) ?? new Set<string>()
    const alreadyCountedWallet = seenForToken.has(walletKey)
    if (!alreadyCountedWallet) seenForToken.add(walletKey)
    walletKeysSeen.set(tokenAddress, seenForToken)

    const existing = grouped.get(tokenAddress)
    if (existing) {
      if (!alreadyCountedWallet) {
        existing.amount += parsed.amount
        existing.usdValue += parsed.usdValue
        existing.walletCount += 1
      }
      continue
    }
    grouped.set(tokenAddress, {
      tokenKey: tokenAddress,
      tokenAddress,
      symbol: parsed.symbol,
      name: parsed.name,
      logoUrl: parsed.logoUrl,
      amount: parsed.amount,
      usdValue: parsed.usdValue,
      walletCount: 1,
    })
  }

  return Array.from(grouped.values()).sort((a, b) => b.usdValue - a.usdValue)
}

export function collectZoraLookupAddresses(rows: TrayWalletTokenRow[]): string[] {
  const out = new Set<string>()
  for (const row of rows) {
    const parsed = parseDebankToken(row.token)
    if (parsed?.tokenAddress) out.add(parsed.tokenAddress.toLowerCase())
  }
  return Array.from(out).sort()
}

export function portfolioTokenToDebankToken(token: DebankPortfolioToken): DebankToken {
  return {
    id: token.id,
    chain: token.chain,
    name: token.name,
    symbol: token.symbol,
    logoUrl: token.logoUrl,
    amount: token.amount,
    price: token.price,
    usdValue: token.usdValue,
  }
}

/** Flatten server wallet portfolios into tray token rows (DeBank all_token_list). */
export function buildTrayTokenRowsFromPortfolios(params: {
  wallets: TrayWalletSource[]
  portfolios: Record<string, AccountTrayPortfolio | null> | null
}): TrayWalletTokenRow[] {
  const out: TrayWalletTokenRow[] = []
  for (const wallet of params.wallets) {
    const portfolio = params.portfolios?.[wallet.address.toLowerCase()]
    if (!portfolio?.topTokens?.length) continue
    for (const token of portfolio.topTokens) {
      out.push({
        wallet,
        token: portfolioTokenToDebankToken(token),
      })
    }
  }
  return out
}

function formatShortAddress(value: string): string {
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
