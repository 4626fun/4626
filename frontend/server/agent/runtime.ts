/**
 * @deprecated — Use the unified ElizaOS runtime instead:
 *   pnpm agent:eliza
 *   (or: tsx server/agent/eliza/index.ts)
 *
 * The ElizaOS runtime replaces this file with the same multi-agent
 * orchestrator plus wallet intelligence, ERC-8004 reputation, and
 * Lens plugin support. This file is kept as a reference only.
 *
 * ---
 *
 * XMTP Agent Runtime (Legacy)
 *
 * Long-lived Node.js process that runs creator XMTP agents.
 * Each agent listens for messages and dispatches to the Keepr command pipeline.
 *
 * Usage:
 *   POSTGRES_URL=... XMTP_AGENT_KEY_ENCRYPTION_KEY=... npx tsx server/agent/runtime.ts
 *
 * Can be deployed on Railway, Fly.io, or run locally.
 * NOT designed for Vercel serverless (use the cron endpoint for that).
 */

import { Agent, createUser, createSigner, filter } from '@xmtp/agent-sdk'
import type { MessageContext } from '@xmtp/agent-sdk'
import type { Address } from 'viem'

import { getDb, isDbConfigured } from '../_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../_lib/privyXmtpSigner.js'
import { handleKeeprCommand } from '../keepr/commands.js'
import { logger } from '../_lib/logger.js'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AgentRow = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType: 'eoa' | 'csw'
  privyWalletId: string | null
  cswAddress: string | null
  encryptedPrivateKeyB64: string
  encryptedPrivateKeyIvB64: string
  encryptedPrivateKeyTagB64: string
}

type RunningAgent = {
  creatorAddress: string
  agent: Agent
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const POLL_INTERVAL_MS = 60_000 // Check for new agents every 60s
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '50')

