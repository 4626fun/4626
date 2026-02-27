import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { classifyLinkedAccounts } from '../../server/_lib/walletMapping.ts'
import { syncUserWallets } from '../../server/_lib/walletSync.ts'

const { fetchZoraProfileMock } = vi.hoisted(() => ({
  fetchZoraProfileMock: vi.fn(),
}))

vi.mock('../../server/_lib/zoraProfile.js', () => ({
  fetchZoraProfile: fetchZoraProfileMock,
}))

function createLooseDb() {
  const calls: string[] = []
  return {
    calls,
    sql: async (strings: TemplateStringsArray, ..._values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      calls.push(text)

      if (text.includes('insert into profiles') && text.includes('returning id')) {
        return { rows: [{ id: 101 }] }
      }
      if (text.includes('select id from profiles where email')) {
        return { rows: [{ id: 101 }] }
      }
      if (text.includes('select privy_user_id from profiles')) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
}

describe('wallet mapping + sync', () => {
  let originalZoraKey: string | undefined

  beforeEach(() => {
    fetchZoraProfileMock.mockReset()
    originalZoraKey = process.env.ZORA_SERVER_API_KEY
    process.env.ZORA_SERVER_API_KEY = 'test-zora-key'
  })

  afterEach(() => {
    if (originalZoraKey === undefined) {
      delete process.env.ZORA_SERVER_API_KEY
    } else {
      process.env.ZORA_SERVER_API_KEY = originalZoraKey
    }
  })

  it('prefers explicit smart_wallet type for canonical address', () => {
    const user = {
      id: 'did:privy:1',
      linkedAccounts: [
        { type: 'wallet', address: '0x0000000000000000000000000000000000000011', walletClientType: 'metamask' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000aa', walletClientType: 'coinbase_smart_wallet' },
        { type: 'wallet', address: '0x00000000000000000000000000000000000000bb', walletClientType: 'base_account' },
      ],
    }

    const classified = classifyLinkedAccounts(user as any)
    expect(classified.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000aa')
    expect(classified.primaryWalletAddress).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('falls back to base_account when smart_wallet type is absent', () => {
    const user = {
      id: 'did:privy:2',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000c1', walletClientType: 'embedded_privy_wallet' },
        { type: 'wallet', address: '0x00000000000000000000000000000000000000c2', walletClientType: 'base_account' },
      ],
    }
    const classified = classifyLinkedAccounts(user as any)
    expect(classified.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000c2')
    expect(classified.embeddedEoa?.address).toBe('0x00000000000000000000000000000000000000c1')
  })

  it('detects Rabby as provider for external EOAs', () => {
    const user = {
      id: 'did:privy:rabby',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000b1', walletClientType: 'rabby' },
      ],
    }
    const classified = classifyLinkedAccounts(user as any)
    expect(classified.allWallets[0]?.provider).toBe('rabby')
  })

  it('does not treat Privy-linked smart wallets as canonical', () => {
    const user = {
      id: 'did:privy:2b',
      linkedAccounts: [
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000e1', walletClientType: 'embedded_privy_wallet' },
        { type: 'wallet', address: '0x00000000000000000000000000000000000000e2', walletClientType: 'embedded_privy_wallet' },
      ],
    }
    const classified = classifyLinkedAccounts(user as any)
    expect(classified.canonicalSmartWallet).toBeNull()
    expect(classified.primaryWalletAddress).toBe('0x00000000000000000000000000000000000000e2')
  })

  it('syncUserWallets writes profile + wallet graph rows', async () => {
    const db = createLooseDb()
    const user = {
      id: 'did:privy:3',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000d1', walletClientType: 'embedded_privy_wallet' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000d2', walletClientType: 'coinbase_smart_wallet' },
      ],
    }

    const result = await syncUserWallets(db as any, user as any)

    expect(result.profileId).toBe(101)
    expect(result.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000d2')
    expect(result.embeddedEoa?.address).toBe('0x00000000000000000000000000000000000000d1')
    expect(result.connectedWallets.length).toBe(2)
    expect(db.calls.some((q) => q.includes('insert into wallets'))).toBe(true)
    expect(db.calls.some((q) => q.includes('insert into profile_wallets'))).toBe(true)
  })

  it('prefers Zora-linked smart wallet when multiple candidates exist', async () => {
    fetchZoraProfileMock.mockResolvedValue({
      publicWallet: { walletAddress: '0x00000000000000000000000000000000000000f0' },
      linkedWallets: {
        edges: [
          { node: { walletAddress: '0x00000000000000000000000000000000000000f2' } },
        ],
      },
    })

    const db = createLooseDb()
    const user = {
      id: 'did:privy:zora',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000f0', walletClientType: 'metamask' },
        // Privy heuristic will pick the first smart_wallet; Zora should pick the second.
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f1', walletClientType: 'coinbase_smart_wallet' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f2', walletClientType: 'coinbase_smart_wallet' },
      ],
    }

    const result = await syncUserWallets(db as any, user as any)

    expect(result.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000f2')
  })

  it('keeps persisted canonical smart wallet even if Privy omits it', async () => {
    fetchZoraProfileMock.mockResolvedValue({
      linkedWallets: {
        edges: [
          // Zora reports the canonical CSW, but Privy does not include it in linkedAccounts.
          { node: { walletAddress: '0x00000000000000000000000000000000000000f2' } },
        ],
      },
    })

    const calls: string[] = []
    const db = {
      calls,
      sql: vi.fn(async (strings: TemplateStringsArray, ..._values: any[]) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        calls.push(text)

        if (text.includes('from profiles') && text.includes('where privy_user_id')) {
          return { rows: [{ id: 101, email: null }] }
        }
        if (text.includes('select') && text.includes('from profiles') && text.includes('where id') && text.includes('primary_smart_wallet')) {
          return {
            rows: [
              {
                primary_wallet: null,
                primary_smart_wallet: '0x00000000000000000000000000000000000000f2',
                csw_address: null,
                base_sub_account: null,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                solana_wallet: null,
                primary_embedded_eoa: null,
                embedded_wallet: null,
              },
            ],
          }
        }

        return { rows: [] }
      }),
    }

    const user = {
      id: 'did:privy:persisted',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000f0', walletClientType: 'metamask' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f1', walletClientType: 'coinbase_smart_wallet' },
        // Another smart wallet is present, but the persisted canonical is missing from Privy payload.
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f3', walletClientType: 'coinbase_smart_wallet' },
      ],
    }

    const result = await syncUserWallets(db as any, user as any)

    expect(result.profileId).toBe(101)
    expect(result.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000f2')
  })

  it('prefers canonical from profile_wallets over legacy profile columns', async () => {
    const calls: string[] = []
    const db = {
      calls,
      sql: vi.fn(async (strings: TemplateStringsArray, ..._values: any[]) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        calls.push(text)

        if (text.includes('from profiles') && text.includes('where privy_user_id')) {
          return { rows: [{ id: 101, email: null }] }
        }
        if (text.includes('select') && text.includes('from profiles') && text.includes('where id') && text.includes('primary_smart_wallet')) {
          return {
            rows: [
              {
                primary_wallet: null,
                // Legacy column has the *wrong* CSW…
                primary_smart_wallet: '0x00000000000000000000000000000000000000f1',
                csw_address: null,
                base_sub_account: null,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                solana_wallet: null,
                primary_embedded_eoa: null,
                embedded_wallet: null,
              },
            ],
          }
        }
        if (text.includes('from profile_wallets') && text.includes('is_canonical_smart_wallet')) {
          return { rows: [{ address: '0x00000000000000000000000000000000000000f2' }] }
        }

        return { rows: [] }
      }),
    }

    const user = {
      id: 'did:privy:profile-wallets-win',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000f0', walletClientType: 'metamask' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f1', walletClientType: 'coinbase_smart_wallet' },
      ],
    }

    const result = await syncUserWallets(db as any, user as any)

    expect(result.profileId).toBe(101)
    expect(result.canonicalSmartWallet?.address).toBe('0x00000000000000000000000000000000000000f2')
  })

  it('seeds Zora lookup from preprov_zora_handle when available', async () => {
    fetchZoraProfileMock.mockResolvedValue({
      linkedWallets: { edges: [] },
    })

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ..._values: any[]) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles') && text.includes('where privy_user_id')) {
          return { rows: [{ id: 101, email: null }] }
        }
        if (text.includes('from profile_wallets') && text.includes('is_canonical_smart_wallet')) {
          return { rows: [] }
        }
        if (text.includes('select') && text.includes('from profiles') && text.includes('where id') && text.includes('primary_smart_wallet')) {
          return {
            rows: [
              {
                primary_wallet: '0x00000000000000000000000000000000000000f0',
                primary_smart_wallet: null,
                csw_address: null,
                base_sub_account: null,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                solana_wallet: null,
                primary_embedded_eoa: null,
                embedded_wallet: null,
                preprov_zora_handle: '@alice',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    }

    const user = {
      id: 'did:privy:seed-handle',
      linkedAccounts: [
        { type: 'wallet', address: '0x00000000000000000000000000000000000000f0', walletClientType: 'metamask' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f1', walletClientType: 'coinbase_smart_wallet' },
        { type: 'smart_wallet', address: '0x00000000000000000000000000000000000000f2', walletClientType: 'coinbase_smart_wallet' },
      ],
    }

    await syncUserWallets(db as any, user as any)

    expect(fetchZoraProfileMock).toHaveBeenCalled()
    expect(fetchZoraProfileMock.mock.calls[0]?.[0]).toBe('alice')
  })
})
