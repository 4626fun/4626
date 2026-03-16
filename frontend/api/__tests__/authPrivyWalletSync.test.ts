import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/auth/_privy.ts'
import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  upsertProfileByWalletMock,
  syncUserWalletsMock,
  verifyAuthTokenMock,
  getUserByIdMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  upsertProfileByWalletMock: vi.fn(async () => {}),
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

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/profileSync.js', () => ({
  upsertProfileByWallet: upsertProfileByWalletMock,
}))

vi.mock('../../server/_lib/walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
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
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      WALLET_SYNC_LEGACY_FALLBACK: 'true',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('uses syncUserWallets and keeps legacy upsert when fallback is enabled', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(upsertProfileByWalletMock).toHaveBeenCalledTimes(1)
    expect(readSetCookies(res).length).toBeGreaterThan(0)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('writes the active owner wallet separately from the canonical smart wallet in legacy fallback mode', async () => {
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
    expect(upsertProfileByWalletMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        primaryWallet: '0x00000000000000000000000000000000000000bb',
        embeddedWallet: '0x00000000000000000000000000000000000000bb',
        cswAddress: '0x00000000000000000000000000000000000000aa',
        baseSubAccount: '0x00000000000000000000000000000000000000aa',
      }),
    )
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

  it('keeps wallet sign-in successful when DB sync reports recovery required', async () => {
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

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('uses persisted canonical wallet when DB sync is throttled', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      WALLET_SYNC_LEGACY_FALLBACK: 'false',
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
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      WALLET_SYNC_LEGACY_FALLBACK: 'false',
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
    expect(res.body?.data?.address).toBe('0x00000000000000000000000000000000000000cc')
  })

  it('disables legacy fallback when WALLET_SYNC_LEGACY_FALLBACK=false', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      WALLET_SYNC_LEGACY_FALLBACK: 'false',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
    expect(upsertProfileByWalletMock).not.toHaveBeenCalled()
  })
})
