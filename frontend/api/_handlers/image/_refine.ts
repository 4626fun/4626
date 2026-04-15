import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enqueueImageGenerationJob, getImageGenerationJob } from '../../../server/_lib/image/imageGenerationJobs.js'
import { getImageGenerationProject } from '../../../server/_lib/image/imageProjects.js'
import { processImageGenerationJob } from '../../../server/_lib/image/imageGenerationRunner.js'
import { checkRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '../../../packages/server-core/src/index.js'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'

type Body = {
  projectId?: string
  refineInstruction?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }
  const limiter = checkRateLimit(rateLimitKey('image:refine', getClientIp(req)), RATE_LIMITS.agentCreative)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  const refineInstruction = parseRequiredString(body.refineInstruction)
  if (!projectId || !refineInstruction) {
    return res.status(400).json({ success: false, error: 'projectId and refineInstruction are required' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Project not found' })
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
