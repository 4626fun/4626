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
