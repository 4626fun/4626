import { getDb } from '../db/postgres.js'
import { getGroveChainId, tryUploadImmutableFile } from '../lens/lensGrove.js'
import { resolveHermitGatewayUrl } from '../hermit/policy.js'
import { renderSatoriPng } from './satoriRenderer.js'
import { renderHermitAvatarDataUrl } from './hermitAvatar.js'
import {
  buildTopVolumeTree,
  buildTierMixTree,
  buildPnlDistributionTree,
  CHART_CANVAS,
  type PnlBucket,
} from './chartTemplates.js'

const HERMIT_AVATAR_RENDER_SIZE = 256

async function safeHermitAvatarDataUrl(): Promise<string | undefined> {
  try {
    return await renderHermitAvatarDataUrl({ size: HERMIT_AVATAR_RENDER_SIZE })
  } catch (err) {
    console.warn('[alfa/charts] hermit avatar render failed; falling back to default mark:', err)
    return undefined
  }
}

export type AlfaRoomChartKind = 'top-volume' | 'tier-mix' | 'pnl-distribution'

export type AlfaRoomChartAttachment = {
  url: string
  type: 'photo'
  filename: string
  mime_type: 'image/png'
}

export type AlfaRoomChartResult = {
  kind: AlfaRoomChartKind
  title: string
  summary: string
  attachment: AlfaRoomChartAttachment
  delivery: 'ipfs'
}

type TopVolumeRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  volume: string
}

type TierMixRow = {
  room_type: string | null
  tier: string | null
  rooms: number
}

type PnlBucketRow = {
  bucket: number
  rooms: number
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function clampLimit(rawLimit: number | null, fallback: number, max: number): number {
  if (!rawLimit || !Number.isFinite(rawLimit)) return fallback
  const rounded = Math.floor(rawLimit)
  if (rounded <= 0) return fallback
  return Math.min(rounded, max)
}

function extractIpfsCid(url: string): string | null {
  try {
    const parsed = new URL(url)
    const idx = parsed.pathname.indexOf('/ipfs/')
    if (idx < 0) return null
    const cid = parsed.pathname.slice(idx + '/ipfs/'.length).split('/')[0]?.trim()
    return cid || null
  } catch {
    return null
  }
}

async function uploadPng(params: {
  bytes: Uint8Array
  filename: string
}): Promise<AlfaRoomChartAttachment | null> {
  try {
    const fileCtor = globalThis.File
    if (typeof fileCtor !== 'function') return null
    // Copy into a fresh ArrayBuffer to satisfy strict BlobPart typing
    // (Uint8Array<ArrayBufferLike> is not directly assignable in strict mode).
    const ab = new ArrayBuffer(params.bytes.byteLength)
    new Uint8Array(ab).set(params.bytes)
    const file = new fileCtor([ab], params.filename, {
      type: 'image/png',
    })
    const uploaded = await tryUploadImmutableFile(file, getGroveChainId())
    if (!uploaded.ok) return null
    const cid = extractIpfsCid(uploaded.result.gatewayUrl)
    const branded = cid ? resolveHermitGatewayUrl(cid) : null
    const url = branded
      ? `${branded}?filename=${encodeURIComponent(params.filename)}`
      : uploaded.result.gatewayUrl
    return {
      type: 'photo',
      filename: params.filename,
      mime_type: 'image/png',
      url,
    }
  } catch {
    return null
  }
}

function parseChartKind(raw: string | null | undefined): AlfaRoomChartKind | null {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!normalized) return 'top-volume'
  if (normalized === 'top' || normalized === 'top-volume' || normalized === 'volume') return 'top-volume'
  if (normalized === 'tier' || normalized === 'tier-mix' || normalized === 'mix') return 'tier-mix'
  if (normalized === 'pnl' || normalized === 'pnl-distribution' || normalized === 'distribution') {
    return 'pnl-distribution'
  }
  return null
}

