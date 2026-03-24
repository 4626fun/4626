import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type TelegramUserLink = {
  telegramUserId: string
  telegramUsername: string | null
  profileId: number
  privyUserId: string
  canonicalCswAddress: string | null
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
  canonicalCswAddress: string | null
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
  canonicalCswAddress: string | null
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

export type TelegramArenaWatch = {
  chatId: string
  enabled: boolean
  threadId: number | null
  watchMatchId: string | null
  lastPhase: string | null
  lastGameTime: string | null
  lastStateHash: string | null
  lastMatchId: string | null
  lastError: string | null
  lastRequestedByUserId: string | null
  lastPolledAt: string | null
  lastPushedAt: string | null
  nextPollAfter: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type TelegramInlineSignalFeed = {
  inlineMessageId: string
  sourceChatId: string
  ownerTelegramUserId: string
  paused: boolean
  closedAt: string | null
  lastRenderHash: string | null
  lastPushedAt: string | null
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

export type TelegramLinkStartTokenClaimResult =
  | {
      ok: true
      payload: TelegramLinkStartTokenPayload
      state: 'claimed' | 'reused'
    }
  | {
      ok: false
      reason: 'invalid' | 'expired' | 'consumed' | 'claimed_by_other_user'
    }

export type TelegramLinkStartTokenClaim = {
  telegramUserId: string
  chatId: string
  privyUserId: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string | null
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

function normalizeMiniAppInitDataHash(value: unknown): string {
  const hash = asTrimmed(value).toLowerCase()
  return /^[a-f0-9]{64}$/.test(hash) ? hash : ''
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

function hashTelegramLinkStartToken(token: string): string {
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
        canonical_csw_address TEXT NULL,
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
    await db.sql`ALTER TABLE telegram_user_links ALTER COLUMN canonical_csw_address DROP NOT NULL;`
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
      CREATE TABLE IF NOT EXISTS telegram_link_start_token_claims (
        token_hash TEXT PRIMARY KEY,
        telegram_user_id BIGINT NOT NULL,
        chat_id TEXT NOT NULL,
        privy_user_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
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
      CREATE TABLE IF NOT EXISTS telegram_arena_watchers (
        chat_id TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT false,
        thread_id BIGINT NULL,
        watch_match_id TEXT NULL,
        last_phase TEXT NULL,
        last_game_time TEXT NULL,
        last_state_hash TEXT NULL,
        last_match_id TEXT NULL,
        last_error TEXT NULL,
        last_requested_by_user_id BIGINT NULL,
        last_polled_at TIMESTAMPTZ NULL,
        last_pushed_at TIMESTAMPTZ NULL,
        next_poll_after TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_inline_signal_feeds (
        inline_message_id TEXT PRIMARY KEY,
        source_chat_id TEXT NOT NULL,
        owner_telegram_user_id BIGINT NOT NULL,
        paused BOOLEAN NOT NULL DEFAULT false,
        closed_at TIMESTAMPTZ NULL,
        last_render_hash TEXT NULL,
        last_pushed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      ALTER TABLE telegram_arena_watchers
      ADD COLUMN IF NOT EXISTS watch_match_id TEXT NULL;
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
      CREATE INDEX IF NOT EXISTS telegram_inline_signal_feeds_source_idx
      ON telegram_inline_signal_feeds (source_chat_id, updated_at DESC);
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
      CREATE INDEX IF NOT EXISTS telegram_link_start_token_claims_expires_idx
      ON telegram_link_start_token_claims (expires_at);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_link_start_token_claims_privy_idx
      ON telegram_link_start_token_claims (privy_user_id, expires_at DESC);
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
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_arena_watchers_enabled_poll_idx
      ON telegram_arena_watchers (enabled, next_poll_after);
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_onboarding_sessions (
        telegram_user_id BIGINT PRIMARY KEY,
        step TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_onboarding_sessions_expires_idx
      ON telegram_onboarding_sessions (expires_at);
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_private_dm_welcome_sent (
        telegram_user_id BIGINT PRIMARY KEY,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    telegramTradingSchemaEnsured = true
  } catch (error) {
    telegramTradingSchemaEnsured = false
    throw error
  }
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
    canonicalCswAddress: normalizeAddress(row.canonical_csw_address) || null,
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

function mapTelegramArenaWatchRow(row: any): TelegramArenaWatch {
  return {
    chatId: asTrimmed(row.chat_id),
    enabled: Boolean(row.enabled),
    threadId: Number.isFinite(Number(row.thread_id)) ? Number(row.thread_id) : null,
    watchMatchId: asTrimmed(row.watch_match_id) || null,
    lastPhase: asTrimmed(row.last_phase) || null,
    lastGameTime: asTrimmed(row.last_game_time) || null,
    lastStateHash: asTrimmed(row.last_state_hash) || null,
    lastMatchId: asTrimmed(row.last_match_id) || null,
    lastError: asTrimmed(row.last_error) || null,
    lastRequestedByUserId: row.last_requested_by_user_id ? String(row.last_requested_by_user_id) : null,
    lastPolledAt: toIso(row.last_polled_at),
    lastPushedAt: toIso(row.last_pushed_at),
    nextPollAfter: toIso(row.next_poll_after),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapTelegramInlineSignalFeedRow(row: any): TelegramInlineSignalFeed {
  return {
    inlineMessageId: asTrimmed(row.inline_message_id),
    sourceChatId: asTrimmed(row.source_chat_id),
    ownerTelegramUserId: String(row.owner_telegram_user_id ?? '').trim(),
    paused: row.paused === true,
    closedAt: toIso(row.closed_at),
    lastRenderHash: asTrimmed(row.last_render_hash) || null,
    lastPushedAt: toIso(row.last_pushed_at),
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

export async function getTelegramArenaWatchByChatId(params: {
  db: Db
  chatId: string
}): Promise<TelegramArenaWatch | null> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return null
  const result = await params.db.sql`
    SELECT
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_phase,
      last_game_time,
      last_state_hash,
      last_match_id,
      last_error,
      last_requested_by_user_id,
      last_polled_at,
      last_pushed_at,
      next_poll_after,
      created_at,
      updated_at
    FROM telegram_arena_watchers
    WHERE chat_id = ${chatId}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramArenaWatchRow(row) : null
}

export async function setTelegramArenaWatch(params: {
  db: Db
  chatId: string
  enabled: boolean
  threadId?: number | null
  requestedByUserId?: string | number | bigint | null
}): Promise<TelegramArenaWatch | null> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return null
  const threadIdRaw = Number(params.threadId)
  const threadId = Number.isFinite(threadIdRaw) && threadIdRaw > 0 ? Math.floor(threadIdRaw) : null
  const requestedByUserId =
    params.requestedByUserId === null || typeof params.requestedByUserId === 'undefined'
      ? null
      : normalizeTelegramUserId(params.requestedByUserId)

  const result = await params.db.sql`
    INSERT INTO telegram_arena_watchers (
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_requested_by_user_id,
      next_poll_after,
      created_at,
      updated_at
    )
    VALUES (
      ${chatId},
      ${Boolean(params.enabled)},
      ${threadId},
      ${null},
      ${requestedByUserId},
      ${params.enabled ? new Date().toISOString() : null},
      NOW(),
      NOW()
    )
    ON CONFLICT (chat_id) DO UPDATE
    SET
      enabled = EXCLUDED.enabled,
      thread_id = COALESCE(EXCLUDED.thread_id, telegram_arena_watchers.thread_id),
      watch_match_id = NULL,
      last_requested_by_user_id = COALESCE(EXCLUDED.last_requested_by_user_id, telegram_arena_watchers.last_requested_by_user_id),
      next_poll_after = CASE
        WHEN EXCLUDED.enabled THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_phase,
      last_game_time,
      last_state_hash,
      last_match_id,
      last_error,
      last_requested_by_user_id,
      last_polled_at,
      last_pushed_at,
      next_poll_after,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramArenaWatchRow(row) : null
}

export async function bindTelegramArenaWatchMatch(params: {
  db: Db
  chatId: string
  matchId: string
  requestedByUserId?: string | number | bigint | null
}): Promise<TelegramArenaWatch | null> {
  const chatId = asTrimmed(params.chatId)
  const matchId = asTrimmed(params.matchId)
  if (!chatId || !matchId) return null
  const requestedByUserId =
    params.requestedByUserId === null || typeof params.requestedByUserId === 'undefined'
      ? null
      : normalizeTelegramUserId(params.requestedByUserId)
  const result = await params.db.sql`
    INSERT INTO telegram_arena_watchers (
      chat_id,
      enabled,
      watch_match_id,
      last_requested_by_user_id,
      next_poll_after,
      created_at,
      updated_at
    )
    VALUES (
      ${chatId},
      true,
      ${matchId},
      ${requestedByUserId},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (chat_id) DO UPDATE
    SET
      enabled = true,
      watch_match_id = EXCLUDED.watch_match_id,
      last_requested_by_user_id = COALESCE(EXCLUDED.last_requested_by_user_id, telegram_arena_watchers.last_requested_by_user_id),
      last_error = NULL,
      next_poll_after = NOW(),
      updated_at = NOW()
    RETURNING
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_phase,
      last_game_time,
      last_state_hash,
      last_match_id,
      last_error,
      last_requested_by_user_id,
      last_polled_at,
      last_pushed_at,
      next_poll_after,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramArenaWatchRow(row) : null
}

export async function listDueTelegramArenaWatches(params: {
  db: Db
  limit?: number
}): Promise<TelegramArenaWatch[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(Number(params.limit ?? 25))))
  const result = await params.db.sql`
    SELECT
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_phase,
      last_game_time,
      last_state_hash,
      last_match_id,
      last_error,
      last_requested_by_user_id,
      last_polled_at,
      last_pushed_at,
      next_poll_after,
      created_at,
      updated_at
    FROM telegram_arena_watchers
    WHERE enabled = true
      AND COALESCE(next_poll_after, TO_TIMESTAMP(0)) <= NOW()
    ORDER BY COALESCE(last_polled_at, TO_TIMESTAMP(0)) ASC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapTelegramArenaWatchRow)
}

export async function updateTelegramArenaWatchPoll(params: {
  db: Db
  chatId: string
  enabled?: boolean
  phase?: string | null
  gameTime?: string | null
  stateHash?: string | null
  matchId?: string | null
  errorMessage?: string | null
  pushed?: boolean
  pollIntervalSeconds?: number
}): Promise<TelegramArenaWatch | null> {
  const chatId = asTrimmed(params.chatId)
  if (!chatId) return null
  const pollIntervalSeconds = Math.max(15, Math.min(60 * 60, Math.floor(Number(params.pollIntervalSeconds ?? 60))))
  const enabledOverride = typeof params.enabled === 'boolean' ? params.enabled : null
  const result = await params.db.sql`
    UPDATE telegram_arena_watchers
    SET
      enabled = COALESCE(${enabledOverride}, enabled),
      watch_match_id = CASE
        WHEN COALESCE(${enabledOverride}, enabled) THEN watch_match_id
        ELSE NULL
      END,
      last_phase = COALESCE(${asTrimmed(params.phase ?? '') || null}, last_phase),
      last_game_time = COALESCE(${asTrimmed(params.gameTime ?? '') || null}, last_game_time),
      last_state_hash = COALESCE(${asTrimmed(params.stateHash ?? '') || null}, last_state_hash),
      last_match_id = COALESCE(${asTrimmed(params.matchId ?? '') || null}, last_match_id),
      last_error = ${asTrimmed(params.errorMessage ?? '') || null},
      last_polled_at = NOW(),
      last_pushed_at = CASE
        WHEN ${Boolean(params.pushed)} THEN NOW()
        ELSE last_pushed_at
      END,
      next_poll_after = CASE
        WHEN COALESCE(${enabledOverride}, enabled) THEN NOW() + (${pollIntervalSeconds} * INTERVAL '1 second')
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE chat_id = ${chatId}
    RETURNING
      chat_id,
      enabled,
      thread_id,
      watch_match_id,
      last_phase,
      last_game_time,
      last_state_hash,
      last_match_id,
      last_error,
      last_requested_by_user_id,
      last_polled_at,
      last_pushed_at,
      next_poll_after,
      created_at,
      updated_at;
  `
  const row = result.rows?.[0]
  return row ? mapTelegramArenaWatchRow(row) : null
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
