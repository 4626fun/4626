import { describe, expect, it } from 'vitest'

import {
  collectWalletCandidates,
  mergeByAddress,
  nestedWalletEntries,
  normalizeAddress,
  resolveOwnerWalletId,
  toCandidate,
  type WalletCandidate,
} from './privyOwnerWalletIdResolver.ts'

const TARGET = '0xCEca13f2686eD061C57620ecdF67e1b8c0f285E9'
const TARGET_LC = TARGET.toLowerCase()
const OTHER = '0x1111111111111111111111111111111111111111'
const WALLET_ID = 'priv_wallet_abc123'

describe('privyOwnerWalletIdResolver helpers', () => {
  describe('normalizeAddress', () => {
    it('lowercases valid EVM addresses', () => {
      expect(normalizeAddress(TARGET)).toBe(TARGET_LC)
    })
    it('rejects non-strings and malformed input', () => {
      expect(normalizeAddress(null)).toBeNull()
      expect(normalizeAddress(123)).toBeNull()
      expect(normalizeAddress('not-an-address')).toBeNull()
      expect(normalizeAddress('0x123')).toBeNull()
    })
  })

  describe('nestedWalletEntries', () => {
    it('supports camelCase nested arrays', () => {
      expect(
        nestedWalletEntries({
          smartWallets: [{ address: TARGET }],
          embeddedWallets: [{ address: OTHER }],
        }),
      ).toHaveLength(2)
    })
    it('supports snake_case nested arrays', () => {
      expect(
        nestedWalletEntries({
          smart_wallets: [{ address: TARGET }],
          embedded_wallets: [{ address: OTHER }],
        }),
      ).toHaveLength(2)
    })
    it('returns empty when no nested arrays present', () => {
      expect(nestedWalletEntries({})).toEqual([])
      expect(nestedWalletEntries(null)).toEqual([])
    })
  })

  describe('collectWalletCandidates', () => {
    it('gathers wallet, wallets, linkedAccounts, linked_accounts entries', () => {
      const user = {
        wallet: { address: TARGET },
        wallets: [{ address: OTHER }],
        linkedAccounts: [{ type: 'wallet', address: TARGET }],
        linked_accounts: [{ type: 'wallet', address: OTHER }],
      }
      expect(collectWalletCandidates(user)).toHaveLength(4)
    })
    it('flattens nested embeddedWallets inside linked accounts', () => {
      const user = {
        linkedAccounts: [
          { type: 'email', address: 'x@y.com' },
          { type: 'wallet', embeddedWallets: [{ address: TARGET }] },
        ],
      }
      const all = collectWalletCandidates(user)
      expect(all.length).toBeGreaterThanOrEqual(2)
      expect(all.some((w) => (w as any)?.address === TARGET)).toBe(true)
    })
    it('tolerates missing user payload', () => {
      expect(collectWalletCandidates(null)).toEqual([])
      expect(collectWalletCandidates({})).toEqual([])
    })
  })

  describe('toCandidate and mergeByAddress', () => {
    it('accepts snake_case metadata', () => {
      const c = toCandidate({
        address: TARGET,
        chain_type: 'ethereum',
        wallet_client_type: 'privy',
        wallet_id: WALLET_ID,
        hd_wallet_index: 0,
        delegated: true,
      })
      expect(c).toEqual({
        address: TARGET_LC,
        id: WALLET_ID,
        chainType: 'ethereum',
        walletClientType: 'privy',
        hdWalletIndex: 0,
        delegated: true,
        rawType: null,
      })
    })
    it('merges duplicate address entries, preferring non-null fields', () => {
      const entries: WalletCandidate[] = [
        {
          address: TARGET_LC,
          id: null,
          chainType: 'ethereum',
          walletClientType: null,
          hdWalletIndex: null,
          delegated: null,
          rawType: 'wallet',
        },
        {
          address: TARGET_LC,
          id: WALLET_ID,
          chainType: null,
          walletClientType: 'privy',
          hdWalletIndex: 0,
          delegated: true,
          rawType: null,
        },
      ]
      const [merged] = mergeByAddress(entries)
      expect(merged.id).toBe(WALLET_ID)
      expect(merged.chainType).toBe('ethereum')
      expect(merged.walletClientType).toBe('privy')
      expect(merged.hdWalletIndex).toBe(0)
      expect(merged.delegated).toBe(true)
      expect(merged.rawType).toBe('wallet')
    })
  })
})

