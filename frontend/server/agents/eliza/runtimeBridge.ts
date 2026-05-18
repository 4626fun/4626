import { createCipheriv, createDecipheriv, createHash, createHmac, randomUUID, randomBytes } from 'node:crypto'
import type { IAgentRuntime, Memory, Plugin } from '@elizaos/core'

import { getDb } from '../../_lib/db/postgres.js'
import { buildRuntimeSessionContext } from '../../_lib/auth/session.js'
import { logger } from '../../_lib/infra/logger.js'
import { getGroveChainId, resolveLensUri, tryUploadImmutableJson } from '../../_lib/lens/lensGrove.js'
import { getElizaEmbeddingService } from './embeddings.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
  query?: (sql: string) => Promise<{ rows: any[] }>
}

type InboundMessage = {
  conversationId: string
  conversationType: string
  senderAddress: string | null
  source?: string | null
  entityKey?: string | null
  content: string
  xmtpConversationKey?: string | null
  messageId?: string | null
  sentAtMs?: number | null
}

type RankedAction = {
  action: any
  score: number
  reason: string
}

type SwarmRole = 'general' | 'trader' | 'social' | 'knowledge'

type SwarmProfile = {
  role: SwarmRole
  capabilities: string[]
}

type RuntimeBridge = {
  runtime: IAgentRuntime
  createInboundMemory: (msg: InboundMessage) => Memory
  createOutboundMemory: (
    conversationId: string,
    conversationType: string,
    content: string,
    options?: {
      source?: string | null
      senderAddress?: string | null
      metadata?: Record<string, unknown>
    },
  ) => Memory
  composeState: (memory: Memory) => Promise<Record<string, unknown>>
  rankActions: (text: string, memory: Memory) => Promise<RankedAction[]>
  getDebugState: () => { trackedConversations: number; conversationIds: string[] }
}

type WarmFactCard = {
  entity: string
  fact: string
  confidence: number
}

type WarmTaskLoop = {
  id: number
  task: string
  status: string
}

type WarmMemorySnapshot = {
  summary: string
  currentGoals: string[]
  userPreferences: string[]
  recentDecisions: string[]
  generatedAt: string
}

type SemanticRecallHit = {
  id: string
  role: string
  content: string
  createdAt: string
  score: number
}

type ArchiveTurn = {
  id: string
  role: string
  content: string
  createdAt: string
}

type ArchiveChunkPayload = {
  conversationId: string
  turns: ArchiveTurn[]
}

type EncryptedArchiveEnvelope = {
  schema: '4626.eliza.archive.chunk.v1'
  conversationId: string
  chunkHash: string
  encrypted: true
  payload: {
    alg: 'aes-256-gcm'
    iv: string
    tag: string
    ciphertext: string
    aad: string
    keyDerivation: 'hmac-sha256-conversation'
  }
}

const AGENT_MEMORY_TABLE_SQL = `
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

const AGENT_MEMORY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_conversation_created_idx
    ON agent_message_memory (conversation_id, created_at DESC);
`

const AGENT_MEMORY_AGENT_CONVERSATION_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_agent_conversation_idx
    ON agent_message_memory (agent_id, conversation_id);
`

const PGVECTOR_EXTENSION_SQL = `
  CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
`

const AGENT_MEMORY_EMBEDDING_COLUMN_SQL = `
  ALTER TABLE agent_message_memory
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);
`

const AGENT_MEMORY_EMBEDDING_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_embedding_ivfflat_idx
    ON agent_message_memory
    USING ivfflat (embedding extensions.vector_cosine_ops)
    WITH (lists = 100);
`

const AGENT_MEMORY_CONTENT_GIN_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_content_tsv_idx
    ON agent_message_memory
    USING GIN (to_tsvector('simple', content));
`

const EPISODIC_SUMMARIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS episodic_summaries (
    conversation_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1
  );
`

const FACT_CARDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS fact_cards (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT,
    entity TEXT,
    fact TEXT NOT NULL,
    confidence FLOAT,
    source_turn_id BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const FACT_CARDS_CONVERSATION_ENTITY_UNIQUE_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS fact_cards_conversation_entity_uidx
    ON fact_cards (conversation_id, entity);
`

const FACT_CARDS_ENTITY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_fact_cards_entity
    ON fact_cards(entity, conversation_id);
`

const TASK_LOOPS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS task_loops (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT,
    task TEXT NOT NULL,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const TASK_LOOPS_CONVERSATION_STATUS_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS task_loops_conversation_status_idx
    ON task_loops (conversation_id, status, created_at DESC);
`

const GROVE_CHAT_MANIFESTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS grove_chat_manifests (
    conversation_id TEXT PRIMARY KEY,
    chunk_list JSONB NOT NULL,
    root_hash TEXT NOT NULL,
    encryption_pubkey TEXT,
    last_archived_at TIMESTAMPTZ,
    lens_profile_id TEXT
  );
`

const GROVE_MANIFEST_CONVERSATION_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_manifest_conv
    ON grove_chat_manifests(conversation_id);
`

const MEMORY_SNAPSHOTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS memory_snapshots (
    conversation_id TEXT PRIMARY KEY,
    snapshot_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const AGENT_MEMORY_RLS_SQL = `
  ALTER TABLE agent_message_memory ENABLE ROW LEVEL SECURITY;
`

const AGENT_MEMORY_POLICY_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'agent_message_memory'
        AND policyname = 'agent_message_memory_deny_all'
    ) THEN
      CREATE POLICY agent_message_memory_deny_all
        ON agent_message_memory
        FOR ALL
        TO public
        USING (false)
        WITH CHECK (false);
    END IF;
  END
  $$;
`

function buildDenyAllPolicySql(tableName: string, policyName: string): {
  rlsSql: string
  policySql: string
} {
  return {
    rlsSql: `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
    policySql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = '${tableName}'
            AND policyname = '${policyName}'
        ) THEN
          CREATE POLICY ${policyName}
            ON ${tableName}
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `,
  }
}

const EPISODIC_SUMMARIES_RLS = buildDenyAllPolicySql(
  'episodic_summaries',
  'episodic_summaries_deny_all',
)
const FACT_CARDS_RLS = buildDenyAllPolicySql('fact_cards', 'fact_cards_deny_all')
const TASK_LOOPS_RLS = buildDenyAllPolicySql('task_loops', 'task_loops_deny_all')
const GROVE_CHAT_MANIFESTS_RLS = buildDenyAllPolicySql(
  'grove_chat_manifests',
  'grove_chat_manifests_deny_all',
)
const MEMORY_SNAPSHOTS_RLS = buildDenyAllPolicySql(
  'memory_snapshots',
  'memory_snapshots_deny_all',
)

let memorySchemaEnsured = false
let semanticEmbeddingColumnChecked = false
let semanticEmbeddingColumnAvailable = false
const DUPLICATE_MEMORY_MARKER = '__xmtpDuplicate'
const PERSISTED_MEMORY_MARKER = '__persistedToDb'
const embeddingService = getElizaEmbeddingService()

function shortHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32)
}

