import { getDb } from '../db/postgres.js'
import { ensureAlfaclubSchema } from '../db/schemaBootstrap.js'
import {
  ALFACLUB_API_COMMON_BROWSER_HEADERS,
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'

declare const process: { env: Record<string, string | undefined> }

type CreatorLabelHint = {
  address: string
  tokenId?: string
}

type RoomLabelCandidate = {
  roomId: string
  creatorAddress: string
  snapshotTwitterUsername: string | null
  snapshotRoomName: string | null
}

type CachedRoomLabelRow = {
  room_id: string
  creator_address: string
  display_label: string
  source: string
  confidence: number
  expires_at: string | null
}

export type RoomLabelSyncResult = {
  ok: boolean
  scanned: number
  updated: number
  skipped: number
  reasons: string[]
}

export type RoomLabelStatusRow = {
  roomId: string
  creatorAddress: string | null
  displayLabel: string | null
  source: string | null
  confidence: number | null
  expiresAt: string | null
  isFresh: boolean
}

function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, '')
  return trimmed ? `@${trimmed}` : ''
}

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function parseBool(raw: string | undefined, fallback = false): boolean {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return fallback
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function readLabelSyncEnabled(): boolean {
  return parseBool(process.env.ALFACLUB_ROOM_LABEL_SYNC_ENABLED, true)
}

function readLabelSyncLimit(): number {
  const raw = (process.env.ALFACLUB_ROOM_LABEL_SYNC_LIMIT ?? '').trim()
  if (!/^\d+$/.test(raw)) return 200
  const parsed = Number.parseInt(raw, 10)
  return Math.max(1, Math.min(1000, parsed))
}

function readLabelTtlHours(): number {
  const raw = (process.env.ALFACLUB_ROOM_LABEL_TTL_HOURS ?? '').trim()
  if (!/^\d+$/.test(raw)) return 24 * 14
  const parsed = Number.parseInt(raw, 10)
  return Math.max(6, Math.min(24 * 90, parsed))
}

async function fetchRoomLabelFromApi(params: {
  roomId: string
  creatorAddress: string
}): Promise<{ label: string | null; source: string | null }> {
  const flags = readAlfaClubApiAuthFlags()
  const token = flags.readBotToken || flags.botToken
  if (!token) return { label: null, source: null }

  const apiBaseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const proxySecret = resolveAlfaClubProxySecret(flags)
  const url = new URL(`/api/room/${encodeURIComponent(params.roomId)}/messages`, apiBaseUrl)
  url.searchParams.set('limit', '20')

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
        Origin: 'https://alfaclub.app',
        Referer: 'https://alfaclub.app/',
        'Sec-Fetch-Site': 'same-site',
        Authorization: `Bearer ${token}`,
        ...(proxySecret ? { 'x-proxy-secret': proxySecret } : {}),
      },
    })
    if (!response.ok) return { label: null, source: `api_http_${response.status}` }
    const body = (await response.json()) as { messages?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
    const messages = Array.isArray(body) ? body : Array.isArray(body?.messages) ? body.messages : []
    if (!Array.isArray(messages) || messages.length === 0) return { label: null, source: 'api_empty' }

    const creatorAddress = params.creatorAddress.toLowerCase()
    const exactMatch = messages.find((message) => {
      const sender = typeof message?.sender === 'string' ? message.sender.trim().toLowerCase() : ''
      const username = typeof message?.username === 'string' ? message.username.trim() : ''
      return sender === creatorAddress && username.length > 0
    })
    if (exactMatch && typeof exactMatch.username === 'string') {
      const label = normalizeUsername(exactMatch.username)
      if (label) return { label, source: 'api_creator_username' }
    }

    const firstAny = messages.find(
      (message) => typeof message?.username === 'string' && message.username.trim().length > 0,
    )
    if (firstAny && typeof firstAny.username === 'string') {
      const label = normalizeUsername(firstAny.username)
      if (label) return { label, source: 'api_room_username' }
    }
    return { label: null, source: 'api_no_username' }
  } catch {
    return { label: null, source: 'api_error' }
  }
}

