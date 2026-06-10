import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { readOperationalAlfaClubRoomIds } from './creatorRoomLinks.js'
import { upsertAlfaClubRoomAccessPolicy } from './roomAccessPolicy.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_POOL = '0x0000000000000000000000000000000000000001'
const DEFAULT_SYNC_LIMIT = 500

export type SyncCreatorRoomPoliciesResult = {
  ok: boolean
  candidateCount: number
  upserted: number
  skipped?: string
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return defaultValue
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export function readAutoSyncRoomPoliciesEnabled(): boolean {
  return parseBool(process.env.ALFACLUB_AUTO_SYNC_ROOM_POLICIES, true)
}

/**
 * Upsert alfaclub.room_access_policies from snapshot + creators (enabled=false).
 * Prefer room_id when it matches FriendKey token_id, else highest volume row.
 */
export async function syncCreatorRoomPoliciesFromSnapshot(params?: {
  limit?: number
  poolAddress?: `0x${string}`
  /** When true, count candidates only — no DB writes. */
  dryRun?: boolean
}): Promise<SyncCreatorRoomPoliciesResult> {
  const db = await getDb()
  if (!db) {
    return { ok: false, candidateCount: 0, upserted: 0, skipped: 'db_not_configured' }
  }

  const limit = Math.min(5000, Math.max(1, params?.limit ?? DEFAULT_SYNC_LIMIT))
  const poolAddress = (params?.poolAddress ??
    (process.env.ALFACLUB_DEFAULT_POOL_ADDRESS ?? ZERO_POOL).trim()) as `0x${string}`
  const operational = readOperationalAlfaClubRoomIds()

  await ensureAlfaClubVigilanteSchema()

  const result = await db.sql`
    SELECT DISTINCT ON (LOWER(c.creator_address))
      s.room_id::text AS room_id,
      c.token_id::text AS token_id,
      LOWER(c.creator_address) AS creator_address
    FROM public.alfaclub_rooms_snapshot s
    INNER JOIN alfaclub_creators c
      ON LOWER(c.creator_address) = LOWER(s.creator_address)
    WHERE s.creator_address IS NOT NULL
      AND LENGTH(TRIM(s.creator_address)) > 0
      AND s.room_id IS NOT NULL
    ORDER BY
      LOWER(c.creator_address),
      CASE WHEN s.room_id::text = c.token_id THEN 0 ELSE 1 END,
      COALESCE((s.raw->'room'->>'volume')::numeric, 0) DESC NULLS LAST
    LIMIT ${limit};
  `

  const rows = (result.rows ?? []) as Array<{
    room_id: string | null
    token_id: string | null
    creator_address: string | null
  }>

  const candidates = rows.filter((row) => {
    const roomId = String(row.room_id ?? '').trim()
    const tokenId = String(row.token_id ?? '').trim()
    const address = String(row.creator_address ?? '').trim().toLowerCase()
    if (!roomId || !tokenId || !/^0x[a-f0-9]{40}$/.test(address)) return false
    if (operational.has(roomId)) return false
    return true
  })

  if (params?.dryRun) {
    return { ok: true, candidateCount: candidates.length, upserted: 0 }
  }

  let upserted = 0
  for (const row of candidates) {
    const roomId = String(row.room_id).trim()
    const tokenId = String(row.token_id).trim()
    const creatorAddress = String(row.creator_address).trim().toLowerCase() as `0x${string}`
    await upsertAlfaClubRoomAccessPolicy({
      roomId,
      tokenId,
      creatorCoinAddress: creatorAddress,
      poolAddress,
      enabled: false,
      actorAddress: null,
    })
    upserted += 1
  }

  return { ok: true, candidateCount: candidates.length, upserted }
}
