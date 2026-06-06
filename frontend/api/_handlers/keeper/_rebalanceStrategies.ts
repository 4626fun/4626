/**
 * POST /api/keeper/rebalance-strategies
 *
 * HTTP bridge for cross-strategy TVL rebalancing via rebalanceStrategies().
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import {
  executeVaultRebalanceStrategies,
  KeeperVaultActionError,
} from '../../../server/_lib/controlPlane/executors/keeperVaultActions.js'
import { evaluateKeeperStrategyHealthGate } from '../../../server/_lib/keeper/strategyHealthGate.js'
import { parseMinDeviationBps } from '../../../server/_lib/keeper/strategyReallocEnv.js'

function collectErrorText(error: unknown): string {
  const visited = new Set<unknown>()
  const stack: unknown[] = [error]
  const text: string[] = []
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    if (typeof current === 'string') {
      text.push(current)
      continue
    }
    if (current instanceof Error) {
      text.push(current.message)
      stack.push((current as Error & { cause?: unknown }).cause)
      continue
    }
    if (typeof current === 'object') {
      const candidate = current as {
        message?: unknown
        shortMessage?: unknown
        details?: unknown
        reason?: unknown
        data?: unknown
        functionName?: unknown
        cause?: unknown
      }
      text.push(String(candidate.message ?? ''))
      text.push(String(candidate.shortMessage ?? ''))
      text.push(String(candidate.details ?? ''))
      text.push(String(candidate.reason ?? ''))
      text.push(String(candidate.data ?? ''))
      text.push(String(candidate.functionName ?? ''))
      stack.push(candidate.cause)
    }
  }
  return text.join(' ').toLowerCase()
}

function isRawRebalanceInvalidWeight(error: unknown): boolean {
  const message = collectErrorText(error)
  return (
    message.includes('rebalancestrategies') &&
    (message.includes('0x585b9263') || message.includes('invalidweight()'))
  )
}

function isRawRebalanceRevert(error: unknown): boolean {
  const message = collectErrorText(error)
  return message.includes('rebalancestrategies') && message.includes('revert')
}

function logRebalanceSkip(vaultAddress: string, reason: string, source: 'executor' | 'raw_fallback') {
  console.warn('[keeper/rebalance-strategies] skipped', {
    vaultAddress: vaultAddress.toLowerCase(),
    reason,
    source,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-rebalance-strategies', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as {
    vaultAddress?: string
    minDeviationBps?: string | number
  } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const minDeviationBps = BigInt(parseMinDeviationBps(body?.minDeviationBps))
  const healthGate = await evaluateKeeperStrategyHealthGate(vaultAddress)
  if (healthGate.blocked) {
    return res.status(200).json({
      success: false,
      error: 'keeper_rebalance_strategy_health_blocked',
      data: {
        status: 'skipped',
        reason: healthGate.reason ?? 'strategy_health_blocked',
      },
    } satisfies ApiEnvelope<{ status: string; reason: string }>)
  }

  try {
    const result = await executeVaultRebalanceStrategies(vaultAddress, minDeviationBps)
    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<{ txHash: string; status: string }>)
  } catch (err) {
    if (err instanceof KeeperVaultActionError) {
      if (err.code === 'rebalance_strategies_no_strategies') {
        logRebalanceSkip(vaultAddress, 'no_strategies', 'executor')
        return res.status(200).json({
          success: false,
          error: 'keeper_rebalance_no_strategies',
          data: {
            status: 'skipped',
            reason: 'no_strategies',
          },
        } satisfies ApiEnvelope<{ status: string; reason: string }>)
      }
      if (err.code === 'rebalance_strategies_unauthorized') {
        logRebalanceSkip(vaultAddress, 'unauthorized', 'executor')
        return res.status(200).json({
          success: false,
          error: 'keeper_rebalance_unauthorized',
          data: {
            status: 'skipped',
            reason: 'unauthorized',
          },
        } satisfies ApiEnvelope<{ status: string; reason: string }>)
      }
      if (err.code === 'rebalance_strategies_gas_rejected') {
        logRebalanceSkip(vaultAddress, 'gas_rejected', 'executor')
        return res.status(200).json({
          success: false,
          error: 'keeper_rebalance_gas_rejected',
          data: {
            status: 'skipped',
            reason: 'gas_rejected',
          },
        } satisfies ApiEnvelope<{ status: string; reason: string }>)
      }
      if (err.code === 'rebalance_strategies_reverted') {
        logRebalanceSkip(vaultAddress, 'reverted', 'executor')
        return res.status(200).json({
          success: false,
          error: 'keeper_rebalance_reverted',
          data: {
            status: 'skipped',
            reason: 'reverted',
          },
        } satisfies ApiEnvelope<{ status: string; reason: string }>)
      }
      if (err.code === 'rebalance_strategies_invalid_weight') {
        logRebalanceSkip(vaultAddress, 'invalid_weight', 'executor')
        return res.status(200).json({
          success: false,
          error: 'keeper_rebalance_invalid_weight',
          data: {
            status: 'skipped',
            reason: 'invalid_weight',
          },
        } satisfies ApiEnvelope<{ status: string; reason: string }>)
      }
    }
    if (isRawRebalanceInvalidWeight(err)) {
      logRebalanceSkip(vaultAddress, 'invalid_weight', 'raw_fallback')
      return res.status(200).json({
        success: false,
        error: 'keeper_rebalance_invalid_weight',
        data: {
          status: 'skipped',
          reason: 'invalid_weight',
        },
      } satisfies ApiEnvelope<{ status: string; reason: string }>)
    }
    if (isRawRebalanceRevert(err)) {
      logRebalanceSkip(vaultAddress, 'reverted', 'raw_fallback')
      return res.status(200).json({
        success: false,
        error: 'keeper_rebalance_reverted',
        data: {
          status: 'skipped',
          reason: 'reverted',
        },
      } satisfies ApiEnvelope<{ status: string; reason: string }>)
    }
    console.error('[keeper/rebalance-strategies] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
