/**
 * ElizaOS Keepr Plugin (Unified)
 *
 * Delegates all vault commands to the shared production executor
 * instead of reimplementing them. This gives ElizaOS access to the full
 * command set: vault status, rules, lock/unlock, check, sync, send,
 * and social commands.
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

import { executeDeterministicCommand } from '../../../core/executeDeterministicCommand.js'
import { getKeeprVaultByGroupId } from '../../../../_lib/keeprRegistry.js'
import { assertTeeAttestationOrThrow } from '../../../../_lib/teeAttestationGate.js'
import { matchesAnyCommandFamily, matchesCommandFamily } from '../../../../commands/registry.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../../_errors.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines if a message looks like a Keepr/vault command that should
 * be routed to the shared deterministic executor. This mirrors the isCommandLike()
 * check in the production agent runtime.
 */
function isKeeprCommand(text: string): boolean {
  return matchesAnyCommandFamily(text, ['keepr', 'whois', 'market', 'send', 'twitter', 'coin', 'help'])
}

function isKeeprStatusCommand(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === '/keepr status' || t === 'keepr status'
}

function isPrivilegedKeeprCommand(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (matchesCommandFamily(text, 'send')) return true
  if (matchesCommandFamily(text, 'coin')) return true
  if (t.startsWith('/cre') || t.startsWith('cre ')) {
    return (
      t.includes(' tend') ||
      t.includes(' report') ||
      t.includes(' settle') ||
      t.includes(' settle-fees') ||
      t.includes(' relay-entries') ||
      t.includes(' relay-winners') ||
      t.includes(' queue') ||
      t.includes(' graduate')
    )
  }
  return false
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Single catch-all action that delegates to the production command executor.
 * This replaces the previous VAULT_STATUS, SEND_TOKENS, and KEEPR_HELP stubs.
 */
const keeprCommandAction: Action = {
  name: 'KEEPR_COMMAND',
  similes: [
    'keepr status', 'vault status', 'send', 'transfer',
    'keepr help', 'help', 'commands',
  ],
  description:
    'Route deterministic vault commands (status, send, lock, unlock, check, sync, social) through the production Keepr handler.',

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
      if (isPrivilegedKeeprCommand(text)) {
        try {
          await assertTeeAttestationOrThrow({
            action: 'keepr_command:privileged',
            actorAddress: senderAddress,
            metadata: {
              conversationId,
              commandPreview: text.slice(0, 96),
            },
          })
        } catch (error) {
          await callback?.({
            text: 'Command denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
          } as Content)
          return
        }
      }

      const result = await executeDeterministicCommand({
        groupId: conversationId,
        senderWallet: senderAddress as `0x${string}`,
        text,
        emptyResponseFallback: isKeeprStatusCommand(text)
          ? 'Keepr status is temporarily unavailable. Please try again shortly.'
          : undefined,
      })

      await callback?.({ text: result.responseText } as Content)
    } catch (err: any) {
      const agentError = toAgentError(err, 'UPSTREAM_ERROR', 'Keepr command failed')
      console.error('[keepr-plugin] executeDeterministicCommand error:', {
        code: agentError.code,
        message: agentError.message,
      })
      await callback?.({
        text: toUserFacingAgentErrorMessage(agentError),
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
      { name: 'agent', content: { text: '4626 Commands\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Injects vault context into the LLM prompt so the agent can answer
 * vault-related questions conversationally through the shared fallback path.
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
      `This conversation is linked to 4626 vault "${vault.vaultAddress}" on chain ${vault.chainId}.`,
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
  name: '@4626/plugin-keepr',
  description:
    '4626 Keepr commands — delegates to the shared production executor for vault status, send, lock/unlock, check, sync, social, and AI.',

  actions: [keeprCommandAction],
  providers: [vaultInfoProvider],
}

export default keeprPlugin
