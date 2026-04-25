/**
 * Tests for the Architecture B Phase 5 sub-account provisioning endpoints:
 *  - POST /api/arch-b/sub-account/provision/prepare
 *  - POST /api/arch-b/sub-account/provision/commit
 *  - POST /api/admin/arch-b/sub-account/provision
 *
 * All RPC + Privy + DB calls are mocked. Shared verifier is mocked at the
 * module boundary so endpoint handlers are exercised in isolation.
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
  readBoundedJsonObjectBody: vi.fn(async () => ({})),
  getDb: vi.fn(),
  isDbConfigured: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  resolveAuthorizedRequestPrincipal: vi.fn(),
  // M-06 (audit 2026-04-25): the handler now imports the centralized admin
  // bearer gate from server-core. We simulate the real helper here: read
  // ADMIN_API_TOKEN from env, compare to the Bearer header, and write a
  // 500/401 to `res` on failure. This keeps the existing auth-coverage
  // assertions ('admin_token_missing', 'admin_token_invalid', etc.)
  // passing without per-test boilerplate.
  requireAdminApiToken: vi.fn((req: any, res: any) => {
    const expected = String(process.env.ADMIN_API_TOKEN ?? '').trim()
    if (!expected) {
      res.status(500).json({ success: false, error: 'admin_token_missing' })
      return false
    }
    const raw = String(req?.headers?.authorization ?? '').trim()
    const m = /^Bearer\s+(.+)$/i.exec(raw)
    const token = m ? m[1].trim() : ''
    if (!token || token !== expected) {
      res.status(401).json({ success: false, error: 'admin_token_invalid' })
      return false
    }
    return true
  }),

  provisionCommandIssuerContext: vi.fn(),

  computeSubAccountAddress: vi.fn(),

  verifySubAccountProvision: vi.fn(),
  checkPrivyDelegation: vi.fn(),
  getBasePublicClient: vi.fn(() => ({})),

  resolveOwnerWalletId: vi.fn(),
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
  requireAdminApiToken: mocks.requireAdminApiToken,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
  // arch-b handlers now import `logger` from server-core (per the
  // server-core-boundary guard). Stub it as no-ops so tests don't crash
  // on `logger.warn(...)` paths.
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../server/_lib/wallet/commandIssuerContext.js', () => ({
  provisionCommandIssuerContext: mocks.provisionCommandIssuerContext,
}))

vi.mock('../../../server/_lib/wallet/subAccountAddress.js', () => ({
  computeSubAccountAddress: mocks.computeSubAccountAddress,
  computeSubAccountSalt: vi.fn(() => '0x' + '11'.repeat(32)),
  CSW_FACTORY_BASE: '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a',
}))

vi.mock('../../../server/_lib/wallet/subAccountProvisionVerify.js', () => ({
  CHAIN_ID_BASE: 8453,
  MAX_PER_TX_CAP_WEI: 1_000_000_000_000_000_000n,
  MAX_DAILY_CAP_WEI: 10_000_000_000_000_000_000n,
  verifySubAccountProvision: mocks.verifySubAccountProvision,
  checkPrivyDelegation: mocks.checkPrivyDelegation,
  getBasePublicClient: mocks.getBasePublicClient,
}))

vi.mock('../../../server/_lib/wallet/privyOwnerWalletIdResolver.js', () => ({
  resolveOwnerWalletId: mocks.resolveOwnerWalletId,
}))

vi.mock('../../../server/_lib/wallet/spendPermission.js', () => ({
  NATIVE_TOKEN_SENTINEL: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  SPEND_PERMISSION_EIP712_DOMAIN: (chainId: number) => ({
    name: 'Spend Permission Manager',
    version: '1',
    chainId,
    verifyingContract: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad',
  }),
  SPEND_PERMISSION_TYPES: { SpendPermission: [{ name: 'account', type: 'address' }] },
  hashSpendPermission: vi.fn(() => '0x' + 'aa'.repeat(32)),
}))

const PrivyClientMock = vi.fn()
vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: PrivyClientMock,
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = 42
const PARENT_CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OWNER_EOA = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const SUB_ACCOUNT = '0xcccccccccccccccccccccccccccccccccccccccc'
const PRINCIPAL_ADDRESS = '0xdddddddddddddddddddddddddddddddddddddddd'
const PRIVY_USER_ID = 'privy:user-123'
const WALLET_ID = 'wallet-xyz'
const QUORUM_ID = 'lr8vgu2l0wnmwg824n4jrtr3'

const AUTHORIZED_PRINCIPAL = {
  address: PRINCIPAL_ADDRESS,
  source: 'session' as const,
  authSource: 'session' as const,
  profileId: PROFILE_ID,
  canonicalSmartWalletAddress: PARENT_CSW,
  activeOwnerWalletAddress: OWNER_EOA,
  signerRole: 'active_owner_wallet' as const,
}

const MOCK_DB = {
  sql: vi.fn(async () => ({
    rows: [
      {
        privy_user_id: PRIVY_USER_ID,
        primary_embedded_eoa: OWNER_EOA,
        primary_smart_wallet: PARENT_CSW,
      },
    ],
  })),
}

const VALID_PERMISSION = {
  account: PARENT_CSW,
  spender: SUB_ACCOUNT,
  token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  allowance: '500000000000000000',
  period: 86_400,
  start: 1_700_000_000,
  end: 2_000_000_000,
  salt: '0x' + 'bb'.repeat(32),
  extraData: '0x',
}

const VALID_SIGNATURE = '0x' + 'cc'.repeat(65)

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function resetMocks() {
  vi.clearAllMocks()
  process.env.PRIVY_APP_ID = 'test-app-id'
  process.env.PRIVY_APP_SECRET = 'test-app-secret'
  process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
  delete process.env.ARCH_B_SIGNER_QUORUM_ID
  delete process.env.VERCEL

  mocks.handleOptions.mockReturnValue(false)
  mocks.isDbConfigured.mockReturnValue(true)
  mocks.getDb.mockResolvedValue(MOCK_DB)
  mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })
  mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(AUTHORIZED_PRINCIPAL)
  mocks.computeSubAccountAddress.mockResolvedValue(SUB_ACCOUNT)
  mocks.verifySubAccountProvision.mockResolvedValue({
    ok: true,
    subAccountAddress: SUB_ACCOUNT,
    permissionHash: '0x' + 'aa'.repeat(32),
  })
  mocks.checkPrivyDelegation.mockResolvedValue({ present: true })
  PrivyClientMock.mockImplementation(() => ({
    getUserById: mocks.PrivyClientGetUserById,
  }))
  mocks.PrivyClientGetUserById.mockResolvedValue({ id: PRIVY_USER_ID })
  mocks.resolveOwnerWalletId.mockReturnValue({
    status: 'ready',
    candidate: { id: WALLET_ID, address: OWNER_EOA },
  })
  mocks.provisionCommandIssuerContext.mockResolvedValue({
    ok: true,
    context: {
      profileId: PROFILE_ID,
      smartWallet: SUB_ACCOUNT,
      privyOwnerWalletId: WALLET_ID,
      ownerEoa: OWNER_EOA,
      ownerIndex: 1,
      paymasterPolicy: 'cdp_default',
      capsVersion: 1,
      perTxCapWei: 100_000_000_000_000_000n,
      dailyCapWei: 500_000_000_000_000_000n,
      provisionedAt: new Date('2026-04-19T00:00:00.000Z'),
      revokedAt: null,
    },
  })
}

// ---------------------------------------------------------------------------
// Prepare endpoint
// ---------------------------------------------------------------------------

describe('POST /api/arch-b/sub-account/provision/prepare', () => {
  let handler: (typeof import('../../_handlers/arch-b/_subAccountProvisionPrepare.js'))['default']

  beforeEach(async () => {
    resetMocks()
    mocks.readBoundedJsonObjectBody.mockResolvedValue({})
    handler = (await import('../../_handlers/arch-b/_subAccountProvisionPrepare.ts')).default
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns 409 when profile lacks canonical smart wallet', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue({
      ...AUTHORIZED_PRINCIPAL,
      canonicalSmartWalletAddress: null,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('profile_not_ready')
  })

  it('returns 200 with subAccountAddress and permission on happy path', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.subAccountAddress).toBe(SUB_ACCOUNT)
    expect(res.body.data.parentCswAddress).toBe(PARENT_CSW)
    expect(res.body.data.ownerEoaAddress).toBe(OWNER_EOA)
    expect(res.body.data.privyOwnerWalletId).toBe(WALLET_ID)
    expect(res.body.data.permission.account).toBe(PARENT_CSW)
    expect(res.body.data.permission.spender).toBe(SUB_ACCOUNT)
    expect(res.body.data.eip712.primaryType).toBe('SpendPermission')
    expect(res.body.data.perTxCapWei).toBe('100000000000000000')
    expect(res.body.data.dailyCapWei).toBe('500000000000000000')
  })

  it('clamps caps above the server ceiling down to max', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      caps: {
        perTxCapWei: '9999999999999999999999', // way above 1 ETH
        dailyCapWei: '9999999999999999999999', // way above 10 ETH
      },
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.perTxCapWei).toBe('1000000000000000000') // 1 ETH
    expect(res.body.data.dailyCapWei).toBe('10000000000000000000') // 10 ETH
  })

  it('returns 400 when per-tx cap exceeds daily cap', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      caps: { perTxCapWei: '200000000000000000', dailyCapWei: '100000000000000000' },
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_caps')
  })

  it('returns 503 when db not configured', async () => {
    mocks.isDbConfigured.mockReturnValue(false)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('db_unavailable')
  })

  it('returns 409 when Privy wallet resolution fails', async () => {
    mocks.resolveOwnerWalletId.mockReturnValue({ status: 'missing_privy_wallet' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
  })

  it('returns 405 for non-POST', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})

// ---------------------------------------------------------------------------
// Commit endpoint
// ---------------------------------------------------------------------------

describe('POST /api/arch-b/sub-account/provision/commit', () => {
  let handler: (typeof import('../../_handlers/arch-b/_subAccountProvisionCommit.js'))['default']

  beforeEach(async () => {
    resetMocks()
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      permission: VALID_PERMISSION,
      signature: VALID_SIGNATURE,
      perTxCapWei: '100000000000000000',
      dailyCapWei: '500000000000000000',
    })
    handler = (await import('../../_handlers/arch-b/_subAccountProvisionCommit.ts')).default
  })

  it('returns 200 on valid signature happy path', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profileId).toBe(PROFILE_ID)
    expect(res.body.data.subAccountAddress).toBe(SUB_ACCOUNT)
    expect(res.body.data.parentCswAddress).toBe(PARENT_CSW)
    expect(res.body.data.status).toBe('ready')
    expect(mocks.provisionCommandIssuerContext).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 on invalid signature', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_signature' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('invalid_signature')
  })

  it('returns 403 when signer is not CSW owner', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'signer_not_owner' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('signer_not_owner')
  })

  it('returns 400 on hash mismatch', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_hash' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_hash')
  })

  it('returns 400 on caps out of bounds', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_caps' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_caps')
  })

  it('returns 400 when body is missing required fields', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({})
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_body')
  })

  it('returns 412 when Privy delegation is missing', async () => {
    mocks.checkPrivyDelegation.mockResolvedValue({ present: false, actualSigners: ['other'] })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(412)
    expect(res.body.error).toBe('privy_delegation_missing')
    expect(res.body.data.actualSigners).toEqual(['other'])
  })

  it('returns 503 when db is unavailable', async () => {
    mocks.isDbConfigured.mockReturnValue(false)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('db_unavailable')
  })

  it('returns 503 when provision write reports db_unavailable', async () => {
    mocks.provisionCommandIssuerContext.mockResolvedValue({ ok: false, error: 'db_unavailable' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
  })

  it('returns 400 invalid_token when permission.token is not the native-ETH sentinel', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_token' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_token')
  })

  it('returns 400 permission_not_yet_active when permission.start is in the future', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'permission_not_yet_active' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('permission_not_yet_active')
  })

  it('returns 400 invalid_window when permission.start >= permission.end', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_window' })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_window')
  })
})

// ---------------------------------------------------------------------------
// Admin endpoint (bearer auth)
// ---------------------------------------------------------------------------

describe('POST /api/admin/arch-b/sub-account/provision', () => {
  let handler: (typeof import('../../_handlers/admin/arch-b/_subAccountProvision.js'))['default']

  beforeEach(async () => {
    resetMocks()
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      profileId: PROFILE_ID,
      parentCswAddress: PARENT_CSW,
      ownerEoaAddress: OWNER_EOA,
      permission: VALID_PERMISSION,
      signature: VALID_SIGNATURE,
      perTxCapWei: '100000000000000000',
      dailyCapWei: '500000000000000000',
      privyOwnerWalletId: WALLET_ID,
    })
    handler = (await import('../../_handlers/admin/arch-b/_subAccountProvision.ts')).default
  })

  it('returns 200 when bearer token matches', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profileId).toBe(PROFILE_ID)
    expect(res.body.data.subAccountAddress).toBe(SUB_ACCOUNT)
    expect(res.body.data.privyDelegationPresent).toBe(true)
    expect(mocks.provisionCommandIssuerContext).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('admin_token_invalid')
  })

  it('returns 401 when bearer token does not match', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('admin_token_invalid')
  })

  it('returns 500 admin_token_missing when ADMIN_API_TOKEN env var is unset', async () => {
    // M-06 (audit 2026-04-25): the centralized server-core gate returns
    // 500 for an unset secret (the server itself is misconfigured), not
    // 401. The previous inline handler returned 401 — that was a less
    // correct status. Tests updated to assert the new behavior.
    delete process.env.ADMIN_API_TOKEN
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('admin_token_missing')
  })

  it('continues with warning when Privy delegation is missing (admin override)', async () => {
    mocks.checkPrivyDelegation.mockResolvedValue({ present: false, actualSigners: [] })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.privyDelegationPresent).toBe(false)
    expect(mocks.provisionCommandIssuerContext).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when body is invalid', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({ profileId: PROFILE_ID })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_body')
  })

  it('returns 403 when verify reports signer_not_owner', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'signer_not_owner' })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('signer_not_owner')
  })

  it('returns 405 for non-POST', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 invalid_token when verify rejects non-native token', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_token' })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_token')
  })

  it('returns 400 permission_not_yet_active when verify rejects future-start permission', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'permission_not_yet_active' })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('permission_not_yet_active')
  })

  it('returns 400 invalid_window when verify rejects start >= end', async () => {
    mocks.verifySubAccountProvision.mockResolvedValue({ ok: false, code: 'invalid_window' })
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer super-secret-admin-token' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_window')
  })
})
