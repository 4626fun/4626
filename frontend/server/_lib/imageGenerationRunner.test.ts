import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../api/__tests__/helpers'

const {
  getImageGenerationJobMock,
  leaseImageGenerationJobMock,
  updateImageGenerationJobMock,
  getImageGenerationProjectMock,
  createOutputImageGenerationAssetMock,
  recordImageGenerationAttemptMock,
  updateImageGenerationProjectMock,
  downloadImageStorageObjectMock,
  generateImageWithOpenAiMock,
  evaluateImageGenerationOutputMock,
  buildImageGenerationPromptMock,
  getRetryReasonsFromEvaluationMock,
  shouldRunImageEvaluationMock,
  composeLockedFrameImageMock,
  extractForegroundFromArtworkMock,
} = vi.hoisted(() => ({
  getImageGenerationJobMock: vi.fn(),
  leaseImageGenerationJobMock: vi.fn(),
  updateImageGenerationJobMock: vi.fn(),
  getImageGenerationProjectMock: vi.fn(),
  createOutputImageGenerationAssetMock: vi.fn(),
  recordImageGenerationAttemptMock: vi.fn(),
  updateImageGenerationProjectMock: vi.fn(),
  downloadImageStorageObjectMock: vi.fn(),
  generateImageWithOpenAiMock: vi.fn(),
  evaluateImageGenerationOutputMock: vi.fn(),
  buildImageGenerationPromptMock: vi.fn(),
  getRetryReasonsFromEvaluationMock: vi.fn(),
  shouldRunImageEvaluationMock: vi.fn(() => true),
  composeLockedFrameImageMock: vi.fn(),
  extractForegroundFromArtworkMock: vi.fn(),
}))

vi.mock('./imageGenerationJobs.js', () => ({
  getImageGenerationJob: getImageGenerationJobMock,
  leaseImageGenerationJob: leaseImageGenerationJobMock,
  updateImageGenerationJob: updateImageGenerationJobMock,
}))

vi.mock('./imageProjects.js', () => ({
  getImageGenerationProject: getImageGenerationProjectMock,
  createOutputImageGenerationAsset: createOutputImageGenerationAssetMock,
  recordImageGenerationAttempt: recordImageGenerationAttemptMock,
  updateImageGenerationProject: updateImageGenerationProjectMock,
}))

vi.mock('./imageStorage.js', () => ({
  downloadImageStorageObject: downloadImageStorageObjectMock,
}))

vi.mock('./openaiImage.js', () => ({
  buildImageGenerationPrompt: buildImageGenerationPromptMock,
  generateImageWithOpenAi: generateImageWithOpenAiMock,
  evaluateImageGenerationOutput: evaluateImageGenerationOutputMock,
  getRetryReasonsFromEvaluation: getRetryReasonsFromEvaluationMock,
  shouldRunImageEvaluation: shouldRunImageEvaluationMock,
}))

vi.mock('./imageCompositor.js', () => ({
  composeLockedFrameImage: composeLockedFrameImageMock,
}))

vi.mock('./imageForegroundExtraction.js', () => ({
  extractForegroundFromArtwork: extractForegroundFromArtworkMock,
}))

