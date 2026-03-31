import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '../../../../packages/server-core/src/index.js'

import { ensureKeeprSchema } from '../../../../server/_lib/keeprSchema.js'


declare const process: { env: Record<string, string | undefined> }

type PendingAction = {
  id: number
  vaultAddress: string
  groupId: string
  actionType: string | null
  action: unknown
  dedupeKey: string | null
  status: string
  attemptCount: number
  lastError: string | null
  createdAt: string
}

type PendingResponse = {
  actions: PendingAction[]
  count: number
}

/**
 * GET /api/keepr/actions/pending
 *
 * Returns pending/retry actions from the keepr_actions queue.
 * Protected by a shared secret (KEEPR_API_KEY).
 *
 * Query params:
 *   - limit: max actions to return (default 10, max 50)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Auth: shared secret
  const secret = process.env.KEEPR_API_KEY
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server misconfigured' } satisfies ApiEnvelope<never>)
  }

  const authHeader = req.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }
    await ensureKeeprSchema()

    const limitParam = Number(req.query.limit) || 10
    const limit = Math.min(Math.max(limitParam, 1), 50)

    const result = await db.sql`
      SELECT
        id, vault_address, group_id, action_type, action,
        dedupe_key, status, attempt_count, last_error, created_at
      FROM keepr_actions
      WHERE status IN ('pending', 'retry')
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at ASC
      LIMIT ${limit};
    `

    const actions: PendingAction[] = (result.rows ?? []).map((row: any) => ({
      id: Number(row.id),
      vaultAddress: String(row.vault_address),
      groupId: String(row.group_id),
      actionType: row.action_type ? String(row.action_type) : null,
      action: row.action,
      dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
      status: String(row.status),
      attemptCount: Number(row.attempt_count ?? 0),
      lastError: row.last_error ? String(row.last_error) : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }))

    return res.status(200).json({
      success: true,
      data: { actions, count: actions.length },
    } satisfies ApiEnvelope<PendingResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
