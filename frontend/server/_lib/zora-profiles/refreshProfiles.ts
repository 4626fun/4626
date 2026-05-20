// SPDX-License-Identifier: MIT
//
// One cron tick: Zora explore scan → wallet enrichment → CSW index flag.

import { getSupabaseAdmin } from '../db/supabaseAdmin.js'
import { enrichProfileWallets } from './enrichProfileWallets.js'
import {
  LAST_REFRESH_TICK_KEY,
  resolveZoraServerApiKey,
  ZORA_PROFILES_REFRESH_STATE_TABLE,
} from './cronConfig.js'
import { reconcileZoraProfilesCswIndexFlag } from './reconcileCswIndexFlag.js'
import { scanTopProfilesFromExplore } from './scanTopProfiles.js'

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

  try {
    const scan = await scanTopProfilesFromExplore(db, apiKey)
    const wallets = await enrichProfileWallets(db, apiKey)
    const { rowsUpdated: cswIndexRowsUpdated } = await reconcileZoraProfilesCswIndexFlag()

    const completedAt = new Date().toISOString()
    await writeLastTickState(db, {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'profile_refresh_failed'
    try {
      await writeLastTickState(db, {
        completed_at: new Date().toISOString(),
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
}
