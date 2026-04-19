/**
 * Tests for POST /api/arch-b/enroll
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from '../helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // server-core
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: vi.fn(async () => ({})),
  getDb: vi.fn(),
  isDbConfigured: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  // auth
  resolveAuthorizedRequestPrincipal: vi.fn(),
  // commandIssuerContext
  provisionCommandIssuerContext: vi.fn(),
  envBigInt: vi.fn((key: string, fallback: bigint) => fallback),
  // privyWalletApi
  fetchPrivyWalletFull: vi.fn(),
  secp256k1SignHash: vi.fn(),
  // privyOwnerWalletIdResolver
  resolveOwnerWalletId: vi.fn(),
  // PrivyClient
  PrivyClientGetUserById: vi.fn(),
}))

vi.mock('../../../packages/server-core/src/index.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readBoundedJsonObjectBody: mocks.readBoundedJsonObjectBody,
  getDb: mocks.getDb,
  isDbConfigured: mocks.isDbConfigured,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  resolveAuthorizedRequestPrincipal: mocks.resolveAuthorizedRequestPrincipal,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
}))

vi.mock('../../../server/_lib/wallet/commandIssuerContext.js', () => ({
  provisionCommandIssuerContext: mocks.provisionCommandIssuerContext,
  envBigInt: mocks.envBigInt,
}))

vi.mock('../../../server/_lib/wallet/privyWalletApi.js', () => ({
  fetchPrivyWalletFull: mocks.fetchPrivyWalletFull,
  secp256k1SignHash: mocks.secp256k1SignHash,
}))

vi.mock('../../../server/_lib/wallet/privyOwnerWalletIdResolver.js', () => ({
  resolveOwnerWalletId: mocks.resolveOwnerWalletId,
}))

const PrivyClientMock = vi.fn()
vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: PrivyClientMock,
}))

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const PROFILE_ID = 42
const SMART_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OWNER_EOA = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const PRIVY_USER_ID = 'privy:user-abc'
const WALLET_ID = 'wallet-xyz'
const QUORUM_ID = 'lr8vgu2l0wnmwg824n4jrtr3'
const PRINCIPAL_ADDRESS = '0xcccccccccccccccccccccccccccccccccccccccc'

const AUTHORIZED_PRINCIPAL = {
  address: PRINCIPAL_ADDRESS,
  source: 'session' as const,
  authSource: 'session' as const,
  profileId: PROFILE_ID,
  canonicalSmartWalletAddress: SMART_WALLET,
  activeOwnerWalletAddress: OWNER_EOA,
  signerRole: 'active_owner_wallet' as const,
}

const MOCK_DB = {
  sql: vi.fn(async () => ({
    rows: [{ privy_user_id: PRIVY_USER_ID, primary_embedded_eoa: OWNER_EOA }],
  })),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq() {
  return createMockReq({ method: 'POST' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/arch-b/enroll', () => {
  let handler: (typeof import('../../_handlers/arch-b/_enroll.js'))['default']

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set env vars so getPrivyServerAuth() and getQuorumId() don't throw
    process.env.PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-app-secret'
    delete process.env.ARCH_B_SIGNER_QUORUM_ID
    delete process.env.VERCEL

    mocks.handleOptions.mockReturnValue(false)
    mocks.isDbConfigured.mockReturnValue(true)
    mocks.getDb.mockResolvedValue(MOCK_DB)
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(AUTHORIZED_PRINCIPAL)
    PrivyClientMock.mockImplementation(() => ({
      getUserById: mocks.PrivyClientGetUserById,
    }))
    mocks.PrivyClientGetUserById.mockResolvedValue({ id: PRIVY_USER_ID })
    mocks.resolveOwnerWalletId.mockReturnValue({
      status: 'ready',
      candidate: { id: WALLET_ID, address: OWNER_EOA.toLowerCase() },
    })
    mocks.fetchPrivyWalletFull.mockResolvedValue({
      id: WALLET_ID,
      address: OWNER_EOA,
      chain_type: 'ethereum',
      additional_signers: [{ signer_id: QUORUM_ID }],
      owner_id: null,
      policy_ids: [],
    })
    mocks.secp256k1SignHash.mockResolvedValue('0xdeadbeef')
    mocks.provisionCommandIssuerContext.mockResolvedValue({
      ok: true,
      context: {
        profileId: PROFILE_ID,
        smartWallet: SMART_WALLET,
        privyOwnerWalletId: WALLET_ID,
        ownerEoa: OWNER_EOA,
        ownerIndex: 0,
        paymasterPolicy: 'cdp_default',
        capsVersion: 1,
        perTxCapWei: 10_000_000_000_000_000n,
        dailyCapWei: 50_000_000_000_000_000n,
        provisionedAt: new Date('2025-01-01T00:00:00.000Z'),
        revokedAt: null,
      },
    })
    mocks.envBigInt.mockImplementation((_key: string, fallback: bigint) => fallback)

    handler = (await import('../../_handlers/arch-b/_enroll.ts')).default
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = makeReq()
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('Sign in required')
  })

  it('returns 400 profile_not_ready when canonicalSmartWalletAddress missing', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue({
      ...AUTHORIZED_PRINCIPAL,
      canonicalSmartWalletAddress: null,
    })
    const req = makeReq()
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('profile_not_ready')
  })

  it('returns 409 delegation_not_configured when quorum missing from additional_signers', async () => {
    mocks.fetchPrivyWalletFull.mockResolvedValue({
      id: WALLET_ID,
      address: OWNER_EOA,
      chain_type: 'ethereum',
      additional_signers: [],
      owner_id: null,
      policy_ids: [],
    })
    const req = makeReq()
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('delegation_not_configured')
    expect(res.body.data.actualSigners).toEqual([])
    expect(res.body.data.expectedQuorumId).toBe(QUORUM_ID)
  })

  it('returns 500 smoke_sign_failed when secp256k1SignHash throws', async () => {
    mocks.secp256k1SignHash.mockRejectedValue(new Error('privy_http_401: Unauthorized'))
    const req = makeReq()
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('smoke_sign_failed')
    expect(typeof res.body.data.message).toBe('string')
  })

  it('returns 200 on happy path', async () => {
    const req = makeReq()
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profileId).toBe(PROFILE_ID)
    expect(res.body.data.smartWallet).toBe(SMART_WALLET)
    expect(res.body.data.privyOwnerWalletId).toBe(WALLET_ID)
    expect(res.body.data.paymasterPolicy).toBe('cdp_default')
    expect(typeof res.body.data.provisionedAt).toBe('string')
  })

  it('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})
