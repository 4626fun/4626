/**
 * CreatorVault ElizaOS Agent — Unified Multi-Agent Runtime
 *
 * Primary long-lived agent process that:
 *   1. Loads creator agents from the DB (encrypted keys, CSW signers)
 *   2. Streams XMTP messages in real-time per agent
 *   3. Routes messages through the ElizaOS plugin pipeline
 *   4. Falls back to LLM for conversational replies
 *   5. Periodically syncs for new/removed agents
 *
 * Replaces both the old ElizaOS single-agent entry and the standalone
 * runtime.ts. The Vercel cron (_process.ts) remains as a degraded fallback.
 *
 * Usage:
 *   # With all env vars set:
 *   pnpm agent:eliza
 *
 *   # Or directly:
 *   POSTGRES_URL=... XMTP_AGENT_KEY_ENCRYPTION_KEY=... tsx server/agent/eliza/index.ts
 *
 * Required env vars:
 *   DATABASE_URL / POSTGRES_URL     — Postgres connection string (Supabase)
 *   XMTP_AGENT_KEY_ENCRYPTION_KEY   — AES-256-GCM key for decrypting agent keys
 *
 * Optional env vars:
 *   XMTP_ENV                — 'production' | 'dev' (default: production)
 *   MAX_AGENTS              — Max agents to run (default: 50)
 *   GROQ_API_KEY            — Groq LLM provider
 *   OPENAI_API_KEY          — OpenAI LLM provider
 *   ANTHROPIC_API_KEY       — Anthropic LLM provider
 *   OPENROUTER_API_KEY      — OpenRouter provider
 */

import { keeprPlugin } from './plugins/keepr/index.js'
import { lensPlugin } from './plugins/lens/index.js'
import { walletIntelPlugin } from './plugins/walletIntel/index.js'
import { reputationPlugin } from './plugins/reputation/index.js'
import { creatorVaultCharacter } from './character.js'
import { XmtpService } from './plugins/xmtp/service.js'

import { getDb, isDbConfigured } from '../../_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../_lib/privyXmtpSigner.js'
import { logger } from '../../_lib/logger.js'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const POLL_INTERVAL_MS = 60_000
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '50')

// ---------------------------------------------------------------------------
// Plugins & Actions
// ---------------------------------------------------------------------------

const plugins = [keeprPlugin, lensPlugin, walletIntelPlugin, reputationPlugin]
const allActions = plugins.flatMap((p) => p.actions ?? [])

export { keeprPlugin, lensPlugin, walletIntelPlugin, reputationPlugin }

// ---------------------------------------------------------------------------
// LLM providers (for /ai fallback)
// ---------------------------------------------------------------------------

type LlmProvider = {
  name: string
  envKey: string
  apiUrl: string
  model: string
  transformBody?: (messages: any[]) => any
  extractContent?: (json: any) => string | null
}

const PROVIDERS: LlmProvider[] = [
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    transformBody: (messages) => ({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: messages.find((m: any) => m.role === 'system')?.content ?? '',
      messages: messages.filter((m: any) => m.role !== 'system'),
    }),
    extractContent: (json) => json?.content?.[0]?.text ?? null,
  },
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
  },
]

function resolveProvider(): LlmProvider | null {
  for (const p of PROVIDERS) {
    if ((process.env[p.envKey] ?? '').trim()) return p
  }
  return null
}

