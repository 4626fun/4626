import { createHash } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import { ensureAlfaclubDailyBriefSchema } from '../db/schemaBootstrap.js'
import { listAllCreators } from './creators.js'
import {
  readCreatorLabels,
  type CreatorLabelMap,
} from './creatorDisplayLabels.js'
import {
  getLatestSnapshotTs,
  getSnapshotAt,
  listRecentPublications,
  type MetricsSnapshotRow,
  type PublicationRecord,
} from './publicationLedger.js'
import { readAlfaClubChatBridgeFlags, sendAlfaClubRoomText } from './chatBridge.js'
import {
  formatAlfaClubBriefOpsRoomFooter,
  formatCreatorRoomLink,
  resolveCreatorRoomLinks,
} from './creatorRoomLinks.js'
import {
  readAutoSyncRoomPoliciesEnabled,
  syncCreatorRoomPoliciesFromSnapshot,
} from './roomPolicySync.js'
import { readScoredProliquidSignalsForRoom } from './proliquidSignals.js'
import { getClearinghouseState } from './hyperliquid.js'
import {
  ALFACLUB_API_COMMON_BROWSER_HEADERS,
  readAlfaClubApiAuthFlags,
} from './apiAuth.js'
import { resolveRoom1659MarketContext, resolveRoom1659HyperliquidPortfolioUser } from './room1659Market.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ROOM_ID = '1043'
const DEFAULT_MARKET_TIMEOUT_MS = 12_000
const DEFAULT_TOP_ROWS = 5
const DEFAULT_MOVER_ROWS = 5
const DEFAULT_MAJOR_ROWS = 6
const DEFAULT_RECENT_PUBLICATIONS_LIMIT = 500
const DEFAULT_HYPERCORE_SYMBOL_LIMIT = 8
const DEFAULT_HYPERCORE_LOOKBACK_HOURS = 24
const DEFAULT_PROLIQUID_LOOKBACK_HOURS = 24
const DEFAULT_PROLIQUID_SAMPLE_LIMIT = 200
const DEFAULT_HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info'
const SCORE_MOVE_EPSILON = 0.005
const MAX_MOVE_LINES = 6

type DailyBriefFlags = {
  enabled: boolean
  roomId: string
  topRows: number
  moverRows: number
  majorRows: number
  compact: boolean
  forceSend: boolean
  marketTimeoutMs: number
  hyperCoreEnabled: boolean
  hyperCoreInfoUrl: string
  hyperCoreSymbolLimit: number
  hyperCoreLookbackHours: number
  proliquidLookbackHours: number
  proliquidSampleLimit: number
}

type MarketRow = {
  symbol: string
  priceUsd: number | null
  change24hPct: number | null
}

type HyperCoreAssetContext = {
  symbol: string
  priceUsd: number | null
  change24hPct: number | null
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
}

type HyperCoreExecutionRow = {
  symbol: string
  spreadBps: number | null
  topBidDepthUsd: number | null
  topAskDepthUsd: number | null
}

type HyperCoreMarketBrief = {
  watchlist: HyperCoreAssetContext[]
  regimeLine: string
  execution: HyperCoreExecutionRow[]
  unavailableReason: string | null
}

type ProliquidSignalPressureSummary = {
  scoredCount: number
  highConfidenceCount: number
  byKind: Array<{ kind: string; count: number }>
  topSignals: Array<{ kind: string; confidence: string; scoreValue: number | null }>
} | null

type RoomEconomicsOpenPosition = {
  coin: string
  side: 'long' | 'short' | null
  notionalUsd: number | null
  entryPx: number | null
  unrealizedPnlUsd: number | null
  liquidationPx: number | null
  leverage: number | null
}

type RoomEconomicsBrief = {
  roomId: string
  portfolioUser: string
  accountValueUsd: number | null
  withdrawableUsd: number | null
  totalNotionalUsd: number | null
  totalNotionalIncludingAkitaUsd: number | null
  openPositions: RoomEconomicsOpenPosition[]
  akitaAmount: number | null
  akitaAvgBuyPriceUsd: number | null
  akitaCostBasisUsd: number | null
  akitaEstimatedValueUsd: number | null
  combinedValueUsd: number | null
  roomKeySupply: number | null
  impliedPayoutPerKeyUsd: number | null
} | null

type SnapshotDelta = {
  current: MetricsSnapshotRow
  previous: MetricsSnapshotRow | null
  rankDelta: number | null
  scoreDelta: number | null
  isNew: boolean
}


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

export function resolveAlfaClubBridgeRoomId(): string {
  return normalizeRoomId(process.env.ALFACLUB_CHAT_ROOM_ID) ?? DEFAULT_ROOM_ID
}

export function resolveExplicitDailyBriefRoomId(): string | null {
  return normalizeRoomId(process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID)
}

export function resolveDailyBriefRoomId(): string {
  return resolveExplicitDailyBriefRoomId() ?? listDailyBriefCommandRoomIds()[0] ?? resolveAlfaClubBridgeRoomId()
}

/** Rooms that receive the scheduled daily digest (explicit brief room, else all command rooms). */
export function listDailyBriefPostRoomIds(
  bridgeFlags: Pick<
    ReturnType<typeof readAlfaClubChatBridgeFlags>,
    'roomId' | 'hermitCommandRoomIds'
  > = readAlfaClubChatBridgeFlags(),
): string[] {
  const explicit = resolveExplicitDailyBriefRoomId()
  if (explicit) return [explicit]
  return listDailyBriefCommandRoomIds(bridgeFlags)
}

/** Command rooms the bot operates in (`ALFACLUB_HERMIT_COMMAND_ROOMS`, else bridge room). */
export function listDailyBriefCommandRoomIds(
  bridgeFlags: Pick<
    ReturnType<typeof readAlfaClubChatBridgeFlags>,
    'roomId' | 'hermitCommandRoomIds'
  > = readAlfaClubChatBridgeFlags(),
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  const push = (raw: string | null | undefined) => {
    const id = normalizeRoomId(raw)
    if (!id || seen.has(id)) return
    seen.add(id)
    ordered.push(id)
  }
  if (bridgeFlags.hermitCommandRoomIds.length > 0) {
    for (const id of bridgeFlags.hermitCommandRoomIds) push(id)
  } else {
    push(bridgeFlags.roomId ?? resolveAlfaClubBridgeRoomId())
  }
  if (ordered.length > 0) return ordered
  return [DEFAULT_ROOM_ID]
}

/** @deprecated Use listDailyBriefPostRoomIds */
export const listDailyBriefPostRoomCandidates = listDailyBriefPostRoomIds

