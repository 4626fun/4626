import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getImageGenerationProject } from '../../../server/_lib/imageProjects.js'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const projectId = parseRequiredString(req.query.projectId)
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'projectId is required' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }

  return res.status(200).json({
    success: true,
    data: { project },
  })
}
