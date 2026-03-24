import type { Address } from 'viem'
import { createPublicClient, erc20Abi, getAddress, http } from 'viem'
import { base } from 'viem/chains'

import { fetchExternalJson } from '../../../../../server/_lib/externalFetch.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SupportedDexChain =
  | 'base'
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'bsc'
  | 'avalanche'
  | 'zora'

export type TokenAnalysisCardConfidence = 'low' | 'medium' | 'high'

export type TokenAnalysisMetadataQuality = {
  verifiedTokenMetadataPresent: boolean
  name: string | null
  symbol: string | null
  decimals: number | null
  logoUrl: string | null
  supportsLogo: boolean
}

export type TokenAnalysisRiskSignals = {
  ownership: 'renounced' | 'owned' | 'unknown' | null
  mint: 'yes' | 'no' | 'unknown' | null
  blacklist: 'yes' | 'no' | 'unknown' | null
  proxy: 'yes' | 'no' | 'unknown' | null
  taxBps: number | null
  liquidityStatus: 'locked' | 'burned' | 'unknown' | null
}

export type TokenAnalysisSecondarySignals = {
  risk: TokenAnalysisRiskSignals
  metadataQuality: Partial<TokenAnalysisMetadataQuality>
  createdAt: string | null
  holders: number | null
  creatorLabel: string | null
}

export type TokenAnalysisVaultLink = {
  linked: boolean
  relation: 'creator_coin' | 'share_token' | 'vault' | null
  vaultAddress: `0x${string}` | null
  creatorCoinAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  creatorLabel: string | null
}

export type ResolvedInlineTokenAnalysis = {
  kind: 'resolved'
  normalizedAddress: `0x${string}`
  checksumAddress: Address
  chain: SupportedDexChain
  chainLabel: string
  dexId: string | null
  dexUrl: string | null
  pairAddress: `0x${string}` | null
  name: string | null
  symbol: string | null
  decimals: number | null
  logoUrl: string | null
  metadataQualityScore: number
  verifiedTokenMetadataPresent: boolean
  ageSource: 'pair_created' | 'token_created' | null
  createdAt: string | null
  marketCapUsd: number | null
  fdvUsd: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  volume6hUsd: number | null
  volume1hUsd: number | null
  volume5mUsd: number | null
  holders: number | null
  priceChange24h: number | null
  buys24h: number | null
  sells24h: number | null
  buys1h: number | null
  sells1h: number | null
  vaultLink: TokenAnalysisVaultLink
  secondary: TokenAnalysisSecondarySignals
}

export type UnresolvedInlineTokenAnalysis = {
  kind: 'unresolved'
  normalizedAddress: `0x${string}`
  checksumAddress: Address
  reason: 'no_supported_token_pair' | 'no_supported_active_market'
}

export type InlineTokenAnalysisResolution =
  | ResolvedInlineTokenAnalysis
  | UnresolvedInlineTokenAnalysis

type DexPairToken = {
  address?: string
  name?: string
  symbol?: string
}

type DexPairResponse = {
  chainId?: string
  dexId?: string
  url?: string
  pairAddress?: string
  baseToken?: DexPairToken
  quoteToken?: DexPairToken
  txns?: {
    m5?: { buys?: number; sells?: number }
    h1?: { buys?: number; sells?: number }
    h24?: { buys?: number; sells?: number }
  }
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number }
  priceChange?: { h24?: number }
  liquidity?: { usd?: number }
  fdv?: number
  marketCap?: number
  pairCreatedAt?: number
}

type DexPairsEnvelope = {
  pairs?: DexPairResponse[]
}

type CandidateMarket = {
  chain: SupportedDexChain
  chainPriority: number
  pair: DexPairResponse
  name: string | null
  symbol: string | null
  logoUrl: string | null
  metadataQualityScore: number
  liquidityUsd: number
  volume24hUsd: number
  active: boolean
}

type BaseCoinEnrichment = {
  name: string | null
  symbol: string | null
  createdAt: string | null
  holders: number | null
  creatorLabel: string | null
  logoUrl: string | null
}

