import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import type { VercelRequest } from '@vercel/node'

import { asTrimmed } from './utils.js'

export type TelegramMiniAppIdentity = {
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
  authDate: number
  initDataHash: string
}

export type TelegramMiniAppInitDataVerificationResult =
  | {
      ok: true
      identity: TelegramMiniAppIdentity
    }
  | {
      ok: false
      reason:
        | 'missing_init_data'
        | 'invalid_init_data'
        | 'missing_hash'
        | 'invalid_hash_format'
        | 'invalid_hash'
        | 'missing_auth_date'
        | 'invalid_auth_date'
        | 'expired_auth_date'
        | 'future_auth_date'
        | 'missing_user'
        | 'invalid_user'
    }

export type TelegramMiniAppVerificationFailureReason = Extract<TelegramMiniAppInitDataVerificationResult, { ok: false }>['reason']

type ParsedTelegramMiniAppUser = {
  id: string
  username: string | null
}

function readHeaderAsTrimmed(value: unknown): string {
  if (Array.isArray(value)) {
    for (const part of value) {
      const parsed = asTrimmed(part)
      if (parsed) return parsed
    }
    return ''
  }
  return asTrimmed(value)
}

function buildDataCheckString(searchParams: URLSearchParams): string {
  const pairs: string[] = []
  for (const [key, value] of searchParams.entries()) {
    if (key === 'hash' || key === 'signature') continue
    pairs.push(`${key}=${value}`)
  }
  pairs.sort((a, b) => {
    const [left] = a.split('=', 1)
    const [right] = b.split('=', 1)
    return left.localeCompare(right)
  })
  return pairs.join('\n')
}

function parseTelegramMiniAppUser(rawUser: string): ParsedTelegramMiniAppUser | null {
  if (!rawUser) return null
  try {
    const parsed = JSON.parse(rawUser) as Record<string, unknown>
    const userIdRaw = parsed?.id
    const userId =
      typeof userIdRaw === 'number' && Number.isFinite(userIdRaw)
        ? String(Math.trunc(userIdRaw))
        : typeof userIdRaw === 'string'
          ? userIdRaw.trim()
          : ''
    if (!/^\d+$/.test(userId)) return null
    const username = typeof parsed?.username === 'string' && parsed.username.trim() ? parsed.username.trim() : null
    return { id: userId, username }
  } catch {
    return null
  }
}

function parseTelegramMiniAppChatId(rawChat: string): string | null {
  if (!rawChat) return null
  try {
    const parsed = JSON.parse(rawChat) as Record<string, unknown>
    const chatIdRaw = parsed?.id
    const chatId =
      typeof chatIdRaw === 'number' && Number.isFinite(chatIdRaw)
        ? String(Math.trunc(chatIdRaw))
        : typeof chatIdRaw === 'string'
          ? chatIdRaw.trim()
          : ''
    return /^-?\d+$/.test(chatId) ? chatId : null
  } catch {
    return null
  }
}

function buildTelegramMiniAppSecretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest()
}

function verifyTelegramMiniAppHash(params: { initData: string; hash: string; botToken: string }): boolean {
  const parsed = new URLSearchParams(params.initData)
  const dataCheckString = buildDataCheckString(parsed)
  const secretKey = buildTelegramMiniAppSecretKey(params.botToken)
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString, 'utf8').digest('hex')
  try {
    const left = Buffer.from(params.hash, 'hex')
    const right = Buffer.from(calculatedHash, 'hex')
    if (left.length !== right.length) return false
    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export function resolveTelegramMiniAppVerificationStatusCode(reason: TelegramMiniAppVerificationFailureReason): number {
  switch (reason) {
    case 'missing_init_data':
    case 'invalid_init_data':
    case 'missing_hash':
    case 'invalid_hash_format':
    case 'missing_auth_date':
    case 'invalid_auth_date':
    case 'missing_user':
    case 'invalid_user':
      return 400
    case 'invalid_hash':
    case 'expired_auth_date':
    case 'future_auth_date':
      return 401
    default:
      return 400
  }
}

export function verifyTelegramMiniAppInitData(params: {
  initData: string
  botToken: string
  maxAgeSeconds: number
  nowMs?: number
}): TelegramMiniAppInitDataVerificationResult {
  const initData = asTrimmed(params.initData)
  const botToken = asTrimmed(params.botToken)
  if (!initData || !botToken) {
    return { ok: false, reason: 'missing_init_data' }
  }

  let searchParams: URLSearchParams
  try {
    searchParams = new URLSearchParams(initData)
  } catch {
    return { ok: false, reason: 'invalid_init_data' }
  }

  const hash = asTrimmed(searchParams.get('hash') ?? '')
  if (!hash) return { ok: false, reason: 'missing_hash' }
  if (!/^[a-f0-9]{64}$/i.test(hash)) return { ok: false, reason: 'invalid_hash_format' }
  if (!verifyTelegramMiniAppHash({ initData, hash, botToken })) {
    return { ok: false, reason: 'invalid_hash' }
  }

  const authDateRaw = asTrimmed(searchParams.get('auth_date') ?? '')
  if (!authDateRaw) return { ok: false, reason: 'missing_auth_date' }
  const authDate = Number(authDateRaw)
  if (!Number.isInteger(authDate) || authDate <= 0) return { ok: false, reason: 'invalid_auth_date' }
  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now()
  const nowSeconds = Math.floor(nowMs / 1000)
  const maxAgeSeconds = Math.max(30, Math.min(60 * 60, Math.floor(Number(params.maxAgeSeconds || 0))))
  if (authDate > nowSeconds + 120) return { ok: false, reason: 'future_auth_date' }
  if (nowSeconds - authDate > maxAgeSeconds) return { ok: false, reason: 'expired_auth_date' }

  const rawUser = asTrimmed(searchParams.get('user') ?? '')
  if (!rawUser) return { ok: false, reason: 'missing_user' }
  const parsedUser = parseTelegramMiniAppUser(rawUser)
  if (!parsedUser) return { ok: false, reason: 'invalid_user' }

  const chatId = parseTelegramMiniAppChatId(asTrimmed(searchParams.get('chat') ?? ''))
  const chatType = asTrimmed(searchParams.get('chat_type') ?? '') || null
  const chatInstance = asTrimmed(searchParams.get('chat_instance') ?? '') || null

  return {
    ok: true,
    identity: {
      telegramUserId: parsedUser.id,
      telegramUsername: parsedUser.username,
      chatId,
      chatType,
      chatInstance,
      authDate,
      initDataHash: createHash('sha256').update(initData, 'utf8').digest('hex'),
    },
  }
}

export function readTelegramMiniAppSessionToken(params: {
  req: Pick<VercelRequest, 'headers'>
  bodyToken?: string | null
}): string {
  const fromBody = asTrimmed(params.bodyToken ?? '')
  if (fromBody) return fromBody

  const fromHeaders =
    readHeaderAsTrimmed(params.req.headers['x-telegram-miniapp-session']) ||
    readHeaderAsTrimmed(params.req.headers['x-telegram-miniapp-session-token'])
  if (fromHeaders) return fromHeaders

  const authorization = readHeaderAsTrimmed(params.req.headers.authorization)
  if (/^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, '').trim()
  }
  return ''
}
