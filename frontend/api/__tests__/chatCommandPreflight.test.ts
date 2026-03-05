import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/chat/_commandPreflight.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getKeeprVaultByGroupIdMock,
  isBankrWriteCommandTextMock,
  probeBankrCanonicalWalletMatchMock,
  isCreWriteCommandTextMock,
} = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  isBankrWriteCommandTextMock: vi.fn(),
  probeBankrCanonicalWalletMatchMock: vi.fn(),
  isCreWriteCommandTextMock: vi.fn(),
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

vi.mock('../../server/bankr/agentSkills.js', () => ({
  isBankrWriteCommandText: isBankrWriteCommandTextMock,
}))

vi.mock('../../server/bankr/probe.js', () => ({
  probeBankrCanonicalWalletMatch: probeBankrCanonicalWalletMatchMock,
}))

vi.mock('../../server/agent/eliza/plugins/cre/index.js', () => ({
  isCreWriteCommandText: isCreWriteCommandTextMock,
}))

describe('POST /api/v1/chat/command-preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isBankrWriteCommandTextMock.mockReturnValue(false)
    isCreWriteCommandTextMock.mockReturnValue(false)
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: {
        roles: {
          admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
        },
      },
    })
    probeBankrCanonicalWalletMatchMock.mockResolvedValue({
      walletMatch: true,
      reason: 'wallet_match',
    })
  })

  it('allows non-mutating commands', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/bankr status',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.guardCategory).toBe('none')
  })

  it('rejects write preflight when sender wallet is missing', async () => {
    isBankrWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        command: '/bankr exec rebalance --confirm',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_missing')
  })

  it('rejects write preflight for member role', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('role_denied')
  })

  it('rejects bankr writes when wallet match probe fails', async () => {
    isBankrWriteCommandTextMock.mockReturnValueOnce(true)
    probeBankrCanonicalWalletMatchMock.mockResolvedValueOnce({
      walletMatch: false,
      reason: 'wallet_mismatch',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/bankr exec rebalance --confirm',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_mismatch')
    expect(res.body?.data?.walletMatch).toBe(false)
  })

  it('allows bankr writes when role and wallet match checks pass', async () => {
    isBankrWriteCommandTextMock.mockReturnValueOnce(true)
    probeBankrCanonicalWalletMatchMock.mockResolvedValueOnce({
      walletMatch: true,
      reason: 'wallet_match',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/bankr exec rebalance --confirm',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.role).toBe('OWNER')
    expect(res.body?.data?.walletMatch).toBe(true)
  })
})
