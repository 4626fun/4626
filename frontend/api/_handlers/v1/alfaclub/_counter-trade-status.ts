import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getDb,
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

function setPublicCors(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers.origin
  const requestOrigin =
    typeof originHeader === 'string' && originHeader.trim().length > 0 ? originHeader.trim() : null
  const allowedOrigins = new Set(['https://4626.fun', 'https://app.4626.fun'])
  const allowOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : 'https://4626.fun'

  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
}

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null
}

function isEnabledByEnv(): boolean {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

async function resolveProfileWalletCandidates(sessionAddress: string): Promise<string[]> {
  const normalized = normalizeAddress(sessionAddress)
  if (!normalized) return []
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      WITH matched AS (
        SELECT p.id, p.merged_into_profile_id
        FROM profile_wallets pw
        JOIN profiles p ON p.id = pw.profile_id
        WHERE LOWER(pw.address) = LOWER(${normalized})
        LIMIT 1
      ),
      resolved AS (
        SELECT p2.id AS profile_id
        FROM matched m
        JOIN profiles p2 ON p2.id = COALESCE(m.merged_into_profile_id, m.id)
        WHERE p2.merged_into_profile_id IS NULL
      )
      SELECT DISTINCT LOWER(pw.address) AS address
      FROM profile_wallets pw
      JOIN resolved r ON r.profile_id = pw.profile_id
      WHERE pw.chain_id = 8453
      LIMIT 64;
    `
    return (result.rows ?? [])
      .map((row) => normalizeAddress(String((row as { address?: string }).address ?? '')))
      .filter((value): value is string => Boolean(value))
  } catch {
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(req, res)
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
  const [strategy, profileAddresses] = await Promise.all([
    readOrCreateCounterTradeRoomStrategy(roomId),
    resolveProfileWalletCandidates(sessionAddress),
  ])

  const candidateAddresses = Array.from(new Set([sessionAddress, ...profileAddresses]))
  const candidateStates = await Promise.all(
    candidateAddresses.map(async (address) => {
      const [optIn, recentActions] = await Promise.all([
        readCounterTradeUserOptIn({ roomId, senderAddress: address }),
        listRecentCounterTradeActions({ roomId, senderAddress: address, limit: 20 }),
      ])
      return { address, optIn, recentActions }
    }),
  )

  const selected =
    candidateStates.find((entry) => entry.optIn?.state === 'active') ??
    candidateStates.find((entry) => entry.optIn?.state === 'paused') ??
    candidateStates.find((entry) => entry.recentActions.length > 0) ??
    candidateStates.find((entry) => entry.address === sessionAddress) ??
    candidateStates[0] ??
    { address: sessionAddress, optIn: null, recentActions: [] }

  const optIn = selected.optIn
  const recentActions = selected.recentActions

  return res.status(200).json({
    success: true,
    data: {
      roomId,
      engineEnabled: runtime.enabled && isEnabledByEnv(),
      strategy,
      user: {
        senderAddress: selected.address,
        state: optIn?.state ?? 'not_opted_in',
        preset: optIn?.preset ?? null,
        pauseReason: optIn?.pauseReason ?? null,
        lastActionAt: optIn?.lastActionAt ?? null,
      },
      recentActions,
    },
  })
}

