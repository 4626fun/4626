// SPDX-License-Identifier: MIT
//
// Marks zora_profiles rows whose payout/primary wallet appears in zora_csw_owners.

import { getDb } from '../db/postgres.js'

export type ReconcileCswIndexResult = {
  rowsUpdated: number
}

/**
 * Best-effort reconciliation. Requires postgres `getDb()` (not Supabase REST).
 */
export async function reconcileZoraProfilesCswIndexFlag(): Promise<ReconcileCswIndexResult> {
  const db = await getDb()
  if (!db) {
    return { rowsUpdated: 0 }
  }

  const result = await db.sql`
    WITH matched AS (
      SELECT p.handle
      FROM zora_profiles p
      WHERE EXISTS (
        SELECT 1
        FROM zora_csw_owners w
        WHERE lower(w.csw_address) = lower(coalesce(p.primary_wallet, ''))
           OR lower(w.csw_address) = lower(coalesce(p.payout_recipient, ''))
           OR lower(w.base_owner) = lower(coalesce(p.primary_wallet, ''))
           OR lower(w.base_owner) = lower(coalesce(p.payout_recipient, ''))
      )
    )
    UPDATE zora_profiles p
    SET is_in_csw_index = true
    FROM matched m
    WHERE p.handle = m.handle
      AND coalesce(p.is_in_csw_index, false) IS DISTINCT FROM true;
  `

  const rowsUpdated = Number(result?.rowCount ?? 0)
  return { rowsUpdated: Number.isFinite(rowsUpdated) ? rowsUpdated : 0 }
}
