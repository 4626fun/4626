import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  readBoundedJsonObjectBody,
  buildWalletIntelligence,
  getCachedWalletIntelligence,
  cacheWalletIntelligence,
  type WalletIntelligenceOptions,
} from '@4626/server-core'
import { tryUploadImmutableJson } from '../../../../server/_lib/lens/lensGrove.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
const MAX_CHAIN_IDS = 5
const SUPPORTED_CHAIN_IDS = new Set<number>([1, 10, 137, 8453, 42161])

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
}

function buildWalletIntelligenceDiscovery() {
  return {
    endpoint: '/api/v1/agents/wallet-intelligence',
    method: 'GET',
    requiredQuery: ['address'],
    optionalQuery: {
      hops: 'number',
      chains: 'comma-separated chain ids',
      store: 'true|false',
      portfolio: 'true|false',
      ens: 'true|false',
      lens: 'true|false',
      labels: 'true|false',
      noCache: 'true|false',
    },
    example: '/api/v1/agents/wallet-intelligence?address=0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  } as const
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseChainIds(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  return ids.length > 0 ? ids : undefined
}

function normalizeRequestedChainIds(chainIds: number[] | undefined): { value: number[] | undefined; error: string | null } {
  if (!chainIds || chainIds.length === 0) return { value: undefined, error: null }
  if (chainIds.length > MAX_CHAIN_IDS) {
    return { value: undefined, error: `chainIds exceeds max length (${MAX_CHAIN_IDS})` }
  }
  const normalized = Array.from(
    new Set(
      chainIds
        .map((id) => Math.floor(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  const invalid = normalized.filter((id) => !SUPPORTED_CHAIN_IDS.has(id))
  if (invalid.length > 0) {
    return { value: undefined, error: `Unsupported chainIds: ${invalid.join(',')}` }
  }
  if (normalized.length === 0) return { value: undefined, error: null }
  return { value: normalized, error: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET or POST /api/v1/agents/wallet-intelligence.',
    } satisfies ApiEnvelope<never>)
  }

  const queryAddress = typeof req.query.address === 'string' ? req.query.address.trim() : ''
  if (req.method === 'GET' && !queryAddress) {
    return res.status(200).json({
      success: true,
      data: buildWalletIntelligenceDiscovery(),
    } satisfies ApiEnvelope<ReturnType<typeof buildWalletIntelligenceDiscovery>>)
  }

  // Rate limit
  const guard = await guardAgentApiRequest({
    req,
    res,
    endpoint: '/api/v1/agents/wallet-intelligence',
    kind: 'read',
  })
  if (!guard.ok) return

  const limiter = checkRateLimit(
    rateLimitKey(
      'v1-agents-wallet-intelligence',
      guard.auth?.address?.toLowerCase() ?? 'anon',
      getClientIp(req),
    ),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) {
    setRetryAfterHeader(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  // Parse parameters from query (GET) or body (POST).
  let address: string | undefined
  let hops: number | undefined
  let chainIds: number[] | undefined
  let store: boolean | undefined
  let includePortfolio: boolean | undefined
  let includeEns: boolean | undefined
  let includeLens: boolean | undefined
  let includeLabels: boolean | undefined
  let postBody: Record<string, unknown> | null = null

  if (req.method === 'GET') {
    const q = req.query
    address = typeof q.address === 'string' ? q.address.trim() : undefined
    hops = typeof q.hops === 'string' ? Number(q.hops) : undefined
    chainIds = typeof q.chains === 'string' ? parseChainIds(q.chains) : undefined
    store = typeof q.store === 'string' ? q.store.toLowerCase() !== 'false' : true
    includePortfolio = typeof q.portfolio === 'string' ? q.portfolio !== 'false' : undefined
    includeEns = typeof q.ens === 'string' ? q.ens !== 'false' : undefined
    includeLens = typeof q.lens === 'string' ? q.lens !== 'false' : undefined
    includeLabels = typeof q.labels === 'string' ? q.labels !== 'false' : undefined
  } else {
    // POST body
    postBody = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as Record<string, unknown> | null
    const body = postBody ?? {}
    address = typeof body.address === 'string' ? body.address.trim() : undefined
    hops = typeof body.hops === 'number' ? body.hops : undefined
    chainIds = Array.isArray(body.chainIds) ? body.chainIds.filter((n): n is number => typeof n === 'number') : undefined
    store = body.store !== false
    includePortfolio = typeof body.includePortfolio === 'boolean' ? body.includePortfolio : undefined
    includeEns = typeof body.includeEns === 'boolean' ? body.includeEns : undefined
    includeLens = typeof body.includeLens === 'boolean' ? body.includeLens : undefined
    includeLabels = typeof body.includeLabels === 'boolean' ? body.includeLabels : undefined
  }

  if (!address || !isAddressLike(address)) {
    return res.status(400).json({
      success: false,
      error: 'address is required (0x...). Example: /api/v1/agents/wallet-intelligence?address=0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18.',
    } satisfies ApiEnvelope<never>)
  }

  const normalizedChainIds = normalizeRequestedChainIds(chainIds)
  if (normalizedChainIds.error) {
    return res.status(400).json({ success: false, error: normalizedChainIds.error } satisfies ApiEnvelope<never>)
  }
  chainIds = normalizedChainIds.value

  const effectiveHops = hops ?? 3
  const effectiveChainIds = chainIds ?? [8453, 1]
  const noCache = (req.method === 'GET' && req.query.noCache === 'true') ||
    (req.method === 'POST' && postBody?.noCache === true)

  try {
    // ── Cache read (Supabase) ──
    if (!noCache) {
      const cached = await getCachedWalletIntelligence(address, effectiveHops, effectiveChainIds)
      if (cached) {
        const graph = cached.graph as any
        return res.status(200).json({
          success: true,
          data: {
            graph,
            grove: cached.groveUri ? { lensUri: cached.groveUri, gatewayUrl: cached.groveUri.replace('lens://', 'https://api.grove.storage/'), storageKey: cached.groveUri.replace('lens://', ''), statusUrl: null } : undefined,
            groveStatus: cached.groveUri ? 'stored' as const : 'skipped' as const,
            cacheStatus: 'hit' as const,
            cachedAt: cached.createdAt,
            summary: {
              target: graph.target,
              canonicalWallet: graph.canonicalWallet,
              nodeCount: graph.nodes?.length ?? 0,
              edgeCount: graph.edges?.length ?? 0,
              funderChainLength: graph.sources?.funderTrace?.chain?.length ?? 0,
              knownEntities: graph.sources?.labels ? Object.values(graph.sources.labels).filter((l: any) => l.isKnownEntity).length : 0,
              netWorth: graph.sources?.portfolio?.totalUsdValue ?? null,
              ensName: graph.sources?.ens?.name ?? null,
              lensHandle: graph.sources?.lens?.handle ?? null,
            },
            provenance: {
              graphSource: graph.source ?? 'wallet-intelligence.unknown',
              generatedAt: graph.generatedAt ?? null,
              cacheStatus: 'hit',
            },
          },
        } satisfies ApiEnvelope<unknown>)
      }
    }

    // ── Cache miss: build fresh ──
    const options: WalletIntelligenceOptions = {}
    if (hops !== undefined) options.hops = hops
    if (chainIds !== undefined) options.chainIds = chainIds
    if (includePortfolio !== undefined) options.includePortfolio = includePortfolio
    if (includeEns !== undefined) options.includeEns = includeEns
    if (includeLens !== undefined) options.includeLens = includeLens
    if (includeLabels !== undefined) options.includeLabels = includeLabels

    const graph = await buildWalletIntelligence(address, options)

    // ── Store on Lens Grove (immutable snapshot) ──
    let grove: { lensUri: string; gatewayUrl: string; storageKey: string; statusUrl: string | null } | undefined
    let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'

    if (store) {
      const attempt = await tryUploadImmutableJson(graph)
      if (attempt.ok) {
        grove = {
          lensUri: attempt.result.lensUri,
          gatewayUrl: attempt.result.gatewayUrl,
          storageKey: attempt.result.storageKey,
          statusUrl: attempt.result.statusUrl,
        }
        groveStatus = 'stored'
      } else {
        groveStatus = 'unavailable'
      }
    }

    // ── Write to Supabase cache (async, non-blocking) ──
    void cacheWalletIntelligence(
      address,
      graph,
      grove?.lensUri ?? null,
      effectiveHops,
      effectiveChainIds,
    )

    return res.status(200).json({
      success: true,
      data: {
        graph,
        grove,
        groveStatus,
        cacheStatus: 'miss' as const,
        summary: {
          target: graph.target,
          canonicalWallet: graph.canonicalWallet,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          funderChainLength: graph.sources.funderTrace?.chain.length ?? 0,
          knownEntities: Object.values(graph.sources.labels).filter((l) => l.isKnownEntity).length,
          netWorth: graph.sources.portfolio?.totalUsdValue ?? null,
          ensName: graph.sources.ens?.name ?? null,
          lensHandle: graph.sources.lens?.handle ?? null,
        },
        provenance: {
          graphSource: graph.source,
          generatedAt: graph.generatedAt,
          cacheStatus: 'miss',
        },
      },
    } satisfies ApiEnvelope<unknown>)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build wallet intelligence'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
