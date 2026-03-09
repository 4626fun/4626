import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createImageGenerationProject } from '../../../server/_lib/imageProjects.js'
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
  const body = await readBody<Body>(req)
  const project = await createImageGenerationProject({
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