const SUPPORTED_CHAIN_PRIORITY: SupportedDexChain[] = [
  'base',
  'ethereum',
  'arbitrum',
  'optimism',
  'polygon',
  'bsc',
  'avalanche',
  'zora',
]

const EIP1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const

const OWNER_ABI = [{ type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const
const PAUSED_ABI = [{ type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] }] as const

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSupportedChain(raw: unknown): SupportedDexChain | null {
  const value = asTrimmed(raw).toLowerCase()
  return SUPPORTED_CHAIN_PRIORITY.includes(value as SupportedDexChain) ? (value as SupportedDexChain) : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toLowercaseAddress(value: unknown): `0x${string}` | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  try {
    return getAddress(raw).toLowerCase() as `0x${string}`
  } catch {
    return null
  }
}

function resolveTokenSide(params: { pair: DexPairResponse; normalizedAddress: `0x${string}` }): DexPairToken | null {
  const baseToken = params.pair.baseToken
  if (toLowercaseAddress(baseToken?.address) === params.normalizedAddress) return baseToken ?? null
  const quoteToken = params.pair.quoteToken
  if (toLowercaseAddress(quoteToken?.address) === params.normalizedAddress) return quoteToken ?? null
  return null
}

function chainLabel(chain: SupportedDexChain): string {
  if (chain === 'base') return 'Base'
  if (chain === 'ethereum') return 'Ethereum'
  if (chain === 'arbitrum') return 'Arbitrum'
  if (chain === 'optimism') return 'Optimism'
  if (chain === 'polygon') return 'Polygon'
  if (chain === 'bsc') return 'BSC'
  if (chain === 'avalanche') return 'Avalanche'
  return 'Zora'
}

export function scoreTokenMetadataQuality(input: TokenAnalysisMetadataQuality): number {
  let score = 0
  if (input.verifiedTokenMetadataPresent) score += 16
  if (asTrimmed(input.name)) score += 8
  if (asTrimmed(input.symbol)) score += 4
  if (typeof input.decimals === 'number' && Number.isFinite(input.decimals)) score += 2
  if (input.supportsLogo && asTrimmed(input.logoUrl)) score += 1
  return score
}

function candidateChainPriority(chain: SupportedDexChain): number {
  return SUPPORTED_CHAIN_PRIORITY.indexOf(chain)
}

function candidateComparator(left: CandidateMarket, right: CandidateMarket): number {
  if (right.liquidityUsd !== left.liquidityUsd) return right.liquidityUsd - left.liquidityUsd
  if (right.volume24hUsd !== left.volume24hUsd) return right.volume24hUsd - left.volume24hUsd
  if (right.metadataQualityScore !== left.metadataQualityScore) return right.metadataQualityScore - left.metadataQualityScore
  if (left.chainPriority !== right.chainPriority) return left.chainPriority - right.chainPriority
  const leftPair = asTrimmed(left.pair.pairAddress).toLowerCase()
  const rightPair = asTrimmed(right.pair.pairAddress).toLowerCase()
  return leftPair.localeCompare(rightPair)
}

function tokenLogoUrlForChain(address: Address, chain: SupportedDexChain): string | null {
  const normalized = getAddress(address)
  if (chain === 'base' || chain === 'ethereum' || chain === 'arbitrum' || chain === 'optimism' || chain === 'polygon') {
    return `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/${chain}/assets/${normalized}/logo.png`
  }
  return null
}

export function selectStrongestSupportedMarket(params: {
  normalizedAddress: `0x${string}`
  pairs: DexPairResponse[]
}): { candidate: CandidateMarket | null; reason: UnresolvedInlineTokenAnalysis['reason'] | null } {
  const supported = params.pairs
    .map((pair) => {
      const chain = normalizeSupportedChain(pair.chainId)
      if (!chain) return null
      const tokenSide = resolveTokenSide({ pair, normalizedAddress: params.normalizedAddress })
      if (!tokenSide) return null
      const checksumAddress = getAddress(params.normalizedAddress)
      const metadataQualityScore = scoreTokenMetadataQuality({
        verifiedTokenMetadataPresent: false,
        name: asTrimmed(tokenSide.name) || null,
        symbol: asTrimmed(tokenSide.symbol) || null,
        decimals: null,
        logoUrl: tokenLogoUrlForChain(checksumAddress, chain),
        supportsLogo: chain === 'base' || chain === 'ethereum' || chain === 'arbitrum' || chain === 'optimism' || chain === 'polygon',
      })
      const liquidityUsd = toFiniteNumber(pair.liquidity?.usd) ?? 0
      const volume24hUsd = toFiniteNumber(pair.volume?.h24) ?? 0
      const txCount24h = (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0)
      return {
        chain,
        chainPriority: candidateChainPriority(chain),
        pair,
        name: asTrimmed(tokenSide.name) || null,
        symbol: asTrimmed(tokenSide.symbol) || null,
        logoUrl: tokenLogoUrlForChain(checksumAddress, chain),
        metadataQualityScore,
        liquidityUsd,
        volume24hUsd,
        active: liquidityUsd > 0 || volume24hUsd > 0 || txCount24h > 0,
      } satisfies CandidateMarket
    })
    .filter((candidate): candidate is CandidateMarket => Boolean(candidate))

  if (supported.length === 0) {
    return { candidate: null, reason: 'no_supported_token_pair' }
  }

  const baseCandidates = supported.filter((candidate) => candidate.chain === 'base' && candidate.active)
  if (baseCandidates.length > 0) {
    return { candidate: [...baseCandidates].sort(candidateComparator)[0] ?? null, reason: null }
  }

  const activeFallback = supported.filter((candidate) => candidate.chain !== 'base' && candidate.active)
  if (activeFallback.length > 0) {
    return { candidate: [...activeFallback].sort(candidateComparator)[0] ?? null, reason: null }
  }

  return { candidate: null, reason: 'no_supported_active_market' }
}

function baseRpcUrl(): string {
  const configured = asTrimmed(process.env.BASE_RPC_URL ?? '')
  return configured || 'https://mainnet.base.org'
}

function readPossibleHandle(raw: any): string | null {
  return asTrimmed(raw?.creatorProfile?.handle ?? raw?.creatorHandle ?? raw?.creatorProfile?.username ?? '') || null
}

async function fetchBaseCoinEnrichment(address: Address): Promise<BaseCoinEnrichment | null> {
  const key = asTrimmed(process.env.ZORA_SERVER_API_KEY ?? '')
  if (!key) return null
  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getCoin({ address, chain: base.id })
    const coin = response?.data?.zora20Token ?? null
    if (!coin) return null
    const imageUrl =
      asTrimmed(coin?.mediaContent?.previewImage?.small ?? '') ||
      asTrimmed(coin?.mediaContent?.previewImage?.medium ?? '') ||
      asTrimmed(coin?.mediaContent?.originalUri ?? '') ||
      null
    return {
      name: asTrimmed(coin?.name ?? '') || null,
      symbol: asTrimmed(coin?.symbol ?? '') || null,
      createdAt: asTrimmed(coin?.createdAt ?? '') || null,
      holders: toFiniteNumber(coin?.uniqueHolders),
      creatorLabel: readPossibleHandle(coin),
      logoUrl: imageUrl,
    }
  } catch {
    return null
  }
}

