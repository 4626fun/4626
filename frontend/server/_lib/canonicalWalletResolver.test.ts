import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureCanonicalWalletsSchemaMock = vi.fn(async () => {})
const isDbConfiguredMock = vi.fn(() => true)
const getDbMock = vi.fn()
const readPersistedIdentityMock = vi.fn()

vi.mock('./canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: (...args: unknown[]) => ensureCanonicalWalletsSchemaMock(...args),
}))

vi.mock('./postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: () => getDbMock(),
}))

vi.mock('./walletSync.js', () => ({
  readPersistedIdentity: (...args: unknown[]) => readPersistedIdentityMock(...args),
}))

describe('canonicalWalletResolver.resolveAuthorizedWalletProfile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)
    isDbConfiguredMock.mockReturnValue(true)
    readPersistedIdentityMock.mockResolvedValue(null)
  })

  it('resolves authority when input address exists only in profile_wallets role rows', async () => {
    const sessionOwnerWallet = '0x8888888888888888888888888888888888888888'
    const canonicalSmartWallet = '0x3333333333333333333333333333333333333333'
    const profileId = 1

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ')
        if (text.includes('SELECT p.id') && text.includes('WHERE LOWER(p.primary_wallet)')) {
          return { rows: [{ id: profileId }] }
        }
        if (text.includes('FROM profiles p') && text.includes('WHERE p.id =')) {
          return {
            rows: [
              {
                id: profileId,
                primary_wallet: null,
                primary_embedded_eoa: null,
                primary_smart_wallet: canonicalSmartWallet,
                csw_address: null,
                base_sub_account: null,
                canonical_wallet: canonicalSmartWallet,
              },
            ],
          }
        }
        if (text.includes('FROM profile_wallets') && text.includes('is_primary = true')) {
          return { rows: [{ ok: 1 }] }
        }
        return { rows: [] }
      }),
    }
    getDbMock.mockResolvedValue(db)

    const { resolveAuthorizedWalletProfile } = await import('./canonicalWalletResolver.ts')
    const authority = await resolveAuthorizedWalletProfile(sessionOwnerWallet)

    expect(authority).toEqual({
      profileId,
      canonicalSmartWalletAddress: canonicalSmartWallet,
      activeOwnerWalletAddress: null,
    })
  })
})
