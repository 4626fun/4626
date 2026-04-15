import { isAddress } from 'viem'

import { logger } from '../_lib/infra/logger.js'
import { markTrendOpDeployed, markTrendOpDeploying, markTrendOpFailed, upsertTrendPrediction } from '../_lib/zoraTrendOpsStore.js'
import { preflightTrendTicker, reserveTrendTicker } from './trends.js'

declare const process: { env: Record<string, string | undefined> }

export type TrendLaunchSentinelStatus =
  | 'disabled'
  | 'misconfigured'
  | 'deadline_elapsed'
  | 'secured'
  | 'lost_all'
  | 'timed_out'
  | 'max_errors'

export type TrendLaunchSentinelResult = {
  status: TrendLaunchSentinelStatus
  securedTicker: string | null
  fallbackUsed: boolean
  txHash: string | null
  iterations: number
  attempts: number
  deployedTickers: string[]
  errors: string[]
  startedAt: string
  finishedAt: string
}

type TrendLaunchSentinelOverrides = {
  tickers?: string[]
  creatorToken?: string
  groupId?: string
  pollMs?: number
  jitterMs?: number
  maxRuntimeMs?: number
  maxConsecutiveErrors?: number
  requireReceipt?: boolean
}

type TrendLaunchSentinelDeps = {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

type TrendLaunchSentinelConfig = {
  enabled: boolean
  tickers: string[]
  creatorToken: `0x${string}` | null
  groupId: string
  pollMs: number
  jitterMs: number
  maxRuntimeMs: number
  maxConsecutiveErrors: number
  requireReceipt: boolean
  deadlineMs: number | null
  alertWebhookUrl: string | null
}

const DEFAULT_TICKERS = ['AI', '67', '46']
const DEFAULT_GROUP_ID = 'trend-ai-launch-bot-v1'
const DEFAULT_POLL_MS = 800
const DEFAULT_JITTER_MS = 400
const DEFAULT_MAX_RUNTIME_MS = 45_000
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 20

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return fallback
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false
  return fallback
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(String(raw ?? '').trim())
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

function normalizeTickerList(input: string | string[] | undefined | null): string[] {
  const values = Array.isArray(input) ? input : String(input ?? '').split(/[\s,]+/g)
  const normalized = values.map((value) => String(value).trim().toUpperCase()).filter(Boolean)
  const deduped: string[] = []
  for (const ticker of normalized) {
    if (!deduped.includes(ticker)) deduped.push(ticker)
  }
  return deduped
}

function parseDeadlineMs(raw: string | undefined): number | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return ms
}

function resolveConfig(overrides: TrendLaunchSentinelOverrides = {}): TrendLaunchSentinelConfig {
  const envTickers = normalizeTickerList(process.env.TREND_SENTINEL_TICKERS)
  const overrideTickers = normalizeTickerList(overrides.tickers)
  const tickers = overrideTickers.length > 0 ? overrideTickers : envTickers.length > 0 ? envTickers : DEFAULT_TICKERS

  const creatorTokenRaw = String(overrides.creatorToken ?? process.env.TREND_SENTINEL_CREATOR_TOKEN ?? '').trim()
  const creatorToken = isAddress(creatorTokenRaw) ? (creatorTokenRaw.toLowerCase() as `0x${string}`) : null

  const groupId = String(overrides.groupId ?? process.env.TREND_SENTINEL_GROUP_ID ?? DEFAULT_GROUP_ID).trim() || DEFAULT_GROUP_ID
  const pollMs = Math.max(25, parsePositiveInt(String(overrides.pollMs ?? process.env.TREND_SENTINEL_POLL_MS), DEFAULT_POLL_MS))
  const jitterMs = Math.max(0, parsePositiveInt(String(overrides.jitterMs ?? process.env.TREND_SENTINEL_JITTER_MS), DEFAULT_JITTER_MS))
  const maxRuntimeMs = Math.max(
    1000,
    parsePositiveInt(String(overrides.maxRuntimeMs ?? process.env.TREND_SENTINEL_MAX_RUNTIME_MS), DEFAULT_MAX_RUNTIME_MS),
  )
  const maxConsecutiveErrors = Math.max(
    1,
    parsePositiveInt(
      String(overrides.maxConsecutiveErrors ?? process.env.TREND_SENTINEL_MAX_CONSECUTIVE_ERRORS),
      DEFAULT_MAX_CONSECUTIVE_ERRORS,
    ),
  )
  const requireReceipt =
    typeof overrides.requireReceipt === 'boolean'
      ? overrides.requireReceipt
      : parseBoolean(process.env.TREND_SENTINEL_REQUIRE_RECEIPT, true)

  return {
    enabled: parseBoolean(process.env.TREND_SENTINEL_ENABLED, false),
    tickers,
    creatorToken,
    groupId,
    pollMs,
    jitterMs,
    maxRuntimeMs,
    maxConsecutiveErrors,
    requireReceipt,
    deadlineMs: parseDeadlineMs(process.env.TREND_SENTINEL_DEADLINE_ISO),
    alertWebhookUrl: String(process.env.ALERT_WEBHOOK_URL ?? '').trim() || null,
  }
}

