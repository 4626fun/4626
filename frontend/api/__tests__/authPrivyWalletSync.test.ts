import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/auth/_privy.ts'
import { classifyLinkedAccounts as realClassifyLinkedAccounts } from '../../server/_lib/wallet/walletMapping.ts'
import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const {
  getDbMock,
  checkRateLimitMock,
  checkDurableRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  ensureWaitlistSchemaMock,
  syncUserWalletsMock,
  verifyAuthTokenMock,
  getUserByIdMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  checkDurableRateLimitMock: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  syncUserWalletsMock: vi.fn(async () => ({
    profileId: 1,
    canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
    activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
    embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
    connectedWallets: [],
    primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
  })),
  verifyAuthTokenMock: vi.fn(async () => ({ userId: 'did:privy:test-user' })),
  getUserByIdMock: vi.fn(async () => ({
    id: 'did:privy:test-user',
    linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
  })),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  COOKIE_SESSION: '__Host-4626_session',
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  setCookie: vi.fn((_req: any, res: any, name: string, value: string) => {
    const current = res.getHeader('set-cookie')
    const next = `${name}=${value}; Path=/; HttpOnly`
    if (!current) {
      res.setHeader('set-cookie', [next])
      return
    }
    if (Array.isArray(current)) {
      res.setHeader('set-cookie', [...current, next])
      return
    }
    res.setHeader('set-cookie', [String(current), next])
  }),
  makeSessionToken: vi.fn(() => 'test-session-token'),
  getDb: getDbMock,
  RATE_LIMITS: {
    authPrivy: { windowMs: 60_000, maxRequests: 20 },
  },
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkDurableRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  classifyLinkedAccounts: vi.fn((user: any) => realClassifyLinkedAccounts(user)),
  syncUserWallets: syncUserWalletsMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    verifyAuthToken = verifyAuthTokenMock
    getUserById = getUserByIdMock
  },
}))

describe('auth privy wallet sync', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 })
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('uses syncUserWallets for canonical wallet session sync', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(readSetCookies(res).length).toBeGreaterThan(0)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('prefers synced canonical wallet over raw Privy smart wallet for session address', async () => {
    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
      embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('returns recovery-required when DB sync reports identity recovery required', async () => {
    syncUserWalletsMock.mockRejectedValueOnce(
      Object.assign(new Error('collision'), {
        code: 'IDENTITY_RECOVERY_REQUIRED',
        reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      }),
    )

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Recovery required')
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_EMAIL_BOUND')
    expect(res.body?.recoveryRequired).toBe(true)
  })

  it('uses persisted canonical wallet when DB sync is throttled', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('where p.privy_user_id')) {
          return {
            rows: [
              {
                canonical_wallet: '0x00000000000000000000000000000000000000aa',
                primary_smart_wallet: null,
                csw_address: null,
                base_sub_account: null,
                primary_wallet: null,
                primary_embedded_eoa: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa' }],
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).not.toHaveBeenCalled()
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('bypasses sync throttling when persisted and Privy-derived session addresses disagree', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('where p.privy_user_id')) {
          return {
            rows: [
              {
                canonical_wallet: '0x00000000000000000000000000000000000000aa',
                primary_smart_wallet: null,
                csw_address: null,
                base_sub_account: null,
                primary_wallet: null,
                primary_embedded_eoa: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x0000000000000000000000000000000000000099' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000cc', provider: 'coinbase_wallet' },
      activeOwnerWallet: { address: '0x00000000000000000000000000000000000000bb', provider: 'privy', walletType: 'embedded_eoa' },
      embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000cc',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.address).toBe('0x0000000000000000000000000000000000000099')
  })

  it('does not mint a session for a stale synced canonical wallet absent from current Privy-linked wallets', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS: '9999999999999',
    })

    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('where p.privy_user_id')) {
          return {
            rows: [
              {
                canonical_wallet: '0x00000000000000000000000000000000000000aa',
                primary_smart_wallet: null,
                csw_address: null,
                base_sub_account: null,
                primary_wallet: null,
                primary_embedded_eoa: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

    getUserByIdMock.mockResolvedValueOnce({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'smart_wallet', address: '0x0000000000000000000000000000000000000099' }],
    })
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: null,
      embeddedEoa: null,
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.address).toBe('0x0000000000000000000000000000000000000099')
  })

  it('returns 503 when Privy server auth is not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: undefined,
      PRIVY_APP_SECRET: undefined,
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toContain('Privy server auth is not configured')
  })

  it('returns 401 when the Privy bearer token is missing', async () => {
    const req = createMockReq({
      method: 'POST',
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Missing Privy auth token')
  })

  it('returns 400 when no Privy wallet is ready yet', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [],
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: null,
      activeOwnerWallet: null,
      embeddedEoa: null,
      connectedWallets: [],
      primaryWalletAddress: null,
    } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('No Privy wallet is ready yet')
  })

  it('mints a session for base_account linked accounts when connector identity is on type', async () => {
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'base_account', address: '0x00000000000000000000000000000000000000aa' }],
    })
    syncUserWalletsMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
      activeOwnerWallet: null as any,
      embeddedEoa: null as any,
      connectedWallets: [],
      primaryWalletAddress: '0x00000000000000000000000000000000000000aa',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

})
