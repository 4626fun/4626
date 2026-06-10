import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  mergeTrayActivityRows,
  resolveTrayWalletActivityBatch,
  type TrayOnchainActivityRow,
} from '../../../server/_lib/lens/trayActivityResolve.js'
import { getStringQuery, handleOptions, isAddressLike, setCache, setCors } from '../../../server/debank/_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 30
const MAX_WALLETS_PER_REQUEST = 5
const CACHE_SECONDS = 45
const DEFAULT_LIMIT_PER_WALLET = 15
const MAX_LIMIT_PER_WALLET = 30

export type AccountTrayActivityBatchResponse = {
  asOf: number
  results: Record<string, TrayOnchainActivityRow[]>
  merged: TrayOnchainActivityRow[]
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
  const buckets: Map<string, RateBucket> = (g.__4626_wallet_tray_activity_rate_buckets ??= new Map())

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

function parseLimitPerWallet(req: VercelRequest): number {
  const raw = getStringQuery(req, 'limit')
  if (!raw) return DEFAULT_LIMIT_PER_WALLET
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT_PER_WALLET
  return Math.min(n, MAX_LIMIT_PER_WALLET)
}

function hasActivityProvider(): boolean {
  return Boolean((process.env.ETHERSCAN_API_KEY ?? '').trim())
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

  if (!hasActivityProvider()) {
    return res.status(501).json({
      success: false,
      error: 'Configure ETHERSCAN_API_KEY for account tray activity',
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
    const limitPerWallet = parseLimitPerWallet(req)
    const batch = await resolveTrayWalletActivityBatch(wallets, { limitPerWallet })
    const merged = mergeTrayActivityRows(Object.values(batch.results).flat())

    setCache(res, CACHE_SECONDS)
    return res.status(200).json({
      success: true,
      data: {
        asOf: batch.asOf,
        results: batch.results,
        merged,
      } satisfies AccountTrayActivityBatchResponse,
    } satisfies ApiEnvelope<AccountTrayActivityBatchResponse>)
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || 'Failed to resolve account tray activity',
    } satisfies ApiEnvelope<never>)
  }
}