function formatAsUuid(hex32: string): string {
  const h = hex32.padEnd(32, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function toEntityId(senderAddress: string | null, stableEntityKey?: string | null): string {
  const normalizedAddress = String(senderAddress ?? '').trim().toLowerCase()
  if (normalizedAddress) return formatAsUuid(shortHash(normalizedAddress))
  const normalizedEntityKey = String(stableEntityKey ?? '').trim().toLowerCase()
  if (!normalizedEntityKey) return randomUUID()
  return formatAsUuid(shortHash(`entity:${normalizedEntityKey}`))
}

function toRoomId(conversationId: string): string {
  return formatAsUuid(shortHash(conversationId))
}

function toInboundMessageMemoryId(msg: InboundMessage): string {
  const explicitMessageId = String(msg.messageId ?? '').trim().toLowerCase()
  if (explicitMessageId) {
    return formatAsUuid(shortHash(`xmtp:msg:${msg.conversationId}:${explicitMessageId}`))
  }
  const sentAtMs =
    Number.isFinite(msg.sentAtMs) && Number(msg.sentAtMs) > 0
      ? Math.floor(Number(msg.sentAtMs))
      : 0
  const sender = String(msg.senderAddress ?? '').trim().toLowerCase() || 'unknown'
  const fallback = `${msg.conversationId}:${sender}:${sentAtMs}:${msg.content}`
  return formatAsUuid(shortHash(`xmtp:fallback:${fallback}`))
}

function asAddress(value: string | null | undefined): `0x${string}` | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function truncateForSummary(input: string, maxLength = 220): string {
  const normalized = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function normalizeAddressLower(value: string): string {
  return value.trim().toLowerCase()
}

function readArchiveEnabled(): boolean {
  return parseBoolean(process.env.ELIZA_GROVE_ARCHIVE_ENABLED, false)
}

function readArchiveRecallMaxChunks(): number {
  return parsePositiveInt(process.env.ELIZA_GROVE_RECALL_MAX_CHUNKS, 5)
}

const DEFAULT_ARCHIVE_ALLOWED_HOSTS = ['api.grove.storage'] as const

function readArchiveAllowedHosts(): string[] {
  const raw = String(process.env.ELIZA_GROVE_ARCHIVE_ALLOWED_HOSTS ?? '').trim()
  const configured = raw
    ? raw
      .split(/[,\s]+/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
    : []
  const out = new Set<string>([...DEFAULT_ARCHIVE_ALLOWED_HOSTS, ...configured])
  return [...out]
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.').map((part) => Number(part))
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) return true
    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  return false
}

function isArchiveChunkUrlAllowed(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (isPrivateOrLocalHostname(parsed.hostname)) return false

  const allowedHosts = readArchiveAllowedHosts()
  const host = parsed.hostname.toLowerCase()
  return allowedHosts.some((entry) => {
    if (!entry) return false
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1)
      return host.endsWith(suffix)
    }
    return host === entry
  })
}

function readSemanticRecallEnabled(): boolean {
  return parseBoolean(process.env.ELIZA_SEMANTIC_RECALL_ENABLED, false)
}

function readSemanticRecallTopK(): number {
  return Math.max(1, Math.min(8, parsePositiveInt(process.env.ELIZA_SEMANTIC_RECALL_TOP_K, 4)))
}

function readSemanticRecallMinLexicalScore(): number {
  const parsed = Number(process.env.ELIZA_SEMANTIC_RECALL_MIN_LEXICAL_SCORE ?? '')
  if (!Number.isFinite(parsed)) return 0.05
  return Math.max(0, Math.min(1, parsed))
}

function readArchiveEncryptionKeySeed(): Buffer | null {
  const explicit = String(process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY ?? '').trim()
  const normalized = explicit.startsWith('0x') ? explicit.slice(2) : explicit
  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex')
  }
  if (explicit) {
    try {
      const decoded = Buffer.from(explicit, 'base64')
      if (decoded.length === 32) return decoded
    } catch {
      // Ignore invalid base64 and continue to fallback key derivation.
    }
    if (explicit.length >= 16) {
      return createHash('sha256').update(explicit, 'utf8').digest()
    }
  }

  const authSecret = String(process.env.AUTH_SESSION_SECRET ?? '').trim()
  if (authSecret.length >= 16) {
    return createHash('sha256').update(`auth:${authSecret}`, 'utf8').digest()
  }
  const xmtpDbKey = String(process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  const xmtpNormalized = xmtpDbKey.startsWith('0x') ? xmtpDbKey.slice(2) : xmtpDbKey
  if (/^[a-fA-F0-9]{64}$/.test(xmtpNormalized)) {
    return Buffer.from(xmtpNormalized, 'hex')
  }
  return null
}

function normalizeArchiveKeyHint(value: unknown): Buffer | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.startsWith('0x') ? raw.slice(2) : raw
  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex')
  }
  try {
    const decoded = Buffer.from(raw, 'base64')
    if (decoded.length === 32) return decoded
  } catch {
    // Ignore invalid base64 archive key hints.
  }
  return null
}

function deriveConversationArchiveKey(params: {
  conversationId: string
  xmtpConversationKeyHint?: string | null
}): Buffer | null {
  const fromHint = normalizeArchiveKeyHint(params.xmtpConversationKeyHint ?? null)
  if (fromHint) return fromHint
  const seed = readArchiveEncryptionKeySeed()
  if (!seed) return null
  return createHmac('sha256', seed).update(`eliza-grove:${params.conversationId}`, 'utf8').digest()
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string): Buffer | null {
  try {
    const normalized = String(input ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '==='.slice((normalized.length + 3) % 4)
    return Buffer.from(padded, 'base64')
  } catch {
    return null
  }
}

function buildEncryptedArchiveEnvelope(params: {
  conversationId: string
  chunkHash: string
  payload: ArchiveChunkPayload
  xmtpConversationKeyHint?: string | null
}): EncryptedArchiveEnvelope | null {
  const key = deriveConversationArchiveKey({
    conversationId: params.conversationId,
    xmtpConversationKeyHint: params.xmtpConversationKeyHint,
  })
  if (!key) return null
  const iv = randomBytes(12)
  const aad = `conv:${params.conversationId}:hash:${params.chunkHash}:v1`
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const plaintext = Buffer.from(JSON.stringify(params.payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    schema: '4626.eliza.archive.chunk.v1',
    conversationId: params.conversationId,
    chunkHash: params.chunkHash,
    encrypted: true,
    payload: {
      alg: 'aes-256-gcm',
      iv: base64UrlEncode(iv),
      tag: base64UrlEncode(tag),
      ciphertext: base64UrlEncode(ciphertext),
      aad,
      keyDerivation: 'hmac-sha256-conversation',
    },
  }
}

function decryptArchiveEnvelope(params: {
  envelope: unknown
  xmtpConversationKeyHint?: string | null
}): ArchiveChunkPayload | null {
  const envelope = params.envelope
  if (!envelope || typeof envelope !== 'object') return null
  const record = envelope as Record<string, any>
  if (record.schema !== '4626.eliza.archive.chunk.v1' || record.encrypted !== true) return null
  const conversationId = String(record.conversationId ?? '').trim()
  if (!conversationId) return null
  const key = deriveConversationArchiveKey({
    conversationId,
    xmtpConversationKeyHint: params.xmtpConversationKeyHint,
  })
  if (!key) return null
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : null
  if (!payload) return null
  const iv = base64UrlDecode(String(payload.iv ?? ''))
  const tag = base64UrlDecode(String(payload.tag ?? ''))
  const ciphertext = base64UrlDecode(String(payload.ciphertext ?? ''))
  const aad = String(payload.aad ?? '')
  if (!iv || !tag || !ciphertext || !aad) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    const parsed = JSON.parse(plaintext) as ArchiveChunkPayload
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.turns)) return null
    return {
      conversationId: String(parsed.conversationId ?? conversationId),
      turns: parsed.turns.map((turn: any) => ({
        id: String(turn?.id ?? ''),
        role: String(turn?.role ?? 'user'),
        content: String(turn?.content ?? ''),
        createdAt: String(turn?.createdAt ?? new Date().toISOString()),
      })),
    }
  } catch {
    return null
  }
}

function normalizeArchiveTurns(input: unknown): ArchiveTurn[] {
  if (!Array.isArray(input)) return []
  return input
    .map((turn) => ({
      id: String((turn as any)?.id ?? ''),
      role: String((turn as any)?.role ?? 'user'),
      content: String((turn as any)?.content ?? ''),
      createdAt: String((turn as any)?.createdAt ?? new Date().toISOString()),
    }))
    .filter((turn) => Boolean(turn.content))
}

function parseArchiveChunkFromPayload(params: {
  json: unknown
  expectedChunkHash: string | null
  xmtpConversationKeyHint?: string | null
}): ArchiveChunkPayload | null {
  const normalizedExpectedHash =
    params.expectedChunkHash && /^[a-f0-9]{64}$/i.test(params.expectedChunkHash)
      ? params.expectedChunkHash.toLowerCase()
      : null
  if (!params.json || typeof params.json !== 'object') return null
  const record = params.json as Record<string, any>
  const decrypted = decryptArchiveEnvelope({
    envelope: record,
    xmtpConversationKeyHint: params.xmtpConversationKeyHint,
  })
  if (decrypted) {
    const hash = createHash('sha256').update(JSON.stringify(decrypted), 'utf8').digest('hex')
    if (normalizedExpectedHash && hash !== normalizedExpectedHash) return null
    return decrypted
  }

  const turns = normalizeArchiveTurns(record.turns)
  if (turns.length === 0) return null
  const conversationId = String(record.conversationId ?? '')
  const fallbackPayload: ArchiveChunkPayload = {
    conversationId: conversationId || 'unknown',
    turns,
  }
  if (normalizedExpectedHash) {
    const hash = createHash('sha256').update(JSON.stringify(fallbackPayload), 'utf8').digest('hex')
    if (hash !== normalizedExpectedHash) return null
  }
  return fallbackPayload
}

