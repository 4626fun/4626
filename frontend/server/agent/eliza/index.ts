/**
 * 4626 ElizaOS Agent — Unified Multi-Agent Runtime
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
import { uniswapPlugin } from './plugins/uniswap/index.js'
import { knowledgePlugin } from './plugins/knowledge/index.js'
import { bankrPlugin } from './plugins/bankr/index.js'
import { telegramPlugin } from './plugins/telegram/index.js'
import { discordPlugin } from './plugins/discord/index.js'
import { twitterPlugin } from './plugins/twitter/index.js'
import { creatorVaultCharacter, resolveCharacterRuntimeConfig } from './character.js'
import { keeprTraderCharacter } from './characters/keepr-trader.character.js'
import { keeprSocialCharacter } from './characters/keepr-social.character.js'
import { XmtpService } from './plugins/xmtp/service.js'
import { createRuntimeBridge } from './runtimeBridge.js'
import { getElizaLlmService } from './llm.js'
import { AgentError, isRetryableAgentError, toAgentError, toErrorDetails } from './_errors.js'
import { withRetry, withTimeout, sleep } from './_retry.js'
import { SlidingWindowRateLimiter, parsePositiveNumber } from './_rateLimit.js'
import { enqueueAgentBackgroundTask, getAgentBackgroundQueueStats, startAgentBackgroundTaskWorker } from './_taskQueue.js'
import { WelcomeConversationTracker, fingerprintAgentConfig, getActionRetryBudget } from './_runtimePolicy.js'
import { getHealthProbeStatusCode } from './_healthStatus.js'
import { handleXmtpFallbackResponse } from './_xmtpFallback.js'

import { getDb, getDbInitError, isDbConfigured } from '../../_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../_lib/privyXmtpSigner.js'
import { buildAgentRegistration } from '../../_lib/agentRegistration.js'
import { publishAgentRegistrationToGrove } from '../../_lib/agentRegistrationPublisher.js'
import { formatWelcomeNumberedOptions } from '../../_lib/chatCommandFallback.js'
import { createCorrelationLogger, logger } from '../../_lib/logger.js'
import { emitTelemetryEvent } from '../../_lib/telemetry.js'
import {
  TARGET_CANONICAL_CSW_ADDRESS,
  isTargetCanonicalCsw,
  normalizePolicyAddress,
} from '../../../src/wallet/canonicalWalletPolicy.js'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { createHash } from 'node:crypto'
import {
  findMountedAncestorPath,
  hasDedicatedMount,
  listXmtpDb3FilesUnderRoot,
  resolveXmtpDbDirectory,
} from '../../_lib/xmtpDbDirectory.js'

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
const WELCOME_TRACKER_TTL_MS = Math.floor(parsePositiveNumber(process.env.ELIZA_WELCOME_TRACK_TTL_MS, 86_400_000))
const WELCOME_TRACKER_MAX = Math.floor(parsePositiveNumber(process.env.ELIZA_WELCOME_TRACK_MAX, 20_000))

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
const XMTP_DB_AUTO_ENCRYPTED_MIGRATION = parseEnvBoolean(
  process.env.XMTP_DB_AUTO_ENCRYPTED_MIGRATION,
  isRailwayRuntime(),
)
const XMTP_DB_FORCE_ENCRYPTED_MIGRATION =
  (XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED &&
    XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM === 'rotate-db') ||
  (XMTP_DB_AUTO_ENCRYPTED_MIGRATION && XMTP_DB_ENCRYPTION_KEY !== undefined)
const ELIZA_GROVE_UPLOAD_MODE = (() => {
  const raw = (process.env.ELIZA_GROVE_UPLOAD_MODE ?? 'on-change').trim().toLowerCase()
  if (raw === 'off' || raw === 'disabled' || raw === 'false' || raw === '0') return 'off' as const
  if (raw === 'always' || raw === 'force') return 'always' as const
  return 'on-change' as const
})()

const SQLITE_HEADER = Buffer.from('SQLite format 3\u0000', 'utf8')

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
    for (const p of listXmtpDb3FilesUnderRoot(XMTP_DB_DIR)) {
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
    const message =
      '[xmtp] Refusing startup: XMTP_DB_ENCRYPTION_KEY is configured but legacy plaintext DB file(s) were detected. ' +
      'Set XMTP_DB_FORCE_ENCRYPTED_MIGRATION=1 and XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM=rotate-db ' +
      'to rotate plaintext DBs before startup.'
    logger.error(message)
    throw new Error(message)
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
 * Rotate all .db3 files in the XMTP DB directory to `.corrupt.{timestamp}`.
 * Called when Agent.create fails with "database disk image is malformed".
 * The SDK will create a fresh DB (and new installation) on the next attempt.
 */
