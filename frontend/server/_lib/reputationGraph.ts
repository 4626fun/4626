/**
 * ERC-8004 Reputation Graph builder.
 *
 * Reads on-chain feedback from the Reputation Registry and builds a
 * content-addressed graph (nodes + edges + groups) that can be stored
 * on Lens Grove for composable, verifiable reputation data.
 *
 * Graph schema:
 *
 *   Node types:
 *     - agent          – the ERC-8004 agent being reviewed
 *     - reviewer       – a wallet that submitted feedback
 *     - feedback       – an individual feedback entry
 *
 *   Edge types:
 *     - reviewed       – reviewer → agent (submitted feedback)
 *     - has_feedback   – agent → feedback (owns the feedback entry)
 *     - authored       – reviewer → feedback (authored the entry)
 *     - responded_to   – responder → feedback (appended a response)
 *
 *   Groups:
 *     - namespace:agent:{agentId}
 *     - namespace:reviewer:{address}
 *     - tag:{tag1 or tag2}
 */

import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  getReputationRegistryAddress,
  getIdentityRegistryAddress,
  REPUTATION_REGISTRY_ABI,
  formatFeedbackValue,
  ratingLabel,
} from './erc8004.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Graph types
// ---------------------------------------------------------------------------

export type ReputationGraphNode = {
  id: string
  label: string
  type: 'agent' | 'reviewer' | 'feedback'
  address?: string
  agentId?: number
  feedbackIndex?: number
  value?: number
  valueDecimals?: number
  displayValue?: string
  ratingLabel?: string
  tag1?: string
  tag2?: string
  isRevoked?: boolean
}

export type ReputationGraphEdge = {
  source: string
  target: string
  type: 'reviewed' | 'has_feedback' | 'authored' | 'responded_to'
  weight?: number
}

export type ReputationGraphGroup = {
  id: string
  label: string
  nodeIds: string[]
  namespace?: string
}

export type ReputationGraph = {
  agentId: number
  agentRegistry: string
  reputationRegistry: string
  chainId: number
  /** XMTP messaging address (CSW or EOA) if known */
  xmtpAddress?: string
  /** Agent wallet address (typically the CSW) if known */
  agentWallet?: string
  nodes: ReputationGraphNode[]
  edges: ReputationGraphEdge[]
  groups: ReputationGraphGroup[]
  summary: {
    totalFeedback: number
    totalReviewers: number
    averageValue: string
    averageValueDecimals: number
    label: string
  }
  generatedAt: string
  source: string
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

// Use `any` for the cached client to avoid OP Stack chain type mismatch (TS2589/TS2719).
let _client: any = null
function getClient() {
  if (_client) return _client as ReturnType<typeof createPublicClient>
  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  _client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 15_000 }) })
  return _client as ReturnType<typeof createPublicClient>
}

