import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PAGE_ORIGIN = 'https://alfaclub.app'
const DEFAULT_ROOM_PATH_TEMPLATE = '/room/{roomId}'

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
    return templateRaw.replaceAll('{roomId}', encodeURIComponent(normalizedRoomId))
  }
  const path = templateRaw.startsWith('/') ? templateRaw : `/${templateRaw}`
  return `${readAlfaClubPageOrigin()}${path.replaceAll('{roomId}', encodeURIComponent(normalizedRoomId))}`
}

async function loadCreatorRoomIdFromChatActivity(addresses: string[]): Promise<Map<string, string>> {
  const normalized = [...new Set(addresses.map((value) => value.trim().toLowerCase()).filter(Boolean))]
  const out = new Map<string, string>()
  if (normalized.length === 0) return out

  const db = await getDb()
  if (!db) return out
  await ensureAlfaClubVigilanteSchema()

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
        GROUP BY 1, 2
      ) ranked
      ORDER BY addr, msg_count DESC;
    `
    const rows = (result.rows ?? []) as Array<{ addr: string | null; room_id: string | null }>
    for (const row of rows) {
      const address = typeof row.addr === 'string' ? row.addr : ''
      const roomId = typeof row.room_id === 'string' ? row.room_id.trim() : ''
      if (address && roomId) out.set(address, roomId)
    }
  } catch {
    // Best-effort fallback when policy rows are not seeded yet.
  }
  return out
}

/** Policy table first, then most-active AlfaClub chat room per creator wallet. */
export async function resolveCreatorRoomLinks(addresses: string[]): Promise<Map<string, string>> {
  const policy = await loadCreatorRoomIdByCoinAddress(addresses)
  const unresolved = addresses.filter((address) => !policy.has(address.toLowerCase()))
  if (unresolved.length === 0) return policy

  const fromChat = await loadCreatorRoomIdFromChatActivity(unresolved)
  const merged = new Map(policy)
  for (const [address, roomId] of fromChat) {
    if (!merged.has(address)) merged.set(address, roomId)
  }
  return merged
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