function resolveArchiveChunkUrl(chunk: Record<string, any>): string {
  const primary = String(chunk.cid ?? chunk.uri ?? chunk.lensUri ?? '').trim()
  const gateway = String(chunk.gatewayUrl ?? chunk.gateway_url ?? '').trim()
  const candidate = primary || gateway
  if (!candidate) return ''
  const resolved = candidate.startsWith('lens://') ? resolveLensUri(candidate) : candidate
  if (!/^https?:\/\//i.test(resolved)) return ''
  if (!isArchiveChunkUrlAllowed(resolved)) {
    logger.warn('[eliza/runtime] blocked archive chunk URL outside allowlist', {
      host: (() => {
        try {
          return new URL(resolved).hostname
        } catch {
          return null
        }
      })(),
      source: candidate,
    })
    return ''
  }
  return resolved
}

function archiveTurnToMemory(params: {
  turn: ArchiveTurn
  conversationId: string
  runtimeAgentId: string
}): Memory {
  const role = String(params.turn.role ?? 'user').toLowerCase() === 'assistant' ? 'assistant' : 'user'
  const createdAtMs = Number.isFinite(Date.parse(params.turn.createdAt)) ? Date.parse(params.turn.createdAt) : Date.now()
  return {
    id: (params.turn.id || randomUUID()) as any,
    entityId: (role === 'assistant' ? params.runtimeAgentId : toEntityId(null)) as any,
    agentId: params.runtimeAgentId as any,
    roomId: toRoomId(params.conversationId) as any,
    content: {
      text: String(params.turn.content ?? ''),
      role,
      source: 'xmtp',
      metadata: {
        conversationId: params.conversationId,
        conversationType: 'unknown',
        senderAddress: null,
        restoredFrom: 'grove_manifest',
      },
    } as any,
    createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
  } as Memory
}

async function hydrateConversationHistoryFromGrove(params: {
  db: Db
  conversationId: string
  runtimeAgentId: string
  maxMessagesPerConversation: number
  xmtpConversationKeyHint?: string | null
}): Promise<Memory[]> {
  if (!readArchiveEnabled()) return []
  const fetchImpl = (globalThis as any).fetch
  if (typeof fetchImpl !== 'function') return []

  const manifestResult = await params.db.sql`
    SELECT chunk_list
    FROM grove_chat_manifests
    WHERE conversation_id = ${params.conversationId}
    LIMIT 1;
  `
  const manifestRow = (manifestResult.rows?.[0] ?? null) as any
  const chunkList = Array.isArray(manifestRow?.chunk_list) ? (manifestRow.chunk_list as Array<Record<string, any>>) : []
  if (chunkList.length === 0) return []

  const recallChunks = chunkList.slice(-readArchiveRecallMaxChunks())
  const restoredTurns: ArchiveTurn[] = []
  for (const chunk of recallChunks) {
    const url = resolveArchiveChunkUrl(chunk)
    if (!url) continue
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual' })
      if (Number(response?.status ?? 0) >= 300 && Number(response?.status ?? 0) < 400) {
        logger.warn('[eliza/runtime] blocked archive chunk redirect (manual policy)', {
          conversationId: params.conversationId,
          url,
          status: response?.status ?? null,
        })
        continue
      }
      if (!response?.ok) continue
      const json = await response.json()
      const expectedChunkHash = String(chunk?.hash ?? '').trim() || null
      const parsed = parseArchiveChunkFromPayload({
        json,
        expectedChunkHash,
        xmtpConversationKeyHint: params.xmtpConversationKeyHint,
      })
      if (!parsed || parsed.turns.length === 0) continue
      restoredTurns.push(...parsed.turns)
    } catch (error) {
      logger.warn('[eliza/runtime] failed restoring grove chunk (non-blocking)', {
        conversationId: params.conversationId,
        url,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (restoredTurns.length === 0) return []
  const dedupe = new Map<string, ArchiveTurn>()
  for (const turn of restoredTurns) {
    const key = `${turn.id}:${turn.createdAt}:${turn.role}`
    if (!dedupe.has(key)) dedupe.set(key, turn)
  }
  const sortedTurns = [...dedupe.values()].sort((a, b) => {
    const left = Date.parse(a.createdAt)
    const right = Date.parse(b.createdAt)
    if (!Number.isFinite(left) && !Number.isFinite(right)) return 0
    if (!Number.isFinite(left)) return -1
    if (!Number.isFinite(right)) return 1
    return left - right
  })
  return sortedTurns
    .slice(-Math.max(10, Math.min(60, params.maxMessagesPerConversation)))
    .map((turn) =>
      archiveTurnToMemory({
        turn,
        conversationId: params.conversationId,
        runtimeAgentId: params.runtimeAgentId,
      }),
    )
}

function shouldTrackMemoryRole(role: string): boolean {
  return role === 'user' || role === 'assistant'
}

function toSqlStatement(sql: string): TemplateStringsArray {
  const stmt = [sql] as unknown as TemplateStringsArray
  ;(stmt as any).raw = [sql]
  return stmt
}

async function executeSchemaStatement(db: any, sql: string): Promise<void> {
  if (typeof db?.query === 'function') {
    await db.query(sql)
    return
  }
  await db.sql(toSqlStatement(sql))
}

async function executeOptionalSchemaStatement(db: any, sql: string): Promise<void> {
  try {
    await executeSchemaStatement(db, sql)
  } catch {
    // Ignore optional schema statements that are unsupported in constrained runtimes.
  }
}

async function ensureMemorySchema(): Promise<void> {
  if (memorySchemaEnsured) return
  const db = await getDb()
  if (!db) return

  await executeSchemaStatement(db, AGENT_MEMORY_TABLE_SQL)
  await executeOptionalSchemaStatement(db, PGVECTOR_EXTENSION_SQL)
  await executeOptionalSchemaStatement(db, AGENT_MEMORY_EMBEDDING_COLUMN_SQL)
  await executeSchemaStatement(db, EPISODIC_SUMMARIES_TABLE_SQL)
  await executeSchemaStatement(db, FACT_CARDS_TABLE_SQL)
  await executeSchemaStatement(db, TASK_LOOPS_TABLE_SQL)
  await executeSchemaStatement(db, GROVE_CHAT_MANIFESTS_TABLE_SQL)
  await executeSchemaStatement(db, MEMORY_SNAPSHOTS_TABLE_SQL)

  await executeOptionalSchemaStatement(db, AGENT_MEMORY_RLS_SQL)
  await executeOptionalSchemaStatement(db, AGENT_MEMORY_POLICY_SQL)
  await executeOptionalSchemaStatement(db, EPISODIC_SUMMARIES_RLS.rlsSql)
  await executeOptionalSchemaStatement(db, EPISODIC_SUMMARIES_RLS.policySql)
  await executeOptionalSchemaStatement(db, FACT_CARDS_RLS.rlsSql)
  await executeOptionalSchemaStatement(db, FACT_CARDS_RLS.policySql)
  await executeOptionalSchemaStatement(db, TASK_LOOPS_RLS.rlsSql)
  await executeOptionalSchemaStatement(db, TASK_LOOPS_RLS.policySql)
  await executeOptionalSchemaStatement(db, GROVE_CHAT_MANIFESTS_RLS.rlsSql)
  await executeOptionalSchemaStatement(db, GROVE_CHAT_MANIFESTS_RLS.policySql)
  await executeOptionalSchemaStatement(db, MEMORY_SNAPSHOTS_RLS.rlsSql)
  await executeOptionalSchemaStatement(db, MEMORY_SNAPSHOTS_RLS.policySql)

  await executeSchemaStatement(db, AGENT_MEMORY_INDEX_SQL)
  await executeSchemaStatement(db, AGENT_MEMORY_AGENT_CONVERSATION_INDEX_SQL)
  await executeOptionalSchemaStatement(db, AGENT_MEMORY_EMBEDDING_INDEX_SQL)
  await executeSchemaStatement(db, AGENT_MEMORY_CONTENT_GIN_INDEX_SQL)
  await executeSchemaStatement(db, FACT_CARDS_ENTITY_INDEX_SQL)
  await executeSchemaStatement(db, FACT_CARDS_CONVERSATION_ENTITY_UNIQUE_SQL)
  await executeSchemaStatement(db, TASK_LOOPS_CONVERSATION_STATUS_INDEX_SQL)
  await executeSchemaStatement(db, GROVE_MANIFEST_CONVERSATION_INDEX_SQL)

  semanticEmbeddingColumnChecked = false
  semanticEmbeddingColumnAvailable = false
  memorySchemaEnsured = true
}

async function hasSemanticEmbeddingColumn(db: Db): Promise<boolean> {
  if (semanticEmbeddingColumnChecked) return semanticEmbeddingColumnAvailable
  try {
    const result = await db.sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_message_memory'
        AND column_name = 'embedding'
      LIMIT 1;
    `
    semanticEmbeddingColumnAvailable = Array.isArray(result.rows) && result.rows.length > 0
  } catch {
    semanticEmbeddingColumnAvailable = false
  }
  semanticEmbeddingColumnChecked = true
  return semanticEmbeddingColumnAvailable
}

function toVectorLiteral(embedding: number[]): string {
  const values = embedding.map((value) => (Number.isFinite(value) ? Number(value) : 0))
  return `[${values.map((value) => value.toFixed(8)).join(',')}]`
}

function mapSemanticRecallRows(rows: any[]): SemanticRecallHit[] {
  return rows
    .map((row) => {
      const createdAtRaw = String(row?.created_at ?? '')
      const parsedCreatedAt = Date.parse(createdAtRaw)
      const createdAt = Number.isFinite(parsedCreatedAt) ? new Date(parsedCreatedAt).toISOString() : new Date().toISOString()
      return {
        id: String(row?.id ?? randomUUID()),
        role: String(row?.role ?? 'user').toLowerCase() === 'assistant' ? 'assistant' : 'user',
        content: String(row?.content ?? '').trim(),
        createdAt,
        score: Number(row?.score ?? 0),
      } satisfies SemanticRecallHit
    })
    .filter((hit) => hit.content)
}

async function loadVectorSemanticRecallHits(params: {
  db: Db
  runtimeAgentId: string
  conversationId: string
  queryText: string
  limit: number
}): Promise<SemanticRecallHit[]> {
  if (!(await hasSemanticEmbeddingColumn(params.db))) return []
  const queryEmbeddingResult = await embeddingService.embedText({
    text: params.queryText,
    correlationId: `semantic_query:${params.conversationId}`,
  })
  const queryEmbedding = queryEmbeddingResult.embedding
  if (!queryEmbedding || queryEmbedding.length === 0) return []
  const vectorLiteral = toVectorLiteral(queryEmbedding)
  const result = await params.db.sql`
    SELECT
      id,
      role,
      content,
      created_at,
      (1 - (embedding <=> ${vectorLiteral}::vector)) AS score
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId}
      AND embedding IS NOT NULL
      AND content <> ''
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${Math.max(params.limit * 2, params.limit)};
  `
  return mapSemanticRecallRows((result.rows ?? []) as any[])
}

async function loadLexicalSemanticRecallHits(params: {
  db: Db
  runtimeAgentId: string
  conversationId: string
  queryText: string
  limit: number
}): Promise<SemanticRecallHit[]> {
  const normalizedQuery = String(params.queryText ?? '').replace(/\s+/g, ' ').trim()
  if (!normalizedQuery) return []
  const result = await params.db.sql`
    SELECT
      id,
      role,
      content,
      created_at,
      ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', ${normalizedQuery})) AS score
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId}
      AND content <> ''
      AND to_tsvector('simple', content) @@ plainto_tsquery('simple', ${normalizedQuery})
    ORDER BY score DESC, created_at DESC
    LIMIT ${Math.max(params.limit * 3, params.limit)};
  `
  const minScore = readSemanticRecallMinLexicalScore()
  return mapSemanticRecallRows((result.rows ?? []) as any[]).filter((hit) => Number.isFinite(hit.score) && hit.score >= minScore)
}

async function loadSemanticRecallHits(params: {
  db: Db | null
  runtimeAgentId: string
  conversationId: string
  queryText: string
}): Promise<SemanticRecallHit[]> {
  if (!readSemanticRecallEnabled()) return []
  if (!params.db) return []
  const queryText = String(params.queryText ?? '').replace(/\s+/g, ' ').trim()
  if (!queryText) return []
  const limit = readSemanticRecallTopK()

  try {
    const vectorHits = await loadVectorSemanticRecallHits({
      db: params.db,
      runtimeAgentId: params.runtimeAgentId,
      conversationId: params.conversationId,
      queryText,
      limit,
    })
    if (vectorHits.length > 0) {
      return vectorHits.slice(0, limit)
    }
  } catch (error) {
    logger.warn('[eliza/runtime] vector semantic recall failed (non-blocking)', {
      conversationId: params.conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    const lexicalHits = await loadLexicalSemanticRecallHits({
      db: params.db,
      runtimeAgentId: params.runtimeAgentId,
      conversationId: params.conversationId,
      queryText,
      limit,
    })
    return lexicalHits.slice(0, limit)
  } catch (error) {
    logger.warn('[eliza/runtime] lexical semantic recall failed (non-blocking)', {
      conversationId: params.conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

function buildSemanticRecallBlock(hits: SemanticRecallHit[]): string {
  if (!hits.length) return '<semantic_recall />'
  const entries = hits
    .map((hit) => {
      const content = escapePromptXml(truncateForSummary(hit.content, 280))
      const role = escapePromptXml(hit.role)
      const ts = escapePromptXml(hit.createdAt)
      return `<hit role="${role}" score="${hit.score.toFixed(2)}" ts="${ts}">${content}</hit>`
    })
    .join('\n')
  return `<semantic_recall>\n${entries}\n</semantic_recall>`
}

async function maybePersistMessageEmbedding(params: {
  db: Db
  memoryId: string
  runtimeAgentId: string
  content: string
}): Promise<void> {
  if (!readSemanticRecallEnabled()) return
  if (!(await hasSemanticEmbeddingColumn(params.db))) return
  const content = String(params.content ?? '').trim()
  if (!content) return
  const embeddingResult = await embeddingService.embedText({
    text: content,
    correlationId: `semantic_persist:${params.memoryId}`,
  })
  const embedding = embeddingResult.embedding
  if (!embedding || embedding.length === 0) return
  const vectorLiteral = toVectorLiteral(embedding)
  await params.db.sql`
    UPDATE agent_message_memory
    SET embedding = ${vectorLiteral}::vector
    WHERE id = ${params.memoryId}
      AND agent_id = ${params.runtimeAgentId}
      AND embedding IS NULL;
  `
}

function extractFactCardsFromText(text: string, senderAddress: string | null): WarmFactCard[] {
  const normalizedText = String(text ?? '').trim()
  if (!normalizedText) return []
  const cards: WarmFactCard[] = []

  const walletMatches = normalizedText.match(/0x[a-fA-F0-9]{40}/g) ?? []
  if (senderAddress) {
    cards.push({
      entity: 'sender_wallet',
      fact: `sender wallet ${normalizeAddressLower(senderAddress)}`,
      confidence: 0.99,
    })
  }
  const firstWallet = walletMatches[0]
  if (firstWallet) {
    cards.push({
      entity: 'user_wallet',
      fact: `primary wallet ${normalizeAddressLower(firstWallet)}`,
      confidence: 0.97,
    })
  }

  const preferenceMatch = normalizedText.match(/\bi\s+prefer\s+([^.!?\n]+)/i)
  if (preferenceMatch?.[1]) {
    cards.push({
      entity: 'user_preference',
      fact: `prefers ${truncateForSummary(preferenceMatch[1], 120)}`,
      confidence: 0.9,
    })
  }

  const toneMatch = normalizedText.match(/\b(be|keep)\s+(it\s+)?(brief|short|concise)\b/i)
  if (toneMatch) {
    cards.push({
      entity: 'response_style',
      fact: 'prefers concise responses',
      confidence: 0.86,
    })
  }

  const nameMatch = normalizedText.match(/\bmy\s+name\s+is\s+([^.!?\n]+)/i)
  if (nameMatch?.[1]) {
    cards.push({
      entity: 'user_name',
      fact: `name ${truncateForSummary(nameMatch[1], 80)}`,
      confidence: 0.84,
    })
  }

  const byEntity = new Map<string, WarmFactCard>()
  for (const card of cards) {
    if (!card.entity || !card.fact) continue
    const existing = byEntity.get(card.entity)
    if (!existing || card.confidence > existing.confidence) {
      byEntity.set(card.entity, card)
    }
  }
  return [...byEntity.values()]
}

function extractTaskLoopsFromText(text: string): string[] {
  const normalizedText = String(text ?? '')
  if (!normalizedText.trim()) return []

  const tasks: string[] = []
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines) {
    const taskLineMatch = line.match(/^(?:[-*]\s*)?(?:todo|task)\s*:\s*(.+)$/i)
    if (taskLineMatch?.[1]) {
      tasks.push(truncateForSummary(taskLineMatch[1], 160))
    }
  }

  const inlineTaskLabelRegex = /(?:^|[\s;,.])(?:todo|task)\s*:\s*([^.!?\n]+)/gi
  let inlineTaskMatch = inlineTaskLabelRegex.exec(normalizedText)
  while (inlineTaskMatch) {
    if (inlineTaskMatch[1]) {
      tasks.push(truncateForSummary(inlineTaskMatch[1], 160))
    }
    inlineTaskMatch = inlineTaskLabelRegex.exec(normalizedText)
  }

  const needToMatch = normalizedText.match(/\bneed to\s+([^.!?\n]+)/i)
  if (needToMatch?.[1]) {
    tasks.push(truncateForSummary(needToMatch[1], 160))
  }

  const unique = new Set<string>()
  for (const task of tasks) {
    const normalized = task.trim()
    if (!normalized) continue
    unique.add(normalized)
    if (unique.size >= 3) break
  }
  return [...unique]
}

function buildEpisodicSummary(rows: Array<{ role: string; content: string }>): string {
  const userTurns = rows
    .filter((row) => row.role === 'user')
    .map((row) => truncateForSummary(row.content, 180))
    .filter(Boolean)
  const assistantTurns = rows
    .filter((row) => row.role === 'assistant')
    .map((row) => truncateForSummary(row.content, 180))
    .filter(Boolean)

  const goals = userTurns.slice(-3)
  const outcomes = assistantTurns.slice(-2)
  const lines: string[] = []
  if (goals.length > 0) {
    lines.push(`Recent user goals: ${goals.join(' | ')}`)
  }
  if (outcomes.length > 0) {
    lines.push(`Recent assistant outcomes: ${outcomes.join(' | ')}`)
  }
  if (lines.length === 0 && rows.length > 0) {
    lines.push(`Recent exchange: ${truncateForSummary(rows[rows.length - 1]?.content ?? '', 220)}`)
  }
  return lines.join('\n')
}

function buildHistoryBlock(recentMessages: Array<{ text: string; role: string; createdAt: number }>): string {
  const entries = recentMessages
    .map((entry) => {
      const iso = Number.isFinite(entry.createdAt) ? new Date(entry.createdAt).toISOString() : new Date().toISOString()
      const role = escapePromptXml(entry.role)
      const ts = escapePromptXml(iso)
      const text = escapePromptXml(truncateForSummary(entry.text, 280))
      return `<turn role="${role}" ts="${ts}">${text}</turn>`
    })
    .join('\n')
  return `<history>\n${entries}\n</history>`
}

function buildFactCardsBlock(factCards: WarmFactCard[]): string {
  const entries = factCards
    .map((card) => {
      const entity = escapePromptXml(card.entity)
      const fact = escapePromptXml(card.fact)
      return `<fact entity="${entity}" confidence="${Number(card.confidence).toFixed(2)}">${fact}</fact>`
    })
    .join('\n')
  return `<fact_cards>\n${entries}\n</fact_cards>`
}

function buildOpenTasksBlock(tasks: WarmTaskLoop[]): string {
  const entries = tasks
    .map((task) => {
      const id = escapePromptXml(task.id)
      const status = escapePromptXml(task.status)
      const label = escapePromptXml(task.task)
      return `<task id="${id}" status="${status}">${label}</task>`
    })
    .join('\n')
  return `<open_tasks>\n${entries}\n</open_tasks>`
}

function buildMemorySnapshotBlock(snapshot: WarmMemorySnapshot | null): string {
  if (!snapshot) return '<memory_snapshot />'
  const goals = snapshot.currentGoals.map((goal) => `<goal>${escapePromptXml(goal)}</goal>`).join('\n')
  const prefs = snapshot.userPreferences.map((pref) => `<preference>${escapePromptXml(pref)}</preference>`).join('\n')
  const decisions = snapshot.recentDecisions.map((decision) => `<decision>${escapePromptXml(decision)}</decision>`).join('\n')
  return [
    '<memory_snapshot>',
    `<summary>${escapePromptXml(snapshot.summary)}</summary>`,
    `<generated_at>${escapePromptXml(snapshot.generatedAt)}</generated_at>`,
    '<current_goals>',
    goals,
    '</current_goals>',
    '<user_preferences>',
    prefs,
    '</user_preferences>',
    '<recent_decisions>',
    decisions,
    '</recent_decisions>',
    '</memory_snapshot>',
  ].join('\n')
}

function escapePromptXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function upsertEpisodicSummary(params: {
  db: Db
  runtimeAgentId: string
  conversationId: string
}): Promise<string | null> {
  const result = await params.db.sql`
    SELECT role, content
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId}
    ORDER BY created_at DESC
    LIMIT 20;
  `
  const rows = ((result.rows ?? []) as any[]).slice().reverse().map((row) => ({
    role: String(row?.role ?? 'user').toLowerCase(),
    content: String(row?.content ?? ''),
  }))
  if (rows.length === 0) return null
  const summary = buildEpisodicSummary(rows)
  if (!summary.trim()) return null
  await params.db.sql`
    INSERT INTO episodic_summaries (conversation_id, summary, last_updated, version)
    VALUES (${params.conversationId}, ${summary}, NOW(), 1)
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      summary = EXCLUDED.summary,
      last_updated = NOW(),
      version = episodic_summaries.version + 1;
  `
  return summary
}

async function upsertFactCards(params: {
  db: Db
  conversationId: string
  cards: WarmFactCard[]
}): Promise<void> {
  if (!params.cards.length) return
  for (const card of params.cards) {
    await params.db.sql`
      INSERT INTO fact_cards (
        conversation_id,
        entity,
        fact,
        confidence,
        source_turn_id,
        updated_at
      )
      VALUES (
        ${params.conversationId},
        ${card.entity},
        ${card.fact},
        ${card.confidence},
        ${null},
        NOW()
      )
      ON CONFLICT (conversation_id, entity)
      DO UPDATE SET
        fact = EXCLUDED.fact,
        confidence = EXCLUDED.confidence,
        source_turn_id = EXCLUDED.source_turn_id,
        updated_at = NOW();
    `
  }
}

async function upsertTaskLoops(params: {
  db: Db
  conversationId: string
  tasks: string[]
}): Promise<void> {
  if (!params.tasks.length) return
  for (const task of params.tasks) {
    await params.db.sql`
      INSERT INTO task_loops (conversation_id, task, status, created_at)
      VALUES (${params.conversationId}, ${task}, 'open', NOW())
      ON CONFLICT DO NOTHING;
    `
  }
}

async function upsertMemorySnapshot(params: {
  db: Db
  conversationId: string
  summary: string | null
  factCards: WarmFactCard[]
  tasks: string[]
  recentAssistantMessages: string[]
}): Promise<void> {
  const snapshot: WarmMemorySnapshot = {
    summary: truncateForSummary(params.summary ?? '', 600),
    currentGoals: params.tasks.slice(0, 3),
    userPreferences: params.factCards
      .filter((card) => card.entity.includes('preference') || card.entity.includes('style'))
      .map((card) => card.fact)
      .slice(0, 3),
    recentDecisions: params.recentAssistantMessages.slice(-3).map((entry) => truncateForSummary(entry, 220)),
    generatedAt: new Date().toISOString(),
  }
  await params.db.sql`
    INSERT INTO memory_snapshots (conversation_id, snapshot_json, updated_at)
    VALUES (${params.conversationId}, ${JSON.stringify(snapshot)}::jsonb, NOW())
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      snapshot_json = EXCLUDED.snapshot_json,
      updated_at = NOW();
  `
}

async function maybeAppendGroveManifestChunk(params: {
  db: Db
  runtimeAgentId: string
  conversationId: string
  senderAddress: string | null
  xmtpConversationKeyHint?: string | null
}): Promise<void> {
  if (!readArchiveEnabled()) return
  const turnThreshold = parsePositiveInt(process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD, 200)
  const archiveIntervalMinutes = parsePositiveInt(process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES, 60)

  const countResult = await params.db.sql`
    SELECT COUNT(*)::int AS total_count
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId};
  `
  const totalCount = Number((countResult.rows?.[0] as any)?.total_count ?? 0)
  if (!Number.isFinite(totalCount) || totalCount <= 0 || totalCount % turnThreshold !== 0) return

  const manifestResult = await params.db.sql`
    SELECT chunk_list, root_hash, encryption_pubkey, last_archived_at, lens_profile_id
    FROM grove_chat_manifests
    WHERE conversation_id = ${params.conversationId}
    LIMIT 1;
  `
  const existingManifest = (manifestResult.rows?.[0] ?? null) as any
  const lastArchivedAtMs = existingManifest?.last_archived_at
    ? new Date(existingManifest.last_archived_at).getTime()
    : null
  if (Number.isFinite(lastArchivedAtMs)) {
    const minNextArchiveAt = Number(lastArchivedAtMs) + archiveIntervalMinutes * 60_000
    if (Date.now() < minNextArchiveAt) return
  }

  const chunkRowsResult = await params.db.sql`
    SELECT id, role, content, created_at
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId}
    ORDER BY created_at DESC
    LIMIT ${turnThreshold};
  `
  const chunkRows = ((chunkRowsResult.rows ?? []) as any[]).slice().reverse()
  if (chunkRows.length === 0) return

  const chunkPayload = {
    conversationId: params.conversationId,
    turns: chunkRows.map((row) => ({
      id: String(row?.id ?? ''),
      role: String(row?.role ?? 'user'),
      content: String(row?.content ?? ''),
      createdAt: row?.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
  } satisfies ArchiveChunkPayload
  const chunkHash = createHash('sha256').update(JSON.stringify(chunkPayload), 'utf8').digest('hex')
  const existingChunks = Array.isArray(existingManifest?.chunk_list) ? existingManifest.chunk_list : []
  if (existingChunks.some((entry: any) => String(entry?.hash ?? '') === chunkHash)) return

  const startTs = chunkRows[0]?.created_at ? new Date(chunkRows[0].created_at).toISOString() : new Date().toISOString()
  const endTs =
    chunkRows[chunkRows.length - 1]?.created_at
      ? new Date(chunkRows[chunkRows.length - 1].created_at).toISOString()
      : new Date().toISOString()
  const encryptedEnvelope = buildEncryptedArchiveEnvelope({
    conversationId: params.conversationId,
    chunkHash,
    payload: chunkPayload,
    xmtpConversationKeyHint: params.xmtpConversationKeyHint,
  })
  if (!encryptedEnvelope) {
    logger.warn('[eliza/runtime] grove archive skipped: encryption key unavailable', {
      conversationId: params.conversationId,
    })
    return
  }

  const upload = await tryUploadImmutableJson(encryptedEnvelope, getGroveChainId())
  const uploadOk = upload.ok
  const uploadedLensUri = uploadOk ? String(upload.result.lensUri ?? '').trim() : ''
  const uploadedGatewayUrl = uploadOk ? String(upload.result.gatewayUrl ?? '').trim() : ''

  const newChunk = {
    cid: uploadOk ? uploadedLensUri : `pending:${chunkHash}`,
    uri: uploadOk ? uploadedLensUri : null,
    gatewayUrl: uploadOk ? uploadedGatewayUrl : null,
    storageKey: uploadOk ? String(upload.result.storageKey ?? '') : null,
    time_range: { start: startTs, end: endTs },
    hash: chunkHash,
    version: 1,
    state: uploadOk ? 'uploaded' : 'upload_failed',
    uploadedAt: uploadOk ? new Date().toISOString() : null,
    uploadError: uploadOk ? null : String(upload.error ?? 'upload_failed'),
  }
  const nextChunkList = [...existingChunks, newChunk]
  const previousRoot = String(existingManifest?.root_hash ?? '')
  const nextRoot = createHash('sha256')
    .update(previousRoot ? `${previousRoot}:${chunkHash}` : chunkHash, 'utf8')
    .digest('hex')

  await params.db.sql`
    INSERT INTO grove_chat_manifests (
      conversation_id,
      chunk_list,
      root_hash,
      encryption_pubkey,
      last_archived_at,
      lens_profile_id
    )
    VALUES (
      ${params.conversationId},
      ${JSON.stringify(nextChunkList)}::jsonb,
      ${nextRoot},
      ${params.senderAddress},
      NOW(),
      ${existingManifest?.lens_profile_id ? String(existingManifest.lens_profile_id) : null}
    )
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      chunk_list = EXCLUDED.chunk_list,
      root_hash = EXCLUDED.root_hash,
      encryption_pubkey = COALESCE(EXCLUDED.encryption_pubkey, grove_chat_manifests.encryption_pubkey),
      last_archived_at = NOW(),
      lens_profile_id = COALESCE(EXCLUDED.lens_profile_id, grove_chat_manifests.lens_profile_id);
  `
}

async function persistWarmMemoryArtifacts(params: {
  db: Db
  runtimeAgentId: string
  conversationId: string
  role: string
  content: string
  senderAddress: string | null
  xmtpConversationKeyHint?: string | null
}): Promise<void> {
  const role = String(params.role ?? '').toLowerCase()
  if (!shouldTrackMemoryRole(role)) return

  const summary = await upsertEpisodicSummary({
    db: params.db,
    runtimeAgentId: params.runtimeAgentId,
    conversationId: params.conversationId,
  })
  const extractedFactCards = role === 'user' ? extractFactCardsFromText(params.content, params.senderAddress) : []
  const extractedTasks = role === 'user' ? extractTaskLoopsFromText(params.content) : []
  await upsertFactCards({
    db: params.db,
    conversationId: params.conversationId,
    cards: extractedFactCards,
  })
  await upsertTaskLoops({
    db: params.db,
    conversationId: params.conversationId,
    tasks: extractedTasks,
  })
  const recentAssistantMessagesResult = await params.db.sql`
    SELECT content
    FROM agent_message_memory
    WHERE agent_id = ${params.runtimeAgentId}
      AND conversation_id = ${params.conversationId}
      AND role = 'assistant'
    ORDER BY created_at DESC
    LIMIT 3;
  `
  const recentAssistantMessages = ((recentAssistantMessagesResult.rows ?? []) as any[])
    .map((row) => String(row?.content ?? ''))
    .filter(Boolean)
    .reverse()
  await upsertMemorySnapshot({
    db: params.db,
    conversationId: params.conversationId,
    summary,
    factCards: extractedFactCards,
    tasks: extractedTasks,
    recentAssistantMessages,
  })
  await maybeAppendGroveManifestChunk({
    db: params.db,
    runtimeAgentId: params.runtimeAgentId,
    conversationId: params.conversationId,
    senderAddress: params.senderAddress,
    xmtpConversationKeyHint: params.xmtpConversationKeyHint,
  })
}

async function loadWarmMemoryState(params: {
  db: Db | null
  conversationId: string
}): Promise<{
  summary: string | null
  factCards: WarmFactCard[]
  openTasks: WarmTaskLoop[]
  memorySnapshot: WarmMemorySnapshot | null
}> {
  if (!params.db) {
    return {
      summary: null,
      factCards: [],
      openTasks: [],
      memorySnapshot: null,
    }
  }

  const summaryResult = await params.db.sql`
    SELECT summary
    FROM episodic_summaries
    WHERE conversation_id = ${params.conversationId}
    LIMIT 1;
  `
  const summary = summaryResult.rows?.[0]?.summary ? String(summaryResult.rows[0].summary) : null

  const factsResult = await params.db.sql`
    SELECT entity, fact, confidence
    FROM fact_cards
    WHERE conversation_id = ${params.conversationId}
    ORDER BY confidence DESC NULLS LAST, updated_at DESC
    LIMIT 20;
  `
  const factCards: WarmFactCard[] = ((factsResult.rows ?? []) as any[])
    .map((row) => ({
      entity: String(row?.entity ?? ''),
      fact: String(row?.fact ?? ''),
      confidence: Number(row?.confidence ?? 0),
    }))
    .filter((card) => card.entity && card.fact)

  const taskResult = await params.db.sql`
    SELECT id, task, status
    FROM task_loops
    WHERE conversation_id = ${params.conversationId}
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 20;
  `
  const openTasks: WarmTaskLoop[] = ((taskResult.rows ?? []) as any[])
    .map((row) => ({
      id: Number(row?.id ?? 0),
      task: String(row?.task ?? ''),
      status: String(row?.status ?? 'open'),
    }))
    .filter((row) => Number.isFinite(row.id) && row.id > 0 && row.task)

  const snapshotResult = await params.db.sql`
    SELECT snapshot_json
    FROM memory_snapshots
    WHERE conversation_id = ${params.conversationId}
    LIMIT 1;
  `
  const rawSnapshotValue = snapshotResult.rows?.[0]?.snapshot_json
  const rawSnapshot =
    rawSnapshotValue && typeof rawSnapshotValue === 'string'
      ? (() => {
          try {
            return JSON.parse(rawSnapshotValue)
          } catch {
            return null
          }
        })()
      : rawSnapshotValue
  const memorySnapshot =
    rawSnapshot && typeof rawSnapshot === 'object'
      ? ({
          summary: String((rawSnapshot as any).summary ?? summary ?? ''),
          currentGoals: Array.isArray((rawSnapshot as any).currentGoals)
            ? (rawSnapshot as any).currentGoals.map((entry: unknown) => String(entry))
            : [],
          userPreferences: Array.isArray((rawSnapshot as any).userPreferences)
            ? (rawSnapshot as any).userPreferences.map((entry: unknown) => String(entry))
            : [],
          recentDecisions: Array.isArray((rawSnapshot as any).recentDecisions)
            ? (rawSnapshot as any).recentDecisions.map((entry: unknown) => String(entry))
            : [],
          generatedAt: String((rawSnapshot as any).generatedAt ?? new Date().toISOString()),
        } satisfies WarmMemorySnapshot)
      : summary
        ? {
            summary,
            currentGoals: openTasks.slice(0, 3).map((task) => task.task),
            userPreferences: factCards
              .filter((card) => card.entity.includes('preference') || card.entity.includes('style'))
              .map((card) => card.fact)
              .slice(0, 3),
            recentDecisions: [],
            generatedAt: new Date().toISOString(),
          }
        : null

  return {
    summary,
    factCards,
    openTasks,
    memorySnapshot,
  }
}

function actionScoreFromMessage(actionName: string, text: string): { score: number; reason: string } {
  const normalizedName = actionName.toLowerCase()
  const normalizedText = text.toLowerCase()

  if (normalizedText.startsWith('/keepr') && normalizedName.includes('keepr')) {
    return { score: 0.95, reason: 'prefix_/keepr' }
  }
  if (normalizedText.startsWith('/lens') && normalizedName.includes('lens')) {
    return { score: 0.92, reason: 'prefix_/lens' }
  }
  if (normalizedText.startsWith('/coin') && normalizedName.includes('zora')) {
    return { score: 0.9, reason: 'prefix_/coin' }
  }
  if (normalizedText.startsWith('/uniswap') && normalizedName.includes('uniswap')) {
    return { score: 0.93, reason: 'prefix_/uniswap' }
  }
  if (normalizedText.startsWith('/keepr') && normalizedName.includes('keepr')) {
    return { score: 0.9, reason: 'prefix_/keepr' }
  }
  if (
    (normalizedText.startsWith('/intel') ||
      normalizedText.startsWith('/funder') ||
      normalizedText.startsWith('/wallet') ||
      normalizedText.startsWith('/portfolio') ||
      normalizedText.startsWith('/labels')) &&
    normalizedName.includes('wallet')
  ) {
    return { score: 0.88, reason: 'wallet_intel_prefix' }
  }
  if (
    (normalizedText.startsWith('/reputation') || normalizedText.startsWith('/feedback')) &&
    normalizedName.includes('reputation')
  ) {
    return { score: 0.87, reason: 'reputation_prefix' }
  }
  if (
    (normalizedText.startsWith('/knowledge') || normalizedText.startsWith('/kb')) &&
    normalizedName.includes('knowledge')
  ) {
    return { score: 0.86, reason: 'knowledge_prefix' }
  }
  return { score: 0.65, reason: 'validated_action' }
}

function roleBiasForAction(input: {
  role: SwarmRole
  capabilities: string[]
  actionName: string
}): { delta: number; reason: string | null } {
  const action = input.actionName.toLowerCase()
  const roleWeights: Record<SwarmRole, string[]> = {
    general: [],
    trader: ['uniswap', 'zora', 'kpr', 'keepr'],
    social: ['lens'],
    knowledge: ['knowledge', 'reputation', 'wallet'],
  }
  const roleHints = roleWeights[input.role]
  if (roleHints.length === 0) return { delta: 0, reason: null }

  const capabilityHit = input.capabilities.some((entry) => action.includes(entry.toLowerCase()))
  if (capabilityHit) return { delta: 0.08, reason: `${input.role}_capability_match` }

  const roleHit = roleHints.some((entry) => action.includes(entry))
  if (roleHit) return { delta: 0.06, reason: `${input.role}_role_match` }
  return { delta: -0.04, reason: `${input.role}_out_of_scope` }
}

export function createRuntimeBridge(params: {
  agentKey: string
  plugins: Plugin[]
  settings?: Record<string, string>
  character?: {
    systemPrompt: string
    preferredModel?: string
  }
  history?: {
    maxConversations?: number
    maxMessagesPerConversation?: number
  }
  swarm?: {
    role?: SwarmRole
    capabilities?: string[]
  }
}): RuntimeBridge {
  const inMemoryHistory = new Map<string, Memory[]>()
  const conversationArchiveKeyHints = new Map<string, string>()
  const maxConversations = Math.max(1, Math.floor(params.history?.maxConversations ?? 250))
  const maxMessagesPerConversation = Math.max(1, Math.floor(params.history?.maxMessagesPerConversation ?? 30))
  const runtimeAgentId = formatAsUuid(shortHash(`agent:${params.agentKey}`))
  const swarmProfile: SwarmProfile = {
    role: params.swarm?.role ?? 'general',
    capabilities: Array.isArray(params.swarm?.capabilities) ? params.swarm.capabilities : [],
  }

  const trimHistoryBuckets = () => {
    while (inMemoryHistory.size > maxConversations) {
      const oldestKey = inMemoryHistory.keys().next().value
      if (!oldestKey) break
      inMemoryHistory.delete(oldestKey)
      conversationArchiveKeyHints.delete(oldestKey)
    }
  }

  const setConversationHistory = (conversationId: string, entries: Memory[]) => {
    inMemoryHistory.delete(conversationId)
    inMemoryHistory.set(conversationId, entries.slice(-maxMessagesPerConversation))
    trimHistoryBuckets()
  }

  const rememberConversationArchiveKeyHint = (conversationId: string, hint: unknown) => {
    const normalized = normalizeArchiveKeyHint(hint)
    if (!normalized) return
    conversationArchiveKeyHints.set(conversationId, `0x${normalized.toString('hex')}`)
  }

  const runtime = {
    agentId: runtimeAgentId,
    getSetting: (key: string) => {
      const fromOverride = params.settings?.[key]
      if (typeof fromOverride === 'string') return fromOverride
      const fromEnv = process.env[key]
      return typeof fromEnv === 'string' ? fromEnv : undefined
    },
    createMemory: async (memory: Memory) => {
      const memoryRecord = memory as Memory & Record<string, unknown>
      memoryRecord[PERSISTED_MEMORY_MARKER] = false
      await ensureMemorySchema()
      const conversationId = String((memory.content as any)?.metadata?.conversationId ?? memory.roomId ?? 'unknown')
      const metadata = (memory.content as any)?.metadata ?? {}
      const archiveKeyHintRaw = String(metadata?.xmtpConversationKey ?? '').trim() || null
      if (archiveKeyHintRaw) {
        rememberConversationArchiveKeyHint(conversationId, archiveKeyHintRaw)
      }
      const resolvedArchiveKeyHint = archiveKeyHintRaw ?? conversationArchiveKeyHints.get(conversationId) ?? null
      const existing = inMemoryHistory.get(conversationId) ?? []
      const duplicateInMemory = existing.some((entry) => String(entry.id) === String(memory.id))
      if (duplicateInMemory) {
        memoryRecord[DUPLICATE_MEMORY_MARKER] = true
      } else {
        existing.push(memory)
        setConversationHistory(conversationId, existing)
      }

      const db = await getDb()
      if (!db) return memory
      if (duplicateInMemory) return memory
      try {
        const insertResult = await db.sql`
          INSERT INTO agent_message_memory (
            id, agent_id, room_id, entity_id, role, conversation_id, conversation_type, sender_address, content, metadata_json
          ) VALUES (
            ${String(memory.id)},
            ${String(memory.agentId ?? runtimeAgentId)},
            ${String(memory.roomId ?? '')},
            ${String(memory.entityId ?? '')},
            ${String((memory.content as any)?.role ?? 'user')},
            ${conversationId},
            ${String((memory.content as any)?.metadata?.conversationType ?? '')},
            ${String((memory.content as any)?.metadata?.senderAddress ?? '')},
            ${String((memory.content as any)?.text ?? '')},
            ${JSON.stringify((memory.content as any)?.metadata ?? {})}::jsonb
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `
        const insertedRows =
          Array.isArray((insertResult as any)?.rows)
            ? (insertResult as any).rows.length
            : Number((insertResult as any)?.rowCount ?? 0)
        if (!Number.isFinite(insertedRows) || insertedRows <= 0) {
          memoryRecord[DUPLICATE_MEMORY_MARKER] = true
          return memory
        }
        memoryRecord[PERSISTED_MEMORY_MARKER] = true
        void maybePersistMessageEmbedding({
          db: db as any,
          memoryId: String(memory.id),
          runtimeAgentId,
          content: String((memory.content as any)?.text ?? ''),
        }).catch((error) => {
          logger.warn('[eliza/runtime] embedding write failed (non-blocking)', {
            agentKey: params.agentKey,
            conversationId,
            error: error instanceof Error ? error.message : String(error),
          })
        })
        await persistWarmMemoryArtifacts({
          db: db as any,
          runtimeAgentId,
          conversationId,
          role: String((memory.content as any)?.role ?? 'user'),
          content: String((memory.content as any)?.text ?? ''),
          senderAddress: String((memory.content as any)?.metadata?.senderAddress ?? '') || null,
          xmtpConversationKeyHint: resolvedArchiveKeyHint,
        })
      } catch (error) {
        logger.warn('[eliza/runtime] failed to persist memory (non-blocking)', {
          agentKey: params.agentKey,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      return memory
    },
    composeState: async (memory: Memory) => composeState(memory),
    processActions: async (
      memory: Memory,
      messages: Memory[],
      state: Record<string, unknown>,
      callback?: (content: any) => Promise<Memory[]>,
    ) => {
      const text = String((memory.content as any)?.text ?? '')
      const rankedActions = await rankActions(text, memory)
      for (const candidate of rankedActions) {
        try {
          await candidate.action.handler(
            runtime as any,
            memory as any,
            state as any,
            undefined,
            async (content: any) => {
              if (typeof callback === 'function') {
                return callback(content)
              }
              return messages
            },
          )
          if (typeof callback === 'function') {
            // Preserve compatibility with Eliza plugin expectations.
            return messages
          }
        } catch (error) {
          logger.warn('[eliza/runtime] action handler failed during processActions', {
            action: String(candidate.action?.name ?? 'unknown'),
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      return messages
    },
  } as unknown as IAgentRuntime

  async function hydrateConversationHistoryFromDb(
    conversationId: string,
    xmtpConversationKeyHint?: string | null,
  ): Promise<Memory[]> {
    const db = await getDb()
    if (!db) return []
    try {
      const result = await db.sql`
        SELECT
          id,
          room_id,
          entity_id,
          role,
          conversation_id,
          conversation_type,
          sender_address,
          content,
          metadata_json,
          created_at
        FROM agent_message_memory
        WHERE agent_id = ${runtimeAgentId}
          AND conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT ${Math.max(20, Math.min(60, maxMessagesPerConversation))};
      `
      const rows = ((result.rows ?? []) as any[]).slice().reverse()
      if (rows.length > 0) {
        return rows.map((row) => {
          const metadata =
            row?.metadata_json && typeof row.metadata_json === 'object'
              ? row.metadata_json
              : {}
          rememberConversationArchiveKeyHint(conversationId, (metadata as any)?.xmtpConversationKey)
          const createdAtMs = row?.created_at ? new Date(row.created_at).getTime() : Date.now()
          return {
            id: String(row?.id ?? randomUUID()) as any,
            entityId: String(row?.entity_id ?? '') as any,
            agentId: runtimeAgentId as any,
            roomId: String(row?.room_id ?? toRoomId(conversationId)) as any,
            content: {
              text: String(row?.content ?? ''),
              role: String(row?.role ?? 'user'),
              source: String((metadata as any)?.source ?? 'xmtp'),
              metadata: {
                ...metadata,
                conversationId: String(row?.conversation_id ?? conversationId),
                conversationType: String(row?.conversation_type ?? metadata?.conversationType ?? 'unknown'),
                senderAddress: row?.sender_address ? String(row.sender_address) : null,
              },
            } as any,
            createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
          } as Memory
        })
      }
      return await hydrateConversationHistoryFromGrove({
        db: db as any,
        conversationId,
        runtimeAgentId,
        maxMessagesPerConversation,
        xmtpConversationKeyHint: xmtpConversationKeyHint ?? conversationArchiveKeyHints.get(conversationId) ?? null,
      })
    } catch (error) {
      logger.warn('[eliza/runtime] failed loading persisted history (non-blocking)', {
        agentKey: params.agentKey,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  async function composeState(memory: Memory): Promise<Record<string, unknown>> {
    const metadata = (memory.content as any)?.metadata ?? {}
    const conversationId = String(metadata.conversationId ?? memory.roomId ?? 'unknown')
    const xmtpConversationKeyHint = String(metadata.xmtpConversationKey ?? '').trim() || null
    if (xmtpConversationKeyHint) {
      rememberConversationArchiveKeyHint(conversationId, xmtpConversationKeyHint)
    }
    let history = inMemoryHistory.get(conversationId) ?? []
    if (history.length === 0) {
      const restored = await hydrateConversationHistoryFromDb(
        conversationId,
        xmtpConversationKeyHint ?? conversationArchiveKeyHints.get(conversationId) ?? null,
      )
      if (restored.length > 0) {
        history = restored
        setConversationHistory(conversationId, restored)
      }
    }
    const recentMessages = history.slice(-Math.max(10, Math.min(30, maxMessagesPerConversation))).map((entry) => {
      return {
        text: String((entry.content as any)?.text ?? ''),
        role: String((entry.content as any)?.role ?? 'user'),
        createdAt: Number(entry.createdAt ?? Date.now()),
      }
    })
    const db = await getDb()
    const warmState = await loadWarmMemoryState({
      db,
      conversationId,
    }).catch((error) => {
      logger.warn('[eliza/runtime] warm memory load failed (non-blocking)', {
        agentKey: params.agentKey,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        summary: null,
        factCards: [],
        openTasks: [],
        memorySnapshot: null,
      }
    })
    const semanticRecallQueryText = String((memory.content as any)?.text ?? '')
    const semanticHitsRaw = await loadSemanticRecallHits({
      db: db as any,
      runtimeAgentId,
      conversationId,
      queryText: semanticRecallQueryText,
    })
    const recentSignatures = new Set(
      recentMessages.map((entry) => `${entry.role}:${entry.text.replace(/\s+/g, ' ').trim().toLowerCase()}`),
    )
    const normalizedCurrentQuery = semanticRecallQueryText.replace(/\s+/g, ' ').trim().toLowerCase()
    const semanticRecall = semanticHitsRaw
      .filter((hit) => {
        const normalized = hit.content.replace(/\s+/g, ' ').trim().toLowerCase()
        if (!normalized) return false
        if (normalizedCurrentQuery && normalized === normalizedCurrentQuery) return false
        const signature = `${hit.role}:${normalized}`
        return !recentSignatures.has(signature)
      })
      .slice(0, readSemanticRecallTopK())

    const historyBlock = buildHistoryBlock(recentMessages)
    const factCardsBlock = buildFactCardsBlock(warmState.factCards)
    const openTasksBlock = buildOpenTasksBlock(warmState.openTasks)
    const memorySnapshotBlock = buildMemorySnapshotBlock(warmState.memorySnapshot)
    const semanticRecallBlock = buildSemanticRecallBlock(semanticRecall)
    const senderAddress = asAddress(metadata.senderAddress)
    const session = buildRuntimeSessionContext(senderAddress)
    return {
      agentKey: params.agentKey,
      conversationId,
      conversationType: metadata.conversationType ?? 'unknown',
      recentMessages,
      historyBlock,
      factCardsBlock,
      openTasksBlock,
      memorySnapshotBlock,
      semanticRecallBlock,
      factCards: warmState.factCards,
      openTasks: warmState.openTasks,
      memorySnapshot: warmState.memorySnapshot,
      semanticRecall,
      session,
      character: {
        systemPrompt: params.character?.systemPrompt ?? '',
        preferredModel: params.character?.preferredModel ?? null,
      },
    }
  }

  function clampScore(score: number): number {
    if (!Number.isFinite(score)) return 0
    if (score < 0) return 0
    if (score > 1) return 1
    return score
  }

  async function evaluatorAdjustment(params0: {
    plugin: Plugin
    actionName: string
    memory: Memory
    state: Record<string, unknown>
  }): Promise<{ delta: number; reason: string | null }> {
    const evaluators = Array.isArray((params0.plugin as any)?.evaluators)
      ? ((params0.plugin as any).evaluators as any[])
      : []
    if (evaluators.length === 0) return { delta: 0, reason: null }

    let delta = 0
    let reason: string | null = null

    for (const evaluator of evaluators) {
      try {
        const targets = Array.isArray(evaluator?.actions)
          ? evaluator.actions.map((v: unknown) => String(v).toLowerCase())
          : []
        if (targets.length > 0 && !targets.includes(params0.actionName.toLowerCase())) continue

        if (typeof evaluator?.validate === 'function') {
          const valid = await Promise.race([
            evaluator.validate(runtime as any, params0.memory as any, params0.state as any),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000)),
          ])
          if (!valid) continue
        }

        const run = typeof evaluator?.evaluate === 'function'
          ? evaluator.evaluate(runtime as any, params0.memory as any, params0.state as any)
          : typeof evaluator?.handler === 'function'
            ? evaluator.handler(runtime as any, params0.memory as any, params0.state as any)
            : null
        if (!run) continue

        const evaluated = await Promise.race([
          Promise.resolve(run),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
        ])

        if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
          delta += Math.max(-0.25, Math.min(0.25, evaluated))
          reason = String(evaluator?.name ?? 'evaluator')
          continue
        }

        if (evaluated && typeof evaluated === 'object') {
          const maybeScore = Number((evaluated as any).score)
          if (Number.isFinite(maybeScore)) {
            // Treat 0..1 as an absolute confidence and convert to signed boost.
            const signed =
              maybeScore >= 0 && maybeScore <= 1
                ? (maybeScore - 0.5) * 0.4
                : maybeScore
            delta += Math.max(-0.25, Math.min(0.25, signed))
            reason = String((evaluated as any).reason ?? evaluator?.name ?? 'evaluator')
          }
        }
      } catch (error) {
        logger.warn('[eliza/runtime] evaluator failed (non-blocking)', {
          action: params0.actionName,
          evaluator: String((evaluator as any)?.name ?? 'unknown'),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return { delta, reason }
  }

  async function rankActions(text: string, memory: Memory): Promise<RankedAction[]> {
    const state = await composeState(memory)
    const ranked: RankedAction[] = []
    for (const plugin of params.plugins) {
      for (const action of plugin.actions ?? []) {
        let matches = false
        try {
          const validateResult = await Promise.race([
            action.validate(runtime as any, memory as any),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
          ])
          matches = Boolean(validateResult)
        } catch (error) {
          logger.warn('[eliza/runtime] action validate failed', {
            action: String(action?.name ?? 'unknown'),
            error: error instanceof Error ? error.message : String(error),
          })
        }
        if (!matches) continue
        const actionName = String(action?.name ?? 'unknown')
        const { score: baseScore, reason: baseReason } = actionScoreFromMessage(actionName, text)
        const roleBias = roleBiasForAction({
          role: swarmProfile.role,
          capabilities: swarmProfile.capabilities,
          actionName,
        })
        const evalAdjust = await evaluatorAdjustment({
          plugin,
          actionName,
          memory,
          state,
        })
        const score = clampScore(baseScore + roleBias.delta + evalAdjust.delta)
        const reasonParts = [baseReason]
        if (roleBias.reason) reasonParts.push(roleBias.reason)
        if (evalAdjust.reason) reasonParts.push(evalAdjust.reason)
        const reason = reasonParts.join('+')
        ranked.push({ action, score, reason })
      }
    }
    ranked.sort((a, b) => b.score - a.score)
    return ranked
  }

  function createInboundMemory(msg: InboundMessage): Memory {
    const xmtpConversationKey = String(msg.xmtpConversationKey ?? '').trim() || null
    const messageId = String(msg.messageId ?? '').trim() || null
    const source = String(msg.source ?? '').trim().toLowerCase() || 'xmtp'
    const entityKey = String(msg.entityKey ?? '').trim() || `${msg.conversationType}:${msg.conversationId}`
    const sentAtMs =
      Number.isFinite(msg.sentAtMs) && Number(msg.sentAtMs) > 0
        ? Math.floor(Number(msg.sentAtMs))
        : Date.now()
    if (xmtpConversationKey) {
      rememberConversationArchiveKeyHint(msg.conversationId, xmtpConversationKey)
    }
    return {
      id: toInboundMessageMemoryId({ ...msg, sentAtMs }) as any,
      entityId: toEntityId(msg.senderAddress, entityKey) as any,
      agentId: runtimeAgentId as any,
      roomId: toRoomId(msg.conversationId) as any,
      content: {
        text: msg.content,
        role: 'user',
        source,
        metadata: {
          conversationId: msg.conversationId,
          conversationType: msg.conversationType,
          senderAddress: msg.senderAddress,
          source,
          ...(messageId ? { messageId } : {}),
          ...(xmtpConversationKey ? { xmtpConversationKey } : {}),
        },
      } as any,
      createdAt: sentAtMs,
    } as Memory
  }

  function createOutboundMemory(
    conversationId: string,
    conversationType: string,
    content: string,
    options?: {
      source?: string | null
      senderAddress?: string | null
      metadata?: Record<string, unknown>
    },
  ): Memory {
    const xmtpConversationKey = conversationArchiveKeyHints.get(conversationId) ?? null
    const source = String(options?.source ?? '').trim().toLowerCase() || 'xmtp'
    const senderAddress = String(options?.senderAddress ?? '').trim() || null
    return {
      id: randomUUID() as any,
      entityId: runtimeAgentId as any,
      agentId: runtimeAgentId as any,
      roomId: toRoomId(conversationId) as any,
      content: {
        text: content,
        role: 'assistant',
        source,
        metadata: {
          conversationId,
          conversationType,
          senderAddress,
          source,
          ...(options?.metadata ?? {}),
          ...(xmtpConversationKey ? { xmtpConversationKey } : {}),
        },
      } as any,
      createdAt: Date.now(),
    } as Memory
  }

  return {
    runtime,
    createInboundMemory,
    createOutboundMemory,
    composeState,
    rankActions,
    getDebugState: () => ({
      trackedConversations: inMemoryHistory.size,
      conversationIds: [...inMemoryHistory.keys()],
    }),
  }
}

