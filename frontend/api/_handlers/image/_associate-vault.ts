import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'
import { getImageGenerationProject, setImageProjectVaultAddress } from '../../../server/_lib/imageProjects.js'

type Body = {
  projectId?: string
  vaultAddress?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return

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
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' })
  if (project.status !== 'completed') {
    return res.status(409).json({ success: false, error: 'Project must be completed before associating a vault' })
  }

  await setImageProjectVaultAddress(projectId, vaultAddress)

  return res.status(200).json({ success: true, data: { projectId, vaultAddress } })
}
