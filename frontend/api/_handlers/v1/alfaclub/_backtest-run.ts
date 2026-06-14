import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'

const execFileAsync = promisify(execFile)
const BACKTEST_RUN_BODY_MAX_BYTES = 65_536
const BACKTEST_RUN_TIMEOUT_MS = 240_000

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

function parseInterval(value: unknown, windowHours: number): '1m' | '5m' | '15m' | '1h' {
  if (value === '1m' || value === '5m' || value === '15m' || value === '1h') return value
  if (windowHours <= 24 * 3) return '1m'
  if (windowHours <= 24 * 14) return '5m'
  if (windowHours <= 24 * 30) return '15m'
  return '1h'
}

function resolveFrontendCwd(): string {
  const root = process.cwd()
  const frontendDir = path.join(root, 'frontend')
  return existsSync(frontendDir) ? frontendDir : root
}

function trimOutput(raw: string, maxChars = 8000): string {
  if (raw.length <= maxChars) return raw
  return raw.slice(raw.length - maxChars)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  let body: BacktestRunBody
  try {
    body = (await readJsonBody(req, { maxBytes: BACKTEST_RUN_BODY_MAX_BYTES })) as BacktestRunBody
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const symbol = typeof body.symbol === 'string' && body.symbol.trim() ? body.symbol.trim().toUpperCase() : 'BTC'
  const windowHours = toRangeNumber(body.windowHours, 24 * 7, 1, 24 * 90)
  const interval = parseInterval(body.interval, windowHours)
  const leverage = toRangeNumber(body.leverage, 20, 1, 40)
  const initialLongMarginUsd = toPositiveNumber(body.initialLongMarginUsd, 1_000)
  const initialShortMarginUsd = toPositiveNumber(body.initialShortMarginUsd, 1_000)
  const initialLongBufferUsd = toPositiveNumber(body.initialLongBufferUsd, 1_000)
  const initialShortBufferUsd = toPositiveNumber(body.initialShortBufferUsd, 1_000)
  const healthFloor = toRangeNumber(body.healthFloor, 0.75, 0.5, 1.5)
  const deadband = toRangeNumber(body.deadband, 0.08, 0.001, 0.5)
  const minChunkUsd = toPositiveNumber(body.minChunkUsd, 500)
  const maxChunkUsd = toPositiveNumber(body.maxChunkUsd, Math.max(500, minChunkUsd))
  const cooldownBars = toNonNegativeInt(body.cooldownBars, 3)

  const frontendCwd = resolveFrontendCwd()
  const args = [
    'exec',
    'tsx',
    'scripts/backtest-counter-rebalance.ts',
    '--symbol',
    symbol,
    '--interval',
    interval,
    '--window-hours',
    String(windowHours),
    '--leverage',
    String(leverage),
    '--initial-long-margin-usd',
    String(initialLongMarginUsd),
    '--initial-short-margin-usd',
    String(initialShortMarginUsd),
    '--initial-long-buffer-usd',
    String(initialLongBufferUsd),
    '--initial-short-buffer-usd',
    String(initialShortBufferUsd),
    '--floors',
    String(healthFloor),
    '--deadbands',
    String(deadband),
    '--min-chunks',
    String(minChunkUsd),
    '--max-chunks',
    String(maxChunkUsd),
    '--cooldowns',
    String(cooldownBars),
  ]

  try {
    const { stdout, stderr } = await execFileAsync('pnpm', args, {
      cwd: frontendCwd,
      timeout: BACKTEST_RUN_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 8,
      env: process.env,
    })

    return res.status(200).json({
      success: true,
      data: {
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
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
        },
      },
    } satisfies ApiEnvelope<{
      stdout: string
      stderr: string
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
      }
    }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backtest execution failed'
    return res.status(500).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }
}
