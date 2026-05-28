import { createHash } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { getBasenameName } from '../identity/basenameResolver.js'
import { getEnsName } from '../identity/ensResolver.js'
import {
  getLatestSnapshotTs,
  getSnapshotAt,
  type MetricsSnapshotRow,
} from './publicationLedger.js'
import {
  formatCreatorRoomLink,
  resolveCreatorRoomLinks,
} from './creatorRoomLinks.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_RADAR_TOP_N = 8
const DEFAULT_RADAR_MOVERS_N = 6
const DEFAULT_TELEGRAM_TIMEOUT_MS = 10_000
const MAX_TELEGRAM_TEXT = 3500
export type AlfaClubRadarFlags = {
  killSwitch: boolean
  enabled: boolean
  telegramBotToken: string | null
  telegramChatId: string | null
  telegramThreadId: number | null
  topN: number
  moversN: number
  minRankMove: number
  minScoreDelta: number
  forceSend: boolean
}

export type AlfaClubRadarDispatchResult = {
  ok: boolean
  reason?: string
  snapshotTs: string | null
  previousSnapshotTs: string | null
  sent: boolean
  skippedDuplicate: boolean
  highlighted: number
  topRows: number
  chatId: string | null
}

export type SnapshotDelta = {
  current: MetricsSnapshotRow
  previous: MetricsSnapshotRow | null
  rankDelta: number | null
  scoreDelta: number | null
  supplyDelta: bigint | null
  stakedDelta: bigint | null
  pnlDelta: number | null
  isNew: boolean
}

type CreatorLabelMap = Map<string, string>

function parseBool(value: string | undefined): boolean {
  const raw = (value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseNonNegativeInt(value: string | undefined, fallback: number, max: number): number {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, max)
}

function parseNonNegativeNumber(value: string | undefined, fallback: number, max: number): number {
  const raw = (value ?? '').trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, max)
}