async function fetchBaseTokenRiskSignals(address: Address): Promise<Partial<TokenAnalysisSecondarySignals>> {
  const client = createPublicClient({
    chain: base,
    transport: http(baseRpcUrl()),
  })
  const [ownerResult, pausedResult, proxyResult, decimalsResult, nameResult, symbolResult] = await Promise.allSettled([
    client.readContract({ address, abi: OWNER_ABI, functionName: 'owner' }),
    client.readContract({ address, abi: PAUSED_ABI, functionName: 'paused' }),
    client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT }),
    client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
  ])

  const owner = ownerResult.status === 'fulfilled' ? toLowercaseAddress(ownerResult.value) : null
  const paused = pausedResult.status === 'fulfilled' && typeof pausedResult.value === 'boolean' ? pausedResult.value : null
  const proxyStorage = proxyResult.status === 'fulfilled' ? asTrimmed(proxyResult.value ?? '') : ''
  const proxyImplementation = proxyStorage && proxyStorage !== '0x' ? `0x${proxyStorage.slice(-40)}` : ''
  const proxy = toLowercaseAddress(proxyImplementation)
  const decimals = decimalsResult.status === 'fulfilled' && typeof decimalsResult.value === 'number' ? decimalsResult.value : null
  const name = nameResult.status === 'fulfilled' ? asTrimmed(nameResult.value ?? '') || null : null
  const symbol = symbolResult.status === 'fulfilled' ? asTrimmed(symbolResult.value ?? '') || null : null

  const risk: TokenAnalysisRiskSignals = {
    ownership: owner ? (owner === '0x0000000000000000000000000000000000000000' ? 'renounced' : 'owned') : null,
    mint: null,
    blacklist: null,
    proxy: proxy ? 'yes' : proxyResult.status === 'fulfilled' ? 'no' : null,
    taxBps: null,
    liquidityStatus: 'unknown',
  }

  if (paused === true) {
    risk.blacklist = 'unknown'
  }

  return {
    risk,
    metadataQuality: {
      verifiedTokenMetadataPresent: Boolean(name || symbol || typeof decimals === 'number'),
      name,
      symbol,
      decimals,
      logoUrl: tokenLogoUrlForChain(address, 'base'),
      supportsLogo: true,
    },
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function resolveVaultLink(params: {
  db: Db | null
  normalizedAddress: `0x${string}`
}): Promise<TokenAnalysisVaultLink> {
  if (!params.db) {
    return {
      linked: false,
      relation: null,
      vaultAddress: null,
      creatorCoinAddress: null,
      shareTokenAddress: null,
      creatorLabel: null,
    }
  }

  try {
    const result = await params.db.sql`
      SELECT
        vault_address,
        creator_coin_address,
        share_token_address,
        config_json
      FROM keepr_vaults
      WHERE LOWER(vault_address) = ${params.normalizedAddress}
        OR LOWER(creator_coin_address) = ${params.normalizedAddress}
        OR LOWER(share_token_address) = ${params.normalizedAddress}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1;
    `
    const row = result.rows?.[0] ?? null
    if (!row) {
      return {
        linked: false,
        relation: null,
        vaultAddress: null,
        creatorCoinAddress: null,
        shareTokenAddress: null,
        creatorLabel: null,
      }
    }

    const creatorCoinAddress = toLowercaseAddress(row.creator_coin_address)
    const shareTokenAddress = toLowercaseAddress(row.share_token_address)
    const vaultAddress = toLowercaseAddress(row.vault_address)
    const relation =
      creatorCoinAddress === params.normalizedAddress
        ? 'creator_coin'
        : shareTokenAddress === params.normalizedAddress
          ? 'share_token'
          : vaultAddress === params.normalizedAddress
            ? 'vault'
            : null

    const configJson =
      row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
        ? (row.config_json as Record<string, any>)
        : {}
    const creatorLabel =
      asTrimmed(configJson?.vault?.creatorTicker ?? '') ||
      asTrimmed(configJson?.vault?.creatorName ?? '') ||
      null

    return {
      linked: true,
      relation,
      vaultAddress,
      creatorCoinAddress,
      shareTokenAddress,
      creatorLabel,
    }
  } catch {
    return {
      linked: false,
      relation: null,
      vaultAddress: null,
      creatorCoinAddress: null,
      shareTokenAddress: null,
      creatorLabel: null,
    }
  }
}

async function resolveLocalCreatorMetrics(params: {
  db: Db | null
  normalizedAddress: `0x${string}`
  creatorCoinAddress: `0x${string}` | null
}): Promise<{ marketCapUsd: number | null; volume24hUsd: number | null }> {
  if (!params.db) return { marketCapUsd: null, volume24hUsd: null }
  const coinAddress = params.creatorCoinAddress ?? params.normalizedAddress
  try {
    const result = await params.db.sql`
      SELECT market_cap_usd, volume_24h_usd
      FROM creator_coins
      WHERE LOWER(coin_address) = ${coinAddress}
      LIMIT 1;
    `
    const row = result.rows?.[0] ?? null
    return {
      marketCapUsd: toFiniteNumber(row?.market_cap_usd),
      volume24hUsd: toFiniteNumber(row?.volume_24h_usd),
    }
  } catch {
    return { marketCapUsd: null, volume24hUsd: null }
  }
}

async function fetchDexPairs(normalizedAddress: `0x${string}`): Promise<DexPairResponse[]> {
  try {
    const response = await fetchExternalJson<DexPairsEnvelope>(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(normalizedAddress)}`,
      {
        label: 'telegram_inline_token_analysis',
        allowedHosts: ['api.dexscreener.com'],
        headers: { Accept: 'application/json' },
        timeoutMs: 800,
        maxResponseBytes: 1_000_000,
      },
    )
    return Array.isArray(response.data?.pairs) ? response.data.pairs : []
  } catch {
    return []
  }
}

export async function resolveInlineTokenAnalysis(params: {
  normalizedAddress: `0x${string}`
  db?: Db | null
  secondaryBudgetMs?: number
}): Promise<InlineTokenAnalysisResolution> {
  const normalizedAddress = params.normalizedAddress
  const checksumAddress = getAddress(normalizedAddress)
  const secondaryBudgetMs = Number.isFinite(params.secondaryBudgetMs) ? Math.max(1, Math.floor(params.secondaryBudgetMs!)) : 250

  const [pairs, vaultLink] = await Promise.all([
    fetchDexPairs(normalizedAddress),
    resolveVaultLink({ db: params.db ?? null, normalizedAddress }),
  ])

  const marketSelection = selectStrongestSupportedMarket({ normalizedAddress, pairs })
  if (!marketSelection.candidate) {
    return {
      kind: 'unresolved',
      normalizedAddress,
      checksumAddress,
      reason: marketSelection.reason ?? 'no_supported_token_pair',
    }
  }

  const candidate = marketSelection.candidate
  const localMetrics = await resolveLocalCreatorMetrics({
    db: params.db ?? null,
    normalizedAddress,
    creatorCoinAddress: vaultLink.creatorCoinAddress,
  })

  const resolved: ResolvedInlineTokenAnalysis = {
    kind: 'resolved',
    normalizedAddress,
    checksumAddress,
    chain: candidate.chain,
    chainLabel: chainLabel(candidate.chain),
    dexId: asTrimmed(candidate.pair.dexId) || null,
    dexUrl: asTrimmed(candidate.pair.url) || null,
    pairAddress: toLowercaseAddress(candidate.pair.pairAddress),
    name: candidate.name,
    symbol: candidate.symbol,
    decimals: null,
    logoUrl: candidate.logoUrl,
    metadataQualityScore: candidate.metadataQualityScore,
    verifiedTokenMetadataPresent: false,
    ageSource: typeof candidate.pair.pairCreatedAt === 'number' ? 'pair_created' : null,
    createdAt: typeof candidate.pair.pairCreatedAt === 'number' ? new Date(candidate.pair.pairCreatedAt).toISOString() : null,
    marketCapUsd: localMetrics.marketCapUsd ?? toFiniteNumber(candidate.pair.marketCap),
    fdvUsd: toFiniteNumber(candidate.pair.fdv),
    liquidityUsd: toFiniteNumber(candidate.pair.liquidity?.usd),
    volume24hUsd: localMetrics.volume24hUsd ?? toFiniteNumber(candidate.pair.volume?.h24),
    volume6hUsd: toFiniteNumber(candidate.pair.volume?.h6),
    volume1hUsd: toFiniteNumber(candidate.pair.volume?.h1),
    volume5mUsd: toFiniteNumber(candidate.pair.volume?.m5),
    holders: null,
    priceChange24h:
      typeof candidate.pair.priceChange?.h24 === 'number' && Number.isFinite(candidate.pair.priceChange.h24)
        ? candidate.pair.priceChange.h24 / 100
        : null,
    buys24h: toFiniteNumber(candidate.pair.txns?.h24?.buys),
    sells24h: toFiniteNumber(candidate.pair.txns?.h24?.sells),
    buys1h: toFiniteNumber(candidate.pair.txns?.h1?.buys),
    sells1h: toFiniteNumber(candidate.pair.txns?.h1?.sells),
    vaultLink,
    secondary: {
      risk: {
        ownership: null,
        mint: null,
        blacklist: null,
        proxy: null,
        taxBps: null,
        liquidityStatus: 'unknown',
      },
      metadataQuality: {},
      createdAt: null,
      holders: null,
      creatorLabel: null,
    },
  }

  const secondaryTasks: Array<Promise<unknown>> = []
  if (candidate.chain === 'base') {
    secondaryTasks.push(withTimeout(fetchBaseCoinEnrichment(checksumAddress), secondaryBudgetMs))
    secondaryTasks.push(withTimeout(fetchBaseTokenRiskSignals(checksumAddress), secondaryBudgetMs))
  }

  if (secondaryTasks.length === 0) return resolved

  const secondaryResults = await Promise.allSettled(secondaryTasks)
  for (const result of secondaryResults) {
    if (result.status !== 'fulfilled' || !result.value || typeof result.value !== 'object') continue
    const value = result.value as Record<string, any>
    if ('holders' in value || 'createdAt' in value || 'creatorLabel' in value) {
      if (asTrimmed(value.name ?? '')) resolved.name = asTrimmed(value.name)
      if (asTrimmed(value.symbol ?? '')) resolved.symbol = asTrimmed(value.symbol)
      if (asTrimmed(value.logoUrl ?? '')) resolved.logoUrl = asTrimmed(value.logoUrl)
      if (asTrimmed(value.createdAt ?? '')) {
        resolved.createdAt = asTrimmed(value.createdAt)
        resolved.ageSource = 'token_created'
      }
      if (typeof value.holders === 'number' && Number.isFinite(value.holders)) {
        resolved.holders = value.holders
        resolved.secondary.holders = value.holders
      }
      if (asTrimmed(value.creatorLabel ?? '')) {
        resolved.secondary.creatorLabel = asTrimmed(value.creatorLabel)
        if (!resolved.vaultLink.creatorLabel) {
          resolved.vaultLink = {
            ...resolved.vaultLink,
            creatorLabel: asTrimmed(value.creatorLabel),
          }
        }
      }
    }
    if ('risk' in value || 'metadataQuality' in value) {
      if (value.risk && typeof value.risk === 'object') {
        resolved.secondary.risk = {
          ...resolved.secondary.risk,
          ...(value.risk as TokenAnalysisRiskSignals),
        }
      }
      if (value.metadataQuality && typeof value.metadataQuality === 'object') {
        resolved.secondary.metadataQuality = {
          ...resolved.secondary.metadataQuality,
          ...(value.metadataQuality as Partial<TokenAnalysisMetadataQuality>),
        }
        const mergedQuality: TokenAnalysisMetadataQuality = {
          verifiedTokenMetadataPresent:
            Boolean((value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).verifiedTokenMetadataPresent)
            || resolved.verifiedTokenMetadataPresent,
          name:
            asTrimmed((value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).name ?? '') || resolved.name,
          symbol:
            asTrimmed((value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).symbol ?? '') || resolved.symbol,
          decimals:
            typeof (value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).decimals === 'number'
              ? Number((value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).decimals)
              : resolved.decimals,
          logoUrl:
            asTrimmed((value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).logoUrl ?? '') || resolved.logoUrl,
          supportsLogo:
            (value.metadataQuality as Partial<TokenAnalysisMetadataQuality>).supportsLogo === true
            || Boolean(resolved.logoUrl),
        }
        resolved.verifiedTokenMetadataPresent = mergedQuality.verifiedTokenMetadataPresent
        resolved.decimals = mergedQuality.decimals
        resolved.metadataQualityScore = Math.max(resolved.metadataQualityScore, scoreTokenMetadataQuality(mergedQuality))
      }
    }
  }

  return resolved
}
