import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import { buildWalletIntelligence, type WalletIntelligenceOptions } from '../../../../server/_lib/walletIntelligence.js'
import { tryUploadImmutableJson } from '../../../../server/_lib/lensGrove.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limit
  const guard = await guardAgentApiRequest({
    req,
    res,
    endpoint: '/api/v1/agents/wallet-intelligence',
    kind: 'read',
  })
  if (!guard.ok) return

  // Parse parameters from query (GET) or body (POST).
  let address: string | undefined
  let hops: number | undefined
  let chainIds: number[] | undefined
  let store: boolean | undefined
  let includePortfolio: boolean | undefined
  let includeEns: boolean | undefined
  let includeLens: boolean | undefined
  let includeLabels: boolean | undefined

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
    let body: Record<string, unknown> = {}
    try {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body as Record<string, unknown>
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body)
      }
    } catch {
      // ignore parse errors
    }
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
    return res.status(400).json({ success: false, error: 'address is required (0x...)' } satisfies ApiEnvelope<never>)
  }

  try {
    const options: WalletIntelligenceOptions = {}
    if (hops !== undefined) options.hops = hops
    if (chainIds !== undefined) options.chainIds = chainIds
    if (includePortfolio !== undefined) options.includePortfolio = includePortfolio
    if (includeEns !== undefined) options.includeEns = includeEns
    if (includeLens !== undefined) options.includeLens = includeLens
    if (includeLabels !== undefined) options.includeLabels = includeLabels

    const graph = await buildWalletIntelligence(address, options)

    // Optionally store on Lens Grove.
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

    return res.status(200).json({
      success: true,
      data: {
        graph,
        grove,
        groveStatus,
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
      },
    } satisfies ApiEnvelope<unknown>)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build wallet intelligence'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
