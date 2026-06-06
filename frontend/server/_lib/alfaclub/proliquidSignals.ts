import { getDb, getDbForCron } from '../db/postgres.js'
import { ensureAlfaclubProliquidSignalSchema } from '../db/schemaBootstrap.js'
import { parseTelegramChatRef, normalizeTelegramChatIdForMatch } from './telegramChatRef.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PROLIQUID_SOURCES = [
  'https://t.me/proliquid_liquidations',
  'https://t.me/proliquid_whales',
  'https://t.me/proliquid_copy_trading',
]

const PROLIQUID_BLOCKED_COMMAND_PREFIXES = [
  '/arena',
  '/alfa',
  '/swap',
  '/deploy',
  '/keeper',
  '/hermit',
  '/meme',
  '/gmeow',
]

export type ProliquidSignalKind = 'liquidations' | 'whales' | 'copy_trading' | 'unknown'
export type ProliquidSignalConfidence = 'low' | 'medium' | 'high'

export type ProliquidSignalSource = {
  chatId: string | null
  chatHandle: string | null
  threadId: number | null
}

export type ProliquidSignalConfig = {
  enabled: boolean
  webhookSecret: string
  sources: ProliquidSignalSource[]
  destinationRoomId: string | null
  textOnly: boolean
  scorerBatchLimit: number
}

export type IngestProliquidSignalInput = {
  chatId: string
  chatUsername?: string | null
  messageId: number | null
  messageThreadId?: number | null
  userId?: string | null
  username?: string | null
  messageDateMs?: number | null
  text: string
}

export type IngestProliquidSignalResult =
  | { status: 'disabled' }
  | { status: 'skipped'; reason: string }
  | { status: 'stored'; signalKind: ProliquidSignalKind }
  | { status: 'failed'; reason: string }

export type ProliquidSignalScoreResult = {
  ok: boolean
  reason?: string
  scanned: number
  scored: number
  skipped: number
  failed: number
}

export type ProliquidScoredSignalRow = {
  source_chat_id: string
  source_message_id: number
  signal_kind: ProliquidSignalKind
  normalized_text: string
  score_confidence: ProliquidSignalConfidence | null
  score_value: number | null
  score_summary: string | null
  scored_at: string | null
  created_at: string | null
}

function normalizeEnvScalar(raw: string | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim()
  }
  return value
}

function parseBool(value: string | undefined): boolean {
  const raw = normalizeEnvScalar(value).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = normalizeEnvScalar(value)
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseProliquidSources(raw: string): ProliquidSignalSource[] {
  const parsed = raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const parsedRef = parseTelegramChatRef(entry)
      const chatId = parsedRef.chatId ? normalizeTelegramChatIdForMatch(parsedRef.chatId) : null
      const chatHandle = chatId && chatId.startsWith('@') ? chatId.toLowerCase() : null
      return {
        chatId,
        chatHandle,
        threadId: parsedRef.inferredThreadId,
      } satisfies ProliquidSignalSource
    })

  return parsed.filter((entry) => entry.chatId || entry.chatHandle)
}

function readProliquidSources(env: Record<string, string | undefined>): ProliquidSignalSource[] {
  const explicit = normalizeEnvScalar(env.PROLIQUID_SIGNALS_SOURCES)
  const raw = explicit || DEFAULT_PROLIQUID_SOURCES.join(',')
  return parseProliquidSources(raw)
}

export function readProliquidSignalConfig(
  env: Record<string, string | undefined> = process.env,
): ProliquidSignalConfig {
  const roomRaw = normalizeEnvScalar(env.PROLIQUID_SIGNALS_ROOM_ID)
  const fallbackRoom = normalizeEnvScalar(env.ALFACLUB_CHAT_ROOM_ID)
  const destinationRoomId = /^\d+$/.test(roomRaw)
    ? roomRaw
    : /^\d+$/.test(fallbackRoom)
      ? fallbackRoom
      : null

  return {
    enabled: parseBool(env.PROLIQUID_SIGNALS_ENABLED),
    webhookSecret: normalizeEnvScalar(env.PROLIQUID_SIGNALS_WEBHOOK_SECRET),
    sources: readProliquidSources(env),
    destinationRoomId,
    textOnly: parseBool(env.PROLIQUID_SIGNALS_TEXT_ONLY),
    scorerBatchLimit: parsePositiveInt(env.PROLIQUID_SIGNALS_SCORER_BATCH_LIMIT, 50, 500),
  }
}