describe('resolveOwnerWalletId', () => {
  it('matches when owner EOA is only under snake_case linked_accounts', () => {
    const user = {
      linked_accounts: [
        {
          type: 'wallet',
          address: TARGET.toUpperCase(),
          chain_type: 'ethereum',
          wallet_client_type: 'privy',
          wallet_id: WALLET_ID,
          hd_wallet_index: 0,
          delegated: true,
        },
      ],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('ready')
    if (outcome.status === 'ready') {
      expect(outcome.candidate.id).toBe(WALLET_ID)
      expect(outcome.candidate.chainType).toBe('ethereum')
      expect(outcome.candidate.walletClientType).toBe('privy')
      expect(outcome.candidate.hdWalletIndex).toBe(0)
      expect(outcome.candidate.delegated).toBe(true)
    }
  })

  it('matches when owner EOA is only on user.wallet', () => {
    const user = {
      wallet: {
        address: TARGET_LC,
        chainType: 'ethereum',
        walletClientType: 'privy',
        id: WALLET_ID,
      },
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('ready')
  })

  it('matches when owner EOA is only in user.wallets', () => {
    const user = {
      wallets: [
        {
          address: TARGET_LC,
          chainType: 'ethereum',
          walletClientType: 'privy',
          id: WALLET_ID,
        },
      ],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('ready')
  })

  it('matches when owner EOA is only inside a nested embeddedWallets array', () => {
    const user = {
      linkedAccounts: [
        { type: 'email', address: 'x@y.com' },
        {
          type: 'wallet',
          embeddedWallets: [
            {
              address: TARGET_LC,
              chainType: 'ethereum',
              walletClientType: 'privy',
              id: WALLET_ID,
            },
          ],
        },
      ],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('ready')
  })

  it('merges surfaces so an id on one surface wins when another is sparse', () => {
    const user = {
      linkedAccounts: [{ type: 'wallet', address: TARGET_LC, chainType: 'ethereum' }],
      wallets: [{ address: TARGET_LC, id: WALLET_ID, walletClientType: 'privy' }],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('ready')
    if (outcome.status === 'ready') {
      expect(outcome.candidate.id).toBe(WALLET_ID)
      expect(outcome.candidate.walletClientType).toBe('privy')
    }
  })

  it('returns no_server_id when EOA is present but not delegated', () => {
    const user = {
      linkedAccounts: [
        {
          type: 'wallet',
          address: TARGET_LC,
          chainType: 'ethereum',
          walletClientType: 'privy',
          delegated: false,
        },
      ],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('no_server_id')
    if (outcome.status === 'no_server_id') {
      expect(outcome.matches).toHaveLength(1)
      expect(outcome.matches[0].id).toBeNull()
    }
  })

  it('returns no_match when EOA is absent from every surface', () => {
    const user = {
      linkedAccounts: [{ type: 'wallet', address: OTHER }],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('no_match')
  })

  it('ignores non-EVM or malformed wallet addresses', () => {
    const user = {
      linkedAccounts: [
        { type: 'wallet', address: 'SoL1234567890abcdefghijklmnop' },
        { type: 'wallet', address: '0xnot-hex' },
      ],
    }
    const outcome = resolveOwnerWalletId(user, TARGET_LC)
    expect(outcome.status).toBe('no_match')
  })

  it('returns no_match when the target ownerEoa is not a valid address', () => {
    const user = {
      linkedAccounts: [{ type: 'wallet', address: TARGET_LC, id: WALLET_ID }],
    }
    const outcome = resolveOwnerWalletId(user, 'not-an-address')
    expect(outcome.status).toBe('no_match')
  })
})
