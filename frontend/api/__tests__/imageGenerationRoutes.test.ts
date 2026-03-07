import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  createImageGenerationProjectMock,
  attachImageGenerationAssetMock,
  enqueueImageGenerationJobMock,
  getImageGenerationJobMock,
  getImageGenerationProjectMock,
  processImageGenerationJobMock,
} = vi.hoisted(() => ({
  createImageGenerationProjectMock: vi.fn(async () => ({
    id: 'proj_123',
    status: 'draft',
  })),
  attachImageGenerationAssetMock: vi.fn(async () => ({
    id: 'asset_123',
    role: 'frame',
    mimeType: 'image/png',
  })),
  enqueueImageGenerationJobMock: vi.fn(async () => ({
    id: 'job_123',
    status: 'pending',
  })),
  getImageGenerationJobMock: vi.fn(async () => ({
    id: 'job_123',
    status: 'pending',
  })),
  getImageGenerationProjectMock: vi.fn(async () => ({
    id: 'proj_123',
    status: 'draft',
    assets: [],
    attempts: [],
    latestJob: null,
  })),
  processImageGenerationJobMock: vi.fn(async () => ({ id: 'job_123', status: 'pending' })),
}))

vi.mock('../../server/_lib/imageProjects.js', () => ({
  createImageGenerationProject: createImageGenerationProjectMock,
  attachImageGenerationAsset: attachImageGenerationAssetMock,
  getImageGenerationProject: getImageGenerationProjectMock,
}))

vi.mock('../../server/_lib/imageGenerationJobs.js', () => ({
  enqueueImageGenerationJob: enqueueImageGenerationJobMock,
  getImageGenerationJob: getImageGenerationJobMock,
}))

vi.mock('../../server/_lib/imageGenerationRunner.js', () => ({
  processImageGenerationJob: processImageGenerationJobMock,
}))

describe('image generation route registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('registers all image generation routes in the API loader map', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')

    await expect(getApiHandler('image/projects/create')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/assets/upload')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/generate')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/refine')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/jobs/status')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/get')).resolves.toBeTypeOf('function')
  })
})

describe('POST /api/image/projects/create', () => {
  it('creates a draft image generation project', async () => {
    const mod = await import('../_handlers/image/_projects-create.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        instruction: 'Put the dog inside the blue square.',
        stylePreset: 'modern_elegant',
        brandContext: ['creator coin', 'ERC-4626 vault'],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createImageGenerationProjectMock).toHaveBeenCalledWith({
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'ERC-4626 vault'],
    })
    expect(res.body).toEqual({
      success: true,
      data: {
        project: {
          id: 'proj_123',
          status: 'draft',
        },
      },
    })
  })

  it('rejects non-POST methods', async () => {
    const mod = await import('../_handlers/image/_projects-create.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })
})

describe('POST /api/image/projects/assets/upload', () => {
  it('attaches a reference asset to a project', async () => {
    const mod = await import('../_handlers/image/_assets-upload.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
        role: 'frame',
        filename: 'frame.png',
        contentType: 'image/png',
        dataBase64: Buffer.from('png-bytes').toString('base64'),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(attachImageGenerationAssetMock).toHaveBeenCalledWith({
      projectId: 'proj_123',
      role: 'frame',
      filename: 'frame.png',
      contentType: 'image/png',
      bytes: expect.any(Uint8Array),
    })
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.asset?.id).toBe('asset_123')
  })

  it('rejects unsupported asset roles', async () => {
    const mod = await import('../_handlers/image/_assets-upload.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
        role: 'output',
        filename: 'frame.png',
        contentType: 'image/png',
        dataBase64: Buffer.from('png-bytes').toString('base64'),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(attachImageGenerationAssetMock).not.toHaveBeenCalled()
  })
})

describe('image generation job endpoints', () => {
  it('enqueues a generate job', async () => {
    const mod = await import('../_handlers/image/_generate.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(enqueueImageGenerationJobMock).toHaveBeenCalledWith({
      projectId: 'proj_123',
      kind: 'generate',
    })
    expect(res.body?.data?.job?.id).toBe('job_123')
  })

  it('enqueues a refine job with follow-up instruction', async () => {
    const mod = await import('../_handlers/image/_refine.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
        refineInstruction: 'Make the glow subtler.',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(enqueueImageGenerationJobMock).toHaveBeenCalledWith({
      projectId: 'proj_123',
      kind: 'refine',
      refineInstruction: 'Make the glow subtler.',
    })
  })

  it('returns job status by id', async () => {
    const mod = await import('../_handlers/image/_jobs-status.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { jobId: 'job_123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getImageGenerationJobMock).toHaveBeenCalledWith('job_123')
    expect(res.body?.data?.job?.status).toBe('pending')
  })

  it('returns a project snapshot by id', async () => {
    const mod = await import('../_handlers/image/_projects-get.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { projectId: 'proj_123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getImageGenerationProjectMock).toHaveBeenCalledWith('proj_123')
    expect(res.body?.data?.project?.id).toBe('proj_123')
  })
})
