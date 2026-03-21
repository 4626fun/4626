import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  readTelegramMiniAppSessionToken,
  resolveTelegramMiniAppVerificationStatusCode,
  verifyTelegramMiniAppInitData,
} from '../_handlers/telegram/webhook/miniAppAuth'

function buildInitData(params: {
  botToken: string
  authDate: number
  userId: string
  username?: string
  signature?: string
  includeSignatureInHash?: boolean
}): string {
  const payload = new URLSearchParams()
  payload.set('auth_date', String(params.authDate))
  payload.set(
    'user',
    JSON.stringify({
      id: Number(params.userId),
      first_name: 'Akita',
      username: params.username ?? 'akita',
    }),
  )
  if (typeof params.signature === 'string' && params.signature.trim().length > 0) {
    payload.set('signature', params.signature.trim())
  }
  const pairs = Array.from(payload.entries())
    .filter(([key]) => params.includeSignatureInHash === true || key !== 'signature')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
  const dataCheckString = pairs.join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(params.botToken, 'utf8').digest()
  const hash = createHmac('sha256', secret).update(dataCheckString, 'utf8').digest('hex')
  payload.set('hash', hash)
  return payload.toString()
}

describe('telegram mini app initData verification', () => {
  it('accepts valid initData payloads', () => {
    const botToken = 'test-bot-token'
    const initData = buildInitData({
      botToken,
      authDate: Math.floor(Date.now() / 1000),
      userId: '42',
    })

    const result = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: 900,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.identity.telegramUserId).toBe('42')
      expect(result.identity.telegramUsername).toBe('akita')
      expect(result.identity.initDataHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('accepts valid initData when signature is present and included in hash canonicalization', () => {
    const botToken = 'test-bot-token'
    const initData = buildInitData({
      botToken,
      authDate: Math.floor(Date.now() / 1000),
      userId: '42',
      signature: 'test-signature-blob',
      includeSignatureInHash: true,
    })

    const result = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: 900,
    })
    expect(result.ok).toBe(true)
  })

  it('accepts valid initData when signature is present but excluded from hash canonicalization', () => {
    const botToken = 'test-bot-token'
    const initData = buildInitData({
      botToken,
      authDate: Math.floor(Date.now() / 1000),
      userId: '42',
      signature: 'test-signature-blob',
      includeSignatureInHash: false,
    })

    const result = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: 900,
    })
    expect(result.ok).toBe(true)
  })

  it('derives the same replay nonce hash for reordered initData params', () => {
    const botToken = 'test-bot-token'
    const initData = buildInitData({
      botToken,
      authDate: Math.floor(Date.now() / 1000),
      userId: '42',
    })
    const parsed = new URLSearchParams(initData)
    const reordered = new URLSearchParams()
    reordered.set('user', String(parsed.get('user') ?? ''))
    reordered.set('auth_date', String(parsed.get('auth_date') ?? ''))
    reordered.set('hash', String(parsed.get('hash') ?? ''))

    const first = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: 900,
    })
    const second = verifyTelegramMiniAppInitData({
      initData: reordered.toString(),
      botToken,
      maxAgeSeconds: 900,
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.identity.initDataHash).toBe(second.identity.initDataHash)
    }
  })

  it('rejects invalid hash', () => {
    const result = verifyTelegramMiniAppInitData({
      initData: 'auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=deadbeef',
      botToken: 'test-bot-token',
      maxAgeSeconds: 900,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_hash_format')
      expect(resolveTelegramMiniAppVerificationStatusCode(result.reason)).toBe(400)
    }
  })

  it('rejects expired auth_date', () => {
    const botToken = 'test-bot-token'
    const initData = buildInitData({
      botToken,
      authDate: Math.floor(Date.now() / 1000) - 10_000,
      userId: '42',
    })

    const result = verifyTelegramMiniAppInitData({
      initData,
      botToken,
      maxAgeSeconds: 60,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('expired_auth_date')
      expect(resolveTelegramMiniAppVerificationStatusCode(result.reason)).toBe(401)
    }
  })
})

describe('telegram mini app session token reader', () => {
  it('reads session token from custom header', () => {
    const token = readTelegramMiniAppSessionToken({
      req: {
        headers: {
          'x-telegram-miniapp-session': 'mini-session-token',
        } as any,
      },
    })
    expect(token).toBe('mini-session-token')
  })

  it('falls back to Authorization bearer token', () => {
    const token = readTelegramMiniAppSessionToken({
      req: {
        headers: {
          authorization: 'Bearer another-session-token',
        } as any,
      },
    })
    expect(token).toBe('another-session-token')
  })
})
