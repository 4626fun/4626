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


import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../../server/_lib/deploy/charmVaults.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import {
  CHARM_BUILD_BODY_MAX_BYTES,
  parseObjectBody,
  requireAddress,
  setPublicCors,
  setRateLimitRetryAfter,
} from '../_shared.js'

type SetMode = 'delegate' | 'manager'

type Body = {
  vault: Address
  strategy: Address
  mode?: SetMode
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/vault/setStrategy', kind: 'build' })
  if (!g.ok) return

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-build-charm-vault-set-strategy', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildCharmCalldata,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = parseObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CHARM_BUILD_BODY_MAX_BYTES }))
  try {
    const vault = requireAddress(body.vault, 'vault')
    const strategy = requireAddress(body.strategy, 'strategy')
    const modeRaw = typeof body.mode === 'string' ? body.mode : 'delegate'
    if (modeRaw !== 'delegate' && modeRaw !== 'manager') {
      throw new Error('mode must be one of: delegate, manager')
    }
    const mode: SetMode = modeRaw
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: vault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(vault))

    const data = encodeFunctionData({
      abi: CHARM_ALPHA_VAULT_ABI,
      functionName: mode === 'manager' ? 'setManager' : 'setRebalanceDelegate',
      args: [strategy],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description:
        mode === 'manager'
          ? 'Charm/AlphaVault (governance): set manager address.'
          : 'Charm/AlphaVault (governance): set rebalance delegate address.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: manager/delegate updates are governance-only.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
