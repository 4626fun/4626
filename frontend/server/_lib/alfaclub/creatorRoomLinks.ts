import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PAGE_ORIGIN = 'https://alfaclub.app'
const DEFAULT_ROOM_PATH_TEMPLATE = '/room/{roomId}'
const DEFAULT_OPERATIONAL_ROOM_ID = '1043'

export type CreatorRoomLinkHint = {
  address: string
  /** FriendKey / metrics token id — prefer matching `alfaclub_rooms_snapshot.room_id`. */
  tokenId?: string
}

type SnapshotRoomRow = {
  roomId: string
  volume: number | null
}

export function readAlfaClubPageOrigin(): string {
  const configured =
    (process.env.ALFACLUB_PAGE_ORIGIN ?? '').trim() ||
    (process.env.ALFACLUB_PRIVY_ORIGIN ?? '').trim()
  return (configured || DEFAULT_PAGE_ORIGIN).replace(/\/+$/, '')
}

export function buildAlfaClubRoomUrl(roomId: string): string {
  const normalizedRoomId = String(roomId ?? '').trim()
  if (!normalizedRoomId) return readAlfaClubPageOrigin()

  const templateRaw = (process.env.ALFACLUB_ROOM_URL_TEMPLATE ?? '').trim() || DEFAULT_ROOM_PATH_TEMPLATE
  if (templateRaw.startsWith('http://') || templateRaw.startsWith('https://')) {
    return templateRaw.replace(/\{roomId\}/g, encodeURIComponent(normalizedRoomId))
  }
  const path = templateRaw.startsWith('/') ? templateRaw : `/${templateRaw}`
  return `${readAlfaClubPageOrigin()}${path.replace(/\{roomId\}/g, encodeURIComponent(normalizedRoomId))}`
}

export function readOperationalAlfaClubRoomIds(): Set<string> {
  const ids = new Set<string>()
  const push = (raw: string | undefined) => {
    const value = String(raw ?? '').trim().replace(/^"+|"+$/g, '')
    if (/^\d+$/.test(value)) ids.add(value)
  }
  push(process.env.ALFACLUB_CHAT_ROOM_ID)
  push(process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID)
  push(process.env.TELEGRAM_TO_ALFACLUB_ROOM_ID)
  for (const part of String(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '').split(',')) {
    push(part)
  }
  ids.add(DEFAULT_OPERATIONAL_ROOM_ID)
  return ids
}

function normalizeHints(input: string[] | CreatorRoomLinkHint[]): CreatorRoomLinkHint[] {
  if (input.length === 0) return []
  if (typeof input[0] === 'string') {
    return (input as string[]).map((address) => ({ address }))
  }
  return input as CreatorRoomLinkHint[]
}

/** Prefer token-id room match, then highest reported volume. */
export function pickCreatorRoomIdFromSnapshotRows(
  rows: SnapshotRoomRow[],
  tokenId?: string,
): string | null {
  if (rows.length === 0) return null
  const normalizedTokenId = String(tokenId ?? '').trim()
  const sorted = [...rows].sort((a, b) => {
    const aTokenMatch = normalizedTokenId.length > 0 && a.roomId === normalizedTokenId ? 1 : 0
    const bTokenMatch = normalizedTokenId.length > 0 && b.roomId === normalizedTokenId ? 1 : 0
    if (bTokenMatch !== aTokenMatch) return bTokenMatch - aTokenMatch
    const aVol = a.volume ?? Number.NEGATIVE_INFINITY
    const bVol = b.volume ?? Number.NEGATIVE_INFINITY
    return bVol - aVol
  })
  return sorted[0]?.roomId ?? null
}

async function loadCreatorRoomIdFromRoomsSnapshot(
  hints: CreatorRoomLinkHint[],
): Promise<Map<string, string>> {
  const normalized = [
    ...new Set(hints.map((hint) => hint.address.trim().toLowerCase()).filter(Boolean)),
  ]
  const tokenIdByAddress = new Map<string, string>()
  for (const hint of hints) {
    const address = hint.address.trim().toLowerCase()
    const tokenId = String(hint.tokenId ?? '').trim()
    if (address && tokenId) tokenIdByAddress.set(address, tokenId)
  }
  const out = new Map<string, string>()
  if (normalized.length === 0) return out

  const db = await getDb()
  if (!db) return out

  try {
    const result = await db.sql`
      SELECT
        LOWER(creator_address) AS creator_address,
        room_id::text AS room_id,
        volume::text AS volume
      FROM public.alfaclub_rooms_snapshot
      WHERE LOWER(creator_address) = ANY(${normalized})
        AND creator_address IS NOT NULL
        AND room_id IS NOT NULL;
    `
    const rowsByAddress = new Map<string, SnapshotRoomRow[]>()
    const dbRows = (result.rows ?? []) as Array<{
      creator_address: string | null
      room_id: string | null
      volume: string | null
    }>
    for (const row of dbRows) {
      const address =
        typeof row.creator_address === 'string' ? row.creator_address.toLowerCase() : ''
      const roomId = typeof row.room_id === 'string' ? row.room_id.trim() : ''
      if (!address || !roomId) continue
      const volumeRaw = row.volume !== null ? Number(row.volume) : null
      const volume = volumeRaw !== null && Number.isFinite(volumeRaw) ? volumeRaw : null
      const bucket = rowsByAddress.get(address) ?? []
      bucket.push({ roomId, volume })
      rowsByAddress.set(address, bucket)
    }
    for (const address of normalized) {
      const picked = pickCreatorRoomIdFromSnapshotRows(
        rowsByAddress.get(address) ?? [],
        tokenIdByAddress.get(address),
      )
      if (picked) out.set(address, picked)
    }
  } catch {
    // Best-effort — omit links when snapshot is unavailable.
  }
  return out
}