function rotateCorruptXmtpDbFiles(): void {
  try {
    const paths = listXmtpDb3FilesUnderRoot(XMTP_DB_DIR)
    const ts = Date.now()
    for (const src of paths) {
      const dest = `${src}.corrupt.${ts}`
      try {
        fs.renameSync(src, dest)
        console.warn(`[xmtp] Rotated corrupt DB: ${path.basename(src)} → ${path.basename(dest)}`)
      } catch (err) {
        console.error(`[xmtp] Failed to rotate ${src}:`, err)
      }
    }
  } catch (err) {
    console.error('[xmtp] Failed to scan DB directory for rotation:', err)
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

type DbPersistenceCheckResult = {
  errors: string[]
}

/**
 * Pre-flight check: log whether we're reusing an existing XMTP installation
 * or creating a fresh one. If strict persistence policies are enabled,
 * this check can return fatal startup errors.
 */
function checkDbPersistence(): DbPersistenceCheckResult {
  const errors: string[] = []
  try {
    const dbPaths = listXmtpDb3FilesUnderRoot(XMTP_DB_DIR)
    if (dbPaths.length > 0) {
      logger.info(
        `[xmtp] ✅ Found ${dbPaths.length} existing DB file(s) under ${XMTP_DB_DIR} — will reuse installation`,
      )
      for (const fullPath of dbPaths) {
        const rel = path.relative(XMTP_DB_DIR, fullPath) || path.basename(fullPath)
        const stat = fs.statSync(fullPath)
        logger.info(`[xmtp]   ${rel} (${(stat.size / 1024).toFixed(1)} KB, modified ${stat.mtime.toISOString()})`)
      }
    } else {
      logger.warn(
        `[xmtp] ⚠️  No .db3 files found under ${XMTP_DB_DIR} (including subfolders like v3/) — a NEW installation will be created.\n` +
        `    If this keeps happening on every restart, your volume is not persisting.\n` +
        `    → Railway: add a volume at /data/.xmtp-data in the dashboard or railway.toml\n` +
        `    → Docker: use -v xmtp-data:/data/.xmtp-data\n` +
        `    → Docs: https://docs.xmtp.org/agents/build-agents/local-database`,
      )
    }
    if (AGENT_CONSUME_XMTP && XMTP_REQUIRE_PERSISTENT_DB && (XMTP_DB_DIR === '/tmp' || XMTP_DB_DIR.startsWith('/tmp/'))) {
      errors.push(
        `[xmtp] Runtime policy requires persistent storage, but XMTP DB path resolves to temp storage (${XMTP_DB_DIR}).`,
      )
    }
    if (!XMTP_DB_ENCRYPTION_KEY) {
      if (AGENT_CONSUME_XMTP && XMTP_REQUIRE_DB_ENCRYPTION && !XMTP_DB_PLAINTEXT_ONLY) {
        errors.push(
          '[xmtp] Runtime policy requires XMTP_DB_ENCRYPTION_KEY, but no key is configured.',
        )
      } else {
        logger.warn(
          '[xmtp] ⚠️  XMTP_DB_ENCRYPTION_KEY is not set — DB cannot be reopened across restarts!\n' +
          '    Generate one: openssl rand -hex 32  (then prefix with 0x)',
        )
      }
    } else if (XMTP_DB_FORCE_ENCRYPTED_MIGRATION_REQUESTED && !XMTP_DB_FORCE_ENCRYPTED_MIGRATION) {
      logger.warn(
        '[xmtp] Forced encrypted migration requested but NOT confirmed.\n' +
        '    To run migration intentionally, set XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM=rotate-db.\n' +
        '    Startup will fail if legacy plaintext DB files are present unless auto migration is enabled.',
      )
    } else if (XMTP_DB_AUTO_ENCRYPTED_MIGRATION && hasLegacyPlaintextDbInDir()) {
      logger.warn(
        '[xmtp] Legacy plaintext XMTP DB detected; auto encrypted migration is enabled and will rotate plaintext DB files.',
      )
    } else if (!XMTP_DB_FORCE_ENCRYPTED_MIGRATION && hasLegacyPlaintextDbInDir()) {
      errors.push(
        '[xmtp] Legacy plaintext XMTP DB detected while encryption is configured. ' +
          'Set XMTP_DB_FORCE_ENCRYPTED_MIGRATION=1 and ' +
          'XMTP_DB_FORCE_ENCRYPTED_MIGRATION_CONFIRM=rotate-db to rotate plaintext DB files.',
      )
    }
  } catch {
    // Directory doesn't exist yet — will be created by makeDbPath
  }
  return { errors }
}

// ERC-8004 identity (loaded from env vars in a separate module to avoid circular imports)
import { erc8004Identity } from './identity.js'
export { erc8004Identity }
export type { Erc8004Identity } from './identity.js'

// ---------------------------------------------------------------------------
// Plugins & Actions
// ---------------------------------------------------------------------------

const corePlugins = [
  keeprPlugin,
  zoraPlugin,
  uniswapPlugin,
  bankrPlugin,
  lensPlugin,
  walletIntelPlugin,
  reputationPlugin,
  crePlugin,
  knowledgePlugin,
]

function channelFlagEnabled(envKey: string): boolean {
  return parseEnvBoolean(process.env[envKey], false)
}

const channelPlugins = [
  ...(channelFlagEnabled('ELIZA_CHANNEL_TELEGRAM_ENABLED') ? [telegramPlugin] : []),
  ...(channelFlagEnabled('ELIZA_CHANNEL_DISCORD_ENABLED') ? [discordPlugin] : []),
  ...(channelFlagEnabled('ELIZA_CHANNEL_TWITTER_ENABLED') ? [twitterPlugin] : []),
]

const plugins = [...corePlugins, ...channelPlugins]
const allActions = plugins.flatMap((p) => p.actions ?? [])

type AgentSwarmRole = 'general' | 'trader' | 'social' | 'knowledge'

const DEFAULT_SWARM_CAPABILITIES: Record<AgentSwarmRole, string[]> = {
  general: [],
  trader: ['uniswap', 'zora', 'cre', 'keepr'],
  social: ['lens'],
  knowledge: ['knowledge', 'reputation', 'wallet'],
}

function normalizeSwarmRole(raw: string): AgentSwarmRole | null {
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'general' || normalized === 'trader' || normalized === 'social' || normalized === 'knowledge') {
    return normalized
  }
  return null
}

function parseSwarmRoleMap(raw: string | undefined): Record<string, AgentSwarmRole> {
  const source = String(raw ?? '').trim()
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    const out: Record<string, AgentSwarmRole> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const role = normalizeSwarmRole(String(value ?? ''))
      if (!role) continue
      out[key.toLowerCase()] = role
    }
    return out
  } catch {
    logger.warn('[eliza/swarm] failed to parse ELIZA_SWARM_ROLE_MAP_JSON; using defaults')
    return {}
  }
}

function parseSwarmCapabilityMap(raw: string | undefined): Partial<Record<AgentSwarmRole, string[]>> {
  const source = String(raw ?? '').trim()
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    const out: Partial<Record<AgentSwarmRole, string[]>> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const role = normalizeSwarmRole(key)
      if (!role || !Array.isArray(value)) continue
      out[role] = value
        .map((entry) => String(entry ?? '').trim().toLowerCase())
        .filter(Boolean)
    }
    return out
  } catch {
    logger.warn('[eliza/swarm] failed to parse ELIZA_SWARM_CAPABILITIES_JSON; using defaults')
    return {}
  }
}

const SWARM_ROLE_MAP = parseSwarmRoleMap(process.env.ELIZA_SWARM_ROLE_MAP_JSON)
const SWARM_CAPABILITY_OVERRIDES = parseSwarmCapabilityMap(process.env.ELIZA_SWARM_CAPABILITIES_JSON)

function inferSwarmRoleFromAgentKey(agentKey: string): AgentSwarmRole {
  const normalized = agentKey.trim().toLowerCase()
  if (normalized.includes('trader')) return 'trader'
  if (normalized.includes('social')) return 'social'
  if (normalized.includes('knowledge')) return 'knowledge'
  return 'general'
}

function resolveSwarmProfile(agentKey: string): { role: AgentSwarmRole; capabilities: string[] } {
  const normalized = agentKey.trim().toLowerCase()
  const mapped = SWARM_ROLE_MAP[normalized]
  const role = mapped ?? inferSwarmRoleFromAgentKey(agentKey)
  const overridden = SWARM_CAPABILITY_OVERRIDES[role]
  const capabilities = (overridden ?? DEFAULT_SWARM_CAPABILITIES[role]).map((entry) => entry.toLowerCase())
  return { role, capabilities }
}

