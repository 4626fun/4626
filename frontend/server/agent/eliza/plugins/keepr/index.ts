/**
 * ElizaOS Keepr Plugin (Unified)
 *
 * Delegates all vault commands to the production handleKeeprCommand()
 * instead of reimplementing them. This gives ElizaOS access to the full
 * command set: vault status, rules, lock/unlock, check, sync, send,
 * Farcaster commands, and LLM /ai responses.
 *
 * Also provides a vault-info provider that injects vault context
 * into the LLM prompt so the agent can answer vault-related questions.
 */

import type {
  Plugin,
  Action,
  Provider,
  IAgentRuntime,
  Memory,
  State,
  Content,
  HandlerCallback,
} from '@elizaos/core'

import { handleKeeprCommand } from '../../../../keepr/commands.js'
import { getKeeprVaultByGroupId } from '../../../../_lib/keeprRegistry.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines if a message looks like a Keepr/vault command that should
 * be routed to handleKeeprCommand(). This mirrors the isCommandLike()
 * check in the production agent runtime.
 */
function isKeeprCommand(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t.startsWith('/keepr') ||
    t.startsWith('keepr') ||
    t.startsWith('/whois') ||
    t === 'whois' ||
    t.startsWith('whois ') ||
    t.startsWith('/send') ||
    t.startsWith('send ') ||
    t.startsWith('/fc') ||
    t.startsWith('fc ') ||
    t.startsWith('/coin') ||
    t.startsWith('coin ') ||
    t.startsWith('/ai') ||
    t.startsWith('@keepr') ||
    t.startsWith('@bot') ||
    t === '/help' ||
    t === 'help'
  )
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Single catch-all action that delegates to the production command handler.
 * This replaces the previous VAULT_STATUS, SEND_TOKENS, and KEEPR_HELP stubs.
 */
const keeprCommandAction: Action = {
  name: 'KEEPR_COMMAND',
  similes: [
    'keepr status', 'vault status', 'send', 'transfer',
    'keepr help', 'help', 'commands', 'farcaster',
    'ai', 'ask keepr',
  ],
  description:
    'Route vault commands (status, send, lock, unlock, check, sync, farcaster, AI) through the production Keepr handler.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim()
    return isKeeprCommand(text)
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const meta = (message.content as any)?.metadata
    const conversationId = meta?.conversationId ?? ''
    const senderAddress = (meta?.senderAddress ?? '').toLowerCase()

    if (!conversationId) {
      await callback?.({ text: 'Could not determine conversation ID.' } as Content)
      return
    }

    if (!senderAddress || !/^0x[a-fA-F0-9]{40}$/.test(senderAddress)) {
      await callback?.({ text: 'Could not determine sender wallet address.' } as Content)
      return
    }

    const text = (message.content?.text ?? '').trim()

    try {
      const result = await handleKeeprCommand({
        groupId: conversationId,
        senderWallet: senderAddress as `0x${string}`,
        text,
      })

      if (result.response) {
        await callback?.({ text: result.response } as Content)
      }
    } catch (err: any) {
      console.error('[keepr-plugin] handleKeeprCommand error:', err)
      await callback?.({
        text: `Command failed: ${err.message ?? 'unknown error'}`,
      } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/keepr status' } },
      { name: 'agent', content: { text: 'Keepr status\n- configured: yes\n- vaultAddress: 0x...' } },
    ],
    [
      { name: 'user', content: { text: '/send 10 USDC to 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: 'Send command received: 10 USDC to 0x1234...' } },
    ],
    [
      { name: 'user', content: { text: '/help' } },
      { name: 'agent', content: { text: 'CreatorVault Commands\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Injects vault context into the LLM prompt so the agent can answer
 * vault-related questions conversationally (via /ai or @keepr).
 * Uses the production getKeeprVaultByGroupId() instead of a separate DB query.
 */
const vaultInfoProvider: Provider = {
  name: 'vault-info',
  description: 'Provides vault context for the agent to reference in conversations',

  async get(_runtime: IAgentRuntime, message: Memory, _state: State) {
    const meta = (message.content as any)?.metadata
    const groupId = meta?.conversationId
    if (!groupId) return { text: '' }

    const vault = await getKeeprVaultByGroupId(groupId)
    if (!vault) {
      return {
        text: 'No vault is linked to this conversation.',
        values: { vaultLinked: false },
      }
    }

    const text = [
      `This conversation is linked to CreatorVault "${vault.vaultAddress}" on chain ${vault.chainId}.`,
      `The vault owner is ${vault.canonicalOwnerAddress}.`,
      vault.gatingEnabled
        ? `Access gating is enabled (mode: ${vault.gatingMode}, min shares: ${vault.minShares ?? 'any'}).`
        : 'Access gating is disabled (open to all).',
      `The vault holds assets and allows holders of its shares to participate in governance and rewards.`,
    ].join(' ')

    return {
      text,
      values: {
        vaultLinked: true,
        vaultAddress: vault.vaultAddress,
        chainId: vault.chainId,
        ownerAddress: vault.canonicalOwnerAddress,
        gatingEnabled: vault.gatingEnabled,
        gatingMode: vault.gatingMode,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const keeprPlugin: Plugin = {
  name: '@creatorvault/plugin-keepr',
  description:
    'CreatorVault Keepr commands — delegates to the production handleKeeprCommand() for vault status, send, lock/unlock, check, sync, Farcaster, and AI.',

  actions: [keeprCommandAction],
  providers: [vaultInfoProvider],
}

export default keeprPlugin