export function detectProliquidSignalKind(value: string): ProliquidSignalKind {
  const input = String(value ?? '').toLowerCase()
  if (input.includes('liquidation')) return 'liquidations'
  if (input.includes('whale')) return 'whales'
  if (input.includes('copy_trading') || input.includes('copy-trading') || input.includes('copy trading')) {
    return 'copy_trading'
  }
  return 'unknown'
}

export function matchesProliquidSource(params: {
  chatId: string
  chatUsername?: string | null
  messageThreadId?: number | null
  config?: ProliquidSignalConfig
}): boolean {
  const config = params.config ?? readProliquidSignalConfig()
  if (!config.enabled || config.sources.length === 0) return false
  const incomingChatId = normalizeTelegramChatIdForMatch(params.chatId)
  const incomingChatHandle = String(params.chatUsername ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
  const incomingThreadId =
    typeof params.messageThreadId === 'number' && Number.isFinite(params.messageThreadId)
      ? params.messageThreadId
      : null

  return config.sources.some((source) => {
    const idMatch = source.chatId ? normalizeTelegramChatIdForMatch(source.chatId) === incomingChatId : false
    const handleMatch =
      source.chatHandle != null && incomingChatHandle.length > 0
        ? source.chatHandle.replace(/^@/, '') === incomingChatHandle
        : false
    if (!idMatch && !handleMatch) return false
    if (source.threadId == null) return true
    return source.threadId === incomingThreadId
  })
}

export function sanitizeProliquidSignalText(raw: string): {
  normalizedText: string
  blockedCommandPrefix: string | null
} {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { normalizedText: '', blockedCommandPrefix: null }
  const lower = text.toLowerCase()
  const blockedPrefix =
    PROLIQUID_BLOCKED_COMMAND_PREFIXES.find((prefix) => lower.startsWith(prefix)) ??
    (lower.startsWith('/') ? '/' : null)
  if (!blockedPrefix) return { normalizedText: text, blockedCommandPrefix: null }
  return {
    normalizedText: `signal ${text.replace(/^\/+/, '').trim()}`.trim(),
    blockedCommandPrefix: blockedPrefix,
  }
}

function parseLargestUsdAmount(text: string): number | null {
  const regex = /(\d+(?:\.\d+)?)\s*(k|m|b)?\s*\$/gi
  let match: RegExpExecArray | null = null
  let best: number | null = null
  while (true) {
    match = regex.exec(text)
    if (!match) break
    const base = Number(match[1])
    if (!Number.isFinite(base) || base <= 0) continue
    const suffix = String(match[2] ?? '').toLowerCase()
    const multiplier = suffix === 'b' ? 1_000_000_000 : suffix === 'm' ? 1_000_000 : suffix === 'k' ? 1_000 : 1
    const value = base * multiplier
    if (!Number.isFinite(value) || value <= 0) continue
    if (best == null || value > best) best = value
  }
  return best
}

function scoreSignal(params: {
  signalKind: ProliquidSignalKind
  normalizedText: string
}): {
  scoreValue: number
  confidence: ProliquidSignalConfidence
  summary: string
  metadata: Record<string, unknown>
} {
  const largestUsd = parseLargestUsdAmount(params.normalizedText)
  const matchedSymbols = ['BTC', 'ETH', 'SOL'].filter((symbol) =>
    new RegExp(`\\b${symbol}\\b`, 'i').test(params.normalizedText),
  )

  const baseScore =
    params.signalKind === 'whales' ? 55 : params.signalKind === 'liquidations' ? 45 : params.signalKind === 'copy_trading' ? 35 : 25
  const amountScore =
    largestUsd == null
      ? 0
      : largestUsd >= 10_000_000
        ? 40
        : largestUsd >= 2_500_000
          ? 30
          : largestUsd >= 500_000
            ? 18
            : largestUsd >= 100_000
              ? 10
              : 4
  const scoreValue = Math.min(100, baseScore + amountScore)
  const confidence: ProliquidSignalConfidence =
    largestUsd == null ? 'medium' : largestUsd >= 500_000 ? 'high' : largestUsd >= 100_000 ? 'medium' : 'low'

  const kindLabel =
    params.signalKind === 'liquidations'
      ? 'Liquidations'
      : params.signalKind === 'whales'
        ? 'Whales'
        : params.signalKind === 'copy_trading'
          ? 'Copy trading'
          : 'Market'
  const amountLabel = largestUsd != null ? ` • ~$${Math.round(largestUsd).toLocaleString()}` : ''
  const summary = `[ProLiquid][${kindLabel}][${confidence}] score ${scoreValue}${amountLabel}`

  return {
    scoreValue,
    confidence,
    summary,
    metadata: {
      assistiveOnly: true,
      executionBlocked: true,
      largestUsd,
      matchedSymbols,
    },
  }
}

export async function ingestProliquidSignalFromTelegram(
  input: IngestProliquidSignalInput,
): Promise<IngestProliquidSignalResult> {
  const config = readProliquidSignalConfig()
  if (!config.enabled) return { status: 'disabled' }
  if (
    !matchesProliquidSource({
      chatId: input.chatId,
      chatUsername: input.chatUsername ?? null,
      messageThreadId: input.messageThreadId ?? null,
      config,
    })
  ) {
    return { status: 'skipped', reason: 'source_mismatch' }
  }
  if (typeof input.messageId !== 'number' || !Number.isFinite(input.messageId)) {
    return { status: 'skipped', reason: 'missing_message_id' }
  }
  const db = await getDb()
  if (!db) return { status: 'failed', reason: 'db_unavailable' }
  await ensureAlfaclubProliquidSignalSchema(db as any)

  const originalText = String(input.text ?? '').trim()
  if (config.textOnly && originalText.length === 0) {
    return { status: 'skipped', reason: 'text_only_empty' }
  }
  const normalized = sanitizeProliquidSignalText(originalText)
  if (normalized.normalizedText.length === 0) {
    return { status: 'skipped', reason: 'empty_text' }
  }

  const chatIdentity = String(input.chatUsername ?? input.chatId ?? '')
  const signalKind = detectProliquidSignalKind(chatIdentity)
  const messageDateIso =
    typeof input.messageDateMs === 'number' && Number.isFinite(input.messageDateMs)
      ? new Date(input.messageDateMs).toISOString()
      : null
  try {
    await db.sql`
      INSERT INTO alfaclub.proliquid_signal_ingest (
        source_chat_id,
        source_message_id,
        source_thread_id,
        source_user_id,
        source_username,
        source_posted_at,
        destination_room_id,
        signal_kind,
        raw_text,
        normalized_text,
        ingest_status,
        score_metadata,
        updated_at
      )
      VALUES (
        ${normalizeTelegramChatIdForMatch(input.chatId)},
        ${input.messageId},
        ${typeof input.messageThreadId === 'number' && Number.isFinite(input.messageThreadId) ? input.messageThreadId : null},
        ${String(input.userId ?? '').trim() || null},
        ${String(input.username ?? '').trim() || null},
        ${messageDateIso},
        ${config.destinationRoomId},
        ${signalKind},
        ${originalText},
        ${normalized.normalizedText},
        ${'pending'},
        ${JSON.stringify({
          assistiveOnly: true,
          executionBlocked: true,
          blockedCommandPrefix: normalized.blockedCommandPrefix,
        })}::jsonb,
        NOW()
      )
      ON CONFLICT (source_chat_id, source_message_id)
      DO UPDATE SET
        source_thread_id = EXCLUDED.source_thread_id,
        source_user_id = EXCLUDED.source_user_id,
        source_username = EXCLUDED.source_username,
        source_posted_at = COALESCE(EXCLUDED.source_posted_at, alfaclub.proliquid_signal_ingest.source_posted_at),
        destination_room_id = EXCLUDED.destination_room_id,
        signal_kind = EXCLUDED.signal_kind,
        raw_text = EXCLUDED.raw_text,
        normalized_text = EXCLUDED.normalized_text,
        score_metadata = COALESCE(alfaclub.proliquid_signal_ingest.score_metadata, '{}'::jsonb) || EXCLUDED.score_metadata,
        updated_at = NOW();
    `
    return { status: 'stored', signalKind }
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message.slice(0, 160) : 'insert_failed',
    }
  }
}

