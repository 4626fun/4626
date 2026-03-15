import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getDb } from '../../../server/_lib/postgres.js'
import {
  ensureTelegramTradingSchema,
  listDueTelegramArenaWatches,
  type TelegramArenaWatch,
  updateTelegramArenaWatchPoll,
} from '../../../server/_lib/telegramTrading.js'
import { getTelegramWebhookConfig } from './webhook/config.js'
import { sendTelegramMessage } from './webhook/telegramApi/messaging.js'

declare const process: { env: Record<string, string | undefined> }

const CLASH_API_DEFAULT_BASE_URL = 'https://clashofclaw.com/api/v1'

type ArenaConfig = {
  apiKey: string
  baseUrl: string
}

function asTrimmed(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeBaseUrl(raw: string): string {
  const cleaned = asTrimmed(raw).replace(/\/+$/, '')
  return cleaned || CLASH_API_DEFAULT_BASE_URL
}

function cleanApiMessage(value: unknown): string {
  const raw = asTrimmed(value)
  if (!raw) return ''
  return raw.length <= 220 ? raw : `${raw.slice(0, 217)}...`
}

function normalizeMatchId(value: unknown): string {
  return asTrimmed(value).toLowerCase()
}

function readCronSecret(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return asTrimmed(header[0] ?? '')
  if (typeof header === 'string') return asTrimmed(header)
  const auth = asTrimmed(req.headers.authorization ?? '')
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return asTrimmed(match?.[1] ?? '')
}

function readArenaConfig(): { ok: true; config: ArenaConfig } | { ok: false; error: string } {
  const apiKey = asTrimmed(process.env.CLASH_OF_CLAW_API_KEY ?? process.env.ARENA_API_KEY ?? '')
  if (!apiKey) {
    return { ok: false, error: 'CLASH_OF_CLAW_API_KEY (or ARENA_API_KEY) is not configured' }
  }
  return {
    ok: true,
    config: {
      apiKey,
      baseUrl: normalizeBaseUrl(process.env.CLASH_OF_CLAW_BASE_URL ?? CLASH_API_DEFAULT_BASE_URL),
    },
  }
}

function readPollSeconds(): number {
  const raw = Number(process.env.TELEGRAM_ARENA_WATCH_POLL_SECONDS ?? 60)
  if (!Number.isFinite(raw) || raw <= 0) return 60
  return Math.max(15, Math.min(60 * 60, Math.floor(raw)))
}

function readMaxPerTick(req: VercelRequest): number {
  const fromQuery = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit
  const parsed = Number(fromQuery)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.min(250, Math.floor(parsed)))
  }
  const fromEnv = Number(process.env.TELEGRAM_ARENA_WATCH_MAX_PER_TICK ?? 25)
  if (!Number.isFinite(fromEnv) || fromEnv <= 0) return 25
  return Math.max(1, Math.min(250, Math.floor(fromEnv)))
}

async function fetchArenaState(config: ArenaConfig): Promise<{ ok: true; payload: any } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/game/state`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })
    const rawText = await response.text()
    let payload: any = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = rawText
    }
    if (!response.ok) {
      const detail =
        cleanApiMessage(payload?.error) ||
        cleanApiMessage(payload?.detail) ||
        cleanApiMessage(payload?.message) ||
        cleanApiMessage(rawText) ||
        response.statusText
      return { ok: false, error: `Arena state request failed (${response.status}): ${detail || 'unknown error'}` }
    }
    return { ok: true, payload }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Arena state request failed: ${cleanApiMessage(message) || 'network error'}` }
  }
}

async function fetchArenaMatchResult(config: ArenaConfig): Promise<{ ok: true; payload: any } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/match/result`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })
    const rawText = await response.text()
    let payload: any = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = rawText
    }
    if (!response.ok) {
      const detail =
        cleanApiMessage(payload?.error) ||
        cleanApiMessage(payload?.detail) ||
        cleanApiMessage(payload?.message) ||
        cleanApiMessage(rawText) ||
        response.statusText
      return { ok: false, error: `Arena result request failed (${response.status}): ${detail || 'unknown error'}` }
    }
    return { ok: true, payload }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Arena result request failed: ${cleanApiMessage(message) || 'network error'}` }
  }
}

