import { randomBytes } from 'node:crypto'
import { ensureTelegramTradingSchema as ensureTelegramTradingSchemaFromBootstrap } from '../db/schemaBootstrap.js'
import { getTelemetrySampleRate, shouldSampleEvent } from '../infra/telemetrySampling.js'
import { shouldSample } from '../infra/telemetrySampling.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

// Re-exported to preserve the existing public import surface of this module.
export {
  asTrimmed,
  base64UrlDecodeToString,
  base64UrlEncode,
  createTelegramLinkStartToken,
  getTelegramLinkTokenSecret,
  hashTelegramActionToken,
  hashTelegramLinkStartToken,
  hashTelegramMiniAppSessionToken,
  isTelegramFunnelEventsEnabled,
  isTelegramFunnelEventsEnabledForChat,
  isTelegramFunnelMetricsEnabled,
  isTelegramFunnelMetricsEnabledForChat,
  mapHolderRoomMemberRow,
  mapHolderRoomPolicyRow,
  mapTelegramActiveMessageRow,
  mapTelegramInlineSignalFeedRow,
  mapTradePercentPromptRow,
  normalizeAddress,
  normalizeHolderRoomMemberStatus,
  normalizeMiniAppInitDataHash,
  normalizeRawAmount,
  normalizeTelegramUserId,
  normalizeTradeActionType,
  parseBoolean,
  parseCsvSet,
  parseGraceHours,
  parseJsonObject,
  parseTelegramLinkStartTokenRaw,
  readTelegramFunnelMetricsRolloutChatIds,
  readTelegramFunnelRolloutChatIds,
  readTelegramLinkStartToken,
  readTelegramLinkStartTokenStatus,
  signTelegramLinkPayload,
  toIso,
  type TelegramActionTokenConsumeResult,
  type TelegramActiveMessage,
  type TelegramAuctionRow,
  type TelegramChatTradePolicy,
  type TelegramFunnelMetrics,
  type TelegramHolderRoomMember,
  type TelegramHolderRoomMemberStatus,
  type TelegramHolderRoomPolicy,
  type TelegramHolderRoomRecheckRow,
  type TelegramInlineSignalFeed,
  type TelegramLinkStartTokenClaim,
  type TelegramLinkStartTokenClaimAndConsumeResult,
  type TelegramLinkStartTokenClaimResult,
  type TelegramLinkStartTokenPayload,
  type TelegramLinkStartTokenReadResult,
  type TelegramMiniAppSession,
  type TelegramMiniAppSessionReadResult,
  type TelegramPortfolioSummary,
  type TelegramScopedVault,
  type TelegramSignalRow,
  type TelegramTradePercentPrompt,
  type TelegramTradePercentPromptAction,
  type TelegramUserLink,
} from './telegramTradingHelpers.js'

// Import the helpers this module uses internally.
import {
  asTrimmed,
  base64UrlEncode,
  hashTelegramActionToken,
  hashTelegramLinkStartToken,
  hashTelegramMiniAppSessionToken,
  mapHolderRoomMemberRow,
  mapHolderRoomPolicyRow,
  mapTelegramActiveMessageRow,
  mapTelegramInlineSignalFeedRow,
  mapTradePercentPromptRow,
  normalizeAddress,
  normalizeHolderRoomMemberStatus,
  normalizeMiniAppInitDataHash,
  normalizeRawAmount,
  normalizeTelegramUserId,
  normalizeTradeActionType,
  parseGraceHours,
  parseJsonObject,
  parseTelegramLinkStartTokenRaw,
  readTelegramLinkStartToken,
  readTelegramLinkStartTokenStatus,
  toIso,
  type TelegramActionTokenConsumeResult,
  type TelegramActiveMessage,
  type TelegramAuctionRow,
  type TelegramChatTradePolicy,
  type TelegramFunnelMetrics,
  type TelegramHolderRoomMember,
  type TelegramHolderRoomMemberStatus,
  type TelegramHolderRoomPolicy,
  type TelegramHolderRoomRecheckRow,
  type TelegramInlineSignalFeed,
  type TelegramLinkStartTokenClaim,
  type TelegramLinkStartTokenClaimAndConsumeResult,
  type TelegramLinkStartTokenClaimResult,
  type TelegramLinkStartTokenPayload,
  type TelegramMiniAppSession,
  type TelegramMiniAppSessionReadResult,
  type TelegramPortfolioSummary,
  type TelegramScopedVault,
  type TelegramSignalRow,
  type TelegramTradePercentPrompt,
  type TelegramTradePercentPromptAction,
  type TelegramUserLink,
} from './telegramTradingHelpers.js'

/**
 * @deprecated These flags are retained only for backward compatibility with
 * any external test spies. The real idempotency + concurrency safety now lives
 * in schemaBootstrap.ts (withEnsureOnce).
 */
let telegramTradingSchemaEnsured = false
let telegramTradingSchemaEnsurePromise: Promise<void> | null = null

export async function claimTelegramLinkStartToken(params: {
  db: Db
  token: string
  privyUserId: string
}): Promise<TelegramLinkStartTokenClaimResult> {
  const token = asTrimmed(params.token)
  const privyUserId = asTrimmed(params.privyUserId)
  if (!token || !privyUserId) return { ok: false, reason: 'invalid' }
  const tokenStatus = readTelegramLinkStartTokenStatus(token)
  if (!tokenStatus.ok) return tokenStatus
  const payload = tokenStatus.payload
  const tokenHash = hashTelegramLinkStartToken(token)

  await params.db.sql`
    DELETE FROM telegram_link_start_token_claims
    WHERE expires_at <= NOW();
  `
  const claimed = await params.db.sql`
    INSERT INTO telegram_link_start_token_claims (
      token_hash,
      telegram_user_id,
      chat_id,
      privy_user_id,
      expires_at
    )
    VALUES (
      ${tokenHash},
      ${payload.telegramUserId},
      ${payload.chatId},
      ${privyUserId},
      ${payload.expiresAt}
    )
    ON CONFLICT (token_hash) DO NOTHING
    RETURNING token_hash;
  `
  if (claimed.rows?.[0]?.token_hash) {
    return { ok: true, payload, state: 'claimed' }
  }

  const existing = await params.db.sql`
    SELECT privy_user_id, expires_at, consumed_at
    FROM telegram_link_start_token_claims
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const row = existing.rows?.[0]
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.consumed_at) return { ok: false, reason: 'consumed' }
  const expiresAtMs = Date.parse(String(row.expires_at ?? ''))
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  if (asTrimmed(row.privy_user_id) !== privyUserId) {
    return { ok: false, reason: 'claimed_by_other_user' }
  }
  return { ok: true, payload, state: 'reused' }
}

export async function claimAndConsumeTelegramLinkStartToken(params: {
  db: Db
  token: string
  privyUserId: string
}): Promise<TelegramLinkStartTokenClaimAndConsumeResult> {
  const token = asTrimmed(params.token)
  const privyUserId = asTrimmed(params.privyUserId)
  if (!token || !privyUserId) return { ok: false, reason: 'invalid' }
  const tokenStatus = readTelegramLinkStartTokenStatus(token)
  if (!tokenStatus.ok) return tokenStatus
  const payload = tokenStatus.payload
  const tokenHash = hashTelegramLinkStartToken(token)

  await params.db.sql`
    DELETE FROM telegram_link_start_token_claims
    WHERE expires_at <= NOW();
  `

  const insertedConsumed = await params.db.sql`
    INSERT INTO telegram_link_start_token_claims (
      token_hash,
      telegram_user_id,
      chat_id,
      privy_user_id,
      expires_at,
      consumed_at
    )
    VALUES (
      ${tokenHash},
      ${payload.telegramUserId},
      ${payload.chatId},
      ${privyUserId},
      ${payload.expiresAt},
      NOW()
    )
    ON CONFLICT (token_hash) DO NOTHING
    RETURNING token_hash;
  `
  if (insertedConsumed.rows?.[0]?.token_hash) {
    return { ok: true, payload, state: 'consumed' }
  }

  const existing = await params.db.sql`
    SELECT privy_user_id, expires_at, consumed_at
    FROM telegram_link_start_token_claims
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const row = existing.rows?.[0]
  if (!row) return { ok: false, reason: 'invalid' }

  const existingPrivyUserId = asTrimmed(row.privy_user_id)
  const expiresAtMs = Date.parse(String(row.expires_at ?? ''))
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired', existingPrivyUserId }
  }
  if (existingPrivyUserId.toLowerCase() !== privyUserId.toLowerCase()) {
    return { ok: false, reason: 'claimed_by_other_user', existingPrivyUserId }
  }
  if (row.consumed_at) {
    return {
      ok: false,
      reason: 'consumed',
      existingPrivyUserId,
      consumedAt: toIso(row.consumed_at),
    }
  }

  const consumeLegacyClaim = await params.db.sql`
    UPDATE telegram_link_start_token_claims
    SET consumed_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND privy_user_id = ${privyUserId}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING consumed_at;
  `
  if (consumeLegacyClaim.rows?.[0]?.consumed_at) {
    return { ok: true, payload, state: 'consumed' }
  }

  return { ok: false, reason: 'invalid', existingPrivyUserId }
}

