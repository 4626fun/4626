import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createImageGenerationProject } from '../../../server/_lib/image/imageProjects.js'
import { checkRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '../../../packages/server-core/src/index.js'
import { getImageApiActor, prepareImageApiAuthenticated, readBody } from './_shared.js'

type Body = {
  instruction?: string
  stylePreset?: string | null
  brandContext?: string[]
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
  const limiter = checkRateLimit(rateLimitKey('image:projects-create', getClientIp(req)), RATE_LIMITS.agentCreative)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readBody<Body>(req)
  const project = await createImageGenerationProject({
    ownerAddress: actor,
    instruction: body.instruction,
    stylePreset: body.stylePreset ?? null,
    brandContext: body.brandContext ?? [],
    creatorAddress: actor,
  })

  return res.status(200).json({
    success: true,
    data: {
      project: {
        id: project.id,
        status: project.status,
      },
    },
  })
}
