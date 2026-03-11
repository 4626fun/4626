import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  createImageGenerationProjectMock,
  attachImageGenerationAssetMock,
  enqueueImageGenerationJobMock,
  getImageGenerationJobMock,
  getImageGenerationProjectMock,
  setImageProjectVaultAddressMock,
  processImageGenerationJobMock,
  getSessionAddressMock,
  isAdminAddressMock,
} = vi.hoisted(() => ({
  createImageGenerationProjectMock: vi.fn(async () => ({
    id: 'proj_123',
    ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
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
    projectId: 'proj_123',
    status: 'pending',
  })),
  getImageGenerationProjectMock: vi.fn(async () => ({
    id: 'proj_123',
    ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    status: 'draft',
    assets: [],
    attempts: [],
    latestJob: null,
  })),
  setImageProjectVaultAddressMock: vi.fn(async () => {}),
  processImageGenerationJobMock: vi.fn(async () => ({ id: 'job_123', status: 'pending' })),
  getSessionAddressMock: vi.fn<() => string | null>(() => '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'),
  isAdminAddressMock: vi.fn(() => true),
}))

vi.mock('../../server/_lib/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/imageProjects.js', () => ({
  createImageGenerationProject: createImageGenerationProjectMock,
  attachImageGenerationAsset: attachImageGenerationAssetMock,
  getImageGenerationProject: getImageGenerationProjectMock,
  setImageProjectVaultAddress: setImageProjectVaultAddressMock,
}))

vi.mock('../../server/_lib/imageGenerationJobs.js', () => ({
  enqueueImageGenerationJob: enqueueImageGenerationJobMock,
  getImageGenerationJob: getImageGenerationJobMock,
}))

vi.mock('../../server/_lib/imageGenerationRunner.js', () => ({
  processImageGenerationJob: processImageGenerationJobMock,
}))

vi.mock('../../server/_lib/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

describe('image generation route registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    getSessionAddressMock.mockReturnValue('0xb05cf01231cf2ff99499682e64d3780d57c80fdd')
    isAdminAddressMock.mockReturnValue(true)
  })

  it('registers all image generation routes in the API loader map', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')

    await expect(getApiHandler('image/projects/create')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/assets/upload')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/generate')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/refine')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/jobs/status')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/get')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('image/projects/associate-vault')).resolves.toBeTypeOf('function')
  })
})

describe('image generation auth gate', () => {
  it('returns 401 when caller is not signed in', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const mod = await import('../_handlers/image/_projects-create.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: { instruction: 'test' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'Sign in required' })
    expect(createImageGenerationProjectMock).not.toHaveBeenCalled()
  })

  it('allows non-admin signed-in callers', async () => {
    getSessionAddressMock.mockReturnValue('0x1111111111111111111111111111111111111111')
    isAdminAddressMock.mockReturnValue(false)
    const mod = await import('../_handlers/image/_projects-create.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: { instruction: 'test' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createImageGenerationProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAddress: '0x1111111111111111111111111111111111111111' }),
    )
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
      ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'ERC-4626 vault'],
      creatorAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
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

  it('rejects unauthenticated callers', async () => {
    getSessionAddressMock.mockReturnValue(null as any)

    const mod = await import('../_handlers/image/_projects-create.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'POST', body: { instruction: 'test' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'Sign in required' })
    expect(createImageGenerationProjectMock).not.toHaveBeenCalled()
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
    expect(processImageGenerationJobMock).toHaveBeenCalledWith('job_123')
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
    expect(processImageGenerationJobMock).toHaveBeenCalledWith('job_123')
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
    expect(processImageGenerationJobMock).not.toHaveBeenCalled()
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

describe('POST /api/image/projects/associate-vault', () => {
  it('associates completed project for the owner', async () => {
    getImageGenerationProjectMock.mockResolvedValueOnce({
      id: 'proj_123',
      ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      status: 'completed',
      assets: [],
      attempts: [],
      latestJob: null,
    })
    const mod = await import('../_handlers/image/_associate-vault.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(setImageProjectVaultAddressMock).toHaveBeenCalledWith(
      'proj_123',
      '0x1111111111111111111111111111111111111111',
    )
  })

  it('rejects associating a project owned by a different wallet', async () => {
    getImageGenerationProjectMock.mockResolvedValueOnce({
      id: 'proj_123',
      ownerAddress: '0x2222222222222222222222222222222222222222',
      status: 'completed',
      assets: [],
      attempts: [],
      latestJob: null,
    })
    const mod = await import('../_handlers/image/_associate-vault.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'POST',
      body: {
        projectId: 'proj_123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(setImageProjectVaultAddressMock).not.toHaveBeenCalled()
  })
})
