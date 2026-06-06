import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  readSessionFromRequest,
} from '@4626/server-core'
import { readCounterTradeRuntimeConfig } from '../../../../server/_lib/alfaclub/counterTradeConfig.js'
import {
  listRecentCounterTradeActions,
  readCounterTradeUserOptIn,
  readOrCreateCounterTradeRoomStrategy,
} from '../../../../server/_lib/alfaclub/counterTradeStore.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null
}

function isEnabledByEnv(): boolean {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-counter-trade-status', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = normalizeAddress(String(session?.address ?? ''))
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'auth_session_required' })
  }

  const runtime = readCounterTradeRuntimeConfig()
  const roomId = runtime.roomId
  const [strategy, optIn, recentActions] = await Promise.all([
    readOrCreateCounterTradeRoomStrategy(roomId),
    readCounterTradeUserOptIn({ roomId, senderAddress: sessionAddress }),
    listRecentCounterTradeActions({ roomId, senderAddress: sessionAddress, limit: 20 }),
  ])

  return res.status(200).json({
    success: true,
    data: {
      roomId,
      engineEnabled: runtime.enabled && isEnabledByEnv(),
      strategy,
      user: {
        senderAddress: sessionAddress,
        state: optIn?.state ?? 'not_opted_in',
        preset: optIn?.preset ?? null,
        pauseReason: optIn?.pauseReason ?? null,
        lastActionAt: optIn?.lastActionAt ?? null,
      },
      recentActions,
    },
  })
}

