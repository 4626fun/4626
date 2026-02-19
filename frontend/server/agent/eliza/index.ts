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
 *      XMTP_AGENT_CSW_OWNER_INDEX      — Optional owner index hint in CSW's MultiOwnable list
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
import { knowledgePlugin } from './plugins/knowledge/index.js'
import { creatorVaultCharacter, resolveCharacterRuntimeConfig } from './character.js'
import { XmtpService } from './plugins/xmtp/service.js'
import { createRuntimeBridge } from './runtimeBridge.js'
import { getElizaLlmService } from './llm.js'
import { AgentError, isRetryableAgentError, toAgentError, toErrorDetails } from './_errors.js'
import { SlidingWindowRateLimiter, parsePositiveNumber } from './_rateLimit.js'
import { enqueueAgentBackgroundTask, startAgentBackgroundTaskWorker } from './_taskQueue.js'

import { getDb, getDbInitError, isDbConfigured } from '../../_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../_lib/privyXmtpSigner.js'
import { buildAgentRegistration } from '../../_lib/agentRegistration.js'
import { publishAgentRegistrationToGrove } from '../../_lib/agentRegistrationPublisher.js'
import { createCorrelationLogger, logger } from '../../_lib/logger.js'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { resolveXmtpDbDirectory } from '../../_lib/xmtpDbDirectory.js'

declare const process: {
  env: Record<string, string | undefined>
  on: (event: string, cb: (...args: any[]) => void) => void
  exit: (code?: number) => void
  cwd: () => string
  stdout: {
    write: (chunk: any, encoding?: any, cb?: any) => boolean
  }
  stderr: {
    write: (chunk: any, encoding?: any, cb?: any) => boolean
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const POLL_INTERVAL_MS = 60_000
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '50')
const ACTION_TIMEOUT_MS = Math.floor(parsePositiveNumber(process.env.ELIZA_ACTION_TIMEOUT_MS, 30_000))
const ACTION_MAX_CANDIDATES = Math.floor(parsePositiveNumber(process.env.ELIZA_ACTION_MAX_CANDIDATES, 2))
const ACTION_MAX_RETRIES = Math.floor(parsePositiveNumber(process.env.ELIZA_ACTION_MAX_RETRIES, 2))
const EXTERNAL_RETRY_BASE_MS = Math.floor(parsePositiveNumber(process.env.ELIZA_EXTERNAL_RETRY_BASE_MS, 750))
const EXTERNAL_MAX_RETRIES = Math.floor(parsePositiveNumber(process.env.ELIZA_EXTERNAL_MAX_RETRIES, 2))
const INBOUND_RATE_WINDOW_MS = Math.floor(parsePositiveNumber(process.env.ELIZA_RATE_LIMIT_WINDOW_MS, 60_000))
const INBOUND_RATE_MAX_MESSAGES = Math.floor(parsePositiveNumber(process.env.ELIZA_RATE_LIMIT_MAX_MESSAGES, 12))
const MAX_INBOUND_MESSAGE_CHARS = Math.floor(parsePositiveNumber(process.env.ELIZA_MAX_INBOUND_CHARS, 4_000))
const STARTUP_DB_MAX_RETRIES = Math.floor(parsePositiveNumber(process.env.ELIZA_STARTUP_DB_MAX_RETRIES, 4))
const STARTUP_DB_RETRY_BASE_MS = Math.floor(parsePositiveNumber(process.env.ELIZA_STARTUP_DB_RETRY_BASE_MS, 1_000))

const llmService = getElizaLlmService()
const inboundRateLimiter = new SlidingWindowRateLimiter(INBOUND_RATE_WINDOW_MS, INBOUND_RATE_MAX_MESSAGES)
const runtimeStartedAtMs = Date.now()
const characterRuntimeConfig = resolveCharacterRuntimeConfig()

/**
 * Directory where XMTP local databases are persisted.
 * Defaults to `<cwd>/.xmtp-data/` — override with XMTP_DB_DIRECTORY.
 */
const XMTP_DB_DIR = resolveXmtpDbDirectory()

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
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED = (() => {
  const raw = (process.env.XMTP_DB_FORCE_ENCRYPTED_MIGRATION ?? '0').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
})()
const XMTP_DB_PLAINTEXT_ONLY = (() => {
  const raw = (process.env.XMTP_DB_PLAINTEXT_ONLY ?? '0').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
})()
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM = (process.env.XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM ?? '').trim().toLowerCase()
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION =
  XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED &&
  XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM === 'rotate-db'
const ELIZA_GROVE_UPLOAD_MODE = (() => {
  const raw = (process.env.ELIZA_GROVE_UPLOAD_MODE ?? 'on-change').trim().toLowerCase()
  if (raw === 'off' || raw === 'disabled' || raw === 'false' || raw === '0') return 'off' as const
  if (raw === 'always' || raw === 'force') return 'always' as const
  return 'on-change' as const
})()

const SQLITE_HEADER = Buffer.from('SQLite format 3\u0000', 'utf8')
let legacyPlaintextCompatibilityLogged = false

function fileLooksLikePlainSqlite(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false
    const fd = fs.openSync(filePath, 'r')
    try {
      const header = Buffer.alloc(SQLITE_HEADER.length)
      const bytesRead = fs.readSync(fd, header, 0, header.length, 0)
      if (bytesRead !== SQLITE_HEADER.length) return false
      return header.equals(SQLITE_HEADER)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

function hasLegacyPlaintextDbInDir(): boolean {
  try {
    const files = fs.readdirSync(XMTP_DB_DIR).filter((f: string) => f.endsWith('.db3'))
    for (const f of files) {
      const p = path.join(XMTP_DB_DIR, f)
      if (fileLooksLikePlainSqlite(p)) return true
    }
    return false
  } catch {
    return false
  }
}

function hasLegacyMigrationBackupsInDir(): boolean {
  try {
    const files = fs.readdirSync(XMTP_DB_DIR)
    return files.some((f: string) => f.includes('.legacy-unencrypted.'))
  } catch {
    return false
  }
}

function hasLegacyMigrationBackupForFile(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath)
    const base = path.basename(filePath)
    const prefix = `${base}.legacy-unencrypted.`
    return fs.readdirSync(dir).some((f: string) => f.startsWith(prefix))
  } catch {
    return false
  }
}

function logLegacyPlaintextCompatibility(): void {
  if (legacyPlaintextCompatibilityLogged) return
  legacyPlaintextCompatibilityLogged = true
  logger.info(
    '[xmtp] Legacy plaintext DB detected; compatibility mode is active and existing installation will be reused.',
  )
}

function getEffectiveDbEncryptionKey(): `0x${string}` | undefined {
  if (XMTP_DB_PLAINTEXT_ONLY) return undefined
  if (!XMTP_DB_ENCRYPTION_KEY) return undefined
  if (
    XMTP_DB_FORCE_ENCRYPTED_MIGRATION &&
    hasLegacyPlaintextDbInDir() &&
    hasLegacyMigrationBackupsInDir()
  ) {
    const message =
      '[xmtp] Refusing startup: forced encrypted migration was already attempted but plaintext DB(s) still remain. ' +
      'This usually means SQLCipher encryption is unavailable in this runtime, and retrying would churn installations. ' +
      'Disable forced migration (XMTP_DB_FORCE_ENCRYPTED_MIGRATION=0) to reuse the existing DB.'
    logger.error(message)
    throw new Error(message)
  }
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION && hasLegacyPlaintextDbInDir()) {
    logLegacyPlaintextCompatibility()
    return undefined
  }
  return XMTP_DB_ENCRYPTION_KEY
}

