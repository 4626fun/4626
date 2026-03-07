import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getImageGenerationJob } from '../../../server/_lib/imageGenerationJobs.js'
import { processImageGenerationJob } from '../../../server/_lib/imageGenerationRunner.js'
import { parseRequiredString, prepareImageApi } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApi(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const jobId = parseRequiredString(req.query.jobId)
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId is required' })
  }

  let job = await getImageGenerationJob(jobId)
  if (job && (job.status === 'pending' || job.status === 'processing')) {
    await processImageGenerationJob(jobId)
    job = await getImageGenerationJob(jobId)
  }
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' })
  }

  return res.status(200).json({
    success: true,
    data: { job },
  })
}
