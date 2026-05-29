import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readSessionFromRequestMock,
  isKeeperWriteCommandTextMock,
  executeHermitCommandMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  readSessionFromRequestMock: vi.fn(),
  isKeeperWriteCommandTextMock: vi.fn(() => false),
  executeHermitCommandMock: vi.fn(),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '../../@4626/server-core',
  )
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    getClientIp: getClientIpMock,
    rateLimitKey: rateLimitKeyMock,
    readSessionFromRequest: readSessionFromRequestMock,
  }
})

vi.mock('../../server/agents/eliza/plugins/keeperOps/index.js', () => ({
  isKeeperWriteCommandText: isKeeperWriteCommandTextMock,
}))

vi.mock('../../server/_lib/hermit/skillRouter.js', () => ({
  executeHermitCommand: executeHermitCommandMock,
}))

import handler from '../_handlers/v1/chat/_hermit.ts'

describe('POST /api/v1/chat/hermit', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      HERMIT_ALLOWED_USERS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    readSessionFromRequestMock.mockReturnValue({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    executeHermitCommandMock.mockResolvedValue({
      kind: 'hermit',
      provider: 'local',
      reply: 'Hermit draft: hello',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  it('returns 400 when source is missing or invalid', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { command: '/hermit hello' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('source must be hermit')
  })

  it('returns 401 when session is missing', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: { source: 'hermit', command: '/hermit hello' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when session user is not allowlisted', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_ALLOWED_USERS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    const req = createMockReq({
      method: 'POST',
      body: { source: 'hermit', command: '/hermit hello' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('Hermit access denied')
  })

  it('returns 403 when hermit command is mutating', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: { source: 'hermit', command: '/keepr tend' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('Hermit lane is read-only')
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'POST',
      body: { source: 'hermit', command: '/hermit hello' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
  })

  it('executes hermit command and returns response data', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { source: 'hermit', command: '/hermit hello' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(executeHermitCommandMock).toHaveBeenCalledWith({
      commandText: '/hermit hello',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
  })
})
