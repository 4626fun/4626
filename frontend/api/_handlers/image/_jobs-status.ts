import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getImageGenerationJob } from '../../../server/_lib/image/imageGenerationJobs.js'
import { getImageGenerationProject } from '../../../server/_lib/image/imageProjects.js'
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

  const jobId = parseRequiredString(req.query.jobId)
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId is required' })
  }

  const job = await getImageGenerationJob(jobId)
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' })
  }
  const project = await getImageGenerationProject(job.projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Job not found' })
  }

  return res.status(200).json({
    success: true,
    data: { job },
  })
}
