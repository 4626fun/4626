import { existsSync } from 'node:fs'
import path from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  clampBacktestHealthFloor,
  isAutoBacktestInterval,
  parseBacktestInterval,
} from '../../../../server/_lib/alfaclub/backtestIntervalPolicy.js'
import { executeBacktestCounterRebalance } from '../../../../server/_lib/alfaclub/backtestCounterRebalance.js'
import { verifyPrivyForAccounts } from '../../../../server/_lib/identity/accountsIdentity.js'

const BACKTEST_RUN_BODY_MAX_BYTES = 65_536

type BacktestRunBody = {
  symbol?: unknown
  interval?: unknown
  windowHours?: unknown
  leverage?: unknown
  initialLongMarginUsd?: unknown
  initialShortMarginUsd?: unknown
  initialLongBufferUsd?: unknown
  initialShortBufferUsd?: unknown
  healthFloor?: unknown
  deadband?: unknown
  minChunkUsd?: unknown
  maxChunkUsd?: unknown
  cooldownBars?: unknown
  requireNoCommingle?: unknown
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return numeric
}

function toRangeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = toPositiveNumber(value, fallback)
  return Math.min(max, Math.max(min, numeric))
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.floor(numeric))
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

function resolveFrontendCwd(): string {
  const root = process.cwd()
  const frontendDir = path.join(root, 'frontend')
  return existsSync(frontendDir) ? frontendDir : root
}

function trimOutput(raw: string, maxChars = 16_000): string {
  if (raw.length <= maxChars) return raw
  // Preserve the HEAD of stdout. The top-ranked parameter sets and the
  // interval/source/coverage summary are logged first; the previous
  // tail-truncation (last 8000 chars) silently dropped the most important
  // rows for large sweeps, leaving only the trailing ~40 rows visible.
  // The full sweep remains available via the `sweepFile` field. BACKTEST-004.
  const head = raw.slice(0, maxChars)
  const omitted = raw.length - maxChars
  return `${head}\n…[output truncated: ${omitted} more characters omitted — see sweepFile for the full results]`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Auth gate: backtest is compute-intensive (fetches candle data + runs
  // simulation). Require a valid Privy token so anonymous callers cannot
  // abuse the endpoint.
  let privyUserId: string
  try {
    const privyContext = await verifyPrivyForAccounts(req)
    privyUserId = privyContext.privyUserId
  } catch {
    return res.status(401).json({ success: false, error: 'Privy authentication required' } satisfies ApiEnvelope<never>)
  }

  // Rate limit: 5 per minute per privy user + IP (backtest is expensive)
  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-backtest-run', privyUserId, getClientIp(req)),
    RATE_LIMITS.alfaclubBacktestRun,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: BacktestRunBody
  try {
    body = (await readBoundedJsonObjectBody(req, { maxBytes: BACKTEST_RUN_BODY_MAX_BYTES })) as BacktestRunBody
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const symbol = typeof body.symbol === 'string' && body.symbol.trim() ? body.symbol.trim().toUpperCase() : 'BTC'
  const windowHours = toRangeNumber(body.windowHours, 24 * 7, 1, 24 * 90)
  const intervalAuto = isAutoBacktestInterval(body.interval)
  const interval = intervalAuto ? 'auto' : parseBacktestInterval(body.interval, windowHours)
  const leverage = toRangeNumber(body.leverage, 20, 1, 40)
  const initialLongMarginUsd = toPositiveNumber(body.initialLongMarginUsd, 1_000)
  const initialShortMarginUsd = toPositiveNumber(body.initialShortMarginUsd, 1_000)
  const initialLongBufferUsd = toPositiveNumber(body.initialLongBufferUsd, 1_000)
  const initialShortBufferUsd = toPositiveNumber(body.initialShortBufferUsd, 1_000)
  const healthFloor = clampBacktestHealthFloor(toRangeNumber(body.healthFloor, 0.75, 0.05, 1.5))
  const deadband = toRangeNumber(body.deadband, 0.08, 0.001, 0.5)
  const minChunkUsd = toPositiveNumber(body.minChunkUsd, 500)
  const maxChunkUsd = toPositiveNumber(body.maxChunkUsd, Math.max(500, minChunkUsd))
  if (maxChunkUsd < minChunkUsd) {
    return res.status(400).json({
      success: false,
      error: 'maxChunkUsd must be greater than or equal to minChunkUsd',
    } satisfies ApiEnvelope<never>)
  }
  const cooldownBars = toNonNegativeInt(body.cooldownBars, 3)
  const requireNoCommingle = toBoolean(body.requireNoCommingle, true)

  const frontendCwd = resolveFrontendCwd()
  const outDir = path.resolve(frontendCwd, 'tmp/backtests')

  const backtestTimeoutMs = (() => {
    const raw = Number(process.env.BACKTEST_RUN_TIMEOUT_MS)
    return Number.isFinite(raw) && raw > 0 ? raw : 60_000
  })()

  // BACKTEST-002: outer timeout so a hung backtest (API stall, Supabase
  // deadlock) cannot block the API handler indefinitely. Returns 504 on
  // timeout instead of hanging the request.
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      executeBacktestCounterRebalance({
        symbol,
        interval,
        windowHours,
        leverage,
        initialLongMarginUsd,
        initialShortMarginUsd,
        initialLongBufferUsd,
        initialShortBufferUsd,
        healthFloor,
        deadband,
        minChunkUsd,
        maxChunkUsd,
        cooldownBars,
        requireNoCommingle,
        outDir,
      }),
      new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(
          () => reject(new Error(`Backtest timed out after ${Math.round(backtestTimeoutMs / 1000)}s`)),
          backtestTimeoutMs,
        )
      }),
    ])

    const trimmedStdout = trimOutput(result.stdout)

    return res.status(200).json({
      success: true,
      data: {
        stdout: trimmedStdout,
        stderr: '',
        sweepFile: result.sweepBasename,
        resolvedInterval: result.resolvedInterval,
        series: result.series,
        params: {
          symbol,
          interval,
          windowHours,
          leverage,
          initialLongMarginUsd,
          initialShortMarginUsd,
          initialLongBufferUsd,
          initialShortBufferUsd,
          healthFloor,
          deadband,
          minChunkUsd,
          maxChunkUsd,
          cooldownBars,
          requireNoCommingle,
        },
      },
    } satisfies ApiEnvelope<{
      stdout: string
      stderr: string
      sweepFile: string | null
      resolvedInterval: string
      series: Record<string, unknown> | null
      params: {
        symbol: string
        interval: string
        windowHours: number
        leverage: number
        initialLongMarginUsd: number
        initialShortMarginUsd: number
        initialLongBufferUsd: number
        initialShortBufferUsd: number
        healthFloor: number
        deadband: number
        minChunkUsd: number
        maxChunkUsd: number
        cooldownBars: number
        requireNoCommingle: boolean
      }
    }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backtest execution failed'
    const isTimeout = message.includes('timed out')
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer)
  }
}
