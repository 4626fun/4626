import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { createTelegramLinkStartToken } from '../../../server/_lib/telegramTrading.js'

type LinkStartBody = {
  telegramUserId?: string | number
  chatId?: string | number
  telegramUsername?: string | null
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTelegramUserId(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^\d+$/.test(raw)) return null
  return raw
}

function readTelegramChatId(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^-?\d+$/.test(raw)) return null
  return raw
}

function resolveTelegramMiniAppUrl(): string {
  const configured = asTrimmed(process.env.TELEGRAM_MINI_APP_URL ?? '')
  if (configured && /^https?:\/\//i.test(configured)) return configured
  return 'https://app.4626.fun'
}

function buildTelegramMiniAppUrl(params: {
  baseUrl: string
  pathname?: string
  query?: Record<string, string>
}): string {
  try {
    const url = new URL(params.baseUrl)
    if (params.pathname) {
      url.pathname = params.pathname
    }
    const query = params.query ?? {}
    for (const [key, value] of Object.entries(query)) {
      if (!asTrimmed(value)) continue
      url.searchParams.set(key, value)
    }
    return url.toString()
  } catch {
    return params.baseUrl
  }
}

function buildTelegramLinkSwapNextPath(params: {
  token: string
  chatId: string
  telegramUsername?: string | null
}): string {
  const query = new URLSearchParams({
    tgMiniApp: '1',
    tgEntry: 'link',
    chatAction: 'link-account',
    tgChatId: params.chatId,
    tgLinkToken: params.token,
  })
  const username = asTrimmed(params.telegramUsername ?? '')
  if (username) {
    query.set('tgUsername', username)
  }
  return `/swap?${query.toString()}`
}

function verifyTelegramLinkApiSecret(req: VercelRequest): boolean {
  const configured = asTrimmed(process.env.TELEGRAM_LINK_API_SECRET)
  if (!configured) return true
  const provided = asTrimmed(req.headers['x-telegram-link-secret'])
  return provided === configured
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!verifyTelegramLinkApiSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<LinkStartBody>(req).catch(() => null)) ?? (req.body as LinkStartBody | null) ?? {}
  const telegramUserId = readTelegramUserId(body.telegramUserId)
  const chatId = readTelegramChatId(body.chatId)
  if (!telegramUserId || !chatId) {
    return res.status(400).json({
      success: false,
      error: 'telegramUserId and chatId are required',
    } satisfies ApiEnvelope<never>)
  }

  const token = createTelegramLinkStartToken({
    telegramUserId,
    chatId,
    ttlSeconds: 60 * 15,
  })
  const nextPath = buildTelegramLinkSwapNextPath({
    token: token.token,
    chatId,
    telegramUsername: body.telegramUsername,
  })
  const url = buildTelegramMiniAppUrl({
    baseUrl: resolveTelegramMiniAppUrl(),
    pathname: '/continue',
    query: {
      from: 'waitlist',
      autologin: '1',
      auth: 'wallet',
      next: nextPath,
    },
  })

  return res.status(200).json({
    success: true,
    data: {
      url,
      expiresAt: token.expiresAt,
      telegramUserId,
      chatId,
    },
  } satisfies ApiEnvelope<{
    url: string
    expiresAt: string
    telegramUserId: string
    chatId: string
  }>)
}