async function listRoomLabelCandidates(params: {
  limit: number
  roomIds?: string[]
}): Promise<RoomLabelCandidate[]> {
  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubSchema(db as any)
  const roomIds = (params.roomIds ?? []).filter((roomId) => /^\d+$/.test(roomId))
  const useRoomFilter = roomIds.length > 0

  try {
    const result = useRoomFilter
      ? await db.sql`
          SELECT DISTINCT ON (c.token_id)
            c.token_id AS room_id,
            LOWER(c.creator_address) AS creator_address,
            COALESCE(
              NULLIF(TRIM(s.creator_twitter_username), ''),
              NULLIF(TRIM(s.raw->'creator'->>'twitter_username'), ''),
              NULLIF(TRIM(e.creator_twitter_username), '')
            ) AS snapshot_twitter_username,
            COALESCE(
              NULLIF(TRIM(s.room_name), ''),
              NULLIF(TRIM(s.raw->'metadata'->>'name'), ''),
              NULLIF(TRIM(e.room_name), '')
            ) AS snapshot_room_name
          FROM public.alfaclub_creators c
          LEFT JOIN public.alfaclub_rooms_snapshot s
            ON LOWER(s.creator_address) = LOWER(c.creator_address)
           AND s.room_id::text = c.token_id
          LEFT JOIN LATERAL (
            SELECT
              e2.creator_twitter_username,
              e2.room_name
            FROM public.alfaclub_explore_latest e2
            WHERE e2.room_id::text = c.token_id
            ORDER BY e2.ingested_at DESC NULLS LAST
            LIMIT 1
          ) e ON TRUE
          WHERE c.token_id IS NOT NULL
            AND c.token_id = ANY(${roomIds})
          ORDER BY c.token_id;
        `
      : await db.sql`
          SELECT DISTINCT ON (c.token_id)
            c.token_id AS room_id,
            LOWER(c.creator_address) AS creator_address,
            COALESCE(
              NULLIF(TRIM(s.creator_twitter_username), ''),
              NULLIF(TRIM(s.raw->'creator'->>'twitter_username'), ''),
              NULLIF(TRIM(e.creator_twitter_username), '')
            ) AS snapshot_twitter_username,
            COALESCE(
              NULLIF(TRIM(s.room_name), ''),
              NULLIF(TRIM(s.raw->'metadata'->>'name'), ''),
              NULLIF(TRIM(e.room_name), '')
            ) AS snapshot_room_name
          FROM public.alfaclub_creators c
          LEFT JOIN public.alfaclub_rooms_snapshot s
            ON LOWER(s.creator_address) = LOWER(c.creator_address)
           AND s.room_id::text = c.token_id
          LEFT JOIN LATERAL (
            SELECT
              e2.creator_twitter_username,
              e2.room_name
            FROM public.alfaclub_explore_latest e2
            WHERE e2.room_id::text = c.token_id
            ORDER BY e2.ingested_at DESC NULLS LAST
            LIMIT 1
          ) e ON TRUE
          WHERE c.token_id IS NOT NULL
          ORDER BY c.token_id
          LIMIT ${params.limit};
        `
    const rows = (result.rows ?? []) as Array<{
      room_id: string | null
      creator_address: string | null
      snapshot_twitter_username: string | null
      snapshot_room_name: string | null
    }>
    return rows
      .map((row) => ({
        roomId: String(row.room_id ?? '').trim(),
        creatorAddress: String(row.creator_address ?? '').trim().toLowerCase(),
        snapshotTwitterUsername:
          typeof row.snapshot_twitter_username === 'string'
            ? row.snapshot_twitter_username.trim()
            : null,
        snapshotRoomName:
          typeof row.snapshot_room_name === 'string' ? normalizeLabel(row.snapshot_room_name) : null,
      }))
      .filter((row) => /^\d+$/.test(row.roomId) && /^0x[a-f0-9]{40}$/.test(row.creatorAddress))
  } catch {
    return []
  }
}

