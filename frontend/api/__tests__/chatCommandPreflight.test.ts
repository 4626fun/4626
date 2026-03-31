import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/chat/_commandPreflight.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getKeeprVaultByGroupIdMock,
  isCreWriteCommandTextMock,
  readSessionFromRequestMock,
} = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  isCreWriteCommandTextMock: vi.fn(),
  readSessionFromRequestMock: vi.fn(),
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

vi.mock('../../server/agent/eliza/plugins/cre/index.js', () => ({
  isCreWriteCommandText: isCreWriteCommandTextMock,
}))

vi.mock('../../server/auth/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>('../../server/auth/_shared.js')
  return {
    ...actual,
    readSessionFromRequest: readSessionFromRequestMock,
  }
})

describe('POST /api/v1/chat/command-preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isCreWriteCommandTextMock.mockReturnValue(false)
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: {
        roles: {
          admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
        },
      },
    })
    readSessionFromRequestMock.mockReturnValue({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
  })

  it('allows non-mutating commands', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
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
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_missing')
  })

  it('rejects write preflight when auth session is missing', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('auth_required')
  })

  it('rejects write preflight when sender wallet mismatches session wallet', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_session_mismatch')
  })

  it('rejects write preflight for member role', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
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

  it('allows CRE writes when role checks pass', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.role).toBe('OWNER')
    expect(res.body?.data?.walletMatch).toBeNull()
  })

  it('fails closed when backend checks throw', async () => {
    isCreWriteCommandTextMock.mockReturnValueOnce(true)
    getKeeprVaultByGroupIdMock.mockRejectedValueOnce(new Error('db unavailable'))
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/cre tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('runtime_unavailable')
  })
})