/**
 * If an old plaintext SQLite DB is present while encryption is enabled,
 * rotate it aside so XMTP can create a fresh encrypted DB.
 */
function rotateLegacyPlaintextDbIfNeeded(filePath: string): void {
  if (!XMTP_DB_ENCRYPTION_KEY) return
  if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION) return
  if (!fileLooksLikePlainSqlite(filePath)) return
  if (hasLegacyMigrationBackupForFile(filePath)) {
    const message =
      `[xmtp] Refusing startup: forced migration was already attempted for ${filePath} but a plaintext DB still exists. ` +
      'This indicates encryption attach likely failed previously, and retrying would create another installation.'
    logger.error(message)
    throw new Error(message)
  }
  const backupPath = `${filePath}.legacy-unencrypted.${Date.now()}`
  try {
    fs.renameSync(filePath, backupPath)
    logger.warn(
      `[xmtp] Legacy unencrypted DB detected at ${filePath}; moved to ${backupPath}. ` +
      'A fresh encrypted XMTP DB will be created for this installation.',
    )
  } catch (err) {
    logger.warn('[xmtp] Failed rotating legacy unencrypted DB (continuing):', err)
  }
}

/**
 * Build a stable `dbPath` function for the XMTP SDK.
 * Ensures the directory exists and returns a deterministic path
 * per inboxId so the same installation is reused across restarts.
 */