function roleCharacter(role: AgentSwarmRole): {
  name: string
  description: string
  system: string
  settingsModel?: string
} {
  if (role === 'trader') {
    return {
      name: keeprTraderCharacter.name,
      description: keeprTraderCharacter.description ?? creatorVaultCharacter.description,
      system: keeprTraderCharacter.system ?? characterRuntimeConfig.systemPrompt,
      settingsModel: String((keeprTraderCharacter as any)?.settings?.model ?? '').trim() || undefined,
    }
  }
  if (role === 'social') {
    return {
      name: keeprSocialCharacter.name,
      description: keeprSocialCharacter.description ?? creatorVaultCharacter.description,
      system: keeprSocialCharacter.system ?? characterRuntimeConfig.systemPrompt,
      settingsModel: String((keeprSocialCharacter as any)?.settings?.model ?? '').trim() || undefined,
    }
  }
  return {
    name: creatorVaultCharacter.name,
    description: creatorVaultCharacter.description,
    system: characterRuntimeConfig.systemPrompt,
    settingsModel: characterRuntimeConfig.preferredModel,
  }
}

export {
  keeprPlugin,
  zoraPlugin,
  uniswapPlugin,
  bankrPlugin,
  lensPlugin,
  walletIntelPlugin,
  reputationPlugin,
  crePlugin,
  knowledgePlugin,
  telegramPlugin,
  discordPlugin,
  twitterPlugin,
}

// ---------------------------------------------------------------------------
// LLM providers (for /ai fallback)
// ---------------------------------------------------------------------------

function resolveProvider(): { name: string; model: string } | null {
  const [provider] = llmService.getAvailableProviders()
  if (!provider) return null
  return { name: provider.name, model: provider.model }
}

// withTimeout, sleep, withRetry imported from ./_retry.js

// ---------------------------------------------------------------------------
// Welcome message for first-time conversations
// ---------------------------------------------------------------------------

const welcomedConversations = new WelcomeConversationTracker({
  ttlMs: WELCOME_TRACKER_TTL_MS,
  maxTracked: WELCOME_TRACKER_MAX,
})

const WELCOME_MESSAGE = formatWelcomeNumberedOptions()

type EnvValidationResult = {
  errors: string[]
  warnings: string[]
}

type RuntimeRole = 'primary' | 'standby'

type RuntimeLeaseState = {
  key: string
  ownerId: string
  active: boolean
}

let latestEnvValidation: EnvValidationResult = { errors: [], warnings: [] }
let backgroundWorker: { stop: () => void } | null = null
let queueEnabled = false
let dbRequiredForRuntime = false
let stderrNoiseFilterInstalled = false
let runtimeLeaseHeartbeat: ReturnType<typeof setInterval> | null = null
let runtimeLeaseState: RuntimeLeaseState | null = null

function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

function isRailwayRuntime(): boolean {
  return Object.entries(process.env).some(([key, value]) => key.startsWith('RAILWAY_') && String(value ?? '').trim())
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return String(value[0] ?? '')
  return ''
}

const ELIZA_HEALTH_VERBOSE = parseEnvBoolean(process.env.ELIZA_HEALTH_VERBOSE, false)
const ELIZA_HEALTH_DETAIL_TOKEN = String(process.env.ELIZA_HEALTH_DETAIL_TOKEN ?? '').trim()

function hasDetailedHealthAccess(req: http.IncomingMessage): boolean {
  if (ELIZA_HEALTH_VERBOSE) return true
  if (!ELIZA_HEALTH_DETAIL_TOKEN) return false
  const headerToken = firstHeaderValue(req.headers['x-health-token'] as string | string[] | undefined).trim()
  const authHeader = firstHeaderValue(req.headers.authorization as string | string[] | undefined).trim()
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
  const provided = headerToken || bearerToken
  return provided === ELIZA_HEALTH_DETAIL_TOKEN
}

// xmlEscape, buildFallbackHistoryBlock, buildContinuityContextBlock imported from ./_stateHelpers.js

const AGENT_RUNTIME_ROLE: RuntimeRole = (() => {
  const raw = String(process.env.AGENT_RUNTIME_ROLE ?? 'primary').trim().toLowerCase()
  return raw === 'standby' ? 'standby' : 'primary'
})()

const AGENT_CONSUME_XMTP = parseEnvBoolean(
  process.env.AGENT_CONSUME_XMTP,
  AGENT_RUNTIME_ROLE === 'primary',
)
const RUNNING_ON_RAILWAY = isRailwayRuntime()
const AGENT_RUNTIME_LOCK_EXPLICITLY_CONFIGURED = (() => {
  const raw = (process.env.AGENT_RUNTIME_LOCK_REQUIRED ?? '').trim()
  return raw.length > 0
})()
const AGENT_RUNTIME_LOCK_REQUIRED = parseEnvBoolean(
  process.env.AGENT_RUNTIME_LOCK_REQUIRED,
  RUNNING_ON_RAILWAY && AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'primary' && isDbConfigured(),
)
const AGENT_RUNTIME_LOCK_KEY = (() => {
  const raw = (process.env.AGENT_RUNTIME_LOCK_KEY ?? '').trim()
  return raw || 'xmtp-primary-runtime-lock'
})()
const AGENT_RUNTIME_LOCK_HEARTBEAT_MS = Math.floor(
  parsePositiveNumber(process.env.AGENT_RUNTIME_LOCK_HEARTBEAT_MS, 10_000),
)
const AGENT_RUNTIME_LOCK_STALE_MS = Math.floor(
  parsePositiveNumber(process.env.AGENT_RUNTIME_LOCK_STALE_MS, 30_000),
)
const ELIZA_ALLOW_OFF_RAILWAY_PRIMARY = parseEnvBoolean(
  process.env.ELIZA_ALLOW_OFF_RAILWAY_PRIMARY,
  false,
)
const ELIZA_ALLOW_OFF_RAILWAY_GROVE_UPLOAD = parseEnvBoolean(
  process.env.ELIZA_ALLOW_OFF_RAILWAY_GROVE_UPLOAD,
  false,
)
const RUNTIME_LEASE_OWNER_ID = `${AGENT_RUNTIME_ROLE}:${Date.now().toString(36)}:${Math.random()
  .toString(16)
  .slice(2, 10)}`
const XMTP_REQUIRE_PERSISTENT_DB = parseEnvBoolean(
  process.env.XMTP_REQUIRE_PERSISTENT_DB,
  AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'primary',
)
const XMTP_REQUIRE_DB_ENCRYPTION = parseEnvBoolean(
  process.env.XMTP_REQUIRE_DB_ENCRYPTION,
  AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'primary',
)