export async function consumeTelegramLinkStartToken(params: {
  db: Db
  token: string
  privyUserId: string
}): Promise<boolean> {
  const token = asTrimmed(params.token)
  const privyUserId = asTrimmed(params.privyUserId)
  if (!token || !privyUserId) return false
  const tokenHash = hashTelegramLinkStartToken(token)
  const consumed = await params.db.sql`
    UPDATE telegram_link_start_token_claims
    SET consumed_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND privy_user_id = ${privyUserId}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING token_hash;
  `
  return Boolean(consumed.rows?.[0]?.token_hash)
}

export async function finalizeTelegramLinkStartTokenConsumption(params: {
  db: Db
  token: string
  privyUserId: string
}): Promise<'consumed' | 'other_user' | 'missing' | 'expired'> {
  const token = asTrimmed(params.token)
  const privyUserId = asTrimmed(params.privyUserId)
  if (!token || !privyUserId) return 'missing'
  const tokenHash = hashTelegramLinkStartToken(token)
  const consumed = await params.db.sql`
    UPDATE telegram_link_start_token_claims
    SET consumed_at = COALESCE(consumed_at, NOW())
    WHERE token_hash = ${tokenHash}
      AND privy_user_id = ${privyUserId}
      AND expires_at > NOW()
    RETURNING consumed_at;
  `
  if (consumed.rows?.[0]?.consumed_at) {
    return 'consumed'
  }

  const existing = await params.db.sql`
    SELECT privy_user_id, expires_at, consumed_at
    FROM telegram_link_start_token_claims
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const row = existing.rows?.[0]
  if (!row) return 'missing'
  if (asTrimmed(row.privy_user_id).toLowerCase() !== privyUserId.toLowerCase()) return 'other_user'
  const expiresAtMs = Date.parse(String(row.expires_at ?? ''))
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) return 'expired'
  return row.consumed_at ? 'consumed' : 'missing'
}

export async function readTelegramLinkStartTokenClaim(params: {
  db: Db
  token: string
}): Promise<TelegramLinkStartTokenClaim | null> {
  const token = asTrimmed(params.token)
  if (!token) return null
  const tokenHash = hashTelegramLinkStartToken(token)
  const result = await params.db.sql`
    SELECT telegram_user_id, chat_id, privy_user_id, expires_at, consumed_at, created_at
    FROM telegram_link_start_token_claims
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return null
  return {
    telegramUserId: String(row.telegram_user_id),
    chatId: asTrimmed(row.chat_id),
    privyUserId: asTrimmed(row.privy_user_id),
    expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
    consumedAt: toIso(row.consumed_at),
    createdAt: toIso(row.created_at),
  }
}

function mapTelegramMiniAppSessionRow(row: any): TelegramMiniAppSession {
  return {
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: asTrimmed(row.telegram_username) || null,
    chatId: asTrimmed(row.chat_id) || null,
    chatType: asTrimmed(row.chat_type) || null,
    chatInstance: asTrimmed(row.chat_instance) || null,
    initDataHash: asTrimmed(row.init_data_hash).toLowerCase(),
    authDate: Math.max(0, Math.trunc(Number(row.auth_date || 0))),
    expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
    createdAt: toIso(row.created_at),
    lastUsedAt: toIso(row.last_used_at),
    revokedAt: toIso(row.revoked_at),
  }
}

export async function claimTelegramMiniAppReplayNonce(params: {
  db: Db
  initDataHash: string
  telegramUserId: string | number | bigint
  authDate: number
  ttlSeconds?: number
}): Promise<boolean> {
  const initDataHash = normalizeMiniAppInitDataHash(params.initDataHash)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const authDate = Math.trunc(Number(params.authDate))
  if (!initDataHash || !userId || !Number.isInteger(authDate) || authDate <= 0) {
    return false
  }
  const ttlSeconds = Math.max(30, Math.min(60 * 60, Math.floor(Number(params.ttlSeconds ?? 60 * 15))))
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  await params.db.sql`
    DELETE FROM telegram_miniapp_replay_nonces
    WHERE expires_at <= NOW();
  `
  const claimed = await params.db.sql`
    INSERT INTO telegram_miniapp_replay_nonces (
      init_data_hash,
      telegram_user_id,
      auth_date,
      expires_at
    )
    VALUES (
      ${initDataHash},
      ${userId},
      ${authDate},
      ${expiresAt}
    )
    ON CONFLICT (init_data_hash) DO NOTHING
    RETURNING init_data_hash;
  `
  return Boolean(claimed.rows?.[0]?.init_data_hash)
}

export async function createTelegramMiniAppSession(params: {
  db: Db
  telegramUserId: string | number | bigint
  telegramUsername?: string | null
  chatId?: string | null
  chatType?: string | null
  chatInstance?: string | null
  initDataHash: string
  authDate: number
  ttlSeconds?: number
}): Promise<{ sessionToken: string; expiresAt: string; session: TelegramMiniAppSession } | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const telegramUsername = asTrimmed(params.telegramUsername ?? '') || null
  const chatId = asTrimmed(params.chatId ?? '') || null
  const chatType = asTrimmed(params.chatType ?? '') || null
  const chatInstance = asTrimmed(params.chatInstance ?? '') || null
  const initDataHash = normalizeMiniAppInitDataHash(params.initDataHash)
  const authDate = Math.trunc(Number(params.authDate))
  if (!userId || !initDataHash || !Number.isInteger(authDate) || authDate <= 0) {
    return null
  }
  const ttlSeconds = Math.max(60, Math.min(60 * 60, Math.floor(Number(params.ttlSeconds ?? 60 * 10))))
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  const sessionToken = randomBytes(24).toString('base64url')
  const tokenHash = hashTelegramMiniAppSessionToken(sessionToken)
  await params.db.sql`
    DELETE FROM telegram_miniapp_sessions
    WHERE revoked_at IS NOT NULL OR expires_at <= NOW();
  `
  const inserted = await params.db.sql`
    INSERT INTO telegram_miniapp_sessions (
      token_hash,
      telegram_user_id,
      telegram_username,
      chat_id,
      chat_type,
      chat_instance,
      init_data_hash,
      auth_date,
      expires_at
    )
    VALUES (
      ${tokenHash},
      ${userId},
      ${telegramUsername},
      ${chatId},
      ${chatType},
      ${chatInstance},
      ${initDataHash},
      ${authDate},
      ${expiresAt}
    )
    RETURNING telegram_user_id, telegram_username, chat_id, chat_type, chat_instance, init_data_hash, auth_date, expires_at, created_at, last_used_at, revoked_at;
  `
  const row = inserted.rows?.[0]
  if (!row) return null
  return {
    sessionToken,
    expiresAt: toIso(row.expires_at) ?? expiresAt,
    session: mapTelegramMiniAppSessionRow(row),
  }
}