function makeDbPath(): (inboxId: string) => string {
  fs.mkdirSync(XMTP_DB_DIR, { recursive: true, mode: 0o700 })
  return (inboxId: string) => {
    const p = path.join(XMTP_DB_DIR, `xmtp-${XMTP_ENV}-${inboxId}.db3`)
    rotateLegacyPlaintextDbIfNeeded(p)
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
    } else if (XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED && !XMTP_DB_FORCE_ENCRYPTED_MIGRATION) {
      logger.warn(
        '[xmtp] Forced encrypted migration requested but NOT confirmed.\n' +
        '    To run migration intentionally, set XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM=rotate-db.\n' +
        '    Running in compatibility mode to avoid accidental installation churn.',
      )
    } else if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION && hasLegacyPlaintextDbInDir()) {
      logLegacyPlaintextCompatibility()
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

const plugins = [keeprPlugin, zoraPlugin, lensPlugin, walletIntelPlugin, reputationPlugin, crePlugin, knowledgePlugin]
const allActions = plugins.flatMap((p) => p.actions ?? [])

export { keeprPlugin, zoraPlugin, lensPlugin, walletIntelPlugin, reputationPlugin, crePlugin, knowledgePlugin }

// ---------------------------------------------------------------------------
// LLM providers (for /ai fallback)
// ---------------------------------------------------------------------------

function resolveProvider(): { name: string; model: string } | null {
  const [provider] = llmService.getAvailableProviders()
  if (!provider) return null
  return { name: provider.name, model: provider.model }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new AgentError('UPSTREAM_TIMEOUT', timeoutMessage, { retryable: true })), timeoutMs)
    }),
  ])
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(params: {
  operation: string
  maxRetries?: number
  baseDelayMs?: number
  run: () => Promise<T>
  correlationId?: string
}): Promise<T> {
  const maxRetries = Math.max(0, params.maxRetries ?? EXTERNAL_MAX_RETRIES)
  const baseDelayMs = Math.max(50, params.baseDelayMs ?? EXTERNAL_RETRY_BASE_MS)
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await params.run()
    } catch (error) {
      lastError = error
      const asAgentError = toAgentError(error, 'UPSTREAM_ERROR', `${params.operation}_failed`)
      const retryable =
        isRetryableAgentError(asAgentError) ||
        asAgentError.code === 'UPSTREAM_TIMEOUT' ||
        asAgentError.code === 'UPSTREAM_ERROR' ||
        asAgentError.code === 'DEPENDENCY_UNAVAILABLE'
      if (!retryable || attempt >= maxRetries) break
      const waitMs = baseDelayMs * Math.pow(2, attempt)
      logger.warn('[eliza] retrying operation after failure', {
        operation: params.operation,
        attempt: attempt + 1,
        waitMs,
        correlationId: params.correlationId ?? null,
        error: asAgentError.message,
        code: asAgentError.code,
      })
      await sleep(waitMs)
    }
  }

  throw toAgentError(lastError, 'UPSTREAM_ERROR', `${params.operation}_failed_after_retries`)
}

// ---------------------------------------------------------------------------
// Welcome message for first-time conversations
// ---------------------------------------------------------------------------

const welcomedConversations = new Set<string>()

const WELCOME_MESSAGE = [
  `o henlo! I'm Keepr, your CreatorVault assistant.`,
  ``,
  `Start with one of these:`,
  ``,
  `• /help — see all commands`,
  `• /keepr status — check this vault`,
  `• /ai <question> — ask anything in plain English`,
].join('\n')

type EnvValidationResult = {
  errors: string[]
  warnings: string[]
}

let latestEnvValidation: EnvValidationResult = { errors: [], warnings: [] }
let backgroundWorker: { stop: () => void } | null = null
let queueEnabled = false
let dbRequiredForRuntime = false
let stderrNoiseFilterInstalled = false

function wrapWriteWithNoiseFilter(write: (chunk: any, encoding?: any, cb?: any) => boolean) {
  const ignoredPatterns = [
    /sqlcipherCodecAttach:\s*no codec attached to db/i,
    /^\[WARNING\]\s+You have "\d+"\s+installations\./i,
  ]
  return ((chunk: any, encoding?: any, cb?: any) => {
    const text =
      typeof chunk === 'string'
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString('utf8')
          : String(chunk ?? '')
    if (ignoredPatterns.some((pattern) => pattern.test(text.trim()))) {
      if (typeof cb === 'function') cb()
      return true
    }
    return write(chunk, encoding, cb)
  }) as typeof write
}

function installStderrNoiseFilter(): void {
  if (stderrNoiseFilterInstalled) return
  const raw = String(process.env.XMTP_SUPPRESS_LOG_NOISE ?? '1').trim().toLowerCase()
  const enabled = !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
  if (!enabled) return
  stderrNoiseFilterInstalled = true
  process.stderr.write = wrapWriteWithNoiseFilter(process.stderr.write.bind(process.stderr))
  process.stdout.write = wrapWriteWithNoiseFilter(process.stdout.write.bind(process.stdout))
}

