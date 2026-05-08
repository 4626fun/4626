import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'

import {
  getStringQuery,
  requireServerKey,
  setPublicCors,
} from '../../../server/zora/_shared.js'

declare const process: { env: Record<string, string | undefined> }

export type PreviewKind = 'creator' | 'content' | 'vault' | 'trends'
export type TrendsSort = 'volume' | 'marketCap' | 'priceChange' | 'new'
export type TrendsTime = '1d' | '1w' | '1y'

export type PreviewPayload = {
  title: string
  description: string
  imageUrl: string
  pageUrl: string
}

type ZoraCoinLike = {
  address?: string
  name?: string
  symbol?: string
  description?: string
  creatorProfile?: {
    handle?: string
  }
  mediaContent?: {
    originalUri?: string
    previewImage?: {
      small?: string
      medium?: string
    }
  }
}

type TrendListKind =
  | 'TOP_VOLUME_TRENDS_24H'
  | 'MOST_VALUABLE_TRENDS'
  | 'TRENDING_TRENDS'
  | 'NEW_TRENDS'

type VaultPreviewMeta = {
  creatorSymbol: string | null
  vaultSymbol: string | null
  shareOftAddress: Address | null
  creatorTokenAddress: Address | null
}

const DEFAULT_PREVIEW_TITLE = '4626.fun - ERC-4626 Creator Vaults on Base'
const DEFAULT_PREVIEW_DESCRIPTION =
  'Creator coin vaults, yield, and fair launches on Base.'
const SITE_NAME = '4626.fun'
const BOT_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600'
const SOCIAL_BOT_USER_AGENT_RE =
  /([Tt]witterbot|[Tt]elegram[Bb]ot|[Ff]acebookexternalhit|[Ss]lackbot|[Dd]iscord[Bb]ot|[Ll]inked[Ii]n[Bb]ot|[Ww]hats[Aa]pp)/

