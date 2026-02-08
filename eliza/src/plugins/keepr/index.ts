/**
 * ElizaOS Keepr Plugin
 *
 * Exposes CreatorVault Keepr commands as ElizaOS actions.
 * - /keepr status  → vault status check
 * - /send          → token transfer
 * - /fc            → Farcaster commands
 * - (default)      → LLM-powered conversational reply
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

import { getXmtpService } from '../xmtp/index.js'

// ---------------------------------------------------------------------------
// DB helpers (lightweight — connects to the same Supabase/Postgres)
// ---------------------------------------------------------------------------

let pgPool: any = null

async function getDb() {
  if (pgPool) return pgPool
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  if (!connectionString) return null

  const pg = await import('pg')
  pgPool = new pg.default.Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  })
  return pgPool
}

async function queryVaultByGroupId(groupId: string): Promise<any | null> {
  const pool = await getDb()
  if (!pool) return null
  try {
    const res = await pool.query(
      'SELECT * FROM keepr_vaults WHERE group_id = $1 LIMIT 1',
      [groupId],
    )
    return res.rows?.[0] ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const vaultStatusAction: Action = {
  name: 'VAULT_STATUS',
  similes: ['keepr status', 'vault info', 'check vault'],
  description: 'Check the status and configuration of the vault linked to this chat group',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return (
      text.includes('/keepr status') ||
      text.includes('keepr status') ||
      text.includes('/vault status') ||
      text.includes('vault status')
    )
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const meta = (message.content as any)?.metadata
    const groupId = meta?.conversationId
    if (!groupId) {
      await callback?.({ text: 'Could not determine conversation ID.' } as Content)
      return
    }

    const vault = await queryVaultByGroupId(groupId)
    if (!vault) {
      await callback?.({
        text: 'No vault is linked to this group yet. Ask the creator to set one up in /admin/agent-setup.',
      } as Content)
      return
    }

    const lines = [
      '**Vault Status**',
      '',
      `- Address: \`${vault.vault_address}\``,
      `- Chain: ${vault.chain_id}`,
      `- Gating: ${vault.gating_enabled ? 'enabled' : 'disabled'} (${vault.gating_mode})`,
      `- Min shares: ${vault.min_shares ?? 'n/a'}`,
      `- Join locked: ${vault.join_locked ? 'yes' : 'no'}`,
      `- Owner: \`${vault.canonical_owner_address}\``,
    ]

    await callback?.({ text: lines.join('\n') } as Content)
  },

  examples: [
    [
      { name: 'user', content: { text: '/keepr status' } },
      { name: 'agent', content: { text: 'Vault Status\n- Address: 0x...\n- Gating: enabled' } },
    ],
  ],
}

const sendTokenAction: Action = {
  name: 'SEND_TOKENS',
  similes: ['send', 'transfer', 'pay'],
  description: 'Send tokens (ETH or USDC) to an address from the vault agent wallet',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/send') || text.startsWith('send ')
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text ?? '').trim()
    // Parse: /send <amount> <token> to <address>
    const match = text.match(
      /^\/?send\s+([\d.]+)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/i,
    )
    if (!match) {
      await callback?.({
        text: 'Usage: `/send <amount> <token> to <address>`\nExample: `/send 10 USDC to 0x1234...`',
      } as Content)
      return
    }

    const [, amountStr, token, recipient] = match
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      await callback?.({ text: 'Invalid amount.' } as Content)
      return
    }

    // For now, acknowledge the command — actual execution requires
    // Privy wallet integration which is handled by the existing sendCommand.ts
    await callback?.({
      text: `Send command received: ${amount} ${token.toUpperCase()} to ${recipient}\n\nNote: Token transfers require the agent wallet to be funded. Use the admin panel to deposit funds.`,
    } as Content)
  },

  examples: [
    [
      { name: 'user', content: { text: '/send 10 USDC to 0x1234567890abcdef1234567890abcdef12345678' } },
      { name: 'agent', content: { text: 'Send command received: 10 USDC to 0x1234...' } },
    ],
  ],
}

const helpAction: Action = {
  name: 'KEEPR_HELP',
  similes: ['keepr help', 'help', 'commands'],
  description: 'Show available Keepr commands',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return (
      text === '/keepr help' ||
      text === 'keepr help' ||
      text === '/help' ||
      text === 'help'
    )
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const helpText = [
      '**CreatorVault Commands**',
      '',
      '`/keepr status` — Check vault configuration',
      '`/send <amount> <token> to <address>` — Transfer tokens',
      '`/ai <question>` — Ask the AI agent anything',
      '`@keepr <question>` — Chat with the vault agent',
      '`/help` — Show this message',
    ].join('\n')

    await callback?.({ text: helpText } as Content)
  },

  examples: [
    [
      { name: 'user', content: { text: '/help' } },
      { name: 'agent', content: { text: 'CreatorVault Commands\n...' } },
    ],
  ],
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const vaultInfoProvider: Provider = {
  name: 'vault-info',
  description: 'Provides vault context for the agent to reference in conversations',

  async get(runtime: IAgentRuntime, message: Memory, state: State) {
    const meta = (message.content as any)?.metadata
    const groupId = meta?.conversationId
    if (!groupId) return { text: '' }

    const vault = await queryVaultByGroupId(groupId)
    if (!vault) {
      return {
        text: 'No vault is linked to this conversation.',
        values: { vaultLinked: false },
      }
    }

    const config = vault.config_json ?? {}
    const text = [
      `This conversation is linked to CreatorVault "${vault.vault_address}" on chain ${vault.chain_id}.`,
      `The vault owner is ${vault.canonical_owner_address}.`,
      vault.gating_enabled
        ? `Access gating is enabled (mode: ${vault.gating_mode}, min shares: ${vault.min_shares ?? 'any'}).`
        : 'Access gating is disabled (open to all).',
      `The vault holds assets and allows holders of its shares to participate in governance and rewards.`,
    ].join(' ')

    return {
      text,
      values: {
        vaultLinked: true,
        vaultAddress: vault.vault_address,
        chainId: vault.chain_id,
        ownerAddress: vault.canonical_owner_address,
        gatingEnabled: vault.gating_enabled,
        gatingMode: vault.gating_mode,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const keeprPlugin: Plugin = {
  name: '@creatorvault/plugin-keepr',
  description: 'CreatorVault Keepr commands — vault status, token transfers, and help',

  actions: [vaultStatusAction, sendTokenAction, helpAction],
  providers: [vaultInfoProvider],
}

export default keeprPlugin
