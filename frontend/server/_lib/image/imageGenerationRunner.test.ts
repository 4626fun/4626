import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'

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
      responseId: 'edit_123',
      revisedPrompt: 'Revised prompt',
      imageBytes: new Uint8Array([9, 9, 9]),
      breakoutApplied: true,
    })
    getRetryReasonsFromEvaluationMock.mockReturnValue(['Make the breakout more obvious.'])
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
      targetBytes: new Uint8Array([1, 2, 3]),
      targetContentType: 'image/png',
      referenceBytes: new Uint8Array([1, 2, 3]),
      referenceContentType: 'image/png',
      prompt: 'Generated prompt',
    })
    expect(createOutputImageGenerationAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        bytes: new Uint8Array([9, 9, 9]),
      }),
    )
    expect(recordImageGenerationAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        responseId: 'edit_123',
        passed: true,
        outputAssetId: 'asset_output_123',
        evaluation: expect.objectContaining({
          breakoutApplied: true,
        }),
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
        lastResponseId: 'edit_123',
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'completed' })
  })

  it('stores the OpenAI edit output directly without compositor post-processing', async () => {
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

    expect(evaluateImageGenerationOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputBytes: new Uint8Array([9, 9, 9]),
      }),
    )
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
    generateImageWithOpenAiMock.mockRejectedValue(new Error('openai_images_edit_failed(500)'))

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    const job = await processImageGenerationJob('job_123')

    expect(updateImageGenerationJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        status: 'failed',
        latestError: 'openai_images_edit_failed(500)',
        completed: true,
      }),
    )
    expect(updateImageGenerationProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_123',
        status: 'failed',
        latestError: 'openai_images_edit_failed(500)',
      }),
    )
    expect(job).toEqual({ id: 'job_123', status: 'failed' })
  })
})
