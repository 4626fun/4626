/**
 * ElizaOS ERC-8004 Reputation Plugin
 *
 * Exposes ERC-8004 reputation and feedback tools as XMTP chat commands
 * via the OpenClaw bridge:
 *   /reputation <agentId>   → Build reputation graph for an agent
 *   /feedback <agentId>     → Read feedback summary for an agent
 */

import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

// ---------------------------------------------------------------------------
// OpenClaw bridge (shared pattern)
// ---------------------------------------------------------------------------

type OpenClawBridgeResult = {
  success: boolean
  data?: any
  error?: string
}

function getBridgeOrigin(): string {
  return (
    (process.env.OPENCLAW_BRIDGE_ORIGIN ?? '').trim() ||
    (process.env.CANONICAL_ORIGIN ?? '').trim() ||
    'https://4626.fun'
  )
}

function parseAgentIdFromText(text: string): number | null {
  // Match a bare number or "agentId=123" or "#123"
  const match = text.match(/(?:agentId\s*=\s*|#)?(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0] : null
}

async function callBridge(tool: string, input: Record<string, unknown>): Promise<any> {
  const origin = getBridgeOrigin()
  const res = await fetch(`${origin}/api/openclaw/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  })
  const json = (await res.json().catch(() => null)) as OpenClawBridgeResult | null
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Bridge request failed (${res.status})`
    throw new Error(msg)
  }
  return json.data
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatReputationGraph(data: any): string {
  const graph = data?.graph
  const summary = data?.summary
  if (!graph && !summary) return JSON.stringify(data, null, 2)

  const lines: string[] = [
    `**Reputation Graph — Agent #${data?.agentId ?? '?'}**`,
    '',
  ]

  if (summary) {
    lines.push(`**Total Feedback:** ${summary.count ?? 0}`)
    if (summary.average !== undefined) {
      lines.push(`**Average Rating:** ${Number(summary.average).toFixed(1)} / 5`)
    }
    if (summary.label) {
      lines.push(`**Label:** ${summary.label}`)
    }
  }

  if (graph) {
    const nodeCount = graph.nodes?.length ?? 0
    const edgeCount = graph.edges?.length ?? 0
    const groupCount = graph.groups?.length ?? 0
    lines.push(`**Graph:** ${nodeCount} nodes, ${edgeCount} edges, ${groupCount} groups`)
  }

  // Show top reviewers
  const reviewerNodes = graph?.nodes?.filter((n: any) => n.type === 'reviewer') ?? []
  if (reviewerNodes.length > 0) {
    lines.push('')
    lines.push(`**Reviewers (${reviewerNodes.length}):**`)
    for (const r of reviewerNodes.slice(0, 10)) {
      const addr = r.id ?? r.address ?? 'unknown'
      const short = addr.length > 16 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr
      lines.push(`  • \`${short}\``)
    }
  }

  // Show recent feedback entries
  const feedbackNodes = graph?.nodes?.filter((n: any) => n.type === 'feedback') ?? []
  if (feedbackNodes.length > 0) {
    lines.push('')
    lines.push(`**Recent Feedback (${feedbackNodes.length}):**`)
    for (const f of feedbackNodes.slice(0, 5)) {
      const val = f.data?.value ?? '?'
      const tag1 = f.data?.tag1 ? ` #${f.data.tag1}` : ''
      const tag2 = f.data?.tag2 ? ` #${f.data.tag2}` : ''
      const revoked = f.data?.revoked ? ' [REVOKED]' : ''
      lines.push(`  • Rating: ${val}/5${tag1}${tag2}${revoked}`)
    }
  }

  if (data.groveStatus === 'stored' && data.grove?.gatewayUrl) {
    lines.push('')
    lines.push(`**Stored on Grove:** [View](${data.grove.gatewayUrl})`)
  }

  return lines.join('\n')
}

function formatFeedbackSummary(data: any): string {
  if (!data) return 'No feedback data available.'

  const lines: string[] = [
    `**Feedback Summary — Agent #${data.agentId ?? '?'}**`,
    '',
  ]

  if (data.summary) {
    lines.push(`**Total Reviews:** ${data.summary.count ?? 0}`)
    if (data.summary.average !== undefined) {
      lines.push(`**Average Rating:** ${Number(data.summary.average).toFixed(1)} / 5`)
    }
    if (data.summary.label) {
      lines.push(`**Label:** ${data.summary.label}`)
    }
  }

  if (data.clients?.length > 0) {
    lines.push('')
    lines.push(`**Clients (${data.clients.length}):**`)
    for (const c of data.clients.slice(0, 10)) {
      const short = c.length > 16 ? `${c.slice(0, 10)}...${c.slice(-6)}` : c
      lines.push(`  • \`${short}\``)
    }
  }

  if (data.feedback?.length > 0) {
    lines.push('')
    lines.push(`**Entries (${data.feedback.length}):**`)
    for (const f of data.feedback.slice(0, 8)) {
      const val = f.value ?? '?'
      const tag1 = f.tag1 ? ` #${f.tag1}` : ''
      const tag2 = f.tag2 ? ` #${f.tag2}` : ''
      const revoked = f.revoked ? ' [REVOKED]' : ''
      const from = f.client ? ` from \`${f.client.slice(0, 10)}...\`` : ''
      lines.push(`  • ${val}/5${tag1}${tag2}${from}${revoked}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const reputationGraphAction: Action = {
  name: 'ERC8004_REPUTATION_GRAPH',
  similes: ['reputation', 'reputation graph', 'agent reputation'],
  description: 'Build the ERC-8004 reputation graph for an agent — nodes, edges, groups, summary.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/reputation') || text.startsWith('/rep ')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? ''
    const agentId = typeof options?.agentId === 'number'
      ? options.agentId
      : parseAgentIdFromText(text)

    if (agentId === null || isNaN(agentId)) {
      await callback?.({ text: 'Usage: `/reputation <agentId>`\nProvide the numeric agent ID to build its reputation graph.' } as Content)
      return
    }

    await callback?.({ text: `Building reputation graph for Agent #${agentId}...` } as Content)

    try {
      const data = await callBridge('erc8004_reputation_graph', { agentId, store: true })
      await callback?.({ text: formatReputationGraph(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to build reputation graph: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/reputation 1' } },
      { name: 'agent', content: { text: 'Reputation Graph — Agent #1\nTotal Feedback: 12\nAverage Rating: 4.2 / 5\n...' } },
    ],
  ],
}

const feedbackReadAction: Action = {
  name: 'ERC8004_FEEDBACK_READ',
  similes: ['feedback', 'read feedback', 'agent feedback'],
  description: 'Read ERC-8004 feedback summary and entries for an agent.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/feedback')
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? ''
    const agentId = typeof options?.agentId === 'number'
      ? options.agentId
      : parseAgentIdFromText(text)

    if (agentId === null || isNaN(agentId)) {
      await callback?.({ text: 'Usage: `/feedback <agentId>`\nProvide the numeric agent ID to read its feedback.' } as Content)
      return
    }

    // Optionally parse a client address filter
    const clientAddress = typeof options?.clientAddress === 'string'
      ? options.clientAddress
      : parseAddressFromText(text)

    try {
      const data = await callBridge('erc8004_read_feedback', {
        agentId,
        ...(clientAddress ? { clientAddress } : {}),
      })
      await callback?.({ text: formatFeedbackSummary(data) } as Content)
    } catch (err: any) {
      await callback?.({ text: `Failed to read feedback: ${err.message}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/feedback 1' } },
      { name: 'agent', content: { text: 'Feedback Summary — Agent #1\nTotal Reviews: 8\nAverage Rating: 3.8 / 5\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const reputationPlugin: Plugin = {
  name: '@creatorvault/plugin-reputation',
  description: 'ERC-8004 reputation tools — reputation graphs, feedback reading.',
  actions: [reputationGraphAction, feedbackReadAction],
}

export default reputationPlugin
