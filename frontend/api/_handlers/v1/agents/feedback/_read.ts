/**
 * GET /api/v1/agents/feedback
 *
 * Read feedback for an ERC-8004 agent from the on-chain Reputation Registry.
 *
 * Query params:
 *   agentId      – (required) agent token ID
 *   client       – (optional) filter by client address
 *   tag1         – (optional) filter by tag1
 *   tag2         – (optional) filter by tag2
 *   includeRevoked – (optional, default false) include revoked feedback
 *   mode         – "summary" | "all" | "single" (default "summary")
 *   feedbackIndex – (required when mode=single) specific feedback index
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, http, isAddress, getAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { handleOptions } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import {
  getReputationRegistryAddress,
  REPUTATION_REGISTRY_ABI,
  formatFeedbackValue,
  ratingLabel,
  type OnChainFeedback,
  type FeedbackSummary,
} from '../../../../../server/_lib/erc8004.js'
import { queryFeedbackIndex } from '../../../../../server/_lib/walletIntelligenceCache.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function buildFeedbackDiscovery() {
  return {
    endpoint: '/api/v1/agents/feedback',
    method: 'GET',
    requiredQuery: ['agentId'],
    optionalQuery: {
      client: '0x-address',
      tag1: 'string',
      tag2: 'string',
      includeRevoked: 'true|false',
      mode: 'summary|all|single|indexed',
      feedbackIndex: 'required when mode=single',
      limit: 'indexed mode only',
      offset: 'indexed mode only',
      orderBy: 'indexed mode only',
      order: 'indexed mode only',
    },
    example: '/api/v1/agents/feedback?agentId=1&mode=summary',
  } as const
}

// Typed as `any` end-to-end to avoid TS2589 with viem OP Stack chains on TS 5.9.
let _client: any = null
function getClient(): any {
  if (_client) return _client
  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  _client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 12_000 }) }) as any
  return _client
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET /api/v1/agents/feedback?agentId=<id>.',
    })
  }

  const agentIdRaw = String(req.query.agentId ?? '').trim()
  if (!agentIdRaw) {
    return res.status(200).json({
      success: true,
      data: buildFeedbackDiscovery(),
    })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/feedback', kind: 'read' })
  if (!g.ok) return

  if (!/^\d+$/.test(agentIdRaw)) {
    return res.status(400).json({
      success: false,
      error: 'agentId is required (non-negative integer). Example: /api/v1/agents/feedback?agentId=1&mode=summary.',
    })
  }
  const agentId = BigInt(agentIdRaw)

  const mode = String(req.query.mode ?? 'summary').trim().toLowerCase()
  const tag1 = String(req.query.tag1 ?? '').trim()
  const tag2 = String(req.query.tag2 ?? '').trim()
  const includeRevoked = String(req.query.includeRevoked ?? '').trim() === 'true'

  const clientRaw = String(req.query.client ?? '').trim()
  const clientAddress = clientRaw && isAddress(clientRaw) ? getAddress(clientRaw) : null

  const registry = getReputationRegistryAddress()
  const client = getClient()

  try {
    // ── Indexed mode: query Supabase instead of on-chain ──
    if (mode === 'indexed') {
      const limit = Math.min(Number(req.query.limit ?? 50), 200)
      const offset = Number(req.query.offset ?? 0)
      const orderBy = String(req.query.orderBy ?? 'created_at') as 'created_at' | 'value'
      const order = String(req.query.order ?? 'desc') as 'asc' | 'desc'

      const result = await queryFeedbackIndex({
        agentId: Number(agentId),
        clientAddress: clientAddress ?? undefined,
        tag1: tag1 || undefined,
        tag2: tag2 || undefined,
        includeRevoked,
        limit,
        offset,
        orderBy: orderBy === 'value' ? 'value' : 'created_at',
        order: order === 'asc' ? 'asc' : 'desc',
      })

      setCache(res, 15)
      return res.status(200).json({
        success: true,
        data: {
          feedback: result.entries,
          total: result.total,
          limit,
          offset,
          source: 'supabase-index',
        },
      })
    }

    if (mode === 'single') {
      const feedbackIndexRaw = String(req.query.feedbackIndex ?? '').trim()
      if (!feedbackIndexRaw || !/^\d+$/.test(feedbackIndexRaw)) {
        return res.status(400).json({ success: false, error: 'feedbackIndex is required for mode=single' })
      }
      if (!clientAddress) {
        return res.status(400).json({ success: false, error: 'client address is required for mode=single' })
      }
      const feedbackIndex = BigInt(feedbackIndexRaw)

      const result = await client.readContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'readFeedback',
        args: [agentId, clientAddress, feedbackIndex],
      })

      const [value, valueDecimals, t1, t2, isRevoked] = result as [bigint, number, string, string, boolean]
      const feedback: OnChainFeedback = {
        agentId: Number(agentId),
        clientAddress,
        feedbackIndex: Number(feedbackIndex),
        value: Number(value),
        valueDecimals,
        tag1: t1,
        tag2: t2,
        isRevoked,
      }

      setCache(res, 15)
      return res.status(200).json({
        success: true,
        data: {
          feedback,
          displayValue: formatFeedbackValue(value, valueDecimals),
          label: ratingLabel(Number(value) / (valueDecimals > 0 ? 10 ** valueDecimals : 1)),
        },
      })
    }

    if (mode === 'all') {
      // Get all clients if none specified
      let clientAddresses: Address[] = []
      if (clientAddress) {
        clientAddresses = [clientAddress]
      } else {
        const allClients = await client.readContract({
          address: registry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'getClients',
          args: [agentId],
        }) as Address[]
        clientAddresses = allClients
      }

      if (clientAddresses.length === 0) {
        setCache(res, 30)
        return res.status(200).json({ success: true, data: { feedback: [], count: 0 } })
      }

      const result = await client.readContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'readAllFeedback',
        args: [agentId, clientAddresses, tag1, tag2, includeRevoked],
      })

      const [clients, feedbackIndexes, values, valueDecimalsArr, tag1s, tag2s, revokedStatuses] = result as [
        Address[], bigint[], bigint[], number[], string[], string[], boolean[],
      ]

      const feedback: OnChainFeedback[] = clients.map((c, i) => ({
        agentId: Number(agentId),
        clientAddress: c,
        feedbackIndex: Number(feedbackIndexes[i]),
        value: Number(values[i]),
        valueDecimals: valueDecimalsArr[i],
        tag1: tag1s[i],
        tag2: tag2s[i],
        isRevoked: revokedStatuses[i],
      }))

      setCache(res, 30)
      return res.status(200).json({
        success: true,
        data: {
          feedback,
          count: feedback.length,
        },
      })
    }

    // Default: summary mode
    let clientAddresses: Address[] = []
    if (clientAddress) {
      clientAddresses = [clientAddress]
    } else {
      const allClients = await client.readContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getClients',
        args: [agentId],
      }) as Address[]
      clientAddresses = allClients
    }

    if (clientAddresses.length === 0) {
      setCache(res, 30)
      return res.status(200).json({
        success: true,
        data: {
          summary: { agentId: Number(agentId), count: 0, summaryValue: 0, summaryValueDecimals: 0, displayValue: '0' },
          totalClients: 0,
        },
      })
    }

    const result = await client.readContract({
      address: registry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [agentId, clientAddresses, tag1, tag2],
    })

    const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number]
    const displayValue = formatFeedbackValue(summaryValue, summaryValueDecimals)

    const summary: FeedbackSummary = {
      agentId: Number(agentId),
      count: Number(count),
      summaryValue: Number(summaryValue),
      summaryValueDecimals,
      displayValue,
    }

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        summary,
        totalClients: clientAddresses.length,
        label: ratingLabel(Number(summaryValue) / (summaryValueDecimals > 0 ? 10 ** summaryValueDecimals : 1)),
        reputationRegistry: registry,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to read feedback'
    return res.status(500).json({ success: false, error: msg })
  }
}
