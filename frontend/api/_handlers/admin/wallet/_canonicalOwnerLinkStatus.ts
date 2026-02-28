import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import {
  CSW_OWNER_LINK_STATUSES,
  ensureCswOwnerLinkStatusSchema,
} from '../../../../server/_lib/cswOwnerLinkStatus.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

type StatusItem = {
  profileId: number
  email: string | null
  privyUserId: string | null
  embeddedEoa: string | null
  canonicalSmartWallet: string | null
  ownerLinked: boolean
  status: string
  reason: string | null
  suggestedCanonicalSmartWallet: string | null
  checkedAt: string
  updatedAt: string
  metadata: Record<string, unknown> | null
}

type StatusSummary = { status: string; count: number }

type ListResponse = {
  admin: string
  total: number
  limit: number
  offset: number
  items: StatusItem[]
  summary: StatusSummary[]
}

function parseIntParam(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

function toIso(value: unknown): string {
  if (!value) return new Date(0).toISOString()
  try {
    return new Date(String(value)).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

function normalizeStatusFilter(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate) return null
  return CSW_OWNER_LINK_STATUSES.includes(candidate as (typeof CSW_OWNER_LINK_STATUSES)[number]) ? candidate : '__invalid__'
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  await ensureCswOwnerLinkStatusSchema(db as any)

  const statusFilter = normalizeStatusFilter((req.query as any)?.status)
  if (statusFilter === '__invalid__') {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Allowed: ${CSW_OWNER_LINK_STATUSES.join(', ')}`,
    } satisfies ApiEnvelope<never>)
  }
  const qRaw = typeof (req.query as any)?.q === 'string' ? String((req.query as any).q) : ''
  const q = qRaw.trim()

  const limit = Math.min(parseIntParam((req.query as any)?.limit, 100), 500)
  const offset = parseIntParam((req.query as any)?.offset, 0)

  const whereParts: string[] = []
  const whereParams: any[] = []

  if (statusFilter) {
    whereParts.push(`s.status = $${whereParams.length + 1}`)
    whereParams.push(statusFilter)
  }
  if (q) {
    const idx = whereParams.length + 1
    whereParts.push(`(
      p.email ILIKE $${idx}
      OR s.privy_user_id ILIKE $${idx}
      OR s.embedded_eoa ILIKE $${idx}
      OR s.canonical_smart_wallet ILIKE $${idx}
      OR s.suggested_canonical_smart_wallet ILIKE $${idx}
      OR s.reason ILIKE $${idx}
    )`)
    whereParams.push(`%${q}%`)
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

  const countResult = await db.query(
    `
      SELECT COUNT(*)::BIGINT AS total
      FROM csw_owner_link_status s
      LEFT JOIN profiles p ON p.id = s.profile_id
      ${whereSql};
    `,
    whereParams,
  )
  const total = Number(countResult.rows?.[0]?.total ?? 0)

  const listParams = [...whereParams, limit, offset]
  const limitIdx = whereParams.length + 1
  const offsetIdx = whereParams.length + 2
  const rows = await db.query(
    `
      SELECT
        s.profile_id,
        p.email,
        s.privy_user_id,
        s.embedded_eoa,
        s.canonical_smart_wallet,
        s.owner_linked,
        s.status,
        s.reason,
        s.suggested_canonical_smart_wallet,
        s.checked_at,
        s.updated_at,
        s.metadata
      FROM csw_owner_link_status s
      LEFT JOIN profiles p ON p.id = s.profile_id
      ${whereSql}
      ORDER BY s.checked_at DESC, s.profile_id DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx};
    `,
    listParams,
  )

  const summaryRows = await db.query(
    `
      SELECT s.status, COUNT(*)::BIGINT AS count
      FROM csw_owner_link_status s
      LEFT JOIN profiles p ON p.id = s.profile_id
      ${whereSql}
      GROUP BY s.status
      ORDER BY s.status ASC;
    `,
    whereParams,
  )

  const items: StatusItem[] = (rows.rows ?? []).map((row: any) => ({
    profileId: Number(row.profile_id),
    email: typeof row.email === 'string' ? row.email : null,
    privyUserId: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    embeddedEoa: typeof row.embedded_eoa === 'string' ? row.embedded_eoa : null,
    canonicalSmartWallet: typeof row.canonical_smart_wallet === 'string' ? row.canonical_smart_wallet : null,
    ownerLinked: Boolean(row.owner_linked),
    status: typeof row.status === 'string' ? row.status : 'unknown',
    reason: typeof row.reason === 'string' ? row.reason : null,
    suggestedCanonicalSmartWallet:
      typeof row.suggested_canonical_smart_wallet === 'string' ? row.suggested_canonical_smart_wallet : null,
    checkedAt: toIso(row.checked_at),
    updatedAt: toIso(row.updated_at),
    metadata: normalizeMetadata(row.metadata),
  }))

  const summary: StatusSummary[] = (summaryRows.rows ?? []).map((row: any) => ({
    status: typeof row.status === 'string' ? row.status : 'unknown',
    count: Number(row.count ?? 0),
  }))

  return res.status(200).json({
    success: true,
    data: {
      admin,
      total,
      limit,
      offset,
      items,
      summary,
    } satisfies ListResponse,
  } satisfies ApiEnvelope<ListResponse>)
}
