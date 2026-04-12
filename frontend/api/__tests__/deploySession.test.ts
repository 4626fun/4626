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
  ensureLaunchImageReadyMock,
  validateSponsoredSmartWalletCallsMock,
  verifyDeployPhase2InvariantsMock,
  checkRateLimitMock,
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
  ensureLaunchImageReadyMock: vi.fn(async () => ({
    projectId: 'imgproj_1',
    outputBlobUrl: 'https://cdn.example/image.png',
    vaultAddress: '0x3000000000000000000000000000000000000003',
    shareOFT: '0x7000000000000000000000000000000000000007',
  })),
  validateSponsoredSmartWalletCallsMock: vi.fn(async (..._args: unknown[]) => ({ expectedCreatorToken: null, mode: 'deploy' })),
  verifyDeployPhase2InvariantsMock: vi.fn(
    async (): Promise<{
      checked: boolean
      checksRun: number
      violations: Array<{ code: string; message: string }>
      expectations: Record<string, unknown> | null
    }> => ({
      checked: true,
      checksRun: 0,
      violations: [],
      expectations: null,
    }),
  ),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: readJsonBodyMock,
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

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    deploySessionStatus: { windowMs: 60_000, maxRequests: 240 },
    deploySessionContinue: { windowMs: 60_000, maxRequests: 30 },
    deploySessionCancel: { windowMs: 60_000, maxRequests: 20 },
  },
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://app.4626.fun'),
}))

vi.mock('../../server/_lib/privyWalletApi.js', () => ({
  secp256k1SignHash: vi.fn(async () => '0xsig'),
  walletRpc: vi.fn(async () => ({ data: { signature: '0xabc' } })),
}))

vi.mock('../../server/_lib/deployLaunchImage.js', () => ({
  ensureLaunchImageReady: ensureLaunchImageReadyMock,
  LAUNCH_IMAGE_PROJECT_ID_KEY: 'launchImageProjectId',
  LAUNCH_IMAGE_READY_AT_KEY: 'launchImageReadyAt',
  LAUNCH_IMAGE_VAULT_KEY: 'launchImageVaultAddress',
  LAUNCH_IMAGE_SHARE_OFT_KEY: 'launchImageShareOft',
  LAUNCH_IMAGE_VERIFIED_AT_KEY: 'launchImageVerifiedAt',
  LAUNCH_IMAGE_VERIFIED_BYTES_KEY: 'launchImageVerifiedBytes',
}))

vi.mock('../../server/_lib/deployPhase2Invariants.js', () => ({
  verifyDeployPhase2Invariants: verifyDeployPhase2InvariantsMock,
}))

vi.mock('../_handlers/_paymaster.js', () => ({
  validateSponsoredSmartWalletCalls: validateSponsoredSmartWalletCallsMock,
}))

