import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/wallet/_prepare-add-rabby-owner.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, bootstrapCanonicalDelegationStateMock, confirmOwnerStateMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
  confirmOwnerStateMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/wallet/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
  confirmOwnerState: confirmOwnerStateMock,
  extractDelegationFlags: vi.fn(() => ({})),
}))

describe('POST /api/wallet/prepare-add-rabby-owner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 42,
      privyUserId: 'did:privy:test-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000AA',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000BB',
      privyIsOwner: false,
    })
    confirmOwnerStateMock.mockResolvedValue({
      isOwner: false,
      canonicalCswAddress: '0x00000000000000000000000000000000000000AA',
      ownerAddress: '0x0000000000000000000000000000000000000011',
    })
  })

  it('rejects when confirmedAdvanced is not explicitly true', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-privy-token': 'test-token' },
      rawBody: JSON.stringify({ rabbyAddress: '0x0000000000000000000000000000000000000011', confirmedAdvanced: false }),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(bootstrapCanonicalDelegationStateMock).not.toHaveBeenCalled()
  })

  it('rejects invalid rabby addresses', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-privy-token': 'test-token' },
      rawBody: JSON.stringify({ rabbyAddress: '0x123', confirmedAdvanced: true }),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(bootstrapCanonicalDelegationStateMock).not.toHaveBeenCalled()
  })

  it('returns a tx request when advanced confirmation is valid', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-privy-token': 'test-token' },
      rawBody: JSON.stringify({
        rabbyAddress: '0x0000000000000000000000000000000000000011',
        confirmedAdvanced: true,
      }),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.alreadyOwner).toBe(false)
    expect(typeof res.body?.data?.txRequest?.data).toBe('string')
    expect(String(res.body?.data?.txRequest?.data).startsWith('0x0f0f3f24')).toBe(true)
  })

  it('short-circuits when the Rabby address is already installed as an owner', async () => {
    confirmOwnerStateMock.mockResolvedValueOnce({
      isOwner: true,
      canonicalCswAddress: '0x00000000000000000000000000000000000000AA',
      ownerAddress: '0x0000000000000000000000000000000000000011',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-privy-token': 'test-token' },
      rawBody: JSON.stringify({
        rabbyAddress: '0x0000000000000000000000000000000000000011',
        confirmedAdvanced: true,
      }),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({ alreadyOwner: true })
  })
})