function readStateFingerprint(payload: any): {
  phase: string
  gameTime: string
  stateHash: string
  matchId: string | null
  gameOver: boolean
  message: string
} {
  const state = payload?.state ?? {}
  const phase = asTrimmed(payload?.phase || (payload?.game_over ? 'game_over' : 'running')) || 'running'
  const gameTime = asTrimmed(state?.game?.time ?? state?.time) || 'n/a'
  const techTier = Number(state?.military?.techTier)
  const armyValue = Number(state?.military?.armyValue)
  const enemyEstimate = Number(state?.intel?.enemyArmyEstimate)
  const mapVisibility = Number(state?.strategic?.mapVisibility)
  const stalling = asTrimmed(state?.economy?.stallingResource ?? (state?.economy?.isStalling ? 'yes' : 'no')) || 'no'
  const nextAction = asTrimmed(payload?.next_step?.action)
  const nextDescription = asTrimmed(payload?.next_step?.description)
  const matchId = asTrimmed(payload?.match_id) || null
  const gameOver = Boolean(payload?.game_over)

  const signature = {
    phase,
    gameTime,
    techTier: Number.isFinite(techTier) ? techTier : null,
    armyValue: Number.isFinite(armyValue) ? armyValue : null,
    enemyEstimate: Number.isFinite(enemyEstimate) ? enemyEstimate : null,
    mapVisibility: Number.isFinite(mapVisibility) ? Number(mapVisibility.toFixed(3)) : null,
    stalling,
    nextAction,
    nextDescription,
    gameOver,
  }
  const stateHash = createHash('sha1').update(JSON.stringify(signature)).digest('hex')

  const lines = [
    gameOver ? 'Arena update (game over)' : 'Arena update',
    '',
    `- phase: ${phase}`,
    `- time: ${gameTime}`,
    `- tech_tier: ${Number.isFinite(techTier) ? String(techTier) : 'n/a'}`,
    `- army_value: ${Number.isFinite(armyValue) ? String(armyValue) : 'n/a'}`,
    `- enemy_estimate: ${Number.isFinite(enemyEstimate) ? String(enemyEstimate) : 'n/a'}`,
    `- map_visibility: ${Number.isFinite(mapVisibility) ? String(mapVisibility) : 'n/a'}`,
    `- metal_stalling: ${stalling}`,
    `- game_over: ${String(gameOver)}`,
  ]
  if (nextAction || nextDescription) {
    lines.push(`- next: ${nextAction || nextDescription}${nextAction && nextDescription ? ` — ${nextDescription}` : ''}`)
  }
  if (gameOver) {
    lines.push('- watch: auto-disabled (re-enable with /arena watch on)')
  } else {
    lines.push('- disable: /arena watch off')
  }

  return {
    phase,
    gameTime,
    stateHash,
    matchId,
    gameOver,
    message: lines.join('\n'),
  }
}

function isMatchNotRunningPayload(payload: any): boolean {
  if (!payload || payload?.success !== false) return false
  const error = asTrimmed(payload?.error).toLowerCase()
  return error.includes('match not running')
}

