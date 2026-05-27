import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import {
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { getStringQuery, isAddressLike } from '../../../server/debank/_shared.js'
import { readTokenBalance } from '../../../server/_lib/wallet/readTokenBalance.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const ownerRaw = getStringQuery(req, 'owner')
  const tokenRaw = getStringQuery(req, 'token')
  if (!ownerRaw || !tokenRaw) {
    return res.status(400).json({ success: false, error: 'Missing owner or token' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressLike(ownerRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid owner address' } satisfies ApiEnvelope<never>)
  }

  const tokenLower = tokenRaw.trim().toLowerCase()
  if (tokenLower !== '0x0000000000000000000000000000000000000000' && !isAddress(tokenRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid token address' } satisfies ApiEnvelope<never>)
  }

  try {
    const data = await readTokenBalance({
      ownerAddress: getAddress(ownerRaw) as Address,
      tokenAddress: tokenRaw,
    })
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<typeof data>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'token_balance_read_failed'
    return res.status(502).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
