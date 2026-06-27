import type { VercelRequest, VercelResponse } from '@vercel/node'

import { checkDurableRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '@4626/server-core'
import { downloadImageStorageObject } from '../../../server/_lib/image/imageStorage.js'
import { generateShareTokenNeonBreakoutImage } from '../../../server/_lib/image/openaiImage.js'
import {
  createOutputImageGenerationAsset,
  getImageGenerationProject,
  updateImageGenerationProject,
} from '../../../server/_lib/image/imageProjects.js'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'

type Body = { projectId?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const actor = getImageApiActor(req)
  if (!actor) return res.status(401).json({ success: false, error: 'Sign in required' })
  const limiter = await checkDurableRateLimit(rateLimitKey('image:direct-compose', getClientIp(req)), RATE_LIMITS.agentCreative, { failClosed: true })
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' })

  const project = await getImageGenerationProject(projectId)
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' })
  if (String(project.ownerAddress ?? '').toLowerCase() !== actor.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Not authorized for this project' })
  }

  const assets = (project.assets as any[]) ?? []
  const frameAsset = assets.find((a) => a.role === 'frame') ?? null
  const subjectAsset = assets.find((a) => a.role === 'subject') ?? null
  const existingOutput = assets.find((a) => a.role === 'output') ?? null

  // Idempotency: if this project was already composed successfully, return the
  // existing output rather than re-running the OpenAI edit pipeline.
  if (project.status === 'completed' && existingOutput) {
    return res.status(200).json({
      success: true,
      data: {
        outputAssetId: existingOutput.id,
        outputBlobUrl: existingOutput.blobUrl,
        breakoutApplied: true,
        cached: true,
      },
    })
  }

  // Concurrency guard: refuse a second compose while one is already in flight.
  if (project.status === 'generating') {
    return res.status(409).json({ success: false, error: 'Composition already in progress for this project' })
  }

  if (!frameAsset || !subjectAsset) {
    return res.status(409).json({ success: false, error: 'Frame and subject assets must be provisioned first' })
  }

  await updateImageGenerationProject({ projectId, status: 'generating', latestError: null })

  try {
    const [frame, subject] = await Promise.all([
      downloadImageStorageObject(frameAsset.blobPathname),
      downloadImageStorageObject(subjectAsset.blobPathname),
    ])

    const generation = await generateShareTokenNeonBreakoutImage({
      subjectBytes: subject.bytes,
      subjectContentType: subject.contentType ?? subjectAsset.mimeType,
      frameBytes: frame.bytes,
      frameContentType: frame.contentType ?? frameAsset.mimeType,
    })

    const outputAsset = await createOutputImageGenerationAsset({
      projectId,
      filename: 'direct-compose.png',
      contentType: 'image/png',
      bytes: generation.imageBytes,
    })

    await updateImageGenerationProject({ projectId, status: 'completed', latestError: null })

    return res.status(200).json({
      success: true,
      data: {
        outputAssetId: outputAsset.id,
        outputBlobUrl: outputAsset.blobUrl,
        breakoutApplied: generation.breakoutApplied,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateImageGenerationProject({ projectId, status: 'failed', latestError: message })
    return res.status(500).json({ success: false, error: message })
  }
}
