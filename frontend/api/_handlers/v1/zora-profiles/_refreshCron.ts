// SPDX-License-Identifier: MIT
//
// Zora profiles refresh cron — `GET|POST /api/v1/zora-profiles/refresh-cron`.
//
// Refreshes cached market/volume/holder fields in `zora_profiles` from the
// Zora explore API, runs a bounded linked-wallet enrichment pass, and
// reconciles `is_in_csw_index` against `zora_csw_owners`.
//
// Schedule: every 6 hours (see frontend/vercel.json).
// Feature flag: `ZORA_PROFILES_REFRESH_ENABLED=1`.

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from '../../../../server/_lib/db/supabaseAdmin.js'
import { isZoraProfilesRefreshEnabled } from '../../../../server/_lib/zora-profiles/cronConfig.js'
import { runZoraProfilesRefreshTick } from '../../../../server/_lib/zora-profiles/refreshProfiles.js'

export interface ZoraProfilesRefreshCronHooks {
  runTick?: typeof runZoraProfilesRefreshTick
}

let __testHooks: ZoraProfilesRefreshCronHooks = {}

export function __setZoraProfilesRefreshCronHooksForTest(
  hooks: ZoraProfilesRefreshCronHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetZoraProfilesRefreshCronHooksForTest(): void {
  __testHooks = {}
}

function readHandlerTimeoutMs(): number {
  const raw = String(process.env.PROFILE_REFRESH_HANDLER_TIMEOUT_MS ?? '').trim()
  if (!raw) return 55_000
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 5_000) return 55_000
  return Math.min(Math.floor(parsed), 58_000)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!isZoraProfilesRefreshEnabled()) {
    res.status(200).json({
      ok: true,
      tick: 'skipped',
      reason: 'feature_disabled',
    })
    return
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const runTick = __testHooks.runTick ?? runZoraProfilesRefreshTick

  if (!__testHooks.runTick) {
    if (!isSupabaseAdminConfigured()) {
      res.status(200).json({
        ok: true,
        tick: 'skipped',
        reason: 'supabase_not_configured',
      })
      return
    }
    // Ensure admin client is constructible before work starts.
    getSupabaseAdmin()
  }
  const handlerTimeoutMs = readHandlerTimeoutMs()
  const tickPromise = runTick()
  tickPromise.catch((error) => {
    console.warn('[zora-profiles-refresh-cron] late tick failure', {
      error: error instanceof Error ? error.message : String(error),
    })
  })

  const timeoutPromise = new Promise<{ ok: true; tick: 'skipped'; reason: 'handler_timeout'; timeoutMs: number }>(
    (resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: true,
            tick: 'skipped',
            reason: 'handler_timeout',
            timeoutMs: handlerTimeoutMs,
          }),
        handlerTimeoutMs,
      ),
  )

  const result = await Promise.race([tickPromise, timeoutPromise])

  if (!result.ok) {
    console.warn('[zora-profiles-refresh-cron] tick failed', { error: result.error })
  } else if (result.tick === 'refreshed') {
    console.info('[zora-profiles-refresh-cron] tick', {
      profilesUpserted: result.scan?.profilesUpserted ?? 0,
      walletsUpdated: result.wallets?.updated ?? 0,
      cswIndexRowsUpdated: result.cswIndexRowsUpdated,
    })
  }

  res.status(200).json(result)
}
