import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enqueueImageGenerationJob, getImageGenerationJob } from '../../../server/_lib/imageGenerationJobs.js'
import { processImageGenerationJob } from '../../../server/_lib/imageGenerationRunner.js'
import { parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'
type Body = {
  projectId?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'projectId is required' })
  }

  const job = await enqueueImageGenerationJob({
    projectId,
    kind: 'generate',
  })
  await processImageGenerationJob(job.id)
  const nextJob = (await getImageGenerationJob(job.id)) ?? job

  return res.status(200).json({
    success: true,
    data: { job: nextJob },
  })
}