export async function runProliquidSignalScoring(): Promise<ProliquidSignalScoreResult> {
  const config = readProliquidSignalConfig()
  if (!config.enabled) {
    return { ok: false, reason: 'disabled', scanned: 0, scored: 0, skipped: 0, failed: 0 }
  }
  const db = await getDbForCron()
  if (!db) {
    return { ok: false, reason: 'db_unavailable', scanned: 0, scored: 0, skipped: 0, failed: 0 }
  }
  await ensureAlfaclubProliquidSignalSchema(db as any)

  const result = await db.sql`
    SELECT source_chat_id,
           source_message_id,
           signal_kind,
           normalized_text
    FROM alfaclub.proliquid_signal_ingest
    WHERE ingest_status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${config.scorerBatchLimit};
  `
  const rows = (result.rows ?? []) as Array<{
    source_chat_id: string
    source_message_id: number
    signal_kind: ProliquidSignalKind
    normalized_text: string
  }>
  if (rows.length === 0) {
    return { ok: true, reason: 'no_pending', scanned: 0, scored: 0, skipped: 0, failed: 0 }
  }

  let scored = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const normalized = sanitizeProliquidSignalText(row.normalized_text)
    if (!normalized.normalizedText) {
      skipped += 1
      await db.sql`
        UPDATE alfaclub.proliquid_signal_ingest
        SET ingest_status = 'skipped',
            score_summary = 'Skipped empty signal payload',
            scored_at = NOW(),
            updated_at = NOW()
        WHERE source_chat_id = ${row.source_chat_id}
          AND source_message_id = ${row.source_message_id};
      `
      continue
    }
    try {
      const signalKind = detectProliquidSignalKind(row.signal_kind || row.source_chat_id)
      const scoredSignal = scoreSignal({
        signalKind,
        normalizedText: normalized.normalizedText,
      })
      await db.sql`
        UPDATE alfaclub.proliquid_signal_ingest
        SET ingest_status = 'scored',
            signal_kind = ${signalKind},
            normalized_text = ${normalized.normalizedText},
            score_confidence = ${scoredSignal.confidence},
            score_value = ${scoredSignal.scoreValue},
            score_summary = ${scoredSignal.summary},
            score_metadata = COALESCE(score_metadata, '{}'::jsonb) || ${JSON.stringify(scoredSignal.metadata)}::jsonb,
            scored_at = NOW(),
            updated_at = NOW()
        WHERE source_chat_id = ${row.source_chat_id}
          AND source_message_id = ${row.source_message_id};
      `
      scored += 1
    } catch {
      failed += 1
      await db.sql`
        UPDATE alfaclub.proliquid_signal_ingest
        SET ingest_status = 'error',
            score_summary = 'Scoring failed',
            scored_at = NOW(),
            updated_at = NOW()
        WHERE source_chat_id = ${row.source_chat_id}
          AND source_message_id = ${row.source_message_id};
      `
    }
  }

  return {
    ok: failed === 0,
    scanned: rows.length,
    scored,
    skipped,
    failed,
  }
}

export async function readScoredProliquidSignalsForRoom(params: {
  roomId: string
  startTimeMs: number
  limit: number
}): Promise<ProliquidScoredSignalRow[]> {
  const roomId = String(params.roomId ?? '').trim()
  if (!roomId) return []
  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubProliquidSignalSchema(db as any)
  const result = await db.sql`
    SELECT source_chat_id,
           source_message_id,
           signal_kind,
           normalized_text,
           score_confidence,
           score_value,
           score_summary,
           scored_at,
           created_at
    FROM alfaclub.proliquid_signal_ingest
    WHERE destination_room_id = ${roomId}
      AND ingest_status = 'scored'
      AND created_at >= ${new Date(params.startTimeMs).toISOString()}
    ORDER BY created_at ASC
    LIMIT ${Math.max(1, Math.min(500, Math.floor(params.limit || 200)))};
  `
  return (result.rows ?? []) as ProliquidScoredSignalRow[]
}
