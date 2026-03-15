import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type TelegramUserLink = {
  telegramUserId: string
  telegramUsername: string | null
  profileId: number
  privyUserId: string
  canonicalCswAddress: string
  ownerVerified: boolean
  linkStatus: string
  linkedAt: string | null
  lastVerifiedAt: string | null
  revokedAt: string | null
  failureCount: number
  lastFailureReason: string | null
  unlinkRequestedAt: string | null
}

export type TelegramPortfolioSummary = {
  link: TelegramUserLink
  successfulActions: number
  buyCount: number
  sellCount: number
  bidCount: number
  recentActions: Array<{
    actionType: string
    status: string
    txHash: string | null
    createdAt: string
  }>
}

export type TelegramScopedVault = {
  vaultAddress: string
  creatorCoinAddress: string
  chainId: number
  groupId: string
  isSettled: boolean
  ccaStrategyAddress: string | null
}

export type TelegramAuctionRow = {
  vaultAddress: string
  ccaStrategyAddress: string
  creatorCoinAddress: string
  chainId: number
  isSettled: boolean
}

export type TelegramChatTradePolicy = {
  buySellEnabled: boolean
  bidEnabled: boolean
}

export type TelegramHolderRoomPolicy = {
  chatId: string
  vaultAddress: string
  roomChatId: string
  minSharesRaw: string
  graceHours: number
  enabled: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type TelegramHolderRoomMemberStatus = 'active' | 'grace' | 'removed'

export type TelegramHolderRoomMember = {
  roomChatId: string
  telegramUserId: string
  canonicalCswAddress: string
  status: TelegramHolderRoomMemberStatus
  lastEligibleAt: string | null
  graceUntil: string | null
  lastCheckedAt: string | null
  removedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type TelegramHolderRoomRecheckRow = {
  chatId: string
  vaultAddress: string
  roomChatId: string
  shareTokenAddress: string
  minSharesRaw: string
  graceHours: number
  enabled: boolean
  telegramUserId: string
  canonicalCswAddress: string
  status: TelegramHolderRoomMemberStatus
  lastEligibleAt: string | null
  graceUntil: string | null
  lastCheckedAt: string | null
}

export type TelegramTradePercentPromptAction = 'buy' | 'sell' | 'bid'

export type TelegramTradePercentPrompt = {
  chatId: string
  telegramUserId: string
  actionType: TelegramTradePercentPromptAction
  vaultAddress: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type TelegramSignalRow = {
  telegramUserId: string
  actionType: string
  status: string
  txHash: string | null
  createdAt: string
}

export type TelegramActionTokenConsumeResult =
  | {
      ok: true
      actionType: string
      intentPayload: Record<string, any>
      expiresAt: string
      consumedAt: string
    }
  | {
      ok: false
      reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'
    }

export type TelegramLinkStartTokenPayload = {
  telegramUserId: string
  chatId: string
  issuedAt: string
  expiresAt: string
}

export type TelegramLinkStartTokenReadResult =
  | {
      ok: true
      payload: TelegramLinkStartTokenPayload
    }
  | {
      ok: false
      reason: 'invalid' | 'expired'
    }

export type TelegramFunnelMetrics = {
  windowHours: number
  since: string
  chatId: string | null
  counts: {
    linkStart: number
    linkCompleteSuccess: number
    linkCompleteFailed: number
    inlineQueryAnswered: number
    inlineResultChosen: number
    inlinePmHandoff: number
    inlinePreparedSent: number
    tradeFlowStarted: number
    tradePreviewReady: number
    tradeConfirmed: number
    tradeConfirmFailed: number
  }
  conversion: {
    linkCompletionRatePct: number | null
    tradePreviewToConfirmRatePct: number | null
    inlineChosenRatePct: number | null
    inlineChosenToLinkStartRatePct: number | null
    inlineChosenToTradeFlowStartRatePct: number | null
  }
}

export type TelegramMiniAppSession = {
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
  initDataHash: string
  authDate: number
  expiresAt: string
  createdAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
}

export type TelegramMiniAppSessionReadResult =
  | {
      ok: true
      session: TelegramMiniAppSession
    }
  | {
      ok: false
      reason: 'invalid' | 'expired' | 'revoked'
    }

let telegramTradingSchemaEnsured = false

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const raw = asTrimmed(value).toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return defaultValue
}

function parseCsvSet(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

function readTelegramFunnelRolloutChatIds(): Set<string> {
  return parseCsvSet(asTrimmed(process.env.TELEGRAM_FUNNEL_EVENTS_CHAT_IDS ?? ''))
}

function readTelegramFunnelMetricsRolloutChatIds(): Set<string> {
  const explicit = asTrimmed(process.env.TELEGRAM_FUNNEL_METRICS_CHAT_IDS ?? '')
  if (explicit) return parseCsvSet(explicit)
  return readTelegramFunnelRolloutChatIds()
}

export function isTelegramFunnelEventsEnabled(): boolean {
  return parseBoolean(process.env.TELEGRAM_FUNNEL_EVENTS_ENABLED, true)
}

export function isTelegramFunnelEventsEnabledForChat(chatId?: string | null): boolean {
  if (!isTelegramFunnelEventsEnabled()) return false
  const allowedChatIds = readTelegramFunnelRolloutChatIds()
  if (allowedChatIds.size === 0) return true
  const normalizedChatId = asTrimmed(chatId ?? '')
  return normalizedChatId ? allowedChatIds.has(normalizedChatId) : false
}

export function isTelegramFunnelMetricsEnabled(): boolean {
  return parseBoolean(process.env.TELEGRAM_FUNNEL_METRICS_ENABLED, false)
}

export function isTelegramFunnelMetricsEnabledForChat(chatId?: string | null): boolean {
  if (!isTelegramFunnelMetricsEnabled()) return false
  const allowedChatIds = readTelegramFunnelMetricsRolloutChatIds()
  if (allowedChatIds.size === 0) return true
  const normalizedChatId = asTrimmed(chatId ?? '')
  return normalizedChatId ? allowedChatIds.has(normalizedChatId) : false
}

function normalizeTelegramUserId(value: string | number | bigint): bigint | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null
  try {
    return new Date(value as any).toISOString()
  } catch {
    return null
  }
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, any>) : {}
  } catch {
    return {}
  }
}