async function sendAlert(params: {
  webhookUrl: string | null
  title: string
  severity: 'info' | 'warning' | 'critical'
  details: Record<string, unknown>
}) {
  if (!params.webhookUrl) return
  try {
    await fetch(params.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow: 'zora-trend-launch-sentinel',
        severity: params.severity,
        title: params.title,
        details: params.details,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    logger.warn('[zora/trend-sentinel] alert webhook failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function runTrendLaunchSentinelProcess(params?: {
  overrides?: TrendLaunchSentinelOverrides
  deps?: TrendLaunchSentinelDeps
}): Promise<TrendLaunchSentinelResult> {
  const deps = params?.deps ?? {}
  const now = deps.now ?? (() => Date.now())
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const random = deps.random ?? Math.random
  const config = resolveConfig(params?.overrides)

  const startedAtMs = now()
  const startedAt = new Date(startedAtMs).toISOString()
  const errors: string[] = []
  const deployedTickers: string[] = []
  let iterations = 0
  let attempts = 0
  let consecutiveErrors = 0

  const finish = (status: TrendLaunchSentinelStatus, securedTicker: string | null, txHash: string | null): TrendLaunchSentinelResult => ({
    status,
    securedTicker,
    fallbackUsed: Boolean(securedTicker && securedTicker !== (config.tickers[0] ?? null)),
    txHash,
    iterations,
    attempts,
    deployedTickers,
    errors,
    startedAt,
    finishedAt: new Date(now()).toISOString(),
  })

  if (!config.enabled) return finish('disabled', null, null)
  if (!config.creatorToken || config.tickers.length === 0) return finish('misconfigured', null, null)
  if (config.deadlineMs && now() > config.deadlineMs) return finish('deadline_elapsed', null, null)

  while (now() - startedAtMs < config.maxRuntimeMs) {
    iterations += 1
    if (config.deadlineMs && now() > config.deadlineMs) return finish('deadline_elapsed', null, null)

    let allTickersAlreadyDeployed = true
    let iterationHadError = false

    for (const ticker of config.tickers) {
      let preflight:
        | {
            ticker: string
            tickerHash: string
            predictedAddress: `0x${string}`
            deployed: boolean
          }
        | null = null

      try {
        const p = await preflightTrendTicker({ ticker })
        preflight = {
          ticker: p.ticker,
          tickerHash: p.tickerHash,
          predictedAddress: p.predictedAddress,
          deployed: p.deployed,
        }

        await upsertTrendPrediction({
          ticker: preflight.ticker,
          tickerHash: preflight.tickerHash,
          predictedCoinAddress: preflight.predictedAddress,
          groupId: config.groupId,
          funnelMetadata: {
            source: 'trend_launch_sentinel',
            armedTickers: config.tickers,
          },
        })
      } catch (error) {
        iterationHadError = true
        consecutiveErrors += 1
        const message = `preflight:${ticker}:${error instanceof Error ? error.message : String(error)}`
        errors.push(message)
        logger.warn('[zora/trend-sentinel] preflight failed', { ticker, message, consecutiveErrors })
        if (consecutiveErrors >= config.maxConsecutiveErrors) {
          await sendAlert({
            webhookUrl: config.alertWebhookUrl,
            title: 'Trend sentinel halted (max errors reached)',
            severity: 'critical',
            details: { ticker, consecutiveErrors, message },
          })
          return finish('max_errors', null, null)
        }
        continue
      }

      if (preflight.deployed) {
        if (!deployedTickers.includes(preflight.ticker)) deployedTickers.push(preflight.ticker)
        await markTrendOpDeployed({
          tickerHash: preflight.tickerHash,
          deployedCoinAddress: preflight.predictedAddress,
        })
        continue
      }

      allTickersAlreadyDeployed = false
      attempts += 1
      await markTrendOpDeploying({ tickerHash: preflight.tickerHash })

      try {
        const reserve = await reserveTrendTicker({
          ticker: preflight.ticker,
          creatorToken: config.creatorToken,
          groupId: config.groupId,
          waitForReceipt: config.requireReceipt,
        })

        if (reserve.status === 'deployed' || reserve.status === 'already_deployed' || reserve.deployed) {
          await markTrendOpDeployed({
            tickerHash: preflight.tickerHash,
            txHash: reserve.txHash,
            deployedCoinAddress: reserve.deployedAddress,
            actorWallet: reserve.walletAddress ?? undefined,
          })
        } else {
          await markTrendOpDeploying({
            tickerHash: preflight.tickerHash,
            txHash: reserve.txHash,
            actorWallet: reserve.walletAddress ?? undefined,
          })
        }

        await sendAlert({
          webhookUrl: config.alertWebhookUrl,
          title: 'Trend ticker secured',
          severity: 'info',
          details: {
            ticker: reserve.ticker,
            tickerHash: reserve.tickerHash,
            txHash: reserve.txHash,
            status: reserve.status,
          },
        })
        return finish('secured', reserve.ticker, reserve.txHash)
      } catch (error) {
        iterationHadError = true
        consecutiveErrors += 1
        const message = `reserve:${preflight.ticker}:${error instanceof Error ? error.message : String(error)}`
        errors.push(message)
        await markTrendOpFailed({
          tickerHash: preflight.tickerHash,
          lastError: message.slice(0, 500),
        })
        logger.warn('[zora/trend-sentinel] reserve failed', {
          ticker: preflight.ticker,
          message,
          consecutiveErrors,
        })
        if (consecutiveErrors >= config.maxConsecutiveErrors) {
          await sendAlert({
            webhookUrl: config.alertWebhookUrl,
            title: 'Trend sentinel halted (max errors reached)',
            severity: 'critical',
            details: { ticker: preflight.ticker, consecutiveErrors, message },
          })
          return finish('max_errors', null, null)
        }
      }
    }

    if (allTickersAlreadyDeployed) {
      await sendAlert({
        webhookUrl: config.alertWebhookUrl,
        title: 'All sentinel tickers already deployed',
        severity: 'warning',
        details: { tickers: config.tickers, deployedTickers },
      })
      return finish('lost_all', null, null)
    }

    if (!iterationHadError) {
      consecutiveErrors = 0
    }

    const jitter = config.jitterMs > 0 ? Math.floor(random() * (config.jitterMs + 1)) : 0
    await sleep(config.pollMs + jitter)
  }

  await sendAlert({
    webhookUrl: config.alertWebhookUrl,
    title: 'Trend sentinel timed out',
    severity: 'warning',
    details: {
      tickers: config.tickers,
      attempts,
      errors: errors.slice(-5),
    },
  })
  return finish('timed_out', null, null)
}