export async function findReusableTelegramMiniAppSession(params: {
  db: Db
  telegramUserId: string | number | bigint
  chatId?: string | null
  initDataHash: string
  authDate: number
}): Promise<TelegramMiniAppSession | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId ?? '') || null
  const initDataHash = normalizeMiniAppInitDataHash(params.initDataHash)
  const authDate = Math.trunc(Number(params.authDate))
  if (!userId || !initDataHash || !Number.isInteger(authDate) || authDate <= 0) {
    return null
  }
  const lookup = await params.db.sql`
    SELECT telegram_user_id, telegram_username, chat_id, chat_type, chat_instance, init_data_hash, auth_date, expires_at, created_at, last_used_at, revoked_at
    FROM telegram_miniapp_sessions
    WHERE telegram_user_id = ${userId}
      AND init_data_hash = ${initDataHash}
      AND auth_date = ${authDate}
      AND revoked_at IS NULL
      AND expires_at > NOW()
      AND (
        (${chatId} IS NULL AND chat_id IS NULL)
        OR chat_id = ${chatId}
      )
    ORDER BY expires_at DESC
    LIMIT 1;
  `
  const row = lookup.rows?.[0]
  return row ? mapTelegramMiniAppSessionRow(row) : null
}

export async function readTelegramMiniAppSession(params: {
  db: Db
  sessionToken: string
}): Promise<TelegramMiniAppSessionReadResult> {
  const sessionToken = asTrimmed(params.sessionToken)
  if (!sessionToken) return { ok: false, reason: 'invalid' }
  const tokenHash = hashTelegramMiniAppSessionToken(sessionToken)
  const active = await params.db.sql`
    UPDATE telegram_miniapp_sessions
    SET last_used_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    RETURNING telegram_user_id, telegram_username, chat_id, chat_type, chat_instance, init_data_hash, auth_date, expires_at, created_at, last_used_at, revoked_at;
  `
  const row = active.rows?.[0]
  if (row) {
    return { ok: true, session: mapTelegramMiniAppSessionRow(row) }
  }
  const lookup = await params.db.sql`
    SELECT telegram_user_id, telegram_username, chat_id, chat_type, chat_instance, init_data_hash, auth_date, expires_at, created_at, last_used_at, revoked_at
    FROM telegram_miniapp_sessions
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const existing = lookup.rows?.[0]
  if (!existing) return { ok: false, reason: 'invalid' }
  if (existing.revoked_at) return { ok: false, reason: 'revoked' }
  const expiresAtMs = Date.parse(String(existing.expires_at ?? ''))
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: false, reason: 'invalid' }
}

export async function createTelegramActionToken(params: {
  db: Db
  telegramUserId: string | number | bigint
  chatId: string
  actionType: string
  intentPayload: Record<string, any>
  ttlSeconds?: number
}): Promise<{ token: string; expiresAt: string }> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId)
  const actionType = asTrimmed(params.actionType).toLowerCase()
  if (!userId || !chatId || !actionType) {
    throw new Error('invalid_telegram_action_token_payload')
  }
  const ttlSeconds = Math.max(30, Math.min(60 * 15, Math.floor(Number(params.ttlSeconds ?? 90))))
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  const token = randomBytes(18).toString('base64url')
  const tokenHash = hashTelegramActionToken(token)

  // High-volume short-lived action tokens (Telegram trading/automation).
  // Always issue the token to the caller; only thin the durable row when sampling < 1.
  const sampleKey = `${userId}:${actionType}`
  if (!shouldSampleEvent('telegram_action_tokens', sampleKey)) {
    // Token is still returned and usable — we simply skip persisting the row for volume control.
    return { token, expiresAt }
  }

  // Optional observability: surface the effective rate for this table (new helper).
  const effectiveRate = getTelemetrySampleRate('telegram_action_tokens')
  if (effectiveRate < 1) {
    // One-time style note; in hot paths this can be gated further or sent to structured logs.
    // console.debug('[telemetry] sampling telegram_action_tokens', { rate: effectiveRate })
  }

  await params.db.sql`
    INSERT INTO telegram_action_tokens (
      token_hash,
      telegram_user_id,
      chat_id,
      action_type,
      intent_payload_json,
      expires_at
    )
    VALUES (
      ${tokenHash},
      ${userId},
      ${chatId},
      ${actionType},
      ${params.intentPayload ?? {}},
      ${expiresAt}
    );
  `
  return { token, expiresAt }
}

export async function consumeTelegramActionToken(params: {
  db: Db
  token: string
  telegramUserId: string | number | bigint
  chatId: string
  actionType?: string
}): Promise<TelegramActionTokenConsumeResult> {
  const token = asTrimmed(params.token)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId)
  const actionType = asTrimmed(params.actionType ?? '').toLowerCase()
  if (!token || !userId || !chatId) {
    return { ok: false, reason: 'not_found' }
  }
  const tokenHash = hashTelegramActionToken(token)

  const consumed = await params.db.sql`
    UPDATE telegram_action_tokens
    SET consumed_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND consumed_at IS NULL
      AND expires_at > NOW()
      AND telegram_user_id = ${userId}
      AND chat_id = ${chatId}
      AND (${actionType} = '' OR action_type = ${actionType})
    RETURNING action_type, intent_payload_json, expires_at, consumed_at;
  `
  const row = consumed.rows?.[0]
  if (row) {
    return {
      ok: true,
      actionType: asTrimmed(row.action_type) || actionType || 'unknown',
      intentPayload: parseJsonObject(row.intent_payload_json),
      expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
      consumedAt: toIso(row.consumed_at) ?? new Date().toISOString(),
    }
  }

  const lookup = await params.db.sql`
    SELECT telegram_user_id, chat_id, action_type, expires_at, consumed_at
    FROM telegram_action_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const existing = lookup.rows?.[0]
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.consumed_at) return { ok: false, reason: 'consumed' }
  const expiresAtMs = Date.parse(String(existing.expires_at ?? ''))
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  const existingUserId = normalizeTelegramUserId(existing.telegram_user_id)
  const existingChatId = asTrimmed(existing.chat_id)
  const existingActionType = asTrimmed(existing.action_type).toLowerCase()
  if (existingUserId !== userId || existingChatId !== chatId || (actionType && existingActionType !== actionType)) {
    return { ok: false, reason: 'scope_mismatch' }
  }
  return { ok: false, reason: 'not_found' }
}

export async function logTelegramActionAudit(params: {
  db: Db
  telegramUserId: string | number | bigint
  chatId: string
  messageId?: number | null
  profileId: number
  canonicalCswAddress: string | null
  actionType: string
  intent: Record<string, any>
  quote?: Record<string, any> | null
  execution?: Record<string, any> | null
  status: string
  txHash?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  correlationId?: string | null
}): Promise<void> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId)
  const canonical = asTrimmed(params.canonicalCswAddress).toLowerCase()
  const actionType = asTrimmed(params.actionType).toLowerCase()
  const status = asTrimmed(params.status).toLowerCase() || 'unknown'
  if (!userId || !chatId || !canonical || !actionType) return

  // Telegram action audit (trading/automation). Sample for volume control while preserving per-user traces.
  if (!shouldSampleEvent('telegram_action_audit', `${userId}:${actionType}`)) {
    return
  }

  await params.db.sql`
    INSERT INTO telegram_action_audit (
      telegram_user_id,
      chat_id,
      message_id,
      profile_id,
      canonical_csw_address,
      action_type,
      intent_json,
      quote_json,
      execution_json,
      status,
      tx_hash,
      error_code,
      error_message,
      correlation_id
    )
    VALUES (
      ${userId},
      ${chatId},
      ${typeof params.messageId === 'number' ? Math.trunc(params.messageId) : null},
      ${Math.trunc(Number(params.profileId))},
      ${canonical},
      ${actionType},
      ${params.intent ?? {}},
      ${params.quote ?? null},
      ${params.execution ?? null},
      ${status},
      ${asTrimmed(params.txHash ?? '') || null},
      ${asTrimmed(params.errorCode ?? '') || null},
      ${asTrimmed(params.errorMessage ?? '') || null},
      ${asTrimmed(params.correlationId ?? '') || null}
    );
  `
}

export async function logTelegramFunnelEvent(params: {
  db: Db
  telegramUserId?: string | number | bigint | null
  chatId?: string | null
  eventName: string
  actionType?: string | null
  context?: Record<string, any> | null
}): Promise<void> {
  const eventName = asTrimmed(params.eventName).toLowerCase()
  if (!eventName) return
  const userId =
    typeof params.telegramUserId === 'undefined' || params.telegramUserId === null
      ? null
      : normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId ?? '') || null
  const actionType = asTrimmed(params.actionType ?? '').toLowerCase() || null

  // High-volume funnel sampling (see audit-telemetry-optimization.ts)
  const sampleKey = userId !== null ? String(userId) : chatId ?? eventName
  if (!shouldSample(sampleKey)) return

  await params.db.sql`
    INSERT INTO telegram_funnel_events (
      telegram_user_id,
      chat_id,
      event_name,
      action_type,
      context_json
    )
    VALUES (
      ${userId ? userId : null},
      ${chatId},
      ${eventName},
      ${actionType},
      ${params.context ?? {}}
    );
  `
}

