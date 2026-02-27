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
  getCanonicalOrigin: vi.fn(() => 'https://app.4626.fun'),
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
    lastUserOpHash: `0x${'1'.repeat(64)}`,
    lastTxHash: null,
  }
}

function makeCall(to: string, data = '0x12345678') {
  return { to, value: '0', data }
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

  it('blocks continue when ERC-7712 grant sessionId does not match deploy session', async () => {
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
          sessionId: 'other_session',
          allowedTargets: ['0xcalltarget'],
          allowedSelectors: ['0x12345678'],
        },
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('erc7712_session_mismatch')
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

  it('does not append cleanup owner removal when persistent session owner is enabled', async () => {
    const rec = {
      ...makeDeploySession('created'),
      payload: {
        phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
        phase3Calls: [],
        agentWalletId: 'agent_123',
        persistSessionOwner: true,
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(Array.isArray(args?.calls)).toBe(true)
    expect(args.calls).toHaveLength(1)
    expect(String(args.calls[0]?.to)).toBe('0xcalltarget')
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

  it('cancel skips cleanup for persistent managed session owners', async () => {
    const rec = {
      ...makeDeploySession('created'),
      payload: {
        phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }],
        phase3Calls: [],
        agentWalletId: 'agent_123',
        persistSessionOwner: true,
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.cleanupSkipped).toBe(true)
    expect(res.body?.data?.reason).toBe('persistent_session_owner')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'cancelled', lastError: null }),
    )
  })

  it('status remains readable when owner credentials are unavailable', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      sessionOwnerKeyEnc: null,
      payload: { phase2Calls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.id).toBe('sess_1')
  })

  it('continue sequences phase3 before phase4 when both are present', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2Calls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(String(args.calls[0]?.to)).toBe('0xphase3target')
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'phase3_sent' }),
    )
  })

  it('continue transitions phase3_confirmed to phase4_sent', async () => {
    const rec = {
      ...makeDeploySession('phase3_confirmed'),
      payload: {
        phase2Calls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(String(args.calls[0]?.to)).toBe('0xphase4target')
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'phase4_sent' }),
    )
  })

  it('status advances phase3_sent to phase4_sent when phase4 calls exist', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: {
        phase2Calls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase4_sent', lastUserOpHash: '0xuserop' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(String(args.calls[0]?.to)).toBe('0xphase4target')
  })

  it('continue honors required downstream stages when payload is stringified JSON', async () => {
    const rec = {
      ...makeDeploySession('phase2_core_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xphase2target')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      }),
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(String(args.calls[0]?.to)).toBe('0xphase2target')
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'phase2_sent' }),
    )
  })

  it('status does not auto-complete when downstream stages are still required', async () => {
    const rec = {
      ...makeDeploySession('phase2_core_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xphase2target')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase2_sent', lastUserOpHash: '0xuserop' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase2_sent')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase2_core_sent', toStep: 'phase2_core_confirmed' }),
    )
  })

  it('status advances phase4_sent to completed', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: {
        phase2Calls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'completed', lastTxHash: '0xtxhash' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('completed')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('persists server-side revert debug on continue reverts (no debug blob leaked)', async () => {
    const rec = {
      ...makeDeploySession('created'),
      payload: {
        phase2Calls: [],
        phase2FinalizeCalls: [makeCall('0xcalltarget', '0x12345678')],
        phase3Calls: [],
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const e: any = new Error('Execution reverted for an unknown reason.')
    e.cause = { cause: { data: '0x1375159e00000000' }, metaMessages: ['UserOperationExecutionError'] }
    sendUserOperationMock.mockRejectedValueOnce(e)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('Deploy execution reverted:')
    expect(String(res.body?.error ?? '')).toContain('InvalidCodeId()')
    expect(JSON.stringify(res.body ?? {})).not.toContain('lastErrorDebug')

    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'failed',
        payloadPatch: expect.objectContaining({
          lastErrorDebug: expect.objectContaining({
            selector: '0x1375159e',
            errorName: 'InvalidCodeId()',
          }),
        }),
      }),
    )
  })

  it('persists server-side revert debug on status send failures (no debug blob leaked)', async () => {
    // Starting the next stage (`phase3_sent`) will attempt `sendUserOperation(...)`.
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2Calls: [],
        phase3Calls: [makeCall('0xphase3target', '0x12345678')],
        phase4Calls: [],
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const e: any = new Error('UserOperationExecutionError: AA23 reverted')
    e.cause = { cause: { data: '0x1375159e00000000' }, metaMessages: ['AA23 reverted'] }
    sendUserOperationMock.mockRejectedValueOnce(e)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    // Status endpoint best-effort returns current state even if advance fails.
    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(res.body ?? {})).not.toContain('lastErrorDebug')

    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'phase3_sent',
        payloadPatch: expect.objectContaining({
          lastErrorDebug: expect.objectContaining({
            selector: '0x1375159e',
            errorName: 'InvalidCodeId()',
          }),
        }),
      }),
    )
  })
})
