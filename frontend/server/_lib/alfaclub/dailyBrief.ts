import { createHash } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import { listAllCreators } from './creators.js'
import { getBasenameName } from '../identity/basenameResolver.js'
import { getEnsName } from '../identity/ensResolver.js'
import {
  getLatestSnapshotTs,
  getSnapshotAt,
  listRecentPublications,
  type MetricsSnapshotRow,
  type PublicationRecord,
} from './publicationLedger.js'
import { readAlfaClubChatBridgeFlags, sendAlfaClubRoomText } from './chatBridge.js'
import {
  formatCreatorRoomLink,
  loadCreatorRoomIdByCoinAddress,
} from './creatorRoomLinks.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ROOM_ID = '1043'
const DEFAULT_MARKET_TIMEOUT_MS = 12_000
const DEFAULT_TOP_ROWS = 5
const DEFAULT_MOVER_ROWS = 5
const DEFAULT_RECENT_PUBLICATIONS_LIMIT = 500
const MAJOR_TOKENS = [
  { symbol: 'BTC', id: 'bitcoin' },
  { symbol: 'ETH', id: 'ethereum' },
  { symbol: 'BNB', id: 'binancecoin' },
  { symbol: 'SOL', id: 'solana' },
  { symbol: 'AVAX', id: 'avalanche-2' },
  { symbol: 'XRP', id: 'ripple' },
  { symbol: 'DOGE', id: 'dogecoin' },
  { symbol: 'LINK', id: 'chainlink' },
  { symbol: 'TON', id: 'the-open-network' },
  { symbol: 'SUI', id: 'sui' },
] as const

type DailyBriefFlags = {
  enabled: boolean
  roomId: string
  topRows: number
  moverRows: number
  forceSend: boolean
  marketTimeoutMs: number
}

type MarketRow = {
  symbol: string
  priceUsd: number | null
  change24hPct: number | null
}

type SnapshotDelta = {
  current: MetricsSnapshotRow
  previous: MetricsSnapshotRow | null
  rankDelta: number | null
  scoreDelta: number | null
  isNew: boolean
}

type CreatorLabelMap = Map<string, string>

export type AlfaClubDailyBriefResult = {
  ok: boolean
  reason?: string
  snapshotTs: string | null
  previousSnapshotTs: string | null
  sent: boolean
  skippedDuplicate: boolean
  roomId: string
  lane: string | null
  messageText: string | null
}

export function readAlfaClubDailyBriefFlags(): DailyBriefFlags {
  return {
    enabled: parseBool(process.env.ALFACLUB_DAILY_BRIEF_ENABLED ?? '1'),
    roomId: normalizeRoomId(process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID) ?? DEFAULT_ROOM_ID,
    topRows: parsePositiveInt(process.env.ALFACLUB_DAILY_BRIEF_TOP_ROWS, DEFAULT_TOP_ROWS, 10),
    moverRows: parsePositiveInt(process.env.ALFACLUB_DAILY_BRIEF_MOVER_ROWS, DEFAULT_MOVER_ROWS, 10),
    forceSend: parseBool(process.env.ALFACLUB_DAILY_BRIEF_FORCE_SEND),
    marketTimeoutMs: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_MARKET_TIMEOUT_MS,
      DEFAULT_MARKET_TIMEOUT_MS,
      30_000,
    ),
  }
}