function parseOptionalPositiveInt(value: string | undefined, max: number): number | null {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

export function readAlfaClubRadarFlags(): AlfaClubRadarFlags {
  const telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim() || null
  const telegramChatId =
    (process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID ?? '').trim() ||
    (process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID ?? '').trim() ||
    (process.env.TELEGRAM_TARGET_CHAT_ID ?? '').trim() ||
    null
  const hasTelegramDestination = Boolean(telegramBotToken && telegramChatId)
  const enabledRaw = (process.env.ALFACLUB_RADAR_TELEGRAM_ENABLED ?? '').trim()

  return {
    killSwitch: parseBool(process.env.ALFACLUB_VIGILANTE_KILL_SWITCH),
    enabled: enabledRaw ? parseBool(enabledRaw) : hasTelegramDestination,
    telegramBotToken,
    telegramChatId,
    telegramThreadId: parseOptionalPositiveInt(
      process.env.ALFACLUB_RADAR_TELEGRAM_THREAD_ID,
      2_000_000_000,
    ),
    topN: parsePositiveInt(process.env.ALFACLUB_RADAR_TOP_N, DEFAULT_RADAR_TOP_N, 50),
    moversN: parsePositiveInt(process.env.ALFACLUB_RADAR_MOVERS_N, DEFAULT_RADAR_MOVERS_N, 25),
    minRankMove: parseNonNegativeInt(process.env.ALFACLUB_RADAR_MIN_RANK_MOVE, 1, 100),
    minScoreDelta: parseNonNegativeNumber(process.env.ALFACLUB_RADAR_MIN_SCORE_DELTA, 0.02, 2),
    forceSend: parseBool(process.env.ALFACLUB_RADAR_FORCE_SEND),
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

function dispatchKey(params: { snapshotTs: string; chatId: string }): string {
  const digest = createHash('sha256')
    .update(`${params.snapshotTs}|${params.chatId}`)
    .digest('hex')
  return `telegram-radar:${digest}`
}

async function hasRadarDispatch(key: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    const result = await db.sql`
      SELECT 1
      FROM alfaclub.radar_dispatch
      WHERE dispatch_key = ${key}
      LIMIT 1;
    `
    return (result.rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function recordRadarDispatch(params: {
  key: string
  snapshotTs: string
  previousSnapshotTs: string | null
  chatId: string
  messageText: string
}): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.sql`
      INSERT INTO alfaclub.radar_dispatch (
        dispatch_key,
        snapshot_ts,
        previous_snapshot_ts,
        chat_id,
        message_hash,
        sent_at
      ) VALUES (
        ${params.key},
        ${params.snapshotTs},
        ${params.previousSnapshotTs},
        ${params.chatId},
        ${createHash('sha256').update(params.messageText).digest('hex')},
        NOW()
      )
      ON CONFLICT (dispatch_key) DO NOTHING;
    `
  } catch {
    // Delivery already happened. Do not fail the user-facing run on ledger write.
  }
}

function byAddress(rows: MetricsSnapshotRow[]): Map<string, MetricsSnapshotRow> {
  const map = new Map<string, MetricsSnapshotRow>()
  for (const row of rows) map.set(row.creatorAddress.toLowerCase(), row)
  return map
}

function buildDeltas(
  currentRows: MetricsSnapshotRow[],
  previousRows: MetricsSnapshotRow[],
): SnapshotDelta[] {
  const previousByAddress = byAddress(previousRows)
  return currentRows.map((current) => {
    const previous = previousByAddress.get(current.creatorAddress.toLowerCase()) ?? null
    return {
      current,
      previous,
      rankDelta: previous ? previous.rank - current.rank : null,
      scoreDelta: previous ? current.score - previous.score : null,
      supplyDelta: previous ? current.totalSupply - previous.totalSupply : null,
      stakedDelta: previous ? current.stakedSupply - previous.stakedSupply : null,
      pnlDelta:
        previous && current.pnl30dUsd !== null && previous.pnl30dUsd !== null
          ? current.pnl30dUsd - previous.pnl30dUsd
          : null,
      isNew: previous === null,
    }
  })
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
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
    // Best-effort enrichment; digest should still send on metadata lookup failures.
  }

  const unresolved = normalized.filter((address) => !labels.has(address))
  if (unresolved.length === 0) return labels

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
  return labels
}

function creatorLabel(delta: SnapshotDelta, labels: CreatorLabelMap): string {
  const label = labels.get(delta.current.creatorAddress.toLowerCase())
  if (label) return `${label} · #${delta.current.tokenId.toString()}`
  return `#${delta.current.tokenId.toString()} ${shortAddress(delta.current.creatorAddress)}`
}

function formatSignedInt(value: number | bigint | null): string {
  if (value === null) return 'n/a'
  const n = typeof value === 'bigint' ? Number(value) : value
  if (!Number.isFinite(n)) return 'n/a'
  if (n > 0) return `+${Math.trunc(n).toLocaleString('en-US')}`
  return Math.trunc(n).toLocaleString('en-US')
}

function formatScore(value: number): string {
  return value.toFixed(4)
}

function formatScoreDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(4)}`
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatRankDelta(delta: number | null): string {
  if (delta === null) return 'new'
  if (delta > 0) return `up ${delta}`
  if (delta < 0) return `down ${Math.abs(delta)}`
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

function isMeaningfulMover(delta: SnapshotDelta, flags: AlfaClubRadarFlags): boolean {
  if (delta.isNew) return true
  const rankMove = Math.abs(delta.rankDelta ?? 0)
  const scoreMove = Math.abs(delta.scoreDelta ?? 0)
  const supplyMove = delta.supplyDelta ? delta.supplyDelta > 0n : false
  return rankMove >= flags.minRankMove || scoreMove >= flags.minScoreDelta || supplyMove
}

function rankMover(a: SnapshotDelta, b: SnapshotDelta): number {
  if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
  const aRank = Math.abs(a.rankDelta ?? 0)
  const bRank = Math.abs(b.rankDelta ?? 0)
  if (aRank !== bRank) return bRank - aRank
  const aScore = Math.abs(a.scoreDelta ?? 0)
  const bScore = Math.abs(b.scoreDelta ?? 0)
  if (aScore !== bScore) return bScore - aScore
  return a.current.rank - b.current.rank
}

export function buildAlfaClubRadarText(params: {
  snapshotTs: string
  previousSnapshotTs: string | null
  deltas: SnapshotDelta[]
  flags: AlfaClubRadarFlags
  labels: CreatorLabelMap
  roomIds: Map<string, string>
}): { text: string; highlighted: number; topRows: number } {
  const breakoutCandidates = params.deltas
    .filter((delta) => (delta.scoreDelta ?? 0) >= params.flags.minScoreDelta || (delta.rankDelta ?? 0) >= params.flags.minRankMove || delta.isNew)
    .sort((a, b) => {
      const aScore = (a.isNew ? 2 : 0) + Math.max(0, a.rankDelta ?? 0) * 0.8 + Math.max(0, a.scoreDelta ?? 0) * 20
      const bScore = (b.isNew ? 2 : 0) + Math.max(0, b.rankDelta ?? 0) * 0.8 + Math.max(0, b.scoreDelta ?? 0) * 20
      if (bScore !== aScore) return bScore - aScore
      return a.current.rank - b.current.rank
    })
    .slice(0, 3)
  const riskCandidates = params.deltas
    .filter((delta) => (delta.scoreDelta ?? 0) <= -params.flags.minScoreDelta || (delta.rankDelta ?? 0) <= -params.flags.minRankMove)
    .sort((a, b) => {
      const aRisk = Math.abs(Math.min(0, a.rankDelta ?? 0)) * 0.8 + Math.abs(Math.min(0, a.scoreDelta ?? 0)) * 20
      const bRisk = Math.abs(Math.min(0, b.rankDelta ?? 0)) * 0.8 + Math.abs(Math.min(0, b.scoreDelta ?? 0)) * 20
      if (bRisk !== aRisk) return bRisk - aRisk
      return a.current.rank - b.current.rank
    })
    .slice(0, 3)
  const stakeShiftCandidates = params.deltas
    .map((delta) => {
      const nowRatio = stakeRatio(delta.current)
      const prevRatio = stakeRatio(delta.previous)
      const ratioDelta = nowRatio !== null && prevRatio !== null ? nowRatio - prevRatio : null
      return { delta, nowRatio, ratioDelta }
    })
    .filter((entry) => entry.ratioDelta !== null && Math.abs(entry.ratioDelta) >= 0.05)
    .sort((a, b) => Math.abs(b.ratioDelta ?? 0) - Math.abs(a.ratioDelta ?? 0))
    .slice(0, 2)
  const currentTop = params.deltas
    .slice()
    .sort((a, b) => a.current.rank - b.current.rank)
    .slice(0, params.flags.topN)
  const movers = params.deltas
    .filter((delta) => isMeaningfulMover(delta, params.flags))
    .sort(rankMover)
    .slice(0, params.flags.moversN)

  const lines = [
    'Alfa Radar (Actionable)',
    `Snapshot: ${params.snapshotTs}`,
    params.previousSnapshotTs ? `Compared to: ${params.previousSnapshotTs}` : 'Compared to: first snapshot',
    '',
  ]

  lines.push('What matters now')
  if (breakoutCandidates.length === 0 && riskCandidates.length === 0 && stakeShiftCandidates.length === 0) {
    lines.push('- No high-conviction breakouts or breakdowns crossed alert thresholds this cycle.')
  } else {
    for (const delta of breakoutCandidates) {
      lines.push(
        appendCreatorRoomLink(
          `- Breakout: ${creatorLabel(delta, params.labels)} (${formatRankDelta(delta.rankDelta)}, score ${formatScoreDelta(delta.scoreDelta)}, pnl ${formatUsd(delta.current.pnl30dUsd)})`,
          delta.current.creatorAddress,
          params.roomIds,
        ),
      )
    }
    for (const delta of riskCandidates) {
      lines.push(
        appendCreatorRoomLink(
          `- Risk: ${creatorLabel(delta, params.labels)} (${formatRankDelta(delta.rankDelta)}, score ${formatScoreDelta(delta.scoreDelta)}, pnl ${formatUsd(delta.current.pnl30dUsd)})`,
          delta.current.creatorAddress,
          params.roomIds,
        ),
      )
    }
    for (const entry of stakeShiftCandidates) {
      lines.push(
        appendCreatorRoomLink(
          `- Positioning shift: ${creatorLabel(entry.delta, params.labels)} staked ratio ${formatRatioPct(entry.nowRatio)} (${formatRatioDeltaPct(entry.ratioDelta)})`,
          entry.delta.current.creatorAddress,
          params.roomIds,
        ),
      )
    }
  }
  lines.push('')

  if (movers.length > 0) {
    lines.push('Movers')
    for (const delta of movers) {
      lines.push(
        `${delta.current.rank}. ${creatorLabel(delta, params.labels)} ` +
          `(${formatRankDelta(delta.rankDelta)}, score ${formatScoreDelta(delta.scoreDelta)}) ` +
          `supply ${formatSignedInt(delta.supplyDelta)} staked ${formatSignedInt(delta.stakedDelta)} ` +
          `pnl ${formatUsd(delta.current.pnl30dUsd)} (${formatUsd(delta.pnlDelta)})`,
      )
    }
    lines.push('')
  } else {
    lines.push('Movers: no threshold-crossing changes since the previous snapshot.')
    lines.push('')
  }

  lines.push('Current Top')
  for (const delta of currentTop) {
    lines.push(
      `${delta.current.rank}. ${creatorLabel(delta, params.labels)} ` +
        `score ${formatScore(delta.current.score)} supply ${delta.current.totalSupply.toString()} ` +
        `staked ${delta.current.stakedSupply.toString()} pnl ${formatUsd(delta.current.pnl30dUsd)}`,
    )
  }

  lines.push('')
  lines.push('Source: public AlfaClub contracts + Hyperliquid snapshots. No room read access required.')

  let text = lines.join('\n')
  if (text.length > MAX_TELEGRAM_TEXT) {
    text = `${text.slice(0, MAX_TELEGRAM_TEXT - 24)}\n...(truncated)`
  }

  return { text, highlighted: movers.length, topRows: currentTop.length }
}

async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  threadId: number | null
  text: string
}): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TELEGRAM_TIMEOUT_MS)
  try {
    const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        message_thread_id: params.threadId ?? undefined,
        text: params.text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })
    const body = await response.text().catch(() => '')
    if (!response.ok) {
      throw new Error(`telegram_send_failed:${response.status}:${body.slice(0, 180)}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function runAlfaClubRadar(
  opts: {
    flags?: AlfaClubRadarFlags
    sendTelegram?: (params: { text: string; chatId: string }) => Promise<void>
  } = {},
): Promise<AlfaClubRadarDispatchResult> {
  const flags = opts.flags ?? readAlfaClubRadarFlags()
  const chatId = flags.telegramChatId

  if (flags.killSwitch) {
    return {
      ok: false,
      reason: 'kill_switch',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }
  if (!flags.enabled) {
    return {
      ok: false,
      reason: 'disabled',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }
  if (!flags.telegramBotToken || !chatId) {
    return {
      ok: false,
      reason: 'telegram_missing',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }

  await ensureAlfaClubVigilanteSchema()
  const snapshotTs = await getLatestSnapshotTs()
  if (!snapshotTs) {
    return {
      ok: false,
      reason: 'no_snapshot',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }

  const timestamps = await listRecentSnapshotTimestamps(2)
  const previousSnapshotTs = timestamps.find((ts) => ts !== snapshotTs) ?? null
  const key = dispatchKey({ snapshotTs, chatId })
  if (!flags.forceSend && (await hasRadarDispatch(key))) {
    return {
      ok: true,
      snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: true,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }

  const [currentRows, previousRows] = await Promise.all([
    getSnapshotAt(snapshotTs),
    previousSnapshotTs ? getSnapshotAt(previousSnapshotTs) : Promise.resolve([]),
  ])
  if (currentRows.length === 0) {
    return {
      ok: false,
      reason: 'empty_snapshot',
      snapshotTs,
      previousSnapshotTs,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId,
    }
  }

  const labels = await readCreatorLabels(currentRows.map((row) => row.creatorAddress))
  const addressSet = new Set<string>()
  for (const row of currentRows) addressSet.add(row.creatorAddress)
  for (const row of previousRows) addressSet.add(row.creatorAddress)
  const roomIds = await resolveCreatorRoomLinks([...addressSet])
  const built = buildAlfaClubRadarText({
    snapshotTs,
    previousSnapshotTs,
    deltas: buildDeltas(currentRows, previousRows),
    flags,
    labels,
    roomIds,
  })

  if (opts.sendTelegram) {
    await opts.sendTelegram({ text: built.text, chatId })
  } else {
    await sendTelegramMessage({
      botToken: flags.telegramBotToken,
      chatId,
      threadId: flags.telegramThreadId,
      text: built.text,
    })
  }
  await recordRadarDispatch({
    key,
    snapshotTs,
    previousSnapshotTs,
    chatId,
    messageText: built.text,
  })

  return {
    ok: true,
    snapshotTs,
    previousSnapshotTs,
    sent: true,
    skippedDuplicate: false,
    highlighted: built.highlighted,
    topRows: built.topRows,
    chatId,
  }
}
