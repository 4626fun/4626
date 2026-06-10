/**
 * Tests for GET /api/arch-b/status
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from '../helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  getDb: vi.fn(),
  isDbConfigured: vi.fn(() => true),
  resolveAuthorizedRequestPrincipal: vi.fn(),
  resolveCommandIssuerContextByProfileId: vi.fn(),
  fetchPrivyWalletFull: vi.fn(),
  resolveOwnerWalletId: vi.fn(),
  PrivyClientGetUserById: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  getDb: mocks.getDb,
  isDbConfigured: mocks.isDbConfigured,
  resolveAuthorizedRequestPrincipal: mocks.resolveAuthorizedRequestPrincipal,
  resolveCommandIssuerContextByProfileId: mocks.resolveCommandIssuerContextByProfileId,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
}))

vi.mock('../../../server/_lib/wallet/privyWalletApi.js', () => ({
  fetchPrivyWalletFull: mocks.fetchPrivyWalletFull,
}))

vi.mock('../../../server/_lib/wallet/privyOwnerWalletIdResolver.js', () => ({
  resolveOwnerWalletId: mocks.resolveOwnerWalletId,
}))

const PrivyClientMock = vi.fn()
vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: PrivyClientMock,
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = 13
const SMART_WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const OWNER_EOA = '0xffffffffffffffffffffffffffffffffffffffff'
const WALLET_ID = 'wallet-status-test'
const QUORUM_ID = 'lr8vgu2l0wnmwg824n4jrtr3'

const AUTHORIZED_PRINCIPAL = {
  address: '0x1111111111111111111111111111111111111111',
  source: 'session' as const,
  authSource: 'session' as const,
  profileId: PROFILE_ID,
  canonicalSmartWalletAddress: SMART_WALLET,
  activeOwnerWalletAddress: OWNER_EOA,
  signerRole: 'active_owner_wallet' as const,
}

const PROVISIONED_CONTEXT = {
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
  subAccount: null,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/arch-b/status', () => {
  let handler: (typeof import('../../_handlers/arch-b/_status.js'))['default']

  beforeEach(async () => {
    vi.clearAllMocks()

    process.env.PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-app-secret'
    delete process.env.ARCH_B_SIGNER_QUORUM_ID
    delete process.env.VERCEL

    mocks.handleOptions.mockReturnValue(false)
    mocks.isDbConfigured.mockReturnValue(true)
    mocks.getDb.mockResolvedValue({
      sql: vi.fn(async () => ({
        rows: [{ privy_user_id: 'privy:u1', primary_embedded_eoa: OWNER_EOA }],
      })),
    })
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(AUTHORIZED_PRINCIPAL)
    // Vitest 4: mocks need a `function` (not arrow) implementation to support `new`.
    PrivyClientMock.mockImplementation(function () {
      return { getUserById: mocks.PrivyClientGetUserById }
    })
    mocks.PrivyClientGetUserById.mockResolvedValue({ id: 'privy:u1' })
    mocks.resolveCommandIssuerContextByProfileId.mockResolvedValue({
      status: 'ready',
      context: PROVISIONED_CONTEXT,
    })
    mocks.fetchPrivyWalletFull.mockResolvedValue({
      id: WALLET_ID,
      address: OWNER_EOA,
      chain_type: 'ethereum',
      additional_signers: [{ signer_id: QUORUM_ID }],
      owner_id: null,
      policy_ids: [],
    })

    handler = (await import('../../_handlers/arch-b/_status.ts')).default
  })

  it('returns 200 { data: null } when unauthenticated', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeNull()
  })

  it('returns executionReady=ready and delegated=true when provisioned and quorum present', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.executionReady).toBe('ready')
    expect(res.body.data.delegated).toBe(true)
    expect(res.body.data.caps).not.toBeNull()
    expect(res.body.data.quorumId).toBe(QUORUM_ID)
  })

  it('returns delegated=false when quorum not in additional_signers', async () => {
    mocks.fetchPrivyWalletFull.mockResolvedValue({
      id: WALLET_ID,
      address: OWNER_EOA,
      chain_type: 'ethereum',
      additional_signers: [],
      owner_id: null,
      policy_ids: [],
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.delegated).toBe(false)
    expect(res.body.data.executionReady).toBe('ready')
  })

  it('returns executionReady=not_provisioned and delegated derived from privy when no context row', async () => {
    mocks.resolveCommandIssuerContextByProfileId.mockResolvedValue({
      status: 'not_provisioned',
      profileId: PROFILE_ID,
    })
    mocks.PrivyClientGetUserById.mockResolvedValue({ id: 'privy:u1' })
    mocks.resolveOwnerWalletId.mockReturnValue({
      status: 'ready',
      candidate: { id: WALLET_ID, address: OWNER_EOA.toLowerCase() },
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.executionReady).toBe('not_provisioned')
    expect(res.body.data.caps).toBeNull()
    // delegated reflects Privy API result (true because quorum is present)
    expect(res.body.data.delegated).toBe(true)
  })

  it('returns 405 for non-GET methods', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 503 db_unavailable when the context resolver reports db_unavailable', async () => {
    mocks.resolveCommandIssuerContextByProfileId.mockResolvedValue({
      status: 'db_unavailable',
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('db_unavailable')
  })

  it('does not throw when quorum env is missing in production; returns quorumConfigured=false', async () => {
    process.env.VERCEL = '1'
    delete process.env.ARCH_B_SIGNER_QUORUM_ID
    mocks.resolveCommandIssuerContextByProfileId.mockResolvedValue({
      status: 'ready',
      context: PROVISIONED_CONTEXT,
    })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.quorumConfigured).toBe(false)
    expect(res.body.data.quorumId).toBe('')
    expect(res.body.data.delegated).toBeNull()
  })
})