export type DailyBriefPostedRoom = {
  roomId: string
  lane: string
  messageText: string
}

export async function sendDailyBriefToCommandRooms(params: {
  text: string
  flags?: ReturnType<typeof readAlfaClubChatBridgeFlags>
}): Promise<{ posted: DailyBriefPostedRoom[]; commandRoomIds: string[] }> {
  const flags = params.flags ?? readAlfaClubChatBridgeFlags()
  const commandRoomIds = listDailyBriefPostRoomIds(flags)
  const posted: DailyBriefPostedRoom[] = []
  let lastError: unknown = null

  for (const roomId of commandRoomIds) {
    let messageText = params.text
    const opsFooter = formatAlfaClubBriefOpsRoomFooter(roomId)
    if (opsFooter) {
      messageText = `${messageText}\n\n${opsFooter}`
    }
    try {
      const send = await sendAlfaClubRoomText({ text: messageText, roomId, flags })
      posted.push({ roomId, lane: send.lane, messageText })
    } catch (error) {
      lastError = error
    }
  }

  if (posted.length === 0) {
    const message =
      lastError instanceof Error ? lastError.message.slice(0, 120) : 'daily_brief_no_reachable_room'
    throw new Error(message)
  }

  return { posted, commandRoomIds }
}

/** @deprecated Prefer sendDailyBriefToCommandRooms */
export async function sendDailyBriefToReachableRoom(params: {
  text: string
  flags?: ReturnType<typeof readAlfaClubChatBridgeFlags>
}): Promise<{ roomId: string; lane: string; candidates: string[]; messageText: string }> {
  const result = await sendDailyBriefToCommandRooms(params)
  const first = result.posted[0]
  return {
    roomId: first.roomId,
    lane: first.lane,
    candidates: result.commandRoomIds,
    messageText: first.messageText,
  }
}

/** @deprecated Separate digest room is retired — digest posts to command rooms only. */
export function readAlfaClubDailyBriefSeparateFromBridge(): boolean {
  return false
}

export function hasExplicitDailyBriefRoomId(): boolean {
  return resolveExplicitDailyBriefRoomId() !== null
}

export function isDailyBriefRoomSameAsBridgeRoom(briefRoomId: string): boolean {
  return briefRoomId === resolveAlfaClubBridgeRoomId()
}

