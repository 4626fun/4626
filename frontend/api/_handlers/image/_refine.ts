import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enqueueImageGenerationJob, getImageGenerationJob } from '../../../server/_lib/imageGenerationJobs.js'
import { processImageGenerationJob } from '../../../server/_lib/imageGenerationRunner.js'
import { parseRequiredString, prepareImageApi, readBody, requireImageApiAdmin } from './_shared.js'

type Body = {
  projectId?: string
  refineInstruction?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApi(req, res)) return
  if (requireImageApiAdmin(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  const refineInstruction = parseRequiredString(body.refineInstruction)
  if (!projectId || !refineInstruction) {
    return res.status(400).json({ success: false, error: 'projectId and refineInstruction are required' })
  }

  const job = await enqueueImageGenerationJob({
    projectId,
    kind: 'refine',
    refineInstruction,
  })
  await processImageGenerationJob(job.id)
  const nextJob = (await getImageGenerationJob(job.id)) ?? job

  return res.status(200).json({
    success: true,
    data: { job: nextJob },
  })
}