vi.mock('viem', () => ({
  getAddress: (value: string) => String(value).toLowerCase(),
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(String(value)),
  keccak256: vi.fn(() => `0x${'1'.repeat(64)}`),
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
    sessionSignerWalletId: 'agent_123',
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
    verifyDeployPhase2InvariantsMock.mockResolvedValue({
      checked: true,
      checksRun: 0,
      violations: [],
      expectations: null,
    })
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = 'internal-secret'
    delete process.env.DEPLOY_SOLANA_REGISTRATION_ORIGINS
    delete process.env.SOLANA_REGISTRATION_ORIGINS
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 })
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

  it('returns 400 when session id format is invalid', async () => {
    const req = createMockReq({ method: 'POST', body: { sessionId: 'bad id with spaces' } })
    const res = createMockRes()
    await continueHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('Missing or invalid sessionId')
    expect(getDeploySessionByIdMock).not.toHaveBeenCalled()
  })

  it('returns 429 when continue polling is rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 15_000 })
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many continue attempts')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 when status polling is rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 15_000 })
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many status checks')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 when cancel is rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 15_000 })
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many cancel attempts')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 401 when continue auth is missing and does not touch storage', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null as any)
    readSiwaAgentFromRequestMock.mockReturnValueOnce(null as any)
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Not authenticated')
    expect(getDeploySessionByIdMock).not.toHaveBeenCalled()
  })

  it('returns 401 when cancel auth is missing and does not touch storage', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null as any)
    readSiwaAgentFromRequestMock.mockReturnValueOnce(null as any)
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Not authenticated')
    expect(getDeploySessionByIdMock).not.toHaveBeenCalled()
  })

  it('returns 404 when continue session id does not exist', async () => {
    getDeploySessionByIdMock.mockResolvedValueOnce(null)
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)
    expect(res.statusCode).toBe(404)
    expect(res.body?.error).toBe('Not found')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('returns 404 when cancel session id does not exist', async () => {
    getDeploySessionByIdMock.mockResolvedValueOnce(null)
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)
    expect(res.statusCode).toBe(404)
    expect(res.body?.error).toBe('Not found')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('returns 403 from status when deploy session belongs to a different principal', async () => {
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0x0000000000000000000000000000000000000001',
    } as any)
    getDeploySessionByIdMock.mockResolvedValueOnce({
      ...makeDeploySession('created'),
      sessionAddress: '0x0000000000000000000000000000000000000002',
    })
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('Forbidden')
    expect(transitionDeploySessionMock).not.toHaveBeenCalled()
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('returns 403 from cancel when deploy session belongs to a different principal', async () => {
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0x0000000000000000000000000000000000000001',
    } as any)
    getDeploySessionByIdMock.mockResolvedValueOnce({
      ...makeDeploySession('created'),
      sessionAddress: '0x0000000000000000000000000000000000000002',
    })
    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await cancelHandler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('Forbidden')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
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

  it('continue blocks post-phase2 advancement when phase2 invariant gate fails', async () => {
    const gateResult = {
      checked: true,
      checksRun: 5,
      violations: [
        {
          code: 'strategy_fee_recipient_mismatch',
          message: 'CCALaunchStrategy feeRecipient does not match expected tradeFeeCollector',
        },
      ],
      expectations: {
        creatorToken: '0x1000000000000000000000000000000000000001',
        shareToken: '0x2000000000000000000000000000000000000002',
        gaugeController: '0x3000000000000000000000000000000000000003',
        ccaStrategy: '0x4000000000000000000000000000000000000004',
        expectedTradeFeeCollector: '0x3000000000000000000000000000000000000003',
        expectedPayoutRecipient: '0x3000000000000000000000000000000000000003',
        payoutRecipientMode: 'gauge' as const,
      },
    }
    verifyDeployPhase2InvariantsMock.mockResolvedValueOnce(gateResult)
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
        phase3Calls: [makeCall('0xphase3target')],
      },
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('phase2_invariant_failed:strategy_fee_recipient_mismatch')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        payloadPatch: expect.objectContaining({
          phase2InvariantGate: expect.objectContaining({
            violations: [expect.objectContaining({ code: 'strategy_fee_recipient_mismatch' })],
          }),
          phase2InvariantGateCheckedAt: expect.any(String),
        }),
      }),
    )
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'failed',
        lastError: 'phase2_invariant_failed:strategy_fee_recipient_mismatch',
      }),
    )
  })

  it('status marks the session failed and exposes phase2 invariant gate details', async () => {
    const gateResult = {
      checked: true,
      checksRun: 5,
      violations: [
        {
          code: 'external_revenue_recipient_mismatch',
          message: 'Creator Coin payoutRecipient does not match expected recipient',
        },
      ],
      expectations: {
        creatorToken: '0x1000000000000000000000000000000000000001',
        shareToken: '0x2000000000000000000000000000000000000002',
        gaugeController: '0x3000000000000000000000000000000000000003',
        ccaStrategy: '0x4000000000000000000000000000000000000004',
        expectedTradeFeeCollector: '0x3000000000000000000000000000000000000003',
        expectedPayoutRecipient: '0x5000000000000000000000000000000000000005',
        payoutRecipientMode: 'payout_router' as const,
      },
    }
    verifyDeployPhase2InvariantsMock.mockResolvedValueOnce(gateResult)
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [{ to: '0xcalltarget', value: '0', data: '0x12345678' }],
        phase3Calls: [makeCall('0xphase3target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({
        ...rec,
        step: 'failed',
        lastError: 'phase2_invariant_failed:external_revenue_recipient_mismatch',
        payload: {
          ...rec.payload,
          phase2InvariantGate: gateResult,
        },
      })

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('failed')
    expect(res.body?.data?.lastError).toBe('phase2_invariant_failed:external_revenue_recipient_mismatch')
    expect(res.body?.data?.phase2InvariantGate?.violations?.[0]?.code).toBe(
      'external_revenue_recipient_mismatch',
    )
    expect(sendUserOperationMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'failed',
        lastError: 'phase2_invariant_failed:external_revenue_recipient_mismatch',
      }),
    )
  })

  it('allows SIWA auth when cookie session is missing', async () => {
    const rec = {
      ...makeDeploySession('completed'),
      sessionAddress: '0x0000000000000000000000000000000000000001',
    }
    getDeploySessionByIdMock.mockResolvedValue(rec)
    readSessionFromRequestMock.mockReturnValue(null as any)
    readSiwaAgentFromRequestMock.mockReturnValue({
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
      sessionSignerWalletId: null,
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
      sessionSignerWalletId: null,
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

  it('continue retries phase4 without inline cleanup when cleanup call fails', async () => {
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
    sendUserOperationMock
      .mockRejectedValueOnce(new Error('removeOwnerAtIndex reverted'))
      .mockResolvedValueOnce(`0x${'a'.repeat(64)}`)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(2)
    const firstOptions = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    const secondOptions = (sendUserOperationMock.mock.calls as any[])[1]?.[1] as any
    expect(Array.isArray(firstOptions?.calls)).toBe(true)
    expect(Array.isArray(secondOptions?.calls)).toBe(true)
    expect(firstOptions.calls).toHaveLength(2)
    expect(secondOptions.calls).toHaveLength(1)
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'phase4_sent',
        payloadPatch: expect.objectContaining({
          cleanupDeferredAt: expect.any(String),
          cleanupDeferredReason: expect.any(String),
        }),
      }),
    )
  })

  it('status retries phase4 without inline cleanup when cleanup call fails', async () => {
    const rec = {
      ...makeDeploySession('phase3_confirmed'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({
        ...rec,
        step: 'phase4_sent',
        lastUserOpHash: `0x${'b'.repeat(64)}`,
      })
    transitionDeploySessionMock.mockResolvedValue(true)
    sendUserOperationMock
      .mockRejectedValueOnce(new Error('removeOwnerAtIndex reverted'))
      .mockResolvedValueOnce(`0x${'b'.repeat(64)}`)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(2)
    const firstOptions = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    const secondOptions = (sendUserOperationMock.mock.calls as any[])[1]?.[1] as any
    expect(firstOptions.calls).toHaveLength(2)
    expect(secondOptions.calls).toHaveLength(1)
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        step: 'phase4_sent',
        payloadPatch: expect.objectContaining({
          cleanupDeferredAt: expect.any(String),
          cleanupDeferredReason: expect.any(String),
        }),
      }),
    )
  })

  it('status keeps cleanup_sent pending until cleanup receipt is available', async () => {
    const rec = {
      ...makeDeploySession('cleanup_sent'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [],
      },
      lastUserOpHash: `0x${'1'.repeat(64)}`,
    }
    getDeploySessionByIdMock.mockResolvedValueOnce(rec).mockResolvedValueOnce(rec)
    getUserOperationReceiptMock.mockResolvedValueOnce(null as any)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('cleanup_sent')
    expect(transitionDeploySessionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'cleanup_sent', toStep: 'cancelled' }),
    )
  })

  it('status transitions cleanup_sent to cancelled once cleanup receipt is confirmed', async () => {
    const txHash = `0x${'9'.repeat(64)}`
    const rec = {
      ...makeDeploySession('cleanup_sent'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [],
      },
      lastUserOpHash: `0x${'1'.repeat(64)}`,
    }
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({
        ...rec,
        step: 'cancelled',
        lastTxHash: txHash,
      })
    transitionDeploySessionMock.mockResolvedValue(true)
    getUserOperationReceiptMock.mockResolvedValueOnce({ receipt: { transactionHash: txHash } })

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('cancelled')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        fromStep: 'cleanup_sent',
        toStep: 'cancelled',
        lastTxHash: txHash,
      }),
    )
  })

  it('status remains readable when owner credentials are unavailable', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      sessionSignerWalletId: null,
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
    expect(ensureLaunchImageReadyMock).toHaveBeenCalledTimes(1)
    expect(updateDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', step: 'phase4_sent' }),
    )
  })

  it('continue blocks phase4 transition when launch image gate fails', async () => {
    const rec = {
      ...makeDeploySession('phase3_confirmed'),
      payload: {
        phase2FinalizeCalls: [],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    ensureLaunchImageReadyMock.mockRejectedValueOnce(
      new Error('phase4 image gate failed: /api/image/projects/direct-compose (409) Composition already in progress'),
    )
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('phase4 image gate failed')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('status keeps phase3_confirmed when launch image gate fails before phase4 send', async () => {
    const rec = {
      ...makeDeploySession('phase3_confirmed'),
      payload: {
        phase2FinalizeCalls: [makeCall('0xphase2target')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [makeCall('0xphase4target')],
      },
    }
    ensureLaunchImageReadyMock.mockRejectedValueOnce(
      new Error('phase4 image gate failed: generated image did not bind to vault'),
    )
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({
        ...rec,
        step: 'phase3_confirmed',
        lastError: 'phase4 image gate failed: generated image did not bind to vault',
      })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase3_confirmed')
    expect(String(res.body?.data?.lastError ?? '')).toContain('phase4 image gate failed')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
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

  it('status progresses phase2 to phase3 then phase4 in order when both are present', async () => {
    const batcher = '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753'
    const vault = '0x3000000000000000000000000000000000000003'
    const shareOft = '0x7000000000000000000000000000000000000007'
    const ccaStrategy = '0x5000000000000000000000000000000000000005'
    const charmStrategy = '0x8100000000000000000000000000000000000008'
    const ajnaStrategy = '0x9100000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9200000000000000000000000000000000000009'
    const ajnaAuth = '0x9300000000000000000000000000000000000009'
    const solanaStrategy = '0xa10000000000000000000000000000000000000a'
    const charmVault = '0xb10000000000000000000000000000000000000b'
    const ajnaPool = '0xc10000000000000000000000000000000000000c'
    const bridgeAddress = '0xd10000000000000000000000000000000000000d'
    const v3Factory = '0xe10000000000000000000000000000000000000e'
    const usdc = '0xf10000000000000000000000000000000000000f'
    const v3Pool = '0x1110000000000000000000000000000000000011'
    const auction = '0xe00000000000000000000000000000000000000e'
    const ccaFactory = '0xf00000000000000000000000000000000000000f'
    const recPhase2 = {
      ...makeDeploySession('phase2_sent'),
      payload: {
        phase2FinalizeCalls: [makeCall(batcher, '0xphase2finalize')],
        phase3Calls: [
          makeCall(batcher, '0xphase3deployv2'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3setminidle'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [makeCall(batcher, '0xphase4launch')],
      },
      lastUserOpHash: `0x${'2'.repeat(64)}`,
    }
    const recPhase3 = {
      ...recPhase2,
      step: 'phase3_sent',
      lastUserOpHash: `0x${'3'.repeat(64)}`,
    }
    const recPhase4 = {
      ...recPhase2,
      step: 'phase4_sent',
      lastUserOpHash: `0x${'4'.repeat(64)}`,
    }
    const viem = await import('viem')
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
      if (String(data) === '0xphase3setminidle') {
        return {
          functionName: 'setMinimumTotalIdle',
          args: [1000n],
        }
      }
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
              ccaStrategy,
              oracle: '0x6000000000000000000000000000000000000006',
              depositAmount: '5000000000000000000000000',
            },
          ],
        }
      }
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: shareOft,
              version: 'v1.4.8',
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
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName, args, address }: any) => {
        switch (functionName) {
          case 'ownerCount':
            return 1n
          case 'ownerAtIndex':
            return '0xownerbytes'
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
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'admin':
            if (String(address ?? '').toLowerCase() === ajnaAuth.toLowerCase()) {
              return '0x2000000000000000000000000000000000000002'
            }
            throw new Error('not_ajna_auth')
          case 'bridgeAddress':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAddress
            throw new Error('not_solana_strategy')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          case 'minimumTotalIdle':
            return 1000n
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
          vault.toLowerCase(),
          shareOft.toLowerCase(),
          ccaStrategy.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaStrategy.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          ajnaPool.toLowerCase(),
          bridgeAddress.toLowerCase(),
          v3Pool.toLowerCase(),
          auction.toLowerCase(),
          ccaFactory.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      // first status poll
      .mockResolvedValueOnce(recPhase2)
      .mockResolvedValueOnce(recPhase3)
      // second status poll
      .mockResolvedValueOnce(recPhase3)
      .mockResolvedValueOnce(recPhase4)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req1 = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res1 = createMockRes()
    await statusHandler(req1, res1)

    const req2 = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res2 = createMockRes()
    await statusHandler(req2, res2)

    expect(res1.statusCode).toBe(200)
    expect(res1.body?.data?.step).toBe('phase3_sent')
    expect(res2.statusCode).toBe(200)
    expect(res2.body?.data?.step).toBe('phase4_sent')
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase2_sent', toStep: 'phase2_confirmed' }),
    )
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_sent', toStep: 'phase3_confirmed' }),
    )
    expect(transitionDeploySessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_confirmed', toStep: 'phase4_sent' }),
    )
  }, 10_000)

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
      expect(String(url)).toContain('/api/deploy/registerSolanaBridgeToken')
      const payload = JSON.parse(String(init?.body ?? '{}'))
      expect(String(payload.bridgeToken).toLowerCase()).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
      expect(payload.buildOnly).toBe(true)
      expect(String(payload.creatorToken).toLowerCase()).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
      expect(payload.expectedSolanaAmount).toBe('1500000000000000000000000')
      expect(payload.assetMintOrigin).toBe('existing')
      expect(payload.enforceCompatibility).toBe(true)
      expect(String(url).startsWith('https://app.4626.fun/')).toBe(true)
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status ignores request host when choosing Solana preflight origin', async () => {
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

      const req = createMockReq({
        method: 'POST',
        headers: {
          host: 'attacker.example',
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'https',
        },
        body: { sessionId: 'sess_1' },
      })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalled()
      const [url] = (fetchMock.mock.calls as any[])[0] as [string]
      expect(String(url)).toContain('https://app.4626.fun/api/deploy/registerSolanaBridgeToken')
      expect(String(url)).not.toContain('attacker.example')
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
      expect(String(url)).toContain('/api/deploy/registerSolanaBridgeToken')
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

  it('status fails preflight without retrying legacy route when OVault mesh route is unavailable', async () => {
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
              return true
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
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/registerSolanaBridgeToken')
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status uses only the internal Solana registration secret when preparing phase3', async () => {
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

      const req = createMockReq({
        method: 'POST',
        headers: {
          'x-siwa-receipt': 'siwa-receipt-token',
          'x-privy-token': 'privy-auth-token',
        },
        body: { sessionId: 'sess_1' },
      })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      const init = (fetchMock.mock.calls as any[])[0]?.[1] as { headers?: Record<string, string> } | undefined
      expect(init?.headers?.['X-CV-Solana-Registration-Secret']).toBe('internal-secret')
      expect(init?.headers?.['X-SIWA-Receipt']).toBeUndefined()
      expect(init?.headers?.['X-Privy-Token']).toBeUndefined()
      expect(init?.headers?.Authorization).toBeUndefined()
      expect(init?.headers?.Cookie).toBeUndefined()
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
      expect(String((fetchMock.mock.calls as any[])[0]?.[0] ?? '')).toContain('/api/deploy/registerSolanaBridgeToken')
      expect(transitionDeploySessionMock).not.toHaveBeenCalled()
      expect(updateDeploySessionMock).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('status fails closed when the internal Solana registration secret is missing', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753')],
        phase3Calls: [makeCall('0xphase3target')],
      }),
    }
    const previous = process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
    delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET

    try {
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

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await statusHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(updateDeploySessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sess_1',
          lastError: expect.stringContaining('DEPLOY_SOLANA_REGISTRATION_SECRET is required'),
        }),
      )
    } finally {
      if (typeof previous === 'undefined') delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
      else process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = previous
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
      const sawOvaultEligibilityFailure = (updateDeploySessionMock.mock.calls as any[]).some((call) =>
        String(call?.[0]?.lastError ?? '').includes('ovault eligibility'),
      )
      expect(sawOvaultEligibilityFailure).toBe(true)
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
              version: 'v1.7.1',
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

  it('status blocks phase3_sent completion when minimumTotalIdle does not match phase3 payload', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [
          makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv4'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3setminidle'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [makeCall('0xphase4target')],
      }),
      lastUserOpHash: `0x${'2'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8400000000000000000000000000000000000008'
    const ajnaAdapter = '0x9400000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9500000000000000000000000000000000000009'
    const ajnaAuth = '0x9600000000000000000000000000000000000009'
    const ajnaPool = '0x9700000000000000000000000000000000000009'
    const solanaStrategy = '0xa40000000000000000000000000000000000000a'
    const charmVault = '0xb40000000000000000000000000000000000000b'
    const bridgeAddress = '0xd40000000000000000000000000000000000000d'
    const v3Factory = '0xe40000000000000000000000000000000000000e'
    const usdc = '0xf40000000000000000000000000000000000000f'
    const v3Pool = '0x1410000000000000000000000000000000000014'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase3deployv4') {
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              version: 'v1.4.10',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
              solanaWeightBps: 3000n,
            },
          ],
        }
      }
      if (String(data) === '0xphase3setminidle') {
        return {
          functionName: 'setMinimumTotalIdle',
          args: [1000n],
        }
      }
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
            if (Number(args?.[0] ?? 0n) === 1) return ajnaAdapter
            if (Number(args?.[0] ?? 0n) === 2) return solanaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'admin':
            if (String(address ?? '').toLowerCase() === ajnaAuth.toLowerCase()) {
              return '0x2000000000000000000000000000000000000002'
            }
            throw new Error('not_ajna_auth')
          case 'bridgeAddress':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAddress
            throw new Error('not_solana_strategy')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          case 'minimumTotalIdle':
            return 999n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaAdapter.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          ajnaPool.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          bridgeAddress.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
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
              version: 'v1.7.1',
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

  it('status blocks phase3_sent when legacy two-strategy payload omits Solana weight', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [
          makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deploy'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3setminidle'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'4'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8000000000000000000000000000000000000008'
    const ajnaAdapter = '0x9000000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9100000000000000000000000000000000000009'
    const ajnaAuth = '0x9200000000000000000000000000000000000009'
    const ajnaPool = '0x9300000000000000000000000000000000000009'
    const charmVault = '0xa00000000000000000000000000000000000000a'
    const v3Factory = '0xb00000000000000000000000000000000000000b'
    const usdc = '0xc00000000000000000000000000000000000000c'
    const v3Pool = '0xd00000000000000000000000000000000000000d'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ abi, data }: { abi: unknown; data: string }) => {
      if (String(data) === '0xphase3deploy') {
        expect(JSON.stringify(abi)).not.toContain('ajnaStrategy')
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              version: 'v1.4.8',
              charmVaultName: 'Charm Vault',
              charmVaultSymbol: 'CHARM',
              ajnaVaultName: 'Ajna Vault',
              ajnaVaultSymbol: 'AJNA',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
              solanaWeightBps: 0n,
              ajnaBufferRatioBps: 1000n,
              ajnaMinBucketIndex: 1200n,
            },
          ],
        }
      }
      if (String(data) === '0xphase3setminidle') {
        return {
          functionName: 'setMinimumTotalIdle',
          args: [1000n],
        }
      }
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
            if (Number(args?.[0] ?? 0n) === 1) return ajnaAdapter
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          case 'minimumTotalIdle':
            return 1000n
          case 'admin':
            if (String(address ?? '').toLowerCase() === ajnaAuth.toLowerCase()) {
              return '0x2000000000000000000000000000000000000002'
            }
            throw new Error('not_ajna_auth')
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaAdapter.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          ajnaPool.toLowerCase(),
          charmVault.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
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

  it('status advances phase3_sent when Charm/Ajna/Solana strategy post-check succeeds', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [
          makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv2'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3setminidle'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'8'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8100000000000000000000000000000000000008'
    const ajnaAdapter = '0x9100000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9200000000000000000000000000000000000009'
    const ajnaAuth = '0x9300000000000000000000000000000000000009'
    const solanaStrategy = '0xa10000000000000000000000000000000000000a'
    const charmVault = '0xb10000000000000000000000000000000000000b'
    const ajnaPool = '0xc10000000000000000000000000000000000000c'
    const bridgeAddress = '0xd10000000000000000000000000000000000000d'
    const v3Factory = '0xe10000000000000000000000000000000000000e'
    const usdc = '0xf10000000000000000000000000000000000000f'
    const v3Pool = '0x1110000000000000000000000000000000000011'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ abi, data }: { abi: unknown; data: string }) => {
      if (String(data) === '0xphase3deployv2') {
        expect(JSON.stringify(abi)).not.toContain('ajnaStrategy')
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
      if (String(data) === '0xphase3setminidle') {
        return {
          functionName: 'setMinimumTotalIdle',
          args: [1000n],
        }
      }
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
            if (Number(args?.[0] ?? 0n) === 1) return ajnaAdapter
            if (Number(args?.[0] ?? 0n) === 2) return solanaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'bridgeAddress':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAddress
            throw new Error('not_solana_strategy')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          case 'minimumTotalIdle':
            return 1000n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          ajnaAdapter.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          ajnaPool.toLowerCase(),
          bridgeAddress.toLowerCase(),
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

  it('status blocks phase3_sent when canonical payload omits setMinimumTotalIdle', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [
          makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv2'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'8'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8100000000000000000000000000000000000008'
    const ajnaAdapter = '0x9100000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9200000000000000000000000000000000000009'
    const ajnaAuth = '0x9300000000000000000000000000000000000009'
    const solanaStrategy = '0xa10000000000000000000000000000000000000a'
    const charmVault = '0xb10000000000000000000000000000000000000b'
    const ajnaPool = '0xc10000000000000000000000000000000000000c'
    const bridgeAddress = '0xd10000000000000000000000000000000000000d'
    const v3Factory = '0xe10000000000000000000000000000000000000e'
    const usdc = '0xf10000000000000000000000000000000000000f'
    const v3Pool = '0x1110000000000000000000000000000000000011'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ abi, data }: { abi: unknown; data: string }) => {
      if (String(data) === '0xphase3deployv2') {
        expect(JSON.stringify(abi)).not.toContain('ajnaStrategy')
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
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
            if (Number(args?.[0] ?? 0n) === 1) return ajnaAdapter
            if (Number(args?.[0] ?? 0n) === 2) return solanaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaAdapter.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'bridgeAddress':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAddress
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
          ajnaAdapter.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          ajnaPool.toLowerCase(),
          bridgeAddress.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
    })
    getDeploySessionByIdMock
      .mockResolvedValueOnce(rec)
      .mockResolvedValueOnce({
        ...rec,
        step: 'phase3_sent',
        lastError:
          'phase3 verification failed: setMinimumTotalIdle call missing from phase3 payload while idle reserve is required',
      })
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase3_sent')
    expect(String(res.body?.data?.lastError ?? '')).toContain('setMinimumTotalIdle call missing')
    expect(transitionDeploySessionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_1', fromStep: 'phase3_sent', toStep: 'phase3_confirmed' }),
    )
    expect(updateDeploySessionMock).toHaveBeenCalled()
  })

  it('status returns persisted phase3 Ajna admin alignment diagnostics', async () => {
    const rec = {
      ...makeDeploySession('completed'),
      payload: JSON.stringify({
        phase1Calls: [],
        phase2Calls: [],
        phase3Calls: [],
        phase4Calls: [],
        phase3AjnaAdminAlignment: {
          ajnaAuthAddress: '0x9200000000000000000000000000000000000009',
          expectedAjnaAuthAdmin: '0x2000000000000000000000000000000000000002',
          ajnaAuthAdmin: '0x7000000000000000000000000000000000000007',
          ajnaAuthAdminMatchesOwner: false,
        },
        launchImageProjectId: 'imgproj_demo',
        launchImageShareOft: '0x7000000000000000000000000000000000000007',
        launchImageVaultAddress: '0x3000000000000000000000000000000000000003',
        launchImageReadyAt: '2026-03-14T12:00:00.000Z',
        launchImageVerifiedAt: '2026-03-14T12:00:01.000Z',
        launchImageVerifiedBytes: 12345,
      }),
    }
    getDeploySessionByIdMock.mockResolvedValueOnce(rec)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.phase3AjnaAdminAlignment).toEqual({
      ajnaAuthAddress: '0x9200000000000000000000000000000000000009',
      expectedAjnaAuthAdmin: '0x2000000000000000000000000000000000000002',
      ajnaAuthAdmin: '0x7000000000000000000000000000000000000007',
      ajnaAuthAdminMatchesOwner: false,
    })
    expect(res.body?.data?.launchImage).toEqual({
      projectId: 'imgproj_demo',
      shareOft: '0x7000000000000000000000000000000000000007',
      vaultAddress: '0x3000000000000000000000000000000000000003',
      readyAt: '2026-03-14T12:00:00.000Z',
      verifiedAt: '2026-03-14T12:00:01.000Z',
      verifiedBytes: 12345,
    })
  })

  it('status blocks phase3_sent with extra active strategies when SolanaStrategy exposes bridgeAddress', async () => {
    const rec = {
      ...makeDeploySession('phase3_sent'),
      payload: JSON.stringify({
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [
          makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv3'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3setminidle'),
          makeCall('0x3000000000000000000000000000000000000003', '0xphase3deploytostrategies'),
        ],
        phase4Calls: [],
      }),
      lastUserOpHash: `0x${'9'.repeat(64)}`,
    }
    const viem = await import('viem')
    const charmStrategy = '0x8200000000000000000000000000000000000008'
    const extraStrategy = '0x8300000000000000000000000000000000000008'
    const ajnaStrategy = '0x9200000000000000000000000000000000000009'
    const ajnaInnerVault = '0x9300000000000000000000000000000000000009'
    const ajnaAuth = '0x9400000000000000000000000000000000000009'
    const solanaStrategy = '0xa20000000000000000000000000000000000000a'
    const charmVault = '0xb20000000000000000000000000000000000000b'
    const ajnaPool = '0xc20000000000000000000000000000000000000c'
    const bridgeAddress = '0xd20000000000000000000000000000000000000d'
    const v3Factory = '0xe20000000000000000000000000000000000000e'
    const usdc = '0xf20000000000000000000000000000000000000f'
    const v3Pool = '0x1210000000000000000000000000000000000012'
    const vault = '0x3000000000000000000000000000000000000003'
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase3deployv3') {
        return {
          functionName: 'deployPhase3Strategies',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              vault,
              version: 'v1.4.9',
              charmWeightBps: 3000n,
              ajnaWeightBps: 3000n,
              solanaWeightBps: 3000n,
            },
          ],
        }
      }
      if (String(data) === '0xphase3setminidle') {
        return {
          functionName: 'setMinimumTotalIdle',
          args: [1000n],
        }
      }
      if (String(data) === '0xphase3deploytostrategies') {
        return {
          functionName: 'deployToStrategies',
          args: [],
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
            if (Number(args?.[0] ?? 0n) === 1) return extraStrategy
            if (Number(args?.[0] ?? 0n) === 2) return ajnaStrategy
            if (Number(args?.[0] ?? 0n) === 3) return solanaStrategy
            return '0xownerbytes'
          case 'strategyWeights':
            if (String(args?.[0] ?? '').toLowerCase() === charmStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === extraStrategy.toLowerCase()) return 100n
            if (String(args?.[0] ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return 3000n
            if (String(args?.[0] ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return 3000n
            return 0n
          case 'charmVault':
            if (String(address ?? '').toLowerCase() === charmStrategy.toLowerCase()) return charmVault
            throw new Error('not_charm_strategy')
          case 'ERC4626_VAULT':
            if (String(address ?? '').toLowerCase() === ajnaStrategy.toLowerCase()) return ajnaInnerVault
            throw new Error('not_ajna_adapter')
          case 'AJNA_POOL':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaPool
            throw new Error('not_ajna_inner_vault')
          case 'AUTH':
            if (String(address ?? '').toLowerCase() === ajnaInnerVault.toLowerCase()) return ajnaAuth
            throw new Error('not_ajna_inner_vault')
          case 'admin':
            if (String(address ?? '').toLowerCase() === ajnaAuth.toLowerCase()) {
              return '0x2000000000000000000000000000000000000002'
            }
            throw new Error('not_ajna_auth')
          case 'bridgeAddress':
            if (String(address ?? '').toLowerCase() === solanaStrategy.toLowerCase()) return bridgeAddress
            throw new Error('not_solana_strategy')
          case 'bridgeAdapter':
            throw new Error('bridge_adapter_not_exposed')
          case 'uniswapV3Factory':
            return v3Factory
          case 'usdc':
            return usdc
          case 'getPool':
            return v3Pool
          case 'minimumTotalIdle':
            return 1000n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) => {
        const withCode = new Set([
          vault.toLowerCase(),
          charmStrategy.toLowerCase(),
          extraStrategy.toLowerCase(),
          ajnaStrategy.toLowerCase(),
          ajnaInnerVault.toLowerCase(),
          ajnaAuth.toLowerCase(),
          solanaStrategy.toLowerCase(),
          charmVault.toLowerCase(),
          ajnaPool.toLowerCase(),
          bridgeAddress.toLowerCase(),
          v3Pool.toLowerCase(),
        ])
        return withCode.has(String(address ?? '').toLowerCase()) ? '0x6001' : '0x'
      }),
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
              version: 'v1.7.1',
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
              version: 'v1.7.1',
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
              version: 'v1.7.1',
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

  it('continue uses only the internal registration secret during OVault mesh preflight', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [],
        solanaOvault: { enabled: true },
      },
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
            existingMintCompatible: true,
            depositEligible: true,
            redeemEligible: true,
          },
        }),
    })) as any

    try {
      ;(globalThis as any).fetch = fetchMock
      getDeploySessionByIdMock.mockResolvedValue(rec)
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({
        method: 'POST',
        headers: {
          'x-siwa-receipt': 'siwa-receipt-token',
          'x-privy-token': 'privy-auth-token',
        },
        body: { sessionId: 'sess_1' },
      })
      const res = createMockRes()
      await continueHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.step).toBe('ovault_mesh_confirmed')
      expect(fetchMock).toHaveBeenCalled()
      const [url, init] = (fetchMock.mock.calls as any[])[0] as [string, { headers?: Record<string, string> }]
      expect(String(url)).toContain('/api/deploy/registerSolanaBridgeToken')
      expect(init?.headers?.['X-CV-Solana-Registration-Secret']).toBe('internal-secret')
      expect(init?.headers?.['X-SIWA-Receipt']).toBeUndefined()
      expect(init?.headers?.['X-Privy-Token']).toBeUndefined()
      expect(init?.headers?.Authorization).toBeUndefined()
      expect(init?.headers?.Cookie).toBeUndefined()
    } finally {
      if (typeof previous === 'undefined') delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
      else process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = previous
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('continue fails closed when internal Solana registration secret is missing', async () => {
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalize')],
        phase3Calls: [makeCall('0xphase3target')],
        phase4Calls: [],
        solanaOvault: { enabled: true },
      },
    }
    const previous = process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
    delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET

    try {
      getDeploySessionByIdMock.mockResolvedValue(rec)
      transitionDeploySessionMock.mockResolvedValue(true)

      const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
      const res = createMockRes()
      await continueHandler(req, res)

      expect(res.statusCode).toBe(500)
      expect(String(res.body?.error ?? '')).toContain('Internal server error')
    } finally {
      if (typeof previous === 'undefined') delete process.env.DEPLOY_SOLANA_REGISTRATION_SECRET
      else process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = previous
    }
  })

  it('continue preserves deployToStrategies in stored phase3 calls', async () => {
    const vault = '0x3000000000000000000000000000000000000003'
    const rec = {
      ...makeDeploySession('phase2_confirmed'),
      payload: {
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalizewithvault')],
        phase3Calls: [makeCall('0xphase3target'), makeCall(vault, '0x355aa867')],
        phase4Calls: [],
      },
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase2finalizewithvault') {
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
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase3_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const options = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(Array.isArray(options?.calls)).toBe(true)
    expect(options.calls.map((call: any) => call.data)).toContain('0x355aa867')
  })

  it('continue sends only stored phase4 calls after phase3 is confirmed', async () => {
    const charmStrategy = '0x8100000000000000000000000000000000000008'
    const ajnaStrategy = '0x9100000000000000000000000000000000000009'
    const charmVault = '0xa10000000000000000000000000000000000000a'
    const asset = '0xb10000000000000000000000000000000000000b'
    const vault = '0x3000000000000000000000000000000000000003'
    const rec = {
      ...makeDeploySession('phase3_confirmed'),
      payload: {
        phase2FinalizeCalls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase2finalizewithvault')],
        phase3Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase3deployv2')],
        phase4Calls: [makeCall('0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753', '0xphase4launch')],
      },
    }
    const viem = await import('viem')
    ;(viem.decodeFunctionData as any).mockImplementation(({ data }: { data: string }) => {
      if (String(data) === '0xphase2finalizewithvault') {
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
      if (String(data) === '0xphase4launch') {
        return {
          functionName: 'launchDeferredAuction',
          args: [
            {
              creatorToken: '0x1000000000000000000000000000000000000001',
              owner: '0x2000000000000000000000000000000000000002',
              shareOFT: '0x7000000000000000000000000000000000000007',
              version: 'v1.4.8',
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
    ;(viem.createPublicClient as any).mockReturnValue({
      readContract: vi.fn(async ({ functionName, args, address }: any) => {
        switch (functionName) {
          case 'ownerCount':
            return 1n
          case 'ownerAtIndex':
            return '0xownerbytes'
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
          case 'totalStrategyWeight':
            return 6000n
          case 'minimumTotalIdle':
            return 1000n
          case 'asset':
            return asset
          case 'balanceOf':
            return 9000n
          default:
            return '0xownerbytes'
        }
      }),
      getBytecode: vi.fn(async () => '0x'),
    })
    getDeploySessionByIdMock.mockResolvedValue(rec)
    transitionDeploySessionMock.mockResolvedValue(true)

    const req = createMockReq({ method: 'POST', body: { sessionId: 'sess_1' } })
    const res = createMockRes()
    await continueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.step).toBe('phase4_sent')
    expect(sendUserOperationMock).toHaveBeenCalledTimes(1)
    const options = (sendUserOperationMock.mock.calls as any[])[0]?.[1] as any
    expect(Array.isArray(options?.calls)).toBe(true)
    expect(options.calls).toHaveLength(2)
    expect(options.calls[0]?.data).toBe('0xphase4launch')
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
