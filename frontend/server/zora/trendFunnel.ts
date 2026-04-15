import type { Address } from 'viem'
import { getAddress, isAddress } from 'viem'

import { getOrCreateCreatorAgentWallet } from '../_lib/creatorAgentWallets.js'
import { logger } from '../_lib/infra/logger.js'
import { walletRpc } from '../_lib/privyWalletApi.js'
import { markTrendOpFailed, markTrendOpFunnelCompleted, markTrendOpFunnelPending } from '../_lib/zoraTrendOpsStore.js'

declare const process: { env: Record<string, string | undefined> }

const BASE_CHAIN_ID = 8453
const DEFAULT_MAX_SLIPPAGE_BPS = 300
const DEFAULT_ROUTEABILITY_REQUIRED = true
const DEFAULT_ROUTEABILITY_SELL_AMOUNT = 1_000_000_000_000_000_000n // 1 token at 18 decimals

type QuoteToken = { type: 'eth' } | { type: 'erc20'; address: string }

export type TrendFunnelConfig = {
  automationEnabled: boolean
  flywheelEnabled: boolean
  maxNotionalWei: bigint
  maxSlippageBps: number
  routeabilityRequired: boolean
  targetToken: `0x${string}` | null
  allowedTickers: Set<string> | null
}

export type RouteabilityLeg = {
  ok: boolean
  error?: string
}

export type TrendRouteabilityResult = {
  passed: boolean
  buy: RouteabilityLeg
  sell: RouteabilityLeg
}

export type TrendFunnelRunResult = {
  status: 'skipped_disabled' | 'skipped_guardrail' | 'blocked_routeability' | 'failed' | 'executed'
  reason?: string
  routeability: TrendRouteabilityResult
  action: {
    executed: boolean
    targetToken: `0x${string}` | null
    amountInWei: string | null
    txHash: string | null
  }
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.floor(n)
}

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  try {
    const value = BigInt(raw)
    return value >= 0n ? value : fallback
  } catch {
    return fallback
  }
}

function parseAllowedTickers(raw: string): Set<string> | null {
  const values = String(raw ?? '')
    .split(/[\s,]+/g)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean)
  if (values.length === 0) return null
  return new Set(values)
}

function normalizeTicker(ticker: string): string {
  return String(ticker ?? '').trim().toUpperCase()
}

function normalizeTargetToken(raw: string | undefined): `0x${string}` | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (!isAddress(value)) return null
  return getAddress(value).toLowerCase() as `0x${string}`
}

function buildTrendFunnelIdempotencyKey(params: {
  groupId: string
  tickerHash: string
  amountInWei: bigint
  targetToken: `0x${string}`
}): string {
  const group = String(params.groupId ?? '').trim().toLowerCase() || 'unknown'
  const tickerHash = String(params.tickerHash ?? '').trim().toLowerCase() || 'unknown'
  const amount = params.amountInWei.toString()
  const target = String(params.targetToken).toLowerCase()
  return `trend-funnel:${group}:${tickerHash}:${amount}:${target}`
}

function withDefaultRouteability(reason = 'not_run'): TrendRouteabilityResult {
  return {
    passed: false,
    buy: { ok: false, error: reason },
    sell: { ok: false, error: reason },
  }
}

export function readTrendFunnelConfig(): TrendFunnelConfig {
  return {
    automationEnabled: parseBooleanEnv('ZORA_TREND_AUTOMATION_ENABLED', false),
    flywheelEnabled: parseBooleanEnv('ZORA_TREND_FLYWHEEL_ENABLED', false),
    maxNotionalWei: parseBigIntEnv('ZORA_TREND_MAX_NOTIONAL_WEI', 0n),
    maxSlippageBps: Math.max(1, Math.min(parseIntEnv('ZORA_TREND_MAX_SLIPPAGE_BPS', DEFAULT_MAX_SLIPPAGE_BPS), 5000)),
    routeabilityRequired: parseBooleanEnv('ZORA_TREND_ROUTEABILITY_REQUIRED', DEFAULT_ROUTEABILITY_REQUIRED),
    targetToken: normalizeTargetToken(process.env.ZORA_TREND_FLYWHEEL_TARGET_TOKEN),
    allowedTickers: parseAllowedTickers(process.env.ZORA_TREND_ALLOWED_TICKERS ?? ''),
  }
}

