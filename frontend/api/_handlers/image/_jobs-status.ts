import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getImageGenerationJob } from '../../../server/_lib/imageGenerationJobs.js'
import { parseRequiredString, prepareImageApi, requireImageApiAdmin } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApi(req, res)) return
  if (requireImageApiAdmin(req, res)) return

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

  return res.status(200).json({
    success: true,
    data: { job },
  })
}