function parseBool(raw: string | undefined): boolean {
  const value = (raw ?? '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const value = (raw ?? '').trim()
  if (!/^\d+$/.test(value)) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function normalizeRoomId(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  return /^\d+$/.test(value) ? value : null
}

async function ensureDailyBriefSchema(): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.sql`
      CREATE SCHEMA IF NOT EXISTS alfaclub;
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS alfaclub.daily_brief_dispatch (
        dispatch_key TEXT PRIMARY KEY,
        snapshot_ts TIMESTAMPTZ NOT NULL,
        previous_snapshot_ts TIMESTAMPTZ NULL,
        room_id TEXT NOT NULL,
        message_hash TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  } catch {
    // Best-effort schema init.
  }
}

async function listRecentSnapshotTimestamps(limit: number): Promise<string[]> {
  const db = await getDb()
  if (!db) return []
  const bounded = Math.max(1, Math.min(10, Math.floor(limit)))
  try {
    const result = await db.sql`
      SELECT DISTINCT snapshot_ts::text AS snapshot_ts
      FROM alfaclub_metrics_snapshot
      ORDER BY snapshot_ts DESC
      LIMIT ${bounded};
    `
    return ((result.rows ?? []) as Array<{ snapshot_ts: string | null }>)
      .map((row) => row.snapshot_ts)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  } catch {
    return []
  }
}

function dispatchKey(params: { snapshotTs: string; roomId: string }): string {
  return `daily-brief:${createHash('sha256').update(`${params.snapshotTs}|${params.roomId}`).digest('hex')}`
}

async function hasDailyBriefDispatch(key: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    const result = await db.sql`
      SELECT 1
      FROM alfaclub.daily_brief_dispatch
      WHERE dispatch_key = ${key}
      LIMIT 1;
    `
    return (result.rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function recordDailyBriefDispatch(params: {
  key: string
  snapshotTs: string
  previousSnapshotTs: string | null
  roomId: string
  messageText: string
}): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.sql`
      INSERT INTO alfaclub.daily_brief_dispatch (
        dispatch_key,
        snapshot_ts,
        previous_snapshot_ts,
        room_id,
        message_hash,
        sent_at
      ) VALUES (
        ${params.key},
        ${params.snapshotTs},
        ${params.previousSnapshotTs},
        ${params.roomId},
        ${createHash('sha256').update(params.messageText).digest('hex')},
        NOW()
      )
      ON CONFLICT (dispatch_key) DO NOTHING;
    `
  } catch {
    // Best-effort ledger write.
  }
}

function byAddress(rows: MetricsSnapshotRow[]): Map<string, MetricsSnapshotRow> {
  const map = new Map<string, MetricsSnapshotRow>()
  for (const row of rows) map.set(row.creatorAddress.toLowerCase(), row)
  return map
}

function buildDeltas(currentRows: MetricsSnapshotRow[], previousRows: MetricsSnapshotRow[]): SnapshotDelta[] {
  const previousByAddress = byAddress(previousRows)
  return currentRows.map((current) => {
    const previous = previousByAddress.get(current.creatorAddress.toLowerCase()) ?? null
    return {
      current,
      previous,
      rankDelta: previous ? previous.rank - current.rank : null,
      scoreDelta: previous ? current.score - previous.score : null,
      isNew: previous === null,
    }
  })
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function creatorLabel(row: MetricsSnapshotRow): string {
  return `#${row.tokenId.toString()} ${shortAddress(row.creatorAddress)}`
}

function appendCreatorRoomLink(
  line: string,
  address: string,
  roomIds: Map<string, string>,
): string {
  const link = formatCreatorRoomLink(address, roomIds)
  return link ? `${line} ${link}` : line
}

function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, '')
  return trimmed ? `@${trimmed}` : ''
}

async function readCreatorLabels(addresses: string[]): Promise<CreatorLabelMap> {
  const labels: CreatorLabelMap = new Map()
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
    // Best-effort enrichment; fallback labels keep the brief resilient.
  }

  const unresolved = normalized.filter((address) => !labels.has(address))
  if (unresolved.length > 0) {
    await Promise.all(
      unresolved.map(async (address) => {
        const basename = await getBasenameName(address).catch(() => null)
        if (basename) {
          labels.set(address, basename)
          return
        }
        const ens = await getEnsName(address).catch(() => null)
        if (ens) labels.set(address, ens)
      }),
    )
  }
  return labels
}

function creatorIdentity(row: MetricsSnapshotRow, labels: CreatorLabelMap): string {
  const label = labels.get(row.creatorAddress.toLowerCase())
  if (label) return `${label} · #${row.tokenId.toString()}`
  return creatorLabel(row)
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (value >= 0.01) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
  return `$${value.toExponential(2)}`
}

function formatScore(value: number): string {
  return value.toFixed(3)
}

function formatRankDelta(value: number | null): string {
  if (value === null) return 'new'
  if (value > 0) return `up ${value}`
  if (value < 0) return `down ${Math.abs(value)}`
  return 'flat'
}

function stakeRatio(row: MetricsSnapshotRow | null): number | null {
  if (!row || row.totalSupply <= 0n) return null
  const total = Number(row.totalSupply)
  const staked = Number(row.stakedSupply)
  if (!Number.isFinite(total) || !Number.isFinite(staked) || total <= 0) return null
  return staked / total
}

function formatRatioPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

function formatRatioDeltaPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const pct = value * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}pp`
}

async function fetchMajorTokenPrices(timeoutMs: number): Promise<MarketRow[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL('https://api.coingecko.com/api/v3/simple/price')
    url.searchParams.set('ids', MAJOR_TOKENS.map((token) => token.id).join(','))
    url.searchParams.set('vs_currencies', 'usd')
    url.searchParams.set('include_24hr_change', 'true')
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`market_fetch_failed:${response.status}`)
    const body = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>
    return MAJOR_TOKENS.map((token) => ({
      symbol: token.symbol,
      priceUsd: Number.isFinite(body?.[token.id]?.usd) ? Number(body[token.id]?.usd) : null,
      change24hPct: Number.isFinite(body?.[token.id]?.usd_24h_change)
        ? Number(body[token.id]?.usd_24h_change)
        : null,
    }))
  } catch {
    return MAJOR_TOKENS.map((token) => ({ symbol: token.symbol, priceUsd: null, change24hPct: null }))
  } finally {
    clearTimeout(timeout)
  }
}

function buildNarrative(params: {
  deltas: SnapshotDelta[]
  newCreators: number
  activeCreators24h: number
  publications24h: number
  topRows: number
}): string {
  const biggestMover = [...params.deltas]
    .filter((delta) => delta.scoreDelta !== null)
    .sort((a, b) => (b.scoreDelta ?? Number.NEGATIVE_INFINITY) - (a.scoreDelta ?? Number.NEGATIVE_INFINITY))[0]
  const positiveMovers = params.deltas.filter((delta) => (delta.scoreDelta ?? 0) > 0).length
  const broadening = positiveMovers >= Math.max(3, Math.floor(params.topRows / 2))
  const lines: string[] = []
  if (params.newCreators > 0) {
    lines.push(`${params.newCreators} new creator${params.newCreators === 1 ? '' : 's'} joined the tracked set`)
  }
  if (params.publications24h > 0) {
    lines.push(`${params.publications24h} publication${params.publications24h === 1 ? '' : 's'} landed in the last 24h`)
  }
  if (params.activeCreators24h > 0) {
    lines.push(`${params.activeCreators24h} creators showed fresh activity`)
  }
  const lead = lines.length > 0 ? `${lines.join(', ')}.` : 'Snapshot landed cleanly.'
  const second = biggestMover
    ? `${shortAddress(biggestMover.current.creatorAddress)} was the strongest riser (${formatRankDelta(biggestMover.rankDelta)}, score ${formatScore(biggestMover.current.score)}).`
    : 'Leaderboard looks stable versus the prior snapshot.'
  const third = broadening
    ? 'The move looks broad rather than purely top-heavy, with gains spread across multiple names.'
    : 'Movement looks concentrated near the top, so leadership is still carrying the tape.'
  return [lead, second, third].join(' ')
}

function buildBriefText(params: {
  snapshotTs: string
  previousSnapshotTs: string | null
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  creatorsTracked: number
  recentPublications: PublicationRecord[]
  marketRows: MarketRow[]
  topRows: number
  moverRows: number
  labels: CreatorLabelMap
  roomIds: Map<string, string>
}): string {
  const deltas = buildDeltas(params.currentRows, params.previousRows)
  const previousTopSet = new Set(params.previousRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()))
  const currentTopSet = new Set(params.currentRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()))
  const entrantRows = params.currentRows
    .filter((row) => row.rank <= params.topRows && !previousTopSet.has(row.creatorAddress.toLowerCase()))
    .slice(0, 3)
  const exitRows = params.previousRows
    .filter((row) => row.rank <= params.topRows && !currentTopSet.has(row.creatorAddress.toLowerCase()))
    .slice(0, 3)
  const newCreators = deltas.filter((delta) => delta.isNew).length
  const pubs24h = params.recentPublications.filter((pub) => {
    const ts = Date.parse(pub.createdAt)
    return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000
  })
  const activeCreators24h = new Set(pubs24h.map((pub) => pub.creatorAddress.toLowerCase())).size
  const movers = [...deltas]
    .filter((delta) => delta.scoreDelta !== null || delta.isNew)
    .sort((a, b) => {
      const scoreA = a.scoreDelta ?? (a.isNew ? 1_000_000 : Number.NEGATIVE_INFINITY)
      const scoreB = b.scoreDelta ?? (b.isNew ? 1_000_000 : Number.NEGATIVE_INFINITY)
      if (scoreB !== scoreA) return scoreB - scoreA
      return a.current.rank - b.current.rank
    })
    .slice(0, params.moverRows)
  const downside = [...deltas]
    .filter((delta) => (delta.scoreDelta ?? 0) < 0 || (delta.rankDelta ?? 0) < 0)
    .sort((a, b) => {
      const aRisk = Math.abs(Math.min(0, a.rankDelta ?? 0)) * 0.8 + Math.abs(Math.min(0, a.scoreDelta ?? 0)) * 20
      const bRisk = Math.abs(Math.min(0, b.rankDelta ?? 0)) * 0.8 + Math.abs(Math.min(0, b.scoreDelta ?? 0)) * 20
      if (bRisk !== aRisk) return bRisk - aRisk
      return a.current.rank - b.current.rank
    })
    .slice(0, 3)
  const stakeShifts = deltas
    .map((delta) => {
      const nowRatio = stakeRatio(delta.current)
      const prevRatio = stakeRatio(delta.previous)
      const ratioDelta = nowRatio !== null && prevRatio !== null ? nowRatio - prevRatio : null
      return { delta, nowRatio, ratioDelta }
    })
    .filter((entry) => entry.ratioDelta !== null && Math.abs(entry.ratioDelta) >= 0.05)
    .sort((a, b) => Math.abs(b.ratioDelta ?? 0) - Math.abs(a.ratioDelta ?? 0))
    .slice(0, 3)

  const lines: string[] = []
  lines.push('**Daily AlfaClub Brief**')
  lines.push(`Snapshot: ${params.snapshotTs}`)
  if (params.previousSnapshotTs) lines.push(`Compared with: ${params.previousSnapshotTs}`)
  lines.push('')
  lines.push('**Majors**')
  for (const row of params.marketRows) {
    lines.push(`- ${row.symbol} ${formatUsd(row.priceUsd)} (${formatPct(row.change24hPct)})`)
  }
  lines.push('')
  lines.push('**AlfaClub pulse**')
  lines.push(`- creators tracked: ${params.creatorsTracked.toLocaleString('en-US')}`)
  lines.push(`- ranked this snapshot: ${params.currentRows.length.toLocaleString('en-US')}`)
  lines.push(`- new creators vs prior snapshot: ${newCreators.toLocaleString('en-US')}`)
  lines.push(`- active creators in last 24h: ${activeCreators24h.toLocaleString('en-US')}`)
  lines.push(`- publications in last 24h: ${pubs24h.length.toLocaleString('en-US')}`)
  lines.push('')
  lines.push(`**Top ${params.topRows} leaderboard**`)
  for (const row of params.currentRows.slice(0, params.topRows)) {
    lines.push(
      appendCreatorRoomLink(
        `- #${row.rank} ${creatorIdentity(row, params.labels)} — score ${formatScore(row.score)} · supply ${row.totalSupply.toString()} · staked ${row.stakedSupply.toString()}`,
        row.creatorAddress,
        params.roomIds,
      ),
    )
  }
  lines.push('')
  lines.push('**Actionable breakouts**')
  for (const delta of movers) {
    lines.push(
      appendCreatorRoomLink(
        `- #${delta.current.rank} ${creatorIdentity(delta.current, params.labels)} — ${formatRankDelta(delta.rankDelta)} · score ${delta.scoreDelta === null ? 'new' : `${delta.scoreDelta > 0 ? '+' : ''}${delta.scoreDelta.toFixed(3)}`} · supply ${delta.current.totalSupply.toString()}`,
        delta.current.creatorAddress,
        params.roomIds,
      ),
    )
  }
  if (downside.length > 0) {
    lines.push('')
    lines.push('**Risks / breakdowns**')
    for (const delta of downside) {
      lines.push(
        appendCreatorRoomLink(
          `- #${delta.current.rank} ${creatorIdentity(delta.current, params.labels)} — ${formatRankDelta(delta.rankDelta)} · score ${delta.scoreDelta === null ? 'n/a' : `${delta.scoreDelta > 0 ? '+' : ''}${delta.scoreDelta.toFixed(3)}`} · pnl ${formatUsd(delta.current.pnl30dUsd)}`,
          delta.current.creatorAddress,
          params.roomIds,
        ),
      )
    }
  }
  if (stakeShifts.length > 0) {
    lines.push('')
    lines.push('**Positioning shifts (staked ratio)**')
    for (const entry of stakeShifts) {
      lines.push(
        appendCreatorRoomLink(
          `- #${entry.delta.current.rank} ${creatorIdentity(entry.delta.current, params.labels)} — now ${formatRatioPct(entry.nowRatio)} (${formatRatioDeltaPct(entry.ratioDelta)})`,
          entry.delta.current.creatorAddress,
          params.roomIds,
        ),
      )
    }
  }
  if (entrantRows.length > 0) {
    lines.push('')
    lines.push(`**New top-${params.topRows} entrants**`)
    for (const row of entrantRows) {
      lines.push(
        appendCreatorRoomLink(
          `- #${row.rank} ${creatorIdentity(row, params.labels)} — score ${formatScore(row.score)}`,
          row.creatorAddress,
          params.roomIds,
        ),
      )
    }
  }
  if (exitRows.length > 0) {
    lines.push('')
    lines.push(`**Dropped from top-${params.topRows}**`)
    for (const row of exitRows) {
      lines.push(
        appendCreatorRoomLink(
          `- was #${row.rank} ${creatorIdentity(row, params.labels)} — score ${formatScore(row.score)}`,
          row.creatorAddress,
          params.roomIds,
        ),
      )
    }
  }
  lines.push('')
  lines.push('**Watch next (24h)**')
  lines.push('- Track whether breakout names hold rank after the next snapshot (avoid one-tick noise).')
  lines.push('- Watch downside names for follow-through in both score and staked ratio.')
  lines.push('- Prioritize entrants that keep top-rank position for 2+ snapshots before treating as regime change.')
  lines.push('')
  lines.push('**Read**')
  lines.push(
    buildNarrative({
      deltas,
      newCreators,
      activeCreators24h,
      publications24h: pubs24h.length,
      topRows: params.topRows,
    }),
  )
  return lines.join('\n')
}

