import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureCanonicalWalletsSchemaMock = vi.fn(async () => {})
const isDbConfiguredMock = vi.fn(() => true)
const getDbMock = vi.fn()
const readPersistedIdentityMock = vi.fn()

vi.mock('./canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: ensureCanonicalWalletsSchemaMock,
}))

vi.mock('../db/postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: () => getDbMock(),
}))

vi.mock('./walletSync.js', () => ({
  readPersistedIdentity: readPersistedIdentityMock,
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

describe('canonicalWalletResolver identity disambiguation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)
    isDbConfiguredMock.mockReturnValue(true)
  })

  it('resolves persisted identity when duplicate profiles exist but only one has canonical+embedded match', async () => {
    const sender = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    const canonical = sender
    const embedded = '0xb2aad65a5402714bf428a66731ae62ba5c45cac0'
    const profileIdPreferred = 710
    const profileIdLegacy = 686

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.join(' ')
        if (text.includes('SELECT id, privy_user_id') && text.includes('LIMIT 10')) {
          return {
            rows: [
              { id: profileIdPreferred, privy_user_id: 'did:privy:test' },
              { id: profileIdLegacy, privy_user_id: null },
            ],
          }
        }
        if (text.includes('FROM profile_wallets') && text.includes('is_canonical_smart_wallet = true')) {
          const profileId = Number(values[0] ?? 0)
          if (profileId === profileIdPreferred) return { rows: [{ address: canonical }] }
          return { rows: [] }
        }
        if (text.includes('FROM profiles') && text.includes('WHERE id =')) {
          const profileId = Number(values[0] ?? 0)
          if (profileId === profileIdPreferred) {
            return {
              rows: [
                {
                  primary_wallet: sender,
                  primary_smart_wallet: canonical,
                  csw_address: canonical,
                  base_sub_account: canonical,
                  canonical_solana_wallet: null,
                  operational_solana_wallet: null,
                  solana_wallet: null,
                  primary_embedded_eoa: embedded,
                  embedded_wallet: embedded,
                  preprov_zora_handle: null,
                },
              ],
            }
          }
          return {
            rows: [
              {
                primary_wallet: sender,
                primary_smart_wallet: null,
                csw_address: canonical,
                base_sub_account: null,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                solana_wallet: null,
                primary_embedded_eoa: null,
                embedded_wallet: null,
                preprov_zora_handle: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    }
    readPersistedIdentityMock.mockImplementation(async (_db: unknown, profileId: number) => {
      if (profileId === profileIdPreferred) {
        return {
          primaryWallet: sender,
          activeOwnerWallet: embedded,
          canonicalSmartWallet: canonical,
          canonicalSolanaWallet: null,
          operationalSolanaWallet: null,
          embeddedEoa: embedded,
          preprovZoraHandle: null,
        }
      }
      return {
        primaryWallet: sender,
        activeOwnerWallet: null,
        canonicalSmartWallet: canonical,
        canonicalSolanaWallet: null,
        operationalSolanaWallet: null,
        embeddedEoa: null,
        preprovZoraHandle: null,
      }
    })
    getDbMock.mockResolvedValue(db)

    const { resolvePersistedWalletIdentity } = await import('./canonicalWalletResolver.ts')
    const identity = await resolvePersistedWalletIdentity(sender)

    expect(identity).toEqual({
      profileId: profileIdPreferred,
      canonicalSmartWallet: canonical,
      embeddedEoa: embedded,
      privyUserId: 'did:privy:test',
    })
  })

  it('resolves identity directly by profile id for paymaster authority fallback', async () => {
    const canonical = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    const embedded = '0xb2aad65a5402714bf428a66731ae62ba5c45cac0'
    const profileId = 710

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.join(' ')
        if (text.includes('SELECT id, privy_user_id') && text.includes('WHERE id =')) {
          return { rows: [{ id: profileId, privy_user_id: 'did:privy:test' }] }
        }
        if (text.includes('FROM profile_wallets') && text.includes('is_canonical_smart_wallet = true')) {
          return { rows: [{ address: canonical }] }
        }
        if (text.includes('FROM profiles') && text.includes('WHERE id =')) {
          const requestedProfileId = Number(values[0] ?? 0)
          if (requestedProfileId !== profileId) return { rows: [] }
          return {
            rows: [
              {
                primary_wallet: canonical,
                primary_smart_wallet: canonical,
                csw_address: canonical,
                base_sub_account: canonical,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                solana_wallet: null,
                primary_embedded_eoa: embedded,
                embedded_wallet: embedded,
                preprov_zora_handle: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    }
    readPersistedIdentityMock.mockResolvedValue({
      primaryWallet: canonical,
      activeOwnerWallet: embedded,
      canonicalSmartWallet: canonical,
      canonicalSolanaWallet: null,
      operationalSolanaWallet: null,
      embeddedEoa: embedded,
      preprovZoraHandle: null,
    })
    getDbMock.mockResolvedValue(db)

    const { resolvePersistedWalletIdentityForProfileId } = await import('./canonicalWalletResolver.ts')
    const identity = await resolvePersistedWalletIdentityForProfileId(profileId)

    expect(identity).toEqual({
      profileId,
      canonicalSmartWallet: canonical,
      embeddedEoa: embedded,
      privyUserId: 'did:privy:test',
    })
  })
})
