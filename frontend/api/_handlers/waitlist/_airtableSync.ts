import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDb,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../server/_lib/lottery/cronAuth.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import {
  readWaitlistAirtableSyncConfig,
  syncWaitlistToAirtable,
  type WaitlistAirtableSyncResult,
} from '../../../server/_lib/onboarding/waitlistAirtableSync.js'

declare const process: { env: Record<string, string | undefined> }

function isDryRun(req: VercelRequest): boolean {
  const raw = String((req.query as any)?.dryRun ?? (req.query as any)?.dry_run ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
    return
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' } satisfies ApiEnvelope<never>)
    return
  }

  const { config, missing } = readWaitlistAirtableSyncConfig(process.env)
  if (!config) {
    res.status(503).json({
      success: false,
      error: 'airtable_not_configured',
      data: { missing },
    } satisfies ApiEnvelope<{ missing: string[] }>)
    return
  }

  const db = await getDb()
  if (!db) {
    res.status(503).json({ success: false, error: 'database_not_configured' } satisfies ApiEnvelope<never>)
    return
  }

  try {
    await ensureWaitlistSchema(db as any)
    const data = await syncWaitlistToAirtable({
      db,
      config,
      dryRun: isDryRun(req),
    })
    const hasErrors = data.tables.some(table => table.errors.length > 0)
    const status = hasErrors ? 207 : 200
    res.status(status).json({ success: !hasErrors, data } satisfies ApiEnvelope<WaitlistAirtableSyncResult>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'waitlist_airtable_sync_failed'
    res.status(500).json({
      success: false,
      error: message.slice(0, 500),
    } satisfies ApiEnvelope<never>)
  }
}
