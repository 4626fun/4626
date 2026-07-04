/**
 * Refresh `public.alfaclub_rooms_snapshot` from AlfaClub's per-room API.
 *
 * The legacy bulk `room_paginate` ingest stopped in May 2026. The supported
 * path is `GET /api/room/:roomId`, batched across indexed FriendKey token ids
 * from `alfaclub_creators`.
 */

import { getDb } from '../db/postgres.js'
import { readAlfaClubChatToken } from './chatTokenStore.js'
import {
  buildAlfaClubApiHeaders,
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'
import {
  listCreatorRoomIds,
  readRoomsSnapshotSyncCursor,
  writeRoomsSnapshotSyncCursor,
} from './creators.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

const SNAPSHOT_SOURCE = 'room_detail'
const DEFAULT_BATCH_SIZE = 250
const DEFAULT_CONCURRENCY = 8
const DEFAULT_HTTP_TIMEOUT_MS = 12_000
const MAX_FULL_RUN_ROOMS = 2_500

type JsonRecord = Record<string, unknown>

export type RoomsSnapshotSyncFlags = {
  enabled: boolean
  batchSize: number
  concurrency: number
  httpTimeoutMs: number
}

export type RoomsSnapshotSyncResult = {
  ok: boolean
  reason?: string
  dbConfigured: boolean
  authConfigured: boolean
  source: typeof SNAPSHOT_SOURCE
  scannedRoomIds: number
  fetched: number
  upserted: number
  skipped: number
  notFound: number
  failed: number
  cursorStart: number
  cursorNext: number
  totalIndexedRooms: number
  maxRoomId: string | null
  latestIngestedAt: string | null
  errors: string[]
}

export type RoomsSnapshotSyncOptions = {
  roomIds?: string[]
  full?: boolean
}

function parseBool(raw: string | undefined, fallback = false): boolean {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return fallback
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const trimmed = (raw ?? '').trim()
  if (!/^\d+$/.test(trimmed)) return fallback
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

export function readRoomsSnapshotSyncFlags(): RoomsSnapshotSyncFlags {
  return {
    enabled: parseBool(process.env.ALFACLUB_ROOMS_SNAPSHOT_SYNC_ENABLED, true),
    batchSize: parsePositiveInt(
      process.env.ALFACLUB_ROOMS_SNAPSHOT_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      500,
    ),
    concurrency: parsePositiveInt(
      process.env.ALFACLUB_ROOMS_SNAPSHOT_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      20,
    ),
    httpTimeoutMs: parsePositiveInt(
      process.env.ALFACLUB_ROOMS_SNAPSHOT_HTTP_TIMEOUT_MS,
      DEFAULT_HTTP_TIMEOUT_MS,
      30_000,
    ),
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function readString(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function readInteger(value: unknown): number | null {
  const text = readString(value)
  if (!text || !/^-?\d+$/.test(text)) return null
  const parsed = Number.parseInt(text, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function readNumeric(value: unknown): string | null {
  const text = readString(value)
  if (!text) return null
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  return text
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  const text = readString(value)?.toLowerCase()
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

function readTimestamp(value: unknown): string | null {
  const text = readString(value)
  if (!text) return null
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function normalizeRoomType(value: unknown): string | null {
  const text = readString(value)
  return text ? text.toLowerCase() : null
}

function normalizeTier(value: unknown): string | null {
  const text = readString(value)
  return text ? text.toLowerCase() : null
}

export function mapRoomDetailPayload(rawPayload: unknown): {
  roomId: string
  row: Record<string, unknown>
  raw: JsonRecord
} | null {
  const envelope = asRecord(rawPayload)
  const data = asRecord(envelope?.data)
  const room = asRecord(data?.room)
  if (!room) return null

  const roomId = readString(room.id) ?? readString(room.sn)
  if (!roomId || !/^\d+$/.test(roomId)) return null

  const creator = asRecord(data?.creator)
  const metadata = asRecord(data?.metadata)

  const creatorAddress = readString(room.creator) ?? readString(creator?.address)
  const creatorTwitter = readString(creator?.twitter_username)
  const creatorEthosScore =
    readInteger(room.ethosScore) ??
    readInteger(creator?.ethosScore) ??
    readInteger(asRecord(creator?.ethos)?.score)
  const creatorPoints = readNumeric(creator?.points)

  const raw: JsonRecord = {
    room,
    ...(creator ? { creator } : {}),
    ...(metadata ? { metadata } : {}),
    ...(data?.room_key != null ? { room_key: data.room_key } : {}),
    ...(data?.unique_holders != null ? { unique_holders: data.unique_holders } : {}),
  }

  return {
    roomId,
    raw,
    row: {
      room_id: roomId,
      sn: readString(room.sn),
      room_type: normalizeRoomType(room.roomType),
      tier: normalizeTier(room.tier),
      featured: readBoolean(room.featured),
      created_at: readTimestamp(room.createdAt),
      updated_at: readTimestamp(room.updatedAt),
      creator_address: creatorAddress?.toLowerCase() ?? null,
      creator_twitter_username: creatorTwitter,
      creator_ethos_score: creatorEthosScore,
      creator_points: creatorPoints,
      metadata_id: readString(room.metadataId) ?? readString(metadata?.id),
      room_name: readString(metadata?.name),
      room_description: readString(metadata?.description),
      image_url: readString(metadata?.image),
      wallet_address: readString(room.walletAddress)?.toLowerCase() ?? null,
      polymarket_proxy_address: readString(room.polymarketProxyAddress)?.toLowerCase() ?? null,
      polymarket_deposit_wallet_address:
        readString(room.polymarketDepositWalletAddress)?.toLowerCase() ?? null,
      current_supply: readNumeric(room.currentSupply),
      volume: readNumeric(room.volume),
      buy_price: readNumeric(room.buyPrice),
      sell_price: readNumeric(room.sellPrice),
      mid_price: readNumeric(room.midPrice),
      fund_size: readNumeric(room.fundSize),
      pnl: readNumeric(room.pnl),
      pnl_percentage_7d: readNumeric(room.pnlPercentage7d),
      pnl_percentage_30d: readNumeric(room.pnlPercentage30d),
      pnl_percentage_all_time: readNumeric(room.pnlPercentageAllTime),
      unique_holders: readInteger(data?.unique_holders),
      raw,
      source: SNAPSHOT_SOURCE,
    },
  }
}

async function resolveAlfaClubJwt(): Promise<string | null> {
  const flags = readAlfaClubApiAuthFlags()
  if (flags.jwt) return flags.jwt
  const stored = await readAlfaClubChatToken()
  return stored?.jwt ?? null
}

async function fetchRoomDetail(params: {
  roomId: string
  jwt: string
  httpTimeoutMs: number
}): Promise<{ ok: true; payload: unknown } | { ok: false; status: number; reason: string }> {
  const flags = readAlfaClubApiAuthFlags()
  const baseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const url = new URL(`/api/room/${encodeURIComponent(params.roomId)}`, baseUrl)
  const headers = buildAlfaClubApiHeaders({
    jwt: params.jwt,
    fingerprintBaseUrl: flags.apiBaseUrl,
    proxySecret: resolveAlfaClubProxySecret(flags),
  })

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(params.httpTimeoutMs),
    })
    if (response.status === 404) {
      return { ok: false, status: 404, reason: 'not_found' }
    }
    if (!response.ok) {
      const text = (await response.text()).slice(0, 160)
      return { ok: false, status: response.status, reason: text || `http_${response.status}` }
    }
    const payload = await response.json()
    return { ok: true, payload }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed'
    return { ok: false, status: 0, reason: message.slice(0, 160) }
  }
}

async function upsertRoomSnapshotRow(row: Record<string, unknown>, ingestedAt: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false

  try {
    await db.sql`
      INSERT INTO public.alfaclub_rooms_snapshot (
        room_id,
        sn,
        room_type,
        tier,
        featured,
        created_at,
        updated_at,
        creator_address,
        creator_twitter_username,
        creator_ethos_score,
        creator_points,
        metadata_id,
        room_name,
        room_description,
        image_url,
        wallet_address,
        polymarket_proxy_address,
        polymarket_deposit_wallet_address,
        current_supply,
        volume,
        buy_price,
        sell_price,
        mid_price,
        fund_size,
        pnl,
        pnl_percentage_7d,
        pnl_percentage_30d,
        pnl_percentage_all_time,
        unique_holders,
        raw,
        source,
        ingested_at
      )
      VALUES (
        ${row.room_id}::bigint,
        ${row.sn},
        ${row.room_type},
        ${row.tier},
        ${row.featured},
        ${row.created_at}::timestamptz,
        ${row.updated_at}::timestamptz,
        ${row.creator_address},
        ${row.creator_twitter_username},
        ${row.creator_ethos_score},
        ${row.creator_points},
        ${row.metadata_id},
        ${row.room_name},
        ${row.room_description},
        ${row.image_url},
        ${row.wallet_address},
        ${row.polymarket_proxy_address},
        ${row.polymarket_deposit_wallet_address},
        ${row.current_supply},
        ${row.volume},
        ${row.buy_price},
        ${row.sell_price},
        ${row.mid_price},
        ${row.fund_size},
        ${row.pnl},
        ${row.pnl_percentage_7d},
        ${row.pnl_percentage_30d},
        ${row.pnl_percentage_all_time},
        ${row.unique_holders},
        ${JSON.stringify(row.raw)}::jsonb,
        ${row.source},
        ${ingestedAt}::timestamptz
      )
      ON CONFLICT (room_id) DO UPDATE SET
        sn = EXCLUDED.sn,
        room_type = EXCLUDED.room_type,
        tier = EXCLUDED.tier,
        featured = EXCLUDED.featured,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        creator_address = EXCLUDED.creator_address,
        creator_twitter_username = EXCLUDED.creator_twitter_username,
        creator_ethos_score = EXCLUDED.creator_ethos_score,
        creator_points = EXCLUDED.creator_points,
        metadata_id = EXCLUDED.metadata_id,
        room_name = EXCLUDED.room_name,
        room_description = EXCLUDED.room_description,
        image_url = EXCLUDED.image_url,
        wallet_address = EXCLUDED.wallet_address,
        polymarket_proxy_address = EXCLUDED.polymarket_proxy_address,
        polymarket_deposit_wallet_address = EXCLUDED.polymarket_deposit_wallet_address,
        current_supply = EXCLUDED.current_supply,
        volume = EXCLUDED.volume,
        buy_price = EXCLUDED.buy_price,
        sell_price = EXCLUDED.sell_price,
        mid_price = EXCLUDED.mid_price,
        fund_size = EXCLUDED.fund_size,
        pnl = EXCLUDED.pnl,
        pnl_percentage_7d = EXCLUDED.pnl_percentage_7d,
        pnl_percentage_30d = EXCLUDED.pnl_percentage_30d,
        pnl_percentage_all_time = EXCLUDED.pnl_percentage_all_time,
        unique_holders = EXCLUDED.unique_holders,
        raw = EXCLUDED.raw,
        source = EXCLUDED.source,
        ingested_at = EXCLUDED.ingested_at;
    `
    return true
  } catch {
    return false
  }
}

function selectRoomIds(params: {
  allRoomIds: string[]
  options?: RoomsSnapshotSyncOptions
  flags: RoomsSnapshotSyncFlags
  cursorStart: number
}): { roomIds: string[]; cursorNext: number } {
  const { allRoomIds, options, flags, cursorStart } = params
  if (options?.roomIds && options.roomIds.length > 0) {
    const allowed = new Set(allRoomIds)
    const selected = [
      ...new Set(
        options.roomIds
          .map((roomId) => roomId.trim())
          .filter((roomId) => /^\d+$/.test(roomId))
          .filter((roomId) => allowed.size === 0 || allowed.has(roomId)),
      ),
    ]
    return { roomIds: selected, cursorNext: cursorStart }
  }

  if (allRoomIds.length === 0) {
    return { roomIds: [], cursorNext: 0 }
  }

  if (options?.full) {
    return {
      roomIds: allRoomIds.slice(0, MAX_FULL_RUN_ROOMS),
      cursorNext: 0,
    }
  }

  const batchSize = flags.batchSize
  const start = cursorStart % allRoomIds.length
  const roomIds: string[] = []
  for (let i = 0; i < batchSize; i += 1) {
    roomIds.push(allRoomIds[(start + i) % allRoomIds.length]!)
  }
  const cursorNext = (start + batchSize) % allRoomIds.length
  return { roomIds, cursorNext }
}

async function readLatestIngestedAt(): Promise<string | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`
      SELECT MAX(ingested_at)::text AS latest
      FROM public.alfaclub_rooms_snapshot;
    `
    const row = (result.rows ?? [])[0] as { latest: string | null } | undefined
    return row?.latest ?? null
  } catch {
    return null
  }
}

export async function syncRoomsSnapshot(
  options?: RoomsSnapshotSyncOptions,
): Promise<RoomsSnapshotSyncResult> {
  const flags = readRoomsSnapshotSyncFlags()
  const db = await getDb()
  const result: RoomsSnapshotSyncResult = {
    ok: false,
    dbConfigured: Boolean(db),
    authConfigured: false,
    source: SNAPSHOT_SOURCE,
    scannedRoomIds: 0,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    notFound: 0,
    failed: 0,
    cursorStart: 0,
    cursorNext: 0,
    totalIndexedRooms: 0,
    maxRoomId: null,
    latestIngestedAt: null,
    errors: [],
  }

  if (!flags.enabled) {
    return { ...result, reason: 'disabled' }
  }
  if (!db) {
    return { ...result, reason: 'db_unconfigured' }
  }

  await ensureAlfaClubVigilanteSchema()

  const jwt = await resolveAlfaClubJwt()
  result.authConfigured = Boolean(jwt)
  if (!jwt) {
    return { ...result, reason: 'missing_jwt' }
  }

  const allRoomIds = await listCreatorRoomIds()
  result.totalIndexedRooms = allRoomIds.length
  result.maxRoomId = allRoomIds.length > 0 ? allRoomIds[allRoomIds.length - 1] ?? null : null

  const cursorStart = options?.roomIds?.length || options?.full
    ? 0
    : await readRoomsSnapshotSyncCursor()
  result.cursorStart = cursorStart

  const selection = selectRoomIds({
    allRoomIds,
    options,
    flags,
    cursorStart,
  })
  result.cursorNext = selection.cursorNext
  result.scannedRoomIds = selection.roomIds.length

  if (selection.roomIds.length === 0) {
    result.latestIngestedAt = await readLatestIngestedAt()
    return { ...result, ok: true, reason: 'no_rooms' }
  }

  const ingestedAt = new Date().toISOString()
  let index = 0

  async function worker(): Promise<void> {
    while (index < selection.roomIds.length) {
      const current = selection.roomIds[index]
      index += 1
      if (!current) continue

      const fetched = await fetchRoomDetail({
        roomId: current,
        jwt,
        httpTimeoutMs: flags.httpTimeoutMs,
      })
      if (!fetched.ok) {
        if (fetched.status === 404) {
          result.notFound += 1
        } else {
          result.failed += 1
          if (result.errors.length < 8) {
            result.errors.push(`room ${current}: ${fetched.reason}`)
          }
        }
        continue
      }

      result.fetched += 1
      const mapped = mapRoomDetailPayload(fetched.payload)
      if (!mapped) {
        result.skipped += 1
        if (result.errors.length < 8) {
          result.errors.push(`room ${current}: invalid_payload`)
        }
        continue
      }

      const upserted = await upsertRoomSnapshotRow(mapped.row, ingestedAt)
      if (upserted) {
        result.upserted += 1
      } else {
        result.failed += 1
        if (result.errors.length < 8) {
          result.errors.push(`room ${current}: upsert_failed`)
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(flags.concurrency, selection.roomIds.length) }, () =>
    worker(),
  )
  await Promise.all(workers)

  if (!options?.roomIds?.length && !options?.full) {
    await writeRoomsSnapshotSyncCursor(selection.cursorNext)
  }

  result.latestIngestedAt = await readLatestIngestedAt()
  result.ok = result.upserted > 0 || result.notFound > 0 || result.failed === 0
  if (!result.ok && result.failed > 0) {
    result.reason = 'fetch_or_upsert_failed'
  }

  return result
}
