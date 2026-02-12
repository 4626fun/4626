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
 * Startup modes (checked in priority order):
 *
 *   1. Multi-agent (DB):
 *      DATABASE_URL / POSTGRES_URL     — Postgres connection string (Supabase)
 *      XMTP_AGENT_KEY_ENCRYPTION_KEY   — AES-256-GCM key for decrypting agent keys
 *
 *   2. Single-agent CSW (recommended for production single-agent):
 *      XMTP_AGENT_CSW_ADDRESS          — Coinbase Smart Wallet address (XMTP identity)
 *      XMTP_AGENT_PRIVY_WALLET_ID      — Privy server wallet ID (delegated signer)
 *      XMTP_AGENT_CSW_CHAIN_ID         — Chain ID (default: 8453 for Base)
 *      XMTP_AGENT_CSW_OWNER_INDEX      — Owner index in CSW's MultiOwnable list (required for ERC-1271)
 *      Requires PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_WALLET_AUTHORIZATION_KEY,
 *      PRIVY_WALLET_OWNER_ID to be set for Privy wallet API access.
 *
 *   3. Single-agent EOA (dev/testing only):
 *      XMTP_AGENT_PRIVATE_KEY          — Raw hex private key
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
import { crePlugin } from './plugins/cre/index.js'
import { zoraPlugin } from './plugins/zora/index.js'
import { creatorVaultCharacter } from './character.js'
import { XmtpService } from './plugins/xmtp/service.js'

import { getDb, isDbConfigured } from '../../_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../_lib/privyXmtpSigner.js'
import { buildAgentRegistration } from '../../_lib/agentRegistration.js'
import { tryUploadImmutableJson } from '../../_lib/lensGrove.js'
import { logger } from '../../_lib/logger.js'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
  cwd: () => string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const POLL_INTERVAL_MS = 60_000
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '50')

/**
 * Directory where XMTP local databases are persisted.
 * Defaults to `<cwd>/.xmtp-data/` — override with XMTP_DB_DIRECTORY.
 */
const XMTP_DB_DIR = (process.env.XMTP_DB_DIRECTORY ?? '').trim() || path.join(process.cwd(), '.xmtp-data')

/**
 * Whether to revoke all other installations on startup.
 * Defaults to FALSE — only set to 'true' when recovering from the 10/10 limit.
 *
 * WARNING: Revoking burns inbox updates (256 lifetime max). If the DB is also
 * ephemeral (no volume), every restart creates + revokes, quickly exhausting
 * the update budget.  See: https://docs.xmtp.org/agents/build-agents/local-database
 */
const XMTP_REVOKE_OTHER = (process.env.XMTP_REVOKE_OTHER_INSTALLATIONS ?? 'false').trim().toLowerCase() === 'true'

/**
 * Encryption key for the XMTP local database (0x-prefixed hex, 32 bytes).
 * Required by the SDK to encrypt/decrypt the persisted .db3 files.
 * Without this, the DB may not be reopenable across restarts.
 */
const XMTP_DB_ENCRYPTION_KEY = (() => {
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  const hex = raw.startsWith('0x') ? raw : `0x${raw}`
  return hex as `0x${string}`
})()

/**
 * Build a stable `dbPath` function for the XMTP SDK.
 * Ensures the directory exists and returns a deterministic path
 * per inboxId so the same installation is reused across restarts.
 */
function makeDbPath(): (inboxId: string) => string {
  fs.mkdirSync(XMTP_DB_DIR, { recursive: true, mode: 0o700 })
  return (inboxId: string) => {
    const p = path.join(XMTP_DB_DIR, `xmtp-${XMTP_ENV}-${inboxId}.db3`)
    logger.info(`[xmtp] Using local database: ${p}`)
    return p
  }
}

/**
 * Pre-flight check: log whether we're reusing an existing XMTP installation
 * or creating a fresh one.  If the DB directory is empty (no .db3 files),
 * this is almost certainly an ephemeral filesystem → warn loudly.
 */
