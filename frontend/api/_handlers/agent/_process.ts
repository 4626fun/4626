/**
 * POST /api/agent/process
 *
 * Vercel cron-compatible one-shot message processor.
 * Loads creator agents, syncs conversations, processes recent unhandled
 * messages, sends replies, then exits.
 *
 * Designed to be called by Vercel Cron (every 1 minute) or manually.
 * Requires: CRON_SECRET (to prevent unauthorized invocations).
 * Auth is header-only: `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`).
 *
 * vercel.json:
 *   { "crons": [{ "path": "/api/agent/process", "schedule": "* * * * *" }] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Agent, createUser, createSigner } from '@xmtp/agent-sdk'
import type { Address } from 'viem'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  isDbConfigured,
  getDb,
  logger,
} from '../../../packages/server-core/src/index.js'

import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../../server/_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../../server/_lib/privyXmtpSigner.js'
import {
  findMountedAncestorPath,
  hasDedicatedMount,
  resolveXmtpDbDirectory,
} from '../../../server/_lib/xmtpDbDirectory.js'
import { executeDeterministicCommand } from '../../../server/agent/core/executeDeterministicCommand.js'


declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type FallbackCommandResult = { ok: boolean; response?: string | null; rawResponseText?: string | null }

const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const XMTP_DB_ENCRYPTION_KEY = (() => {
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
})()
const XMTP_DB_DIR = resolveXmtpDbDirectory()
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '10') // Lower limit for serverless
const MAX_MESSAGES_PER_AGENT = 20 // Process at most N messages per invocation
export const MAX_MESSAGES_PER_CONVERSATION = 50
export const DEFAULT_CHECKPOINT_WINDOW_MS = 120_000
const EXECUTION_TIMEOUT_MS = 55_000 // Leave 5s buffer for Vercel's 60s limit

const ETHEREUM_IDENTIFIER_KIND = 0
let conversationCheckpointSchemaEnsured = false
let agentMessageMemorySchemaEnsured = false

const CONVERSATION_CHECKPOINTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS creator_xmtp_agent_conversation_checkpoints (
    creator_address TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    last_processed_message_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (creator_address, conversation_id)
  );
`

const CONVERSATION_CHECKPOINTS_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS creator_xmtp_agent_conversation_checkpoints_creator_updated_idx
    ON creator_xmtp_agent_conversation_checkpoints (creator_address, updated_at DESC);
`

const AGENT_MESSAGE_MEMORY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_message_memory (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    entity_id TEXT,
    role TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    conversation_type TEXT,
    sender_address TEXT,
    content TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const AGENT_MESSAGE_MEMORY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_conversation_created_idx
    ON agent_message_memory (conversation_id, created_at DESC);
`

export function readStrictUnsupportedRetryEnabled(raw = process.env.AGENT_PROCESS_STRICT_UNSUPPORTED_RETRY): boolean {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (!normalized) return true
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function readAgentProcessRequirePersistentDb(raw = process.env.XMTP_REQUIRE_PERSISTENT_DB): boolean {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (!normalized) return true
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isAgentProcessServerlessRuntime(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    env.VERCEL ||
    env.AWS_LAMBDA_FUNCTION_NAME ||
    env.AWS_EXECUTION_ENV ||
    env.NETLIFY ||
    env.FUNCTIONS_WORKER_RUNTIME,
  )
}

export function resolveAgentProcessXmtpPersistenceError(input: {
  configuredDbDir?: string
  resolvedDbDir: string
  requirePersistentDb: boolean
  isServerless: boolean
  hasDedicatedMountResult?: boolean
  mountedAncestor?: string | null
}): string | null {
  const configuredDbDir = String(input.configuredDbDir ?? '').trim()
  const resolvedDbDir = path.resolve(input.resolvedDbDir)

  if (configuredDbDir && path.resolve(configuredDbDir) !== resolvedDbDir) {
    return (
      `XMTP_DB_DIRECTORY (${configuredDbDir}) is not writable/usable; ` +
      `agent/process resolved fallback ${resolvedDbDir}. Refusing to create XMTP installations on a fallback path.`
    )
  }

  if (!input.requirePersistentDb) return null

  if (resolvedDbDir === '/tmp' || resolvedDbDir.startsWith('/tmp/')) {
    return (
      `agent/process requires persistent XMTP storage, but the resolved DB directory is temporary (${resolvedDbDir}). ` +
      'Refusing to create or reopen XMTP agents on ephemeral storage.'
    )
  }

  if (input.isServerless && input.hasDedicatedMountResult === false) {
    const mountedAncestor = input.mountedAncestor ? ` (closest mount: ${input.mountedAncestor})` : ''
    return (
      `agent/process requires a dedicated mounted XMTP volume at ${resolvedDbDir}${mountedAncestor}. ` +
      'Refusing to create XMTP agents on a serverless root filesystem.'
    )
  }

  return null
}

const AGENT_PROCESS_STRICT_UNSUPPORTED_RETRY = readStrictUnsupportedRetryEnabled()
const XMTP_REQUIRE_PERSISTENT_DB = readAgentProcessRequirePersistentDb()
const AGENT_PROCESS_IS_SERVERLESS = isAgentProcessServerlessRuntime()

export function getCheckpointMs(lastProcessedAt: unknown, nowMs = Date.now()): number {
  if (lastProcessedAt) {
    const parsed = new Date(lastProcessedAt as any).getTime()
    if (Number.isFinite(parsed)) return parsed
  }
  return nowMs - DEFAULT_CHECKPOINT_WINDOW_MS
}

export function getInitialConversationCheckpointMs(lastProcessedAt: unknown, nowMs = Date.now()): number {
  const storedCheckpointMs = getCheckpointMs(lastProcessedAt, nowMs)
  const rollingWindowCheckpointMs = nowMs - DEFAULT_CHECKPOINT_WINDOW_MS
  return Math.max(0, Math.min(storedCheckpointMs, rollingWindowCheckpointMs))
}

export function getMessageQueryOptions(lastProcessedMs: number): {
  sentAfterNs: bigint
  limit: number
  direction: number
} {
  const ms = Math.max(0, Math.floor(lastProcessedMs))
  const cursorMs = Math.max(0, ms - 1)
  return {
    sentAfterNs: BigInt(cursorMs) * 1_000_000n,
    limit: MAX_MESSAGES_PER_CONVERSATION,
    direction: 0, // SortDirection.Ascending in @xmtp/node-bindings.
  }
}

export function getEthereumAddressFromInboxState(state: any): string | null {
  const identifiers = Array.isArray(state?.identifiers) ? state.identifiers : []
  for (const id of identifiers) {
    const kind = id?.identifierKind
    const identifier = typeof id?.identifier === 'string' ? id.identifier : ''
    if ((kind === ETHEREUM_IDENTIFIER_KIND || kind === 'Ethereum') && /^0x[a-fA-F0-9]{40}$/.test(identifier)) {
      return identifier.toLowerCase()
    }
  }
  return null
}

export function mergeCheckpointMs(previousMs: number, candidateMs: number): number {
  return Math.max(previousMs, candidateMs)
}

function shortHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32)
}

function formatAsUuid(hex32: string): string {
  const h = hex32.padEnd(32, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function toRoomId(conversationId: string): string {
  return formatAsUuid(shortHash(conversationId))
}

function toEntityId(senderAddress: string): string {
  return formatAsUuid(shortHash(senderAddress.toLowerCase()))
}

function normalizeMessageId(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.toLowerCase()
}

function toInboundMessageMemoryId(params: {
  conversationId: string
  senderAddress: string
  content: string
  messageId?: string | null
  sentAtMs?: number | null
}): string {
  const explicitMessageId = normalizeMessageId(params.messageId)
  if (explicitMessageId) {
    return formatAsUuid(shortHash(`xmtp:msg:${params.conversationId}:${explicitMessageId}`))
  }
  const sentAtMs =
    Number.isFinite(params.sentAtMs) && Number(params.sentAtMs) > 0
      ? Math.floor(Number(params.sentAtMs))
      : 0
  const fallback = `${params.conversationId}:${params.senderAddress.toLowerCase()}:${sentAtMs}:${params.content}`
  return formatAsUuid(shortHash(`xmtp:fallback:${fallback}`))
}

export function resolveFallbackCommandReply(params: {
  text: string
  result: FallbackCommandResult
}): { replyText: string; fallbackGenerated: boolean } {
  const upstreamReply = String(params.result?.rawResponseText ?? params.result?.response ?? '').trim()
  if (upstreamReply) {
    return {
      replyText: upstreamReply,
      fallbackGenerated: false,
    }
  }

  const command = String(params.text ?? '').trim().split(/\s+/g)[0] || 'Command'
  return {
    replyText: [
      `${command} is unavailable in fallback mode.`,
      '',
      'Retry when the real-time runtime is online.',
    ].join('\n'),
    fallbackGenerated: true,
  }
}

export function shouldDeferFallbackCommand(params: {
  fallbackGenerated: boolean
  strictUnsupportedRetry: boolean
}): boolean {
  return params.fallbackGenerated && params.strictUnsupportedRetry
}

export function parseConversationCheckpointRows(rows: Array<Record<string, unknown>>): Map<string, number> {
  const checkpoints = new Map<string, number>()
  for (const row of rows) {
    const conversationId = String(row.conversation_id ?? '').trim()
    if (!conversationId) continue
    const parsedMs = new Date(row.last_processed_message_at as any).getTime()
    if (!Number.isFinite(parsedMs)) continue
    checkpoints.set(conversationId, parsedMs)
  }
  return checkpoints
}

async function ensureConversationCheckpointSchema(db: any): Promise<void> {
  if (conversationCheckpointSchemaEnsured) return
  if (typeof db?.query === 'function') {
    await db.query(CONVERSATION_CHECKPOINTS_TABLE_SQL)
    await db.query(CONVERSATION_CHECKPOINTS_INDEX_SQL)
  } else {
    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_xmtp_agent_conversation_checkpoints (
        creator_address TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        last_processed_message_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (creator_address, conversation_id)
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS creator_xmtp_agent_conversation_checkpoints_creator_updated_idx
        ON creator_xmtp_agent_conversation_checkpoints (creator_address, updated_at DESC);
    `
  }
  conversationCheckpointSchemaEnsured = true
}

function toSqlStatement(sql: string): TemplateStringsArray {
  const stmt = [sql] as unknown as TemplateStringsArray
  ;(stmt as any).raw = [sql]
  return stmt
}

async function ensureAgentMessageMemorySchema(db: any): Promise<void> {
  if (agentMessageMemorySchemaEnsured) return
  if (typeof db?.query === 'function') {
    await db.query(AGENT_MESSAGE_MEMORY_TABLE_SQL)
    await db.query(AGENT_MESSAGE_MEMORY_INDEX_SQL)
  } else {
    await db.sql(toSqlStatement(AGENT_MESSAGE_MEMORY_TABLE_SQL))
    await db.sql(toSqlStatement(AGENT_MESSAGE_MEMORY_INDEX_SQL))
  }
  agentMessageMemorySchemaEnsured = true
}

async function claimInboundMessageMemory(params: {
  db: any
  memoryId: string
  creatorAddress: string
  conversationId: string
  senderAddress: string
  content: string
  messageId?: string | null
  sentAtMs: number
}): Promise<'claimed' | 'duplicate'> {
  const metadata = {
    conversationId: params.conversationId,
    conversationType: 'unknown',
    senderAddress: params.senderAddress,
    ...(normalizeMessageId(params.messageId) ? { messageId: normalizeMessageId(params.messageId) } : {}),
  }
  const createdAtIso =
    Number.isFinite(params.sentAtMs) && params.sentAtMs > 0
      ? new Date(params.sentAtMs).toISOString()
      : new Date().toISOString()
  const insertResult = await params.db.sql`
    INSERT INTO agent_message_memory (
      id, agent_id, room_id, entity_id, role, conversation_id, conversation_type, sender_address, content, metadata_json, created_at
    ) VALUES (
      ${params.memoryId},
      ${params.creatorAddress},
      ${toRoomId(params.conversationId)},
      ${toEntityId(params.senderAddress)},
      ${'user'},
      ${params.conversationId},
      ${'unknown'},
      ${params.senderAddress},
      ${params.content},
      ${JSON.stringify(metadata)}::jsonb,
      ${createdAtIso}::timestamptz
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `
  const insertedRows = Array.isArray(insertResult?.rows)
    ? insertResult.rows.length
    : Number((insertResult as any)?.rowCount ?? 0)
  return Number.isFinite(insertedRows) && insertedRows > 0 ? 'claimed' : 'duplicate'
}

async function releaseInboundMessageMemoryClaim(params: {
  db: any
  memoryId: string
}): Promise<void> {
  await params.db.sql`
    DELETE FROM agent_message_memory
    WHERE id = ${params.memoryId};
  `
}

async function loadConversationCheckpointMap(params: {
  db: any
  creatorAddress: string
}): Promise<Map<string, number>> {
  const result = await params.db.sql`
    SELECT
      conversation_id,
      last_processed_message_at
    FROM creator_xmtp_agent_conversation_checkpoints
    WHERE LOWER(creator_address) = ${params.creatorAddress};
  `
  const rows = Array.isArray(result?.rows) ? (result.rows as Array<Record<string, unknown>>) : []
  return parseConversationCheckpointRows(rows)
}

async function upsertConversationCheckpoint(params: {
  db: any
  creatorAddress: string
  conversationId: string
  checkpointMs: number
}): Promise<void> {
  const checkpointIso = new Date(params.checkpointMs).toISOString()
  await params.db.sql`
    INSERT INTO creator_xmtp_agent_conversation_checkpoints (
      creator_address,
      conversation_id,
      last_processed_message_at,
      updated_at
    ) VALUES (
      ${params.creatorAddress},
      ${params.conversationId},
      ${checkpointIso}::timestamptz,
      NOW()
    )
    ON CONFLICT (creator_address, conversation_id)
    DO UPDATE SET
      last_processed_message_at = GREATEST(
        creator_xmtp_agent_conversation_checkpoints.last_processed_message_at,
        EXCLUDED.last_processed_message_at
      ),
      updated_at = NOW();
  `
}

export function readCronSecretFromHeaders(req: VercelRequest): string {
  const cronHeader = req.headers['x-cron-secret']
  if (Array.isArray(cronHeader) && cronHeader[0]) return String(cronHeader[0]).trim()
  if (typeof cronHeader === 'string' && cronHeader.trim()) return cronHeader.trim()

  const authHeader = (req.headers.authorization ?? '').trim()
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (match?.[1]) return match[1].trim()
  return ''
}

export function isAuthorized(req: VercelRequest): boolean {
  // Vercel Cron sets the Authorization header with the CRON_SECRET.
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret) return false // Require CRON_SECRET to be configured.

  // Header-only auth: query-string secret transport is intentionally rejected.
  const provided = readCronSecretFromHeaders(req)
  return provided === cronSecret
}

function isCommandLike(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t.startsWith('/') ||
    t.startsWith('keepr') ||
    t.startsWith('send ') ||
    t.startsWith('@keepr') ||
    t.startsWith('@bot')
  )
}

function makeDbPath(): (inboxId: string) => string {
  fs.mkdirSync(XMTP_DB_DIR, { recursive: true, mode: 0o700 })
  return (inboxId: string) => path.join(XMTP_DB_DIR, `xmtp-${XMTP_ENV}-${inboxId}.db3`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Use POST' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'DB not configured' } satisfies ApiEnvelope<never>)
  }

  const encKey = (process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  if (!encKey) {
    return res.status(503).json({ success: false, error: 'XMTP_AGENT_KEY_ENCRYPTION_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  const xmtpPersistenceError = resolveAgentProcessXmtpPersistenceError({
    configuredDbDir: (process.env.XMTP_DB_DIRECTORY ?? '').trim(),
    resolvedDbDir: XMTP_DB_DIR,
    requirePersistentDb: XMTP_REQUIRE_PERSISTENT_DB,
    isServerless: AGENT_PROCESS_IS_SERVERLESS,
    hasDedicatedMountResult: hasDedicatedMount(XMTP_DB_DIR),
    mountedAncestor: findMountedAncestorPath(XMTP_DB_DIR),
  })
  if (xmtpPersistenceError) {
    logger.warn('[agent/process] refusing XMTP startup without durable storage', {
      dbDir: XMTP_DB_DIR,
      reason: xmtpPersistenceError,
    })
    return res.status(503).json({ success: false, error: xmtpPersistenceError } satisfies ApiEnvelope<never>)
  }

  const startTime = Date.now()
  let totalProcessed = 0
  let totalReplied = 0
  let agentsProcessed = 0
  let totalFallbackReplies = 0
  let totalDeferredUnsupported = 0

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ success: false, error: 'DB connection failed' } satisfies ApiEnvelope<never>)
    }
    await ensureCreatorXmtpAgentsSchema(db as any)
    await ensureConversationCheckpointSchema(db as any)
    await ensureAgentMessageMemorySchema(db as any)

    // Load agents
    const agentRows = await db.sql`
      SELECT
        creator_address,
        xmtp_agent_address,
        agent_type,
        privy_wallet_id,
        csw_address,
        last_processed_message_at,
        encrypted_private_key_b64,
        encrypted_private_key_iv_b64,
        encrypted_private_key_tag_b64
      FROM creator_xmtp_agents
      WHERE listed_publicly = TRUE
      ORDER BY updated_at DESC
      LIMIT ${MAX_AGENTS};
    `

    if (!agentRows.rows?.length) {
      return res.status(200).json({
        success: true,
        data: { agents: 0, processed: 0, replied: 0 },
      } satisfies ApiEnvelope<any>)
    }

    for (const row of agentRows.rows) {
      // Check time budget
      if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
        logger.warn('[agent/process] Time budget exceeded, stopping early')
        break
      }

      const creatorAddress = String(row.creator_address).toLowerCase()
      let agent: Agent | null = null

      try {
        const agentType = String(row.agent_type ?? 'eoa').toLowerCase()
        const privyWalletId = row.privy_wallet_id ? String(row.privy_wallet_id).trim() : null
        const cswAddress = row.csw_address ? String(row.csw_address).toLowerCase() : null
        let signer: any

        if (agentType === 'csw' && privyWalletId && cswAddress) {
          // CSW agent: sign via Privy wallet API
          signer = createPrivyScwSigner({
            walletId: privyWalletId,
            cswAddress: cswAddress as `0x${string}`,
            chainId: 8453,
          })
        } else {
          // EOA agent: decrypt private key
          const privKey = decryptPrivateKey({
            ciphertextB64: String(row.encrypted_private_key_b64),
            ivB64: String(row.encrypted_private_key_iv_b64),
            tagB64: String(row.encrypted_private_key_tag_b64),
            aad: `creator:${creatorAddress}`,
          })
          const user = createUser(privKey)
          signer = createSigner(user)
        }

        agent = await Agent.create(signer, {
          env: XMTP_ENV,
          dbPath: makeDbPath(),
          ...(XMTP_DB_ENCRYPTION_KEY ? { dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY } : {}),
        } as any)

        const client = agent.client

        // Sync conversations
        await client.conversations.sync()
        const conversations = await client.conversations.list()

        const nowMs = Date.now()
        const lastProcessed = getCheckpointMs(row.last_processed_message_at, nowMs)
        const fallbackConversationCheckpointMs = getInitialConversationCheckpointMs(row.last_processed_message_at, nowMs)
        const conversationCheckpoints = await loadConversationCheckpointMap({
          db: db as any,
          creatorAddress,
        })
        let newestTimestamp = lastProcessed
        let messagesThisAgent = 0
        let shouldStopAgentLoop = false

        for (const convo of conversations) {
          if (messagesThisAgent >= MAX_MESSAGES_PER_AGENT) break
          if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) break
          const conversationCheckpointMs = conversationCheckpoints.get(convo.id) ?? fallbackConversationCheckpointMs
          let newestConversationTimestamp = conversationCheckpointMs
          let deferredUnsupportedInConversation = false

          try {
            await convo.sync()
            // Query only recent messages to bound serverless work.
            const messages = await convo.messages(getMessageQueryOptions(conversationCheckpointMs))

            for (const msg of messages) {
              if (messagesThisAgent >= MAX_MESSAGES_PER_AGENT) {
                shouldStopAgentLoop = true
                break
              }
              if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
                shouldStopAgentLoop = true
                break
              }
              // Process messages at-or-after checkpoint so same-ms neighbors are not skipped.
              const msgTs = msg.sentAt?.getTime() ?? 0
              if (msgTs < conversationCheckpointMs) continue
              // Skip self messages
              if (msg.senderInboxId === client.inboxId) continue

              const content = typeof msg.content === 'string' ? msg.content : (msg.fallback ?? '')
              if (!content || !isCommandLike(content)) {
                newestConversationTimestamp = mergeCheckpointMs(newestConversationTimestamp, msgTs)
                continue
              }

              // Resolve sender address
              let senderAddr: string | null = null
              try {
                const states = await client.preferences.fetchInboxStates([msg.senderInboxId])
                senderAddr = getEthereumAddressFromInboxState(states?.[0])
              } catch {}

              if (!senderAddr) {
                newestConversationTimestamp = mergeCheckpointMs(newestConversationTimestamp, msgTs)
                continue
              }

              const messageId = normalizeMessageId((msg as any)?.id ?? (msg as any)?.messageId)
              const inboundMemoryId = toInboundMessageMemoryId({
                conversationId: convo.id,
                senderAddress: senderAddr,
                content,
                messageId,
                sentAtMs: msgTs,
              })
              const claimStatus = await claimInboundMessageMemory({
                db: db as any,
                memoryId: inboundMemoryId,
                creatorAddress,
                conversationId: convo.id,
                senderAddress: senderAddr,
                content,
                messageId,
                sentAtMs: msgTs,
              })
              if (claimStatus === 'duplicate') {
                newestConversationTimestamp = mergeCheckpointMs(newestConversationTimestamp, msgTs)
                continue
              }

              logger.info('[agent/process] Processing', {
                creator: creatorAddress.slice(0, 10),
                sender: senderAddr.slice(0, 10),
                text: content.slice(0, 60),
              })
              let shouldRetainClaim = false
              try {
                const result = await executeDeterministicCommand({
                  groupId: convo.id,
                  senderWallet: senderAddr.toLowerCase() as Address,
                  text: content.trim(),
                })
                const reply = resolveFallbackCommandReply({
                  text: content.trim(),
                  result,
                })
                const deferUnsupported = shouldDeferFallbackCommand({
                  fallbackGenerated: reply.fallbackGenerated,
                  strictUnsupportedRetry: AGENT_PROCESS_STRICT_UNSUPPORTED_RETRY,
                })
                if (deferUnsupported) {
                  totalDeferredUnsupported++
                  deferredUnsupportedInConversation = true
                  // Keep the memory claim and advance checkpoint beyond this message so
                  // unsupported fallback commands cannot wedge the conversation loop.
                  shouldRetainClaim = true
                  newestConversationTimestamp = mergeCheckpointMs(newestConversationTimestamp, msgTs + 1)
                  logger.warn('[agent/process] deferring unsupported command until realtime runtime is online', {
                    creator: creatorAddress.slice(0, 10),
                    convo: convo.id.slice(0, 16),
                    command: content.trim().slice(0, 64),
                  })
                  break
                }

                await convo.sendText(reply.replyText)
                totalReplied++
                if (reply.fallbackGenerated) {
                  totalFallbackReplies++
                  logger.warn('[agent/process] fallback-only command reply', {
                    creator: creatorAddress.slice(0, 10),
                    convo: convo.id.slice(0, 16),
                    command: content.trim().slice(0, 64),
                  })
                }

                shouldRetainClaim = true
                totalProcessed++
                messagesThisAgent++
                newestConversationTimestamp = mergeCheckpointMs(newestConversationTimestamp, msgTs)
              } finally {
                if (!shouldRetainClaim) {
                  await releaseInboundMessageMemoryClaim({
                    db: db as any,
                    memoryId: inboundMemoryId,
                  }).catch(() => {})
                }
              }
            }

            if (newestConversationTimestamp > conversationCheckpointMs) {
              await upsertConversationCheckpoint({
                db: db as any,
                creatorAddress,
                conversationId: convo.id,
                checkpointMs: newestConversationTimestamp,
              })
              conversationCheckpoints.set(convo.id, newestConversationTimestamp)
              newestTimestamp = mergeCheckpointMs(newestTimestamp, newestConversationTimestamp)
            }
            if (deferredUnsupportedInConversation) continue
            if (shouldStopAgentLoop) break
          } catch (err) {
            logger.error('[agent/process] Conversation error', {
              creator: creatorAddress.slice(0, 10),
              convo: convo.id.slice(0, 16),
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        const checkpointToPersist = mergeCheckpointMs(lastProcessed, newestTimestamp)
        if (checkpointToPersist > lastProcessed) {
          const newestIso = new Date(checkpointToPersist).toISOString()
          await db.sql`
            UPDATE creator_xmtp_agents
            SET
              last_processed_message_at = GREATEST(
                COALESCE(last_processed_message_at, TO_TIMESTAMP(0)),
                ${newestIso}::timestamptz
              ),
              updated_at = NOW()
            WHERE LOWER(creator_address) = ${creatorAddress};
          `
        }
        agentsProcessed++
      } catch (err) {
        logger.error('[agent/process] Agent error', {
          creator: creatorAddress.slice(0, 10),
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        try { await agent?.stop() } catch {}
      }
    }

    const elapsed = Date.now() - startTime
    logger.info('[agent/process] Complete', {
      agentsProcessed,
      totalProcessed,
      totalReplied,
      totalFallbackReplies,
      totalDeferredUnsupported,
      elapsed,
    })

    return res.status(200).json({
      success: true,
      data: {
        agents: agentsProcessed,
        processed: totalProcessed,
        replied: totalReplied,
        fallbackReplies: totalFallbackReplies,
        deferredUnsupported: totalDeferredUnsupported,
        elapsedMs: elapsed,
      },
    } satisfies ApiEnvelope<any>)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    logger.error('[agent/process] Fatal error', { error: message })
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