/**
 * Thin backward-compat adapter.
 *
 * The real implementation + idempotency + pgcrypto side-effect now lives in
 * schemaBootstrap.ts (centralized withEnsureOnce).
 *
 * The local flags are retained only for any legacy test observers.
 */
export async function ensureTelegramTradingSchema(db: Db): Promise<void> {
  if (telegramTradingSchemaEnsured) return
  if (telegramTradingSchemaEnsurePromise) return telegramTradingSchemaEnsurePromise

  telegramTradingSchemaEnsurePromise = (async () => {
    try {
      await ensureTelegramTradingSchemaFromBootstrap(db)
      telegramTradingSchemaEnsured = true
    } catch (error) {
      telegramTradingSchemaEnsured = false
      throw error
    } finally {
      telegramTradingSchemaEnsurePromise = null
    }
  })()

  return telegramTradingSchemaEnsurePromise
}

export type TelegramOnboardingStep = 'welcome' | 'csw_fork' | 'branch_create' | 'branch_link'

export type TelegramOnboardingSession = {
  telegramUserId: string
  step: TelegramOnboardingStep
  expiresAt: string
}

const TELEGRAM_ONBOARDING_SESSION_TTL_DAYS = 7

function parseTelegramOnboardingStep(raw: unknown): TelegramOnboardingStep | null {
  const value = asTrimmed(raw)
  if (value === 'welcome') return 'welcome'
  if (value === 'csw_fork' || value === 'zora') return 'csw_fork'
  if (value === 'branch_create' || value === 'branch_no') return 'branch_create'
  if (value === 'branch_link' || value === 'branch_yes') return 'branch_link'
  return null
}

/** Returns true when this was the first insert for the user (idempotent welcome gate). */
export async function tryInsertTelegramPrivateDmWelcomeSent(params: {
  db: Db
  telegramUserId: string | number | bigint
}): Promise<boolean> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return false
  const result = await params.db.sql`
    INSERT INTO telegram_private_dm_welcome_sent (telegram_user_id, sent_at)
    VALUES (${userId}, NOW())
    ON CONFLICT (telegram_user_id) DO NOTHING
    RETURNING telegram_user_id;
  `
  return Boolean(result.rows?.length)
}

export async function upsertTelegramOnboardingSession(params: {
  db: Db
  telegramUserId: string | number | bigint
  step: TelegramOnboardingStep
}): Promise<void> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return
  const expiresAt = new Date()
  expiresAt.setUTCDate(expiresAt.getUTCDate() + TELEGRAM_ONBOARDING_SESSION_TTL_DAYS)
  await params.db.sql`
    INSERT INTO telegram_onboarding_sessions (telegram_user_id, step, expires_at, updated_at)
    VALUES (${userId}, ${params.step}, ${expiresAt.toISOString()}, NOW())
    ON CONFLICT (telegram_user_id) DO UPDATE SET
      step = EXCLUDED.step,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW();
  `
}

export async function readTelegramOnboardingSession(params: {
  db: Db
  telegramUserId: string | number | bigint
}): Promise<TelegramOnboardingSession | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return null

  const result = await params.db.sql`
    SELECT telegram_user_id, step, expires_at
    FROM telegram_onboarding_sessions
    WHERE telegram_user_id = ${userId}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return null
  const expiresAtMs = new Date(String(row.expires_at)).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    await params.db.sql`
      DELETE FROM telegram_onboarding_sessions WHERE telegram_user_id = ${userId};
    `
    return null
  }
  const step = parseTelegramOnboardingStep(row.step)
  if (!step) {
    await params.db.sql`
      DELETE FROM telegram_onboarding_sessions WHERE telegram_user_id = ${userId};
    `
    return null
  }
  return {
    telegramUserId: String(row.telegram_user_id),
    step,
    expiresAt: toIso(row.expires_at) ?? new Date(expiresAtMs).toISOString(),
  }
}

export async function getTelegramLinkByUserId(params: {
  db: Db
  telegramUserId: string | number | bigint
}): Promise<TelegramUserLink | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return null

  const result = await params.db.sql`
    SELECT
      telegram_user_id,
      telegram_username,
      profile_id,
      privy_user_id,
      canonical_csw_address,
      owner_verified,
      link_status,
      linked_at,
      last_verified_at,
      revoked_at,
      failure_count,
      last_failure_reason,
      unlink_requested_at
    FROM telegram_user_links
    WHERE telegram_user_id = ${userId}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return null

  const link: TelegramUserLink = {
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: asTrimmed(row.telegram_username) || null,
    profileId: Number(row.profile_id),
    privyUserId: String(row.privy_user_id),
    canonicalCswAddress: normalizeAddress(row.canonical_csw_address) || null,
    ownerVerified: Boolean(row.owner_verified),
    linkStatus: asTrimmed(row.link_status) || 'unknown',
    linkedAt: toIso(row.linked_at),
    lastVerifiedAt: toIso(row.last_verified_at),
    revokedAt: toIso(row.revoked_at),
    failureCount: Number(row.failure_count || 0),
    lastFailureReason: asTrimmed(row.last_failure_reason) || null,
    unlinkRequestedAt: toIso(row.unlink_requested_at),
  }
  if (link.linkStatus === 'revoked') return link

  const walletStateResult = await params.db.sql`
    SELECT
      canonical_csw_address,
      privy_is_owner,
      address,
      is_canonical_smart_wallet
    FROM profile_wallets
    WHERE profile_id = ${link.profileId}
      AND (chain_id = 8453 OR chain_id IS NULL)
    ORDER BY
      CASE WHEN canonical_csw_address IS NOT NULL THEN 0 ELSE 1 END ASC,
      CASE WHEN is_canonical_smart_wallet = true THEN 0 ELSE 1 END ASC,
      updated_at DESC
    LIMIT 1;
  `
  const walletRow = walletStateResult.rows?.[0] ?? null
  const canonicalFromColumns = normalizeAddress(walletRow?.canonical_csw_address) || null
  const canonicalFromAddress = walletRow?.is_canonical_smart_wallet === true ? normalizeAddress(walletRow?.address) || null : null
  const canonicalCswAddress = canonicalFromColumns ?? canonicalFromAddress ?? null
  const ownerVerified = canonicalCswAddress ? Boolean(walletRow?.privy_is_owner) : false
  const linkStatus = canonicalCswAddress ? 'active' : 'pending_wallet_setup'

  if (
    canonicalCswAddress === link.canonicalCswAddress &&
    ownerVerified === link.ownerVerified &&
    linkStatus === link.linkStatus
  ) {
    return link
  }

  const updated = await params.db.sql`
    UPDATE telegram_user_links
    SET
      canonical_csw_address = ${canonicalCswAddress},
      owner_verified = ${ownerVerified},
      link_status = ${linkStatus},
      last_verified_at = NOW()
    WHERE telegram_user_id = ${userId}
    RETURNING
      telegram_user_id,
      telegram_username,
      profile_id,
      privy_user_id,
      canonical_csw_address,
      owner_verified,
      link_status,
      linked_at,
      last_verified_at,
      revoked_at,
      failure_count,
      last_failure_reason,
      unlink_requested_at;
  `
  const updatedRow = updated.rows?.[0]
  if (!updatedRow) {
    return {
      ...link,
      canonicalCswAddress,
      ownerVerified,
      linkStatus,
    }
  }

  return {
    telegramUserId: String(updatedRow.telegram_user_id),
    telegramUsername: asTrimmed(updatedRow.telegram_username) || null,
    profileId: Number(updatedRow.profile_id),
    privyUserId: String(updatedRow.privy_user_id),
    canonicalCswAddress: normalizeAddress(updatedRow.canonical_csw_address) || null,
    ownerVerified: Boolean(updatedRow.owner_verified),
    linkStatus: asTrimmed(updatedRow.link_status) || 'unknown',
    linkedAt: toIso(updatedRow.linked_at),
    lastVerifiedAt: toIso(updatedRow.last_verified_at),
    revokedAt: toIso(updatedRow.revoked_at),
    failureCount: Number(updatedRow.failure_count || 0),
    lastFailureReason: asTrimmed(updatedRow.last_failure_reason) || null,
    unlinkRequestedAt: toIso(updatedRow.unlink_requested_at),
  }
}