export async function buildReputationGraph(params: {
  agentId: number
  tag1Filter?: string
  tag2Filter?: string
  includeRevoked?: boolean
}): Promise<ReputationGraph> {
  const { agentId, tag1Filter = '', tag2Filter = '', includeRevoked = true } = params
  const registry = getReputationRegistryAddress()
  const identityRegistry = getIdentityRegistryAddress()
  const client = getClient()
  const agentIdBigInt = BigInt(agentId)

  // 1. Get all clients (reviewers) for this agent
  const allClients = (await client.readContract({
    address: registry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getClients',
    args: [agentIdBigInt],
  })) as Address[]

  const nodes: ReputationGraphNode[] = []
  const edges: ReputationGraphEdge[] = []
  const groups: ReputationGraphGroup[] = []
  const tagGroups = new Map<string, string[]>()
  const reviewerNodeIds: string[] = []

  // 2. Agent node — include XMTP/CSW address if available
  const agentNodeId = `agent:${agentId}`
  const xmtpAddress = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim().toLowerCase() || undefined
  nodes.push({
    id: agentNodeId,
    label: `Agent #${agentId}`,
    type: 'agent',
    agentId,
    ...(xmtpAddress ? { address: xmtpAddress } : {}),
  })

  // 3. Read all feedback
  let feedbackData: {
    clients: Address[]
    indexes: bigint[]
    values: bigint[]
    decimals: number[]
    tag1s: string[]
    tag2s: string[]
    revoked: boolean[]
  } | null = null

  if (allClients.length > 0) {
    const result = (await client.readContract({
      address: registry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'readAllFeedback',
      args: [agentIdBigInt, allClients, tag1Filter, tag2Filter, includeRevoked],
    })) as [Address[], bigint[], bigint[], number[], string[], string[], boolean[]]

    feedbackData = {
      clients: result[0],
      indexes: result[1],
      values: result[2],
      decimals: result[3],
      tag1s: result[4],
      tag2s: result[5],
      revoked: result[6],
    }
  }

  // 4. Build reviewer + feedback nodes and edges
  const seenReviewers = new Set<string>()
  const feedbackNodeIds: string[] = []

  if (feedbackData) {
    for (let i = 0; i < feedbackData.clients.length; i++) {
      const reviewerAddr = feedbackData.clients[i].toLowerCase()
      const feedbackIndex = Number(feedbackData.indexes[i])
      const value = Number(feedbackData.values[i])
      const valueDecimals = feedbackData.decimals[i]
      const tag1 = feedbackData.tag1s[i]
      const tag2 = feedbackData.tag2s[i]
      const isRevoked = feedbackData.revoked[i]
      const displayValue = formatFeedbackValue(feedbackData.values[i], valueDecimals)
      const numericValue = valueDecimals > 0 ? value / 10 ** valueDecimals : value

      // Reviewer node (deduplicated)
      const reviewerNodeId = `reviewer:${reviewerAddr}`
      if (!seenReviewers.has(reviewerAddr)) {
        seenReviewers.add(reviewerAddr)
        const shortAddr = `${reviewerAddr.slice(0, 6)}…${reviewerAddr.slice(-4)}`
        nodes.push({
          id: reviewerNodeId,
          label: shortAddr,
          type: 'reviewer',
          address: reviewerAddr,
        })
        reviewerNodeIds.push(reviewerNodeId)

        // Edge: reviewer → agent (reviewed)
        edges.push({
          source: reviewerNodeId,
          target: agentNodeId,
          type: 'reviewed',
        })
      }

      // Feedback node
      const feedbackNodeId = `feedback:${reviewerAddr}:${feedbackIndex}`
      nodes.push({
        id: feedbackNodeId,
        label: `${displayValue}★ ${tag1 ? `[${tag1}]` : ''}${tag2 ? ` [${tag2}]` : ''}`.trim(),
        type: 'feedback',
        address: reviewerAddr,
        feedbackIndex,
        value,
        valueDecimals,
        displayValue,
        ratingLabel: ratingLabel(numericValue),
        tag1,
        tag2,
        isRevoked,
      })
      feedbackNodeIds.push(feedbackNodeId)

      // Edge: agent → feedback (has_feedback)
      edges.push({
        source: agentNodeId,
        target: feedbackNodeId,
        type: 'has_feedback',
      })

      // Edge: reviewer → feedback (authored)
      edges.push({
        source: `reviewer:${reviewerAddr}`,
        target: feedbackNodeId,
        type: 'authored',
        weight: numericValue,
      })

      // Tag groups
      if (tag1) {
        const key = `tag:${tag1}`
        if (!tagGroups.has(key)) tagGroups.set(key, [])
        tagGroups.get(key)!.push(feedbackNodeId)
      }
      if (tag2) {
        const key = `tag:${tag2}`
        if (!tagGroups.has(key)) tagGroups.set(key, [])
        tagGroups.get(key)!.push(feedbackNodeId)
      }
    }
  }

  // 5. Build groups
  groups.push({
    id: `namespace:agent:${agentId}`,
    label: `Agent #${agentId}`,
    nodeIds: [agentNodeId, ...feedbackNodeIds],
    namespace: `erc8004:agent:${agentId}`,
  })

  for (const reviewerAddr of seenReviewers) {
    const reviewerNodeId = `reviewer:${reviewerAddr}`
    const reviewerFeedbackIds = feedbackNodeIds.filter((id) => id.startsWith(`feedback:${reviewerAddr}:`))
    groups.push({
      id: `namespace:reviewer:${reviewerAddr}`,
      label: `${reviewerAddr.slice(0, 6)}…${reviewerAddr.slice(-4)}`,
      nodeIds: [reviewerNodeId, ...reviewerFeedbackIds],
      namespace: `wallet:${reviewerAddr}`,
    })
  }

  for (const [tagKey, nodeIds] of tagGroups) {
    groups.push({
      id: tagKey,
      label: tagKey.replace('tag:', '#'),
      nodeIds,
      namespace: tagKey,
    })
  }

  // 6. Compute summary
  let summaryCount = 0
  let summaryValue = '0'
  let summaryDecimals = 0
  let summaryLabel = 'No feedback'

  if (allClients.length > 0 && feedbackData && feedbackData.clients.length > 0) {
    // Use on-chain getSummary for accurate aggregation
    try {
      const summaryResult = (await client.readContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getSummary',
        args: [agentIdBigInt, allClients, tag1Filter, tag2Filter],
      })) as [bigint, bigint, number]

      summaryCount = Number(summaryResult[0])
      summaryDecimals = summaryResult[2]
      summaryValue = formatFeedbackValue(summaryResult[1], summaryDecimals)
      const numericAvg = summaryDecimals > 0 ? Number(summaryResult[1]) / 10 ** summaryDecimals : Number(summaryResult[1])
      summaryLabel = ratingLabel(numericAvg)
    } catch {
      // Fallback: count from local data
      summaryCount = feedbackData.clients.length
    }
  }

  // 7. Build CAIP-10 references
  const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? '8453')
  const agentRegistry = `eip155:${chainId}:${identityRegistry.toLowerCase()}`
  const reputationRegistryRef = `eip155:${chainId}:${registry.toLowerCase()}`

  return {
    agentId,
    agentRegistry,
    reputationRegistry: reputationRegistryRef,
    chainId,
    ...(xmtpAddress ? { xmtpAddress, agentWallet: xmtpAddress } : {}),
    nodes,
    edges,
    groups,
    summary: {
      totalFeedback: summaryCount,
      totalReviewers: seenReviewers.size,
      averageValue: summaryValue,
      averageValueDecimals: summaryDecimals,
      label: summaryLabel,
    },
    generatedAt: new Date().toISOString(),
    source: 'erc8004.reputation.graph',
  }
}
