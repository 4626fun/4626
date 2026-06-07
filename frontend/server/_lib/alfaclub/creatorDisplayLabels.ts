import { getDb } from '../db/postgres.js'
import { getBasenameName } from '../identity/basenameResolver.js'
import { getEnsName } from '../identity/ensResolver.js'

export type CreatorLabelHint = {
  address: string
  tokenId?: string
}

export type CreatorLabelMap = Map<string, string>

function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, '')
  return trimmed ? `@${trimmed}` : ''
}

function normalizeRoomName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function pickCreatorDisplayLabel(params: {
  chatUsername?: string | null
  twitterUsername?: string | null
  roomName?: string | null
  basename?: string | null
  ens?: string | null
}): string | null {
  const chat = typeof params.chatUsername === 'string' ? normalizeUsername(params.chatUsername) : ''
  if (chat) return chat

  const twitter =
    typeof params.twitterUsername === 'string' ? normalizeUsername(params.twitterUsername) : ''
  if (twitter) return twitter

  const roomName = typeof params.roomName === 'string' ? normalizeRoomName(params.roomName) : ''
  if (roomName) return roomName

  const basename = typeof params.basename === 'string' ? params.basename.trim() : ''
  if (basename) return basename

  const ens = typeof params.ens === 'string' ? params.ens.trim() : ''
  if (ens) return ens

  return null
}

async function readChatUsernames(addresses: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const normalized = [...new Set(addresses.map((value) => value.toLowerCase()))]
  if (normalized.length === 0) return labels

  const db = await getDb()
  if (!db) return labels

  try {
    const result = await db.sql`
      SELECT DISTINCT ON (LOWER(sender_address))
        LOWER(sender_address) AS sender_address,
        username
      FROM alfaclub.chat_ingest
      WHERE LOWER(sender_address) = ANY(${normalized})
        AND username IS NOT NULL
        AND LENGTH(TRIM(username)) > 0
      ORDER BY LOWER(sender_address), COALESCE(message_date, ingested_at) DESC, ingested_at DESC;
    `
    const rows = (result.rows ?? []) as Array<{ sender_address: string; username: string | null }>
    for (const row of rows) {
      const username = typeof row.username === 'string' ? normalizeUsername(row.username) : ''
      if (username) labels.set(String(row.sender_address).toLowerCase(), username)
    }
  } catch {
    // Best-effort enrichment.
  }

  return labels
}

async function readRoomSnapshotLabels(
  hints: CreatorLabelHint[],
): Promise<Map<string, { twitterUsername: string | null; roomName: string | null; roomSn: string | null }>> {
  const out = new Map<string, { twitterUsername: string | null; roomName: string | null; roomSn: string | null }>()
  const addresses = [
    ...new Set(hints.map((hint) => hint.address.trim().toLowerCase()).filter(Boolean)),
  ]
  const tokenIds = [
    ...new Set(hints.map((hint) => String(hint.tokenId ?? '').trim()).filter(Boolean)),
  ]
  if (addresses.length === 0 && tokenIds.length === 0) return out

  const db = await getDb()
  if (!db) return out

  try {
    const result = await db.sql`
      SELECT
        LOWER(s.creator_address) AS creator_address,
        s.room_id::text AS room_id,
        s.sn,
        s.creator_twitter_username,
        COALESCE(s.room_name, e.room_name) AS room_name
      FROM public.alfaclub_rooms_snapshot s
      LEFT JOIN LATERAL (
        SELECT room_name
        FROM public.alfaclub_explore_latest e2
        WHERE e2.room_id = s.room_id::bigint
          AND e2.room_name IS NOT NULL
          AND LENGTH(TRIM(e2.room_name)) > 0
        LIMIT 1
      ) e ON TRUE
      WHERE (
        LOWER(s.creator_address) = ANY(${addresses})
        OR s.room_id::text = ANY(${tokenIds})
      )
        AND s.creator_address IS NOT NULL;
    `
    const rows = (result.rows ?? []) as Array<{
      creator_address: string | null
      room_id: string | null
      sn: string | null
      creator_twitter_username: string | null
      room_name: string | null
    }>

    const byAddress = new Map<string, { twitterUsername: string | null; roomName: string | null; roomSn: string | null }>()
    const byTokenId = new Map<string, { twitterUsername: string | null; roomName: string | null; roomSn: string | null }>()

    for (const row of rows) {
      const address = typeof row.creator_address === 'string' ? row.creator_address.toLowerCase() : ''
      const roomId = typeof row.room_id === 'string' ? row.room_id.trim() : ''
      const roomSn = typeof row.sn === 'string' ? row.sn.trim() : ''
      const entry = {
        twitterUsername: row.creator_twitter_username,
        roomName: row.room_name,
        roomSn: roomSn.length > 0 && !/^\d+$/.test(roomSn) ? roomSn : null,
      }
      if (address) byAddress.set(address, entry)
      if (roomId) byTokenId.set(roomId, entry)
    }

    for (const hint of hints) {
      const address = hint.address.trim().toLowerCase()
      const tokenId = String(hint.tokenId ?? '').trim()
      const fromAddress = byAddress.get(address)
      const fromToken = tokenId ? byTokenId.get(tokenId) : undefined
      const merged = {
        twitterUsername: fromAddress?.twitterUsername ?? fromToken?.twitterUsername ?? null,
        roomName: fromAddress?.roomName ?? fromToken?.roomName ?? null,
        roomSn: fromAddress?.roomSn ?? fromToken?.roomSn ?? null,
      }
      if (merged.twitterUsername || merged.roomName || merged.roomSn) out.set(address, merged)
    }
  } catch {
    // Best-effort enrichment.
  }

  return out
}

/** Resolve human-readable creator labels for leaderboard / brief surfaces. */
export async function readCreatorLabels(hints: CreatorLabelHint[]): Promise<CreatorLabelMap> {
  const labels: CreatorLabelMap = new Map()
  const normalizedHints = hints
    .map((hint) => ({
      address: hint.address.trim().toLowerCase(),
      tokenId: String(hint.tokenId ?? '').trim() || undefined,
    }))
    .filter((hint) => hint.address.length > 0)

  if (normalizedHints.length === 0) return labels

  const addresses = normalizedHints.map((hint) => hint.address)
  const [chatLabels, roomSnapshotLabels] = await Promise.all([
    readChatUsernames(addresses),
    readRoomSnapshotLabels(normalizedHints),
  ])

  for (const hint of normalizedHints) {
    const chatUsername = chatLabels.get(hint.address) ?? null
    const snapshot = roomSnapshotLabels.get(hint.address)
    const label = pickCreatorDisplayLabel({
      chatUsername,
      twitterUsername: snapshot?.twitterUsername ?? null,
      roomName: snapshot?.roomName ?? snapshot?.roomSn ?? null,
    })
    if (label) labels.set(hint.address, label)
  }

  const unresolved = normalizedHints.filter((hint) => !labels.has(hint.address))
  if (unresolved.length > 0) {
    await Promise.all(
      unresolved.map(async (hint) => {
        const basename = await getBasenameName(hint.address).catch(() => null)
        const ens = basename ? null : await getEnsName(hint.address).catch(() => null)
        const label = pickCreatorDisplayLabel({ basename, ens })
        if (label) labels.set(hint.address, label)
      }),
    )
  }

  return labels
}
