import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/onboarding/_bootstrap.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, bootstrapCanonicalDelegationStateMock, extractDelegationFlagsMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
  extractDelegationFlagsMock: vi.fn(() => ({})),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
  extractDelegationFlags: extractDelegationFlagsMock,
}))

describe('POST /api/onboarding/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
  })

  it('returns canonical CSW + embedded EOA status', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 11,
      privyUserId: 'did:privy:test-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: false,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({
      chainId: 8453,
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: false,
    })
  })
})