function checkDbPersistence(): void {
  try {
    const files = fs.readdirSync(XMTP_DB_DIR).filter((f: string) => f.endsWith('.db3'))
    if (files.length > 0) {
      logger.info(`[xmtp] ✅ Found ${files.length} existing DB file(s) in ${XMTP_DB_DIR} — will reuse installation`)
      for (const f of files) {
        const stat = fs.statSync(path.join(XMTP_DB_DIR, f))
        logger.info(`[xmtp]   ${f} (${(stat.size / 1024).toFixed(1)} KB, modified ${stat.mtime.toISOString()})`)
      }
    } else {
      logger.warn(
        `[xmtp] ⚠️  No .db3 files found in ${XMTP_DB_DIR} — a NEW installation will be created.\n` +
        `    If this keeps happening on every restart, your volume is not persisting.\n` +
        `    → Railway: add a volume at /data/.xmtp-data in the dashboard or railway.toml\n` +
        `    → Docker: use -v xmtp-data:/data/.xmtp-data\n` +
        `    → Docs: https://docs.xmtp.org/agents/build-agents/local-database`,
      )
    }
    if (!XMTP_DB_ENCRYPTION_KEY) {
      logger.warn(
        '[xmtp] ⚠️  XMTP_DB_ENCRYPTION_KEY is not set — DB cannot be reopened across restarts!\n' +
        '    Generate one: openssl rand -hex 32  (then prefix with 0x)',
      )
    }
  } catch {
    // Directory doesn't exist yet — will be created by makeDbPath
  }
}

// ERC-8004 identity (loaded from env vars in a separate module to avoid circular imports)
import { erc8004Identity } from './identity.js'
export { erc8004Identity }
export type { Erc8004Identity } from './identity.js'

// ---------------------------------------------------------------------------
// Plugins & Actions
// ---------------------------------------------------------------------------

const plugins = [keeprPlugin, zoraPlugin, lensPlugin, walletIntelPlugin, reputationPlugin, crePlugin]
const allActions = plugins.flatMap((p) => p.actions ?? [])

export { keeprPlugin, zoraPlugin, lensPlugin, walletIntelPlugin, reputationPlugin, crePlugin }

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
// Welcome message for first-time conversations
// ---------------------------------------------------------------------------

const welcomedConversations = new Set<string>()

const WELCOME_MESSAGE = [
  `o henlo! I'm Keepr, your CreatorVault assistant.`,
  ``,
  `You can ask me about your vaults, check on-chain reputation, or just chat.`,
  ``,
  `Try saying "how are my vaults?" or type /help to see everything I can do.`,
].join('\n')

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

  // Welcome message on first interaction in a conversation
  if (!welcomedConversations.has(msg.conversationId)) {
    welcomedConversations.add(msg.conversationId)
    return WELCOME_MESSAGE
  }

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
      ? { privateKey: signer.privateKey, env: XMTP_ENV, dbPath: makeDbPath(), dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY, revokeOtherInstallations: XMTP_REVOKE_OTHER }
      : { signer, env: XMTP_ENV, dbPath: makeDbPath(), dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY, revokeOtherInstallations: XMTP_REVOKE_OTHER },
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

/**
 * Start a single agent from XMTP_AGENT_PRIVATE_KEY env var (EOA mode).
 * Used as a fallback when XMTP_AGENT_KEY_ENCRYPTION_KEY is not set
 * (i.e. no multi-agent DB is configured).
 */
async function startSingleAgentEoa(privateKey: `0x${string}`): Promise<RunningAgent> {
  const xmtp = new XmtpService({
    privateKey,
    env: XMTP_ENV,
    dbPath: makeDbPath(),
    dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY,
    revokeOtherInstallations: XMTP_REVOKE_OTHER,
  })

  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:single] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage({
      conversationId: msg.conversationId,
      conversationType: msg.conversationType,
      senderAddress: msg.senderAddress,
      content: msg.content,
    })
  })

  await xmtp.start()

  logger.info(`[eliza] Single EOA agent started`, { agentAddress: xmtp.address })

  return { creatorAddress: 'single-agent', xmtp }
}

/**
 * Start a single agent in CSW mode using Privy's server wallet as the
 * delegated signer. The agent presents as the creator's Coinbase Smart
 * Wallet on XMTP — the same pattern used for ERC-4337 UserOps and
 * vault deployments.
 *
 * Required env vars:
 *   XMTP_AGENT_CSW_ADDRESS        — The canonical Coinbase Smart Wallet address
 *   XMTP_AGENT_PRIVY_WALLET_ID    — Privy server wallet ID (added as CSW owner)
 *
 * Optional:
 *   XMTP_AGENT_CSW_CHAIN_ID       — Chain ID where the CSW is deployed (default: 8453)
 */