function normalizeAddress(value: unknown): string {
  const address = asTrimmed(value).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(address) ? address : ''
}

function normalizeRawAmount(value: unknown): string {
  if (typeof value === 'bigint') {
    return value > 0n ? value.toString() : ''
  }
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^\d+$/.test(raw)) return ''
  const normalized = raw.replace(/^0+(?=\d)/, '')
  return normalized === '0' ? '' : normalized
}

function normalizeHolderRoomMemberStatus(value: unknown): TelegramHolderRoomMemberStatus {
  const status = asTrimmed(value).toLowerCase()
  if (status === 'grace') return 'grace'
  if (status === 'removed') return 'removed'
  return 'active'
}

function normalizeTradeActionType(value: unknown): TelegramTradePercentPromptAction {
  const action = asTrimmed(value).toLowerCase()
  if (action === 'sell') return 'sell'
  if (action === 'bid') return 'bid'
  return 'buy'
}

function parseGraceHours(value: unknown, fallback = 24): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(24 * 30, parsed))
}

function base64UrlEncode(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToString(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function getTelegramLinkTokenSecret(): string {
  const explicit = asTrimmed(process.env.TELEGRAM_LINK_TOKEN_SECRET)
  if (explicit.length >= 16) return explicit
  const fallback = asTrimmed(process.env.AUTH_SESSION_SECRET)
  if (fallback.length >= 16) return fallback
  const g = globalThis as any
  if (!g.__4626_telegram_link_token_secret) {
    g.__4626_telegram_link_token_secret = randomBytes(32).toString('hex')
  }
  return String(g.__4626_telegram_link_token_secret)
}

function hashTelegramActionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function hashTelegramMiniAppSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function signTelegramLinkPayload(payloadB64: string): string {
  const signature = createHmac('sha256', getTelegramLinkTokenSecret()).update(payloadB64).digest()
  return base64UrlEncode(signature)
}

type TelegramLinkStartTokenRawPayload = {
  telegramUserId: string
  chatId: string
  issuedAtMs: number
  expiresAtMs: number
}

function parseTelegramLinkStartTokenRaw(token: string): TelegramLinkStartTokenRawPayload | null {
  const raw = asTrimmed(token)
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expectedSig = signTelegramLinkPayload(payloadB64)
  try {
    const left = Buffer.from(sigB64, 'utf8')
    const right = Buffer.from(expectedSig, 'utf8')
    if (left.length !== right.length) return null
    if (!timingSafeEqual(left, right)) return null
  } catch {
    return null
  }

  const payloadRaw = base64UrlDecodeToString(payloadB64)
  if (!payloadRaw) return null
  let parsed: any
  try {
    parsed = JSON.parse(payloadRaw)
  } catch {
    return null
  }
  const telegramUserId = asTrimmed(parsed?.tg)
  const chatId = asTrimmed(parsed?.c)
  const issuedAtMs = typeof parsed?.iat === 'number' ? parsed.iat : Number(parsed?.iat)
  const expiresAtMs = typeof parsed?.exp === 'number' ? parsed.exp : Number(parsed?.exp)
  if (!/^\d+$/.test(telegramUserId) || !chatId || !Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return null
  }
  return {
    telegramUserId,
    chatId,
    issuedAtMs,
    expiresAtMs,
  }
}

export function createTelegramLinkStartToken(params: {
  telegramUserId: string | number | bigint
  chatId: string
  ttlSeconds?: number
}): { token: string; expiresAt: string } {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId)
  if (!userId || !chatId) {
    throw new Error('invalid_telegram_link_token_payload')
  }
  const ttlSeconds = Math.max(30, Math.min(60 * 30, Math.floor(Number(params.ttlSeconds ?? 60 * 15))))
  const issuedAtMs = Date.now()
  const expiresAtMs = issuedAtMs + ttlSeconds * 1000
  const payload = {
    tg: String(userId),
    c: chatId,
    iat: issuedAtMs,
    exp: expiresAtMs,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signatureB64 = signTelegramLinkPayload(payloadB64)
  return {
    token: `${payloadB64}.${signatureB64}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  }
}

export function readTelegramLinkStartToken(token: string): TelegramLinkStartTokenPayload | null {
  const parsed = parseTelegramLinkStartTokenRaw(token)
  if (!parsed) return null
  if (parsed.expiresAtMs <= Date.now()) return null
  return {
    telegramUserId: parsed.telegramUserId,
    chatId: parsed.chatId,
    issuedAt: new Date(parsed.issuedAtMs).toISOString(),
    expiresAt: new Date(parsed.expiresAtMs).toISOString(),
  }
}

export function readTelegramLinkStartTokenStatus(token: string): TelegramLinkStartTokenReadResult {
  const parsed = parseTelegramLinkStartTokenRaw(token)
  if (!parsed) {
    return { ok: false, reason: 'invalid' }
  }
  if (parsed.expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return {
    ok: true,
    payload: {
      telegramUserId: parsed.telegramUserId,
      chatId: parsed.chatId,
      issuedAt: new Date(parsed.issuedAtMs).toISOString(),
      expiresAt: new Date(parsed.expiresAtMs).toISOString(),
    },
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
  const initDataHash = asTrimmed(params.initDataHash).toLowerCase()
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const authDate = Math.trunc(Number(params.authDate))
  if (!/^[a-f0-9]{64}$/.test(initDataHash) || !userId || !Number.isInteger(authDate) || authDate <= 0) {
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
  const initDataHash = asTrimmed(params.initDataHash).toLowerCase()
  const authDate = Math.trunc(Number(params.authDate))
  if (!userId || !/^[a-f0-9]{64}$/.test(initDataHash) || !Number.isInteger(authDate) || authDate <= 0) {
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
  canonicalCswAddress: string
  actionType: string
  intent: Record<string, any>
  quote?: Record<string, any> | null
  execution?: Record<string, any> | null
  status: string
  txHash?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}): Promise<void> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  const chatId = asTrimmed(params.chatId)
  const canonical = asTrimmed(params.canonicalCswAddress).toLowerCase()
  const actionType = asTrimmed(params.actionType).toLowerCase()
  const status = asTrimmed(params.status).toLowerCase() || 'unknown'
  if (!userId || !chatId || !canonical || !actionType) return

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
      error_message
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
      ${asTrimmed(params.errorMessage ?? '') || null}
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

export async function ensureTelegramTradingSchema(db: Db): Promise<void> {
  if (telegramTradingSchemaEnsured) return
  try {
    await db.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_user_links (
        telegram_user_id BIGINT PRIMARY KEY,
        telegram_username TEXT NULL,
        profile_id BIGINT NOT NULL,
        privy_user_id TEXT NOT NULL,
        canonical_csw_address TEXT NOT NULL,
        owner_verified BOOLEAN NOT NULL DEFAULT false,
        link_status TEXT NOT NULL DEFAULT 'active',
        linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_verified_at TIMESTAMPTZ NULL,
        last_used_at TIMESTAMPTZ NULL,
        revoked_at TIMESTAMPTZ NULL,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_failure_reason TEXT NULL,
        unlink_requested_at TIMESTAMPTZ NULL
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_action_tokens (
        token_hash TEXT PRIMARY KEY,
        telegram_user_id BIGINT NOT NULL,
        chat_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        intent_payload_json JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_action_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_user_id BIGINT NOT NULL,
        chat_id TEXT NOT NULL,
        message_id BIGINT NULL,
        profile_id BIGINT NOT NULL,
        canonical_csw_address TEXT NOT NULL,
        action_type TEXT NOT NULL,
        intent_json JSONB NOT NULL,
        quote_json JSONB NULL,
        execution_json JSONB NULL,
        status TEXT NOT NULL,
        tx_hash TEXT NULL,
        error_code TEXT NULL,
        error_message TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_funnel_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_user_id BIGINT NULL,
        chat_id TEXT NULL,
        event_name TEXT NOT NULL,
        action_type TEXT NULL,
        context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_miniapp_replay_nonces (
        init_data_hash TEXT PRIMARY KEY,
        telegram_user_id BIGINT NOT NULL,
        auth_date INTEGER NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_miniapp_sessions (
        token_hash TEXT PRIMARY KEY,
        telegram_user_id BIGINT NOT NULL,
        telegram_username TEXT NULL,
        chat_id TEXT NULL,
        chat_type TEXT NULL,
        chat_instance TEXT NULL,
        init_data_hash TEXT NOT NULL,
        auth_date INTEGER NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        last_used_at TIMESTAMPTZ NULL,
        revoked_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_chat_vault_scope (
        chat_id TEXT PRIMARY KEY,
        allowed_vault_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        buy_sell_enabled BOOLEAN NOT NULL DEFAULT true,
        bid_enabled BOOLEAN NOT NULL DEFAULT true
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_holder_room_policies (
        chat_id TEXT NOT NULL,
        vault_address TEXT NOT NULL,
        room_chat_id TEXT NOT NULL,
        min_shares_raw TEXT NOT NULL,
        grace_hours INTEGER NOT NULL DEFAULT 24,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (chat_id, vault_address)
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_holder_room_members (
        room_chat_id TEXT NOT NULL,
        telegram_user_id BIGINT NOT NULL,
        canonical_csw_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_eligible_at TIMESTAMPTZ NULL,
        grace_until TIMESTAMPTZ NULL,
        last_checked_at TIMESTAMPTZ NULL,
        removed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_chat_id, telegram_user_id)
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_trade_percent_prompts (
        chat_id TEXT NOT NULL,
        telegram_user_id BIGINT NOT NULL,
        action_type TEXT NOT NULL,
        vault_address TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (chat_id, telegram_user_id)
      );
    `

    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_user_links_csw_idx
      ON telegram_user_links (canonical_csw_address);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_user_links_status_owner_idx
      ON telegram_user_links (link_status, owner_verified);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_action_tokens_expires_idx
      ON telegram_action_tokens (expires_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_action_tokens_user_consumed_idx
      ON telegram_action_tokens (telegram_user_id, consumed_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_action_audit_created_idx
      ON telegram_action_audit (created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_action_audit_user_created_idx
      ON telegram_action_audit (telegram_user_id, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_funnel_events_created_idx
      ON telegram_funnel_events (created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_funnel_events_name_created_idx
      ON telegram_funnel_events (event_name, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_funnel_events_chat_created_idx
      ON telegram_funnel_events (chat_id, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_funnel_events_user_created_idx
      ON telegram_funnel_events (telegram_user_id, created_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_miniapp_replay_nonces_expires_idx
      ON telegram_miniapp_replay_nonces (expires_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_miniapp_sessions_expires_idx
      ON telegram_miniapp_sessions (expires_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_miniapp_sessions_user_expires_idx
      ON telegram_miniapp_sessions (telegram_user_id, expires_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_miniapp_sessions_chat_expires_idx
      ON telegram_miniapp_sessions (chat_id, expires_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_miniapp_sessions_init_hash_idx
      ON telegram_miniapp_sessions (init_data_hash);
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS telegram_holder_room_policies_room_chat_uidx
      ON telegram_holder_room_policies (room_chat_id);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_holder_room_policies_chat_enabled_idx
      ON telegram_holder_room_policies (chat_id, enabled);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_holder_room_members_status_checked_idx
      ON telegram_holder_room_members (status, last_checked_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_holder_room_members_wallet_idx
      ON telegram_holder_room_members (canonical_csw_address);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_trade_percent_prompts_active_idx
      ON telegram_trade_percent_prompts (expires_at, consumed_at);
    `

    telegramTradingSchemaEnsured = true
  } catch (error) {
    telegramTradingSchemaEnsured = false
    throw error
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

  return {
    telegramUserId: String(row.telegram_user_id),
    telegramUsername: asTrimmed(row.telegram_username) || null,
    profileId: Number(row.profile_id),
    privyUserId: String(row.privy_user_id),
    canonicalCswAddress: String(row.canonical_csw_address).toLowerCase(),
    ownerVerified: Boolean(row.owner_verified),
    linkStatus: asTrimmed(row.link_status) || 'unknown',
    linkedAt: toIso(row.linked_at),
    lastVerifiedAt: toIso(row.last_verified_at),
    revokedAt: toIso(row.revoked_at),
    failureCount: Number(row.failure_count || 0),
    lastFailureReason: asTrimmed(row.last_failure_reason) || null,
    unlinkRequestedAt: toIso(row.unlink_requested_at),
  }
}

export async function getTelegramLinkStatus(params: {
  db: Db
  telegramUserId: string | number | bigint
}): Promise<TelegramUserLink | null> {
  return getTelegramLinkByUserId(params)
}

export async function upsertTelegramUserLink(params: {
  db: Db
  telegramUserId: string | number | bigint
  telegramUsername?: string | null
  profileId: number
  privyUserId: string
  canonicalCswAddress: string
  ownerVerified: boolean
}): Promise<TelegramUserLink | null> {
  const userId = normalizeTelegramUserId(params.telegramUserId)
  if (!userId) return null
  const profileId = Number(params.profileId)
  if (!Number.isFinite(profileId) || profileId <= 0) return null
  const privyUserId = asTrimmed(params.privyUserId)
  const canonicalCswAddress = asTrimmed(params.canonicalCswAddress).toLowerCase()
  if (!privyUserId || !/^0x[a-fA-F0-9]{40}$/.test(canonicalCswAddress)) return null

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
      ${Boolean(params.ownerVerified)},
      'active',
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
      link_status = 'active',
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
    SELECT vault_address, creator_coin_address, chain_id, group_id, settled_at, config_json
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

function mapHolderRoomPolicyRow(row: any): TelegramHolderRoomPolicy {
  return {
    chatId: asTrimmed(row.chat_id),
    vaultAddress: normalizeAddress(row.vault_address),
    roomChatId: asTrimmed(row.room_chat_id),
    minSharesRaw: normalizeRawAmount(row.min_shares_raw) || '1',
    graceHours: parseGraceHours(row.grace_hours, 24),
    enabled: Boolean(row.enabled),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapHolderRoomMemberRow(row: any): TelegramHolderRoomMember {
  return {
    roomChatId: asTrimmed(row.room_chat_id),
    telegramUserId: String(row.telegram_user_id),
    canonicalCswAddress: normalizeAddress(row.canonical_csw_address),
    status: normalizeHolderRoomMemberStatus(row.status),
    lastEligibleAt: toIso(row.last_eligible_at),
    graceUntil: toIso(row.grace_until),
    lastCheckedAt: toIso(row.last_checked_at),
    removedAt: toIso(row.removed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapTradePercentPromptRow(row: any): TelegramTradePercentPrompt {
  return {
    chatId: asTrimmed(row.chat_id),
    telegramUserId: String(row.telegram_user_id),
    actionType: normalizeTradeActionType(row.action_type),
    vaultAddress: normalizeAddress(row.vault_address),
    expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
    consumedAt: toIso(row.consumed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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
      COALESCE(NULLIF(LOWER(k.creator_coin_address), ''), p.vault_address) AS share_token_address
    FROM telegram_holder_room_members m
    INNER JOIN telegram_holder_room_policies p
      ON p.room_chat_id = m.room_chat_id
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
    shareTokenAddress: normalizeAddress(row.share_token_address) || normalizeAddress(row.vault_address),
    minSharesRaw: normalizeRawAmount(row.min_shares_raw) || '1',
    graceHours: parseGraceHours(row.grace_hours, 24),
    enabled: Boolean(row.enabled),
    telegramUserId: String(row.telegram_user_id),
    canonicalCswAddress: normalizeAddress(row.canonical_csw_address),
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