async function processWatch(params: {
  watch: TelegramArenaWatch
  botToken: string
  arenaConfig: ArenaConfig
  pollSeconds: number
  db: any
}): Promise<{ pushed: boolean; disabled: boolean; error: string | null }> {
  const expectedMatchId = normalizeMatchId(params.watch.watchMatchId)
  if (!expectedMatchId) {
    const errorMessage = 'watch is enabled but unbound; run /arena find in this chat to bind your battle'
    await updateTelegramArenaWatchPoll({
      db: params.db,
      chatId: params.watch.chatId,
      errorMessage,
      pushed: false,
      pollIntervalSeconds: params.pollSeconds,
    })
    return { pushed: false, disabled: false, error: errorMessage }
  }

  const stateResult = await fetchArenaState(params.arenaConfig)
  if (!stateResult.ok) {
    await updateTelegramArenaWatchPoll({
      db: params.db,
      chatId: params.watch.chatId,
      errorMessage: stateResult.error,
      pushed: false,
      pollIntervalSeconds: params.pollSeconds,
    })
    return { pushed: false, disabled: false, error: stateResult.error }
  }

  if (isMatchNotRunningPayload(stateResult.payload)) {
    const idleHash = 'idle:no_match'
    const becameIdle = params.watch.lastStateHash !== idleHash
    let sent = false
    let sendError: string | null = null
    if (becameIdle) {
      try {
        await sendTelegramMessage({
          botToken: params.botToken,
          chatId: params.watch.chatId,
          text: ['Arena update', '', '- match: not running', '- next: /arena find', '- watch: still enabled'].join('\n'),
          ...(typeof params.watch.threadId === 'number' ? { messageThreadId: params.watch.threadId } : {}),
        })
        sent = true
      } catch (error) {
        sendError = error instanceof Error ? error.message : String(error)
      }
    }
    await updateTelegramArenaWatchPoll({
      db: params.db,
      chatId: params.watch.chatId,
      phase: 'idle',
      gameTime: 'n/a',
      stateHash: idleHash,
      matchId: null,
      errorMessage: sendError,
      pushed: sent,
      pollIntervalSeconds: params.pollSeconds,
    })
    return { pushed: sent, disabled: false, error: sendError }
  }

  const summary = readStateFingerprint(stateResult.payload)
  let currentMatchId = normalizeMatchId(summary.matchId)
  let resolvedMatchId = summary.matchId
  if (!currentMatchId) {
    const resultResponse = await fetchArenaMatchResult(params.arenaConfig)
    if (resultResponse.ok) {
      const fallbackMatchId = asTrimmed(resultResponse.payload?.match_id)
      if (fallbackMatchId) {
        currentMatchId = normalizeMatchId(fallbackMatchId)
        resolvedMatchId = fallbackMatchId
      }
    }
  }
  if (!currentMatchId) {
    const errorMessage = `watch bound to ${expectedMatchId}, but state payload had no match_id`
    await updateTelegramArenaWatchPoll({
      db: params.db,
      chatId: params.watch.chatId,
      phase: summary.phase,
      gameTime: summary.gameTime,
      matchId: resolvedMatchId,
      errorMessage,
      pushed: false,
      pollIntervalSeconds: params.pollSeconds,
    })
    return { pushed: false, disabled: false, error: errorMessage }
  }
  if (currentMatchId !== expectedMatchId) {
    await updateTelegramArenaWatchPoll({
      db: params.db,
      chatId: params.watch.chatId,
      phase: summary.phase,
      gameTime: summary.gameTime,
      matchId: resolvedMatchId,
      errorMessage: null,
      pushed: false,
      pollIntervalSeconds: params.pollSeconds,
    })
    return { pushed: false, disabled: false, error: null }
  }

  const changed = params.watch.lastStateHash !== summary.stateHash
  const shouldDisable = summary.gameOver
  let sent = false
  let sendError: string | null = null
  if (changed) {
    try {
      await sendTelegramMessage({
        botToken: params.botToken,
        chatId: params.watch.chatId,
        text: summary.message,
        ...(typeof params.watch.threadId === 'number' ? { messageThreadId: params.watch.threadId } : {}),
      })
      sent = true
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error)
    }
  }

  await updateTelegramArenaWatchPoll({
    db: params.db,
    chatId: params.watch.chatId,
    enabled: shouldDisable ? false : undefined,
    phase: summary.phase,
    gameTime: summary.gameTime,
    stateHash: summary.stateHash,
    matchId: resolvedMatchId,
    errorMessage: sendError,
    pushed: sent,
    pollIntervalSeconds: params.pollSeconds,
  })
  return { pushed: sent, disabled: shouldDisable, error: sendError }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = asTrimmed(process.env.CRON_SECRET ?? '')
  if (!configuredSecret) {
    return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured' })
  }
  const providedSecret = readCronSecret(req)
  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' })
  }
  await ensureTelegramTradingSchema(db as any)

  const arenaConfigResult = readArenaConfig()
  if (!arenaConfigResult.ok) {
    return res.status(503).json({ success: false, error: arenaConfigResult.error })
  }
  const telegramConfig = getTelegramWebhookConfig()
  if (!telegramConfig.botToken) {
    return res.status(503).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' })
  }

  const due = await listDueTelegramArenaWatches({
    db: db as any,
    limit: readMaxPerTick(req),
  })
  const pollSeconds = readPollSeconds()
  if (due.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        due: 0,
        pushed: 0,
        disabled: 0,
        errored: 0,
        pollSeconds,
      },
    })
  }

  let pushed = 0
  let disabled = 0
  let errored = 0
  const failures: Array<{ chatId: string; error: string }> = []
  for (const watch of due) {
    const outcome = await processWatch({
      watch,
      botToken: telegramConfig.botToken,
      arenaConfig: arenaConfigResult.config,
      pollSeconds,
      db: db as any,
    })
    if (outcome.pushed) pushed += 1
    if (outcome.disabled) disabled += 1
    if (outcome.error) {
      errored += 1
      failures.push({
        chatId: watch.chatId,
        error: cleanApiMessage(outcome.error),
      })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      due: due.length,
      pushed,
      disabled,
      errored,
      pollSeconds,
      failures: failures.slice(0, 10),
    },
  })
}
