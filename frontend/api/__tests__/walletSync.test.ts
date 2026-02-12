import { describe, expect, it } from 'vitest'

import { classifyLinkedAccounts } from '../../server/_lib/walletMapping.ts'
import { syncUserWallets } from '../../server/_lib/walletSync.ts'

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
})