async function startSingleAgentCsw(params: {
  cswAddress: `0x${string}`
  privyWalletId: string
  ownerIndex?: number
  chainId?: number
}): Promise<RunningAgent> {
  const signer = createPrivyScwSigner({
    walletId: params.privyWalletId,
    cswAddress: params.cswAddress,
    ownerIndex: params.ownerIndex,
    chainId: params.chainId ?? 8453,
  })

  const xmtp = new XmtpService({
    signer,
    env: XMTP_ENV,
    dbPath: makeDbPath(),
    dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY,
    revokeOtherInstallations: XMTP_REVOKE_OTHER,
  })

  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:csw] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage({
      conversationId: msg.conversationId,
      conversationType: msg.conversationType,
      senderAddress: msg.senderAddress,
      content: msg.content,
    })
  })

  await xmtp.start()

  logger.info(`[eliza] Single CSW agent started`, {
    agentAddress: xmtp.address,
    cswAddress: params.cswAddress,
    privyWalletId: params.privyWalletId.slice(0, 12) + '...',
  })

  return { creatorAddress: 'single-agent-csw', xmtp }
}

// ---------------------------------------------------------------------------
// Grove registration upload (fire-and-forget on startup)
// ---------------------------------------------------------------------------

async function uploadRegistrationToGrove(): Promise<void> {
  try {
    const origin = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()
    const { payload, error } = buildAgentRegistration(origin)
    if (error || !payload) {
      logger.warn('[eliza] Skipping Grove registration upload:', error)
      return
    }

    const attempt = await tryUploadImmutableJson(payload)
    if (attempt.ok) {
      logger.info('[eliza] Agent registration uploaded to Grove', {
        lensUri: attempt.result.lensUri,
        gatewayUrl: attempt.result.gatewayUrl,
      })
    } else {
      logger.warn('[eliza] Grove registration upload failed (non-blocking):', attempt.error)
    }
  } catch (err) {
    logger.warn('[eliza] Grove registration upload error (non-blocking):', err)
  }
}

let agentBooted = false