export function readAlfaClubDailyBriefFlags(): DailyBriefFlags {
  const infoUrl = (process.env.ALFACLUB_DAILY_BRIEF_HYPERCORE_INFO_URL ?? '').trim()
  return {
    enabled: parseBool(process.env.ALFACLUB_DAILY_BRIEF_ENABLED ?? '1'),
    roomId: resolveDailyBriefRoomId(),
    topRows: parsePositiveInt(process.env.ALFACLUB_DAILY_BRIEF_TOP_ROWS, DEFAULT_TOP_ROWS, 10),
    moverRows: parsePositiveInt(process.env.ALFACLUB_DAILY_BRIEF_MOVER_ROWS, DEFAULT_MOVER_ROWS, 10),
    majorRows: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_MAJOR_ROWS,
      DEFAULT_MAJOR_ROWS,
      20,
    ),
    compact: parseBool(process.env.ALFACLUB_DAILY_BRIEF_COMPACT ?? '1'),
    forceSend: parseBool(process.env.ALFACLUB_DAILY_BRIEF_FORCE_SEND),
    marketTimeoutMs: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_MARKET_TIMEOUT_MS,
      DEFAULT_MARKET_TIMEOUT_MS,
      30_000,
    ),
    hyperCoreEnabled: parseBool(process.env.ALFACLUB_DAILY_BRIEF_HYPERCORE_ENABLED ?? '1'),
    hyperCoreInfoUrl: infoUrl.length > 0 ? infoUrl : DEFAULT_HYPERLIQUID_INFO_URL,
    hyperCoreSymbolLimit: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_HYPERCORE_SYMBOL_LIMIT,
      DEFAULT_HYPERCORE_SYMBOL_LIMIT,
      20,
    ),
    hyperCoreLookbackHours: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_HYPERCORE_LOOKBACK_HOURS,
      DEFAULT_HYPERCORE_LOOKBACK_HOURS,
      168,
    ),
    proliquidLookbackHours: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_PROLIQUID_LOOKBACK_HOURS,
      DEFAULT_PROLIQUID_LOOKBACK_HOURS,
      168,
    ),
    proliquidSampleLimit: parsePositiveInt(
      process.env.ALFACLUB_DAILY_BRIEF_PROLIQUID_SAMPLE_LIMIT,
      DEFAULT_PROLIQUID_SAMPLE_LIMIT,
      500,
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

function normalizeRoomId(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  return /^\d+$/.test(value) ? value : null
}

async function ensureDailyBriefSchema(): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await ensureAlfaclubDailyBriefSchema(db as any)
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

async function hasDailyBriefDispatchForSnapshot(snapshotTs: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    const result = await db.sql`
      SELECT 1
      FROM alfaclub.daily_brief_dispatch
      WHERE snapshot_ts = ${snapshotTs}
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

function formatUsdReadable(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1000) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (abs >= 1) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (abs >= 0.01) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
  if (abs >= 0.0001) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 8 })}`
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

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

async function postHyperliquidInfo(params: {
  infoUrl: string
  payload: Record<string, unknown>
  timeoutMs: number
}): Promise<unknown | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    const response = await fetch(params.infoUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(params.payload),
    })
    if (!response.ok) return null
    const body = (await response.json()) as unknown
    return body
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function parseMetaAndAssetContexts(raw: unknown): HyperCoreAssetContext[] {
  if (!Array.isArray(raw) || raw.length < 2) return []
  const meta = raw[0] as { universe?: Array<{ name?: string }> } | null
  const ctxs = Array.isArray(raw[1]) ? raw[1] : []
  const universe = Array.isArray(meta?.universe) ? meta.universe : []
  return universe
    .map((asset, index) => {
      const symbol = String(asset?.name ?? '').trim()
      if (!symbol) return null
      const ctx = (ctxs[index] ?? {}) as Record<string, unknown>
      const markPx = parseNumber(ctx.markPx) ?? parseNumber(ctx.midPx)
      const prevDayPx = parseNumber(ctx.prevDayPx)
      const change24hPct =
        markPx != null && prevDayPx != null && prevDayPx > 0
          ? ((markPx - prevDayPx) / prevDayPx) * 100
          : null
      const volume24hUsd = parseNumber(ctx.dayNtlVlm) ?? parseNumber(ctx.dayBaseVlm)
      const openInterestUsd = parseNumber(ctx.openInterest)
      const fundingRate = parseNumber(ctx.funding)
      return {
        symbol,
        priceUsd: markPx,
        change24hPct,
        fundingRate,
        openInterestUsd,
        volume24hUsd,
      } satisfies HyperCoreAssetContext
    })
    .filter((row): row is HyperCoreAssetContext => Boolean(row))
}

function pickMarketRowsFromWatchlist(rows: HyperCoreAssetContext[], majorRows: number): MarketRow[] {
  return rows.slice(0, majorRows).map((row) => ({
    symbol: row.symbol,
    priceUsd: row.priceUsd,
    change24hPct: row.change24hPct,
  }))
}

function buildHyperCoreRegimeLine(rows: HyperCoreAssetContext[]): string {
  if (rows.length === 0) return 'Regime unavailable (no HyperCore context rows).'
  const withChange = rows.filter((row) => row.change24hPct !== null)
  const upCount = withChange.filter((row) => (row.change24hPct ?? 0) > 0).length
  const breadthPct = withChange.length > 0 ? (upCount / withChange.length) * 100 : null
  const avgFunding = rows
    .map((row) => row.fundingRate)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const avgFundingRate =
    avgFunding.length > 0 ? avgFunding.reduce((sum, value) => sum + value, 0) / avgFunding.length : null
  const riskLabel =
    breadthPct == null
      ? 'mixed'
      : breadthPct >= 60
        ? 'risk-on'
        : breadthPct <= 40
          ? 'risk-off'
          : 'range'
  const breadthLabel = breadthPct == null ? 'n/a' : `${breadthPct.toFixed(0)}% up`
  const fundingLabel =
    avgFundingRate == null ? 'funding n/a' : `avg funding ${avgFundingRate >= 0 ? '+' : ''}${(avgFundingRate * 100).toFixed(3)}%`
  return `Regime: ${riskLabel} · breadth ${breadthLabel} · ${fundingLabel}`
}

function parseL2ExecutionRow(symbol: string, raw: unknown): HyperCoreExecutionRow {
  if (!raw || typeof raw !== 'object') {
    return { symbol, spreadBps: null, topBidDepthUsd: null, topAskDepthUsd: null }
  }
  const levels = (raw as { levels?: unknown }).levels
  if (!Array.isArray(levels) || levels.length < 2) {
    return { symbol, spreadBps: null, topBidDepthUsd: null, topAskDepthUsd: null }
  }
  const bids = Array.isArray(levels[0]) ? levels[0] : []
  const asks = Array.isArray(levels[1]) ? levels[1] : []
  const bestBid = (bids[0] ?? {}) as Record<string, unknown>
  const bestAsk = (asks[0] ?? {}) as Record<string, unknown>
  const bidPx = parseNumber(bestBid.px)
  const askPx = parseNumber(bestAsk.px)
  const bidSz = parseNumber(bestBid.sz)
  const askSz = parseNumber(bestAsk.sz)
  const mid = bidPx != null && askPx != null ? (bidPx + askPx) / 2 : null
  const spreadBps =
    mid != null && bidPx != null && askPx != null && mid > 0
      ? ((askPx - bidPx) / mid) * 10_000
      : null
  return {
    symbol,
    spreadBps,
    topBidDepthUsd: bidPx != null && bidSz != null ? bidPx * bidSz : null,
    topAskDepthUsd: askPx != null && askSz != null ? askPx * askSz : null,
  }
}

async function buildHyperCoreMarketBrief(params: {
  flags: DailyBriefFlags
  majorRows: number
}): Promise<{ marketRows: MarketRow[]; hyperCore: HyperCoreMarketBrief }> {
  if (!params.flags.hyperCoreEnabled) {
    return {
      marketRows: [],
      hyperCore: {
        watchlist: [],
        regimeLine: 'HyperCore brief disabled by ALFACLUB_DAILY_BRIEF_HYPERCORE_ENABLED.',
        execution: [],
        unavailableReason: 'disabled',
      },
    }
  }

  const metaCtxRaw = await postHyperliquidInfo({
    infoUrl: params.flags.hyperCoreInfoUrl,
    payload: { type: 'metaAndAssetCtxs' },
    timeoutMs: params.flags.marketTimeoutMs,
  })
  const allMidsRaw = await postHyperliquidInfo({
    infoUrl: params.flags.hyperCoreInfoUrl,
    payload: { type: 'allMids' },
    timeoutMs: params.flags.marketTimeoutMs,
  })

  const contextRows = parseMetaAndAssetContexts(metaCtxRaw)
  const mids = allMidsRaw && typeof allMidsRaw === 'object' ? (allMidsRaw as Record<string, unknown>) : {}
  for (const row of contextRows) {
    if (row.priceUsd === null) {
      row.priceUsd = parseNumber(mids[row.symbol])
    }
  }

  const ranked = [...contextRows]
    .map((row) => {
      const momentum = Math.abs(row.change24hPct ?? 0)
      const volumeScore =
        row.volume24hUsd != null && row.volume24hUsd > 0 ? Math.log10(row.volume24hUsd + 1) : 0
      const oiScore = row.openInterestUsd != null && row.openInterestUsd > 0 ? Math.log10(row.openInterestUsd + 1) : 0
      return { row, score: momentum * 1.2 + volumeScore + oiScore * 0.6 }
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row)

  const watchlist = ranked.slice(0, Math.min(params.flags.hyperCoreSymbolLimit, params.majorRows))
  const executionRaw = await Promise.all(
    watchlist.map((row) =>
      postHyperliquidInfo({
        infoUrl: params.flags.hyperCoreInfoUrl,
        payload: { type: 'l2Book', coin: row.symbol },
        timeoutMs: params.flags.marketTimeoutMs,
      }),
    ),
  )
  const execution = watchlist.map((row, index) => parseL2ExecutionRow(row.symbol, executionRaw[index]))
  const unavailableReason =
    watchlist.length === 0 ? 'no_hypercore_rows' : null

  return {
    marketRows: pickMarketRowsFromWatchlist(watchlist, params.majorRows),
    hyperCore: {
      watchlist,
      regimeLine: buildHyperCoreRegimeLine(contextRows),
      execution,
      unavailableReason,
    },
  }
}

async function buildProliquidSignalPressureSummary(params: {
  roomId: string
  lookbackHours: number
  limit: number
}): Promise<ProliquidSignalPressureSummary> {
  const startTimeMs = Date.now() - params.lookbackHours * 60 * 60 * 1000
  const rows = await readScoredProliquidSignalsForRoom({
    roomId: params.roomId,
    startTimeMs,
    limit: params.limit,
  })
  if (rows.length === 0) return null
  const byKindMap = new Map<string, number>()
  let highConfidenceCount = 0
  for (const row of rows) {
    const kind = String(row.signal_kind ?? 'unknown')
    byKindMap.set(kind, (byKindMap.get(kind) ?? 0) + 1)
    if (String(row.score_confidence ?? '').toLowerCase() === 'high') highConfidenceCount += 1
  }
  const byKind = [...byKindMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => ({ kind, count }))
  const topSignals = [...rows]
    .sort((a, b) => (b.score_value ?? 0) - (a.score_value ?? 0))
    .slice(0, 3)
    .map((row) => ({
      kind: String(row.signal_kind ?? 'unknown'),
      confidence: String(row.score_confidence ?? 'n/a'),
      scoreValue: row.score_value,
    }))
  return {
    scoredCount: rows.length,
    highConfidenceCount,
    byKind,
    topSignals,
  }
}

async function fetchRoomSpotPositions(roomId: string): Promise<Array<Record<string, unknown>>> {
  const flags = readAlfaClubApiAuthFlags()
  const token = flags.readBotToken || flags.botToken
  if (!token) return []
  const endpoint = new URL(`/api/spot/positions?roomId=${encodeURIComponent(roomId)}`, flags.apiBaseUrl)
  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        accept: 'application/json',
        ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) return []
    const body = (await response.json()) as { positions?: Array<Record<string, unknown>> } | null
    return Array.isArray(body?.positions) ? body.positions : []
  } catch {
    return []
  }
}

