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
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(String(value)),
  decodeEventLog: vi.fn(() => ({
    eventName: 'AuctionLaunchedDeferred',
    args: {},
  })),
  decodeFunctionData: vi.fn(() => ({
    args: [
      {
        creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
        depositAmount: '5000000000000000000000000',
      },
    ],
  })),
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
    sessionSigner: '0xowner',
    deployToken: 'token',
    sessionSignerKeyEnc: 'encrypted',
    payload: {
      phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x' }],
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
    delete process.env.DEPLOY_SOLANA_OVAULT_KILL_SWITCH
    delete process.env.SOLANA_OVAULT_KILL_SWITCH
    delete process.env.DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE
    delete process.env.SOLANA_PREFLIGHT_ROUTE_MODE
    delete process.env.DEPLOY_SOLANA_LEGACY_WRITE_DISABLED
    delete process.env.SOLANA_LEGACY_WRITE_DISABLED
    delete process.env.DEPLOY_SOLANA_REGISTRATION_ORIGINS
    delete process.env.SOLANA_REGISTRATION_ORIGINS
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

  it('marks expired sessions as failed and returns restart-required from continue', async () => {
    const rec = {
      ...makeDeploySession('created'),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(410)
    expect(String(res.body?.error ?? '')).toContain('Please restart deploy session')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'failed',
        lastError: 'session_expired_restart_required',
        payloadPatch: expect.objectContaining({
          sessionExpiredReason: 'session_expired_restart_required',
        }),
      }),
    )
  })

  it('status auto-marks expired non-terminal sessions as failed with restart diagnostics', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    }
    const updated = {
      ...rec,
      step: 'failed',
      lastError: 'session_expired_restart_required',
      payload: {
        sessionExpiredAt: new Date().toISOString(),
        sessionExpiredReason: 'session_expired_restart_required',
      },
    }
    getDeploySessionByIdMock.mockResolvedValueOnce(rec).mockResolvedValueOnce(updated)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('failed')
    expect(res.body?.data?.diagnostics?.category).toBe('expired')
    expect(res.body?.data?.diagnostics?.restartRequired).toBe(true)
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'failed',
        lastError: 'session_expired_restart_required',
      }),
    )
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('status diagnostics report replay-skip markers', async () => {
    const rec = {
      ...makeDeploySession('completed'),
      payload: {
        replaySkipPhase2CoreAt: '2026-03-01T10:00:00.000Z',
        replaySkipPhase2CoreReason: 'onchain_phase2_core_already_deployed',
        replaySkipPhase2FinalizeAt: '2026-03-01T10:00:01.000Z',
        replaySkipPhase2FinalizeReason: 'onchain_phase2_finalize_already_completed',
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.diagnostics?.category).toBe('ok')
    expect(res.body?.data?.diagnostics?.replay?.phase2CoreSkipRecorded).toBe(true)
    expect(res.body?.data?.diagnostics?.replay?.phase2FinalizeSkipRecorded).toBe(true)
    expect(res.body?.data?.diagnostics?.replay?.phase2CoreSkipReason).toBe('onchain_phase2_core_already_deployed')
    expect(res.body?.data?.diagnostics?.replay?.phase2FinalizeSkipReason).toBe(
      'onchain_phase2_finalize_already_completed',
    )
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
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
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
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
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
      sessionSignerKeyEnc: null,
      payload: { phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
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
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
        phase3Calls: [],
        deploySignerWalletId: 'agent_123',
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
      sessionSignerKeyEnc: null,
      payload: { phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
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
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x' }],
        phase3Calls: [],
        deploySignerWalletId: 'agent_123',
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
      sessionSignerKeyEnc: null,
      payload: { phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x' }], phase3Calls: [] },
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
        phase2FinalizeCalls: [],
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
        phase2FinalizeCalls: [],
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

  it('status blocks phase3_sent advancement when phase3 call is not deployPhase3Strategies', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastError: 'phase3 verification failed' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase3_sent')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalled()
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

  it('skips replayed phase2 core/finalize when onchain phase2 is already finalized', async () => {
    const rec = {
      ...makeDeploySession('phase1_finalize_confirmed'),
      payload: JSON.stringify({
        phase2CoreCalls: [makeCall('0xphase2coretarget')],
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
      }),
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockReturnValue({
      args: [
        {
          creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
          owner: '0x00000000000000000000000000000000000000aa',
          vault: '0x00000000000000000000000000000000000000ab',
          gaugeController: '0x00000000000000000000000000000000000000ac',
          ccaStrategy: '0x00000000000000000000000000000000000000ad',
          oracle: '0x00000000000000000000000000000000000000ae',
          depositAmount: '5000000000000000000000000',
        },
      ],
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        if (functionName === 'ownerCount') return 1n
        if (functionName === 'nextOwnerIndex') return 1n
        if (functionName === 'ownerAtIndex') return '0xownerbytes'
        if (functionName === 'owner') return '0x00000000000000000000000000000000000000aa'
        return '0xownerbytes'
      }),
      getBytecode: vi.fn(async () => '0x60016000'),
    })
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase1_finalize_confirmed', toStep: 'completed' }),
    )
  })

  it('status fast-forwards replayed phase2_core_sent with missing hash and starts finalize', async () => {
    const rec = {
      ...makeDeploySession('phase2_core_sent'),
      lastUserOpHash: null,
      payload: JSON.stringify({
        phase2CoreCalls: [makeCall('0xphase2coretarget')],
        phase2FinalizeCalls: [makeCall('0xphase2target')],
      }),
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockReturnValue({
      args: [
        {
          creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
          owner: '0x00000000000000000000000000000000000000aa',
          vault: '0x00000000000000000000000000000000000000ab',
          gaugeController: '0x00000000000000000000000000000000000000ac',
          ccaStrategy: '0x00000000000000000000000000000000000000ad',
          oracle: '0x00000000000000000000000000000000000000ae',
          depositAmount: '5000000000000000000000000',
        },
      ],
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        if (functionName === 'ownerCount') return 1n
        if (functionName === 'nextOwnerIndex') return 1n
        if (functionName === 'ownerAtIndex') return '0xownerbytes'
        if (functionName === 'owner') return '0x00000000000000000000000000000000000000bb'
        return '0xownerbytes'
      }),
      getBytecode: vi.fn(async () => '0x60016000'),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase2_sent', lastUserOpHash: '0xuserop' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase2_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const args = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(String(args.calls[0]?.to)).toBe('0xphase2target')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase2_core_sent', toStep: 'phase2_core_confirmed' }),
    )
  })

  it('status uses canonical Solana preflight payload before phase3 strategies', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            registered: true,
            existingMintCompatible: true,
            depositEligible: true,
            redeemEligible: true,
          },
        }),
    })) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastUserOpHash: '0xuserop' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalled()
      const [url, init] = (fetchMock.mock.calls as any[])[0] as [string, { body?: string }]
      expect(String(url)).toContain('/api/deploy/setupSolanaOvaultMesh')
      const payload = JSON.parse(String(init?.body ?? '{}'))
      expect(String(payload.bridgeToken).toLowerCase()).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
      expect(String(payload.creatorToken).toLowerCase()).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
      expect(payload.expectedSolanaAmount).toBe('1500000000000000000000000')
      expect(payload.assetMintOrigin).toBe('existing')
      expect(payload.enforceCompatibility).toBe(true)
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status skips Meteora payload fields for already-registered Solana bridge token', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            registered: true,
            existingMintCompatible: true,
            depositEligible: true,
            redeemEligible: true,
          },
        }),
    })) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return true
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastUserOpHash: '0xuserop' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalled()
      const [url, init] = (fetchMock.mock.calls as any[])[0] as [string, { body?: string }]
      expect(String(url)).toContain('/api/deploy/setupSolanaOvaultMesh')
      const payload = JSON.parse(String(init?.body ?? '{}'))
      expect(String(payload.bridgeToken).toLowerCase()).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
      expect(payload.buildOnly).toBe(true)
      expect(payload.creatorToken).toBeUndefined()
      expect(payload.expectedSolanaAmount).toBeUndefined()
      expect(payload.assetMintOrigin).toBe('existing')
      expect(payload.enforceCompatibility).toBe(true)
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status falls back to legacy preflight route when OVault mesh route is unavailable', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ success: false, error: 'Not found' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              registered: true,
              existingMintCompatible: true,
              depositEligible: true,
              redeemEligible: true,
            },
          }),
      } as any)

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return true
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastUserOpHash: '0xuserop' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/setupSolanaOvaultMesh')
      expect(String((fetchMock.mock.calls as any[])[1]?.[0] ?? '')).toContain('/api/deploy/registerSolanaBridgeToken')
      expect(res.body?.data?.step).toBe('phase3_sent')
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status uses legacy preflight route when OVault kill switch is enabled', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    process.env.DEPLOY_SOLANA_OVAULT_KILL_SWITCH = '1'
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            registered: true,
            existingMintCompatible: true,
            depositEligible: true,
            redeemEligible: true,
          },
        }),
    })) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return true
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastUserOpHash: '0xuserop' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/registerSolanaBridgeToken')
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).not.toContain('/api/deploy/setupSolanaOvaultMesh')
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status honors ovault_only route mode and skips legacy fallback', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    process.env.DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE = 'ovault_only'
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ success: false, error: 'Not found' }),
    }) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase2_confirmed', lastError: 'Solana preflight failed' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/setupSolanaOvaultMesh')
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status fails fast when legacy_only mode is combined with disabled legacy writes', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    process.env.DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE = 'legacy_only'
    process.env.DEPLOY_SOLANA_LEGACY_WRITE_DISABLED = '1'
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn()

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase2_confirmed', lastError: 'Solana preflight misconfigured' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
      const updateArg = (updateDeploySessionMock.mock.calls as any[])[0]?.[0] as any
      expect(String(updateArg?.lastError ?? '')).toContain('legacy_only route mode')
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status forwards internal Solana registration secret when preparing phase3', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const previous = process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = 'internal-secret'
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            registered: true,
            existingMintCompatible: true,
            depositEligible: true,
            redeemEligible: true,
          },
        }),
    })) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastUserOpHash: '0xuserop' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      const init = (fetchMock.mock.calls as any[])[0]?.[1] as { headers?: Record<string, string> } | undefined
      expect(init?.headers?.['X-CV-Solana-Registration-Secret']).toBe('internal-secret')
    } finally {
      if (typeof previous === 'undefined') delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
      else process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = previous
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status blocks phase3 advancement when Solana preflight fails', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ success: false, error: 'Not found' }),
    }) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase2_confirmed', lastError: 'Solana preflight failed' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/setupSolanaOvaultMesh')
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status blocks phase3 advancement when OVault eligibility is false', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            registered: true,
            existingMintCompatible: false,
            depositEligible: false,
            redeemEligible: true,
            mintCompatibility: {
              blockers: ['tokenProgram hint is required for existing mint flow.'],
            },
          },
        }),
    }) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      const viem = await import('viem')
      ;(viem.createPublicClient as any).mockReturnValue({
        readContract: vi.fn(async ({ functionName }: any) => {
          switch (functionName) {
            case 'ownerCount':
              return 1n
            case 'nextOwnerIndex':
              return 1n
            case 'ownerAtIndex':
              return '0xownerbytes'
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            default:
              return '0xownerbytes'
          }
        }),
      })
      getDeploySessionByIdMock
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce({ ...rec, step: 'phase2_confirmed', lastError: 'ovault eligibility failed' })
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
      const updateArg = (updateDeploySessionMock.mock.calls as any[])[0]?.[0] as any
      expect(String(updateArg?.lastError ?? '')).toContain('ovault eligibility')
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status blocks phase3_sent completion when strategy post-check fails', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deploy')],
        phase4Calls: [makeCall('0xphase4target')],
      }),
      lastUserOpHash: `0x${'2'.repeat(64)}`,
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase3deploy') {
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault: '0x3000000000000000000000000000000000000003',
              version: 'v1.4.3',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault: '0x3000000000000000000000000000000000000003',
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy: '0x5000000000000000000000000000000000000005',
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName, args }: any) => {
        switch (functionName) {
          case 'strategyList':
            // Return only a zero-address placeholder to simulate missing strategy wiring.
            return Number(args?.[0] ?? 0n) === 0 ? '0x0000000000000000000000000000000000000000' : '0xownerbytes'
          case 'strategyWeights':
            return 0n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async () => '0x'),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase3_sent', lastError: 'phase3 verification failed' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase3_sent')
    expect(transitionDeploySessionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_sent', toStep: 'phase3_confirmed' }),
    )
    expect(updateDeploySessionMock).toHaveBeenCalled()
  })

  it('status blocks phase4_sent completion when CCA/Uniswap post-check fails', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase4launch')],
      }),
      lastUserOpHash: `0x${'3'.repeat(64)}`,
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: '0x7000000000000000000000000000000000000007',
              version: 'v1.4.3',
              floorPriceQ96: 1n,
              requiredRaise: 1n,
              auctionSteps: '0x1234',
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault: '0x3000000000000000000000000000000000000003',
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy: '0x5000000000000000000000000000000000000005',
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        switch (functionName) {
          case 'currentAuction':
            // Zero auction -> should fail phase4 verification once implemented.
            return '0x0000000000000000000000000000000000000000'
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async () => '0x'),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase4_sent', lastError: 'phase4 verification failed' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(transitionDeploySessionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase4_sent', toStep: 'phase4_confirmed' }),
    )
    expect(updateDeploySessionMock).toHaveBeenCalled()
  })

  it('status advances phase3_sent when strategy post-check succeeds', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deploy')],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'4'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8000000000000000000000000000000000000008'
    const ajnaStrategy = '0x9000000000000000000000000000000000000009'
    const charmVault = '0xa00000000000000000000000000000000000000a'
    const v3Factory = '0xb00000000000000000000000000000000000000b'
    const usdc = '0xc00000000000000000000000000000000000000c'
    const v3Pool = '0xd00000000000000000000000000000000000000d'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase3deploy') {
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              version: 'v1.4.3',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy: '0x5000000000000000000000000000000000000005',
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName, args, address }: any) => {
        switch (functionName) {
          case 'strategyList':
            if (Number(args?.[0] ?? 0n) === 0) return charmStrategy
            if (Number(args?.[0] ?? 0n) === 1) return ajnaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'completed', lastTxHash: '0xtxhash' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('completed')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_sent', toStep: 'phase3_confirmed' }),
    )
  })

  it('status advances phase3_sent when Charm/Ajna/Solana strategy post-check succeeds', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv2')],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'8'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8100000000000000000000000000000000000008'
    const ajnaStrategy = '0x9100000000000000000000000000000000000009'
    const solanaStrategy = '0xa10000000000000000000000000000000000000a'
    const charmVault = '0xb10000000000000000000000000000000000000b'
    const ajnaPool = '0xc10000000000000000000000000000000000000c'
    const bridgeAdapter = '0xd10000000000000000000000000000000000000d'
    const v3Factory = '0xe10000000000000000000000000000000000000e'
    const usdc = '0xf10000000000000000000000000000000000000f'
    const v3Pool = '0x1110000000000000000000000000000000000011'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase3deployv2') {
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              version: 'v1.4.8',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
              solanaWeightBps: 3000n,
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy: '0x5000000000000000000000000000000000000005',
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName, args, address }: any) => {
        switch (functionName) {
          case 'strategyList':
            if (Number(args?.[0] ?? 0n) === 0) return charmStrategy
            if (Number(args?.[0] ?? 0n) === 1) return ajnaStrategy
            if (Number(args?.[0] ?? 0n) === 2) return solanaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ajnaPool':
            if (String(address ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_strategy')
          case 'bridgeAdapter':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAdapter
            throw new Error('not_solana_strategy')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaStrategy.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          ajnaPool.toLowerCase(),
          bridgeAdapter.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'completed', lastTxHash: '0xtxhash' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('completed')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_sent', toStep: 'phase3_confirmed' }),
    )
  })

  it('status advances phase4_sent when CCA/Uniswap post-check succeeds', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase4launch')],
      }),
      lastUserOpHash: `0x${'5'.repeat(64)}`,
    }
    const viem = await import('viem')
    const shareOft = '0x7000000000000000000000000000000000000007'
    const ccaStrategy = '0x5000000000000000000000000000000000000005'
    const auction = '0xe00000000000000000000000000000000000000e'
    const ccaFactory = '0xf00000000000000000000000000000000000000f'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: shareOft,
              version: 'v1.4.3',
              floorPriceQ96: 1n,
              requiredRaise: 1n,
              auctionSteps: '0x1234',
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault: '0x3000000000000000000000000000000000000003',
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy,
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        switch (functionName) {
          case 'currentAuction':
            return auction
          case 'ccaFactory':
            return ccaFactory
          case 'isGraduated':
            return false
          case 'totalSupply':
            return 1000n
          case 'balanceOf':
            return 1000n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          shareOft.toLowerCase(),
          ccaStrategy.toLowerCase(),
          auction.toLowerCase(),
          ccaFactory.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'completed', lastTxHash: '0xtxhash' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('completed')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase4_sent', toStep: 'phase4_confirmed' }),
    )
  })

  it('status blocks phase4_sent completion when auction funding is below totalSupply', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase4launch')],
      }),
      lastUserOpHash: `0x${'7'.repeat(64)}`,
    }
    const viem = await import('viem')
    const shareOft = '0x7000000000000000000000000000000000000007'
    const ccaStrategy = '0x5000000000000000000000000000000000000005'
    const auction = '0xe00000000000000000000000000000000000000e'
    const ccaFactory = '0xf00000000000000000000000000000000000000f'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: shareOft,
              version: 'v1.4.3',
              floorPriceQ96: 1n,
              requiredRaise: 1n,
              auctionSteps: '0x1234',
            },
          ],
        }
      }
      if (String(data) === '0xphase2finalize') {
        return {
          functionName: 'finalizePhase2',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault: '0x3000000000000000000000000000000000000003',
              gaugeController: '0x4000000000000000000000000000000000000004',
              ccaStrategy,
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        switch (functionName) {
          case 'currentAuction':
            return auction
          case 'ccaFactory':
            return ccaFactory
          case 'isGraduated':
            return false
          case 'totalSupply':
            return 1000n
          case 'balanceOf':
            return 999n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          shareOft.toLowerCase(),
          ccaStrategy.toLowerCase(),
          auction.toLowerCase(),
          ccaFactory.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase4_sent', lastError: 'phase4 verification failed' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(transitionDeploySessionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase4_sent', toStep: 'phase4_confirmed' }),
    )
    expect(updateDeploySessionMock).toHaveBeenCalled()
  })

  it('status advances phase4_sent from launch event fallback without phase2 finalize payload', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [],
        phase3Calls: [],
        phase4Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase4launch')],
      }),
      lastUserOpHash: `0x${'6'.repeat(64)}`,
    }
    const viem = await import('viem')
    const shareOft = '0x7000000000000000000000000000000000000007'
    const ccaStrategy = '0x5000000000000000000000000000000000000005'
    const auction = '0xe00000000000000000000000000000000000000e'
    const ccaFactory = '0xf00000000000000000000000000000000000000f'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: shareOft,
              version: 'v1.4.3',
              floorPriceQ96: 1n,
              requiredRaise: 1n,
              auctionSteps: '0x1234',
            },
          ],
        }
      }
      return {
        args: [
          {
            creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
            depositAmount: '5000000000000000000000000',
          },
        ],
      }
    })
    ;(viem.decodeEventLog as any).mockImplementation(() => ({
      eventName: 'AuctionLaunchedDeferred',
      args: {
        creatorToken: '0x1000000000000000000000000000000000000001',
        owner: '0x2000000000000000000000000000000000000002',
        shareOFT: shareOft,
        ccaStrategy,
        amount: 1000n,
        auction,
      },
    }))
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        switch (functionName) {
          case 'currentAuction':
            // Force event fallback path.
            return '0x0000000000000000000000000000000000000000'
          case 'ccaFactory':
            return ccaFactory
          case 'isGraduated':
            return false
          case 'totalSupply':
            return 1000n
          case 'balanceOf':
            return 1000n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          shareOft.toLowerCase(),
          ccaStrategy.toLowerCase(),
          auction.toLowerCase(),
          ccaFactory.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
      getTransactionReceipt: vi.fn(async () => ({
        logs: [
          {
            address: '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753',
            data: '0x',
            topics: ['0x'],
          },
        ],
      })),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'completed', lastTxHash: '0xtxhash' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('completed')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase4_sent', toStep: 'phase4_confirmed' }),
    )
  })

  it('status blocks phase4_sent completion when phase4 call is not launchDeferredAuction', async () => {
    const rec = {
      ...makeDeploySession('phase4_sent'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({ ...rec, step: 'phase4_sent', lastError: 'phase4 verification failed' })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalled()
  })

  it('continue advances phase2_confirmed into OVault mesh gate when enabled', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [],
        solanaOvault: { enabled: true },
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('ovault_mesh_confirmed')
    expect(transitionDeploySessionMock).toHaveBeenCalledTimes(2)
    expect(transitionDeploySessionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase2_confirmed', toStep: 'ovault_mesh_sent' }),
    )
    expect(transitionDeploySessionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'sess_1', fromStep: 'ovault_mesh_sent', toStep: 'ovault_mesh_confirmed' }),
    )
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('continue resumes ovault_mesh_sent by confirming mesh without re-sending sent transition', async () => {
    const rec = {
      ...makeDeploySession('ovault_mesh_sent'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [],
        solanaOvault: { enabled: true },
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('ovault_mesh_confirmed')
    expect(transitionDeploySessionMock).toHaveBeenCalledTimes(1)
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'ovault_mesh_sent', toStep: 'ovault_mesh_confirmed' }),
    )
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('persists server-side revert debug on continue reverts (no debug blob leaked)', async () => {
    const rec = {
      ...makeDeploySession('created'),
      payload: {
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
        phase2FinalizeCalls: [],
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