export async function getTelegramLinkStatus(params: {
  db: Db
  telegramUserId: string | number | bigint
}): Promise<TelegramUserLink | null> {
  return getTelegramLinkByUserId(params)
}

export type TelegramMergePreflightResult =
  | { ok: true }
  | {
      ok: false
      reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY'
      existingPrivyUserId: string
      existingProfileId: number | null
      existingLinkStatus: string
    }

export async function runTelegramMergePreflight(params: {
  db: Db
  telegramUserId: string | number | bigint
  privyUserId: string
}): Promise<TelegramMergePreflightResult> {
  const requestedPrivyUserId = asTrimmed(params.privyUserId)
  if (!requestedPrivyUserId) {
    return {
      ok: false,
      reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY',
      existingPrivyUserId: '',
      existingProfileId: null,
      existingLinkStatus: 'unknown',
    }
  }

  const existing = await getTelegramLinkByUserId({
    db: params.db,
    telegramUserId: params.telegramUserId,
  })
  if (!existing) return { ok: true }

  if (existing.privyUserId.toLowerCase() === requestedPrivyUserId.toLowerCase()) {
    return { ok: true }
  }

  return {
    ok: false,
    reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY',
    existingPrivyUserId: existing.privyUserId,
    existingProfileId: existing.profileId,
    existingLinkStatus: existing.linkStatus,
  }
}

export async function upsertTelegramUserLink(params: {
  db: Db
  telegramUserId: string | number | bigint
  telegramUsername?: string | null
  profileId: number
  privyUserId: string
  canonicalCswAddress?: string | null
  ownerVerified: boolean
}): Promise<TelegramUserLink | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return null
  const profileId = Number(params.profileId)
  if (!Number.isFinite(profileId) || profileId <= 0) return null
  const privyUserId = asTrimmed(params.privyUserId)
  const canonicalCswAddress = normalizeAddress(params.canonicalCswAddress)
  if (!privyUserId) return null
  const ownerVerified = canonicalCswAddress ? Boolean(params.ownerVerified) : false
  const linkStatus = canonicalCswAddress ? 'active' : 'pending_wallet_setup'

  const mergePreflight = await runTelegramMergePreflight({
    db: params.db,
    telegramUserId: userId,
    privyUserId,
  })
  if (!mergePreflight.ok) {
    const error = new Error(
      'Recovery required: this Telegram account is already linked to another account.',
    ) as Error & {
      code?: string
      reason?: string
    }
    error.code = 'IDENTITY_RECOVERY_REQUIRED'
    error.reason = 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY'
    throw error
  }

  const telegramUsername = asTrimmed(params.telegramUsername ?? '') || null
  await params.db.sql`
    INSERT INTO telegram_user_links (
      telegram_user_id,
      telegram_username,
      profile_id,
      privy_user_id,
      canonical_csw_address,
      owner_verified,
      link_status,
      linked_at,
      last_verified_at,
      last_used_at,
      revoked_at,
      failure_count,
      last_failure_reason,
      unlink_requested_at
    )
    VALUES (
      ${userId},
      ${telegramUsername},
      ${profileId},
      ${privyUserId},
      ${canonicalCswAddress},
      ${ownerVerified},
      ${linkStatus},
      NOW(),
      NOW(),
      NOW(),
      NULL,
      0,
      NULL,
      NULL
    )
    ON CONFLICT (telegram_user_id) DO UPDATE
    SET
      telegram_username = EXCLUDED.telegram_username,
      profile_id = EXCLUDED.profile_id,
      privy_user_id = EXCLUDED.privy_user_id,
      canonical_csw_address = EXCLUDED.canonical_csw_address,
      owner_verified = EXCLUDED.owner_verified,
      link_status = EXCLUDED.link_status,
      last_verified_at = NOW(),
      last_used_at = NOW(),
      revoked_at = NULL,
      failure_count = 0,
      last_failure_reason = NULL,
      unlink_requested_at = NULL;
  `
  return await getTelegramLinkByUserId({
    db: params.db,
    telegramUserId: userId,
  })
}

export async function revokeTelegramLink(params: {
  db: Db
  telegramUserId: string | number | bigint
  reason?: string
}): Promise<{ revoked: boolean; link: TelegramUserLink | null }> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return { revoked: false, link: null }

  const reason = asTrimmed(params.reason ?? '')
  await params.db.sql`
    UPDATE telegram_user_links
    SET
      link_status = 'revoked',
      revoked_at = NOW(),
      unlink_requested_at = NOW(),
      last_failure_reason = CASE
        WHEN ${reason} <> '' THEN ${reason}
        ELSE last_failure_reason
      END
    WHERE telegram_user_id = ${userId}
      AND link_status <> 'revoked';
  `

  const link = await getTelegramLinkByUserId({
    db: params.db,
    telegramUserId: userId,
  })
  return { revoked: Boolean(link && link.linkStatus === 'revoked'), link }
}

export async function getTelegramPortfolioSummary(params: {
  db: Db
  telegramUserId: string | number | bigint
  recentLimit?: number
}): Promise<TelegramPortfolioSummary | null> {
  const link = await getTelegramLinkByUserId({
    db: params.db,
    telegramUserId: params.telegramUserId,
  })
  if (!link) return null

  const limit = Math.max(1, Math.min(20, Math.floor(Number(params.recentLimit ?? 5))))
  const actionsResult = await params.db.sql`
    SELECT action_type, status, tx_hash, created_at
    FROM telegram_action_audit
    WHERE telegram_user_id = ${BigInt(link.telegramUserId)}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `
  const recentActions = (actionsResult.rows ?? []).map((row: any) => ({
    actionType: asTrimmed(row.action_type) || 'unknown',
    status: asTrimmed(row.status) || 'unknown',
    txHash: asTrimmed(row.tx_hash) || null,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  }))

  let buyCount = 0
  let sellCount = 0
  let bidCount = 0
  let successfulActions = 0
  for (const action of recentActions) {
    if (action.actionType === 'buy') buyCount += 1
    if (action.actionType === 'sell') sellCount += 1
    if (action.actionType === 'bid') bidCount += 1
    if (action.status === 'success' || action.status === 'executed' || action.status === 'confirmed') {
      successfulActions += 1
    }
  }

  return {
    link,
    successfulActions,
    buyCount,
    sellCount,
    bidCount,
    recentActions,
  }
}

export async function listTelegramScopedVaults(params: {
  db: Db
  chatId: string
  limit?: number
}): Promise<TelegramScopedVault[]> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return []
  const limit = Math.max(1, Math.min(25, Math.floor(Number(params.limit ?? 8))))

  const scopeResult = await params.db.sql`
    SELECT allowed_vault_ids
    FROM telegram_chat_vault_scope
    WHERE chat_id = ${chatId}
    LIMIT 1;
  `
  const allowedRaw = scopeResult.rows?.[0]?.allowed_vault_ids
  const allowedArray = Array.isArray(allowedRaw) ? allowedRaw : []
  const allowedSet = new Set(
    allowedArray
      .map((value: unknown) => asTrimmed(value).toLowerCase())
      .filter((value: string) => value.length > 0),
  )

  const result = await params.db.sql`
    SELECT vault_address, creator_coin_address, share_token_address, chain_id, group_id, settled_at, config_json
    FROM keepr_vaults
    ORDER BY created_at DESC
    LIMIT 100;
  `
  const allRows = result.rows ?? []
  const scopedRows = allowedSet.size > 0
    ? allRows.filter((row: any) => allowedSet.has(String(row.vault_address).toLowerCase()))
    : allRows

  return scopedRows.slice(0, limit).map((row: any) => {
    const config = parseJsonObject(row.config_json)
    const contracts = parseJsonObject(config.contracts)
    return {
      vaultAddress: String(row.vault_address).toLowerCase(),
      creatorCoinAddress: String(row.creator_coin_address).toLowerCase(),
      shareTokenAddress: normalizeAddress(row.share_token_address) || null,
      chainId: Number(row.chain_id),
      groupId: String(row.group_id),
      isSettled: Boolean(row.settled_at),
      ccaStrategyAddress: asTrimmed(contracts.ccaStrategy).toLowerCase() || null,
    }
  })
}

