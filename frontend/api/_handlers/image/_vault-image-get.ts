import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getCompletedImageProjectForVault } from '../../../server/_lib/imageProjects.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const vaultAddress = typeof req.query.vaultAddress === 'string' ? req.query.vaultAddress : null
  if (!vaultAddress || !isAddress(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'vaultAddress must be a valid EVM address' })
  }

  const existing = await getCompletedImageProjectForVault(vaultAddress).catch(() => null)

  return res.status(200).json({
    success: true,
    data: existing
      ? { projectId: existing.projectId, outputBlobUrl: existing.outputBlobUrl }
      : null,
  })
}