export async function syncRoomLabelCache(params?: {
  limit?: number
  forceApi?: boolean
  roomIds?: string[]
}): Promise<RoomLabelSyncResult> {
  if (!readLabelSyncEnabled()) {
    return { ok: false, scanned: 0, updated: 0, skipped: 0, reasons: ['disabled'] }
  }

  const db = await getDb()
  if (!db) {
    return { ok: false, scanned: 0, updated: 0, skipped: 0, reasons: ['db_unavailable'] }
  }
  await ensureAlfaclubSchema(db as any)

  const limit = Math.max(1, Math.min(1000, params?.limit ?? readLabelSyncLimit()))
  const ttlHours = readLabelTtlHours()
  const candidates = await listRoomLabelCandidates({
    limit,
    roomIds: params?.roomIds,
  })
  if (candidates.length === 0) {
    return { ok: true, scanned: 0, updated: 0, skipped: 0, reasons: ['no_candidates'] }
  }

  let updated = 0
  let skipped = 0
  const reasons: string[] = []
  const forceApi = params?.forceApi ?? false

  for (const candidate of candidates) {
    let label: string | null = null
    let source = 'unknown'
    let confidence = 10

    if (candidate.snapshotRoomName) {
      label = normalizeLabel(candidate.snapshotRoomName)
      source = 'snapshot_room_name'
      confidence = 94
    }

    if (!label && candidate.snapshotTwitterUsername) {
      const normalized = normalizeUsername(candidate.snapshotTwitterUsername)
      if (normalized) {
        label = normalized
        source = 'snapshot_twitter'
        confidence = 90
      }
    }

    if (!label || forceApi) {
      const api = await fetchRoomLabelFromApi({
        roomId: candidate.roomId,
        creatorAddress: candidate.creatorAddress,
      })
      if (api.label) {
        label = api.label
        source = api.source ?? 'api'
        confidence = 95
      } else if (api.source) {
        reasons.push(`${candidate.roomId}:${api.source}`)
      }
    }

    if (!label) {
      skipped += 1
      continue
    }

    try {
      await db.sql`
        INSERT INTO alfaclub.room_label_cache (
          room_id,
          creator_address,
          display_label,
          source,
          confidence,
          raw,
          last_seen_at,
          expires_at,
          updated_at
        ) VALUES (
          ${candidate.roomId},
          ${candidate.creatorAddress},
          ${label},
          ${source},
          ${confidence},
          ${JSON.stringify({
            snapshotTwitterUsername: candidate.snapshotTwitterUsername,
            snapshotRoomName: candidate.snapshotRoomName,
          })}::jsonb,
          NOW(),
          NOW() + (${ttlHours}::text || ' hours')::interval,
          NOW()
        )
        ON CONFLICT (room_id) DO UPDATE
        SET
          creator_address = EXCLUDED.creator_address,
          display_label = EXCLUDED.display_label,
          source = EXCLUDED.source,
          confidence = EXCLUDED.confidence,
          raw = EXCLUDED.raw,
          last_seen_at = NOW(),
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW();
      `
      updated += 1
    } catch {
      skipped += 1
    }
  }

  return {
    ok: true,
    scanned: candidates.length,
    updated,
    skipped,
    reasons: reasons.slice(0, 30),
  }
}

