import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkDurableRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../server/_lib/deploy/charmVaults.js'
import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import {
  CHARM_BUILD_BODY_MAX_BYTES,
  parseObjectBody,
  requireAddress,
  setPublicCors,
  setRateLimitRetryAfter,
} from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/setCharmVault', kind: 'build' })
  if (!g.ok) return

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-build-charm-set-charm-vault', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildCharmCalldata,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = parseObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CHARM_BUILD_BODY_MAX_BYTES }))
  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const charmVault = requireAddress(body.charmVault, 'charmVault')
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: charmVault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(charmVault))

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'setCharmVault',
      args: [charmVault],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): set Charm vault address.',
      warnings: ['Owner-only onchain action. This API only builds calldata; it does not execute.'],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