async function buildRoomEconomicsBrief(params: { roomId: string }): Promise<RoomEconomicsBrief> {
  if (params.roomId !== '1659') return null

  const portfolioUser = resolveRoom1659HyperliquidPortfolioUser()
  const [hlState, spotPositions, room1659Context] = await Promise.all([
    getClearinghouseState(portfolioUser),
    fetchRoomSpotPositions(params.roomId),
    resolveRoom1659MarketContext(portfolioUser).catch(() => null),
  ])

  const openPositions: RoomEconomicsOpenPosition[] = Array.isArray(hlState?.assetPositions)
    ? hlState.assetPositions.map((row) => ({
        coin: String(row?.coin ?? '').trim() || 'unknown',
        side:
          row?.side === 'long' || row?.side === 'short'
            ? row.side
            : null,
        notionalUsd: parseNumber(row?.positionValue),
        entryPx: parseNumber(row?.entryPx),
        unrealizedPnlUsd: parseNumber(row?.unrealizedPnl),
        liquidationPx: parseNumber(row?.liquidationPx),
        leverage: parseNumber(row?.leverage),
      }))
    : []

  const akitaPosition = spotPositions.find((row) => {
    const tokenAddress = String(row.tokenAddress ?? '').toLowerCase()
    const symbol = String(row.tokenSymbol ?? '').toLowerCase()
    return tokenAddress === '0x5b674196812451b7cec024fe9d22d2c0b172fa75' || symbol === 'akita'
  })
  const akitaAmount = parseNumber(akitaPosition?.amount)
  const akitaAvgBuyPriceUsd = parseNumber(akitaPosition?.avgBuyPrice)
  const akitaCostBasisUsd = parseNumber(akitaPosition?.totalInvested)
  const akitaEstimatedValueUsd =
    akitaAmount != null && akitaAvgBuyPriceUsd != null ? akitaAmount * akitaAvgBuyPriceUsd : null

  const accountValueUsd = parseNumber(hlState?.accountValueUsd)
  const withdrawableUsd = parseNumber(hlState?.withdrawableUsd)
  const totalNotionalUsd = parseNumber(hlState?.totalNtlPosUsd)
  const totalNotionalIncludingAkitaUsd =
    totalNotionalUsd != null && akitaEstimatedValueUsd != null
      ? totalNotionalUsd + akitaEstimatedValueUsd
      : null
  const combinedValueUsd =
    accountValueUsd != null && akitaEstimatedValueUsd != null ? accountValueUsd + akitaEstimatedValueUsd : null
  const roomKeySupply = parseNumber(room1659Context?.onchain?.totalSupply?.toString?.())
  const impliedPayoutPerKeyUsd =
    combinedValueUsd != null && roomKeySupply != null && roomKeySupply > 0
      ? combinedValueUsd / roomKeySupply
      : null

  return {
    roomId: params.roomId,
    portfolioUser,
    accountValueUsd,
    withdrawableUsd,
    totalNotionalUsd,
    totalNotionalIncludingAkitaUsd,
    openPositions,
    akitaAmount,
    akitaAvgBuyPriceUsd,
    akitaCostBasisUsd,
    akitaEstimatedValueUsd,
    combinedValueUsd,
    roomKeySupply,
    impliedPayoutPerKeyUsd,
  }
}

export function formatIndexedScopeLine(params: {
  creatorsTracked: number
  rankedCount: number
  newCreators: number
  activeCreators24h: number
}): string {
  const base = `${params.creatorsTracked.toLocaleString('en-US')} FriendKey creators indexed · ${params.rankedCount.toLocaleString('en-US')} scored this snapshot`
  const tail = `${params.newCreators} new vs prior · ${params.activeCreators24h} active (24h)`
  const partial =
    params.rankedCount > 0 && params.rankedCount < params.creatorsTracked
      ? ' (partial leaderboard — not every indexed creator is rescored each run)'
      : ''
  return `${base}${partial} · ${tail}. Score is a 0–1 composite (staking depth, key supply, recent activity).`
}

function formatBriefSnapshotDate(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function buildSnapshotFreshnessLine(snapshotTs: string): string | null {
  const parsed = Date.parse(snapshotTs)
  if (!Number.isFinite(parsed)) return null
  const ageMs = Date.now() - parsed
  if (!Number.isFinite(ageMs) || ageMs < 36 * 60 * 60 * 1000) return null
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
  return `Snapshot freshness: stale (${ageDays} day${ageDays === 1 ? '' : 's'} old).`
}

function formatUsdCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  if (value >= 1) return `$${value.toFixed(0)}`
  if (value >= 0.01) return `$${value.toFixed(2)}`
  return `$${value.toExponential(1)}`
}

function formatSupplyCount(value: bigint): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value.toString()
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return n.toLocaleString('en-US')
}

function hasMeaningfulScoreMove(delta: SnapshotDelta): boolean {
  if (delta.isNew) return true
  if (delta.rankDelta !== null && delta.rankDelta !== 0) return true
  if (delta.scoreDelta === null) return false
  return Math.abs(delta.scoreDelta) >= SCORE_MOVE_EPSILON
}

