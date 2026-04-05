import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSessionToken } from '../../server/auth/_shared.ts'
import handler from '../_handlers/wallet/_sync.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, syncUserWalletsMock, getUserByIdMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  syncUserWalletsMock: vi.fn(async () => ({
    canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000aa', provider: 'coinbase_wallet' },
    embeddedEoa: { address: '0x00000000000000000000000000000000000000bb', chainType: 'evm', clientType: 'embedded' },
    connectedWallets: [{ address: '0x00000000000000000000000000000000000000aa', walletType: 'smart_wallet', provider: 'coinbase_wallet' }],
  })),
  getUserByIdMock: vi.fn(async () => ({ id: 'did:privy:test-user', linkedAccounts: [] })),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: vi.fn(() => true),
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    verifyAuthToken = vi.fn()
    getUserById = getUserByIdMock
  },
}))

vi.mock('../../server/_lib/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: vi.fn(async () => {}),
}))

describe('wallet sync endpoint', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      PRIVY_APP_ID: 'test-privy-id',
      PRIVY_APP_SECRET: 'test-privy-secret',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 401 without session', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  it('returns 409 when no privy mapping exists', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select p.id') && text.includes('lower(canonical.address)')) {
          return { rows: [{ id: 1 }] }
        }
        if (text.includes('canonical.address as canonical_wallet') && text.includes('where p.id =')) {
          return {
            rows: [
              {
                id: 1,
                primary_wallet: '0x00000000000000000000000000000000000000bb',
                primary_embedded_eoa: null,
                primary_smart_wallet: '0x00000000000000000000000000000000000000aa',
                csw_address: '0x00000000000000000000000000000000000000aa',
                base_sub_account: '0x00000000000000000000000000000000000000aa',
                canonical_wallet: '0x00000000000000000000000000000000000000aa',
              },
            ],
          }
        }
        if (text.includes('select privy_user_id') && text.includes('where id =')) {
          return { rows: [] }
        }
        return { rows: [] }
      }),
    })
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'POST',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(syncUserWalletsMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the session wallet is no longer a current authorized wallet', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select p.id') && text.includes('lower(canonical.address)')) {
          return { rows: [] }
        }
        return { rows: [{ privy_user_id: 'did:privy:test-user' }] }
      }),
    })
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'POST',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(syncUserWalletsMock).not.toHaveBeenCalled()
  })

  it('returns normalized sync payload', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select p.id') && text.includes('lower(canonical.address)')) {
          return { rows: [{ id: 1 }] }
        }
        if (text.includes('canonical.address as canonical_wallet') && text.includes('where p.id =')) {
          return {
            rows: [
              {
                id: 1,
                primary_wallet: '0x00000000000000000000000000000000000000bb',
                primary_embedded_eoa: null,
                primary_smart_wallet: '0x00000000000000000000000000000000000000aa',
                csw_address: '0x00000000000000000000000000000000000000aa',
                base_sub_account: '0x00000000000000000000000000000000000000aa',
                canonical_wallet: '0x00000000000000000000000000000000000000aa',
              },
            ],
          }
        }
        if (text.includes('select privy_user_id') && text.includes('where id =')) {
          return { rows: [{ privy_user_id: 'did:privy:test-user' }] }
        }
        return { rows: [] }
      }),
    })
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'POST',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000aa')
  })
})