export async function getTelegramChatTradePolicy(params: {
  db: Db
  chatId: string
}): Promise<TelegramChatTradePolicy> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) {
    return {
      buySellEnabled: true,
      bidEnabled: true,
    }
  }

  const result = await params.db.sql`
    SELECT buy_sell_enabled, bid_enabled
    FROM telegram_chat_vault_scope
    WHERE chat_id = ${chatId}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) {
    return {
      buySellEnabled: true,
      bidEnabled: true,
    }
  }
  return {
    buySellEnabled: Boolean(row.buy_sell_enabled),
    bidEnabled: Boolean(row.bid_enabled),
  }
}

export async function getHolderRoomPolicyByVault(params: {
  db: Db
  chatId: string
  vaultAddress: string
}): Promise<TelegramHolderRoomPolicy | null> {
  const chatId = asTrimmed(params.chatId)
  const vaultAddress = normalizeAddress(params.vaultAddress)
  if (!chatId || !vaultAddress) return null

  const result = await params.db.sql`
    SELECT chat_id, vault_address, room_chat_id, min_shares_raw, grace_hours, enabled, created_at, updated_at
    FROM telegram_holder_room_policies
    WHERE chat_id = ${chatId}
      AND vault_address = ${vaultAddress}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapHolderRoomPolicyRow(row) : null
}

export async function listHolderRoomPolicies(params: {
  db: Db
  chatId: string
  enabledOnly?: boolean
  limit?: number
}): Promise<TelegramHolderRoomPolicy[]> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return []
  const enabledOnly = Boolean(params.enabledOnly)
  const limit = Math.max(1, Math.min(50, Math.floor(Number(params.limit ?? 20))))
  const result = await params.db.sql`
    SELECT chat_id, vault_address, room_chat_id, min_shares_raw, grace_hours, enabled, created_at, updated_at
    FROM telegram_holder_room_policies
    WHERE chat_id = ${chatId}
      AND (${enabledOnly} = false OR enabled = true)
    ORDER BY updated_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapHolderRoomPolicyRow)
}

export async function upsertHolderRoomPolicy(params: {
  db: Db
  chatId: string
  vaultAddress: string
  roomChatId: string
  minSharesRaw: string | number | bigint
  graceHours?: number
  enabled?: boolean
}): Promise<TelegramHolderRoomPolicy | null> {
  const chatId = asTrimmed(params.chatId)
  const vaultAddress = normalizeAddress(params.vaultAddress)
  const roomChatId = asTrimmed(params.roomChatId)
  const minSharesRaw = normalizeRawAmount(params.minSharesRaw)
  const graceHours = parseGraceHours(params.graceHours, 24)
  if (!chatId || !vaultAddress || !roomChatId || !minSharesRaw) return null

  const result = await params.db.sql`
    INSERT INTO telegram_holder_room_policies (
      chat_id,
      vault_address,
      room_chat_id,
      min_shares_raw,
      grace_hours,
      enabled,
      created_at,
      updated_at
    )
    VALUES (
      ${chatId},
      ${vaultAddress},
      ${roomChatId},
      ${minSharesRaw},
      ${graceHours},
      ${typeof params.enabled === 'boolean' ? params.enabled : true},
      NOW(),
      NOW()
    )
    ON CONFLICT (chat_id, vault_address) DO UPDATE
    SET
      room_chat_id = EXCLUDED.room_chat_id,
      min_shares_raw = EXCLUDED.min_shares_raw,
      grace_hours = EXCLUDED.grace_hours,
      enabled = EXCLUDED.enabled,
      updated_at = NOW()
    RETURNING chat_id, vault_address, room_chat_id, min_shares_raw, grace_hours, enabled, created_at, updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapHolderRoomPolicyRow(row) : null
}

export async function upsertHolderRoomMember(params: {
  db: Db
  roomChatId: string
  telegramUserId: string | number | bigint
  canonicalCswAddress: string
  status?: TelegramHolderRoomMemberStatus
  lastEligibleAt?: string | Date | null
  graceUntil?: string | Date | null
  lastCheckedAt?: string | Date | null
  removedAt?: string | Date | null
}): Promise<TelegramHolderRoomMember | null> {
  const roomChatId = asTrimmed(params.roomChatId)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const canonicalCswAddress = normalizeAddress(params.canonicalCswAddress)
  if (!roomChatId || !userId || !canonicalCswAddress) return null
  const status = normalizeHolderRoomMemberStatus(params.status)

  const result = await params.db.sql`
    INSERT INTO telegram_holder_room_members (
      room_chat_id,
      telegram_user_id,
      canonical_csw_address,
      status,
      last_eligible_at,
      grace_until,
      last_checked_at,
      removed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${roomChatId},
      ${userId},
      ${canonicalCswAddress},
      ${status},
      ${toIso(params.lastEligibleAt) ?? null},
      ${toIso(params.graceUntil) ?? null},
      ${toIso(params.lastCheckedAt) ?? null},
      ${toIso(params.removedAt) ?? null},
      NOW(),
      NOW()
    )
    ON CONFLICT (room_chat_id, telegram_user_id) DO UPDATE
    SET
      canonical_csw_address = EXCLUDED.canonical_csw_address,
      status = EXCLUDED.status,
      last_eligible_at = EXCLUDED.last_eligible_at,
      grace_until = EXCLUDED.grace_until,
      last_checked_at = EXCLUDED.last_checked_at,
      removed_at = EXCLUDED.removed_at,
      updated_at = NOW()
    RETURNING
      room_chat_id,
      telegram_user_id,
      canonical_csw_address,
      status,
      last_eligible_at,
      grace_until,
      last_checked_at,
      removed_at,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapHolderRoomMemberRow(row) : null
}

export async function upsertTelegramTradePercentPrompt(params: {
  db: Db
  chatId: string
  telegramUserId: string | number | bigint
  actionType: TelegramTradePercentPromptAction
  vaultAddress: string
  ttlSeconds?: number
}): Promise<TelegramTradePercentPrompt | null> {
  const chatId = asTrimmed(params.chatId)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const actionType = normalizeTradeActionType(params.actionType)
  const vaultAddress = normalizeAddress(params.vaultAddress)
  if (!chatId || !userId || !vaultAddress) return null
  const ttlSeconds = Math.max(15, Math.min(60 * 10, Math.floor(Number(params.ttlSeconds ?? 60 * 3))))
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  const result = await params.db.sql`
    INSERT INTO telegram_trade_percent_prompts (
      chat_id,
      telegram_user_id,
      action_type,
      vault_address,
      expires_at,
      consumed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${chatId},
      ${userId},
      ${actionType},
      ${vaultAddress},
      ${expiresAt},
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (chat_id, telegram_user_id) DO UPDATE
    SET
      action_type = EXCLUDED.action_type,
      vault_address = EXCLUDED.vault_address,
      expires_at = EXCLUDED.expires_at,
      consumed_at = NULL,
      updated_at = NOW()
    RETURNING
      chat_id,
      telegram_user_id,
      action_type,
      vault_address,
      expires_at,
      consumed_at,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTradePercentPromptRow(row) : null
}

export async function getTelegramTradePercentPrompt(params: {
  db: Db
  chatId: string
  telegramUserId: string | number | bigint
}): Promise<TelegramTradePercentPrompt | null> {
  const chatId = asTrimmed(params.chatId)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!chatId || !userId) return null
  const result = await params.db.sql`
    SELECT
      chat_id,
      telegram_user_id,
      action_type,
      vault_address,
      expires_at,
      consumed_at,
      created_at,
      updated_at
    FROM telegram_trade_percent_prompts
    WHERE chat_id = ${chatId}
      AND telegram_user_id = ${userId}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapTradePercentPromptRow(row) : null
}

export async function consumeTelegramTradePercentPrompt(params: {
  db: Db
  chatId: string
  telegramUserId: string | number | bigint
}): Promise<TelegramTradePercentPrompt | null> {
  const chatId = asTrimmed(params.chatId)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!chatId || !userId) return null
  const consumed = await params.db.sql`
    UPDATE telegram_trade_percent_prompts
    SET consumed_at = NOW(), updated_at = NOW()
    WHERE chat_id = ${chatId}
      AND telegram_user_id = ${userId}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING
      chat_id,
      telegram_user_id,
      action_type,
      vault_address,
      expires_at,
      consumed_at,
      created_at,
      updated_at;
  `
  const row = consumed.rows?.[0]
  return row ? mapTradePercentPromptRow(row) : null
}

export async function clearTelegramTradePercentPrompt(params: {
  db: Db
  chatId: string
  telegramUserId: string | number | bigint
}): Promise<void> {
  const chatId = asTrimmed(params.chatId)
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!chatId || !userId) return
  await params.db.sql`
    DELETE FROM telegram_trade_percent_prompts
    WHERE chat_id = ${chatId}
      AND telegram_user_id = ${userId};
  `
}

export async function upsertTelegramInlineSignalFeed(params: {
  db: Db
  inlineMessageId: string
  sourceChatId: string
  ownerTelegramUserId: string | number | bigint
}): Promise<TelegramInlineSignalFeed | null> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  const sourceChatId = asTrimmed(params.sourceChatId)
  const ownerTelegramUserId = normalizeTelegramUserId(params.ownerTelegramUserId)
  if (!inlineMessageId || !sourceChatId || !ownerTelegramUserId) return null

  const result = await params.db.sql`
    INSERT INTO telegram_inline_signal_feeds (
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${inlineMessageId},
      ${sourceChatId},
      ${ownerTelegramUserId.toString()},
      false,
      ${null},
      NOW(),
      NOW()
    )
    ON CONFLICT (inline_message_id) DO UPDATE
    SET
      source_chat_id = EXCLUDED.source_chat_id,
      owner_telegram_user_id = EXCLUDED.owner_telegram_user_id,
      paused = false,
      closed_at = NULL,
      updated_at = NOW()
    RETURNING
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      last_render_hash,
      last_pushed_at,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramInlineSignalFeedRow(row) : null
}