function isTickerAllowed(ticker: string, allowed: Set<string> | null): boolean {
  if (!allowed || allowed.size === 0) return true
  return allowed.has(normalizeTicker(ticker))
}

async function fetchZoraQuote(params: {
  sender: string
  tokenIn: QuoteToken
  tokenOut: QuoteToken
  amountIn: bigint
  slippageBps: number
}): Promise<{ ok: true; call: { target: string; data: string; value: string } } | { ok: false; error: string }> {
  const apiKey = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  const body = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn.toString(),
    slippage: params.slippageBps / 10_000,
    chainId: BASE_CHAIN_ID,
    sender: params.sender,
    recipient: params.sender,
  }

  const response = await fetch('https://api-sdk.zora.engineering/quote', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    return { ok: false, error: `quote_${response.status}:${text.slice(0, 200)}` }
  }

  const payload = (await response.json()) as any
  const call = payload?.call
  if (!call?.target || !call?.data) return { ok: false, error: 'quote_invalid_call_data' }

  return {
    ok: true,
    call: {
      target: String(call.target),
      data: String(call.data),
      value: String(call.value ?? '0x0'),
    },
  }
}

export async function runTrendRouteabilityChecks(params: {
  trendCoinAddress: `0x${string}`
  senderWallet: `0x${string}`
  notionalWei: bigint
  slippageBps: number
}): Promise<TrendRouteabilityResult> {
  const buyQuote = await fetchZoraQuote({
    sender: params.senderWallet,
    tokenIn: { type: 'eth' },
    tokenOut: { type: 'erc20', address: params.trendCoinAddress },
    amountIn: params.notionalWei,
    slippageBps: params.slippageBps,
  })
  if (!buyQuote.ok) {
    return {
      passed: false,
      buy: { ok: false, error: buyQuote.error },
      sell: { ok: false, error: 'skipped_after_buy_failure' },
    }
  }

  const sellQuote = await fetchZoraQuote({
    sender: params.senderWallet,
    tokenIn: { type: 'erc20', address: params.trendCoinAddress },
    tokenOut: { type: 'eth' },
    amountIn: DEFAULT_ROUTEABILITY_SELL_AMOUNT,
    slippageBps: params.slippageBps,
  })
  if (!sellQuote.ok) {
    return {
      passed: false,
      buy: { ok: true },
      sell: { ok: false, error: sellQuote.error },
    }
  }

  return { passed: true, buy: { ok: true }, sell: { ok: true } }
}

