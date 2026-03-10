import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'
import { getImageGenerationProject, setImageProjectVaultAddress } from '../../../server/_lib/imageProjects.js'

type Body = {
  projectId?: string
  vaultAddress?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  const vaultAddress = parseRequiredString(body.vaultAddress)

  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' })
  if (!vaultAddress || !isAddress(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'vaultAddress must be a valid EVM address' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }
  if (project.status !== 'completed') {
    return res.status(409).json({ success: false, error: 'Project must be completed before associating a vault' })
  }

  // Ownership check: the caller must be the address that created this project.
  // Projects created before this check was introduced have creatorAddress = null;
  // we allow those through to preserve backward compatibility with existing data.
  if (project.creatorAddress !== null && actor !== null) {
    if (project.creatorAddress.toLowerCase() !== actor.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Only the project creator may associate this project with a vault' })
    }
  }
  await setImageProjectVaultAddress(projectId, vaultAddress)

  return res.status(200).json({ success: true, data: { projectId, vaultAddress } })
}