export async function runAlfaClubDailyBrief(params: {
  flags?: DailyBriefFlags
} = {}): Promise<AlfaClubDailyBriefResult> {
  const flags = params.flags ?? readAlfaClubDailyBriefFlags()
  if (!flags.enabled) {
    return {
      ok: false,
      reason: 'disabled',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      roomId: flags.roomId,
      lane: null,
      messageText: null,
    }
  }

  await ensureDailyBriefSchema()
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return {
      ok: false,
      reason: 'no_snapshot',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      roomId: flags.roomId,
      lane: null,
      messageText: null,
    }
  }

  const timestamps = await listRecentSnapshotTimestamps(2)
  const previousSnapshotTs = timestamps.find((ts) => ts !== snapshotTs) ?? null
  const key = dispatchKey({ snapshotTs, roomId: flags.roomId })
  if (!flags.forceSend && (await hasDailyBriefDispatch(key))) {
    return {
      ok: true,
      snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: true,
      roomId: flags.roomId,
      lane: null,
      messageText: null,
    }
  }

  const [currentRows, previousRows, creators, recentPublications, marketRows] = await Promise.all([
    getSnapshotAt(snapshotTs),
    previousSnapshotTs ? getSnapshotAt(previousSnapshotTs) : Promise.resolve([]),
    listAllCreators(),
    listRecentPublications(null, DEFAULT_RECENT_PUBLICATIONS_LIMIT),
    fetchMajorTokenPrices(flags.marketTimeoutMs),
  ])
  if (currentRows.length === 0) {
    return {
      ok: false,
      reason: 'empty_snapshot',
      snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: false,
      roomId: flags.roomId,
      lane: null,
      messageText: null,
    }
  }

  const labels = await readCreatorLabels(currentRows.map((row) => row.creatorAddress))
  const addressSet = new Set<string>()
  for (const row of currentRows) addressSet.add(row.creatorAddress)
  for (const row of previousRows) addressSet.add(row.creatorAddress)
  const roomIds = await loadCreatorRoomIdByCoinAddress([...addressSet])
  const messageText = buildBriefText({
    snapshotTs,
    previousSnapshotTs,
    currentRows,
    previousRows,
    creatorsTracked: creators.length > 0 ? creators.length : currentRows.length,
    recentPublications,
    marketRows,
    topRows: flags.topRows,
    moverRows: flags.moverRows,
    labels,
    roomIds,
  })
  const send = await sendAlfaClubRoomText({
    text: messageText,
    roomId: flags.roomId,
    flags: readAlfaClubChatBridgeFlags(),
  })
  await recordDailyBriefDispatch({
    key,
    snapshotTs,
    previousSnapshotTs,
    roomId: flags.roomId,
    messageText,
  })
  return {
    ok: true,
    snapshotTs,
    previousSnapshotTs,
    sent: true,
    skippedDuplicate: false,
    roomId: flags.roomId,
    lane: send.lane,
    messageText,
  }
}
