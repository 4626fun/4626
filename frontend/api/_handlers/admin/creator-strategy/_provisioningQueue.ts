import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
} from '@4626/server-core'
import { getAddress, isAddress, type Address, type Hex } from 'viem'

/**
 * Admin-only dashboard data + mutation endpoints for provisioning the
 * `creator_strategy_features` queue.
 *
 * GET /api/admin/creator-strategy/provisioning-queue
 *   Returns pending + active rows sorted by age so operators can triage
 *   what needs provisioning next.
 *
 * POST /api/admin/creator-strategy/provisioning-queue
 *   { activationId, action: 'mark_active' | 'mark_failed', provisionerRef?, failureReason? }
 *   Transitions a row's status after operator has manually executed the
 *   runbook. Creates an audit trail via `updated_at` + `metadata`.
 *
 * Neither endpoint gives the admin direct onchain capability — we keep
 * Safe-owned contract calls as a separate manual step. This is just the
 * DB-side bookkeeping.
 */

type QueueRow = {
  id: number
  creatorToken: Address
  featureKey: string
  status: 'pending' | 'active' | 'failed' | 'refunded'
  paymentSource: string
  priceUsdcPaid: string
  paymentTxHash: Hex | null
  paymentFrom: Address | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  refundedAt: string | null
  provisionerRef: string | null
  failureReason: string | null
  provisionerNote: string | null
  createdAt: string
  updatedAt: string
  ageSeconds: number
}

function toRow(row: any): QueueRow {
  const md = (row.metadata ?? {}) as Record<string, unknown>
  const now = new Date()
  const created = new Date(String(row.created_at))
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000))
  return {
    id: Number(row.id),
    creatorToken: getAddress(row.creator_token as Address),
    featureKey: String(row.feature_key),
    status: row.status,
    paymentSource: row.payment_source ?? 'usdc_base',
    priceUsdcPaid: String(row.price_usdc_paid ?? '0'),
    paymentTxHash: row.payment_tx_hash ? (String(row.payment_tx_hash).toLowerCase() as Hex) : null,
    paymentFrom: row.payment_from ? getAddress(row.payment_from as Address) : null,
    paymentVerifiedAt: row.payment_verified_at ?? null,
    provisionedAt: row.provisioned_at ?? null,
    failedAt: row.failed_at ?? null,
    refundedAt: row.refunded_at ?? null,
    provisionerRef: row.provisioner_ref ?? null,
    failureReason: row.failure_reason ?? null,
    provisionerNote:
      typeof md.provisionerNote === 'string'
        ? md.provisionerNote
        : typeof md.provisioner_note === 'string'
        ? (md.provisioner_note as string)
        : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ageSeconds,
  }
}

type MutateBody = {
  activationId?: unknown
  action?: unknown
  provisionerRef?: unknown
  failureReason?: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  const admin = getSessionAddress(req)
  if (!admin || !isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  if (req.method === 'GET') {
    const result = await (db as any).sql`
      SELECT id, creator_token, feature_key, status, payment_source,
             price_usdc_paid, payment_tx_hash, payment_from,
             payment_verified_at, provisioned_at, failed_at, refunded_at,
             provisioner_ref, failure_reason, metadata, created_at, updated_at
      FROM creator_strategy_features
      WHERE status IN ('pending', 'active', 'failed')
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'failed' THEN 1
          WHEN 'active' THEN 2
          ELSE 3
        END,
        created_at ASC
      LIMIT 200
    `
    const rows: QueueRow[] = (result.rows ?? []).map(toRow)
    const pending = rows.filter((r: QueueRow) => r.status === 'pending')
    const failed = rows.filter((r: QueueRow) => r.status === 'failed')
    const active = rows.filter((r: QueueRow) => r.status === 'active')
    return res.status(200).json({
      success: true,
      data: {
        counts: {
          pending: pending.length,
          failed: failed.length,
          active: active.length,
          total: rows.length,
        },
        rows,
      },
    } satisfies ApiEnvelope<{ counts: Record<string, number>; rows: QueueRow[] }>)
  }

  if (req.method === 'POST') {
    const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 2_048 })
    const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as MutateBody

    const activationIdRaw = body.activationId
    const activationId =
      typeof activationIdRaw === 'number'
        ? activationIdRaw
        : typeof activationIdRaw === 'string'
        ? Number(activationIdRaw)
        : NaN
    if (!Number.isFinite(activationId) || activationId <= 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid activationId' } satisfies ApiEnvelope<never>)
    }

    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const provisionerRefRaw = typeof body.provisionerRef === 'string' ? body.provisionerRef.trim() : ''
    const failureReasonRaw = typeof body.failureReason === 'string' ? body.failureReason.trim() : ''

    if (action === 'mark_active') {
      if (!provisionerRefRaw) {
        return res.status(400).json({
          success: false,
          error: 'provisionerRef is required when marking active (e.g. tx hash, pool pubkey)',
        } satisfies ApiEnvelope<never>)
      }
      const result = await (db as any).sql`
        UPDATE creator_strategy_features
        SET status = 'active',
            provisioned_at = NOW(),
            provisioner_ref = ${provisionerRefRaw},
            updated_at = NOW()
        WHERE id = ${activationId}
          AND status = 'pending'
        RETURNING id, creator_token, feature_key, status, payment_source,
                  price_usdc_paid, payment_tx_hash, payment_from,
                  payment_verified_at, provisioned_at, failed_at, refunded_at,
                  provisioner_ref, failure_reason, metadata, created_at, updated_at;
      `
      const row = result.rows?.[0]
      if (!row) {
        return res.status(404).json({
          success: false,
          error: `Activation id=${activationId} not found or not in 'pending' status`,
        } satisfies ApiEnvelope<never>)
      }
      return res
        .status(200)
        .json({ success: true, data: { row: toRow(row) } } satisfies ApiEnvelope<{ row: QueueRow }>)
    }

    if (action === 'mark_failed') {
      const reason = failureReasonRaw || 'operator_manual_fail'
      const result = await (db as any).sql`
        UPDATE creator_strategy_features
        SET status = 'failed',
            failed_at = NOW(),
            failure_reason = ${reason},
            updated_at = NOW()
        WHERE id = ${activationId}
          AND status IN ('pending', 'active')
        RETURNING id, creator_token, feature_key, status, payment_source,
                  price_usdc_paid, payment_tx_hash, payment_from,
                  payment_verified_at, provisioned_at, failed_at, refunded_at,
                  provisioner_ref, failure_reason, metadata, created_at, updated_at;
      `
      const row = result.rows?.[0]
      if (!row) {
        return res.status(404).json({
          success: false,
          error: `Activation id=${activationId} not found or already terminal`,
        } satisfies ApiEnvelope<never>)
      }
      return res
        .status(200)
        .json({ success: true, data: { row: toRow(row) } } satisfies ApiEnvelope<{ row: QueueRow }>)
    }

    return res.status(400).json({
      success: false,
      error: `Unknown action "${action}". Expected mark_active or mark_failed.`,
    } satisfies ApiEnvelope<never>)
  }

  return res
    .status(405)
    .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
}

// Unused-import appeasement: keep Address/Hex + isAddress in scope so a
// future enhancement can accept filter query params without re-importing.
void isAddress