export async function getTelegramInlineSignalFeedByInlineMessageId(params: {
  db: Db
  inlineMessageId: string
}): Promise<TelegramInlineSignalFeed | null> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  if (!inlineMessageId) return null
  const result = await params.db.sql`
    SELECT
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      last_render_hash,
      last_pushed_at,
      created_at,
      updated_at
    FROM telegram_inline_signal_feeds
    WHERE inline_message_id = ${inlineMessageId}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramInlineSignalFeedRow(row) : null
}

export async function listTelegramInlineSignalFeedsBySourceChat(params: {
  db: Db
  sourceChatId: string
  includePaused?: boolean
  limit?: number
}): Promise<TelegramInlineSignalFeed[]> {
  const sourceChatId = asTrimmed(params.sourceChatId)
  if (!sourceChatId) return []
  const includePaused = params.includePaused === true
  const limit = Math.max(1, Math.min(100, Math.floor(Number(params.limit ?? 25))))
  const result = await params.db.sql`
    SELECT
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      last_render_hash,
      last_pushed_at,
      created_at,
      updated_at
    FROM telegram_inline_signal_feeds
    WHERE source_chat_id = ${sourceChatId}
      AND closed_at IS NULL
      AND (${includePaused} = true OR paused = false)
    ORDER BY updated_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapTelegramInlineSignalFeedRow)
}

export async function setTelegramInlineSignalFeedPaused(params: {
  db: Db
  inlineMessageId: string
  paused: boolean
}): Promise<TelegramInlineSignalFeed | null> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  if (!inlineMessageId) return null
  const result = await params.db.sql`
    UPDATE telegram_inline_signal_feeds
    SET
      paused = ${Boolean(params.paused)},
      updated_at = NOW()
    WHERE inline_message_id = ${inlineMessageId}
      AND closed_at IS NULL
    RETURNING
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      last_render_hash,
      last_pushed_at,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramInlineSignalFeedRow(row) : null
}

export async function closeTelegramInlineSignalFeed(params: {
  db: Db
  inlineMessageId: string
}): Promise<TelegramInlineSignalFeed | null> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  if (!inlineMessageId) return null
  const result = await params.db.sql`
    UPDATE telegram_inline_signal_feeds
    SET
      closed_at = NOW(),
      updated_at = NOW()
    WHERE inline_message_id = ${inlineMessageId}
      AND closed_at IS NULL
    RETURNING
      inline_message_id,
      source_chat_id,
      owner_telegram_user_id,
      paused,
      closed_at,
      last_render_hash,
      last_pushed_at,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramInlineSignalFeedRow(row) : null
}

export async function touchTelegramInlineSignalFeedPush(params: {
  db: Db
  inlineMessageId: string
  renderHash: string
}): Promise<void> {
  const inlineMessageId = asTrimmed(params.inlineMessageId)
  const renderHash = asTrimmed(params.renderHash)
  if (!inlineMessageId) return
  await params.db.sql`
    UPDATE telegram_inline_signal_feeds
    SET
      last_render_hash = ${renderHash || null},
      last_pushed_at = NOW(),
      updated_at = NOW()
    WHERE inline_message_id = ${inlineMessageId};
  `
}

export async function getTelegramActiveMessage(params: {
  db: Db
  chatId: string
  ownerTelegramUserId: string | number | bigint
}): Promise<TelegramActiveMessage | null> {
  const chatId = asTrimmed(params.chatId)
  const ownerTelegramUserId = normalizeTelegramUserId(params.ownerTelegramUserId)
  if (!chatId || !ownerTelegramUserId) return null
  const result = await params.db.sql`
    SELECT
      chat_id,
      owner_telegram_user_id,
      message_id,
      created_at,
      updated_at
    FROM telegram_active_messages
    WHERE chat_id = ${chatId}
      AND owner_telegram_user_id = ${ownerTelegramUserId.toString()}
    LIMIT 1;
  `
  return mapTelegramActiveMessageRow(result.rows?.[0] ?? null)
}

export async function upsertTelegramActiveMessage(params: {
  db: Db
  chatId: string
  ownerTelegramUserId: string | number | bigint
  messageId: number
}): Promise<TelegramActiveMessage | null> {
  const chatId = asTrimmed(params.chatId)
  const ownerTelegramUserId = normalizeTelegramUserId(params.ownerTelegramUserId)
  const messageIdRaw = Number(params.messageId)
  if (!chatId || !ownerTelegramUserId || !Number.isFinite(messageIdRaw) || messageIdRaw <= 0) return null
  const messageId = Math.floor(messageIdRaw)
  const result = await params.db.sql`
    INSERT INTO telegram_active_messages (
      chat_id,
      owner_telegram_user_id,
      message_id,
      created_at,
      updated_at
    )
    VALUES (
      ${chatId},
      ${ownerTelegramUserId.toString()},
      ${messageId},
      NOW(),
      NOW()
    )
    ON CONFLICT (chat_id, owner_telegram_user_id) DO UPDATE
    SET
      message_id = EXCLUDED.message_id,
      updated_at = NOW()
    RETURNING
      chat_id,
      owner_telegram_user_id,
      message_id,
      created_at,
      updated_at;
  `
  return mapTelegramActiveMessageRow(result.rows?.[0] ?? null)
}

export async function clearTelegramActiveMessage(params: {
  db: Db
  chatId: string
  ownerTelegramUserId: string | number | bigint
  messageId?: number | null
}): Promise<void> {
  const chatId = asTrimmed(params.chatId)
  const ownerTelegramUserId = normalizeTelegramUserId(params.ownerTelegramUserId)
  if (!chatId || !ownerTelegramUserId) return
  const messageIdRaw = Number(params.messageId)
  if (Number.isFinite(messageIdRaw) && messageIdRaw > 0) {
    await params.db.sql`
      DELETE FROM telegram_active_messages
      WHERE chat_id = ${chatId}
        AND owner_telegram_user_id = ${ownerTelegramUserId.toString()}
        AND message_id = ${Math.floor(messageIdRaw)};
    `
    return
  }
  await params.db.sql`
    DELETE FROM telegram_active_messages
    WHERE chat_id = ${chatId}
      AND owner_telegram_user_id = ${ownerTelegramUserId.toString()};
  `
}

