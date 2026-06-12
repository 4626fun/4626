/**
 * ElizaOS Virtuals ACP Plugin
 *
 * Bridges the 4626 Eliza agent to Virtuals Protocol's Agent Commerce Protocol
 * (ACP v2). The always-on job loop lives in `VirtualsAcpService` (started by
 * the runtime bootstrap or the standalone runner when VIRTUALS_ACP_ENABLED=1);
 * this plugin adds chat-facing controls:
 *
 *   /virtuals status            — service + active ACP job sessions
 *   /virtuals browse <keyword>  — search the ACP agent registry
 *
 * Arena (degen.virtuals.io) trading stays on the existing /arena lane
 * (dgclaw-skill + acp-cli via frontend/server/_lib/arena/) — this plugin does
 * not duplicate it.
 */

import type {
  Plugin,
  Action,
  IAgentRuntime,
  Memory,
  State,
  Content,
  HandlerCallback,
} from '@elizaos/core'

import { readVirtualsAcpConfig, checkVirtualsAcpConfig } from './config.js'
import { getVirtualsAcpService } from './service.js'

function isVirtualsCommand(text: string): boolean {
  return /^\/?virtuals(\s|$)/i.test(text.trim())
}

function parseSubcommand(text: string): { sub: string; rest: string } {
  const parts = text.trim().replace(/^\//, '').split(/\s+/g)
  return { sub: (parts[1] ?? 'status').toLowerCase(), rest: parts.slice(2).join(' ').trim() }
}

function formatStatus(): string {
  const service = getVirtualsAcpService()
  const status = service.getStatus()
  if (!status.running) {
    const check = checkVirtualsAcpConfig(readVirtualsAcpConfig())
    return [
      'Virtuals ACP: not running',
      check.ok ? 'Config OK — service has not been started yet.' : `Config: ${check.reason}`,
      status.lastError ? `Last error: ${status.lastError}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  const sessions =
    status.sessions.length === 0
      ? 'No active job sessions.'
      : status.sessions
          .map((s) => `- job ${s.jobId} (chain ${s.chainId}) [${s.roles.join('/')}] → ${s.status}`)
          .join('\n')
  return [
    'Virtuals ACP: running',
    `Agent wallet: ${status.agentAddress}`,
    `Chain: ${status.chainId} | auto-LLM: ${status.autoLlmEnabled ? 'on' : 'off'} | auto-fund: ${status.autoFundEnabled ? 'on' : 'off'} | budget cap: ${status.maxBudgetUsdc} USDC`,
    `Entries handled: ${status.entriesHandled} | tools executed: ${status.toolsExecuted}`,
    sessions,
  ].join('\n')
}

async function formatBrowse(keyword: string): Promise<string> {
  if (!keyword) return 'Usage: /virtuals browse <keyword>'
  const service = getVirtualsAcpService()
  if (!service.running) return 'Virtuals ACP service is not running — /virtuals status for details.'
  const agents = await service.browseAgents(keyword, 5)
  if (agents.length === 0) return `No ACP agents found for "${keyword}".`
  return agents
    .map((agent) => {
      const offerings = (agent.offerings ?? [])
        .slice(0, 3)
        .map((offering) => offering.name)
        .filter(Boolean)
        .join(', ')
      return `- ${agent.name} (${agent.walletAddress})${offerings ? ` — offerings: ${offerings}` : ''}`
    })
    .join('\n')
}

const virtualsAcpAction: Action = {
  name: 'VIRTUALS_ACP',
  similes: ['virtuals status', 'virtuals browse', 'acp status', 'acp jobs'],
  description:
    'Inspect and control the Virtuals ACP agent connection (status, registry browse).',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text ?? ''
    return isVirtualsCommand(text)
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text ?? '').trim()
    const { sub, rest } = parseSubcommand(text)
    try {
      switch (sub) {
        case 'status': {
          await callback?.({ text: formatStatus() } as Content)
          return
        }
        case 'browse': {
          await callback?.({ text: await formatBrowse(rest) } as Content)
          return
        }
        default: {
          await callback?.({
            text: 'Virtuals ACP commands:\n/virtuals status — connection + active jobs\n/virtuals browse <keyword> — search ACP agent registry',
          } as Content)
          return
        }
      }
    } catch (error) {
      await callback?.({
        text: `Virtuals ACP command failed: ${error instanceof Error ? error.message : String(error)}`,
      } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/virtuals status' } },
      { name: 'agent', content: { text: 'Virtuals ACP: running\nAgent wallet: 0x...\nNo active job sessions.' } },
    ],
    [
      { name: 'user', content: { text: '/virtuals browse meme' } },
      { name: 'agent', content: { text: '- MemeSeller (0x...) — offerings: cat memes' } },
    ],
  ],
}

export const virtualsPlugin: Plugin = {
  name: '@4626/plugin-virtuals',
  description:
    'Virtuals Protocol ACP v2 bridge — job loop control and agent registry browse for the 4626 Eliza agent.',

  actions: [virtualsAcpAction],
  providers: [],
}

export { getVirtualsAcpService } from './service.js'
export { readVirtualsAcpConfig, checkVirtualsAcpConfig } from './config.js'

export default virtualsPlugin
