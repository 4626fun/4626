import { fetchBytes } from './blob.js'
import { getImageGenerationJob, leaseImageGenerationJob, updateImageGenerationJob } from './imageGenerationJobs.js'
import {
  createOutputImageGenerationAsset,
  getImageGenerationProject,
  recordImageGenerationAttempt,
  updateImageGenerationProject,
} from './imageProjects.js'
import {
  buildImageGenerationPrompt,
  evaluateImageGenerationOutput,
  generateImageWithOpenAi,
  getRetryReasonsFromEvaluation,
} from './openaiImage.js'

function selectLatestAssetByRole(
  assets: Array<{ role: string; blobUrl: string; mimeType: string }>,
  role: 'frame' | 'subject',
) {
  return assets.find((asset) => asset.role === role) ?? null
}

function sumEvaluationScore(evaluation: {
  insideFrame: number
  frameProminence: number
  subjectProminence: number
  modernElegantStyle: number
  cleanliness: number
  brandFit: number
}) {
  return (
    evaluation.insideFrame +
    evaluation.frameProminence +
    evaluation.subjectProminence +
    evaluation.modernElegantStyle +
    evaluation.cleanliness +
    evaluation.brandFit
  )
}

export async function processImageGenerationJob(jobId: string): Promise<{ id: string; status: string } | null> {
  const current = await getImageGenerationJob(jobId)
  if (!current) return null
  if (current.status === 'completed' || current.status === 'failed') {
    return { id: current.id, status: current.status }
  }

  const leased = await leaseImageGenerationJob(jobId, 'imagegen-inline-runner')
  if (!leased) {
    return { id: current.id, status: current.status }
  }

  const project = await getImageGenerationProject(leased.projectId)
  if (!project) {
    await updateImageGenerationJob({
      jobId,
      status: 'failed',
      latestError: 'Project not found',
      completed: true,
    })
    return { id: jobId, status: 'failed' }
  }

  const frameAsset = selectLatestAssetByRole(project.assets as any, 'frame')
  const subjectAsset = selectLatestAssetByRole(project.assets as any, 'subject')
  if (!frameAsset || !subjectAsset) {
    await updateImageGenerationJob({
      jobId,
      status: 'failed',
      latestError: 'Frame and subject assets are required before generation',
      completed: true,
    })
    await updateImageGenerationProject({
      projectId: leased.projectId,
      status: 'failed',
      latestError: 'Frame and subject assets are required before generation',
    })
    return { id: jobId, status: 'failed' }
  }

  const frame = await fetchBytes(frameAsset.blobUrl)
  const subject = await fetchBytes(subjectAsset.blobUrl)
  const latestAttempt = Array.isArray(project.attempts) ? project.attempts[0] : null
  const retryReasons = latestAttempt?.evaluation ? getRetryReasonsFromEvaluation(latestAttempt.evaluation as any) : []
  const prompt = leased.kind === 'refine'
    ? buildImageGenerationPrompt({
        instruction: `${project.instruction}\nRefine the previous image: ${leased.refineInstruction ?? ''}`.trim(),
        stylePreset: project.stylePreset,
        brandContext: project.brandContext,
      })
    : buildImageGenerationPrompt({
        instruction: project.instruction,
        stylePreset: project.stylePreset,
        brandContext: project.brandContext,
        retryReasons: leased.attempts > 1 ? retryReasons : [],
      })

  const generation = await generateImageWithOpenAi({
    frameBytes: frame.bytes,
    frameContentType: frame.contentType ?? frameAsset.mimeType,
    subjectBytes: subject.bytes,
    subjectContentType: subject.contentType ?? subjectAsset.mimeType,
    prompt,
    previousResponseId: leased.kind === 'refine' ? project.lastResponseId : null,
  })

  const outputAsset = await createOutputImageGenerationAsset({
    projectId: leased.projectId,
    filename: `${leased.kind}-${leased.attempts}.png`,
    contentType: 'image/png',
    bytes: generation.imageBytes,
  })

  const evaluation = await evaluateImageGenerationOutput({
    brief: project.instruction,
    outputBytes: generation.imageBytes,
    outputContentType: 'image/png',
    frameBytes: frame.bytes,
    frameContentType: frame.contentType ?? frameAsset.mimeType,
    subjectBytes: subject.bytes,
    subjectContentType: subject.contentType ?? subjectAsset.mimeType,
  })

  const score = sumEvaluationScore(evaluation)
  await recordImageGenerationAttempt({
    projectId: leased.projectId,
    jobId: leased.id,
    attemptNumber: leased.attempts,
    kind: leased.kind,
    prompt,
    revisedPrompt: generation.revisedPrompt,
    responseId: generation.responseId,
    evaluation,
    score,
    passed: evaluation.pass,
    outputAssetId: outputAsset.id,
  })

  if (evaluation.pass) {
    await updateImageGenerationJob({
      jobId: leased.id,
      status: 'completed',
      latestError: null,
      result: {
        outputAssetId: outputAsset.id,
        score,
        evaluation,
      },
      completed: true,
    })
    await updateImageGenerationProject({
      projectId: leased.projectId,
      status: 'completed',
      lastResponseId: generation.responseId,
      latestError: null,
    })
    return { id: leased.id, status: 'completed' }
  }

  const retryError = evaluation.reasons[0] ?? 'Generation did not satisfy evaluation'
  const shouldRetry = leased.attempts < leased.maxAttempts
  await updateImageGenerationJob({
    jobId: leased.id,
    status: shouldRetry ? 'pending' : 'failed',
    latestError: retryError,
    result: {
      outputAssetId: outputAsset.id,
      score,
      evaluation,
    },
    completed: !shouldRetry,
  })
  await updateImageGenerationProject({
    projectId: leased.projectId,
    status: shouldRetry ? 'queued' : 'failed',
    lastResponseId: generation.responseId,
    latestError: shouldRetry ? null : retryError,
  })
  return { id: leased.id, status: shouldRetry ? 'pending' : 'failed' }
}
