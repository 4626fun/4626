import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/onboarding/_bootstrap.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, getDbInitErrorMock, bootstrapCanonicalDelegationStateMock, extractDelegationFlagsMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getDbInitErrorMock: vi.fn<() => string | null>(() => null),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
  extractDelegationFlagsMock: vi.fn(() => ({})),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  getDbInitError: getDbInitErrorMock,
}))

vi.mock('../../server/_lib/wallet/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
  extractDelegationFlags: extractDelegationFlagsMock,
}))

describe('POST /api/onboarding/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    getDbInitErrorMock.mockReturnValue(null)
  })

  it('returns canonical CSW + embedded EOA status + execution track (sub-account ready)', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 11,
      privyUserId: 'did:privy:test-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: false,
      baseSubAccount: {
        address: '0x00000000000000000000000000000000000000cc',
        isDistinctFromCsw: true,
        registered: true,
      },
      executionTrack: 'sub-account',
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
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
      baseSubAccount: {
        address: '0x00000000000000000000000000000000000000cc',
        isDistinctFromCsw: true,
        registered: true,
      },
      executionTrack: 'sub-account',
    })
  })

  it('returns legacy-owner-install track when the embedded EOA is a direct CSW owner and no real sub-account is persisted', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 12,
      privyUserId: 'did:privy:legacy-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: true,
      baseSubAccount: {
        address: null,
        isDistinctFromCsw: false,
        registered: false,
      },
      executionTrack: 'legacy-owner-install',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toMatchObject({
      privyIsOwner: true,
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      executionTrack: 'legacy-owner-install',
      baseSubAccount: { address: null, registered: false, isDistinctFromCsw: false },
    })
  })

  it('returns legacy-owner-install track when both legacy owner install and a real sub-account are present', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 13,
      privyUserId: 'did:privy:mixed-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: true,
      baseSubAccount: {
        address: '0x00000000000000000000000000000000000000cc',
        isDistinctFromCsw: true,
        registered: true,
      },
      executionTrack: 'legacy-owner-install',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.executionTrack).toBe('legacy-owner-install')
    expect(res.body?.data?.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(true)
  })

  it('returns none-yet track for a fresh account with neither signal', async () => {
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      profileId: 14,
      privyUserId: 'did:privy:fresh-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: false,
      baseSubAccount: {
        address: null,
        isDistinctFromCsw: false,
        registered: false,
      },
      executionTrack: 'none-yet',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.executionTrack).toBe('none-yet')
  })

  it('returns Base setup flags with a soft 200 when canonical CSW is missing', async () => {
    bootstrapCanonicalDelegationStateMock.mockRejectedValue(
      Object.assign(new Error('No canonical Coinbase Smart Wallet is linked to this account yet.'), {
        needsBaseAppSetup: true,
        baseAppUrl: 'https://base.app/invite/4626/T9Y9BZYK',
      }),
    )
    extractDelegationFlagsMock.mockReturnValue({
      needsBaseAppSetup: true,
      baseAppUrl: 'https://base.app/invite/4626/T9Y9BZYK',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(false)
    expect(res.body?.needsBaseAppSetup).toBe(true)
    expect(res.body?.baseAppUrl).toBe('https://base.app/invite/4626/T9Y9BZYK')
  })

  it('returns embedded wallet provisioning flags with a soft 200 when Privy embedded EOA is not ready', async () => {
    bootstrapCanonicalDelegationStateMock.mockRejectedValue(
      Object.assign(new Error('Privy embedded EOA is not ready for this account yet. Retry in a moment.'), {
        needsEmbeddedWallet: true,
      }),
    )
    extractDelegationFlagsMock.mockReturnValue({
      needsEmbeddedWallet: true,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(false)
    expect(res.body?.needsEmbeddedWallet).toBe(true)
  })

  it('returns a typed retryable 503 when the database is unavailable', async () => {
    getDbMock.mockResolvedValue(null)
    getDbInitErrorMock.mockReturnValue('Max client connections reached')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Database unavailable')
    expect(res.body?.code).toBe('ONBOARDING_BOOTSTRAP_UNAVAILABLE')
    expect(res.body?.retryable).toBe(true)
  })
})