function formatCompactRankLine(
  row: MetricsSnapshotRow,
  labels: CreatorLabelMap,
  roomIds: Map<string, string>,
): string {
  const stake = formatRatioPct(stakeRatio(row))
  const roomUrl = formatCreatorRoomLink(row.creatorAddress, roomIds)
  const core = `${row.rank}. ${creatorIdentity(row, labels)} — score ${formatScore(row.score)} · ${stake} of keys staked · ${formatSupplyCount(row.totalSupply)} keys`
  return roomUrl ? `${core}\n   ${roomUrl}` : core
}

function buildCompactMoveLines(params: {
  deltas: SnapshotDelta[]
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  topRows: number
  labels: CreatorLabelMap
  roomIds: Map<string, string>
}): string[] {
  const lines: string[] = []
  const previousTopSet = new Set(
    params.previousRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()),
  )
  const currentTopSet = new Set(
    params.currentRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()),
  )

  const entrants = params.currentRows
    .filter((row) => row.rank <= params.topRows && !previousTopSet.has(row.creatorAddress.toLowerCase()))
    .slice(0, 3)
  for (const row of entrants) {
    lines.push(
      appendCreatorRoomLink(
        `↑ entered top-${params.topRows}: ${creatorIdentity(row, params.labels)} (${formatScore(row.score)})`,
        row.creatorAddress,
        params.roomIds,
      ),
    )
  }

  const exits = params.previousRows
    .filter((row) => row.rank <= params.topRows && !currentTopSet.has(row.creatorAddress.toLowerCase()))
    .slice(0, 3)
  for (const row of exits) {
    lines.push(
      appendCreatorRoomLink(
        `↓ dropped top-${params.topRows}: was #${row.rank} ${creatorIdentity(row, params.labels)}`,
        row.creatorAddress,
        params.roomIds,
      ),
    )
  }

  const scoreMovers = [...params.deltas]
    .filter((delta) => hasMeaningfulScoreMove(delta))
    .filter((delta) => !entrants.some((row) => row.creatorAddress === delta.current.creatorAddress))
    .filter((delta) => !exits.some((row) => row.creatorAddress === delta.current.creatorAddress))
    .sort((a, b) => Math.abs(b.scoreDelta ?? 0) - Math.abs(a.scoreDelta ?? 0))
    .slice(0, 3)

  for (const delta of scoreMovers) {
    const scorePart =
      delta.scoreDelta === null
        ? 'new to board'
        : `score ${delta.scoreDelta > 0 ? '+' : ''}${delta.scoreDelta.toFixed(3)}`
    lines.push(
      appendCreatorRoomLink(
        `• ${creatorIdentity(delta.current, params.labels)} — ${formatRankDelta(delta.rankDelta)} · ${scorePart}`,
        delta.current.creatorAddress,
        params.roomIds,
      ),
    )
  }

  return lines.slice(0, MAX_MOVE_LINES)
}

function buildCompactLeadSummary(params: {
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  topRows: number
  labels: CreatorLabelMap
  entrantCount: number
  exitCount: number
  newCreators: number
}): string {
  const leader = params.currentRows[0]
  if (!leader) return 'No ranked creators in this snapshot yet.'

  const previousLeader = params.previousRows[0]
  const leaderLabel = creatorIdentity(leader, params.labels)
  const parts: string[] = [`${leaderLabel} leads at score ${formatScore(leader.score)}`]

  if (previousLeader && previousLeader.creatorAddress !== leader.creatorAddress) {
    parts.push(
      `replacing ${creatorIdentity(previousLeader, params.labels)} from the prior snapshot`,
    )
  }

  if (params.entrantCount > 0 || params.exitCount > 0) {
    const churn: string[] = []
    if (params.entrantCount > 0) churn.push(`${params.entrantCount} new in top ${params.topRows}`)
    if (params.exitCount > 0) churn.push(`${params.exitCount} dropped out`)
    parts.push(churn.join(', '))
  } else if (params.newCreators > 0) {
    parts.push(`${params.newCreators} newly tracked creators joined the index`)
  } else {
    parts.push('top ranks held steady')
  }

  return parts.join(' · ') + '.'
}

function buildCompactNarrative(params: {
  deltas: SnapshotDelta[]
  labels: CreatorLabelMap
  newCreators: number
  activeCreators24h: number
  publications24h: number
  entrantCount: number
  exitCount: number
}): string {
  const parts: string[] = []
  if (params.publications24h > 0) {
    parts.push(`${params.publications24h} publication${params.publications24h === 1 ? '' : 's'} in the last 24h`)
  }
  if (params.activeCreators24h > 0 && params.publications24h === 0) {
    parts.push(`${params.activeCreators24h} creator${params.activeCreators24h === 1 ? '' : 's'} published recently`)
  }

  const biggestMover = [...params.deltas]
    .filter((delta) => delta.scoreDelta !== null && Math.abs(delta.scoreDelta) >= SCORE_MOVE_EPSILON)
    .sort((a, b) => Math.abs(b.scoreDelta ?? 0) - Math.abs(a.scoreDelta ?? 0))[0]

  if (biggestMover) {
    const delta = biggestMover.scoreDelta ?? 0
    parts.push(
      `Largest score swing: ${creatorIdentity(biggestMover.current, params.labels)} (${delta > 0 ? '+' : ''}${delta.toFixed(3)}, ${formatRankDelta(biggestMover.rankDelta)})`,
    )
  }

  if (parts.length === 0) {
    return params.newCreators > 0
      ? `${params.newCreators} new creators indexed since the last snapshot; ranks otherwise stable.`
      : 'Ranks and scores are broadly unchanged vs the prior snapshot.'
  }

  return parts.join(' · ') + '.'
}