function validateStartupEnv(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const hasDb = isDbConfigured()
  const hasEncKey = !!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  const hasPrivateKey = !!(process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim()
  const hasCswAddress = !!(process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim()
  const hasCswPrivyWallet = !!(process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim()
  const hasCswConfig = hasCswAddress && hasCswPrivyWallet
  const multiAgentConfigured = hasDb && hasEncKey

  if (!multiAgentConfigured && !hasPrivateKey && !hasCswConfig) {
    errors.push(
      'No startup mode is fully configured. Set multi-agent, CSW, or EOA credentials before boot.',
    )
  }

  if (hasDb && !hasEncKey && !hasPrivateKey && !hasCswConfig) {
    errors.push('XMTP_AGENT_KEY_ENCRYPTION_KEY is required for multi-agent DB mode.')
  } else if (hasDb && !hasEncKey && !hasCswConfig) {
    warnings.push('DATABASE_URL/POSTGRES_URL is set but XMTP_AGENT_KEY_ENCRYPTION_KEY is missing; multi-agent mode is disabled.')
  }

  if (hasEncKey && !hasDb) {
    warnings.push('XMTP_AGENT_KEY_ENCRYPTION_KEY is set but no Postgres connection is configured; multi-agent mode is disabled.')
  }

  if (hasPrivateKey && hasCswConfig) {
    warnings.push('Both CSW and EOA credentials are configured. CSW mode will take priority.')
  }

  if (!['production', 'dev', 'local'].includes(XMTP_ENV)) {
    errors.push('XMTP_ENV must be one of: production, dev, local.')
  }

  if (!Number.isFinite(MAX_AGENTS) || MAX_AGENTS <= 0) {
    errors.push('MAX_AGENTS must be a positive number.')
  }

  if ((process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()) {
    const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
    const normalized = raw.startsWith('0x') ? raw.slice(2) : raw
    if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
      errors.push('XMTP_DB_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars, optional 0x prefix).')
    }
  } else {
    warnings.push('XMTP_DB_ENCRYPTION_KEY is not set. XMTP installation reuse may degrade across restarts.')
  }

  if (hasCswAddress && !hasCswPrivyWallet) {
    errors.push('XMTP_AGENT_PRIVY_WALLET_ID is required when XMTP_AGENT_CSW_ADDRESS is set.')
  }
  if (!hasCswAddress && hasCswPrivyWallet) {
    errors.push('XMTP_AGENT_CSW_ADDRESS is required when XMTP_AGENT_PRIVY_WALLET_ID is set.')
  }

  if (!llmService.getAvailableProviders().length) {
    warnings.push('No LLM provider API key configured; /ai fallback will be disabled.')
  }

  if (ACTION_MAX_CANDIDATES < 1) {
    errors.push('ELIZA_ACTION_MAX_CANDIDATES must be >= 1.')
  }
  if (ACTION_MAX_RETRIES < 0) {
    errors.push('ELIZA_ACTION_MAX_RETRIES must be >= 0.')
  }
  if (ACTION_TIMEOUT_MS < 5_000) {
    warnings.push('ELIZA_ACTION_TIMEOUT_MS is very low; long-running actions may fail prematurely.')
  }
  if (MAX_INBOUND_MESSAGE_CHARS < 200) {
    warnings.push('ELIZA_MAX_INBOUND_CHARS is very low; normal prompts may be rejected.')
  }

  return { errors, warnings }
}

function ensureBackgroundWorker(): void {
  if (backgroundWorker) return
  backgroundWorker = startAgentBackgroundTaskWorker({
    workerName: 'eliza',
    pollMs: Math.floor(parsePositiveNumber(process.env.ELIZA_TASK_WORKER_POLL_MS, 3_000)),
    maxTasksPerTick: Math.floor(parsePositiveNumber(process.env.ELIZA_TASK_WORKER_MAX_TASKS, 5)),
    handleTask: async (task) => {
      if (task.taskType === 'message_audit') {
        logger.debug('[eliza/queue] message_audit processed', {
          conversationId: String(task.payload.conversationId ?? ''),
          agentKey: String(task.payload.agentKey ?? ''),
        })
        return
      }
      if (task.taskType === 'knowledge_refresh') {
        logger.debug('[eliza/queue] knowledge_refresh processed', task.payload)
        return
      }
      logger.debug('[eliza/queue] unknown task type', {
        id: task.id,
        taskType: task.taskType,
      })
    },
  })
  queueEnabled = true
}

function initializeRuntimeBridge(agentKey: string): ReturnType<typeof createRuntimeBridge> {
  return createRuntimeBridge({
    agentKey,
    plugins,
    settings: {
      ...characterRuntimeConfig.settings,
    },
    character: {
      systemPrompt: characterRuntimeConfig.systemPrompt,
      preferredModel: characterRuntimeConfig.preferredModel,
    },
  })
}

// ---------------------------------------------------------------------------
// Message router (ElizaOS plugin pipeline)
// ---------------------------------------------------------------------------

async function handleMessage(
  msg: {
    conversationId: string
    conversationType: string
    senderAddress: string | null
    content: string
  },
  ctx: {
    agentKey: string
    runtimeBridge: ReturnType<typeof createRuntimeBridge>
  },
): Promise<string | null> {
  const text = msg.content.trim()
  if (!text) return null

  if (text.length > MAX_INBOUND_MESSAGE_CHARS) {
    return `Message too long (${text.length} chars). Max supported length is ${MAX_INBOUND_MESSAGE_CHARS}.`
  }

  const { correlationId, logger: reqLogger } = createCorrelationLogger('msg', {
    agentKey: ctx.agentKey,
    conversationId: msg.conversationId,
  })
  const rateKey = `${msg.conversationId}:${(msg.senderAddress ?? 'unknown').toLowerCase()}`
  const rate = inboundRateLimiter.allow(rateKey)
  if (!rate.allowed) {
    reqLogger.warn('[eliza] inbound rate limited', {
      retryAfterMs: rate.retryAfterMs,
    })
    return `Rate limit reached. Try again in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
  }

  const memory = ctx.runtimeBridge.createInboundMemory(msg)
  await ctx.runtimeBridge.runtime.createMemory(memory as any, 'messages' as any)
  const state = await ctx.runtimeBridge.composeState(memory)

  if (queueEnabled) {
    void enqueueAgentBackgroundTask({
      taskType: 'message_audit',
      payload: {
        correlationId,
        agentKey: ctx.agentKey,
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
      },
    })
  }

  // Welcome message on first interaction in a conversation.
  // If the user sends a substantive first question, continue to normal
  // routing so they get an actual answer immediately.
  if (!welcomedConversations.has(msg.conversationId)) {
    welcomedConversations.add(msg.conversationId)
    const welcomeMemory = ctx.runtimeBridge.createOutboundMemory(
      msg.conversationId,
      msg.conversationType,
      WELCOME_MESSAGE,
    )
    await ctx.runtimeBridge.runtime.createMemory(welcomeMemory as any, 'messages' as any)
    const isGreetingOnly = /^(hi|hello|hey|gm|good morning|help|\/help)$/i.test(text)
    if (isGreetingOnly) {
      return WELCOME_MESSAGE
    }
  }

  const rankedActions = await ctx.runtimeBridge.rankActions(text, memory)
  const maxCandidates = Math.max(1, ACTION_MAX_CANDIDATES)
  const candidates = rankedActions.slice(0, maxCandidates)
  for (const candidate of candidates) {
    const parts: string[] = []
    try {
      await withRetry({
        operation: `action_${String(candidate.action?.name ?? 'unknown').toLowerCase()}`,
        maxRetries: ACTION_MAX_RETRIES,
        correlationId,
        run: async () =>
          withTimeout(
            candidate.action.handler(
              ctx.runtimeBridge.runtime as any,
              memory as any,
              state as any,
              undefined,
              async (content: any) => {
                if (content?.text) parts.push(String(content.text))
                return []
              },
            ),
            ACTION_TIMEOUT_MS,
            `action_timeout_${String(candidate.action?.name ?? 'unknown').toLowerCase()}`,
          ),
      })
      const actionReply = parts.join('\n\n').trim()
      if (actionReply) {
        const actionMemory = ctx.runtimeBridge.createOutboundMemory(
          msg.conversationId,
          msg.conversationType,
          actionReply,
        )
        await ctx.runtimeBridge.runtime.createMemory(actionMemory as any, 'messages' as any)
        reqLogger.info('[eliza] action executed', {
          action: String(candidate.action?.name ?? 'unknown'),
          score: candidate.score,
          reason: candidate.reason,
        })
        return actionReply
      }
    } catch (error) {
      const agentError = toAgentError(error, 'ACTION_FAILED', 'Action execution failed')
      reqLogger.warn('[eliza] action candidate failed', {
        action: String(candidate.action?.name ?? 'unknown'),
        score: candidate.score,
        reason: candidate.reason,
        error: agentError.message,
        code: agentError.code,
      })
    }
  }

  // LLM fallback for /ai, @keepr, @bot, and plain text.
  // Keep slash-prefixed commands command-only to avoid accidental
  // hallucinated command handling by the LLM.
  const lower = text.toLowerCase()
  const isAi =
    lower.startsWith('/ai') ||
    lower.startsWith('@keepr') ||
    lower.startsWith('@bot') ||
    !text.startsWith('/')
  if (!isAi) return null

  const cleanText = text
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()
  if (!cleanText) return 'Ask me anything about this vault or DeFi on Base.'

  let vaultContext = ''
  const contextProviders = [...(keeprPlugin.providers ?? []), ...(knowledgePlugin.providers ?? [])]
  for (const provider of contextProviders) {
    try {
      const result = await withRetry({
        operation: `context_provider_${String(provider.name ?? 'unknown').toLowerCase()}`,
        maxRetries: EXTERNAL_MAX_RETRIES,
        correlationId,
        run: async () =>
          withTimeout(
            provider.get(ctx.runtimeBridge.runtime as any, memory as any, state as any),
            5_000,
            `context_provider_timeout_${String(provider.name ?? 'unknown').toLowerCase()}`,
          ),
      })
      if (result?.text) vaultContext += `${String(result.text).trim()}\n`
    } catch (error) {
      reqLogger.warn('[eliza] context provider failed', {
        provider: String(provider.name ?? 'unknown'),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    const llm = await withRetry({
      operation: 'llm_generate_response',
      maxRetries: EXTERNAL_MAX_RETRIES,
      correlationId,
      run: async () => llmService.generateResponse({
        agentKey: ctx.agentKey,
        userMessage: cleanText,
        systemPrompt: characterRuntimeConfig.systemPrompt,
        vaultContext,
        correlationId,
        preferredModel: characterRuntimeConfig.preferredModel,
      }),
    })
    const reply = llm.text ?? "I couldn't generate a response right now. Try again later."
    const outbound = ctx.runtimeBridge.createOutboundMemory(
      msg.conversationId,
      msg.conversationType,
      reply,
    )
    await ctx.runtimeBridge.runtime.createMemory(outbound as any, 'messages' as any)
    return reply
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM fallback failed')
    reqLogger.error('[eliza] llm fallback failed', {
      error: agentError.message,
      code: agentError.code,
      details: toErrorDetails(agentError),
    })
    if (agentError.code === 'BUDGET_EXCEEDED') {
      return 'Daily AI budget limit reached for this agent. Please try again tomorrow.'
    }
    return "I couldn't generate a response right now. Try again later."
  }
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
  runtimeBridge: ReturnType<typeof createRuntimeBridge>
}

async function loadAgentRows(): Promise<AgentRow[]> {
  return withRetry({
    operation: 'load_agent_rows',
    maxRetries: STARTUP_DB_MAX_RETRIES,
    baseDelayMs: STARTUP_DB_RETRY_BASE_MS,
    run: async () => {
      if (!isDbConfigured()) {
        throw new AgentError('DEPENDENCY_UNAVAILABLE', 'Database not configured', { retryable: true })
      }
      const db = await getDb()
      if (!db) {
        throw new AgentError('DEPENDENCY_UNAVAILABLE', 'Database connection failed', { retryable: true })
      }
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
    },
  })
}

// ---------------------------------------------------------------------------
// Agent lifecycle
// ---------------------------------------------------------------------------

async function startAgent(row: AgentRow): Promise<RunningAgent> {
  const dbEncryptionKey = getEffectiveDbEncryptionKey()
  const runtimeBridge = initializeRuntimeBridge(row.creatorAddress)
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
      ? { privateKey: signer.privateKey, env: XMTP_ENV, dbPath: makeDbPath(), dbEncryptionKey, revokeOtherInstallations: XMTP_REVOKE_OTHER }
      : { signer, env: XMTP_ENV, dbPath: makeDbPath(), dbEncryptionKey, revokeOtherInstallations: XMTP_REVOKE_OTHER },
  )

  // Wire message handler through the ElizaOS plugin pipeline
  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:${row.creatorAddress.slice(0, 10)}] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
      },
      {
        agentKey: row.creatorAddress,
        runtimeBridge,
      },
    )
  })

  await withRetry({
    operation: 'xmtp_start_agent',
    maxRetries: EXTERNAL_MAX_RETRIES,
    run: async () => {
      await xmtp.start()
    },
  })

  logger.info(`[eliza] Started agent for creator ${row.creatorAddress}`, {
    agentAddress: xmtp.address,
    agentType: row.agentType,
  })

  return { creatorAddress: row.creatorAddress, xmtp, runtimeBridge }
}

// ---------------------------------------------------------------------------
// Multi-agent orchestrator
// ---------------------------------------------------------------------------

const runningAgents = new Map<string, RunningAgent>()
let shuttingDown = false

async function syncAgents() {
  if (shuttingDown) return

  const { correlationId, logger: syncLogger } = createCorrelationLogger('sync')
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
        syncLogger.error(`[eliza] Failed to start agent for ${row.creatorAddress}`, {
          correlationId,
          error: toErrorDetails(err),
        })
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

    syncLogger.info(`[eliza] Sync complete — ${runningAgents.size} agents running`, {
      correlationId,
    })
  } catch (err) {
    syncLogger.error('[eliza] Sync error', {
      correlationId,
      error: toErrorDetails(err),
    })
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

  if (backgroundWorker) {
    try {
      backgroundWorker.stop()
    } catch {}
    backgroundWorker = null
  }

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
  const dbEncryptionKey = getEffectiveDbEncryptionKey()
  const runtimeBridge = initializeRuntimeBridge('single-agent')
  const xmtp = new XmtpService({
    privateKey,
    env: XMTP_ENV,
    dbPath: makeDbPath(),
    dbEncryptionKey,
    revokeOtherInstallations: XMTP_REVOKE_OTHER,
  })

  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:single] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
      },
      {
        agentKey: 'single-agent',
        runtimeBridge,
      },
    )
  })

  await withRetry({
    operation: 'xmtp_start_single_eoa',
    maxRetries: EXTERNAL_MAX_RETRIES,
    run: async () => {
      await xmtp.start()
    },
  })

  logger.info(`[eliza] Single EOA agent started`, { agentAddress: xmtp.address })

  return { creatorAddress: 'single-agent', xmtp, runtimeBridge }
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
  const dbEncryptionKey = getEffectiveDbEncryptionKey()
  const runtimeBridge = initializeRuntimeBridge('single-agent-csw')
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
    dbEncryptionKey,
    revokeOtherInstallations: XMTP_REVOKE_OTHER,
  })

  xmtp.setMessageHandler(async (msg) => {
    logger.info(
      `[eliza:csw] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
      },
      {
        agentKey: 'single-agent-csw',
        runtimeBridge,
      },
    )
  })

  await withRetry({
    operation: 'xmtp_start_single_csw',
    maxRetries: EXTERNAL_MAX_RETRIES,
    run: async () => {
      await xmtp.start()
    },
  })

  logger.info(`[eliza] Single CSW agent started`, {
    agentAddress: xmtp.address,
    cswAddress: params.cswAddress,
    privyWalletId: params.privyWalletId.slice(0, 12) + '...',
  })

  return { creatorAddress: 'single-agent-csw', xmtp, runtimeBridge }
}

