import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/agents/creators/_list.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  guardAgentApiRequestMock,
  listCreatorXmtpAgentsMock,
} = vi.hoisted(() => ({
  guardAgentApiRequestMock: vi.fn(async (..._args: unknown[]) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  listCreatorXmtpAgentsMock: vi.fn(async (..._args: unknown[]) => ({ rows: [], nextCursor: null })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardAgentApiRequestMock,
}))

vi.mock('../../server/_lib/creatorXmtpAgents.js', () => ({
  listCreatorXmtpAgents: listCreatorXmtpAgentsMock,
}))

describe('v1/agents/creators list privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardAgentApiRequestMock.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    listCreatorXmtpAgentsMock.mockResolvedValue({ rows: [], nextCursor: null })
  })

  it('rejects unauthenticated listed=false requests', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { listed: 'false', limit: '10' },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Authentication required')
    expect(listCreatorXmtpAgentsMock).not.toHaveBeenCalled()
  })

  it('allows authenticated listed=false requests and passes listedOnly=false', async () => {
    guardAgentApiRequestMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000001' } as any,
    })
    const req = createMockReq({
      method: 'GET',
      query: { listed: 'false', limit: '10' },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(listCreatorXmtpAgentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        listedOnly: false,
      }),
    )
    expect(res.getHeader('cache-control')).toBe('private, no-store')
    expect(String(res.getHeader('vary') ?? '')).toContain('Authorization')
  })
})
