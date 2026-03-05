import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/wallet/_prepare-add-privy-owner.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, bootstrapCanonicalDelegationStateMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
  extractDelegationFlags: vi.fn(() => ({})),
}))

describe('POST /api/wallet/prepare-add-privy-owner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
  })

  it('returns alreadyOwner=true when embedded EOA is already installed', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 42,
      privyUserId: 'did:privy:test-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000AA',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000BB',
      privyIsOwner: true,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({ alreadyOwner: true })
  })
})
