import { beforeEach, describe, expect, it, vi } from 'vitest'

import cancelHandler from '../_handlers/deploy/session/_cancel.ts'
import continueHandler from '../_handlers/deploy/session/_continue.ts'
import statusHandler from '../_handlers/deploy/session/_status.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readSessionFromRequestMock,
  readSiwaAgentFromRequestMock,
  getDeploySessionByIdMock,
  transitionDeploySessionMock,
  updateDeploySessionMock,
  signDeployTokenMock,
  decryptWithSecretMock,
  sendUserOperationMock,
  getUserOperationReceiptMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readSessionFromRequestMock: vi.fn(() => ({ address: '0xsession' })),
  readSiwaAgentFromRequestMock: vi.fn(() => null),
  getDeploySessionByIdMock: vi.fn(),
  transitionDeploySessionMock: vi.fn(),
  updateDeploySessionMock: vi.fn(async () => {}),
  signDeployTokenMock: vi.fn(() => 'sig'),
  decryptWithSecretMock: vi.fn(() => '0xprivkey'),
  sendUserOperationMock: vi.fn(async () => '0xuserop'),
  getUserOperationReceiptMock: vi.fn(async () => ({ receipt: { transactionHash: '0xtxhash' } })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: readJsonBodyMock,
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

vi.mock('../../server/_lib/deploySessions.js', () => ({
  getDeploySessionById: getDeploySessionByIdMock,
  transitionDeploySession: transitionDeploySessionMock,
  updateDeploySession: updateDeploySessionMock,
  signDeployToken: signDeployTokenMock,
  decryptWithSecret: decryptWithSecretMock,
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://creatorvault.fun'),
}))

vi.mock('../../server/_lib/privyWalletApi.js', () => ({
  secp256k1SignHash: vi.fn(async () => '0xsig'),
  walletRpc: vi.fn(async () => ({ data: { signature: '0xabc' } })),
}))

vi.mock('viem', () => ({
  getAddress: (value: string) => String(value).toLowerCase(),
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn(async ({ functionName }: any) => {
      if (functionName === 'ownerCount') return 1n
      return '0xownerbytes'
    }),
  })),
  encodeAbiParameters: vi.fn(() => '0xownerbytes'),
  encodeFunctionData: vi.fn(() => '0xcalldata'),
  http: vi.fn(() => ({ transport: 'http' })),
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({ address: '0xowner' })),
  toAccount: vi.fn(() => ({ address: '0xowner' })),
}))

vi.mock('viem/chains', () => ({
  base: {},
}))

vi.mock('viem/account-abstraction', () => ({
  createBundlerClient: vi.fn(() => ({ getUserOperationReceipt: getUserOperationReceiptMock })),
  createPaymasterClient: vi.fn(() => ({
    getPaymasterData: vi.fn(async () => ({})),
    getPaymasterStubData: vi.fn(async () => ({})),
  })),
  sendUserOperation: sendUserOperationMock,
  toCoinbaseSmartAccount: vi.fn(async () => ({ address: '0xsmart' })),
}))

function makeDeploySession(step: string) {
  return {
    id: 'sess_1',
    tokenHash: 'hash',
    sessionAddress: '0xsession',
    smartWallet: '0xsmartwallet',
    sessionOwner: '0xowner',
    deployToken: 'token',
    sessionOwnerKeyEnc: 'encrypted',
    payload: {
      phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }],
      phase3Calls: [],
    },
    step,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: null,
    lastUserOpHash: '0xhash',
    lastTxHash: null,
  }
}

describe('deploy session optimistic concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSiwaAgentFromRequestMock.mockReturnValue(null)
  })

  it('allows one continue transition and returns 409 on the second', async () => {
    getDeploySessionByIdMock.mockResolvedValue(makeDeploySession('created'))
    transitionDeploySessionMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const req1 = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res1 = createMockRes()
    await continueHandler(req1, res1)

    const req2 = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res2 = createMockRes()
    await continueHandler(req2, res2)

    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(409)
    expect(res2.body?.error).toBe('Concurrent modification')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
  })

  it('returns 409 in status handler on stale transition conflict', async () => {
    getDeploySessionByIdMock.mockResolvedValue(makeDeploySession('phase2_sent'))
    transitionDeploySessionMock.mockResolvedValueOnce(false)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()

    await statusHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('Concurrent modification')
  })

  it('keeps terminal sessions terminal', async () => {
    getDeploySessionByIdMock.mockResolvedValue(makeDeploySession('completed'))

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()

    await continueHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('Session already completed')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('allows SIWA auth when cookie session is missing', async () => {
    const rec = {
      ...makeDeploySession('completed'),
      sessionAddress: '0x0000000000000000000000000000000000000001',
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    readSessionFromRequestMock.mockReturnValueOnce(null as any)
    readSiwaAgentFromRequestMock.mockReturnValueOnce({
      address: '0x0000000000000000000000000000000000000001',
      agentId: 34,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      chainId: 8453,
    } as any)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()

    await continueHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('completed')
  })


  it('blocks continue when ERC-7712 grant does not allow stage calls', async () => {
    const rec = {
      ...makeDeploySession('created'),
      payload: {
        phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
        phase3Calls: [],
        erc7712Grant: {
          version: 'erc7712-v1',
          chainId: 8453,
          validAfter: new Date(Date.now() - 60_000).toISOString(),
          validUntil: new Date(Date.now() + 60_000).toISOString(),
          sessionId: 'sess_1',
          allowedTargets: ['0x00000000000000000000000000000000000000aa'],
          allowedSelectors: ['0xaaaaaaaa'],
        },
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('erc7712_')
    expect(transitionDeploySessionMock).not.toHaveBeenCalled()
  })
  it('returns actionable 409 when continue session owner credentials are unavailable', async () => {
    const rec = {
      ...makeDeploySession('created'),
      sessionOwnerKeyEnc: null,
      payload: { phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('credentials unavailable')
    expect(updateDeploySessionMock).not.toHaveBeenCalled()
  })

  it('cancel marks session cancelled when owner credentials are unavailable', async () => {
    const rec = {
      ...makeDeploySession('created'),
      sessionOwnerKeyEnc: null,
      payload: { phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.cleanupSkipped).toBe(true)
    expect(res.body?.data?.step).toBe('cancelled')
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'cancelled', lastError: 'cleanup_skipped_owner_unavailable' }),
    )
  })

  it('status remains readable when owner credentials are unavailable', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      sessionOwnerKeyEnc: null,
      payload: { phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.id).toBe('sess_1')
  })
})
