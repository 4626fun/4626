/**
 * ElizaOS ERC-8004 Reputation Plugin (Unified)
 *
 * Calls server-side reputation modules directly instead of routing
 * through the OpenClaw HTTP bridge.
 *
 *   /reputation <agentId>   → Build reputation graph for an agent
 *   /feedback <agentId>     → Read feedback summary for an agent
 */

import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

// Direct imports — no HTTP bridge needed
import { buildReputationGraph } from '../../../../_lib/reputationGraph.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAgentIdFromText(text: string): number | null {
  const match = text.match(/(?:agentId\s*=\s*|#)?(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatReputationGraph(data: any): string {
  if (!data) return 'No reputation data available.'

  const lines: string[] = [
    `**Reputation Graph — Agent #${data.agentId ?? '?'}**`,
    '',
  ]

  if (data.summary) {
    lines.push(`**Total Feedback:** ${data.summary.count ?? 0}`)
    if (data.summary.average !== undefined) {
      lines.push(`**Average Rating:** ${Number(data.summary.average).toFixed(1)} / 5`)
    }
    if (data.summary.label) {
      lines.push(`**Label:** ${data.summary.label}`)
    }
  }

  const nodeCount = data.nodes?.length ?? 0
  const edgeCount = data.edges?.length ?? 0
  const groupCount = data.groups?.length ?? 0
  if (nodeCount > 0) {
    lines.push(`**Graph:** ${nodeCount} nodes, ${edgeCount} edges, ${groupCount} groups`)
  }

  // Show top reviewers
  const reviewerNodes = data.nodes?.filter((n: any) => n.type === 'reviewer') ?? []
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
  const feedbackNodes = data.nodes?.filter((n: any) => n.type === 'feedback') ?? []
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

  // Show recent feedback entries
  const feedbackNodes = data.nodes?.filter((n: any) => n.type === 'feedback') ?? []
  if (feedbackNodes.length > 0) {
    lines.push('')
    lines.push(`**Entries (${feedbackNodes.length}):**`)
    for (const f of feedbackNodes.slice(0, 8)) {
      const val = f.data?.value ?? '?'
      const tag1 = f.data?.tag1 ? ` #${f.data.tag1}` : ''
      const tag2 = f.data?.tag2 ? ` #${f.data.tag2}` : ''
      const revoked = f.data?.revoked ? ' [REVOKED]' : ''
      const reviewer = f.data?.reviewer
        ? ` from \`${f.data.reviewer.slice(0, 10)}...\``
        : ''
      lines.push(`  • ${val}/5${tag1}${tag2}${reviewer}${revoked}`)
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
      const graph = await buildReputationGraph({ agentId })
      await callback?.({ text: formatReputationGraph({ ...graph, agentId }) } as Content)
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

    try {
      // buildReputationGraph returns the full graph which includes summary + feedback nodes
      const graph = await buildReputationGraph({ agentId })
      await callback?.({ text: formatFeedbackSummary({ ...graph, agentId }) } as Content)
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
  description: 'ERC-8004 reputation tools — direct server-side calls for reputation graphs and feedback reading.',
  actions: [reputationGraphAction, feedbackReadAction],
}

export default reputationPlugin