async function loadTopVolume(limit: number): Promise<TopVolumeRow[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      select
        s.room_id::text as room_id,
        coalesce(s.room_name, e.room_name) as room_name,
        s.creator_twitter_username,
        (s.raw->'room'->>'volume') as volume
      from public.alfaclub_rooms_snapshot s
      left join lateral (
        select room_name
        from public.alfaclub_explore_latest e2
        where e2.room_id = s.room_id::bigint and e2.room_name is not null
        limit 1
      ) e on true
      where (s.raw->'room'->>'volume') is not null
        and (s.raw->'room'->>'volume') != ''
      order by (s.raw->'room'->>'volume')::numeric desc nulls last
      limit ${limit};
    `
    return (result.rows ?? []) as TopVolumeRow[]
  } catch {
    return []
  }
}

async function loadTotalCatalogVolume(): Promise<number> {
  const db = await getDb()
  if (!db) return 0
  try {
    const result = await db.sql`
      select coalesce(sum((raw->'room'->>'volume')::numeric), 0)::text as total
      from public.alfaclub_rooms_snapshot
      where (raw->'room'->>'volume') is not null
        and (raw->'room'->>'volume') != '';
    `
    const row = (result.rows ?? [])[0] as { total: string } | undefined
    return row ? Number(row.total) : 0
  } catch {
    return 0
  }
}

async function loadTierMix(): Promise<TierMixRow[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      select
        room_type,
        tier,
        count(*)::int as rooms
      from public.alfaclub_rooms_snapshot
      group by room_type, tier
      order by rooms desc;
    `
    return (result.rows ?? []) as TierMixRow[]
  } catch {
    return []
  }
}

async function loadPnlDistribution(): Promise<PnlBucketRow[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      with vals as (
        select (raw->'room'->>'pnlPercentageAllTime')::numeric as pnl
        from public.alfaclub_rooms_snapshot
        where (raw->'room'->>'pnlPercentageAllTime') is not null
          and (raw->'room'->>'pnlPercentageAllTime') != ''
      ),
      bins as (
        select width_bucket(pnl, -100, 300, 10) as bucket, count(*)::int as rooms
        from vals
        where pnl between -100 and 300
        group by 1
      )
      select bucket, rooms
      from bins
      where bucket between 1 and 10
      order by bucket asc;
    `
    return (result.rows ?? []) as PnlBucketRow[]
  } catch {
    return []
  }
}

// AlfaClub volume on Base appears to be USDC with 6 decimals; scale to plain USDC for display.
const VOLUME_SCALE = 1_000_000

async function renderTopVolumeChart(rows: TopVolumeRow[]): Promise<AlfaRoomChartResult | null> {
  if (rows.length === 0) return null
  const [totalCatalogRaw, avatarDataUrl] = await Promise.all([
    loadTotalCatalogVolume(),
    safeHermitAvatarDataUrl(),
  ])
  const totalCatalog = totalCatalogRaw / VOLUME_SCALE
  const tree = buildTopVolumeTree({
    rows: rows.map((row) => {
      const name = row.room_name?.trim() || `Room #${row.room_id}`
      const handle = row.creator_twitter_username?.trim()
      return {
        name,
        volume: Number(row.volume) / VOLUME_SCALE,
        subtitle: handle ? `@${handle}` : undefined,
      }
    }),
    totalVolume: totalCatalog,
    avatarDataUrl,
  })
  const bytes = await renderSatoriPng(tree, { width: CHART_CANVAS.width, height: CHART_CANVAS.height })
  const attachment = await uploadPng({ bytes, filename: 'alfaclub-top-volume.png' })
  if (!attachment) return null
  const top = rows[0]
  const topName = top.room_name?.trim() || top.creator_twitter_username?.trim() || `Room #${top.room_id}`
  const topVol = Number(top.volume) / VOLUME_SCALE
  const sum = rows.slice(0, 10).reduce((acc, r) => acc + Number(r.volume), 0) / VOLUME_SCALE
  return {
    kind: 'top-volume',
    title: 'Top Volume Rooms',
    summary: [
      `Top room: ${topName} ($${formatCompact(topVol)})`,
      `Top 10 sum: $${formatCompact(sum)}`,
    ].join('\n'),
    attachment,
    delivery: 'ipfs',
  }
}