async function main() {
  // Start health check server FIRST so Railway healthcheck passes during boot
  startHealthServer()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CreatorVault ElizaOS Agent (Unified)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Check DB persistence before creating any agent
  checkDbPersistence()

  const hasDb = isDbConfigured()
  const hasEncKey = !!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  const hasPrivateKey = !!(process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim()
  const hasCswConfig = !!(process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim() &&
    !!(process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim()
  const multiAgentMode = hasDb && hasEncKey

  // Determine mode label
  const modeLabel = multiAgentMode
    ? 'multi-agent (DB)'
    : hasCswConfig
      ? 'single-agent CSW (Privy delegated signer)'
      : hasPrivateKey
        ? 'single-agent EOA (env key)'
        : 'none'

  const llmProvider = resolveProvider()
  const actionCount = allActions.length
  console.log(`  Mode: ${modeLabel}`)
  console.log(`  LLM provider: ${llmProvider?.name ?? 'none (conversational AI disabled)'}`)
  console.log(`  XMTP env: ${XMTP_ENV}`)
  console.log(`  Character: ${creatorVaultCharacter.name}`)
  console.log(`  Plugins: ${plugins.map((p) => p.name).join(', ')}`)
  console.log(`  Actions: ${actionCount} total`)
  if (erc8004Identity) {
    console.log(`  ERC-8004: Agent #${erc8004Identity.agentId} on chain ${erc8004Identity.chainId}`)
    console.log(`  Registry: ${erc8004Identity.registryAddress}`)
    console.log(`  8004scan: https://www.8004scan.io/agents/base/${erc8004Identity.agentId}`)
  } else {
    console.log(`  ERC-8004: not configured (set ERC8004_AGENT_ID, ERC8004_AGENT_REGISTRY, ERC8004_AGENT_CHAIN_ID)`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (multiAgentMode) {
    // -----------------------------------------------------------------------
    // Multi-agent mode: load agents from DB, decrypt keys, run orchestrator
    // -----------------------------------------------------------------------
    console.log(`  Max agents: ${MAX_AGENTS}`)

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
  } else if (hasCswConfig) {
    // -----------------------------------------------------------------------
    // Single-agent CSW mode: Privy server wallet signs on behalf of your CSW.
    // Same delegation pattern used for ERC-4337 UserOps & vault deployments.
    // -----------------------------------------------------------------------
    const cswAddress = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim() as `0x${string}`
    const privyWalletId = (process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim()
    const chainId = Number(process.env.XMTP_AGENT_CSW_CHAIN_ID ?? '8453') || 8453
    const ownerIndexRaw = (process.env.XMTP_AGENT_CSW_OWNER_INDEX ?? '').trim()
    const ownerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : undefined

    console.log(`\n  CSW address: ${cswAddress}`)
    console.log(`  Privy wallet: ${privyWalletId.slice(0, 12)}...`)
    console.log(`  Chain ID: ${chainId}`)
    console.log(`  Owner index: ${ownerIndex !== undefined ? ownerIndex : '(auto-detect at runtime)'}`)

    const running = await startSingleAgentCsw({ cswAddress, privyWalletId, ownerIndex, chainId })
    runningAgents.set('single-agent-csw', running)

    console.log(`\n  Agent XMTP identity: ${running.xmtp.address}`)
    console.log(`  Test: https://xmtp.chat/dm/${running.xmtp.address}`)
    console.log(`\n  The agent presents as your Coinbase Smart Wallet on XMTP.`)
    console.log(`  No private key extraction needed — Privy signs on your behalf.`)
    console.log(`\n  Listening for messages... (Ctrl+C to stop)\n`)

    // Fire-and-forget: upload enriched agent registration to Lens Grove
    void uploadRegistrationToGrove()

    // Graceful shutdown
    process.on('SIGINT', () => void shutdown())
    process.on('SIGTERM', () => void shutdown())
  } else if (hasPrivateKey) {
    // -----------------------------------------------------------------------
    // Single-agent EOA mode: use XMTP_AGENT_PRIVATE_KEY directly
    // -----------------------------------------------------------------------
    const privateKey = (process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim() as `0x${string}`

    const running = await startSingleAgentEoa(privateKey)
    runningAgents.set('single-agent', running)

    console.log(`\n  Agent address: ${running.xmtp.address}`)
    console.log(`  Test: https://xmtp.chat/dm/${running.xmtp.address}`)
    console.log(`\n  Listening for messages... (Ctrl+C to stop)\n`)

    // Graceful shutdown
    process.on('SIGINT', () => void shutdown())
    process.on('SIGTERM', () => void shutdown())
  } else {
    logger.error(
      '[eliza] No agent credentials configured. Set one of:\n' +
      '  1. XMTP_AGENT_CSW_ADDRESS + XMTP_AGENT_PRIVY_WALLET_ID (CSW mode — recommended)\n' +
      '  2. XMTP_AGENT_PRIVATE_KEY (EOA mode — dev/testing)\n' +
      '  3. XMTP_AGENT_KEY_ENCRYPTION_KEY + DATABASE_URL (multi-agent mode)',
    )
    process.exit(1)
  }

  agentBooted = true
  logger.info('[eliza] Runtime ready. Press Ctrl+C to stop.')
}

// ---------------------------------------------------------------------------
// Health check HTTP server
// ---------------------------------------------------------------------------
// Exposes GET /healthz on $PORT (default 8080) so Railway/Docker can verify
// the agent is alive. Returns 200 during boot ("booting") and after agents
// start ("ok"). Only returns 503 if the process is up but agents crashed.
function startHealthServer() {
  const port = Number(process.env.PORT ?? '8080') || 8080
  const server = http.createServer((_req, res) => {
    const url = (_req.url ?? '/').split('?')[0]
    if (url === '/healthz') {
      const agentCount = runningAgents.size
      if (!agentBooted) {
        // Still booting — tell Railway we're alive so it doesn't kill us
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'booting', agents: 0 }))
      } else if (agentCount > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', agents: agentCount }))
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'no_agents', agents: 0 }))
      }
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  server.listen(port, () => {
    logger.info(`[eliza] Health check server listening on :${port}/healthz`)
  })
}

void main().catch((err) => {
  console.error('[eliza] Fatal error:', err instanceof Error ? err.message : err)
  if (err instanceof Error && err.stack) console.error(err.stack)
  process.exit(1)
})