async function generateLlmResponse(
  userMessage: string,
  systemPrompt: string,
  vaultContext: string,
): Promise<string | null> {
  const provider = resolveProvider()
  if (!provider) return null

  const apiKey = (process.env[provider.envKey] ?? '').trim()
  const messages = [
    { role: 'system', content: `${systemPrompt}\n\n${vaultContext}` },
    { role: 'user', content: userMessage },
  ]

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.name === 'Anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const body = provider.transformBody
    ? provider.transformBody(messages)
    : { model: provider.model, messages, max_tokens: 512, temperature: 0.7 }

  try {
    const res = await fetch(provider.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const json = (await res.json()) as any
    return provider.extractContent
      ? provider.extractContent(json)
      : json?.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Message router (ElizaOS plugin pipeline)
// ---------------------------------------------------------------------------

async function handleMessage(msg: {
  conversationId: string
  conversationType: string
  senderAddress: string | null
  content: string
}): Promise<string | null> {
  const text = msg.content.trim()

  // Route through all plugin actions
  for (const action of allActions) {
    const fakeMemory = {
      content: {
        text,
        metadata: {
          conversationId: msg.conversationId,
          conversationType: msg.conversationType,
          senderAddress: msg.senderAddress,
        },
      },
    } as any

    const matches = await action.validate({} as any, fakeMemory)
    if (matches) {
      const parts: string[] = []
      await action.handler(
        {} as any,
        fakeMemory,
        undefined,
        undefined,
        async (content: any) => {
          if (content?.text) parts.push(content.text)
          return []
        },
      )
      return parts.join('\n\n') || null
    }
  }

  // LLM fallback for /ai, @keepr, @bot
  const lower = text.toLowerCase()
  const isAi =
    lower.startsWith('/ai') ||
    lower.startsWith('@keepr') ||
    lower.startsWith('@bot')

  if (!isAi) return null

  const cleanText = text
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()

  if (!cleanText) return 'Ask me anything about this vault or DeFi on Base.'

  // Get vault context from providers
  let vaultContext = ''
  for (const provider of keeprPlugin.providers ?? []) {
    const result = await provider.get(
      {} as any,
      {
        content: {
          text: cleanText,
          metadata: {
            conversationId: msg.conversationId,
            conversationType: msg.conversationType,
          },
        },
      } as any,
      {} as any,
    )
    if (result?.text) vaultContext += result.text + '\n'
  }

  const reply = await generateLlmResponse(
    cleanText,
    creatorVaultCharacter.system,
    vaultContext,
  )

  return reply ?? "I couldn't generate a response right now. Try again later."
}

// ---------------------------------------------------------------------------
// Agent DB types & loader (from runtime.ts)
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
  xmtp: XmtpService
}

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
// Agent lifecycle
// ---------------------------------------------------------------------------

async function startAgent(row: AgentRow): Promise<RunningAgent> {
  let signer: any

  if (row.agentType === 'csw' && row.privyWalletId && row.cswAddress) {
    logger.info(`[eliza] Creating CSW signer for ${row.creatorAddress.slice(0, 10)}`, {
      cswAddress: row.cswAddress,
      privyWalletId: row.privyWalletId.slice(0, 10) + '...',
    })
    signer = createPrivyScwSigner({
      walletId: row.privyWalletId,
      cswAddress: row.cswAddress as `0x${string}`,
      chainId: 8453,
    })
  } else {
    const privKey = decryptPrivateKey({
      ciphertextB64: row.encryptedPrivateKeyB64,
      ivB64: row.encryptedPrivateKeyIvB64,
      tagB64: row.encryptedPrivateKeyTagB64,
      aad: `creator:${row.creatorAddress}`,
    })
    // For XmtpService, pass the private key directly
    signer = { type: 'eoa', privateKey: privKey }
  }

  // Create XmtpService with the appropriate config
  const xmtp = new XmtpService(
    signer.type === 'eoa'
      ? { privateKey: signer.privateKey, env: XMTP_ENV }
      : { signer, env: XMTP_ENV },
  )

  // Wire message handler through the ElizaOS plugin pipeline
  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:${row.creatorAddress.slice(0, 10)}] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage({
      conversationId: msg.conversationId,
      conversationType: msg.conversationType,
      senderAddress: msg.senderAddress,
      content: msg.content,
    })
  })

  await xmtp.start()

  logger.info(`[eliza] Started agent for creator ${row.creatorAddress}`, {
    agentAddress: xmtp.address,
    agentType: row.agentType,
  })

  return { creatorAddress: row.creatorAddress, xmtp }
}

// ---------------------------------------------------------------------------
// Multi-agent orchestrator
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
        logger.error(`[eliza] Failed to start agent for ${row.creatorAddress}`, err)
      }
    }

    // Stop removed agents
    for (const key of currentKeys) {
      if (!desiredKeys.has(key)) {
        const running = runningAgents.get(key)
        if (running) {
          logger.info(`[eliza] Stopping agent for ${key}`)
          try {
            await running.xmtp.stop()
          } catch {}
          runningAgents.delete(key)
        }
      }
    }

    logger.info(`[eliza] Sync complete — ${runningAgents.size} agents running`)
  } catch (err) {
    logger.error('[eliza] Sync error', err)
  }
}

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('[eliza] Shutting down...')

  const stops = [...runningAgents.values()].map(async (r) => {
    try {
      await r.xmtp.stop()
    } catch {}
  })
  await Promise.allSettled(stops)

  logger.info(`[eliza] All ${runningAgents.size} agents stopped`)
  runningAgents.clear()
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CreatorVault ElizaOS Agent (Unified)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Validate required env vars
  if (!isDbConfigured()) {
    logger.error('[eliza] POSTGRES_URL / DATABASE_URL not configured')
    process.exit(1)
  }
  if (!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()) {
    logger.error('[eliza] XMTP_AGENT_KEY_ENCRYPTION_KEY not configured')
    process.exit(1)
  }

  const llmProvider = resolveProvider()
  const actionCount = allActions.length
  console.log(`  LLM provider: ${llmProvider?.name ?? 'none (conversational AI disabled)'}`)
  console.log(`  XMTP env: ${XMTP_ENV}`)
  console.log(`  Max agents: ${MAX_AGENTS}`)
  console.log(`  Character: ${creatorVaultCharacter.name}`)
  console.log(`  Plugins: ${plugins.map((p) => p.name).join(', ')}`)
  console.log(`  Actions: ${actionCount} total`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Initial agent sync
  await syncAgents()

  if (runningAgents.size === 0) {
    logger.warn('[eliza] No agents found in DB. Waiting for agents to be registered...')
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

  logger.info('[eliza] Runtime ready. Press Ctrl+C to stop.')
}

void main().catch((err) => {
  logger.error('[eliza] Fatal error', err)
  process.exit(1)
})
