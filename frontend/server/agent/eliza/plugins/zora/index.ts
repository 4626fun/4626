/**
 * ElizaOS Zora Plugin
 *
 * Provides /coin commands for creating Content Coins, buying and selling
 * Creator/Content Coins via the Zora Coins SDK, all executing through
 * the per-creator Privy agent wallet on Base.
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

import { handleCoinCommand } from '../../../../zora/commands.js'
import { resolveVaultAccessRoleFromVault } from '../../../core/resolveVaultRole.js'
import { getKeeprVaultByGroupId } from '../../../../_lib/keeprRegistry.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCoinCommand(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t.startsWith('/coin') || t.startsWith('coin ')
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

const zoraCoinAction: Action = {
  name: 'ZORA_COIN',
  similes: [
    'coin create', 'coin buy', 'coin sell', 'coin balance',
    'coin info', 'coin help', 'create coin', 'buy coin', 'sell coin',
  ],
  description:
    'Route Zora Coin commands (create, buy, sell, balance, info) through the production handler.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim()
    return isCoinCommand(text)
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

    // Vault is required for coin commands (need creatorToken for agent wallet)
    const vault = await getKeeprVaultByGroupId(conversationId)
    if (!vault) {
      await callback?.({
        text: 'Vault not configured. /coin commands require a connected vault.',
      } as Content)
      return
    }

    const role = resolveVaultAccessRoleFromVault({ wallet: senderAddress, vault })

    try {
      const result = await handleCoinCommand({
        groupId: conversationId,
        senderWallet: senderAddress as `0x${string}`,
        text,
        role,
        vault,
      })

      if (result.response) {
        await callback?.({ text: result.response } as Content)
      }
    } catch (err: any) {
      console.error('[zora-plugin] handleCoinCommand error:', err)
      await callback?.({
        text: `Coin command failed: ${err.message ?? 'unknown error'}`,
      } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/coin help' } },
      { name: 'agent', content: { text: 'Zora Coin commands\n...' } },
    ],
    [
      { name: 'user', content: { text: '/coin buy 0x1234567890abcdef1234567890abcdef12345678 0.01' } },
      { name: 'agent', content: { text: 'Coin purchased!\n- Coin: 0x1234...\n- Spent: 0.01 ETH' } },
    ],
    [
      { name: 'user', content: { text: '/coin balance' } },
      { name: 'agent', content: { text: 'Agent Wallet Balance\n- ETH: 0.5' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const zoraPlugin: Plugin = {
  name: '@4626/plugin-zora',
  description:
    'Zora Coin commands — create Content Coins, buy/sell Creator Coins via the Zora SDK on Base.',

  actions: [zoraCoinAction],
  providers: [],
}

export default zoraPlugin
