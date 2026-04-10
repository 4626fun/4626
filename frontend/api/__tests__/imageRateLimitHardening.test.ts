import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock, getSessionAddressMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
  getSessionAddressMock: vi.fn(() => '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>(
    '../../packages/server-core/src/index.js',
  )
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    getClientIp: vi.fn(() => '198.51.100.88'),
    rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
    getSessionAddress: getSessionAddressMock,
    RATE_LIMITS: {
      agentCreative: { windowMs: 60_000, maxRequests: 1 },
    },
  }
})

import assetsUploadHandler from '../_handlers/image/_assets-upload.ts'
import associateVaultHandler from '../_handlers/image/_associate-vault.ts'
import autoAssetsHandler from '../_handlers/image/_auto-assets.ts'
import directComposeHandler from '../_handlers/image/_direct-compose.ts'
import generateHandler from '../_handlers/image/_generate.ts'
import projectsCreateHandler from '../_handlers/image/_projects-create.ts'
import refineHandler from '../_handlers/image/_refine.ts'

describe('image endpoint rate-limit hardening', () => {
  it('returns 429 + Retry-After for /image/auto-assets when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await autoAssetsHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/refine when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await refineHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/generate when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await generateHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/projects-create when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await projectsCreateHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/associate-vault when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await associateVaultHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/assets-upload when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await assetsUploadHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /image/direct-compose when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await directComposeHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
