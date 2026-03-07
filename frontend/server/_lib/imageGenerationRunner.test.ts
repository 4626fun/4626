import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getImageGenerationJobMock,
  leaseImageGenerationJobMock,
  updateImageGenerationJobMock,
  getImageGenerationProjectMock,
  createOutputImageGenerationAssetMock,
  recordImageGenerationAttemptMock,
  updateImageGenerationProjectMock,
  fetchBytesMock,
  generateImageWithOpenAiMock,
  evaluateImageGenerationOutputMock,
  buildImageGenerationPromptMock,
  getRetryReasonsFromEvaluationMock,
} = vi.hoisted(() => ({
  getImageGenerationJobMock: vi.fn(),
  leaseImageGenerationJobMock: vi.fn(),
  updateImageGenerationJobMock: vi.fn(),
  getImageGenerationProjectMock: vi.fn(),
  createOutputImageGenerationAssetMock: vi.fn(),
  recordImageGenerationAttemptMock: vi.fn(),
  updateImageGenerationProjectMock: vi.fn(),
  fetchBytesMock: vi.fn(),
  generateImageWithOpenAiMock: vi.fn(),
  evaluateImageGenerationOutputMock: vi.fn(),
  buildImageGenerationPromptMock: vi.fn(),
  getRetryReasonsFromEvaluationMock: vi.fn(),
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

vi.mock('./blob.js', () => ({
  fetchBytes: fetchBytesMock,
}))

vi.mock('./openaiImage.js', () => ({
  buildImageGenerationPrompt: buildImageGenerationPromptMock,
  generateImageWithOpenAi: generateImageWithOpenAiMock,
  evaluateImageGenerationOutput: evaluateImageGenerationOutputMock,
  getRetryReasonsFromEvaluation: getRetryReasonsFromEvaluationMock,
}))

describe('image generation runner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildImageGenerationPromptMock.mockReturnValue('Generated prompt')
    fetchBytesMock.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
    createOutputImageGenerationAssetMock.mockResolvedValue({ id: 'asset_output_123' })
    recordImageGenerationAttemptMock.mockResolvedValue({ id: 'attempt_123' })
    generateImageWithOpenAiMock.mockResolvedValue({
      responseId: 'resp_123',
      revisedPrompt: 'Revised prompt',
      imageBytes: new Uint8Array([9, 9, 9]),
    })
    getRetryReasonsFromEvaluationMock.mockReturnValue(['Make the frame more dominant.'])
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
        { role: 'frame', blobUrl: 'https://blob/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobUrl: 'https://blob/subject.png', mimeType: 'image/png' },
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

    expect(generateImageWithOpenAiMock).toHaveBeenCalled()
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

  it('requeues a job when evaluation fails and retries remain', async () => {
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
        { role: 'frame', blobUrl: 'https://blob/frame.png', mimeType: 'image/png' },
        { role: 'subject', blobUrl: 'https://blob/subject.png', mimeType: 'image/png' },
      ],
      attempts: [],
    })
    evaluateImageGenerationOutputMock.mockResolvedValue({
      insideFrame: 2,
      frameProminence: 3,
      subjectProminence: 4,
      modernElegantStyle: 4,
      cleanliness: 4,
      brandFit: 3,
      pass: false,
      reasons: ['The subject is not clearly contained in the frame.'],
    })

    const { processImageGenerationJob } = await import('./imageGenerationRunner.ts')
    await processImageGenerationJob('job_123')

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
  })
})
