import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/link/_status.ts'
import { createMockReq, createMockRes } from './helpers'

const { verifyPrivyForAccountsMock, extractZoraCrossAppAccountsMock } = vi.hoisted(() => ({
  verifyPrivyForAccountsMock: vi.fn(),
  extractZoraCrossAppAccountsMock: vi.fn(),
}))

vi.mock('../../server/_lib/identity/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  extractZoraCrossAppAccounts: extractZoraCrossAppAccountsMock,
}))

describe('POST /api/zora/link/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
    extractZoraCrossAppAccountsMock.mockReturnValue([
      {
        address: '0x1111111111111111111111111111111111111111',
        providerAppId: 'clpgf04wn04hnkw0fv1m11mnb',
      },
    ])
  })

  it('marks zoraLinked when Zora cross_app account exists', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.zoraLinked).toBe(true)
    expect(res.body?.data?.zoraCrossAppAccounts?.[0]?.providerAppId).toBe('clpgf04wn04hnkw0fv1m11mnb')
  })
})

