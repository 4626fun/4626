import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { getCompletedImageProjectForVaultOwner } from '../../../server/_lib/image/imageProjects.js'
import { getImageApiActor, prepareImageApiAuthenticated } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const vaultAddress = typeof req.query.vaultAddress === 'string' ? req.query.vaultAddress : null
  if (!vaultAddress || !isAddress(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'vaultAddress must be a valid EVM address' })
  }

  const existing = await getCompletedImageProjectForVaultOwner(vaultAddress, actor).catch(() => null)

  return res.status(200).json({
    success: true,
    data: existing
      ? { outputBlobUrl: existing.outputBlobUrl }
      : null,
  })
}
