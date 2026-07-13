import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import activationStatusHandler from '../_handlers/onboarding/_activation-status.ts'
import completeActivationHandler from '../_handlers/onboarding/_complete-activation.ts'
import provisionHandler from '../_handlers/onboarding/_provision-agent-owner.ts'
import { createMockReq, createMockRes } from './helpers'
import { issueActivationOwnerToken } from '../../server/_lib/wallet/activationOwnerToken.js'

const CSW = getAddress('0x1111111111111111111111111111111111111111')
const EMBEDDED = getAddress('0x2222222222222222222222222222222222222222')
const SERVER = getAddress('0x3333333333333333333333333333333333333333')

const {
  checkDurableRateLimitMock,
  getDbMock,
  resolveActivationContextMock,
  readActivationStatusMock,
  enableCswAgentMock,
  registerClaimMock,
  consumeClaimMock,
  bootstrapMock,
  resolveServerWalletMock,
  isOwnerMock,
  prepareAddOwnerTxMock,
} = vi.hoisted(() => ({
  checkDurableRateLimitMock: vi.fn(async (..._args: unknown[]) => ({
    allowed: true,
    remaining: 9,
    resetAt: Date.now() + 60_000,
    source: 'memory' as const,
  })),
  getDbMock: vi.fn<(...args: unknown[]) => unknown>(),
  resolveActivationContextMock: vi.fn<(...args: unknown[]) => unknown>(),
  readActivationStatusMock: vi.fn<(...args: unknown[]) => unknown>(),
  enableCswAgentMock: vi.fn(async (..._args: unknown[]) => undefined),
  registerClaimMock: vi.fn(async (..._args: unknown[]) => undefined),
  consumeClaimMock: vi.fn(async (..._args: unknown[]) => undefined),
  bootstrapMock: vi.fn<(...args: unknown[]) => unknown>(),
  resolveServerWalletMock: vi.fn<(...args: unknown[]) => unknown>(),
  isOwnerMock: vi.fn<(...args: unknown[]) => unknown>(),
  prepareAddOwnerTxMock: vi.fn((..._args: unknown[]) => ({
    chainId: 8453,
    to: CSW,
    data: '0x0f0f3f240000000000000000000000003333333333333333333333333333333333333333',
    value: '0x0',
  })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('@4626/server-core')
  return {
    ...actual,
    getDb: (...args: unknown[]) => getDbMock(...args),
    checkDurableRateLimit: (...args: unknown[]) => checkDurableRateLimitMock(...args),
    handleOptions: vi.fn(() => false),
    setCors: vi.fn(),
    setNoStore: vi.fn(),
    readJsonBody: vi.fn(async (req: { body?: unknown }) => req.body ?? {}),
    getClientIp: vi.fn(() => '203.0.113.10'),
    rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  }
})

vi.mock('../../server/_lib/wallet/activationContext.js', () => ({
  resolveActivationContext: (...args: unknown[]) => resolveActivationContextMock(...args),
  readActivationStatus: (...args: unknown[]) => readActivationStatusMock(...args),
}))

vi.mock('../../server/_lib/messaging/creatorXmtpAgents.js', () => ({
  enableCswAgent: (...args: unknown[]) => enableCswAgentMock(...args),
}))

vi.mock('../../server/_lib/wallet/activationOwnerTokenClaim.js', () => ({
  registerActivationOwnerTokenClaim: (...args: unknown[]) => registerClaimMock(...args),
  consumeActivationOwnerTokenClaim: (...args: unknown[]) => consumeClaimMock(...args),
  assertActivationOwnerTokenClaimActive: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/wallet/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: (...args: unknown[]) => bootstrapMock(...args),
  extractDelegationFlags: vi.fn(() => ({})),
}))

vi.mock('../../server/_lib/wallet/activationServerWallet.js', () => ({
  resolveActivationServerWallet: (...args: unknown[]) => resolveServerWalletMock(...args),
}))

vi.mock('../../server/_lib/wallet/coinbaseSmartWalletOwner.js', () => ({
  isOwner: (...args: unknown[]) => isOwnerMock(...args),
  prepareAddOwnerTx: (...args: unknown[]) => prepareAddOwnerTxMock(...args),
}))

vi.mock('../../server/_lib/wallet/privyWalletApi.js', () => ({
  createAgentWallet: vi.fn(),
  getWalletById: vi.fn(),
}))

vi.mock('../../server/_lib/onchain/baseRpcUrl.js', () => ({
  resolveServerBaseRpcUrl: () => 'https://mainnet.base.org',
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({})),
  }
})

describe('onboarding activation handlers', () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AUTH_SESSION_SECRET = 'test-activation-secret-1234'
    checkDurableRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    })
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({
        rows: [{
          preprov_server_wallet_id: 'wallet-1',
          preprov_server_wallet_address: SERVER,
        }],
      })),
    })
    resolveActivationContextMock.mockResolvedValue({
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      parentCswAddress: CSW,
      embeddedEoaAddress: EMBEDDED,
      serverWalletId: 'wallet-1',
      serverWalletAddress: SERVER,
    })
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SESSION_SECRET
    else process.env.AUTH_SESSION_SECRET = originalSecret
  })

  it('rate-limits activation-status', async () => {
    checkDurableRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      source: 'memory',
    })
    const res = createMockRes()
    await activationStatusHandler(createMockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(429)
  })

  it('returns activation status for an authenticated profile', async () => {
    readActivationStatusMock.mockResolvedValue({
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      parentCswAddress: CSW,
      embeddedEoaAddress: EMBEDDED,
      serverWalletId: 'wallet-1',
      serverWalletAddress: SERVER,
      embeddedOwnerConfirmed: true,
      serverOwnerConfirmed: false,
      xmtpProvisioned: false,
    })
    const res = createMockRes()
    await activationStatusHandler(createMockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toMatchObject({
      parentCswAddress: CSW,
      embeddedOwnerConfirmed: true,
      serverOwnerConfirmed: false,
      xmtpProvisioned: false,
    })
  })

  it('rejects provision without activation purpose', async () => {
    const res = createMockRes()
    await provisionHandler(
      createMockReq({ method: 'POST', body: { purpose: 'wrong' } }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('activation_purpose_required')
  })

  it('rejects provision when embedded owner is not confirmed', async () => {
    bootstrapMock.mockResolvedValue({
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      canonicalCswAddress: CSW,
      privyEmbeddedEoaAddress: EMBEDDED,
      privyIsOwner: false,
    })
    const res = createMockRes()
    await provisionHandler(
      createMockReq({
        method: 'POST',
        body: { purpose: 'enable_4626_server_owner' },
      }),
      res,
    )
    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('embedded_owner_not_confirmed')
  })

  it('provisions automation owner and registers a claim', async () => {
    bootstrapMock.mockResolvedValue({
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      canonicalCswAddress: CSW,
      privyEmbeddedEoaAddress: EMBEDDED,
      privyIsOwner: true,
    })
    resolveServerWalletMock.mockResolvedValue({
      walletId: 'wallet-1',
      address: SERVER,
    })
    isOwnerMock.mockResolvedValue(false)
    const res = createMockRes()
    await provisionHandler(
      createMockReq({
        method: 'POST',
        body: { purpose: 'enable_4626_server_owner' },
      }),
      res,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.agentWalletAddress).toBe(SERVER)
    expect(res.body?.data?.activationToken).toEqual(expect.any(String))
    expect(registerClaimMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.txRequest).toBeTruthy()
  })

  it('completes activation only with matching token and consumes the claim', async () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: EMBEDDED,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: EMBEDDED,
      serverOwnerAddress: SERVER,
      jti: 'complete-jti-01',
    })
    readActivationStatusMock
      .mockResolvedValueOnce({
        profileId: 42,
        privyUserId: 'did:privy:user-1',
        parentCswAddress: CSW,
        embeddedEoaAddress: EMBEDDED,
        serverWalletId: 'wallet-1',
        serverWalletAddress: SERVER,
        embeddedOwnerConfirmed: true,
        serverOwnerConfirmed: true,
        xmtpProvisioned: false,
      })
      .mockResolvedValueOnce({
        profileId: 42,
        privyUserId: 'did:privy:user-1',
        parentCswAddress: CSW,
        embeddedEoaAddress: EMBEDDED,
        serverWalletId: 'wallet-1',
        serverWalletAddress: SERVER,
        embeddedOwnerConfirmed: true,
        serverOwnerConfirmed: true,
        xmtpProvisioned: true,
      })

    const res = createMockRes()
    await completeActivationHandler(
      createMockReq({
        method: 'POST',
        body: { activationToken: token },
      }),
      res,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toMatchObject({
      ready: true,
      parentCswAddress: CSW,
      xmtpIdentifier: CSW.toLowerCase(),
    })
    expect(enableCswAgentMock).toHaveBeenCalledTimes(1)
    expect(consumeClaimMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ jti: 'complete-jti-01', profileId: 42 }),
    )
  })

  it('rejects complete-activation on binding mismatch', async () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:other-user',
      profileId: 99,
      sessionAddress: EMBEDDED,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: EMBEDDED,
      serverOwnerAddress: SERVER,
      jti: 'complete-jti-mismatch',
    })
    const res = createMockRes()
    await completeActivationHandler(
      createMockReq({
        method: 'POST',
        body: { activationToken: token },
      }),
      res,
    )
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('activation_binding_mismatch')
    expect(consumeClaimMock).not.toHaveBeenCalled()
  })
})