// ---------------------------------------------------------------------------
// Agent loader
// ---------------------------------------------------------------------------
async function loadAgentRows(): Promise<AgentRow[]> {
  if (!isDbConfigured()) throw new Error('Database not configured')
  const db = await getDb()
  if (!db) throw new Error('Database connection failed')
  await ensureCreatorXmtpAgentsSchema(db as any)

  const res = await db.sql`
    SELECT
      creator_address,
      xmtp_agent_address,
      agent_type,
      privy_wallet_id,
      csw_address,
      encrypted_private_key_b64,
      encrypted_private_key_iv_b64,
      encrypted_private_key_tag_b64
    FROM creator_xmtp_agents
    WHERE listed_publicly = TRUE
    ORDER BY created_at ASC
    LIMIT ${MAX_AGENTS};
  `

  return (res.rows ?? []).map((r: any) => ({
    creatorAddress: String(r.creator_address).toLowerCase(),
    xmtpAgentAddress: String(r.xmtp_agent_address).toLowerCase(),
    agentType: (String(r.agent_type ?? 'eoa').toLowerCase()) as 'eoa' | 'csw',
    privyWalletId: r.privy_wallet_id ? String(r.privy_wallet_id).trim() : null,
    cswAddress: r.csw_address ? String(r.csw_address).toLowerCase() : null,
    encryptedPrivateKeyB64: String(r.encrypted_private_key_b64),
    encryptedPrivateKeyIvB64: String(r.encrypted_private_key_iv_b64),
    encryptedPrivateKeyTagB64: String(r.encrypted_private_key_tag_b64),
  }))
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
async function handleMessage(ctx: MessageContext<string>) {
  try {
    // Skip self messages
    if (filter.fromSelf(ctx.message, ctx.client)) return

    const text = ctx.message.content
    if (!text || typeof text !== 'string') return

    // Only process messages that look like commands or AI triggers
    const trimmed = text.trim().toLowerCase()
    const isCommand =
      trimmed.startsWith('/') ||
      trimmed.startsWith('keepr') ||
      trimmed.startsWith('fc ') ||
      trimmed.startsWith('send ') ||
      trimmed.startsWith('@keepr') ||
      trimmed.startsWith('@bot')

    if (!isCommand) return

    const conversationId = ctx.conversation.id
    const senderAddress = await ctx.getSenderAddress()
    if (!senderAddress) {
      logger.warn('[agent] Could not resolve sender address', { conversationId })
      return
    }

    logger.info('[agent] Processing command', {
      conversationId,
      sender: senderAddress.slice(0, 10),
      text: text.slice(0, 80),
    })

    const result = await handleKeeprCommand({
      groupId: conversationId,
      senderWallet: senderAddress.toLowerCase() as Address,
      text: text.trim(),
    })

    if (result.ok && result.response) {
      await ctx.conversation.sendText(result.response)
    } else if (!result.ok && result.response) {
      await ctx.conversation.sendText(result.response)
    }
    // If response is empty, silently ignore (not a recognized command)
  } catch (err) {
    logger.error('[agent] Message handler error', err)
  }
}

// ---------------------------------------------------------------------------
// Start a single agent
// ---------------------------------------------------------------------------
async function startAgent(row: AgentRow): Promise<RunningAgent> {
  let signer: any

  if (row.agentType === 'csw' && row.privyWalletId && row.cswAddress) {
    // CSW agent: sign via Privy wallet API using the canonical Smart Wallet
    logger.info(`[agent] Creating CSW signer for ${row.creatorAddress.slice(0, 10)}`, {
      cswAddress: row.cswAddress,
      privyWalletId: row.privyWalletId.slice(0, 10) + '...',
    })
    signer = createPrivyScwSigner({
      walletId: row.privyWalletId,
      cswAddress: row.cswAddress as `0x${string}`,
      chainId: 8453, // Base
    })
  } else {
    // EOA agent: decrypt private key and create signer
    const privKey = decryptPrivateKey({
      ciphertextB64: row.encryptedPrivateKeyB64,
      ivB64: row.encryptedPrivateKeyIvB64,
      tagB64: row.encryptedPrivateKeyTagB64,
      aad: `creator:${row.creatorAddress}`,
    })
    const user = createUser(privKey)
    signer = createSigner(user)
  }

  const agent = await Agent.create(signer, {
    env: XMTP_ENV,
  })

  // Handle text messages
  agent.on('text', handleMessage)

  // Handle markdown messages (some clients send markdown)
  agent.on('markdown', handleMessage)

  // Log errors
  agent.on('unhandledError', (error) => {
    logger.error(`[agent:${row.creatorAddress.slice(0, 10)}] Unhandled error`, error)
  })

  // Start streaming
  await agent.start()

  logger.info(`[agent] Started agent for creator ${row.creatorAddress}`, {
    agentAddress: agent.address,
    agentType: row.agentType,
  })

  return { creatorAddress: row.creatorAddress, agent }
}

// ---------------------------------------------------------------------------
// Runtime orchestrator
// ---------------------------------------------------------------------------
const runningAgents = new Map<string, RunningAgent>()
let shuttingDown = false

async function syncAgents() {
  if (shuttingDown) return

  try {
    const rows = await loadAgentRows()
    const currentKeys = new Set(runningAgents.keys())
    const desiredKeys = new Set(rows.map((r) => r.creatorAddress))

    // Start new agents
    for (const row of rows) {
      if (runningAgents.has(row.creatorAddress)) continue
      try {
        const running = await startAgent(row)
        runningAgents.set(row.creatorAddress, running)
      } catch (err) {
        logger.error(`[agent] Failed to start agent for ${row.creatorAddress}`, err)
      }
    }

    // Stop removed agents
    for (const key of currentKeys) {
      if (!desiredKeys.has(key)) {
        const running = runningAgents.get(key)
        if (running) {
          logger.info(`[agent] Stopping agent for ${key}`)
          try {
            await running.agent.stop()
          } catch {}
          runningAgents.delete(key)
        }
      }
    }

    logger.info(`[agent] Sync complete — ${runningAgents.size} agents running`)
  } catch (err) {
    logger.error('[agent] Sync error', err)
  }
}

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('[agent] Shutting down...')

  const stops = [...runningAgents.values()].map(async (r) => {
    try {
      await r.agent.stop()
    } catch {}
  })
  await Promise.allSettled(stops)

  logger.info(`[agent] All ${runningAgents.size} agents stopped`)
  runningAgents.clear()
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  logger.info('[agent] CreatorVault XMTP Agent Runtime starting...')
  logger.info(`[agent] XMTP env: ${XMTP_ENV}, max agents: ${MAX_AGENTS}`)

  // Validate required env vars
  if (!isDbConfigured()) {
    logger.error('[agent] POSTGRES_URL / DATABASE_URL not configured')
    process.exit(1)
  }
  if (!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()) {
    logger.error('[agent] XMTP_AGENT_KEY_ENCRYPTION_KEY not configured')
    process.exit(1)
  }

  // Initial agent sync
  await syncAgents()

  if (runningAgents.size === 0) {
    logger.warn('[agent] No agents found in DB. Waiting for agents to be registered...')
  }

  // Periodically check for new/removed agents
  const syncInterval = setInterval(() => {
    void syncAgents()
  }, POLL_INTERVAL_MS)

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(syncInterval)
    void shutdown()
  })
  process.on('SIGTERM', () => {
    clearInterval(syncInterval)
    void shutdown()
  })

  logger.info('[agent] Runtime ready. Press Ctrl+C to stop.')
}

void main().catch((err) => {
  logger.error('[agent] Fatal error', err)
  process.exit(1)
})