const SAFE_CHAIN_RE = /^[a-z0-9-]{1,32}$/i
const SAFE_TIME_RE = /^(1d|1w|1y)$/i
const SAFE_SORT_RE = /^(volume|marketCap|priceChange|new)$/i
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const VAULT_VIEW_ABI = [
  {
    type: 'function',
    name: 'CREATOR_COIN',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'gaugeController',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const GAUGE_VIEW_ABI = [
  {
    type: 'function',
    name: 'shareOFT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const ERC20_SYMBOL_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateDescription(value: string, maxLength = 280): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function shortAddress(value: Address): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function normalizeAddress(raw: string | null): Address | null {
  if (!raw) return null
  const value = raw.trim()
  if (!ADDRESS_RE.test(value)) return null
  return value.toLowerCase() as Address
}

function normalizeChain(raw: string | null): string {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!value) return 'base'
  if (!SAFE_CHAIN_RE.test(value)) return 'base'
  return value
}

function normalizeSort(raw: string | null): TrendsSort {
  const value = String(raw ?? '').trim()
  if (!SAFE_SORT_RE.test(value)) return 'volume'
  if (value === 'marketCap') return 'marketCap'
  if (value === 'priceChange') return 'priceChange'
  if (value === 'new') return 'new'
  return 'volume'
}

function normalizeTime(raw: string | null): TrendsTime {
  const value = String(raw ?? '').trim()
  if (!SAFE_TIME_RE.test(value)) return '1d'
  if (value === '1w') return '1w'
  if (value === '1y') return '1y'
  return '1d'
}

function normalizePreviewKind(raw: string | null): PreviewKind {
  switch (String(raw ?? '').trim().toLowerCase()) {
    case 'creator':
      return 'creator'
    case 'content':
      return 'content'
    case 'vault':
      return 'vault'
    case 'trends':
      return 'trends'
    default:
      return 'trends'
  }
}

type ParsedRouteInput = {
  pathname: string
  searchParams: URLSearchParams
}

function parsePathAndQuery(pathOrUrl: string): ParsedRouteInput | null {
  const raw = String(pathOrUrl || '').trim()
  if (!raw) return null
  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://debug.4626.local')
    return {
      pathname: url.pathname,
      searchParams: url.searchParams,
    }
  } catch {
    return null
  }
}

export type SocialRewriteId =
  | 'explore-creators-list'
  | 'explore-creator-detail'
  | 'explore-content-list'
  | 'explore-content-detail'
  | 'explore-vaults-list'
  | 'vault-detail'
  | 'explore-trends-list'

export type SocialRewriteMatch = {
  id: SocialRewriteId
  sourcePattern: string
  destPath: string
  query: {
    kind: PreviewKind
    chain?: string
    address?: string
    sort?: TrendsSort
    time?: TrendsTime
  }
}

function getHeaderFirst(req: VercelRequest, key: string): string {
  const raw = req.headers[key.toLowerCase()]
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim()
  if (typeof raw === 'string') return raw.split(',')[0]?.trim() ?? ''
  return ''
}

function normalizeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function getRequestOrigin(req: VercelRequest): string {
  const forwardedHost = getHeaderFirst(req, 'x-forwarded-host')
  const host = forwardedHost || getHeaderFirst(req, 'host')
  const protoRaw = getHeaderFirst(req, 'x-forwarded-proto').toLowerCase()
  const proto = protoRaw === 'http' || protoRaw === 'https' ? protoRaw : 'https'
  if (!host) return 'https://4626.fun'
  const resolved = normalizeOrigin(`${proto}://${host}`)
  if (!resolved) return 'https://4626.fun'
  return resolved
}

function buildDestPathFromQuery(query: SocialRewriteMatch['query']): string {
  const url = new URL('/api/social-preview', 'https://internal.4626.local')
  url.searchParams.set('kind', query.kind)
  if (query.chain) url.searchParams.set('chain', query.chain)
  if (query.address) url.searchParams.set('address', query.address)
  if (query.sort) url.searchParams.set('sort', query.sort)
  if (query.time) url.searchParams.set('time', query.time)
  return `${url.pathname}${url.search}`
}

export function isSocialBotUserAgent(userAgent: string): boolean {
  return SOCIAL_BOT_USER_AGENT_RE.test(String(userAgent || ''))
}

export function matchSocialPreviewRewrite(pathOrUrl: string, userAgent: string): SocialRewriteMatch | null {
  if (!isSocialBotUserAgent(userAgent)) return null
  const parsed = parsePathAndQuery(pathOrUrl)
  if (!parsed) return null
  const pathname = parsed.pathname

  if (/^\/explore\/creators\/?$/i.test(pathname)) {
    const query: SocialRewriteMatch['query'] = { kind: 'creator' }
    return {
      id: 'explore-creators-list',
      sourcePattern: '/explore/creators',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  const creatorDetailMatch = pathname.match(
    /^\/explore\/creators\/([a-zA-Z0-9-]+)\/([a-fA-F0-9x]{42})\/?$/i,
  )
  if (creatorDetailMatch) {
    const query: SocialRewriteMatch['query'] = {
      kind: 'creator',
      chain: creatorDetailMatch[1],
      address: creatorDetailMatch[2],
    }
    return {
      id: 'explore-creator-detail',
      sourcePattern: '/explore/creators/:chain/:address',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  if (/^\/explore\/content\/?$/i.test(pathname)) {
    const query: SocialRewriteMatch['query'] = { kind: 'content' }
    return {
      id: 'explore-content-list',
      sourcePattern: '/explore/content',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  const contentDetailMatch = pathname.match(
    /^\/explore\/content\/([a-zA-Z0-9-]+)\/([a-fA-F0-9x]{42})\/?$/i,
  )
  if (contentDetailMatch) {
    const query: SocialRewriteMatch['query'] = {
      kind: 'content',
      chain: contentDetailMatch[1],
      address: contentDetailMatch[2],
    }
    return {
      id: 'explore-content-detail',
      sourcePattern: '/explore/content/:chain/:address',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  if (/^\/explore\/vaults\/?$/i.test(pathname)) {
    const query: SocialRewriteMatch['query'] = { kind: 'vault' }
    return {
      id: 'explore-vaults-list',
      sourcePattern: '/explore/vaults',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  const vaultDetailMatch = pathname.match(/^\/vault\/([a-fA-F0-9x]{42})\/?$/i)
  if (vaultDetailMatch) {
    const query: SocialRewriteMatch['query'] = {
      kind: 'vault',
      address: vaultDetailMatch[1],
    }
    return {
      id: 'vault-detail',
      sourcePattern: '/vault/:address',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  if (/^\/explore\/trends\/?$/i.test(pathname)) {
    const query: SocialRewriteMatch['query'] = {
      kind: 'trends',
      sort: normalizeSort(parsed.searchParams.get('sort')),
      time: normalizeTime(parsed.searchParams.get('time')),
    }
    return {
      id: 'explore-trends-list',
      sourcePattern: '/explore/trends',
      destPath: buildDestPathFromQuery(query),
      query,
    }
  }

  return null
}

function resolveChainId(chain: string): number {
  if (chain === 'base') return 8453
  const parsed = Number(chain)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  return 8453
}

function buildTokenImageUrl(params: {
  origin: string
  address: Address
  chainId: number
  tokenKind: 'creator' | 'share'
}): string {
  const url = new URL('/api/token/image', params.origin)
  url.searchParams.set('address', params.address)
  url.searchParams.set('chain', String(params.chainId))
  url.searchParams.set('size', '1200')
  url.searchParams.set('tokenKind', params.tokenKind)
  return url.toString()
}

function buildFallbackImageUrl(origin: string): string {
  const url = new URL('/assets/og-image.png', origin)
  return url.toString()
}

function buildPageUrl(origin: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path, origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const trimmed = String(value ?? '').trim()
      if (!trimmed) continue
      url.searchParams.set(key, trimmed)
    }
  }
  return url.toString()
}

function pickFirstExploreCoin(response: any): ZoraCoinLike | null {
  const data = response?.data
  const connection = data?.edges
    ? data
    : data?.exploreList ?? data?.creatorCoins ?? data?.coins ?? null
  const edge = Array.isArray(connection?.edges) ? connection.edges[0] : null
  const node = edge?.node ?? null
  return node ?? null
}

async function withZoraSdk<T>(runner: (sdk: any) => Promise<T>): Promise<T | null> {
  const key = requireServerKey()
  if (!key) return null

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    return await runner(sdk)
  } catch {
    return null
  }
}

async function fetchZoraCoin(address: Address, chainId: number): Promise<ZoraCoinLike | null> {
  const response = await withZoraSdk(async (sdk) => {
    return await sdk.getCoin({ address, chain: chainId })
  })
  return (response as any)?.data?.zora20Token ?? null
}

async function fetchTopCreatorCoin(): Promise<ZoraCoinLike | null> {
  const response = await withZoraSdk(async (sdk) => {
    return await sdk.getExploreTopVolumeCreators24h({ count: 1 })
  })
  return pickFirstExploreCoin(response)
}

async function fetchTopContentCoin(): Promise<ZoraCoinLike | null> {
  const response = await withZoraSdk(async (sdk) => {
    return await sdk.getTrendingPosts({ count: 1 })
  })
  return pickFirstExploreCoin(response)
}

function resolveTrendList(sort: 'volume' | 'marketCap' | 'priceChange' | 'new'): {
  list: TrendListKind
  label: string
} {
  if (sort === 'marketCap') return { list: 'MOST_VALUABLE_TRENDS', label: 'market cap' }
  if (sort === 'priceChange') return { list: 'TRENDING_TRENDS', label: 'momentum' }
  if (sort === 'new') return { list: 'NEW_TRENDS', label: 'new launches' }
  return { list: 'TOP_VOLUME_TRENDS_24H', label: 'volume' }
}

async function fetchTopTrendCoin(
  sort: 'volume' | 'marketCap' | 'priceChange' | 'new',
): Promise<{ coin: ZoraCoinLike | null; label: string }> {
  const trend = resolveTrendList(sort)
  const response = await withZoraSdk(async (sdk) => {
    const options = { count: 1 }
    switch (trend.list) {
      case 'MOST_VALUABLE_TRENDS':
        return await sdk.getMostValuableTrends(options)
      case 'TRENDING_TRENDS':
        return await sdk.getTrendingTrends(options)
      case 'NEW_TRENDS':
        return await sdk.getNewTrends(options)
      case 'TOP_VOLUME_TRENDS_24H':
      default:
        return await sdk.getTopVolumeTrends24h(options)
    }
  })
  return { coin: pickFirstExploreCoin(response), label: trend.label }
}

async function resolveVaultPreviewMeta(vaultAddress: Address): Promise<VaultPreviewMeta> {
  const rpcUrl =
    String(process.env.BASE_READ_RPC_URL ?? '').trim() ||
    String(process.env.BASE_RPC_URL ?? '').trim() ||
    'https://mainnet.base.org'

  const client = createPublicClient({
    transport: http(rpcUrl),
  })

  const creatorTokenAddress = (await client
    .readContract({
      address: vaultAddress,
      abi: VAULT_VIEW_ABI,
      functionName: 'CREATOR_COIN',
    })
    .catch(() => null)) as Address | null

  const gaugeControllerAddress = (await client
    .readContract({
      address: vaultAddress,
      abi: VAULT_VIEW_ABI,
      functionName: 'gaugeController',
    })
    .catch(() => null)) as Address | null

  const shareOftAddress = gaugeControllerAddress
    ? ((await client
        .readContract({
          address: gaugeControllerAddress,
          abi: GAUGE_VIEW_ABI,
          functionName: 'shareOFT',
        })
        .catch(() => null)) as Address | null)
    : null

  const creatorSymbol = creatorTokenAddress
    ? ((await client
        .readContract({
          address: creatorTokenAddress,
          abi: ERC20_SYMBOL_ABI,
          functionName: 'symbol',
        })
        .catch(() => null)) as string | null)
    : null

  const vaultSymbol = shareOftAddress
    ? ((await client
        .readContract({
          address: shareOftAddress,
          abi: ERC20_SYMBOL_ABI,
          functionName: 'symbol',
        })
        .catch(() => null)) as string | null)
    : null

  return {
    creatorSymbol: creatorSymbol?.trim() || null,
    vaultSymbol: vaultSymbol?.trim() || null,
    shareOftAddress: normalizeAddress(shareOftAddress ?? null),
    creatorTokenAddress: normalizeAddress(creatorTokenAddress ?? null),
  }
}

function toContentDescription(value: string | null | undefined, fallback: string): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback
  return truncateDescription(normalized, 260)
}

function renderSocialPreviewHtml(payload: PreviewPayload): string {
  const title = escapeHtml(payload.title)
  const description = escapeHtml(payload.description)
  const imageUrl = escapeHtml(payload.imageUrl)
  const pageUrl = escapeHtml(payload.pageUrl)

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${title}</title>`,
    `  <meta name="description" content="${description}" />`,
    '  <meta property="og:type" content="website" />',
    `  <meta property="og:site_name" content="${SITE_NAME}" />`,
    `  <meta property="og:title" content="${title}" />`,
    `  <meta property="og:description" content="${description}" />`,
    `  <meta property="og:url" content="${pageUrl}" />`,
    `  <meta property="og:image" content="${imageUrl}" />`,
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="1200" />',
    `  <meta property="og:image:alt" content="${title}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${title}" />`,
    `  <meta name="twitter:description" content="${description}" />`,
    `  <meta name="twitter:image" content="${imageUrl}" />`,
    `  <meta name="twitter:image:alt" content="${title}" />`,
    `  <link rel="canonical" href="${pageUrl}" />`,
    '  <style>',
    '    :root { color-scheme: dark; }',
    '    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #07080a; color: #eef0f4; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }',
    '    .card { width: min(760px, 92vw); border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; padding: 24px; background: radial-gradient(circle at top right, rgba(66,153,225,0.16), transparent 45%), rgba(14, 17, 22, 0.92); }',
    '    h1 { margin: 0 0 12px; font-size: 22px; line-height: 1.25; }',
    '    p { margin: 0; color: #b4bac6; line-height: 1.45; }',
    '    a { display: inline-block; margin-top: 14px; color: #6bb8ff; text-decoration: none; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="card">',
    `    <h1>${title}</h1>`,
    `    <p>${description}</p>`,
    `    <a href="${pageUrl}" rel="noopener noreferrer">Open on ${SITE_NAME}</a>`,
    '  </main>',
    '</body>',
    '</html>',
  ].join('\n')
}

async function buildCreatorPreview(params: {
  origin: string
  chain: string
  chainId: number
  address: Address | null
}): Promise<PreviewPayload> {
  if (!params.address) {
    const topCoin = await fetchTopCreatorCoin()
    const topCoinAddress = normalizeAddress(topCoin?.address ?? null)
    const topSymbol = String(topCoin?.symbol ?? '').trim()
    const title = 'Top Creators on Base - 4626'
    const description = topSymbol
      ? `Discover top creator coins on Base. Current spotlight: ${topSymbol}.`
      : 'Discover top creator coins on Base and explore creator market activity on 4626.'
    const imageUrl = topCoinAddress
      ? buildTokenImageUrl({
          origin: params.origin,
          address: topCoinAddress,
          chainId: 8453,
          tokenKind: 'creator',
        })
      : buildFallbackImageUrl(params.origin)
    return {
      title,
      description,
      imageUrl,
      pageUrl: buildPageUrl(params.origin, '/explore/creators'),
    }
  }

  const coin = await fetchZoraCoin(params.address, params.chainId)
  const symbol = String(coin?.symbol ?? '').trim() || 'CREATOR'
  const name = String(coin?.name ?? '').trim() || `Creator ${shortAddress(params.address)}`
  const handle = String(coin?.creatorProfile?.handle ?? '').trim()
  const fallbackDescription = `Track ${symbol} creator market activity and creator vault performance on 4626.`
  const description =
    toContentDescription(coin?.description, fallbackDescription) +
    (handle ? ` Creator: @${handle}.` : '')

  const imageUrl = buildTokenImageUrl({
    origin: params.origin,
    address: params.address,
    chainId: params.chainId,
    tokenKind: 'creator',
  })

  return {
    title: `${name} (${symbol}) - Creator on 4626`,
    description,
    imageUrl,
    pageUrl: buildPageUrl(params.origin, `/explore/creators/${params.chain}/${params.address}`),
  }
}

async function buildContentPreview(params: {
  origin: string
  chain: string
  chainId: number
  address: Address | null
}): Promise<PreviewPayload> {
  if (!params.address) {
    const topCoin = await fetchTopContentCoin()
    const topCoinAddress = normalizeAddress(topCoin?.address ?? null)
    const topSymbol = String(topCoin?.symbol ?? '').trim()
    const title = 'Top Content on Base - 4626'
    const description = topSymbol
      ? `Explore leading content coins on Base. Current spotlight: ${topSymbol}.`
      : 'Explore leading content coins on Base with liquidity, volume, and trend visibility on 4626.'
    const imageUrl = topCoinAddress
      ? buildTokenImageUrl({
          origin: params.origin,
          address: topCoinAddress,
          chainId: 8453,
          tokenKind: 'creator',
        })
      : buildFallbackImageUrl(params.origin)

    return {
      title,
      description,
      imageUrl,
      pageUrl: buildPageUrl(params.origin, '/explore/content'),
    }
  }

  const coin = await fetchZoraCoin(params.address, params.chainId)
  const symbol = String(coin?.symbol ?? '').trim() || 'CONTENT'
  const name = String(coin?.name ?? '').trim() || `Content ${shortAddress(params.address)}`
  const fallbackDescription = `Track ${symbol} content coin market activity and pool performance on 4626.`
  const description = toContentDescription(coin?.description, fallbackDescription)
  const imageUrl = buildTokenImageUrl({
    origin: params.origin,
    address: params.address,
    chainId: params.chainId,
    tokenKind: 'creator',
  })

  return {
    title: `${name} (${symbol}) - Content on 4626`,
    description,
    imageUrl,
    pageUrl: buildPageUrl(params.origin, `/explore/content/${params.chain}/${params.address}`),
  }
}

async function buildVaultPreview(params: {
  origin: string
  address: Address | null
}): Promise<PreviewPayload> {
  if (!params.address) {
    const topCoin = await fetchTopCreatorCoin()
    const topCoinAddress = normalizeAddress(topCoin?.address ?? null)
    const title = 'Top Vaults on Base - 4626'
    const description =
      'Explore active creator vaults on Base, including share-token liquidity and performance signals.'
    const imageUrl = topCoinAddress
      ? buildTokenImageUrl({
          origin: params.origin,
          address: topCoinAddress,
          chainId: 8453,
          tokenKind: 'creator',
        })
      : buildFallbackImageUrl(params.origin)

    return {
      title,
      description,
      imageUrl,
      pageUrl: buildPageUrl(params.origin, '/explore/vaults'),
    }
  }

  const vaultMeta = await resolveVaultPreviewMeta(params.address).catch(() => null)
  const creatorSymbol = vaultMeta?.creatorSymbol ?? null
  const vaultSymbol = vaultMeta?.vaultSymbol ?? null
  const shareOftAddress = vaultMeta?.shareOftAddress ?? null
  const creatorTokenAddress = vaultMeta?.creatorTokenAddress ?? null

  const imageAddress = shareOftAddress ?? creatorTokenAddress ?? params.address
  const tokenKind: 'creator' | 'share' = shareOftAddress ? 'share' : 'creator'
  const title = creatorSymbol
    ? `${creatorSymbol} Vault - 4626`
    : `Vault ${shortAddress(params.address)} - 4626`
  const description = truncateDescription(
    vaultSymbol
      ? `Track ${vaultSymbol} vault share performance, deposits, and strategy status on 4626.`
      : 'Track vault share performance, deposits, and strategy status on 4626.',
  )

  return {
    title,
    description,
    imageUrl: buildTokenImageUrl({
      origin: params.origin,
      address: imageAddress,
      chainId: 8453,
      tokenKind,
    }),
    pageUrl: buildPageUrl(params.origin, `/vault/${params.address}`),
  }
}

async function buildTrendsPreview(params: {
  origin: string
  sort: TrendsSort
  time: TrendsTime
}): Promise<PreviewPayload> {
  const trend = await fetchTopTrendCoin(params.sort)
  const topCoinAddress = normalizeAddress(trend.coin?.address ?? null)
  const topSymbol = String(trend.coin?.symbol ?? '').trim()
  const timeframeLabel = params.time === '1w' ? '7d' : params.time === '1y' ? '1y' : '24h'
  const title = 'Top Trends on Base - 4626'
  const description = topSymbol
    ? `Live ${timeframeLabel} ${trend.label} trends on Base. Leading now: ${topSymbol}.`
    : `Live ${timeframeLabel} trend visibility on Base, ranked by ${trend.label}.`
  const imageUrl = topCoinAddress
    ? buildTokenImageUrl({
        origin: params.origin,
        address: topCoinAddress,
        chainId: 8453,
        tokenKind: 'creator',
      })
    : buildFallbackImageUrl(params.origin)

  return {
    title,
    description,
    imageUrl,
    pageUrl: buildPageUrl(params.origin, '/explore/trends', {
      sort: params.sort,
      time: params.time,
    }),
  }
}

function buildFallbackPreview(origin: string): PreviewPayload {
  return {
    title: DEFAULT_PREVIEW_TITLE,
    description: DEFAULT_PREVIEW_DESCRIPTION,
    imageUrl: buildFallbackImageUrl(origin),
    pageUrl: buildPageUrl(origin, '/'),
  }
}

export type SocialPreviewInput = {
  origin: string
  kind: PreviewKind
  chain: string
  chainId: number
  address: Address | null
  sort: TrendsSort
  time: TrendsTime
}

export function normalizeSocialPreviewInput(params: {
  origin: string
  kind?: string | null
  chain?: string | null
  address?: string | null
  sort?: string | null
  time?: string | null
}): SocialPreviewInput {
  const chain = normalizeChain(params.chain ?? null)
  return {
    origin: params.origin,
    kind: normalizePreviewKind(params.kind ?? null),
    chain,
    chainId: resolveChainId(chain),
    address: normalizeAddress(params.address ?? null),
    sort: normalizeSort(params.sort ?? null),
    time: normalizeTime(params.time ?? null),
  }
}

export async function resolveSocialPreviewPayload(input: SocialPreviewInput): Promise<PreviewPayload> {
  switch (input.kind) {
    case 'creator':
      return buildCreatorPreview({
        origin: input.origin,
        chain: input.chain,
        chainId: input.chainId,
        address: input.address,
      })
    case 'content':
      return buildContentPreview({
        origin: input.origin,
        chain: input.chain,
        chainId: input.chainId,
        address: input.address,
      })
    case 'vault':
      return buildVaultPreview({
        origin: input.origin,
        address: input.address,
      })
    case 'trends':
    default:
      return buildTrendsPreview({
        origin: input.origin,
        sort: input.sort,
        time: input.time,
      })
  }
}

export async function resolveSocialPreviewPayloadSafe(input: SocialPreviewInput): Promise<PreviewPayload> {
  try {
    return await resolveSocialPreviewPayload(input)
  } catch {
    return buildFallbackPreview(input.origin)
  }
}

function setResponseHeaders(res: VercelResponse): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', BOT_CACHE_CONTROL)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const input = normalizeSocialPreviewInput({
    origin: getRequestOrigin(req),
    kind: getStringQuery(req, 'kind'),
    chain: getStringQuery(req, 'chain'),
    address: getStringQuery(req, 'address'),
    sort: getStringQuery(req, 'sort'),
    time: getStringQuery(req, 'time'),
  })
  const payload = await resolveSocialPreviewPayloadSafe(input)

  setResponseHeaders(res)
  res.status(200).send(renderSocialPreviewHtml(payload))
}