async function renderTierMixChart(rows: TierMixRow[]): Promise<AlfaRoomChartResult | null> {
  if (rows.length === 0) return null
  const segments = rows.map((row) => ({
    label: `${(row.room_type ?? 'unknown').toLowerCase()} · ${(row.tier ?? 'unknown').toLowerCase()}`,
    rooms: Number(row.rooms),
  }))
  const totalRooms = segments.reduce((acc, s) => acc + s.rooms, 0)
  const avatarDataUrl = await safeHermitAvatarDataUrl()
  const tree = buildTierMixTree({ segments, totalRooms, avatarDataUrl })
  const bytes = await renderSatoriPng(tree, { width: CHART_CANVAS.width, height: CHART_CANVAS.height })
  const attachment = await uploadPng({ bytes, filename: 'alfaclub-tier-mix.png' })
  if (!attachment) return null
  const top = segments.slice().sort((a, b) => b.rooms - a.rooms)[0]
  return {
    kind: 'tier-mix',
    title: 'Room Mix',
    summary: [
      `Largest segment: ${top?.label ?? '—'}`,
      `Total rooms: ${totalRooms.toLocaleString('en-US')}`,
    ].join('\n'),
    attachment,
    delivery: 'ipfs',
  }
}

async function renderPnlDistributionChart(rows: PnlBucketRow[]): Promise<AlfaRoomChartResult | null> {
  if (rows.length === 0) return null
  const buckets: PnlBucket[] = rows.map((row) => {
    const idx = Math.max(1, Math.min(10, Number(row.bucket)))
    const start = -100 + (idx - 1) * 40
    const end = start + 40
    return { bucketStart: start, bucketEnd: end, rooms: Number(row.rooms) }
  })
  const totalRooms = buckets.reduce((acc, b) => acc + b.rooms, 0)
  const avatarDataUrl = await safeHermitAvatarDataUrl()
  const tree = buildPnlDistributionTree({ buckets, totalRooms, avatarDataUrl })
  const bytes = await renderSatoriPng(tree, { width: CHART_CANVAS.width, height: CHART_CANVAS.height })
  const attachment = await uploadPng({ bytes, filename: 'alfaclub-pnl-distribution.png' })
  if (!attachment) return null
  const peak = buckets.reduce((m, b) => (b.rooms > m.rooms ? b : m), buckets[0])
  return {
    kind: 'pnl-distribution',
    title: 'PnL Distribution',
    summary: [
      `Modal bucket: ${peak.bucketStart}% to ${peak.bucketEnd}% (${peak.rooms.toLocaleString('en-US')} rooms)`,
      `Total rooms with PnL: ${totalRooms.toLocaleString('en-US')}`,
    ].join('\n'),
    attachment,
    delivery: 'ipfs',
  }
}

export async function buildAlfaRoomChart(params: {
  kindRaw: string | null | undefined
  limit: number | null | undefined
}): Promise<{ ok: true; chart: AlfaRoomChartResult } | { ok: false; error: string }> {
  const kind = parseChartKind(params.kindRaw)
  if (!kind) {
    return {
      ok: false,
      error: 'Unknown chart kind. Use `top-volume`, `tier-mix`, or `pnl-distribution`.',
    }
  }

  if (kind === 'top-volume') {
    const rows = await loadTopVolume(clampLimit(params.limit ?? null, 8, 10))
    if (rows.length === 0) return { ok: false, error: 'No room snapshot data found for top-volume chart.' }
    const chart = await renderTopVolumeChart(rows)
    if (!chart) return { ok: false, error: 'Render or upload failed for top-volume chart.' }
    return { ok: true, chart }
  }

  if (kind === 'tier-mix') {
    const rows = await loadTierMix()
    if (rows.length === 0) return { ok: false, error: 'No room snapshot data found for tier-mix chart.' }
    const chart = await renderTierMixChart(rows)
    if (!chart) return { ok: false, error: 'Render or upload failed for tier-mix chart.' }
    return { ok: true, chart }
  }

  const rows = await loadPnlDistribution()
  if (rows.length === 0) {
    return { ok: false, error: 'No room snapshot data found for pnl-distribution chart.' }
  }
  const chart = await renderPnlDistributionChart(rows)
  if (!chart) return { ok: false, error: 'Render or upload failed for pnl-distribution chart.' }
  return { ok: true, chart }
}
