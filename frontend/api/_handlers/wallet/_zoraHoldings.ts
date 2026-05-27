import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  clampTopTokenCount,
  resolveZoraWalletHoldings,
  type ZoraWalletHoldingsResult,
} from '../../../server/_lib/wallet/zoraWalletHoldings.js'
import { getStringQuery, handleOptions, isAddressLike, setCache, setCors } from '../../../server/debank/_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 40
const CACHE_SECONDS = 60

function getClientKey(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim().length > 0) return xff.split(',')[0]!.trim()
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim().length > 0) return realIp.trim()
  return 'unknown'
}

function rateLimitOk(req: VercelRequest): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = getClientKey(req)
  const now = Date.now()

  const g: any = globalThis as any
  const buckets: Map<string, RateBucket> = (g.__4626_wallet_zora_holdings_rate_buckets ??= new Map())

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { ok: true }
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS_PER_IP) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  bucket.count += 1
  return { ok: true }
}

function hasPortfolioProvider(): boolean {
  const debank = (process.env.DEBANK_ACCESS_KEY ?? '').trim()
  const etherscan = (process.env.ETHERSCAN_API_KEY ?? '').trim()
  return Boolean(debank || etherscan)
}

function parseTopTokenCount(req: VercelRequest): number {
  const raw = getStringQuery(req, 'topTokens')
  if (!raw) return clampTopTokenCount(undefined)
  const n = Number.parseInt(raw, 10)
  return clampTopTokenCount(Number.isFinite(n) ? n : undefined)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rl = rateLimitOk(req)
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds))
    return res.status(429).json({ success: false, error: 'Rate limited. Please retry shortly.' } satisfies ApiEnvelope<never>)
  }

  if (!hasPortfolioProvider()) {
    return res.status(501).json({
      success: false,
      error: 'Configure DEBANK_ACCESS_KEY or ETHERSCAN_API_KEY for wallet Zora holdings',
    } satisfies ApiEnvelope<never>)
  }

  const wallet =
    getStringQuery(req, 'wallet') ?? getStringQuery(req, 'address') ?? getStringQuery(req, 'id')
  if (!wallet || !isAddressLike(wallet)) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address' } satisfies ApiEnvelope<never>)
  }

  try {
    const data = await resolveZoraWalletHoldings({
      wallet,
      topTokenCount: parseTopTokenCount(req),
    })

    if (!data) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' } satisfies ApiEnvelope<never>)
    }

    setCache(res, CACHE_SECONDS)
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraWalletHoldingsResult>)
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || 'Failed to resolve Zora wallet holdings',
    } satisfies ApiEnvelope<never>)
  }
}
