import type { VercelRequest, VercelResponse } from '@vercel/node'

import type { WalletPortfolio } from '../../../server/_lib/lens/debankPortfolio.js'
import {
  resolveTrayWalletPortfolioBatch,
  type TrayPortfolioSource,
} from '../../../server/_lib/lens/trayPortfolioResolve.js'
import { getStringQuery, handleOptions, isAddressLike, setCache, setCors } from '../../../server/debank/_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 30
const MAX_WALLETS_PER_REQUEST = 5
const CACHE_SECONDS = 60
const DEFAULT_TOP_TOKEN_COUNT = 50
const MAX_TOP_TOKEN_COUNT = 100

export type AccountTrayPortfolioBatchResponse = {
  asOf: number
  results: Record<string, WalletPortfolio | null>
  sources: Record<string, TrayPortfolioSource | null>
}

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
  const buckets: Map<string, RateBucket> = (g.__4626_wallet_tray_portfolio_rate_buckets ??= new Map())

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

function parseWalletList(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const part of raw.split(',')) {
    const addr = part.trim()
    if (!addr) continue
    if (!isAddressLike(addr)) continue
    const lc = addr.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(lc)
  }

  return out
}

function parseTopTokenCount(req: VercelRequest): number {
  const raw = getStringQuery(req, 'topTokens')
  if (!raw) return DEFAULT_TOP_TOKEN_COUNT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TOP_TOKEN_COUNT
  return Math.min(n, MAX_TOP_TOKEN_COUNT)
}

function hasPortfolioProvider(): boolean {
  const debank = (process.env.DEBANK_ACCESS_KEY ?? '').trim()
  const etherscan = (process.env.ETHERSCAN_API_KEY ?? '').trim()
  return Boolean(debank || etherscan)
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
      error: 'Configure DEBANK_ACCESS_KEY or ETHERSCAN_API_KEY for account tray portfolios',
    } satisfies ApiEnvelope<never>)
  }

  const raw = getStringQuery(req, 'ids') ?? getStringQuery(req, 'wallets') ?? getStringQuery(req, 'id')
  if (!raw) {
    return res.status(400).json({ success: false, error: 'Missing ids' } satisfies ApiEnvelope<never>)
  }

  const wallets = parseWalletList(raw)
  if (wallets.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid wallet addresses provided' } satisfies ApiEnvelope<never>)
  }

  if (wallets.length > MAX_WALLETS_PER_REQUEST) {
    return res.status(400).json({
      success: false,
      error: `Too many wallets. Max ${MAX_WALLETS_PER_REQUEST}.`,
    } satisfies ApiEnvelope<never>)
  }

  try {
    const topTokenCount = parseTopTokenCount(req)
    const batch = await resolveTrayWalletPortfolioBatch(wallets, { topTokenCount })

    setCache(res, CACHE_SECONDS)
    return res.status(200).json({
      success: true,
      data: {
        asOf: batch.asOf,
        results: batch.results,
        sources: batch.sources,
      } satisfies AccountTrayPortfolioBatchResponse,
    } satisfies ApiEnvelope<AccountTrayPortfolioBatchResponse>)
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || 'Failed to resolve account tray portfolio',
    } satisfies ApiEnvelope<never>)
  }
}
