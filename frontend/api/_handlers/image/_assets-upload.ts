import type { VercelRequest, VercelResponse } from '@vercel/node'

import { attachImageGenerationAsset, getImageGenerationProject } from '../../../server/_lib/imageProjects.js'
import {
  decodeBase64Payload,
  getImageApiActor,
  isReferenceAssetRole,
  parseRequiredString,
  prepareImageApiAuthenticated,
  readBody,
} from './_shared.js'

type Body = {
  projectId?: string
  role?: string
  filename?: string | null
  contentType?: string
  dataBase64?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  const contentType = parseRequiredString(body.contentType)
  const dataBase64 = parseRequiredString(body.dataBase64)

  if (!projectId || !contentType || !dataBase64 || !isReferenceAssetRole(body.role)) {
    return res.status(400).json({ success: false, error: 'Invalid asset payload' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }

  const asset = await attachImageGenerationAsset({
    projectId,
    role: body.role,
    filename: body.filename ?? null,
    contentType,
    bytes: decodeBase64Payload(dataBase64),
  })

  return res.status(200).json({
    success: true,
    data: {
      asset,
    },
  })
}
