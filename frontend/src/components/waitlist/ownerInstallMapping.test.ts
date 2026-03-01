import { describe, expect, it } from 'vitest'
import {
  deriveOwnerInstallMappingStatus,
  extractZoraCrossAppAccounts,
  extractZoraProviderAddresses,
  resolveCanonicalZoraCswCandidate,
} from './ownerInstallMapping'

const ZORA_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

describe('deriveOwnerInstallMappingStatus', () => {
  it('follows deterministic gate order', () => {
    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: false,
        walletsReady: false,
        embeddedEoaAddress: null,
        embeddedWalletCreating: false,
        zoraLinked: false,
        zoraLinking: false,
        canonicalZoraCswAddress: null,
        canonicalResolving: false,
      }),
    ).toBe('NEEDS_PRIVY_AUTH')

    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: true,
        walletsReady: false,
        embeddedEoaAddress: null,
        embeddedWalletCreating: false,
        zoraLinked: false,
        zoraLinking: false,
        canonicalZoraCswAddress: null,
        canonicalResolving: false,
      }),
    ).toBe('WAITING_FOR_WALLETS')

    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: true,
        walletsReady: true,
        embeddedEoaAddress: null,
        embeddedWalletCreating: true,
        zoraLinked: false,
        zoraLinking: false,
        canonicalZoraCswAddress: null,
        canonicalResolving: false,
      }),
    ).toBe('EMBEDDED_WALLET_CREATING')

    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: true,
        walletsReady: true,
        embeddedEoaAddress: '0x1111111111111111111111111111111111111111',
        embeddedWalletCreating: false,
        zoraLinked: false,
        zoraLinking: false,
        canonicalZoraCswAddress: null,
        canonicalResolving: false,
      }),
    ).toBe('ZORA_LINK_REQUIRED')

    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: true,
        walletsReady: true,
        embeddedEoaAddress: '0x1111111111111111111111111111111111111111',
        embeddedWalletCreating: false,
        zoraLinked: true,
        zoraLinking: false,
        canonicalZoraCswAddress: null,
        canonicalResolving: true,
      }),
    ).toBe('CANONICAL_RESOLVING')

    expect(
      deriveOwnerInstallMappingStatus({
        privyAuthed: true,
        walletsReady: true,
        embeddedEoaAddress: '0x1111111111111111111111111111111111111111',
        embeddedWalletCreating: false,
        zoraLinked: true,
        zoraLinking: false,
        canonicalZoraCswAddress: '0x2222222222222222222222222222222222222222',
        canonicalResolving: false,
      }),
    ).toBe('READY_FOR_OWNER_INSTALL')
  })
})

describe('extractZoraCrossAppAccounts', () => {
  it('keeps only zora provider cross_app accounts', () => {
    const accounts = extractZoraCrossAppAccounts(
      {
        linkedAccounts: [
          { type: 'cross_app', providerAppId: ZORA_APP_ID, address: '0x1111111111111111111111111111111111111111' },
          { type: 'cross_app', providerAppId: 'not-zora', address: '0x2222222222222222222222222222222222222222' },
          { type: 'wallet', address: '0x3333333333333333333333333333333333333333' },
        ],
      },
      ZORA_APP_ID,
    )
    expect(accounts).toHaveLength(1)
    expect(String(accounts[0]?.address).toLowerCase()).toBe('0x1111111111111111111111111111111111111111')
  })
})

describe('extractZoraProviderAddresses', () => {
  it('extracts and deduplicates provider/smart/embedded addresses', () => {
    const result = extractZoraProviderAddresses([
      {
        address: '0x1111111111111111111111111111111111111111',
        smartWallets: [{ address: '0x2222222222222222222222222222222222222222' }],
        embeddedWallets: [{ address: '0x3333333333333333333333333333333333333333' }],
      },
      {
        smart_wallets: [{ address: '0x2222222222222222222222222222222222222222' }],
        embedded_wallets: [{ address: '0x3333333333333333333333333333333333333333' }],
      },
    ])

    expect(result.providerAddresses).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
    ])
    expect(result.smartWalletAddresses).toEqual(['0x2222222222222222222222222222222222222222'])
    expect(result.embeddedWalletAddresses).toEqual(['0x3333333333333333333333333333333333333333'])
  })
})

describe('resolveCanonicalZoraCswCandidate', () => {
  it('prefers known canonical first', async () => {
    const resolved = await resolveCanonicalZoraCswCandidate({
      knownCanonicalAddress: '0x9999999999999999999999999999999999999999',
      smartWalletAddresses: ['0x2222222222222222222222222222222222222222'],
      providerAddresses: ['0x1111111111111111111111111111111111111111'],
      profileFallbackAddress: '0x3333333333333333333333333333333333333333',
    })
    expect(resolved).toBe('0x9999999999999999999999999999999999999999')
  })

  it('falls back from smart candidates to profile fallback', async () => {
    const resolved = await resolveCanonicalZoraCswCandidate({
      knownCanonicalAddress: null,
      smartWalletAddresses: ['0x2222222222222222222222222222222222222222'],
      providerAddresses: ['0x1111111111111111111111111111111111111111'],
      profileFallbackAddress: '0x3333333333333333333333333333333333333333',
      isContractAddress: async (candidate) => candidate.toLowerCase() === '0x1111111111111111111111111111111111111111',
    })
    expect(resolved).toBe('0x3333333333333333333333333333333333333333')
  })
})