function wrapWriteWithNoiseFilter(write: (chunk: any, encoding?: any, cb?: any) => boolean) {
  const ignoredPatterns = [
    // Native / SQLite may prefix with "WARN CORE" or similar; still non-fatal for XMTP.
    /sqlcipherCodecAttach:\s*no codec attached to db/i,
    /WARN CORE\s+sqlcipherCodecAttach/i,
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
  const configuredCswRaw = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim()
  const configuredCsw = normalizePolicyAddress(configuredCswRaw)
  const hasCswAddress = !!configuredCswRaw
  const hasCswPrivyWallet = !!(process.env.XMTP_AGENT_PRIVY_WALLET_ID ?? '').trim()
  const hasCswConfig = hasCswAddress && hasCswPrivyWallet
  const multiAgentConfigured = hasDb && hasEncKey

  if (!AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'primary') {
    warnings.push('AGENT_RUNTIME_ROLE=primary but AGENT_CONSUME_XMTP=false. This instance will run in passive standby mode.')
  }
  if (AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'standby') {
    warnings.push(
      'AGENT_RUNTIME_ROLE=standby with AGENT_CONSUME_XMTP=true can create dual-consumer risk. Prefer AGENT_CONSUME_XMTP=false for standby replicas.',
    )
  }
  if (RUNNING_ON_RAILWAY && AGENT_RUNTIME_ROLE !== 'primary') {
    errors.push(
      'Railway runtime must use AGENT_RUNTIME_ROLE=primary. Standby mode is reserved for local inspection only.',
    )
  }
  if (RUNNING_ON_RAILWAY && !AGENT_CONSUME_XMTP) {
    errors.push(
      'Railway runtime must use AGENT_CONSUME_XMTP=true. Passive standby on Railway would silently disable the primary consumer.',
    )
  }

  if (AGENT_CONSUME_XMTP && !multiAgentConfigured && !hasPrivateKey && !hasCswConfig) {
    errors.push(
      'No startup mode is fully configured for XMTP consumption. Set multi-agent, CSW, or EOA credentials before boot.',
    )
  }

  if (AGENT_CONSUME_XMTP && hasDb && !hasEncKey && !hasPrivateKey && !hasCswConfig) {
    errors.push('XMTP_AGENT_KEY_ENCRYPTION_KEY is required for multi-agent DB mode.')
  } else if (AGENT_CONSUME_XMTP && hasDb && !hasEncKey && !hasCswConfig) {
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
  if (
    AGENT_CONSUME_XMTP &&
    AGENT_RUNTIME_ROLE === 'primary' &&
    XMTP_ENV === 'production' &&
    !RUNNING_ON_RAILWAY &&
    !ELIZA_ALLOW_OFF_RAILWAY_PRIMARY
  ) {
    errors.push(
      'Production primary XMTP runtime is Railway-only by default. Run this on Railway, switch to XMTP_ENV=dev/local, use standby mode, or explicitly set ELIZA_ALLOW_OFF_RAILWAY_PRIMARY=true for a supervised override.',
    )
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
    if (XMTP_REQUIRE_DB_ENCRYPTION && AGENT_CONSUME_XMTP && !XMTP_DB_PLAINTEXT_ONLY) {
      errors.push(
        'XMTP_DB_ENCRYPTION_KEY is required for this runtime policy. Set XMTP_DB_ENCRYPTION_KEY or explicitly set XMTP_REQUIRE_DB_ENCRYPTION=false for non-production paths.',
      )
    } else {
      warnings.push('XMTP_DB_ENCRYPTION_KEY is not set. XMTP installation reuse may degrade across restarts.')
    }
  }

  const configuredDbDir = (process.env.XMTP_DB_DIRECTORY ?? '').trim()
  if (configuredDbDir && path.resolve(configuredDbDir) !== path.resolve(XMTP_DB_DIR)) {
    errors.push(
      `XMTP_DB_DIRECTORY (${configuredDbDir}) is not writable/usable; runtime resolved fallback ${XMTP_DB_DIR}. Fix directory permissions or mount.`,
    )
  }
  if (
    XMTP_REQUIRE_PERSISTENT_DB &&
    AGENT_CONSUME_XMTP &&
    (XMTP_DB_DIR === '/tmp' || XMTP_DB_DIR.startsWith('/tmp/'))
  ) {
    errors.push(
      `XMTP persistent storage policy is enabled but resolved XMTP DB directory is temporary (${XMTP_DB_DIR}). Mount durable storage and/or set XMTP_DB_DIRECTORY.`,
    )
  }
  if (RUNNING_ON_RAILWAY && AGENT_CONSUME_XMTP && XMTP_REQUIRE_PERSISTENT_DB && !hasDedicatedMount(XMTP_DB_DIR)) {
    const mountedAncestor = findMountedAncestorPath(XMTP_DB_DIR)
    errors.push(
      `Railway primary requires a dedicated mounted volume for XMTP DB storage at ${XMTP_DB_DIR}. ` +
        `The path currently resolves onto the container root filesystem${mountedAncestor ? ` (closest mount: ${mountedAncestor})` : ''}. ` +
        'Attach a Railway volume at the XMTP DB path and redeploy.',
    )
  }

  if (hasCswAddress && !hasCswPrivyWallet) {
    errors.push('XMTP_AGENT_PRIVY_WALLET_ID is required when XMTP_AGENT_CSW_ADDRESS is set.')
  }
  if (!hasCswAddress && hasCswPrivyWallet) {
    errors.push('XMTP_AGENT_CSW_ADDRESS is required when XMTP_AGENT_PRIVY_WALLET_ID is set.')
  }
  if (hasCswAddress && !configuredCsw) {
    errors.push('XMTP_AGENT_CSW_ADDRESS must be a valid EVM address.')
  }
  if (configuredCsw && !isTargetCanonicalCsw(configuredCsw)) {
    warnings.push(
      `XMTP_AGENT_CSW_ADDRESS (${configuredCsw}) does not match canonical target ${TARGET_CANONICAL_CSW_ADDRESS}; startup will enforce canonical target identity.`,
    )
  }

  if (!llmService.getAvailableProviders().length) {
    warnings.push('No LLM provider API key configured; /ai fallback will be disabled.')
  }

  if (AGENT_RUNTIME_LOCK_REQUIRED && !AGENT_CONSUME_XMTP) {
    warnings.push('AGENT_RUNTIME_LOCK_REQUIRED=true has no effect when AGENT_CONSUME_XMTP=false.')
  }
  if (AGENT_RUNTIME_LOCK_REQUIRED && AGENT_CONSUME_XMTP && !hasDb) {
    errors.push('AGENT_RUNTIME_LOCK_REQUIRED=true requires DATABASE_URL/POSTGRES_URL so the runtime lease lock can be acquired.')
  }
  if (
    RUNNING_ON_RAILWAY &&
    AGENT_CONSUME_XMTP &&
    AGENT_RUNTIME_ROLE === 'primary' &&
    hasDb &&
    AGENT_RUNTIME_LOCK_EXPLICITLY_CONFIGURED &&
    !AGENT_RUNTIME_LOCK_REQUIRED
  ) {
    errors.push(
      'Railway primary requires the DB-backed runtime lease lock when Postgres is configured. Remove the override or set AGENT_RUNTIME_LOCK_REQUIRED=true.',
    )
  }
  if (
    AGENT_RUNTIME_LOCK_REQUIRED &&
    AGENT_RUNTIME_LOCK_HEARTBEAT_MS >= AGENT_RUNTIME_LOCK_STALE_MS
  ) {
    errors.push('AGENT_RUNTIME_LOCK_HEARTBEAT_MS must be lower than AGENT_RUNTIME_LOCK_STALE_MS.')
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

const RUNTIME_LEASE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_runtime_leases (
    lease_key TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    runtime_role TEXT NOT NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE agent_runtime_leases ENABLE ROW LEVEL SECURITY;
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'agent_runtime_leases' AND policyname = 'deny_all_non_service'
    ) THEN
      CREATE POLICY deny_all_non_service ON agent_runtime_leases FOR ALL USING (false);
    END IF;
  END $$;
`

let runtimeLeaseSchemaEnsured = false

async function ensureRuntimeLeaseSchema(db: any): Promise<void> {
  if (runtimeLeaseSchemaEnsured) return
  if (typeof db?.query === 'function') {
    await db.query(RUNTIME_LEASE_TABLE_SQL)
  } else {
    const stmt = [RUNTIME_LEASE_TABLE_SQL] as unknown as TemplateStringsArray
    ;(stmt as any).raw = [RUNTIME_LEASE_TABLE_SQL]
    await db.sql(stmt)
  }
  runtimeLeaseSchemaEnsured = true
}

function clearRuntimeLeaseHeartbeat(): void {
  if (!runtimeLeaseHeartbeat) return
  clearInterval(runtimeLeaseHeartbeat)
  runtimeLeaseHeartbeat = null
}

async function releaseRuntimeLease(): Promise<void> {
  clearRuntimeLeaseHeartbeat()
  if (!runtimeLeaseState?.active) return
  try {
    const db = await getDb()
    if (db) {
      await db.sql`
        DELETE FROM agent_runtime_leases
        WHERE lease_key = ${runtimeLeaseState.key}
          AND owner_id = ${runtimeLeaseState.ownerId};
      `
    }
  } catch (error) {
    logger.warn('[eliza/runtime-lock] failed to release runtime lease', {
      key: runtimeLeaseState.key,
      ownerId: runtimeLeaseState.ownerId,
      error: toErrorDetails(error),
    })
  } finally {
    runtimeLeaseState = null
  }
}

async function acquireRuntimeLeaseOrExit(): Promise<void> {
  if (!AGENT_CONSUME_XMTP || !AGENT_RUNTIME_LOCK_REQUIRED) return

  const db = await getDb()
  if (!db) {
    logger.error('[eliza/runtime-lock] DB connection unavailable for runtime lease lock')
    process.exit(1)
    return
  }

  await ensureRuntimeLeaseSchema(db)

  const upsert = await db.sql`
    INSERT INTO agent_runtime_leases (
      lease_key, owner_id, runtime_role, heartbeat_at, created_at, updated_at
    ) VALUES (
      ${AGENT_RUNTIME_LOCK_KEY},
      ${RUNTIME_LEASE_OWNER_ID},
      ${AGENT_RUNTIME_ROLE},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (lease_key)
    DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      runtime_role = EXCLUDED.runtime_role,
      heartbeat_at = NOW(),
      updated_at = NOW()
    WHERE agent_runtime_leases.owner_id = EXCLUDED.owner_id
       OR agent_runtime_leases.heartbeat_at < NOW() - (${AGENT_RUNTIME_LOCK_STALE_MS} * INTERVAL '1 millisecond')
    RETURNING owner_id, runtime_role, heartbeat_at;
  `

  const acquiredRow = (upsert.rows ?? [])[0] as any
  const acquiredOwner = String(acquiredRow?.owner_id ?? '')
  if (acquiredOwner !== RUNTIME_LEASE_OWNER_ID) {
    const holderRes = await db.sql`
      SELECT owner_id, runtime_role, heartbeat_at
      FROM agent_runtime_leases
      WHERE lease_key = ${AGENT_RUNTIME_LOCK_KEY}
      LIMIT 1;
    `
    const holder = (holderRes.rows ?? [])[0] as any
    logger.error('[eliza/runtime-lock] runtime lease already held by another instance', {
      leaseKey: AGENT_RUNTIME_LOCK_KEY,
      holderOwnerId: holder?.owner_id ?? null,
      holderRole: holder?.runtime_role ?? null,
      holderHeartbeatAt: holder?.heartbeat_at ?? null,
    })
    process.exit(1)
    return
  }

  runtimeLeaseState = {
    key: AGENT_RUNTIME_LOCK_KEY,
    ownerId: RUNTIME_LEASE_OWNER_ID,
    active: true,
  }

  clearRuntimeLeaseHeartbeat()
  runtimeLeaseHeartbeat = setInterval(() => {
    void (async () => {
      if (!runtimeLeaseState?.active) return
      try {
        const dbLease = await getDb()
        if (!dbLease) {
          logger.error('[eliza/runtime-lock] lost DB while maintaining runtime lease; exiting')
          process.exit(1)
          return
        }
        const refreshed = await dbLease.sql`
          UPDATE agent_runtime_leases
          SET heartbeat_at = NOW(), updated_at = NOW()
          WHERE lease_key = ${runtimeLeaseState.key}
            AND owner_id = ${runtimeLeaseState.ownerId}
          RETURNING owner_id;
        `
        const refreshedRows = Array.isArray((refreshed as any)?.rows)
          ? (refreshed as any).rows.length
          : 0
        const rowCount = Number((refreshed as any)?.rowCount ?? refreshedRows)
        if (!Number.isFinite(rowCount) || rowCount <= 0) {
          logger.error('[eliza/runtime-lock] runtime lease lost; refusing split-brain. Exiting.')
          process.exit(1)
        }
      } catch (error) {
        logger.error('[eliza/runtime-lock] failed to refresh runtime lease', {
          key: runtimeLeaseState.key,
          ownerId: runtimeLeaseState.ownerId,
          error: toErrorDetails(error),
        })
        process.exit(1)
      }
    })()
  }, AGENT_RUNTIME_LOCK_HEARTBEAT_MS)
}

function initializeRuntimeBridge(agentKey: string): ReturnType<typeof createRuntimeBridge> {
  const swarm = resolveSwarmProfile(agentKey)
  const profileCharacter = roleCharacter(swarm.role)
  const envSystemPrompt = String(process.env.ELIZA_CHARACTER_SYSTEM_PROMPT ?? '').trim()
  const envPreferredModel = String(process.env.ELIZA_CHARACTER_MODEL ?? '').trim()
  const preferredModel =
    envPreferredModel ||
    profileCharacter.settingsModel ||
    characterRuntimeConfig.preferredModel
  const settings: Record<string, string> = {
    ...characterRuntimeConfig.settings,
    CHARACTER_NAME: profileCharacter.name,
    CHARACTER_DESCRIPTION: profileCharacter.description,
    CHARACTER_MODEL: preferredModel ?? '',
  }
  return createRuntimeBridge({
    agentKey,
    plugins,
    settings,
    character: {
      systemPrompt: envSystemPrompt || profileCharacter.system || characterRuntimeConfig.systemPrompt,
      preferredModel: preferredModel || undefined,
    },
    swarm,
  })
}

function summarizeInboundMessageForLog(params: {
  senderAddress?: string | null
  senderInboxId: string
  content: string
}): string {
  const senderLabel = (params.senderAddress ?? params.senderInboxId).slice(0, 10)
  const contentLength = params.content.length
  const contentDigest = createHash('sha256')
    .update(params.content, 'utf8')
    .digest('hex')
    .slice(0, 12)
  return `${senderLabel}: [len=${contentLength} sha=${contentDigest}]`
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
    xmtpConversationKey?: string | null
    messageId?: string | null
    sentAtMs?: number | null
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
  void emitTelemetryEvent('eliza_message_received', {
    agentKey: ctx.agentKey,
    conversationId: msg.conversationId,
    correlationId,
    length: text.length,
  })
  const isKeeprStatusCommand = /^\/?keepr\s+status\b/i.test(text)
  if (isKeeprStatusCommand) {
    reqLogger.info('[eliza/vertical] keepr_status ingress', {
      correlationId,
      agentKey: ctx.agentKey,
      conversationId: msg.conversationId,
    })
  }
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
  if ((memory as any)?.__xmtpDuplicate === true) {
    reqLogger.info('[eliza] duplicate inbound message ignored', {
      messageId: msg.messageId ?? null,
      conversationId: msg.conversationId,
    })
    return null
  }
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
  if (welcomedConversations.markAndCheckFirstSeen(msg.conversationId)) {
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
  if (isKeeprStatusCommand) {
    reqLogger.info('[eliza/vertical] keepr_status ranked', {
      correlationId,
      candidates: candidates.map((entry) => ({
        action: String(entry.action?.name ?? 'unknown'),
        score: entry.score,
      })),
    })
  }
  for (const candidate of candidates) {
    const actionName = String(candidate.action?.name ?? 'unknown')
    const parts: string[] = []
    try {
      const actionRetryBudget = getActionRetryBudget(actionName, ACTION_MAX_RETRIES)
      await withRetry({
        operation: `action_${actionName.toLowerCase()}`,
        maxRetries: actionRetryBudget,
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
            `action_timeout_${actionName.toLowerCase()}`,
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
          action: actionName,
          score: candidate.score,
          reason: candidate.reason,
          retriesUsed: actionRetryBudget,
        })
        void emitTelemetryEvent('eliza_action_executed', {
          action: actionName,
          score: candidate.score,
          reason: candidate.reason,
          retriesUsed: actionRetryBudget,
          agentKey: ctx.agentKey,
          conversationId: msg.conversationId,
          correlationId,
        })
        if (isKeeprStatusCommand) {
          reqLogger.info('[eliza/vertical] keepr_status reply', {
            correlationId,
            action: actionName,
            chars: actionReply.length,
          })
        }
        return actionReply
      }
    } catch (error) {
      const agentError = toAgentError(error, 'ACTION_FAILED', 'Action execution failed')
      reqLogger.warn('[eliza] action candidate failed', {
        action: actionName,
        score: candidate.score,
        reason: candidate.reason,
        error: agentError.message,
        code: agentError.code,
      })
      void emitTelemetryEvent('eliza_action_failed', {
        action: actionName,
        score: candidate.score,
        reason: candidate.reason,
        error: agentError.message,
        code: agentError.code,
        agentKey: ctx.agentKey,
        conversationId: msg.conversationId,
        correlationId,
      })
      if (isKeeprStatusCommand) {
        reqLogger.warn('[eliza/vertical] keepr_status action failed', {
          correlationId,
          action: actionName,
          code: agentError.code,
          error: agentError.message,
        })
      }
    }
  }

  if (isKeeprStatusCommand) {
    reqLogger.warn('[eliza/vertical] keepr_status no_action_reply', {
      correlationId,
    })
    return 'Keepr status is temporarily unavailable. Please try again shortly.'
  }

  return handleXmtpFallbackResponse({
    text,
    conversationId: msg.conversationId,
    senderAddress: msg.senderAddress,
    runtimeBridge: ctx.runtimeBridge,
    inboundMemory: memory as any,
    state: state as Record<string, unknown>,
    logger: reqLogger,
  })
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
  rowFingerprint: string
  startedAtMs: number
  swarmRole: AgentSwarmRole
  swarmCapabilities: string[]
}

function computeRowFingerprint(row: AgentRow): string {
  return fingerprintAgentConfig({
    creatorAddress: row.creatorAddress,
    xmtpAgentAddress: row.xmtpAgentAddress,
    agentType: row.agentType,
    privyWalletId: row.privyWalletId,
    cswAddress: row.cswAddress,
    encryptedPrivateKeyB64: row.encryptedPrivateKeyB64,
    encryptedPrivateKeyIvB64: row.encryptedPrivateKeyIvB64,
    encryptedPrivateKeyTagB64: row.encryptedPrivateKeyTagB64,
  })
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

async function startAgent(row: AgentRow, rowFingerprint = computeRowFingerprint(row)): Promise<RunningAgent> {
  const dbEncryptionKey = getEffectiveDbEncryptionKey()
  const swarmProfile = resolveSwarmProfile(row.creatorAddress)
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
      `[eliza:${row.creatorAddress.slice(0, 10)}] ${summarizeInboundMessageForLog(msg)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
        xmtpConversationKey: msg.conversationArchiveKey ?? null,
        messageId: msg.messageId ?? null,
        sentAtMs: msg.sentAtMs ?? msg.sentAt?.getTime?.() ?? null,
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
    swarmRole: swarmProfile.role,
  })

  return {
    creatorAddress: row.creatorAddress,
    xmtp,
    runtimeBridge,
    rowFingerprint,
    startedAtMs: Date.now(),
    swarmRole: swarmProfile.role,
    swarmCapabilities: swarmProfile.capabilities,
  }
}

// ---------------------------------------------------------------------------
// Multi-agent orchestrator
// ---------------------------------------------------------------------------

const runningAgents = new Map<string, RunningAgent>()
let shuttingDown = false
let syncInFlight = false

async function syncAgents() {
  if (shuttingDown || syncInFlight) return
  syncInFlight = true

  const { correlationId, logger: syncLogger } = createCorrelationLogger('sync')
  try {
    const rows = await loadAgentRows()
    const currentKeys = new Set(runningAgents.keys())
    const desiredKeys = new Set(rows.map((r) => r.creatorAddress))

    // Start new agents or restart changed agents
    for (const row of rows) {
      const desiredFingerprint = computeRowFingerprint(row)
      const existing = runningAgents.get(row.creatorAddress)
      if (existing) {
        if (existing.rowFingerprint === desiredFingerprint) continue
        syncLogger.info('[eliza] Agent config changed; restarting', {
          correlationId,
          creatorAddress: row.creatorAddress,
        })
        try {
          await existing.xmtp.stop()
          runningAgents.delete(row.creatorAddress)
        } catch (err) {
          syncLogger.error('[eliza] Failed stopping existing agent before restart; replacement skipped to avoid split-brain', {
            correlationId,
            creatorAddress: row.creatorAddress,
            error: toErrorDetails(err),
          })
          continue
        }
        try {
          const replacement = await startAgent(row, desiredFingerprint)
          runningAgents.set(row.creatorAddress, replacement)
        } catch (err) {
          syncLogger.error(`[eliza] Failed to restart changed agent for ${row.creatorAddress}`, {
            correlationId,
            error: toErrorDetails(err),
          })
        }
        continue
      }
      try {
        const running = await startAgent(row, desiredFingerprint)
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
            runningAgents.delete(key)
          } catch (err) {
            syncLogger.error('[eliza] Failed to stop removed agent; keeping registration to avoid orphaned runtime', {
              correlationId,
              creatorAddress: key,
              error: toErrorDetails(err),
            })
          }
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
  } finally {
    syncInFlight = false
  }
}

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('[eliza] Shutting down...')
  void emitTelemetryEvent('runtime_shutdown', {
    runtimeRole: AGENT_RUNTIME_ROLE,
    consumeXmtp: AGENT_CONSUME_XMTP,
    agentsRunning: runningAgents.size,
  })

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
  await releaseRuntimeLease()
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
  const swarmProfile = resolveSwarmProfile('single-agent')
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
      `[eliza:single] ${summarizeInboundMessageForLog(msg)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
        xmtpConversationKey: msg.conversationArchiveKey ?? null,
        messageId: msg.messageId ?? null,
        sentAtMs: msg.sentAtMs ?? msg.sentAt?.getTime?.() ?? null,
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

  logger.info(`[eliza] Single EOA agent started`, {
    agentAddress: xmtp.address,
    swarmRole: swarmProfile.role,
  })

  return {
    creatorAddress: 'single-agent',
    xmtp,
    runtimeBridge,
    rowFingerprint: 'single-agent:eoa',
    startedAtMs: Date.now(),
    swarmRole: swarmProfile.role,
    swarmCapabilities: swarmProfile.capabilities,
  }
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
  const swarmProfile = resolveSwarmProfile('single-agent-csw')
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
      `[eliza:csw] ${summarizeInboundMessageForLog(msg)}`,
    )

    return handleMessage(
      {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
        content: msg.content,
        xmtpConversationKey: msg.conversationArchiveKey ?? null,
        messageId: msg.messageId ?? null,
        sentAtMs: msg.sentAtMs ?? msg.sentAt?.getTime?.() ?? null,
      },
      {
        agentKey: 'single-agent-csw',
        runtimeBridge,
      },
    )
  })

  let activeXmtp = xmtp
  try {
    await withRetry({
      operation: 'xmtp_start_single_csw',
      maxRetries: EXTERNAL_MAX_RETRIES,
      run: async () => {
        await activeXmtp.start()
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.toLowerCase().includes('malformed') || msg.toLowerCase().includes('disk image')) {
      console.warn('[eliza] XMTP database is corrupted — rotating corrupt files and creating fresh installation')
      rotateCorruptXmtpDbFiles()
      activeXmtp = new XmtpService({
        signer: createPrivyScwSigner({
          walletId: params.privyWalletId,
          cswAddress: params.cswAddress,
          ownerIndex: params.ownerIndex,
          chainId: params.chainId ?? 8453,
        }),
        env: XMTP_ENV,
        dbPath: makeDbPath(),
        dbEncryptionKey,
        revokeOtherInstallations: XMTP_REVOKE_OTHER,
      })
      activeXmtp.setMessageHandler(async (m) => {
        logger.info(
          `[eliza:csw] ${summarizeInboundMessageForLog(m)}`,
        )
        return handleMessage(
          {
            conversationId: m.conversationId,
            conversationType: m.conversationType,
            senderAddress: m.senderAddress,
            content: m.content,
            xmtpConversationKey: m.conversationArchiveKey ?? null,
            messageId: m.messageId ?? null,
            sentAtMs: m.sentAtMs ?? m.sentAt?.getTime?.() ?? null,
          },
          { agentKey: 'single-agent-csw', runtimeBridge },
        )
      })
      await activeXmtp.start()
      console.log('[eliza] Fresh XMTP installation created after corrupt DB rotation')
    } else {
      throw error
    }
  }

  logger.info(`[eliza] Single CSW agent started`, {
    agentAddress: activeXmtp.address,
    cswAddress: params.cswAddress,
    privyWalletId: params.privyWalletId.slice(0, 12) + '...',
    swarmRole: swarmProfile.role,
  })

  return {
    creatorAddress: 'single-agent-csw',
    xmtp: activeXmtp,
    runtimeBridge,
    rowFingerprint: `single-agent:csw:${params.cswAddress.toLowerCase()}`,
    startedAtMs: Date.now(),
    swarmRole: swarmProfile.role,
    swarmCapabilities: swarmProfile.capabilities,
  }
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
    if (!RUNNING_ON_RAILWAY && !ELIZA_ALLOW_OFF_RAILWAY_GROVE_UPLOAD) {
      regLogger.info('[eliza] Skipping Grove registration upload outside Railway', {
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

    const configuredCsw = normalizePolicyAddress((process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim())
    if (configuredCsw && !isTargetCanonicalCsw(configuredCsw)) {
      regLogger.warn('[eliza] XMTP agent CSW mismatch detected; using canonical target agent key', {
        configured: configuredCsw,
        expected: TARGET_CANONICAL_CSW_ADDRESS,
        correlationId,
      })
    }
    const agentKey = `single-csw:${TARGET_CANONICAL_CSW_ADDRESS}`
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
let lastReadinessLogKey: string | null = null

async function main() {
  // Suppress known non-fatal native/runtime noise that causes alert fatigue.
  installStderrNoiseFilter()

  // Start health check server FIRST so Railway healthcheck passes during boot
  startHealthServer()
  void emitTelemetryEvent('runtime_boot', {
    runtimeRole: AGENT_RUNTIME_ROLE,
    consumeXmtp: AGENT_CONSUME_XMTP,
    runtimeLockRequired: AGENT_RUNTIME_LOCK_REQUIRED,
    xmtpEnv: XMTP_ENV,
  })

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
  const shouldRunXmtp = AGENT_CONSUME_XMTP
  const runtimeLockRequired = shouldRunXmtp && AGENT_RUNTIME_LOCK_REQUIRED
  dbRequiredForRuntime = multiAgentMode || runtimeLockRequired

  if (dbRequiredForRuntime) {
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

  if (runtimeLockRequired) {
    await acquireRuntimeLeaseOrExit()
  }

  if (multiAgentMode && shouldRunXmtp) {
    ensureBackgroundWorker()
    void enqueueAgentBackgroundTask({
      taskType: 'knowledge_refresh',
      payload: { reason: 'startup' },
      priority: 1,
    })
  } else {
    queueEnabled = false
    if (!shouldRunXmtp) {
      logger.info('[eliza] XMTP consumption disabled; running in standby mode.')
    } else if (hasDb) {
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
  console.log('  4626 ElizaOS Agent (Unified)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Check DB persistence before creating any agent
  const persistenceCheck = checkDbPersistence()
  if (persistenceCheck.errors.length > 0) {
    for (const error of persistenceCheck.errors) {
      logger.error('[xmtp] startup persistence policy failure', { error })
    }
    await releaseRuntimeLease()
    process.exit(1)
    return
  }

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
  console.log(`  Runtime role: ${AGENT_RUNTIME_ROLE}`)
  console.log(`  Consume XMTP: ${AGENT_CONSUME_XMTP ? 'yes' : 'no (standby)'}`)
  console.log(`  Railway runtime: ${RUNNING_ON_RAILWAY ? 'yes' : 'no'}`)
  console.log(`  Runtime lock: ${AGENT_RUNTIME_LOCK_REQUIRED ? `enabled (${AGENT_RUNTIME_LOCK_KEY})` : 'disabled'}`)
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

  if (!AGENT_CONSUME_XMTP) {
    console.log('\n  Standby mode active: this instance will not connect to XMTP.')
    console.log('  Promote by setting AGENT_CONSUME_XMTP=true and redeploying.\n')
    process.on('SIGINT', () => void shutdown())
    process.on('SIGTERM', () => void shutdown())
  } else if (multiAgentMode) {
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
    const configuredCsw = normalizePolicyAddress((process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim())
    if (configuredCsw && !isTargetCanonicalCsw(configuredCsw)) {
      logger.warn('[eliza] overriding configured CSW with canonical target', {
        configured: configuredCsw,
        expected: TARGET_CANONICAL_CSW_ADDRESS,
      })
    }
    const cswAddress = TARGET_CANONICAL_CSW_ADDRESS as `0x${string}`
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
    await releaseRuntimeLease()
    process.exit(1)
  }

  agentBooted = true
  void emitTelemetryEvent('runtime_ready', {
    runtimeRole: AGENT_RUNTIME_ROLE,
    consumeXmtp: AGENT_CONSUME_XMTP,
    agentsRunning: runningAgents.size,
  })
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
    const queueStats = dbConfigured
      ? await getAgentBackgroundQueueStats().catch(() => null)
      : null
    const llmHealth = llmService.getHealth()
    const xmtpStates = [...runningAgents.values()].map((agent) => {
      const health = agent.xmtp.getHealth()
      return {
        creatorAddress: agent.creatorAddress,
        swarmRole: agent.swarmRole,
        swarmCapabilities: agent.swarmCapabilities,
        running: health.running,
        address: health.address,
        state: health.state,
        lastStartedAtMs: health.lastStartedAtMs,
        lastMessageAtMs: health.lastMessageAtMs,
        lastError: health.lastError,
      }
    })
    const xmtpReady = xmtpStates.every((entry) => entry.running)
    const requiresXmtp = AGENT_CONSUME_XMTP
    const readinessReasons: string[] = []
    if (!agentBooted) readinessReasons.push('booting')
    if (requiresXmtp && agentCount === 0) readinessReasons.push('no_agents')
    if (latestEnvValidation.errors.length > 0) readinessReasons.push('env_validation_failed')
    if (shouldCheckDb && db === null) readinessReasons.push('db_unavailable')
    if (requiresXmtp && agentCount > 0 && !xmtpReady) readinessReasons.push('xmtp_not_running')
    if ((queueStats?.staleProcessing ?? 0) > 0) readinessReasons.push('queue_stale_leases')
    const ready = Boolean(
      agentBooted &&
      latestEnvValidation.errors.length === 0 &&
      (shouldCheckDb ? db !== null : true) &&
      (requiresXmtp && agentCount > 0 ? xmtpReady : true),
    )
    const status =
      requiresXmtp && !agentBooted
        ? 'booting'
        : !requiresXmtp
          ? ready
            ? 'standby'
            : 'degraded'
          : ready
          ? 'ok'
          : agentCount === 0
            ? 'no_agents'
            : 'degraded'
    const readinessLogKey = `${ready ? 'ready' : 'not_ready'}:${readinessReasons.join(',') || 'none'}`
    if (readinessLogKey !== lastReadinessLogKey) {
      lastReadinessLogKey = readinessLogKey
      logger.info('[eliza] readiness state changed', {
        ready,
        status,
        reasons: readinessReasons,
        agentBooted,
        agentCount,
        requiresXmtp,
        xmtpReady,
      })
    }
    const probePath = url as '/healthz' | '/readyz'
    const detailedHealthAccess = hasDetailedHealthAccess(_req)
    const statusCode = getHealthProbeStatusCode({
      probe: probePath,
      ready,
      agentBooted,
      agentCount,
      xmtpReady,
    })
    const payload = detailedHealthAccess
      ? {
          probe: probePath,
          detailed: true,
          status,
          uptimeMs: Date.now() - runtimeStartedAtMs,
          agents: agentCount,
          readinessReasons,
          runtime: {
            role: AGENT_RUNTIME_ROLE,
            consumeXmtp: AGENT_CONSUME_XMTP,
            lockRequired: AGENT_RUNTIME_LOCK_REQUIRED,
            lockKey: AGENT_RUNTIME_LOCK_REQUIRED ? AGENT_RUNTIME_LOCK_KEY : null,
            lockOwner: runtimeLeaseState?.ownerId ?? null,
          },
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
              totalAgents: xmtpStates.length,
              states: xmtpStates,
            },
            queueWorker: {
              running: Boolean(backgroundWorker),
              stats: queueStats,
            },
          },
          validation: latestEnvValidation,
        }
      : {
          probe: probePath,
          detailed: false,
          status:
            probePath === '/readyz'
              ? ready
                ? 'ready'
                : 'not_ready'
              : statusCode >= 500
                ? 'degraded'
                : agentBooted
                  ? 'alive'
                  : 'booting',
          uptimeMs: Date.now() - runtimeStartedAtMs,
        }
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  })
  server.listen(port, () => {
    logger.info(`[eliza] Health check server listening on :${port}/healthz`)
  })
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[eliza] Fatal error: ${msg}`)
  if (err instanceof Error && err.stack) console.error(err.stack)
  logger.error('[eliza] Fatal error', {
    error: msg,
    stack: err instanceof Error ? err.stack : undefined,
  })
  void releaseRuntimeLease().finally(() => process.exit(1))
})
