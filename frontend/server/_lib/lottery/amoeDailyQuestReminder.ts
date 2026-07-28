/**
 * Daily AMOE check-in reminder via Base App notifications.
 *
 * Audience = Base App users with notifications enabled ∩ wallets that
 * completed an AMOE daily check-in in the lookback window ∩ not yet
 * claimed today (twitter or xmtp).
 */

import { getDb } from '../db/postgres.js'
import {
  isBaseAppNotificationsConfigured,
  listBaseAppNotificationUsers,
  sendBaseAppNotifications,
} from '../base/baseAppNotifications.js'

export const AMOE_DAILY_QUEST_TITLE = 'Daily quest open'
export const AMOE_DAILY_QUEST_MESSAGE =
  'Claim today’s AMOE check-in for credits. Open Points to complete it.'
export const AMOE_DAILY_QUEST_TARGET_PATH = '/'

const LOOKBACK_DAYS_DEFAULT = 14
const SEND_CHUNK_SIZE = 100

function dayKeyUtc(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10)
}

function normalizeAddress(value: string): `0x${string}` | null {
  const trimmed = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) return null
  return trimmed as `0x${string}`
}

export type AmoeDailyQuestReminderResult = {
  ok: boolean
  reason: string | null
  dayKey: string
  optedInCount: number
  engagedCount: number
  alreadyClaimedCount: number
  candidateCount: number
  sentCount: number
  failedCount: number
}

export async function listEngagedAmoeWalletsNotClaimedToday(params: {
  dayKey: string
  lookbackDays?: number
}): Promise<{ engaged: `0x${string}`[]; alreadyClaimedToday: Set<string> }> {
  const db = await getDb()
  if (!db) {
    return { engaged: [], alreadyClaimedToday: new Set() }
  }

  const lookbackDays = Math.min(90, Math.max(1, params.lookbackDays ?? LOOKBACK_DAYS_DEFAULT))
  const lookbackStart = new Date(`${params.dayKey}T00:00:00.000Z`)
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackDays)
  const lookbackDayKey = lookbackStart.toISOString().slice(0, 10)

  const engagedResult = await db.sql`
    SELECT DISTINCT lower(wallet_address) AS wallet_address
    FROM (
      SELECT wallet_address, checkin_date
      FROM lottery_amoe_daily_twitter_checkins
      UNION ALL
      SELECT wallet_address, checkin_date
      FROM lottery_amoe_daily_xmtp_checkins
    ) checkins
    WHERE checkin_date >= ${lookbackDayKey}
      AND checkin_date < ${params.dayKey}
  `

  const claimedResult = await db.sql`
    SELECT DISTINCT lower(wallet_address) AS wallet_address
    FROM (
      SELECT wallet_address
      FROM lottery_amoe_daily_twitter_checkins
      WHERE checkin_date = ${params.dayKey}
      UNION ALL
      SELECT wallet_address
      FROM lottery_amoe_daily_xmtp_checkins
      WHERE checkin_date = ${params.dayKey}
    ) today
  `

  const engaged: `0x${string}`[] = []
  for (const row of engagedResult.rows ?? []) {
    const address = normalizeAddress(String((row as { wallet_address?: string }).wallet_address ?? ''))
    if (address) engaged.push(address)
  }

  const alreadyClaimedToday = new Set<string>()
  for (const row of claimedResult.rows ?? []) {
    const address = normalizeAddress(String((row as { wallet_address?: string }).wallet_address ?? ''))
    if (address) alreadyClaimedToday.add(address)
  }

  return { engaged, alreadyClaimedToday }
}

function chunkAddresses(addresses: `0x${string}`[], size: number): `0x${string}`[][] {
  const chunks: `0x${string}`[][] = []
  for (let i = 0; i < addresses.length; i += size) {
    chunks.push(addresses.slice(i, i + size))
  }
  return chunks
}

export async function runAmoeDailyQuestReminder(params?: {
  nowMs?: number
  lookbackDays?: number
  dryRun?: boolean
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  listUsers?: typeof listBaseAppNotificationUsers
  send?: typeof sendBaseAppNotifications
  listEngaged?: typeof listEngagedAmoeWalletsNotClaimedToday
}): Promise<AmoeDailyQuestReminderResult> {
  const env = params?.env ?? process.env
  const nowMs = params?.nowMs ?? Date.now()
  const dayKey = dayKeyUtc(nowMs)
  const listUsers = params?.listUsers ?? listBaseAppNotificationUsers
  const send = params?.send ?? sendBaseAppNotifications
  const listEngaged = params?.listEngaged ?? listEngagedAmoeWalletsNotClaimedToday

  if (!isBaseAppNotificationsConfigured(env)) {
    return {
      ok: false,
      reason: 'BASE_APP_API_KEY is not configured',
      dayKey,
      optedInCount: 0,
      engagedCount: 0,
      alreadyClaimedCount: 0,
      candidateCount: 0,
      sentCount: 0,
      failedCount: 0,
    }
  }

  const usersResult = await listUsers({
    notificationEnabled: true,
    env,
    fetchImpl: params?.fetchImpl,
  })
  if (!usersResult.ok) {
    return {
      ok: false,
      reason: usersResult.error,
      dayKey,
      optedInCount: 0,
      engagedCount: 0,
      alreadyClaimedCount: 0,
      candidateCount: 0,
      sentCount: 0,
      failedCount: 0,
    }
  }

  const optedIn = new Set(
    usersResult.users
      .filter((user) => user.notificationsEnabled)
      .map((user) => user.address),
  )
  const { engaged, alreadyClaimedToday } = await listEngaged({
    dayKey,
    lookbackDays: params?.lookbackDays,
  })

  const candidates = engaged.filter(
    (wallet) => optedIn.has(wallet) && !alreadyClaimedToday.has(wallet),
  )

  if (params?.dryRun || candidates.length === 0) {
    return {
      ok: true,
      reason: params?.dryRun ? 'dry_run' : candidates.length === 0 ? 'no_candidates' : null,
      dayKey,
      optedInCount: optedIn.size,
      engagedCount: engaged.length,
      alreadyClaimedCount: alreadyClaimedToday.size,
      candidateCount: candidates.length,
      sentCount: 0,
      failedCount: 0,
    }
  }

  let sentCount = 0
  let failedCount = 0
  for (const chunk of chunkAddresses(candidates, SEND_CHUNK_SIZE)) {
    const sendResult = await send({
      walletAddresses: chunk,
      title: AMOE_DAILY_QUEST_TITLE,
      message: AMOE_DAILY_QUEST_MESSAGE,
      targetPath: AMOE_DAILY_QUEST_TARGET_PATH,
      env,
      fetchImpl: params?.fetchImpl,
    })
    if (!sendResult.ok) {
      failedCount += chunk.length
      continue
    }
    sentCount += sendResult.data.sentCount
    failedCount += sendResult.data.failedCount
  }

  return {
    ok: failedCount === 0,
    reason: failedCount > 0 ? 'partial_or_failed_delivery' : null,
    dayKey,
    optedInCount: optedIn.size,
    engagedCount: engaged.length,
    alreadyClaimedCount: alreadyClaimedToday.size,
    candidateCount: candidates.length,
    sentCount,
    failedCount,
  }
}
