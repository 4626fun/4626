import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  ensureTelegramTradingSchema,
  getTelegramLinkStatus,
  getTelegramPortfolioSummary,
  listTelegramAuctions,
  listTelegramScopedVaults,
  listTelegramSignals,
  readTelegramMiniAppSession,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { readTelegramMiniAppSessionToken } from './webhook/miniAppAuth.js'
import { readQueryString } from './webhook/utils.js'

type TelegramDiscoveryData = {
  telegramUserId: string
  chatId: string | null
  linked: boolean
  linkStatus: string
  ownerVerified: boolean
  canonicalCswAddress: string | null
  portfolio: Awaited<ReturnType<typeof getTelegramPortfolioSummary>>
  vaults: Awaited<ReturnType<typeof listTelegramScopedVaults>>
  auctions: Awaited<ReturnType<typeof listTelegramAuctions>>
  signals: Awaited<ReturnType<typeof listTelegramSignals>>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionToken = readTelegramMiniAppSessionToken({ req })
  if (!sessionToken) {
    return res.status(401).json({ success: false, error: 'Telegram Mini App session token is required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureWaitlistSchema(db as any)
  await ensureTelegramTradingSchema(db as any)

  const session = await readTelegramMiniAppSession({
    db: db as any,
    sessionToken,
  })
  if (!session.ok) {
    return res.status(session.reason === 'expired' ? 410 : 401).json({
      success: false,
      error: session.reason === 'expired' ? 'Telegram Mini App session expired' : 'Invalid Telegram Mini App session',
    } satisfies ApiEnvelope<never>)
  }

  const requestedLimit = Number(readQueryString(req, 'limit') ?? '')
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(25, Math.floor(requestedLimit))) : 8

  const link = await getTelegramLinkStatus({
    db: db as any,
    telegramUserId: session.session.telegramUserId,
  })
  const portfolio = await getTelegramPortfolioSummary({
    db: db as any,
    telegramUserId: session.session.telegramUserId,
    recentLimit: Math.min(limit, 12),
  })
  const chatId = session.session.chatId
  const [vaults, auctions, signals] = chatId
    ? await Promise.all([
        listTelegramScopedVaults({ db: db as any, chatId, limit }),
        listTelegramAuctions({ db: db as any, chatId, limit }),
        listTelegramSignals({ db: db as any, chatId, limit }),
      ])
    : [[], [], []]

  return res.status(200).json({
    success: true,
    data: {
      telegramUserId: session.session.telegramUserId,
      chatId,
      linked: Boolean(link && link.linkStatus === 'active'),
      linkStatus: link?.linkStatus ?? 'none',
      ownerVerified: link?.ownerVerified ?? false,
      canonicalCswAddress: link?.canonicalCswAddress ?? null,
      portfolio,
      vaults,
      auctions,
      signals,
    } satisfies TelegramDiscoveryData,
  } satisfies ApiEnvelope<TelegramDiscoveryData>)
}
