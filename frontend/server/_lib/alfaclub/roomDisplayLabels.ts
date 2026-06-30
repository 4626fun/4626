import { formatAlfaClubRoomLabel } from '../../../src/lib/alfaclub/roomLabel.js'

export type SnapshotRoomLabelInput = {
  roomId: string
  roomName?: string | null
  creatorHandle?: string | null
  cachedDisplayLabel?: string | null
}

function normalizeHandle(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().replace(/^@+/, '')
  return value.length > 0 ? value : null
}

function normalizeRoomTitle(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ')
  return value.length > 0 ? value : null
}

function isGenericRoomTitle(title: string, roomId: string): boolean {
  return title === roomId || /^room\s*#?\s*\d+$/i.test(title)
}

/** Shared SQL snippets for snapshot room title + creator handle resolution. */
export const SNAPSHOT_ROOM_TITLE_SQL = `
  coalesce(
    nullif(trim(s.room_name), ''),
    nullif(trim(s.raw->'metadata'->>'name'), ''),
    nullif(trim(s.raw->'room'->>'name'), ''),
    nullif(trim(s.raw->'room'->>'title'), ''),
    nullif(trim(e.room_name), ''),
    nullif(trim(lc.display_label), ''),
    case
      when nullif(trim(s.sn), '') is not null and nullif(trim(s.sn), '') !~ '^[0-9]+$'
        then nullif(trim(s.sn), '')
      else null
    end
  )
`

export const SNAPSHOT_CREATOR_HANDLE_SQL = `
  coalesce(
    nullif(trim(s.creator_twitter_username), ''),
    nullif(trim(s.raw->'creator'->>'twitter_username'), ''),
    nullif(trim(s.raw->'creator'->>'username'), ''),
    nullif(trim(s.raw->'room'->>'creatorUsername'), ''),
    nullif(trim(s.raw->'room'->>'username'), ''),
    nullif(trim(e.creator_twitter_username), ''),
    nullif(trim(chat.username), '')
  )
`

export const SNAPSHOT_LABEL_JOINS_SQL = `
  left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
  left join lateral (
    select e2.creator_twitter_username, e2.room_name
    from public.alfaclub_explore_latest e2
    where e2.room_id = s.room_id
    order by e2.ingested_at desc nulls last
    limit 1
  ) e on true
  left join lateral (
    select ci.username
    from alfaclub.chat_ingest ci
    where ci.room_id = s.room_id::text
      and lower(ci.sender_address) = lower(s.creator_address)
      and ci.username is not null
      and length(trim(ci.username)) > 0
    order by ci.message_date desc nulls last, ci.ingested_at desc
    limit 1
  ) chat on true
`

export function materializeRoomDisplayFields(input: SnapshotRoomLabelInput): {
  roomName: string
  creatorHandle: string | null
  displayLabel: string
} {
  const roomId = input.roomId.trim()
  const cached = normalizeRoomTitle(input.cachedDisplayLabel)
  const cachedHandle = cached?.startsWith('@') ? normalizeHandle(cached) : null
  const cachedTitle =
    cached && !cached.startsWith('@') && !isGenericRoomTitle(cached, roomId) ? cached : null

  const resolvedTitle =
    normalizeRoomTitle(input.roomName) ??
    cachedTitle ??
    (cachedHandle ? null : cached)

  const title =
    resolvedTitle && !isGenericRoomTitle(resolvedTitle, roomId) ? resolvedTitle : null
  const creatorHandle = normalizeHandle(input.creatorHandle) ?? cachedHandle

  const displayLabel = formatAlfaClubRoomLabel({
    roomId,
    roomName: title,
    creatorHandle,
  })

  return {
    roomName: title ?? creatorHandle ?? `Room #${roomId}`,
    creatorHandle,
    displayLabel,
  }
}
