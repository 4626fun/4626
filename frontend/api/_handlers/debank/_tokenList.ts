import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getStringQuery, handleOptions, isAddressLike, requireDebankAccessKey, setCache, setCors } from '../../../server/debank/_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20

const CACHE_SECONDS = 60
const DEBANK_BASE_URL = 'https://pro-openapi.debank.com/v1'

type CacheEntry = {
  value: DebankTokenListResponse
  expiresAt: number
}

const CACHE_TTL_MS = CACHE_SECONDS * 1000
const MAX_MEMORY_CACHE_ENTRIES = 3_000

function getMemoryCache(): Map<string, CacheEntry> {
  const g: any = globalThis as any
  const cache: Map<string, CacheEntry> = (g.__creatorvault_debank_token_list_cache ??= new Map())
  if (cache.size > MAX_MEMORY_CACHE_ENTRIES) cache.clear()
  return cache
}

export type DebankToken = {
  id: string
  chain?: string
  name?: string
  symbol?: string
  decimals?: number
  logoUrl?: string
  amount: number
  price?: number
  usdValue: number
}

export type DebankTokenListResponse = {
  asOf: number
  address: string
  chainId: string
  tokens: DebankToken[]
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
  const buckets: Map<string, RateBucket> = (g.__creatorvault_debank_token_list_rate_buckets ??= new Map())

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

function normalizeChainId(raw: string | null): string {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return 'base'
  // Allow only a small set of known strings for safety; default to base.
  if (v === 'base' || v === 'ethereum' || v === 'eth' || v === 'arbitrum' || v === 'optimism') return v === 'eth' ? 'ethereum' : v
  return 'base'
}

async function fetchJson<T>(url: string, headers: Record<string, string>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    if (!res.ok) throw new Error(`DeBank HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
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

  const accessKey = requireDebankAccessKey()
  if (!accessKey) {
    return res.status(501).json({ success: false, error: 'DEBANK_ACCESS_KEY is not configured' } satisfies ApiEnvelope<never>)
  }

  const addressRaw = getStringQuery(req, 'id') ?? getStringQuery(req, 'address') ?? getStringQuery(req, 'wallet')
  if (!addressRaw || !isAddressLike(addressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid address' } satisfies ApiEnvelope<never>)
  }
  const address = addressRaw.toLowerCase()

  const chainId = normalizeChainId(getStringQuery(req, 'chainId') ?? getStringQuery(req, 'chain'))

  const cacheKey = `${address}:${chainId}`
  const cache = getMemoryCache()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now < cached.expiresAt) {
    setCache(res, CACHE_SECONDS)
    return res.status(200).json({ success: true, data: cached.value } satisfies ApiEnvelope<DebankTokenListResponse>)
  }

  try {
    type DebankTokenRaw = {
      id: string
      chain?: string
      name?: string
      symbol?: string
      decimals?: number
      logo_url?: string
      amount?: number
      price?: number
      usd_value?: number
    }

    const headers = { accept: 'application/json', AccessKey: accessKey }
    const url =
      `${DEBANK_BASE_URL}/user/token_list?id=${encodeURIComponent(address)}` +
      `&chain_id=${encodeURIComponent(chainId)}` +
      // include small balances so creator/content coins don't get dropped
      `&is_all=true`

    const raw = await fetchJson<DebankTokenRaw[]>(url, headers, 10_000)
    const tokens: DebankToken[] = (Array.isArray(raw) ? raw : [])
      .map((t) => {
        const id = typeof t?.id === 'string' ? t.id : ''
        if (!id) return null
        const amount = typeof t?.amount === 'number' && Number.isFinite(t.amount) ? t.amount : NaN
        const usdValue = typeof t?.usd_value === 'number' && Number.isFinite(t.usd_value) ? t.usd_value : NaN
        if (!Number.isFinite(amount) || amount <= 0) return null
        if (!Number.isFinite(usdValue) || usdValue < 0) return null
        return {
          id,
          chain: typeof t?.chain === 'string' ? t.chain : undefined,
          name: typeof t?.name === 'string' ? t.name : undefined,
          symbol: typeof t?.symbol === 'string' ? t.symbol : undefined,
          decimals: typeof t?.decimals === 'number' && Number.isFinite(t.decimals) ? t.decimals : undefined,
          logoUrl: typeof t?.logo_url === 'string' ? t.logo_url : undefined,
          amount,
          price: typeof t?.price === 'number' && Number.isFinite(t.price) ? t.price : undefined,
          usdValue,
        } satisfies DebankToken
      })
      .filter((v): v is DebankToken => Boolean(v))
      .sort((a, b) => b.usdValue - a.usdValue)

    const data: DebankTokenListResponse = {
      asOf: now,
      address,
      chainId,
      tokens,
    }

    cache.set(cacheKey, { value: data, expiresAt: now + CACHE_TTL_MS })
    setCache(res, CACHE_SECONDS)
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DebankTokenListResponse>)
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch token list',
    } satisfies ApiEnvelope<never>)
  }
}

