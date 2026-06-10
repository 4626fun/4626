import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDb,
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { createVaultControlPlane } from '../../../../server/_lib/controlPlane/vaultControlPlane.js'

type AdminControlPlaneStatusResponse = {
  admin: string
  operationCounts: Record<string, number>
  stageCounts: Record<string, number>
  keeperJobCounts: Record<string, number>
  stuck: {
    thresholdMinutes: number
    operations: Array<{
      operationId: string
      operationKind: string
      status: string
      scopeType: string
      scopeId: string
      ageMinutes: number
      updatedAt: string
    }>
  }
  recentFailures: Array<{
    operationId: string
    stageId: string | null
    eventType: string
    message: string
    createdAt: string
  }>
  recentOperations: Array<{
    operationId: string
    operationKind: string
    status: string
    scopeType: string
    scopeId: string
    createdAt: string
    updatedAt: string
  }>
  vaultLifecycle?: {
    vaultAddress: string
    graduatedAt: string | null
    settledAt: string | null
    settlementStage: string | null
    settlementStageUpdatedAt: string | null
    freshness?: 'fresh' | 'stale'
    lastUpdatedAt?: string | null
    degradationMode?: 'allow_stale_read'
    warning?: string
  } | null
}

function parsePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

const ALLOWED_OPERATION_KINDS = new Set([
  'payment.activation',
  'vault.provision',
  'vault.maintenance',
  'vault.settle',
  'operator.action',
])

function parseOperationKindFilter(value: unknown): string | null {
  const kind = typeof value === 'string' ? value.trim() : ''
  if (!kind) return null
  return ALLOWED_OPERATION_KINDS.has(kind) ? kind : null
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

  const thresholdMinutes = parsePositiveInt(req.query.stuckMinutes, 30, 1, 24 * 60)
  const limit = parsePositiveInt(req.query.limit, 20, 1, 200)
  const operationKind = parseOperationKindFilter(req.query.operationKind)

  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }

    const [operationCountsRes, stageCountsRes, jobCountsRes, stuckRes, failuresRes, recentOperationsRes] =
      await Promise.all([
      db.sql<{ status: string; count: number }>`
        SELECT status, COUNT(*)::int AS count
        FROM public.control_plane_operations
        GROUP BY status;
      `,
      db.sql<{ status: string; count: number }>`
        SELECT status, COUNT(*)::int AS count
        FROM public.control_plane_stages
        GROUP BY status;
      `,
      db.sql<{ status: string; count: number }>`
        SELECT status, COUNT(*)::int AS count
        FROM public.keeper_jobs
        GROUP BY status;
      `,
      db.sql<{
        operation_id: string
        operation_kind: string
        status: string
        scope_type: string
        scope_id: string
        updated_at: string
        age_minutes: number
      }>`
        SELECT
          operation_id,
          operation_kind,
          status,
          scope_type,
          scope_id,
          updated_at,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60)::int AS age_minutes
        FROM public.control_plane_operations
        WHERE status IN ('requested','queued','running','blocked','retrying','manual_review')
          AND updated_at <= NOW() - (${thresholdMinutes} || ' minutes')::interval
          AND (${operationKind}::text IS NULL OR operation_kind = ${operationKind})
        ORDER BY updated_at ASC
        LIMIT ${limit};
      `,
      db.sql<{
        operation_id: string
        stage_id: string | null
        event_type: string
        message: string
        created_at: string
      }>`
        SELECT operation_id, stage_id, event_type, message, created_at
        FROM public.control_plane_events
        WHERE event_type IN ('operation.status_transition', 'stage.status_transition')
          AND (
            message ILIKE '%failed%'
            OR message ILIKE '%retry%'
            OR message ILIKE '%manual_review%'
          )
        ORDER BY created_at DESC
        LIMIT ${limit};
      `,
      db.sql<{
        operation_id: string
        operation_kind: string
        status: string
        scope_type: string
        scope_id: string
        created_at: string
        updated_at: string
      }>`
        SELECT
          operation_id,
          operation_kind,
          status,
          scope_type,
          scope_id,
          created_at,
          updated_at
        FROM public.control_plane_operations
        WHERE (${operationKind}::text IS NULL OR operation_kind = ${operationKind})
        ORDER BY created_at DESC
        LIMIT ${limit};
      `,
    ])

    const toCountMap = (rows: Array<{ status: string; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[String(row.status)] = Number(row.count ?? 0)
        return acc
      }, {})

    const data: AdminControlPlaneStatusResponse = {
      admin,
      operationCounts: toCountMap(operationCountsRes.rows ?? []),
      stageCounts: toCountMap(stageCountsRes.rows ?? []),
      keeperJobCounts: toCountMap(jobCountsRes.rows ?? []),
      stuck: {
        thresholdMinutes,
        operations: (stuckRes.rows ?? []).map((row) => ({
          operationId: String(row.operation_id),
          operationKind: String(row.operation_kind),
          status: String(row.status),
          scopeType: String(row.scope_type),
          scopeId: String(row.scope_id),
          ageMinutes: Number(row.age_minutes ?? 0),
          updatedAt: String(row.updated_at),
        })),
      },
      recentFailures: (failuresRes.rows ?? []).map((row) => ({
        operationId: String(row.operation_id),
        stageId: row.stage_id ? String(row.stage_id) : null,
        eventType: String(row.event_type),
        message: String(row.message ?? ''),
        createdAt: String(row.created_at),
      })),
      recentOperations: (recentOperationsRes.rows ?? []).map((row) => ({
        operationId: String(row.operation_id),
        operationKind: String(row.operation_kind),
        status: String(row.status),
        scopeType: String(row.scope_type),
        scopeId: String(row.scope_id),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
    }

    const vaultAddress =
      typeof req.query.vaultAddress === 'string' ? req.query.vaultAddress.trim().toLowerCase() : ''
    if (/^0x[a-f0-9]{40}$/.test(vaultAddress)) {
      data.vaultLifecycle = await createVaultControlPlane().getVaultLifecycleStatus(vaultAddress)
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AdminControlPlaneStatusResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'control_plane_status_failed'
    if (/control_plane_operations|control_plane_stages|control_plane_events/i.test(message)) {
      return res.status(503).json({
        success: false,
        error:
          'control_plane_schema_missing: apply control-plane migrations to DATABASE_URL target before using this endpoint',
      } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