function buildCompactBriefText(params: {
  snapshotTs: string
  previousSnapshotTs: string | null
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  creatorsTracked: number
  recentPublications: PublicationRecord[]
  marketRows: MarketRow[]
  hyperCore: HyperCoreMarketBrief
  proliquidSummary: ProliquidSignalPressureSummary
  roomEconomics: RoomEconomicsBrief
  topRows: number
  majorRows: number
  labels: CreatorLabelMap
  roomIds: Map<string, string>
}): string {
  const deltas = buildDeltas(params.currentRows, params.previousRows)
  const newCreators = deltas.filter((delta) => delta.isNew).length
  const pubs24h = params.recentPublications.filter((pub) => {
    const ts = Date.parse(pub.createdAt)
    return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000
  })
  const activeCreators24h = new Set(pubs24h.map((pub) => pub.creatorAddress.toLowerCase())).size

  const previousTopSet = new Set(
    params.previousRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()),
  )
  const currentTopSet = new Set(
    params.currentRows.slice(0, params.topRows).map((row) => row.creatorAddress.toLowerCase()),
  )
  const entrantCount = params.currentRows.filter(
    (row) => row.rank <= params.topRows && !previousTopSet.has(row.creatorAddress.toLowerCase()),
  ).length
  const exitCount = params.previousRows.filter(
    (row) => row.rank <= params.topRows && !currentTopSet.has(row.creatorAddress.toLowerCase()),
  ).length

  const lines: string[] = []
  const snapLabel = formatBriefSnapshotDate(params.snapshotTs)
  const prevLabel = params.previousSnapshotTs ? formatBriefSnapshotDate(params.previousSnapshotTs) : null
  lines.push(`**AlfaClub Daily** · ${snapLabel}${prevLabel ? ` vs ${prevLabel}` : ''}`)

  // Keep market context contiguous and first so the brief reads top-down.
  lines.push('')
  lines.push('**HyperCore**')
  lines.push(params.hyperCore.regimeLine)
  if (params.hyperCore.watchlist.length > 0) {
    const watchlistLine = params.hyperCore.watchlist
      .slice(0, params.majorRows)
      .map((row) => {
        const oi = row.openInterestUsd == null ? 'OI n/a' : `OI ${formatUsdCompact(row.openInterestUsd)}`
        const funding =
          row.fundingRate == null
            ? 'fund n/a'
            : `fund ${row.fundingRate >= 0 ? '+' : ''}${(row.fundingRate * 100).toFixed(3)}%`
        return `${row.symbol} ${formatUsdCompact(row.priceUsd)} (${formatPct(row.change24hPct)}) · ${oi} · ${funding}`
      })
      .join(' | ')
    lines.push(`Watchlist: ${watchlistLine}`)
  } else {
    lines.push('Watchlist: unavailable.')
  }
  if (params.hyperCore.execution.length > 0) {
    const executionLine = params.hyperCore.execution
      .slice(0, 4)
      .map((row) => {
        const spread = row.spreadBps == null ? 'spread n/a' : `spread ${row.spreadBps.toFixed(1)}bps`
        const depth =
          row.topBidDepthUsd == null || row.topAskDepthUsd == null
            ? 'depth n/a'
            : `depth ${formatUsdCompact(Math.min(row.topBidDepthUsd, row.topAskDepthUsd))}`
        return `${row.symbol} ${spread} · ${depth}`
      })
      .join(' | ')
    lines.push(`Execution: ${executionLine}`)
  }
  if (params.proliquidSummary) {
    const topKinds = params.proliquidSummary.byKind
      .slice(0, 3)
      .map((entry) => `${entry.kind}:${entry.count}`)
      .join(', ')
    const topSignals = params.proliquidSummary.topSignals
      .map((signal) => `${signal.kind}/${signal.confidence}${signal.scoreValue != null ? `:${signal.scoreValue}` : ''}`)
      .join(', ')
    lines.push(
      `Signal pressure (${params.proliquidSummary.scoredCount} scored, ${params.proliquidSummary.highConfidenceCount} high): ${topKinds || 'n/a'}${topSignals ? ` · top ${topSignals}` : ''}`,
    )
  } else {
    lines.push('Signal pressure: no recent ProLiquid scored signals.')
  }
  if (params.roomEconomics) {
    const room = params.roomEconomics
    lines.push(`Room economics (${room.roomId}):`)
    lines.push(
      `- HL notional ${formatUsdReadable(room.totalNotionalUsd)} · All-in notional ${formatUsdReadable(room.totalNotionalIncludingAkitaUsd)}`,
    )
    lines.push(
      `- Account ${formatUsdReadable(room.accountValueUsd)} · Withdrawable ${formatUsdReadable(room.withdrawableUsd)}`,
    )
    lines.push(
      `- AKITA ${room.akitaAmount == null ? 'n/a' : room.akitaAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} @ ${formatUsdReadable(room.akitaAvgBuyPriceUsd)} · Est ${formatUsdReadable(room.akitaEstimatedValueUsd)} · Cost ${formatUsdReadable(room.akitaCostBasisUsd)}`,
    )
    lines.push(`- Combined est ${formatUsdReadable(room.combinedValueUsd)}`)
    if (room.roomKeySupply != null) {
      lines.push(
        `- Key supply ${room.roomKeySupply.toLocaleString('en-US')} · Implied payout/key ${formatUsdReadable(room.impliedPayoutPerKeyUsd)}`,
      )
    }
    if (room.openPositions.length > 0) {
      lines.push('- Open positions:')
      const openLines = room.openPositions
        .slice(0, 3)
        .map((position) => {
          const side = position.side ? position.side.toUpperCase() : 'N/A'
          return `  • ${position.coin} ${side} ${formatUsdReadable(position.notionalUsd)} (uPnL ${formatUsdReadable(position.unrealizedPnlUsd)})`
        })
      lines.push(...openLines)
    }
  }

  lines.push('')
  lines.push('**AlfaClub creator flow**')
  lines.push(
    formatIndexedScopeLine({
      creatorsTracked: params.creatorsTracked,
      rankedCount: params.currentRows.length,
      newCreators,
      activeCreators24h,
    }),
  )
  lines.push(
    buildCompactLeadSummary({
      currentRows: params.currentRows,
      previousRows: params.previousRows,
      topRows: params.topRows,
      labels: params.labels,
      entrantCount,
      exitCount,
      newCreators,
    }),
  )
  lines.push('')
  lines.push(`**Top ${params.topRows}**`)
  for (const row of params.currentRows.slice(0, params.topRows)) {
    lines.push(formatCompactRankLine(row, params.labels, params.roomIds))
  }

  const moveLines = buildCompactMoveLines({
    deltas,
    currentRows: params.currentRows,
    previousRows: params.previousRows,
    topRows: params.topRows,
    labels: params.labels,
    roomIds: params.roomIds,
  })
  if (moveLines.length > 0) {
    lines.push('')
    lines.push('**Moves**')
    lines.push(...moveLines)
  }

  const narrative = buildCompactNarrative({
    deltas,
    labels: params.labels,
    newCreators,
    activeCreators24h,
    publications24h: pubs24h.length,
    entrantCount,
    exitCount,
  })
  lines.push('')
  lines.push(narrative)

  return lines.join('\n')
}

