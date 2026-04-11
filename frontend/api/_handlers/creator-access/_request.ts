import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  ensureCreatorAccessSchema,
  getDb,
  isDbConfigured,
  getSessionAddress,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'


import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../server/_lib/supabaseAdmin.js'


type RequestBody = {
  coin?: string
}
const REQUEST_BODY_MAX_BYTES = 16_384

function parseRequestBody(input: unknown): RequestBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as RequestBody
}

function parseCoin(value: unknown): { ok: true; value: `0x${string}` | null } | { ok: false } {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!isAddressLike(trimmed)) return { ok: false }
  return { ok: true, value: trimmed.toLowerCase() as `0x${string}` }
}

type RequestAccessResponse = {
  address: string
  status: 'approved' | 'pending'
  requestId?: number
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddressRaw = getSessionAddress(req)
  if (!sessionAddressRaw) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  // Normalize to lowercase for case-insensitive matching
  const sessionAddress = sessionAddressRaw.toLowerCase()

  const limiter = checkRateLimit(
    rateLimitKey('creator-access-request', sessionAddress, getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = parseRequestBody(await readBoundedJsonObjectBody(req, { maxBytes: REQUEST_BODY_MAX_BYTES }))
  const parsedCoin = parseCoin(body.coin)
  if (!parsedCoin.ok) {
    return res.status(400).json({ success: false, error: 'Invalid coin address' } satisfies ApiEnvelope<never>)
  }
  const coin = parsedCoin.value

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()

      // If already allowlisted, short-circuit.
      const allow = await supabase
        .from('allowlist')
        .select('address')
        .ilike('address', sessionAddress)
        .is('revoked_at', null)
        .limit(1)
      if (allow.error) throw new Error(allow.error.message)
      if (Array.isArray(allow.data) && allow.data.length > 0) {
        return res.status(200).json({
          success: true,
          data: { address: sessionAddress, status: 'approved' } satisfies RequestAccessResponse,
        } satisfies ApiEnvelope<RequestAccessResponse>)
      }

      const now = new Date().toISOString()

      // Prefer "one pending request per wallet". If table constraint isn't present yet,
      // we still de-dupe by updating the latest pending request.
      const existing = await supabase
        .from('access_requests')
        .select('id')
        .ilike('wallet_address', sessionAddress)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (existing.error) throw new Error(existing.error.message)

      const existingRow = Array.isArray(existing.data) ? existing.data[0] : null
      const existingId =
        existingRow && (existingRow as any).id !== null && (existingRow as any).id !== undefined
          ? Number((existingRow as any).id)
          : null

      if (existingId && Number.isFinite(existingId) && existingId > 0) {
        const u = await supabase
          .from('access_requests')
          .update({ coin_address: coin, updated_at: now })
          .eq('id', existingId)
          .select('id')
          .limit(1)
        if (u.error) throw new Error(u.error.message)
        return res.status(200).json({
          success: true,
          data: { address: sessionAddress, status: 'pending', requestId: existingId } satisfies RequestAccessResponse,
        } satisfies ApiEnvelope<RequestAccessResponse>)
      }

      const inserted = await supabase
        .from('access_requests')
        .insert({ wallet_address: sessionAddress, coin_address: coin, status: 'pending' })
        .select('id')
        .limit(1)
      if (inserted.error) throw new Error(inserted.error.message)

      const id = Array.isArray(inserted.data) ? (inserted.data[0] as any)?.id : (inserted.data as any)?.id
      const requestId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : undefined

      return res.status(200).json({
        success: true,
        data: {
          address: sessionAddress,
          status: 'pending',
          requestId,
        } satisfies RequestAccessResponse,
      } satisfies ApiEnvelope<RequestAccessResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase request failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  // If already allowlisted, short-circuit.
  const allow = await db.query(`SELECT address FROM allowlist WHERE LOWER(address) = $1 AND revoked_at IS NULL LIMIT 1;`, [
    sessionAddress,
  ])
  if (allow.rows.length > 0) {
    return res.status(200).json({
      success: true,
      data: { address: sessionAddress, status: 'approved' } satisfies RequestAccessResponse,
    } satisfies ApiEnvelope<RequestAccessResponse>)
  }

  // Create (or update) a pending request.
  const inserted = await db.query(
    `INSERT INTO access_requests (wallet_address, coin_address, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (wallet_address) WHERE status = 'pending'
     DO UPDATE SET
       coin_address = COALESCE(EXCLUDED.coin_address, access_requests.coin_address),
       updated_at = NOW()
     RETURNING id;`,
    [sessionAddress, coin],
  )

  const id = inserted.rows?.[0]?.id
  const requestId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : undefined

  return res.status(200).json({
    success: true,
    data: {
      address: sessionAddress,
      status: 'pending',
      requestId,
    } satisfies RequestAccessResponse,
  } satisfies ApiEnvelope<RequestAccessResponse>)
}
