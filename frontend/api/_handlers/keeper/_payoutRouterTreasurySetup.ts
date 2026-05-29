/**
 * POST /api/keeper/payout-router-treasury-setup
 *
 * Protocol-treasury lane for PayoutRouter admin wiring:
 * setKeeper, setSwapPath (WETH/ZORA), and external swap approvals.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, getAddress, http, isAddress, type Hex } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
} from '@4626/server-core'
import {
  buildPayoutRouterTreasurySetupPlan,
  executePayoutRouterTreasurySetup,
} from '../../../server/_lib/onchain/payoutRouterTreasurySetup.js'

type SetupBody = {
  payoutRouterAddress?: string
  creatorTokenAddress?: string
  creatorCoinAddress?: string
  execute?: boolean
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return isAddress(raw) ? (getAddress(raw) as `0x${string}`) : null
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
    rateLimitKey('keeper-payout-router-treasury-setup', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody<SetupBody>(req, { maxBytes: 8_192 })) ?? {}
  const payoutRouter = normalizeAddress(body.payoutRouterAddress)
  const creatorToken =
    normalizeAddress(body.creatorTokenAddress) ?? normalizeAddress(body.creatorCoinAddress)
  if (!payoutRouter || !creatorToken) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payoutRouterAddress or creatorTokenAddress',
    } satisfies ApiEnvelope<never>)
  }

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

  try {
    if (body.execute === true) {
      const result = await executePayoutRouterTreasurySetup({
        publicClient: publicClient as any,
        rpcUrl,
        payoutRouter,
        creatorToken,
      })
      return res.status(200).json({
        success: true,
        data: {
          mode: 'execute',
          executed: result.executed,
          txHash: result.txHash ?? null,
          safeAddress: result.safeAddress ?? null,
          signerAddress: result.signerAddress ?? null,
          plan: result.plan,
        },
      } satisfies ApiEnvelope<unknown>)
    }

    const plan = await buildPayoutRouterTreasurySetupPlan({
      publicClient: publicClient as any,
      payoutRouter,
      creatorToken,
    })
    return res.status(200).json({
      success: true,
      data: {
        mode: 'dry-run',
        executed: false,
        plan,
      },
    } satisfies ApiEnvelope<unknown>)
  } catch (error) {
    console.error('[keeper/payout-router-treasury-setup] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
