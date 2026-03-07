import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enqueueImageGenerationJob } from '../../../server/_lib/imageGenerationJobs.js'
import { parseRequiredString, prepareImageApi, readBody } from './_shared.js'

type Body = {
  projectId?: string
  refineInstruction?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApi(req, res)) return

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

  return res.status(200).json({
    success: true,
    data: { job },
  })
}
