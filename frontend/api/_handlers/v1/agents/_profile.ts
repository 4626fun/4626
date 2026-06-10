import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  buildWalletIntelligence,
  queryFeedbackIndex,
  type FeedbackIndexEntry,
} from '@4626/server-core'

import { buildAgentRegistration } from '../../../../server/_lib/agent/agentRegistration.js'
import { getErc8004PublicOrigin } from '../../../../server/_lib/infra/origin.js'
import { buildReputationGraph } from '../../../../server/_lib/lens/reputationGraph.js'
import { buildExpectedVerifiedEndpoints, buildAgentVerificationData } from './identity/_verification.js'

type LatestReviewArtifact = {
  feedbackUri: string | null
  feedbackGatewayUrl: string | null
  groveUri: string | null
  groveGatewayUrl: string | null
  feedbackHash: string | null
  endpoint: string | null
  reasoning: string | null
  tag1: string
  tag2: string
  createdAt: string
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
}

function buildProfileDiscovery() {
  return {
    endpoint: '/api/v1/agents/profile',
    method: 'GET',
    requiredQuery: ['agentId'],
    optionalQuery: {},
    example: '/api/v1/agents/profile?agentId=2205',
  } as const
}

function toGatewayUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.startsWith('lens://') ? `https://api.grove.storage/${raw.slice('lens://'.length)}` : raw
}

function findLatestReviewArtifact(entries: FeedbackIndexEntry[]): LatestReviewArtifact | null {
  const latest = entries.find((entry) => entry.tag1 === 'technical-review') ?? entries[0] ?? null
  if (!latest) return null
  return {
    feedbackUri: latest.feedbackUri,
    feedbackGatewayUrl: toGatewayUrl(latest.feedbackUri),
    groveUri: latest.groveUri,
    groveGatewayUrl: toGatewayUrl(latest.groveUri),
    feedbackHash: latest.feedbackHash,
    endpoint: latest.endpoint,
    reasoning: latest.reasoning,
    tag1: latest.tag1,
    tag2: latest.tag2,
    createdAt: latest.createdAt,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET /api/v1/agents/profile?agentId=2205.',
    })
  }

  const agentIdRaw = String(req.query.agentId ?? '').trim()
  if (!agentIdRaw) {
    return res.status(200).json({
      success: true,
      data: buildProfileDiscovery(),
    })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/profile', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agents-profile', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) {
    setRetryAfterHeader(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  if (!/^\d+$/.test(agentIdRaw)) {
    return res.status(400).json({
      success: false,
      error: 'agentId is required (non-negative integer). Example: /api/v1/agents/profile?agentId=2205.',
    })
  }

  const requestedAgentId = Number(agentIdRaw)
  const origin = getErc8004PublicOrigin(req)
  const registration = buildAgentRegistration(origin)
  if (!registration.payload) {
    return res.status(503).json({
      success: false,
      error: registration.error || 'Missing ERC-8004 registry configuration.',
      missing: registration.missing ?? [],
    })
  }

  const primaryRegistration = Array.isArray(registration.payload.registrations)
    ? registration.payload.registrations[0]
    : null
  const canonicalAgentId = Number(primaryRegistration?.agentId)
  if (!Number.isFinite(canonicalAgentId) || canonicalAgentId < 0) {
    return res.status(503).json({
      success: false,
      error: 'Agent registration metadata is missing a canonical agentId.',
    })
  }

  if (requestedAgentId !== canonicalAgentId) {
    return res.status(404).json({
      success: false,
      error: `Only the configured canonical agent profile is available from this endpoint (agentId=${canonicalAgentId}).`,
    })
  }

  try {
    const verification = await buildAgentVerificationData(req)
    const [reputationGraph, feedbackIndexResult, walletGraph] = await Promise.all([
      buildReputationGraph({ agentId: verification.agentId, includeRevoked: true }),
      queryFeedbackIndex({
        agentId: verification.agentId,
        includeRevoked: true,
        limit: 25,
        offset: 0,
        orderBy: 'created_at',
        order: 'desc',
      }),
      verification.canonicalCsw ? buildWalletIntelligence(verification.canonicalCsw) : Promise.resolve(null),
    ])

    const latestReviewArtifact = findLatestReviewArtifact(feedbackIndexResult.entries)

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        agentId: verification.agentId,
        registration: {
          name: registration.payload.name ?? null,
          description: registration.payload.description ?? null,
          image: registration.payload.image ?? null,
          active: registration.payload.active ?? null,
          x402Support: registration.payload.x402Support ?? null,
          reputationRegistry: registration.payload.reputationRegistry ?? null,
          supportedTrust: Array.isArray(registration.payload.supportedTrust) ? registration.payload.supportedTrust : [],
          registrations: Array.isArray(registration.payload.registrations) ? registration.payload.registrations : [],
        },
        discoverability: verification,
        feedback: {
          summary: {
            totalFeedback: reputationGraph.summary.totalFeedback,
            totalReviewers: reputationGraph.summary.totalReviewers,
            averageValue: reputationGraph.summary.averageValue,
            averageValueDecimals: reputationGraph.summary.averageValueDecimals,
            label: reputationGraph.summary.label,
            indexedEntryCount: feedbackIndexResult.total,
          },
          latestReviewArtifact,
          endpoint: `${origin}/api/v1/agents/feedback?agentId=${verification.agentId}`,
          reviewEndpoint: `${origin}/api/v1/agents/feedback/review`,
        },
        reputation: {
          endpoint: `${origin}/api/lens/reputation-graph?agentId=${verification.agentId}&store=false`,
          summary: reputationGraph.summary,
          graphSource: reputationGraph.source,
          generatedAt: reputationGraph.generatedAt,
        },
        walletIntelligence: verification.canonicalCsw
          ? {
              address: verification.canonicalCsw,
              endpoint: `${origin}/api/v1/agents/wallet-intelligence?address=${verification.canonicalCsw}&store=false`,
              summary: walletGraph
                ? {
                    target: walletGraph.target,
                    canonicalWallet: walletGraph.canonicalWallet,
                    nodeCount: walletGraph.nodes.length,
                    edgeCount: walletGraph.edges.length,
                    funderChainLength: walletGraph.sources.funderTrace?.chain?.length ?? 0,
                    knownEntities: Object.values(walletGraph.sources.labels ?? {}).filter((entry: any) => entry?.isKnownEntity).length,
                    netWorth: walletGraph.sources.portfolio?.totalUsdValue ?? null,
                    ensName: walletGraph.sources.ens?.name ?? null,
                    lensHandle: walletGraph.sources.lens?.handle ?? null,
                    graphSource: walletGraph.source,
                    generatedAt: walletGraph.generatedAt,
                  }
                : null,
            }
          : {
              address: null,
              endpoint: null,
              summary: null,
            },
        advertisedServices: Array.isArray(registration.payload.services) ? registration.payload.services : [],
        domainProof: {
          url: verification.uriPolicy.domainVerificationUrl,
          verifiedEndpoints: buildExpectedVerifiedEndpoints(origin),
        },
      },
    })
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    const missing = Array.isArray((error as { missing?: unknown })?.missing)
      ? ((error as { missing?: string[] }).missing ?? [])
      : undefined
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build aggregated agent profile.',
      ...(missing && missing.length > 0 ? { missing } : {}),
    })
  }
}
