import type { VercelRequest, VercelResponse } from '@vercel/node'
import sharp from 'sharp'

import { checkRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '@4626/server-core'
import { downloadImageStorageObject } from '../../../server/_lib/image/imageStorage.js'
import { extractForegroundFromSubjectImageBytes } from '../../../server/_lib/image/imageForegroundExtraction.js'
import { composeLockedFrameImage } from '../../../server/_lib/image/imageCompositor.js'
import {
  createOutputImageGenerationAsset,
  getImageGenerationProject,
  updateImageGenerationProject,
} from '../../../server/_lib/image/imageProjects.js'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'

type Body = { projectId?: string }

async function detectForegroundTopBound(fgBytes: Uint8Array, threshold = 16): Promise<number> {
  const { data, info } = await sharp(Buffer.from(fgBytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] >= threshold) return y
    }
  }
  return 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const actor = getImageApiActor(req)
  if (!actor) return res.status(401).json({ success: false, error: 'Sign in required' })
  const limiter = checkRateLimit(rateLimitKey('image:direct-compose', getClientIp(req)), RATE_LIMITS.agentCreative)
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
  // existing output rather than re-running the entire sharp pipeline. This makes
  // retries and React StrictMode double-invocations safe.
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
  // A stuck `generating` project should be reset via admin tooling or will be
  // re-attempted if the client retries after the Vercel function timeout (60 s).
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

    // Crop enough of the photo to show head + torso; 0.9 keeps the body visible
    // inside the frame while the ears break out above the ring.
    const PORTRAIT_CROP_RATIO = 0.9
    const srcMeta = await sharp(Buffer.from(subject.bytes)).metadata()
    const srcH = srcMeta.height ?? 1000
    const srcW = srcMeta.width ?? 1000
    const croppedBytes = new Uint8Array(
      await sharp(Buffer.from(subject.bytes))
        .extract({ left: 0, top: 0, width: srcW, height: Math.round(srcH * PORTRAIT_CROP_RATIO) })
        .png()
        .toBuffer()
    )

    // Extract foreground from the same cropped source so artwork + breakout
    // are at the same scale (no double-subject ghost effect).
    const rawFgBytes = await extractForegroundFromSubjectImageBytes(croppedBytes)

    // Detect the first row that has opaque foreground pixels (where the ears
    // actually start) and trim both the crop and the foreground to that row.
    // Without this, blank background above the ears shifts the subject down
    // inside the content box, causing the breakout ears to appear far above
    // the interior ears rather than flowing through the frame seamlessly.
    const topBound = rawFgBytes ? await detectForegroundTopBound(rawFgBytes) : 0
    const cropMeta = await sharp(Buffer.from(croppedBytes)).metadata()
    const cW = cropMeta.width ?? srcW
    const cH = cropMeta.height ?? Math.round(srcH * PORTRAIT_CROP_RATIO)
    const trimH = cH - topBound
    const extractedForegroundBytes =
      rawFgBytes && topBound > 0
        ? new Uint8Array(
            await sharp(Buffer.from(rawFgBytes))
              .extract({ left: 0, top: topBound, width: cW, height: trimH })
              .png()
              .toBuffer(),
          )
        : rawFgBytes
    const trimmedCropBytes =
      topBound > 0
        ? new Uint8Array(
            await sharp(Buffer.from(croppedBytes))
              .extract({ left: 0, top: topBound, width: cW, height: trimH })
              .png()
              .toBuffer(),
          )
        : croppedBytes
    // Interior artwork + breakout foreground — shared soft-luminosity lerp:
    //
    // Both the interior artwork and the breakout layer above the frame are built
    // from the SAME lerp-blended pixel buffer. This guarantees zero brightness
    // step at the frame boundary, which was the source of the visible seam.
    //
    // Lerp per-pixel: output = dark*(1-mask) + bright*mask
    //   - Subject centre (mask≈1): bright (1.10×) — warm, crisp fur
    //   - Background    (mask≈0): dark (0.12×, desaturated) — near-black bg
    //   - Transition (~12px blur): smooth gradient, looks like natural lighting
    //
    // No separate vignette is needed — the darkBase at 0.12 already pushes the
    // background to near-black across the whole interior.
    const W = cW
    const H = trimH
    const { data: darkRaw } = await sharp(Buffer.from(trimmedCropBytes))
      .modulate({ brightness: 0.12, saturation: 0.70 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const { data: brightRaw } = await sharp(Buffer.from(trimmedCropBytes))
      .modulate({ brightness: 1.10 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    // Two separate alpha masks from the same rembg foreground:
    // - blendMask  (12px blur): drives the interior lerp — wide blur hides the
    //   hard rembg edge so the bg transition looks natural inside the frame.
    // - breakoutAlpha (3px blur): used as the breakout's transparency channel —
    //   small blur just smooths the binary edge without dissolving thin ear tips,
    //   keeping the ears solid and clearly visible above the frame.
    const blendMask = extractedForegroundBytes
      ? (
          await sharp(Buffer.from(extractedForegroundBytes))
            .extractChannel('alpha')
            .blur(12)
            .raw()
            .toBuffer({ resolveWithObject: true })
        ).data
      : null
    const breakoutAlpha = extractedForegroundBytes
      ? (
          await sharp(Buffer.from(extractedForegroundBytes))
            .extractChannel('alpha')
            .blur(3)
            .raw()
            .toBuffer({ resolveWithObject: true })
        ).data
      : null
    const blendedBuf = Buffer.alloc(W * H * 3)
    for (let i = 0; i < W * H; i++) {
      const m = blendMask ? blendMask[i] / 255 : 0
      blendedBuf[i * 3 + 0] = Math.round(darkRaw[i * 3 + 0] * (1 - m) + brightRaw[i * 3 + 0] * m)
      blendedBuf[i * 3 + 1] = Math.round(darkRaw[i * 3 + 1] * (1 - m) + brightRaw[i * 3 + 1] * m)
      blendedBuf[i * 3 + 2] = Math.round(darkRaw[i * 3 + 2] * (1 - m) + brightRaw[i * 3 + 2] * m)
    }
    const artworkBytes = new Uint8Array(
      await sharp(blendedBuf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(),
    )
    // Breakout foreground: same lerp RGB (pixel-identical to interior at frame
    // boundary → zero seam) but with the lightly-blurred (3px) alpha so the
    // ear tips remain solid and clearly visible above the frame.
    const breakoutFgBytes: Uint8Array | null = breakoutAlpha
      ? (() => {
          const rgba = Buffer.alloc(W * H * 4)
          for (let i = 0; i < W * H; i++) {
            rgba[i * 4 + 0] = blendedBuf[i * 3 + 0]
            rgba[i * 4 + 1] = blendedBuf[i * 3 + 1]
            rgba[i * 4 + 2] = blendedBuf[i * 3 + 2]
            rgba[i * 4 + 3] = breakoutAlpha[i]
          }
          return rgba
        })()
      : null

    const composited = await composeLockedFrameImage({
      artworkBytes,
      frameBytes: frame.bytes,
      extractedForegroundBytes: breakoutFgBytes
        ? new Uint8Array(
            await sharp(breakoutFgBytes, { raw: { width: W, height: H, channels: 4 } })
              .png()
              .toBuffer(),
          )
        : extractedForegroundBytes,
      layoutHint: 'cover',
      forceBreakout: true,
    })

    const outputAsset = await createOutputImageGenerationAsset({
      projectId,
      filename: 'direct-compose.png',
      contentType: 'image/png',
      bytes: composited.imageBytes,
    })

    await updateImageGenerationProject({ projectId, status: 'completed', latestError: null })

    return res.status(200).json({
      success: true,
      data: {
        outputAssetId: outputAsset.id,
        outputBlobUrl: outputAsset.blobUrl,
        breakoutApplied: composited.breakoutApplied,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateImageGenerationProject({ projectId, status: 'failed', latestError: message })
    return res.status(500).json({ success: false, error: message })
  }
}
