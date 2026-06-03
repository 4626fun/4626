// SPDX-License-Identifier: MIT
//
// One cron tick: Zora explore scan → wallet enrichment → CSW index flag.

import { getSupabaseAdmin } from '../db/supabaseAdmin.js'
import { enrichProfileWallets, type ProfileWalletEnrichResult } from './enrichProfileWallets.js'
import {
  LAST_REFRESH_TICK_KEY,
  readProfileRefreshTickBudgetMs,
  resolveZoraServerApiKey,
  ZORA_PROFILES_REFRESH_STATE_TABLE,
} from './cronConfig.js'
import { reconcileZoraProfilesCswIndexFlag } from './reconcileCswIndexFlag.js'
import { scanTopProfilesFromExplore, type ProfileScanResult } from './scanTopProfiles.js'

export type ProfileRefreshTickResult =
  | {
      ok: true
      tick: 'refreshed' | 'skipped'
      reason?: string
      scan: {
        coinsFetched: number
        profilesUpserted: number
        skippedNoHandle: number
        pages: number
        listType: string
      } | null
      wallets: {
        selected: number
        updated: number
        withSmartWallet: number
        failed: number
      } | null
      cswIndexRowsUpdated: number
    }
  | {
      ok: false
      tick: 'errored'
      error: string
    }

type SupabaseLike = ReturnType<typeof getSupabaseAdmin>

async function writeLastTickState(
  db: SupabaseLike,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from(ZORA_PROFILES_REFRESH_STATE_TABLE).upsert(
    {
      key: LAST_REFRESH_TICK_KEY,
      value: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  if (error) throw new Error(`write_refresh_state:${error.message}`)
}

export async function runZoraProfilesRefreshTick(): Promise<ProfileRefreshTickResult> {
  const apiKey = resolveZoraServerApiKey()
  if (!apiKey) {
    return {
      ok: true,
      tick: 'skipped',
      reason: 'zora_api_key_not_configured',
      scan: null,
      wallets: null,
      cswIndexRowsUpdated: 0,
    }
  }

  const db = getSupabaseAdmin()
  const tickBudgetMs = readProfileRefreshTickBudgetMs()
  const startedAtMs = Date.now()
  const remainingMs = () => Math.max(0, tickBudgetMs - (Date.now() - startedAtMs))

  let scan: ProfileScanResult | null = null
  let wallets: ProfileWalletEnrichResult | null = null
  let cswIndexRowsUpdated = 0

  try {
    scan = await scanTopProfilesFromExplore(db as any, apiKey)
    await writeLastTickState(db, {
      phase: 'scan_complete',
      completed_at: new Date().toISOString(),
      scan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'profile_refresh_scan_failed'
    try {
      await writeLastTickState(db, {
        completed_at: new Date().toISOString(),
        phase: 'scan_failed',
        error: message.slice(0, 500),
      })
    } catch {
      // non-fatal — state table may not exist yet
    }
    return {
      ok: false,
      tick: 'errored',
      error: message.slice(0, 500),
    }
  }

  if (remainingMs() < 12_000) {
    const completedAt = new Date().toISOString()
    await writeLastTickState(db, {
      phase: 'complete_scan_only',
      completed_at: completedAt,
      reason: 'tick_budget_exhausted_after_scan',
      scan,
      wallets: null,
      csw_index_rows_updated: 0,
      remaining_ms: remainingMs(),
      tick_budget_ms: tickBudgetMs,
    })
    return {
      ok: true,
      tick: 'refreshed',
      reason: 'tick_budget_exhausted_after_scan',
      scan,
      wallets: null,
      cswIndexRowsUpdated: 0,
    }
  }

  try {
    wallets = await enrichProfileWallets(db as any, apiKey)
    if (remainingMs() >= 3_000) {
      ;({ rowsUpdated: cswIndexRowsUpdated } = await reconcileZoraProfilesCswIndexFlag())
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'profile_refresh_enrich_failed'
    try {
      await writeLastTickState(db, {
        phase: 'enrich_failed',
        completed_at: new Date().toISOString(),
        scan,
        wallets,
        error: message.slice(0, 500),
      })
    } catch {
      // non-fatal
    }
    return {
      ok: true,
      tick: 'refreshed',
      scan,
      wallets,
      cswIndexRowsUpdated,
    }
  }

  const completedAt = new Date().toISOString()
  await writeLastTickState(db, {
    phase: 'complete',
    completed_at: completedAt,
    scan,
    wallets,
    csw_index_rows_updated: cswIndexRowsUpdated,
  })

  return {
    ok: true,
    tick: 'refreshed',
    scan,
    wallets,
    cswIndexRowsUpdated,
  }
}
