import type { VercelRequest, VercelResponse } from '@vercel/node'

import { attachImageGenerationAsset, getImageGenerationProject } from '../../../server/_lib/image/imageProjects.js'
import { checkRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '../../../packages/server-core/src/index.js'
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

const ASSET_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
const ASSET_UPLOAD_MAX_BODY_BYTES = 14 * 1024 * 1024
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
])

function normalizeImageContentType(value: string): string {
  return value.trim().toLowerCase()
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
  const limiter = checkRateLimit(rateLimitKey('image:assets-upload', getClientIp(req)), RATE_LIMITS.agentCreative)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  let body: Body
  try {
    body = await readBody<Body>(req, { maxBytes: ASSET_UPLOAD_MAX_BODY_BYTES })
  } catch {
    return res.status(413).json({ success: false, error: 'Asset payload too large' })
  }
  const projectId = parseRequiredString(body.projectId)
  const contentType = parseRequiredString(body.contentType)
  const dataBase64 = parseRequiredString(body.dataBase64)

  if (!projectId || !contentType || !dataBase64 || !isReferenceAssetRole(body.role)) {
    return res.status(400).json({ success: false, error: 'Invalid asset payload' })
  }
  const normalizedContentType = normalizeImageContentType(contentType)
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(normalizedContentType)) {
    return res.status(400).json({ success: false, error: 'Unsupported asset content type' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress?.toLowerCase() !== actor.toLowerCase()) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }

  let bytes: Uint8Array
  try {
    bytes = decodeBase64Payload(dataBase64, { maxBytes: ASSET_UPLOAD_MAX_BYTES })
  } catch {
    return res.status(413).json({ success: false, error: 'Asset payload too large' })
  }

  const asset = await attachImageGenerationAsset({
    projectId,
    role: body.role,
    filename: body.filename ?? null,
    contentType: normalizedContentType,
    bytes,
  })

  return res.status(200).json({
    success: true,
    data: {
      asset,
    },
  })
}
