import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/wallet/_confirm-owner.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, confirmOwnerStateMock, extractDelegationFlagsMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  confirmOwnerStateMock: vi.fn(),
  extractDelegationFlagsMock: vi.fn(() => ({})),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/canonicalCswDelegation.js', () => ({
  confirmOwnerState: confirmOwnerStateMock,
  extractDelegationFlags: extractDelegationFlagsMock,
}))

describe('POST /api/wallet/confirm-owner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
  })

  it('returns confirmed owner state on success', async () => {
    confirmOwnerStateMock.mockResolvedValue({
      isOwner: true,
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      ownerAddress: '0x00000000000000000000000000000000000000bb',
      confirmationState: 'owner_confirmed',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {
        txHash: '0x1234',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      isOwner: true,
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      ownerAddress: '0x00000000000000000000000000000000000000bb',
      txHash: '0x1234',
      confirmationState: 'owner_confirmed',
    })
  })

  it('returns 409 with Base setup flags when canonical CSW is missing', async () => {
    const error = Object.assign(new Error('No canonical Coinbase Smart Wallet is linked to this account yet.'), {
      needsBaseAppSetup: true,
      baseAppUrl: 'https://base.app/invite/4626/T9Y9BZYK',
    })
    confirmOwnerStateMock.mockRejectedValue(error)
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

    expect(res.statusCode).toBe(409)
    expect(res.body?.needsBaseAppSetup).toBe(true)
    expect(res.body?.baseAppUrl).toBe('https://base.app/invite/4626/T9Y9BZYK')
  })

  it('returns 400 when the requested CSW does not match the account canonical wallet', async () => {
    confirmOwnerStateMock.mockRejectedValue(
      new Error('Requested Coinbase Smart Wallet does not match the canonical wallet for this account.'),
    )

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {
        cswAddress: '0x00000000000000000000000000000000000000cc',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('does not match the canonical wallet')
  })
})