export async function listHolderRoomMembersNeedingRecheck(params: {
  db: Db
  limit?: number
  chatId?: string
}): Promise<TelegramHolderRoomRecheckRow[]> {
  const limit = Math.max(1, Math.min(250, Math.floor(Number(params.limit ?? 50))))
  const chatId = asTrimmed(params.chatId ?? '')
  const result = await params.db.sql`
    SELECT
      p.chat_id,
      p.vault_address,
      p.room_chat_id,
      p.min_shares_raw,
      p.grace_hours,
      p.enabled,
      m.telegram_user_id,
      m.canonical_csw_address,
      m.status,
      m.last_eligible_at,
      m.grace_until,
      m.last_checked_at,
      COALESCE(l.owner_verified, false) AS owner_verified,
      NULLIF(l.link_status, '') AS link_status,
      NULLIF(LOWER(k.share_token_address), '') AS share_token_address
    FROM telegram_holder_room_members m
    INNER JOIN telegram_holder_room_policies p
      ON p.room_chat_id = m.room_chat_id
    LEFT JOIN telegram_user_links l
      ON l.telegram_user_id = m.telegram_user_id
      AND LOWER(COALESCE(l.canonical_csw_address, '')) = LOWER(COALESCE(m.canonical_csw_address, ''))
    LEFT JOIN keepr_vaults k
      ON LOWER(k.vault_address) = p.vault_address
    WHERE p.enabled = true
      AND m.status <> 'removed'
      AND (${chatId} = '' OR p.chat_id = ${chatId})
    ORDER BY COALESCE(m.last_checked_at, TO_TIMESTAMP(0)) ASC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map((row: any) => ({
    chatId: asTrimmed(row.chat_id),
    vaultAddress: normalizeAddress(row.vault_address),
    roomChatId: asTrimmed(row.room_chat_id),
    shareTokenAddress: normalizeAddress(row.share_token_address),
    ownerVerified: row.owner_verified === true,
    linkStatus: asTrimmed(row.link_status) || null,
    minSharesRaw: normalizeRawAmount(row.min_shares_raw) || '1',
    graceHours: parseGraceHours(row.grace_hours, 24),
    enabled: Boolean(row.enabled),
    telegramUserId: String(row.telegram_user_id),
    canonicalCswAddress: normalizeAddress(row.canonical_csw_address) || null,
    status: normalizeHolderRoomMemberStatus(row.status),
    lastEligibleAt: toIso(row.last_eligible_at),
    graceUntil: toIso(row.grace_until),
    lastCheckedAt: toIso(row.last_checked_at),
  }))
}

export async function listTelegramAuctions(params: {
  db: Db
  chatId: string
  limit?: number
}): Promise<TelegramAuctionRow[]> {
  const vaults = await listTelegramScopedVaults({
    db: params.db,
    chatId: params.chatId,
    limit: Math.max(1, Math.min(25, Math.floor(Number(params.limit ?? 8)))),
  })
  return vaults
    .filter((vault) => vault.ccaStrategyAddress)
    .map((vault) => ({
      vaultAddress: vault.vaultAddress,
      ccaStrategyAddress: String(vault.ccaStrategyAddress),
      creatorCoinAddress: vault.creatorCoinAddress,
      chainId: vault.chainId,
      isSettled: vault.isSettled,
    }))
}

export async function listTelegramSignals(params: {
  db: Db
  chatId: string
  limit?: number
}): Promise<TelegramSignalRow[]> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return []
  const limit = Math.max(1, Math.min(25, Math.floor(Number(params.limit ?? 8))))

  const result = await params.db.sql`
    SELECT telegram_user_id, action_type, status, tx_hash, created_at
    FROM telegram_action_audit
    WHERE chat_id = ${chatId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map((row: any) => ({
    telegramUserId: String(row.telegram_user_id),
    actionType: asTrimmed(row.action_type) || 'unknown',
    status: asTrimmed(row.status) || 'unknown',
    txHash: asTrimmed(row.tx_hash) || null,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  }))
}

export async function listTelegramUserBids(params: {
  db: Db
  telegramUserId: string | number | bigint
  limit?: number
}): Promise<TelegramSignalRow[]> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return []
  const limit = Math.max(1, Math.min(25, Math.floor(Number(params.limit ?? 8))))

  const result = await params.db.sql`
    SELECT telegram_user_id, action_type, status, tx_hash, created_at
    FROM telegram_action_audit
    WHERE telegram_user_id = ${userId}
      AND action_type = 'bid'
    ORDER BY created_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map((row: any) => ({
    telegramUserId: String(row.telegram_user_id),
    actionType: asTrimmed(row.action_type) || 'bid',
    status: asTrimmed(row.status) || 'unknown',
    txHash: asTrimmed(row.tx_hash) || null,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  }))
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed))
  }
  return 0
}

function computePercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

export async function getTelegramFunnelMetrics(params: {
  db: Db
  chatId?: string | null
  windowHours?: number
}): Promise<TelegramFunnelMetrics> {
  const chatId = asTrimmed(params.chatId ?? '') || null
  const chatFilter = chatId ?? ''
  const windowHours = Math.max(1, Math.min(24 * 30, Math.floor(Number(params.windowHours ?? 24))))
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const result = await params.db.sql`
    SELECT
      COUNT(*) FILTER (WHERE event_name = 'link_start') AS link_start_count,
      COUNT(*) FILTER (WHERE event_name = 'link_complete_success') AS link_complete_success_count,
      COUNT(*) FILTER (WHERE event_name = 'link_complete_failed') AS link_complete_failed_count,
      COUNT(*) FILTER (WHERE event_name = 'inline_query_answered') AS inline_query_answered_count,
      COUNT(*) FILTER (WHERE event_name = 'inline_result_chosen') AS inline_result_chosen_count,
      COUNT(*) FILTER (WHERE event_name = 'inline_pm_handoff') AS inline_pm_handoff_count,
      COUNT(*) FILTER (WHERE event_name = 'inline_prepared_sent') AS inline_prepared_sent_count,
      COUNT(*) FILTER (WHERE event_name = 'trade_flow_started') AS trade_flow_started_count,
      COUNT(*) FILTER (WHERE event_name = 'trade_preview_ready') AS trade_preview_ready_count,
      COUNT(*) FILTER (WHERE event_name = 'trade_confirmed') AS trade_confirmed_count,
      COUNT(*) FILTER (
        WHERE event_name IN ('trade_confirm_failed', 'trade_confirm_token_invalid')
      ) AS trade_confirm_failed_count
    FROM telegram_funnel_events
    WHERE created_at >= ${since}
      AND (${chatFilter} = '' OR chat_id = ${chatFilter});
  `

  const row = result.rows?.[0] ?? {}
  const counts = {
    linkStart: parseCount((row as any).link_start_count),
    linkCompleteSuccess: parseCount((row as any).link_complete_success_count),
    linkCompleteFailed: parseCount((row as any).link_complete_failed_count),
    inlineQueryAnswered: parseCount((row as any).inline_query_answered_count),
    inlineResultChosen: parseCount((row as any).inline_result_chosen_count),
    inlinePmHandoff: parseCount((row as any).inline_pm_handoff_count),
    inlinePreparedSent: parseCount((row as any).inline_prepared_sent_count),
    tradeFlowStarted: parseCount((row as any).trade_flow_started_count),
    tradePreviewReady: parseCount((row as any).trade_preview_ready_count),
    tradeConfirmed: parseCount((row as any).trade_confirmed_count),
    tradeConfirmFailed: parseCount((row as any).trade_confirm_failed_count),
  }

  return {
    windowHours,
    since,
    chatId,
    counts,
    conversion: {
      linkCompletionRatePct: computePercent(counts.linkCompleteSuccess, counts.linkStart),
      tradePreviewToConfirmRatePct: computePercent(counts.tradeConfirmed, counts.tradePreviewReady),
      inlineChosenRatePct: computePercent(counts.inlineResultChosen, counts.inlineQueryAnswered),
      inlineChosenToLinkStartRatePct: computePercent(counts.linkStart, counts.inlineResultChosen),
      inlineChosenToTradeFlowStartRatePct: computePercent(counts.tradeFlowStarted, counts.inlineResultChosen),
    },
  }
}
