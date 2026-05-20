import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import {
  type ApiEnvelope,
  getClientIp,
  getDb,
  checkRateLimit,
  handleOptions,
  isDbConfigured,
  rateLimitKey,
  RATE_LIMITS,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  ETHOS_PAID_REFRESH_PRICE_DISPLAY,
  ETHOS_PAID_REFRESH_PRICE_USDC,
  ethosPaidRefreshCooldownMinutes,
  getEthosPaidRefreshCooldown,
} from '../../../../server/_lib/creatorEthos/paidRefresh.js'
import { resolveProtocolTreasuryForUsdcPayments } from '../../../../server/_lib/creatorStrategy/usdcPayment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('creator-ethos-refresh-config', getClientIp(req)), RATE_LIMITS.smartWalletOwnerRead)
  if (!limiter.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const creatorParam = typeof req.query.creatorAddress === 'string' ? req.query.creatorAddress.trim() : ''
  let cooldown = { inCooldown: false, retryAfterSeconds: null as number | null, lastOrderAt: null as string | null }
  if (isAddress(creatorParam) && isDbConfigured()) {
    const db = await getDb()
    if (db) {
      cooldown = await getEthosPaidRefreshCooldown({ db, creatorAddress: getAddress(creatorParam as Address).toLowerCase() })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      priceUsdc: ETHOS_PAID_REFRESH_PRICE_USDC.toString(),
      priceDisplay: ETHOS_PAID_REFRESH_PRICE_DISPLAY,
      treasury: resolveProtocolTreasuryForUsdcPayments(),
      cooldownMinutes: ethosPaidRefreshCooldownMinutes(),
      cooldown,
    },
  } satisfies ApiEnvelope<{
    priceUsdc: string
    priceDisplay: string
    treasury: Address
    cooldownMinutes: number
    cooldown: typeof cooldown
  }>)
}