describe('image generation runner', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      OPENAI_IMAGE_EVAL_ENABLED: 'true',
    })
    buildImageGenerationPromptMock.mockReturnValue('Generated prompt')
    downloadImageStorageObjectMock.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
    createOutputImageGenerationAssetMock.mockResolvedValue({ id: 'asset_output_123' })
    recordImageGenerationAttemptMock.mockResolvedValue({ id: 'attempt_123' })
    generateImageWithOpenAiMock.mockResolvedValue({
      responseId: 'resp_123',
      revisedPrompt: 'Revised prompt',
      imageBytes: new Uint8Array([9, 9, 9]),
    })
    composeLockedFrameImageMock.mockResolvedValue({
      imageBytes: new Uint8Array([7, 7, 7]),
      contentBox: { left: 120, top: 120, width: 360, height: 360 },
      breakoutApplied: false,
    })
    extractForegroundFromArtworkMock.mockResolvedValue(null)
    getRetryReasonsFromEvaluationMock.mockReturnValue(['Make the frame more dominant.'])
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('completes a job when generation passes evaluation', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 1,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 5,
      frameProminence: 4,
      subjectProminence: 4,
      modernElegantStyle: 5,
      cleanliness: 4,
      brandFit: 4,
      pass: true,
      reasons: [],
    })

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(generateImageWithOpenAiMock).toHaveBeenCalledWith({
      subjectBytes: new Uint8Array([1, 2, 3]),
      subjectContentType: 'image/png',
      prompt: 'Generated prompt',
      previousResponseId: null,
    })
    expect(createOutputImageGenerationAssetMock).toHaveBeenCalled()
    expect(recordImageGenerationAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        responseId: 'resp_123',
        passed: true,
        outputAssetId: 'asset_output_123',
      }),
    )
    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'completed',
        completed: true,
      }),
    )
    expect(updateImageGenerationProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        status: 'completed',
        lastResponseId: 'resp_123',
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'completed' })
  })

  it('stores the compositor output instead of raw model bytes', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 1,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 5,
      frameProminence: 4,
      subjectProminence: 4,
      modernElegantStyle: 5,
      cleanliness: 4,
      brandFit: 4,
      pass: true,
      reasons: [],
    })

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    await processImageGenerationJob('job_123')

    expect(composeLockedFrameImageMock).toHaveBeenCalledWith({
      artworkBytes: new Uint8Array([9, 9, 9]),
      frameBytes: new Uint8Array([1, 2, 3]),
      extractedForegroundBytes: null,
    })
    expect(createOutputImageGenerationAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        bytes: new Uint8Array([7, 7, 7]),
      }),
    )
    expect(evaluateImageGenerationOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputBytes: new Uint8Array([7, 7, 7]),
      }),
    )
    expect(createOutputImageGenerationAssetMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: new Uint8Array([9, 9, 9]),
      }),
    )
  })

  it('passes extracted foreground bytes into the compositor when extraction succeeds', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 1,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 5,
      frameProminence: 4,
      subjectProminence: 4,
      modernElegantStyle: 5,
      cleanliness: 4,
      brandFit: 4,
      pass: true,
      reasons: [],
    })
    extractForegroundFromArtworkMock.mockResolvedValue(new Uint8Array([4, 4, 4]))

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    await processImageGenerationJob('job_123')

    expect(extractForegroundFromArtworkMock).toHaveBeenCalledWith(new Uint8Array([9, 9, 9]))
    expect(composeLockedFrameImageMock).toHaveBeenCalledWith({
      artworkBytes: new Uint8Array([9, 9, 9]),
      frameBytes: new Uint8Array([1, 2, 3]),
      extractedForegroundBytes: new Uint8Array([4, 4, 4]),
    })
  })

  it('still completes when foreground extraction returns null', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 1,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 5,
      frameProminence: 4,
      subjectProminence: 4,
      modernElegantStyle: 5,
      cleanliness: 4,
      brandFit: 4,
      pass: true,
      reasons: [],
    })
    extractForegroundFromArtworkMock.mockResolvedValue(null)

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(composeLockedFrameImageMock).toHaveBeenCalledWith({
      artworkBytes: new Uint8Array([9, 9, 9]),
      frameBytes: new Uint8Array([1, 2, 3]),
      extractedForegroundBytes: null,
    })
    expect(job).toEqual({ id: 'job_123', status: 'completed' })
  })

  it('completes with non-breakout fallback metadata when compositor rejects breakout', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 1,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    composeLockedFrameImageMock.mockResolvedValueOnce({
      imageBytes: new Uint8Array([5, 5, 5]),
      contentBox: { left: 120, top: 120, width: 360, height: 360 },
      breakoutApplied: false,
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 5,
      frameProminence: 4,
      subjectProminence: 4,
      modernElegantStyle: 5,
      cleanliness: 4,
      brandFit: 4,
      pass: true,
      reasons: [],
    })

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(recordImageGenerationAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluation: expect.objectContaining({
          breakoutApplied: false,
        }),
      }),
    )
    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'completed',
        result: expect.objectContaining({
          breakoutApplied: false,
          outputAssetId: 'asset_output_123',
        }),
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'completed' })
  })

  it('retries inline when evaluation fails and attempts remain', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock
      .mockResolvedValueOnce({
        id: 'job_123',
        projectId: 'proj_123',
        kind: 'generate',
        status: 'processing',
        refineInstruction: null,
        attempts: 1,
        maxAttempts: 3,
      })
      .mockResolvedValueOnce({
        id: 'job_123',
        projectId: 'proj_123',
        kind: 'generate',
        status: 'processing',
        refineInstruction: null,
        attempts: 2,
        maxAttempts: 3,
      })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock
      .mockResolvedValueOnce({
        insideFrame: 2,
        frameProminence: 3,
        subjectProminence: 4,
        modernElegantStyle: 4,
        cleanliness: 4,
        brandFit: 3,
        pass: false,
        reasons: ['The subject is not clearly contained in the frame.'],
      })
      .mockResolvedValueOnce({
        insideFrame: 5,
        frameProminence: 4,
        subjectProminence: 4,
        modernElegantStyle: 5,
        cleanliness: 4,
        brandFit: 4,
        pass: true,
        reasons: [],
      })

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'pending',
        latestError: 'The subject is not clearly contained in the frame.',
      }),
    )
    expect(updateImageGenerationProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        status: 'queued',
      }),
    )
    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'completed',
        completed: true,
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'completed' })
  })

  it('marks the job failed instead of leaving it stuck in processing on runtime errors', async () => {
    getImageGenerationJobMock.mockResolvedValue({ id: 'job_123', status: 'pending' })
    leaseImageGenerationJobMock.mockResolvedValue({
      id: 'job_123',
      projectId: 'proj_123',
      kind: 'generate',
      status: 'processing',
      refineInstruction: null,
      attempts: 3,
      maxAttempts: 3,
    })
    getImageGenerationProjectMock.mockResolvedValue({
      id: 'proj_123',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin'],
      lastResponseId: null,
      assets: [
        { role: 'frame', blobPathname: 'imagegen/projects/proj_123/frame/frame.png', blobUrl: 'https://storage/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobPathname: 'imagegen/projects/proj_123/subject/subject.png', blobUrl: 'https://storage/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    generateImageWithOpenAiMock.mockRejectedValue(new Error('openai_responses_failed(500)'))

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'failed',
        latestError: 'openai_responses_failed(500)',
        completed: true,
      }),
    )
    expect(updateImageGenerationProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        status: 'failed',
        latestError: 'openai_responses_failed(500)',
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'failed' })
  })
})
