// Pure types, utilities, row mappers, and token parsers extracted from
// telegramTrading.ts. Nothing here touches the Postgres client directly.
// Keeping this file free of DB dependencies makes these helpers cheap to
// unit-test and safe to import from client-side code paths that only need
// the shared types.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
  shareTokenAddress: string | null
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
  ownerVerified: boolean
  linkStatus: string | null
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

export type TelegramActiveMessage = {
  chatId: string
  ownerTelegramUserId: string
  messageId: number
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

export type TelegramLinkStartTokenClaimAndConsumeResult =
  | {
      ok: true
      payload: TelegramLinkStartTokenPayload
      state: 'consumed'
    }
  | {
      ok: false
      reason: 'invalid' | 'expired' | 'consumed' | 'claimed_by_other_user'
      existingPrivyUserId?: string
      consumedAt?: string | null
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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const raw = asTrimmed(value).toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return defaultValue
}

export function parseCsvSet(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

export function readTelegramFunnelRolloutChatIds(): Set<string> {
  return parseCsvSet(asTrimmed(process.env.TELEGRAM_FUNNEL_EVENTS_CHAT_IDS ?? ''))
}

export function readTelegramFunnelMetricsRolloutChatIds(): Set<string> {
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

export function normalizeTelegramUserId(value: string | number | bigint): bigint | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

export function toIso(value: unknown): string | null {
  if (!value) return null
  try {
    return new Date(value as any).toISOString()
  } catch {
    return null
  }
}

export function parseJsonObject(value: unknown): Record<string, any> {
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

export function normalizeAddress(value: unknown): string {
  const address = asTrimmed(value).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(address) ? address : ''
}

export function normalizeMiniAppInitDataHash(value: unknown): string {
  const hash = asTrimmed(value).toLowerCase()
  return /^[a-f0-9]{64}$/.test(hash) ? hash : ''
}

export function normalizeRawAmount(value: unknown): string {
  if (typeof value === 'bigint') {
    return value > 0n ? value.toString() : ''
  }
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^\d+$/.test(raw)) return ''
  const normalized = raw.replace(/^0+(?=\d)/, '')
  return normalized === '0' ? '' : normalized
}

export function normalizeHolderRoomMemberStatus(value: unknown): TelegramHolderRoomMemberStatus {
  const status = asTrimmed(value).toLowerCase()
  if (status === 'grace') return 'grace'
  if (status === 'removed') return 'removed'
  return 'active'
}

export function normalizeTradeActionType(value: unknown): TelegramTradePercentPromptAction {
  const action = asTrimmed(value).toLowerCase()
  if (action === 'sell') return 'sell'
  if (action === 'bid') return 'bid'
  return 'buy'
}

export function parseGraceHours(value: unknown, fallback = 24): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(24 * 30, parsed))
}

export function base64UrlEncode(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlDecodeToString(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

export function getTelegramLinkTokenSecret(): string {
  const explicit = asTrimmed(process.env.TELEGRAM_LINK_TOKEN_SECRET)
  if (explicit.length >= 16) return explicit
  const fallback = asTrimmed(process.env.AUTH_SESSION_SECRET)
  if (fallback.length >= 16) return fallback
  const g = globalThis as { __4626_telegram_link_token_secret?: string }
  if (!g.__4626_telegram_link_token_secret) {
    g.__4626_telegram_link_token_secret = randomBytes(32).toString('hex')
  }
  return String(g.__4626_telegram_link_token_secret)
}

export function hashTelegramActionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function hashTelegramMiniAppSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function hashTelegramLinkStartToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function signTelegramLinkPayload(payloadB64: string): string {
  const signature = createHmac('sha256', getTelegramLinkTokenSecret()).update(payloadB64).digest()
  return base64UrlEncode(signature)
}

// ---------------------------------------------------------------------------
// Link start token parse / create / read (pure)
// ---------------------------------------------------------------------------

export type TelegramLinkStartTokenRawPayload = {
  telegramUserId: string
  chatId: string
  issuedAtMs: number
  expiresAtMs: number
}

export function parseTelegramLinkStartTokenRaw(token: string): TelegramLinkStartTokenRawPayload | null {
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

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

export function mapHolderRoomPolicyRow(row: any): TelegramHolderRoomPolicy {
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

export function mapHolderRoomMemberRow(row: any): TelegramHolderRoomMember {
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

export function mapTradePercentPromptRow(row: any): TelegramTradePercentPrompt {
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

export function mapTelegramInlineSignalFeedRow(row: any): TelegramInlineSignalFeed {
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

export function mapTelegramActiveMessageRow(row: any): TelegramActiveMessage | null {
  const chatId = asTrimmed(row?.chat_id)
  const ownerTelegramUserId = String(row?.owner_telegram_user_id ?? '').trim()
  const messageIdRaw = Number(row?.message_id)
  if (!chatId || !ownerTelegramUserId || !Number.isFinite(messageIdRaw) || messageIdRaw <= 0) return null
  return {
    chatId,
    ownerTelegramUserId,
    messageId: Math.floor(messageIdRaw),
    createdAt: toIso(row?.created_at),
    updatedAt: toIso(row?.updated_at),
  }
}