// ---------------------------------------------------------------------------
// Grove registration upload (fire-and-forget on startup)
// ---------------------------------------------------------------------------

async function uploadRegistrationToGrove(): Promise<void> {
  const { correlationId, logger: regLogger } = createCorrelationLogger('grove')
  try {
    if (ELIZA_GROVE_UPLOAD_MODE === 'off') {
      regLogger.info('[eliza] Skipping Grove registration upload (disabled by mode)', {
        mode: ELIZA_GROVE_UPLOAD_MODE,
        correlationId,
      })
      return
    }

    const origin = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()
    const { payload, error } = buildAgentRegistration(origin)
    if (error || !payload) {
      regLogger.warn('[eliza] Skipping Grove registration upload', { error, correlationId })
      return
    }

    const cswAddress = String(process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim().toLowerCase()
    const isCswAddress = /^0x[a-f0-9]{40}$/.test(cswAddress)
    const agentKey = isCswAddress ? `single-csw:${cswAddress}` : 'single-agent'
    const publish = await withRetry({
      operation: 'grove_registration_upload',
      maxRetries: EXTERNAL_MAX_RETRIES,
      correlationId,
      run: async () =>
        publishAgentRegistrationToGrove({
          payload,
          agentKey,
          mode: ELIZA_GROVE_UPLOAD_MODE,
        }),
    })

    if (publish.ok && publish.status === 'reused') {
      regLogger.info('[eliza] Agent registration unchanged; reusing previous Grove URI', {
        lensUri: publish.lensUri,
        gatewayUrl: publish.gatewayUrl,
        payloadHash: publish.payloadHash,
        mode: publish.mode,
        pipeline: publish.pipeline,
        correlationId,
      })
      return
    }

    if (publish.ok) {
      regLogger.info('[eliza] Agent registration uploaded to Grove', {
        lensUri: publish.lensUri,
        gatewayUrl: publish.gatewayUrl,
        storageKey: publish.storageKey,
        payloadHash: publish.payloadHash,
        mode: publish.mode,
        pipeline: publish.pipeline,
        correlationId,
      })
    } else {
      regLogger.warn('[eliza] Grove registration upload failed (non-blocking)', {
        error: publish.error ?? 'upload_unavailable',
        payloadHash: publish.payloadHash,
        mode: publish.mode,
        pipeline: publish.pipeline,
        correlationId,
      })
    }
  } catch (err) {
    regLogger.warn('[eliza] Grove registration upload error (non-blocking)', {
      correlationId,
      error: toErrorDetails(err),
    })
  }
}

let agentBooted = false

async function main() {
  // Suppress known non-fatal native/runtime noise that causes alert fatigue.
  installStderrNoiseFilter()

  // Start health check server FIRST so Railway healthcheck passes during boot
  startHealthServer()

  latestEnvValidation = validateStartupEnv()
  if (latestEnvValidation.warnings.length > 0) {
    for (const warning of latestEnvValidation.warnings) {
      logger.warn('[eliza] startup warning', { warning })
    }
  }
  if (latestEnvValidation.errors.length > 0) {
    for (const error of latestEnvValidation.errors) {
      logger.error('[eliza] startup validation error', { error })
    }
    process.exit(1)
    return
  }

  const hasDb = isDbConfigured()
  const hasEncKey = !!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  const hasPrivateKey = !!(process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim()
  const hasCswConfig = !!(process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim() &&
    !!(process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim()
  const multiAgentMode = hasDb && hasEncKey
  dbRequiredForRuntime = multiAgentMode

  if (multiAgentMode) {
    const dbReady = await withRetry({
      operation: 'startup_db_connectivity_check',
      maxRetries: STARTUP_DB_MAX_RETRIES,
      baseDelayMs: STARTUP_DB_RETRY_BASE_MS,
      run: async () => {
        const db = await getDb()
        if (!db) {
          throw new AgentError('DEPENDENCY_UNAVAILABLE', 'Database connection failed during startup', {
            retryable: true,
          })
        }
        return true
      },
    }).catch((error) => {
      logger.error('[eliza] startup DB readiness check failed', {
        error: toErrorDetails(error),
      })
      return false
    })
    if (!dbReady) {
      process.exit(1)
      return
    }
  }

  if (multiAgentMode) {
    ensureBackgroundWorker()
    void enqueueAgentBackgroundTask({
      taskType: 'knowledge_refresh',
      payload: { reason: 'startup' },
      priority: 1,
    })
  } else {
    queueEnabled = false
    if (hasDb) {
      if (hasCswConfig || hasPrivateKey) {
        logger.info(
          '[eliza] DB is configured; single-agent mode is active and background DB queue is intentionally disabled.',
        )
      } else {
        logger.warn(
          '[eliza] DB is configured but runtime is in single-agent mode; background DB queue is disabled.',
        )
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CreatorVault ElizaOS Agent (Unified)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Check DB persistence before creating any agent
  checkDbPersistence()

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
  console.log(
    `  LLM provider: ${llmProvider?.name ?? 'none (conversational AI disabled)'}${
      llmProvider?.model ? ` (${llmProvider.model})` : ''
    }`,
  )
  console.log(`  XMTP env: ${XMTP_ENV}`)
  console.log(`  Character: ${creatorVaultCharacter.name}`)
  console.log(`  Character model policy: ${characterRuntimeConfig.preferredModel ?? 'provider-default'}`)
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
    console.log(
      `  Owner index: ${
        ownerIndex !== undefined
          ? `${ownerIndex} (configured hint; validated/corrected at runtime)`
          : '(auto-detect at runtime)'
      }`,
    )

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
  const server = http.createServer(async (_req, res) => {
    const url = (_req.url ?? '/').split('?')[0]
    if (url !== '/healthz' && url !== '/readyz') {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const agentCount = runningAgents.size
    const dbConfigured = isDbConfigured()
    const shouldCheckDb = dbRequiredForRuntime && dbConfigured
    const dbInitError = shouldCheckDb ? getDbInitError() : null
    const db = shouldCheckDb ? await getDb() : null
    const llmHealth = llmService.getHealth()
    const xmtpStates = [...runningAgents.values()].map((agent) => ({
      creatorAddress: agent.creatorAddress,
      running: agent.xmtp.isRunning,
      address: agent.xmtp.address ?? null,
    }))
    const xmtpReady = xmtpStates.every((entry) => entry.running)
    const readinessReasons: string[] = []
    if (!agentBooted) readinessReasons.push('booting')
    if (agentCount === 0) readinessReasons.push('no_agents')
    if (latestEnvValidation.errors.length > 0) readinessReasons.push('env_validation_failed')
    if (shouldCheckDb && db === null) readinessReasons.push('db_unavailable')
    if (!xmtpReady) readinessReasons.push('xmtp_not_running')
    const ready = Boolean(
      agentBooted &&
      agentCount > 0 &&
      latestEnvValidation.errors.length === 0 &&
      (shouldCheckDb ? db !== null : true) &&
      xmtpReady,
    )
    const status =
      !agentBooted
        ? 'booting'
        : ready
          ? 'ok'
          : agentCount === 0
            ? 'no_agents'
            : 'degraded'
    const payload = {
      status,
      uptimeMs: Date.now() - runtimeStartedAtMs,
      agents: agentCount,
      readinessReasons,
      dependencies: {
        db: {
          configured: dbConfigured,
          required: shouldCheckDb,
          connected: shouldCheckDb ? db !== null : null,
          initError: dbInitError,
        },
        llm: llmHealth,
        xmtp: {
          ready: xmtpReady,
          runningAgents: xmtpStates.filter((entry) => entry.running).length,
          states: xmtpStates,
        },
        queueWorker: {
          running: Boolean(backgroundWorker),
        },
      },
      validation: latestEnvValidation,
    }

    const statusCode = url === '/readyz'
      ? (ready ? 200 : 503)
      : (!agentBooted || ready ? 200 : 503)
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  })
  server.listen(port, () => {
    logger.info(`[eliza] Health check server listening on :${port}/healthz`)
  })
}

void main().catch((err) => {
  logger.error('[eliza] Fatal error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