export async function runTrendFunnel(params: {
  ticker: string
  tickerHash: string
  trendCoinAddress: `0x${string}`
  creatorToken: `0x${string}`
  groupId: string
  notionalWei?: bigint
}): Promise<TrendFunnelRunResult> {
  const config = readTrendFunnelConfig()
  const emptyRouteability = withDefaultRouteability('not_run')
  const normalizedTicker = normalizeTicker(params.ticker)

  if (!config.automationEnabled || !config.flywheelEnabled) {
    return {
      status: 'skipped_disabled',
      reason: 'trend_automation_disabled',
      routeability: emptyRouteability,
      action: { executed: false, targetToken: config.targetToken, amountInWei: null, txHash: null },
    }
  }
  if (!isTickerAllowed(normalizedTicker, config.allowedTickers)) {
    return {
      status: 'skipped_guardrail',
      reason: 'ticker_not_allowlisted',
      routeability: emptyRouteability,
      action: { executed: false, targetToken: config.targetToken, amountInWei: null, txHash: null },
    }
  }
  if (config.maxNotionalWei <= 0n) {
    return {
      status: 'skipped_guardrail',
      reason: 'max_notional_not_configured',
      routeability: emptyRouteability,
      action: { executed: false, targetToken: config.targetToken, amountInWei: null, txHash: null },
    }
  }
  if (!config.targetToken) {
    return {
      status: 'skipped_guardrail',
      reason: 'flywheel_target_token_missing',
      routeability: emptyRouteability,
      action: { executed: false, targetToken: null, amountInWei: null, txHash: null },
    }
  }

  const requestedNotional = params.notionalWei && params.notionalWei > 0n ? params.notionalWei : config.maxNotionalWei
  const boundedNotional = requestedNotional > config.maxNotionalWei ? config.maxNotionalWei : requestedNotional

  try {
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.creatorToken })
    const routeability = await runTrendRouteabilityChecks({
      trendCoinAddress: params.trendCoinAddress,
      senderWallet: wallet.address,
      notionalWei: boundedNotional,
      slippageBps: config.maxSlippageBps,
    })

    if (params.tickerHash) {
      await markTrendOpFunnelPending({
        tickerHash: params.tickerHash,
        routeability,
      })
    }

    if (config.routeabilityRequired && !routeability.passed) {
      return {
        status: 'blocked_routeability',
        reason: 'trend_routeability_failed',
        routeability,
        action: {
          executed: false,
          targetToken: config.targetToken,
          amountInWei: boundedNotional.toString(),
          txHash: null,
        },
      }
    }

    const actionQuote = await fetchZoraQuote({
      sender: wallet.address,
      tokenIn: { type: 'eth' },
      tokenOut: { type: 'erc20', address: config.targetToken },
      amountIn: boundedNotional,
      slippageBps: config.maxSlippageBps,
    })
    if (!actionQuote.ok) {
      if (params.tickerHash) {
        await markTrendOpFailed({
          tickerHash: params.tickerHash,
          lastError: `funnel_quote_failed:${actionQuote.error}`,
        })
      }
      return {
        status: 'failed',
        reason: actionQuote.error,
        routeability,
        action: {
          executed: false,
          targetToken: config.targetToken,
          amountInWei: boundedNotional.toString(),
          txHash: null,
        },
      }
    }

    const tx = await walletRpc<any>({
      walletId: wallet.walletId,
      method: 'eth_sendTransaction',
      rpcParams: {
        transaction: {
          to: actionQuote.call.target,
          data: actionQuote.call.data,
          value: actionQuote.call.value
            ? `0x${BigInt(actionQuote.call.value).toString(16)}`
            : '0x0',
          chain_id: BASE_CHAIN_ID,
        },
      },
      idempotencyKey: buildTrendFunnelIdempotencyKey({
        groupId: params.groupId,
        tickerHash: params.tickerHash,
        amountInWei: boundedNotional,
        targetToken: config.targetToken,
      }),
      teeContext: {
        action: 'zora_trend_funnel',
        actorAddress: wallet.address,
        metadata: {
          ticker: normalizedTicker,
          tickerHash: params.tickerHash,
          trendCoinAddress: params.trendCoinAddress,
          targetToken: config.targetToken,
        },
      },
    })

    const txHashRaw = String(tx?.data?.hash ?? tx?.hash ?? '').trim()
    const txHash = txHashRaw && /^0x[a-fA-F0-9]+$/.test(txHashRaw) ? txHashRaw : null
    if (!txHash) {
      if (params.tickerHash) {
        await markTrendOpFailed({
          tickerHash: params.tickerHash,
          lastError: 'funnel_tx_hash_missing',
        })
      }
      return {
        status: 'failed',
        reason: 'funnel_tx_hash_missing',
        routeability,
        action: {
          executed: false,
          targetToken: config.targetToken,
          amountInWei: boundedNotional.toString(),
          txHash: null,
        },
      }
    }

    if (params.tickerHash) {
      await markTrendOpFunnelCompleted({
        tickerHash: params.tickerHash,
        funnelMetrics: {
          ticker: normalizedTicker,
          targetToken: config.targetToken,
          amountInWei: boundedNotional.toString(),
          txHash,
          routeabilityPassed: routeability.passed,
          executedAt: new Date().toISOString(),
        },
      })
    }

    return {
      status: 'executed',
      routeability,
      action: {
        executed: true,
        targetToken: config.targetToken,
        amountInWei: boundedNotional.toString(),
        txHash,
      },
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.error('[zora/trend-funnel] run failed', {
      ticker: normalizedTicker,
      tickerHash: params.tickerHash,
      reason,
    })
    if (params.tickerHash) {
      await markTrendOpFailed({
        tickerHash: params.tickerHash,
        lastError: reason.slice(0, 500),
      })
    }
    return {
      status: 'failed',
      reason,
      routeability: withDefaultRouteability('funnel_exception'),
      action: {
        executed: false,
        targetToken: readTrendFunnelConfig().targetToken,
        amountInWei: null,
        txHash: null,
      },
    }
  }
}