export async function readCachedCreatorLabels(hints: CreatorLabelHint[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const normalizedHints = hints
    .map((hint) => ({
      address: hint.address.trim().toLowerCase(),
      tokenId: String(hint.tokenId ?? '').trim() || null,
    }))
    .filter((hint) => /^0x[a-f0-9]{40}$/.test(hint.address))
  if (normalizedHints.length === 0) return out

  const db = await getDb()
  if (!db) return out
  await ensureAlfaclubSchema(db as any)

  const addresses = [...new Set(normalizedHints.map((hint) => hint.address))]
  const roomIds = [...new Set(normalizedHints.map((hint) => hint.tokenId).filter((v): v is string => Boolean(v)))]

  try {
    const result = await db.sql`
      SELECT
        room_id,
        LOWER(creator_address) AS creator_address,
        display_label,
        source,
        confidence,
        expires_at::text AS expires_at
      FROM alfaclub.room_label_cache
      WHERE (
        LOWER(creator_address) = ANY(${addresses})
        OR room_id = ANY(${roomIds})
      )
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY confidence DESC, updated_at DESC;
    `
    const rows = (result.rows ?? []) as CachedRoomLabelRow[]
    const byAddress = new Map<string, CachedRoomLabelRow>()
    const byRoomId = new Map<string, CachedRoomLabelRow>()
    for (const row of rows) {
      if (row.creator_address && !byAddress.has(row.creator_address)) {
        byAddress.set(row.creator_address, row)
      }
      if (row.room_id && !byRoomId.has(row.room_id)) {
        byRoomId.set(row.room_id, row)
      }
    }

    for (const hint of normalizedHints) {
      const fromAddress = byAddress.get(hint.address)
      if (fromAddress?.display_label) {
        out.set(hint.address, fromAddress.display_label)
        continue
      }
      if (hint.tokenId) {
        const fromRoom = byRoomId.get(hint.tokenId)
        if (fromRoom?.display_label) {
          out.set(hint.address, fromRoom.display_label)
        }
      }
    }
  } catch {
    return out
  }

  return out
}

export async function readRoomLabelStatus(roomIds: string[]): Promise<RoomLabelStatusRow[]> {
  const normalized = [...new Set(roomIds.map((roomId) => roomId.trim()).filter((roomId) => /^\d+$/.test(roomId)))]
  if (normalized.length === 0) return []

  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubSchema(db as any)

  try {
    const result = await db.sql`
      WITH target_rooms AS (
        SELECT UNNEST(${normalized}::text[]) AS room_id
      ),
      creator_map AS (
        SELECT
          c.token_id AS room_id,
          LOWER(c.creator_address) AS creator_address
        FROM public.alfaclub_creators c
        WHERE c.token_id = ANY(${normalized})
      ),
      cache_rows AS (
        SELECT
          r.room_id,
          LOWER(r.creator_address) AS creator_address,
          r.display_label,
          r.source,
          r.confidence,
          r.expires_at::text AS expires_at,
          (r.expires_at IS NULL OR r.expires_at > NOW()) AS is_fresh
        FROM alfaclub.room_label_cache r
        WHERE r.room_id = ANY(${normalized})
      )
      SELECT
        t.room_id,
        COALESCE(cr.creator_address, cm.creator_address) AS creator_address,
        cr.display_label,
        cr.source,
        cr.confidence,
        cr.expires_at,
        COALESCE(cr.is_fresh, false) AS is_fresh
      FROM target_rooms t
      LEFT JOIN cache_rows cr ON cr.room_id = t.room_id
      LEFT JOIN creator_map cm ON cm.room_id = t.room_id
      ORDER BY t.room_id::bigint ASC;
    `
    const rows = (result.rows ?? []) as Array<{
      room_id: string
      creator_address: string | null
      display_label: string | null
      source: string | null
      confidence: number | null
      expires_at: string | null
      is_fresh: boolean | null
    }>
    return rows.map((row) => ({
      roomId: String(row.room_id),
      creatorAddress: row.creator_address ? String(row.creator_address).toLowerCase() : null,
      displayLabel: row.display_label ? String(row.display_label) : null,
      source: row.source ? String(row.source) : null,
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      isFresh: Boolean(row.is_fresh),
    }))
  } catch {
    return []
  }
}
