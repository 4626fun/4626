/**
 * POST /api/keeper/report
 *
 * HTTP bridge endpoint for keeper workflows. Accepts a vault address and
 * executes the `report()` call using the keeper wallet.
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
import { createPublicClient, createWalletClient, http, type Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { evaluateKeeperStrategyHealthGate } from '../../../server/_lib/keeper/strategyHealthGate.js'

const VAULT_ABI = [
  { type: 'function', name: 'report', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable' },
] as const

function isKnownKeeperReportGasRejection(error: unknown): boolean {
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
      const candidate = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown }
      text.push(String(candidate.message ?? ''))
      text.push(String(candidate.shortMessage ?? ''))
      text.push(String(candidate.details ?? ''))
      stack.push(candidate.cause)
    }
  }
  const message = text.join(' ').toLowerCase()
  return (
    message.includes('gas required exceeds allowance (0)') ||
    message.includes('insufficient funds for gas') ||
    message.includes('estimate gas execution reverted') ||
    message.includes('insufficient funds') ||
    message.includes('intrinsic gas too low')
  )
}

function isKnownKeeperReportAuthorizationRejection(error: unknown): boolean {
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
      const candidate = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown }
      text.push(String(candidate.message ?? ''))
      text.push(String(candidate.shortMessage ?? ''))
      text.push(String(candidate.details ?? ''))
      stack.push(candidate.cause)
    }
  }
  const message = text.join(' ').toLowerCase()
  return (
    message.includes('0x82b42900') ||
    message.includes('unauthorized()')
  )
}

function isKnownKeeperReportValuationNotReady(error: unknown): boolean {
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
      const candidate = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown }
      text.push(String(candidate.message ?? ''))
      text.push(String(candidate.shortMessage ?? ''))
      text.push(String(candidate.details ?? ''))
      stack.push(candidate.cause)
    }
  }
  const message = text.join(' ').toLowerCase()
  return (
    message.includes('0xc61cfeb8') ||
    message.includes('strategyvaluationnotready(address)') ||
    message.includes('strategy valuation not ready')
  )
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
    rateLimitKey('keeper-report', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as { vaultAddress?: string } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const healthGate = await evaluateKeeperStrategyHealthGate(vaultAddress)
  if (healthGate.blocked) {
    return res.status(200).json({
      success: false,
      error: 'keeper_report_strategy_health_blocked',
      data: {
        status: 'skipped',
        reason: healthGate.reason ?? 'strategy_health_blocked',
      },
    } satisfies ApiEnvelope<{ status: string; reason: string }>)
  }

  const keeperPk = process.env.KPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const account = privateKeyToAccount(keeperPk as `0x${string}`)
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
    const keeperBalanceWei = await publicClient.getBalance({ address: account.address })
    if (keeperBalanceWei <= 0n) {
      console.warn('[keeper/report] skipped: keeper wallet has zero native balance', {
        keeper: account.address,
        vaultAddress,
      })
      return res.status(200).json({
        success: false,
        error: 'keeper_report_wallet_unfunded',
        data: {
          status: 'skipped',
          reason: 'wallet_unfunded',
          keeper: account.address,
          vaultAddress,
        },
      } satisfies ApiEnvelope<{ status: string; reason: string; keeper: string; vaultAddress: string }>)
    }

    const txHash = await walletClient.writeContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI as unknown as Abi,
      functionName: 'report',
      chain: base,
      account,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })

    return res.status(200).json({
      success: true,
      data: {
        txHash,
        status: receipt.status === 'success' ? 'success' : 'reverted',
      },
    } satisfies ApiEnvelope<{ txHash: string; status: string }>)
  } catch (err) {
    if (isKnownKeeperReportGasRejection(err)) {
      console.warn('[keeper/report] known gas rejection', {
        message: err instanceof Error ? err.message : String(err),
      })
      return res.status(200).json({
        success: false,
        error: 'keeper_report_gas_rejected',
        data: {
          status: 'skipped',
          reason: 'gas_rejected',
        },
      } satisfies ApiEnvelope<{ status: string; reason: string }>)
    }
    if (isKnownKeeperReportAuthorizationRejection(err)) {
      console.warn('[keeper/report] known authorization rejection', {
        message: err instanceof Error ? err.message : String(err),
      })
      return res.status(200).json({
        success: false,
        error: 'keeper_report_unauthorized',
        data: {
          status: 'skipped',
          reason: 'unauthorized',
        },
      } satisfies ApiEnvelope<{ status: string; reason: string }>)
    }
    if (isKnownKeeperReportValuationNotReady(err)) {
      console.warn('[keeper/report] valuation not ready', {
        message: err instanceof Error ? err.message : String(err),
      })
      return res.status(200).json({
        success: false,
        error: 'keeper_report_strategy_valuation_not_ready',
        data: {
          status: 'skipped',
          reason: 'strategy_valuation_not_ready',
        },
      } satisfies ApiEnvelope<{ status: string; reason: string }>)
    }
    console.error('[keeper/report] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