async function loadCreatorRoomIdFromChatActivity(
  hints: CreatorRoomLinkHint[],
): Promise<Map<string, string>> {
  const operationalRoomIds = readOperationalAlfaClubRoomIds()
  const normalized = [
    ...new Set(
      hints
        .map((hint) => hint.address.trim().toLowerCase())
        .filter((address) => address.length > 0),
    ),
  ]
  const out = new Map<string, string>()
  if (normalized.length === 0) return out

  const db = await getDb()
  if (!db) return out
  await ensureAlfaClubVigilanteSchema()

  const excludedRoomIds = [...operationalRoomIds]
  try {
    const result = await db.sql`
      SELECT DISTINCT ON (addr)
        addr,
        room_id
      FROM (
        SELECT
          LOWER(sender_address) AS addr,
          room_id,
          COUNT(*)::bigint AS msg_count
        FROM alfaclub.chat_ingest
        WHERE LOWER(sender_address) = ANY(${normalized})
          AND room_id IS NOT NULL
          AND LENGTH(TRIM(room_id)) > 0
          AND NOT (room_id = ANY(${excludedRoomIds}))
        GROUP BY 1, 2
      ) ranked
      ORDER BY addr, msg_count DESC;
    `
    const rows = (result.rows ?? []) as Array<{ addr: string | null; room_id: string | null }>
    for (const row of rows) {
      const address = typeof row.addr === 'string' ? row.addr : ''
      const roomId = typeof row.room_id === 'string' ? row.room_id.trim() : ''
      if (address && roomId && !operationalRoomIds.has(roomId)) out.set(address, roomId)
    }
  } catch {
    // Chat fallback is last resort only.
  }
  return out
}

/**
 * Resolve creator → AlfaClub room URL targets.
 * Order: room_access_policies → alfaclub_rooms_snapshot (canonical) → non-ops chat activity.
 */
export async function resolveCreatorRoomLinks(
  input: string[] | CreatorRoomLinkHint[],
): Promise<Map<string, string>> {
  const hints = normalizeHints(input)
  const addresses = hints.map((hint) => hint.address)

  const merged = await loadCreatorRoomIdByCoinAddress(addresses)

  const unresolvedHints = hints.filter((hint) => !merged.has(hint.address.toLowerCase()))
  if (unresolvedHints.length > 0) {
    const fromSnapshot = await loadCreatorRoomIdFromRoomsSnapshot(unresolvedHints)
    for (const [address, roomId] of fromSnapshot) {
      if (!merged.has(address)) merged.set(address, roomId)
    }
  }

  const stillUnresolved = hints.filter((hint) => !merged.has(hint.address.toLowerCase()))
  if (stillUnresolved.length > 0) {
    const fromChat = await loadCreatorRoomIdFromChatActivity(stillUnresolved)
    for (const [address, roomId] of fromChat) {
      if (!merged.has(address)) merged.set(address, roomId)
    }
  }

  for (const hint of hints) {
    const address = hint.address.trim().toLowerCase()
    if (!address || merged.has(address)) continue
    const roomId = resolveRoomIdFromFriendKeyTokenId(hint.tokenId)
    if (roomId) merged.set(address, roomId)
  }

  return merged
}

/**
 * FriendKey token ids usually match AlfaClub trading room ids.
 * Use only when policy/snapshot/chat did not resolve — never map ops rooms.
 */
export function resolveRoomIdFromFriendKeyTokenId(tokenId: string | undefined): string | null {
  const normalized = String(tokenId ?? '').trim()
  if (!/^\d+$/.test(normalized)) return null
  if (readOperationalAlfaClubRoomIds().has(normalized)) return null
  return normalized
}

export async function loadCreatorRoomIdByCoinAddress(
  addresses: string[],
): Promise<Map<string, string>> {
  const normalized = [...new Set(addresses.map((value) => value.trim().toLowerCase()).filter(Boolean))]
  const out = new Map<string, string>()
  if (normalized.length === 0) return out

  const db = await getDb()
  if (!db) return out
  await ensureAlfaClubVigilanteSchema()

  try {
    const result = await db.sql`
      SELECT LOWER(creator_coin_address) AS creator_coin_address, room_id
      FROM alfaclub.room_access_policies
      WHERE LOWER(creator_coin_address) = ANY(${normalized})
        AND room_id IS NOT NULL
        AND LENGTH(TRIM(room_id)) > 0;
    `
    const rows = (result.rows ?? []) as Array<{
      creator_coin_address: string | null
      room_id: string | null
    }>
    for (const row of rows) {
      const address = typeof row.creator_coin_address === 'string' ? row.creator_coin_address : ''
      const roomId = typeof row.room_id === 'string' ? row.room_id.trim() : ''
      if (address && roomId) out.set(address, roomId)
    }
  } catch {
    // Best-effort — brief/radar omit links when mapping is unavailable.
  }
  return out
}

export function formatCreatorRoomLink(
  creatorAddress: string,
  roomIds: Map<string, string>,
): string | null {
  const roomId = roomIds.get(creatorAddress.toLowerCase())
  if (!roomId) return null
  return buildAlfaClubRoomUrl(roomId)
}

/** One-line context when the daily brief posts into an ops/bridge room (e.g. 1043). */
export function formatAlfaClubBriefOpsRoomFooter(postingRoomId: string): string | null {
  const roomId = String(postingRoomId ?? '').trim()
  if (!roomId || !readOperationalAlfaClubRoomIds().has(roomId)) return null
  return '_Digest posted in the bot/ops room. Creator links open their trading rooms on alfaclub.app — not this room._'
}