function buildLegacyNarrative(params: {
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

function buildLegacyBriefText(params: {
  snapshotTs: string
  previousSnapshotTs: string | null
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  creatorsTracked: number
  recentPublications: PublicationRecord[]
  marketRows: MarketRow[]
  hyperCore: HyperCoreMarketBrief
  proliquidSummary: ProliquidSignalPressureSummary
  roomEconomics: RoomEconomicsBrief
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
  lines.push('**HyperCore market intelligence**')
  lines.push(`- ${params.hyperCore.regimeLine}`)
  if (params.hyperCore.watchlist.length > 0) {
    lines.push('- Watchlist:')
    for (const row of params.hyperCore.watchlist.slice(0, 6)) {
      lines.push(
        `  • ${row.symbol} ${formatUsd(row.priceUsd)} (${formatPct(row.change24hPct)}) · OI ${formatUsd(row.openInterestUsd)} · volume ${formatUsd(row.volume24hUsd)}`,
      )
    }
  } else {
    lines.push('- Watchlist unavailable.')
  }
  if (params.hyperCore.execution.length > 0) {
    lines.push('- Execution quality:')
    for (const row of params.hyperCore.execution.slice(0, 6)) {
      lines.push(
        `  • ${row.symbol} spread ${row.spreadBps == null ? 'n/a' : `${row.spreadBps.toFixed(1)}bps`} · bid depth ${formatUsd(row.topBidDepthUsd)} · ask depth ${formatUsd(row.topAskDepthUsd)}`,
      )
    }
  }
  if (params.proliquidSummary) {
    const kinds = params.proliquidSummary.byKind
      .slice(0, 4)
      .map((entry) => `${entry.kind}:${entry.count}`)
      .join(', ')
    lines.push(
      `- ProLiquid signal pressure: ${params.proliquidSummary.scoredCount} scored (${params.proliquidSummary.highConfidenceCount} high confidence) · ${kinds || 'n/a'}`,
    )
  } else {
    lines.push('- ProLiquid signal pressure: no recent scored signals.')
  }
  if (params.roomEconomics) {
    const room = params.roomEconomics
    lines.push('- Room economics:')
    lines.push(
      `  • HL notional ${formatUsd(room.totalNotionalUsd)} · all-in notional ${formatUsd(room.totalNotionalIncludingAkitaUsd)}`,
    )
    lines.push(
      `  • account ${formatUsd(room.accountValueUsd)} · withdrawable ${formatUsd(room.withdrawableUsd)}`,
    )
    lines.push(
      `  • AKITA amount ${room.akitaAmount == null ? 'n/a' : room.akitaAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} @ avg ${formatUsd(room.akitaAvgBuyPriceUsd)} · est ${formatUsd(room.akitaEstimatedValueUsd)} · cost basis ${formatUsd(room.akitaCostBasisUsd)}`,
    )
    if (room.roomKeySupply != null) {
      lines.push(
        `  • implied distribution now: ${formatUsd(room.impliedPayoutPerKeyUsd)} per key (${room.roomKeySupply.toLocaleString('en-US')} keys, combined ${formatUsd(room.combinedValueUsd)})`,
      )
    } else {
      lines.push(`  • combined estimate: ${formatUsd(room.combinedValueUsd)}`)
    }
    if (room.openPositions.length > 0) {
      lines.push('  • Open positions:')
      for (const position of room.openPositions.slice(0, 4)) {
        const side = position.side ? position.side.toUpperCase() : 'N/A'
        lines.push(
          `    - ${position.coin} ${side} · size ${formatUsd(position.notionalUsd)} · entry ${formatUsd(position.entryPx)} · uPnL ${formatUsd(position.unrealizedPnlUsd)} · liq ${formatUsd(position.liquidationPx)}`,
        )
      }
    }
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
    buildLegacyNarrative({
      deltas,
      newCreators,
      activeCreators24h,
      publications24h: pubs24h.length,
      topRows: params.topRows,
    }),
  )
  return lines.join('\n')
}

export type AlfaClubDailyBriefFormatInput = {
  snapshotTs: string
  previousSnapshotTs: string | null
  currentRows: MetricsSnapshotRow[]
  previousRows: MetricsSnapshotRow[]
  creatorsTracked: number
  recentPublications: PublicationRecord[]
  marketRows: MarketRow[]
  hyperCore?: HyperCoreMarketBrief
  proliquidSummary?: ProliquidSignalPressureSummary
  roomEconomics?: RoomEconomicsBrief
  topRows: number
  moverRows: number
  majorRows: number
  compact: boolean
  labels: CreatorLabelMap
  roomIds: Map<string, string>
}

export function formatAlfaClubLeaderboardChat(
  input: AlfaClubDailyBriefFormatInput,
  disclaimer?: string,
): string {
  const snapLabel = formatBriefSnapshotDate(input.snapshotTs)
  const prevLabel = input.previousSnapshotTs ? formatBriefSnapshotDate(input.previousSnapshotTs) : null
  const newCreators = buildDeltas(input.currentRows, input.previousRows).filter((delta) => delta.isNew).length
  const pubs24h = input.recentPublications.filter((pub) => {
    const ts = Date.parse(pub.createdAt)
    return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000
  })
  const activeCreators24h = new Set(pubs24h.map((pub) => pub.creatorAddress.toLowerCase())).size

  const lines: string[] = []
  lines.push('**AlfaClub Leaderboard**')
  lines.push(`${snapLabel}${prevLabel ? ` vs ${prevLabel}` : ''}`)
  const freshness = buildSnapshotFreshnessLine(input.snapshotTs)
  if (freshness) lines.push(freshness)
  lines.push(
    formatIndexedScopeLine({
      creatorsTracked: input.creatorsTracked,
      rankedCount: input.currentRows.length,
      newCreators,
      activeCreators24h,
    }),
  )
  lines.push('')
  lines.push(`**Top ${input.topRows}**`)
  for (const row of input.currentRows.slice(0, input.topRows)) {
    lines.push(formatCompactRankLine(row, input.labels, input.roomIds))
  }
  if (disclaimer) {
    lines.push('')
    lines.push(disclaimer)
  }
  return lines.join('\n')
}

export type AlfaClubBriefContextResult =
  | { ok: false; reason: string; snapshotTs: string | null }
  | {
      ok: true
      snapshotTs: string
      previousSnapshotTs: string | null
      formatInput: AlfaClubDailyBriefFormatInput
    }

export async function buildAlfaClubBriefContext(params?: {
  topRows?: number
  moverRows?: number
  majorRows?: number
  fetchMarkets?: boolean
  compact?: boolean
  roomId?: string | null
}): Promise<AlfaClubBriefContextResult> {
  const flags = readAlfaClubDailyBriefFlags()
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return { ok: false, reason: 'no_snapshot', snapshotTs: null }
  }

  const timestamps = await listRecentSnapshotTimestamps(2)
  const previousSnapshotTs = timestamps.find((ts) => ts !== snapshotTs) ?? null
  const topRows = params?.topRows ?? flags.topRows
  const moverRows = params?.moverRows ?? flags.moverRows
  const majorRows = params?.majorRows ?? flags.majorRows
  const fetchMarkets = params?.fetchMarkets !== false
  const roomId = normalizeRoomId(params?.roomId ?? flags.roomId) ?? flags.roomId

  const hyperCoreResult = fetchMarkets
    ? await buildHyperCoreMarketBrief({ flags, majorRows })
    : {
        marketRows: [] as MarketRow[],
        hyperCore: {
          watchlist: [] as HyperCoreAssetContext[],
          regimeLine: 'HyperCore market section disabled for this surface.',
          execution: [] as HyperCoreExecutionRow[],
          unavailableReason: 'fetch_markets_disabled',
        } satisfies HyperCoreMarketBrief,
      }

  const proliquidSummary = fetchMarkets
    ? await buildProliquidSignalPressureSummary({
        roomId,
        lookbackHours: flags.proliquidLookbackHours,
        limit: flags.proliquidSampleLimit,
      })
    : null
  const roomEconomics = fetchMarkets ? await buildRoomEconomicsBrief({ roomId }) : null

  const [currentRows, previousRows, creators, recentPublications] = await Promise.all([
    getSnapshotAt(snapshotTs),
    previousSnapshotTs ? getSnapshotAt(previousSnapshotTs) : Promise.resolve([]),
    listAllCreators(),
    listRecentPublications(null, DEFAULT_RECENT_PUBLICATIONS_LIMIT),
  ])

  if (currentRows.length === 0) {
    return { ok: false, reason: 'empty_snapshot', snapshotTs }
  }

  const labelHintMap = new Map<string, string>()
  for (const row of [...currentRows, ...previousRows]) {
    labelHintMap.set(row.creatorAddress.toLowerCase(), row.tokenId.toString())
  }
  const labelHints = [...labelHintMap.entries()].map(([address, tokenId]) => ({
    address,
    tokenId,
  }))
  const labels = await readCreatorLabels(labelHints)
  const tokenIdByAddress = labelHintMap
  const roomLinkHints = [...tokenIdByAddress.entries()].map(([address, tokenId]) => ({
    address,
    tokenId,
  }))
  const roomIds = await resolveCreatorRoomLinks(roomLinkHints)

  return {
    ok: true,
    snapshotTs,
    previousSnapshotTs,
    formatInput: {
      snapshotTs,
      previousSnapshotTs,
      currentRows,
      previousRows,
      creatorsTracked: creators.length > 0 ? creators.length : currentRows.length,
      recentPublications,
      marketRows: hyperCoreResult.marketRows,
      hyperCore: hyperCoreResult.hyperCore,
      proliquidSummary,
      roomEconomics,
      topRows,
      moverRows,
      majorRows,
      compact: params?.compact ?? flags.compact,
      labels,
      roomIds,
    },
  }
}

export function formatAlfaClubDailyBrief(input: AlfaClubDailyBriefFormatInput): string {
  const hyperCore: HyperCoreMarketBrief =
    input.hyperCore ??
    {
      watchlist: input.marketRows.map((row) => ({
        symbol: row.symbol,
        priceUsd: row.priceUsd,
        change24hPct: row.change24hPct,
        fundingRate: null,
        openInterestUsd: null,
        volume24hUsd: null,
      })),
      regimeLine: 'Regime unavailable (legacy market row input).',
      execution: [],
      unavailableReason: 'legacy_input',
    }
  const proliquidSummary = input.proliquidSummary ?? null
  const roomEconomics = input.roomEconomics ?? null
  if (input.compact) {
    return buildCompactBriefText({
      snapshotTs: input.snapshotTs,
      previousSnapshotTs: input.previousSnapshotTs,
      currentRows: input.currentRows,
      previousRows: input.previousRows,
      creatorsTracked: input.creatorsTracked,
      recentPublications: input.recentPublications,
      marketRows: input.marketRows,
      hyperCore,
      proliquidSummary,
      roomEconomics,
      topRows: input.topRows,
      majorRows: input.majorRows,
      labels: input.labels,
      roomIds: input.roomIds,
    })
  }
  return buildLegacyBriefText({
    snapshotTs: input.snapshotTs,
    previousSnapshotTs: input.previousSnapshotTs,
    currentRows: input.currentRows,
    previousRows: input.previousRows,
    creatorsTracked: input.creatorsTracked,
    recentPublications: input.recentPublications,
    marketRows: input.marketRows,
    hyperCore,
    proliquidSummary,
    roomEconomics,
    topRows: input.topRows,
    moverRows: input.moverRows,
    labels: input.labels,
    roomIds: input.roomIds,
  })
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
  if (!flags.forceSend && (await hasDailyBriefDispatchForSnapshot(snapshotTs))) {
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

  if (readAutoSyncRoomPoliciesEnabled()) {
    await syncCreatorRoomPoliciesFromSnapshot().catch(() => {
      // Non-fatal — token-id fallback still resolves most FriendKey rooms.
    })
  }

  const built = await buildAlfaClubBriefContext({
    topRows: flags.topRows,
    moverRows: flags.moverRows,
    majorRows: flags.majorRows,
    compact: flags.compact,
    fetchMarkets: true,
    roomId: flags.roomId,
  })
  if (!built.ok) {
    return {
      ok: false,
      reason: built.reason,
      snapshotTs: built.snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: false,
      roomId: flags.roomId,
      lane: null,
      messageText: null,
    }
  }

  let messageText = formatAlfaClubDailyBrief(built.formatInput)
  try {
    const send = await sendDailyBriefToCommandRooms({ text: messageText })
    messageText = send.posted[0]?.messageText ?? messageText
    for (const post of send.posted) {
      await recordDailyBriefDispatch({
        key: dispatchKey({ snapshotTs, roomId: post.roomId }),
        snapshotTs,
        previousSnapshotTs,
        roomId: post.roomId,
        messageText: post.messageText,
      })
    }
    const roomId = send.posted.map((post) => post.roomId).join(', ')
    const lane = send.posted.map((post) => post.lane).join(', ')
    return {
      ok: true,
      snapshotTs,
      previousSnapshotTs,
      sent: true,
      skippedDuplicate: false,
      roomId,
      lane,
      messageText,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 120) : 'send_failed'
    return {
      ok: false,
      reason,
      snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: false,
      roomId: flags.roomId,
      lane: null,
      messageText,
    }
  }
}
