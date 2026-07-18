import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { readOperationalAlfaClubRoomIds } from './creatorRoomLinks.js'
import {
  preloadAlfaClubRoomAccessPolicyPoolAddress,
  upsertAlfaClubRoomAccessPolicy,
} from './roomAccessPolicy.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_SYNC_LIMIT = 500
const ROOM_1659_CREATOR_COIN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'

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

export function readRoomCreatorCoinMap(): ReadonlyMap<string, `0x${string}`> {
  const map = new Map<string, `0x${string}`>([['1659', ROOM_1659_CREATOR_COIN]])
  const raw = String(process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON ?? '').trim()
  if (!raw) return map

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('alfaclub_room_creator_coin_map_invalid_json')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('alfaclub_room_creator_coin_map_invalid')
  }
  for (const [roomId, value] of Object.entries(parsed)) {
    const normalizedRoomId = roomId.trim()
    const normalizedAddress = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (!/^\d+$/.test(normalizedRoomId) || !/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      throw new Error(`alfaclub_room_creator_coin_map_entry_invalid:${roomId}`)
    }
    map.set(normalizedRoomId, normalizedAddress as `0x${string}`)
  }
  return map
}

/**
 * Upsert alfaclub.room_access_policies from snapshot + creators (enabled=false).
 * Prefer room_id when it matches FriendKey token_id, else highest volume row.
 * Creator Coin addresses come from the explicit room mapping. A room creator
 * wallet is an identity, not an ERC-20, and must never be written as the coin.
 * Pair addresses must pass the official Sudoswap live-pin validator; placeholder
 * addresses and retired custom factory discovery are intentionally unsupported.
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
  const operational = readOperationalAlfaClubRoomIds()
  const creatorCoins = readRoomCreatorCoinMap()

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
    if (!creatorCoins.has(roomId)) return false
    return true
  })

  const validatedCandidates: Array<{
    roomId: string
    tokenId: string
    creatorCoinAddress: `0x${string}`
    poolAddress: `0x${string}`
  }> = []
  for (const row of candidates) {
    const roomId = String(row.room_id).trim()
    const tokenId = String(row.token_id).trim()
    const creatorCoinAddress = creatorCoins.get(roomId)
    if (!creatorCoinAddress) continue
    const poolAddress = await preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId,
      tokenId,
      creatorCoinAddress,
      pairAddress: params?.poolAddress ?? null,
    })
    if (!poolAddress) continue
    validatedCandidates.push({ roomId, tokenId, creatorCoinAddress, poolAddress })
  }

  if (params?.dryRun) {
    return { ok: true, candidateCount: validatedCandidates.length, upserted: 0 }
  }

  let upserted = 0
  for (const candidate of validatedCandidates) {
    await upsertAlfaClubRoomAccessPolicy({
      roomId: candidate.roomId,
      tokenId: candidate.tokenId,
      creatorCoinAddress: candidate.creatorCoinAddress,
      poolAddress: candidate.poolAddress,
      enabled: false,
      actorAddress: null,
    })
    upserted += 1
  }

  return { ok: true, candidateCount: validatedCandidates.length, upserted }
}
