import { describe, expect, it } from 'vitest'
import {
  extractZoraCrossAppAccounts,
  extractCrossAppWalletAddresses,
  resolveCanonicalCswCandidate,
  selectCrossAppAuthAction,
} from './crossAppWalletUtils'

const ZORA_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

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

describe('extractCrossAppWalletAddresses', () => {
  it('extracts and deduplicates provider/smart/embedded addresses', () => {
    const result = extractCrossAppWalletAddresses([
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

describe('resolveCanonicalCswCandidate', () => {
  it('prefers known canonical first', async () => {
    const resolved = await resolveCanonicalCswCandidate({
      knownCanonicalAddress: '0x9999999999999999999999999999999999999999',
      smartWalletAddresses: ['0x2222222222222222222222222222222222222222'],
      providerAddresses: ['0x1111111111111111111111111111111111111111'],
      profileFallbackAddress: '0x3333333333333333333333333333333333333333',
    })
    expect(resolved).toBe('0x9999999999999999999999999999999999999999')
  })

  it('falls back from smart candidates to profile fallback', async () => {
    const resolved = await resolveCanonicalCswCandidate({
      knownCanonicalAddress: null,
      smartWalletAddresses: ['0x2222222222222222222222222222222222222222'],
      providerAddresses: ['0x1111111111111111111111111111111111111111'],
      profileFallbackAddress: '0x3333333333333333333333333333333333333333',
      isContractAddress: async (candidate) => candidate.toLowerCase() === '0x1111111111111111111111111111111111111111',
    })
    expect(resolved).toBe('0x3333333333333333333333333333333333333333')
  })
})

describe('selectCrossAppAuthAction', () => {
  const noop = async () => null

  it('prefers link helper for authenticated users', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: noop,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('link')
  })

  it('falls back to login helper when link helper is unavailable', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: null,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('login')
  })

  it('uses login helper first for unauthenticated users', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: false,
        linkCrossAppAccount: noop,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('login')
  })

  it('returns null when no helper is available', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: null,
        loginWithCrossAppAccount: null,
      }),
    ).toBeNull()
  })
})
