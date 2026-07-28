import { describe, expect, it, vi } from 'vitest'

import {
  CANONICAL_CSW_ADDRESS,
  PROTOCOL_CSW_ADDRESS,
} from '@/wallet/canonicalWalletPolicy'

import {
  detectCoinbaseSmartWallet,
  isExcludedSwapTokenAddress,
  isKnownNonTokenSwapAddress,
  readStrictErc20Metadata,
  resolveAddressTokenImport,
  type PublicContractReader,
} from './swapTokenAddressGuards'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

function mockClient(handlers: {
  ownerCount?: unknown | Error
  name?: unknown | Error
  symbol?: unknown | Error
  decimals?: unknown | Error
}): PublicContractReader {
  return {
    readContract: vi.fn(async ({ functionName }) => {
      const value = handlers[functionName as keyof typeof handlers]
      if (value instanceof Error) throw value
      if (value === undefined) throw new Error(`unexpected ${functionName}`)
      return value
    }),
  }
}

describe('swapTokenAddressGuards', () => {
  it('treats protocol and canonical CSWs as non-token addresses', () => {
    expect(isKnownNonTokenSwapAddress(PROTOCOL_CSW_ADDRESS)).toBe(true)
    expect(isKnownNonTokenSwapAddress(CANONICAL_CSW_ADDRESS)).toBe(true)
    expect(isKnownNonTokenSwapAddress(USDC)).toBe(false)
  })

  it('excludes the balance-owner wallet address from token rows', () => {
    expect(isExcludedSwapTokenAddress(PROTOCOL_CSW_ADDRESS, null)).toBe(true)
    expect(isExcludedSwapTokenAddress(USDC, PROTOCOL_CSW_ADDRESS)).toBe(false)
    expect(isExcludedSwapTokenAddress(PROTOCOL_CSW_ADDRESS, PROTOCOL_CSW_ADDRESS)).toBe(true)
  })

  it('detects Coinbase Smart Wallets via ownerCount', async () => {
    const cswClient = mockClient({ ownerCount: 3n })
    await expect(detectCoinbaseSmartWallet(cswClient, PROTOCOL_CSW_ADDRESS)).resolves.toBe(true)

    const tokenClient = mockClient({ ownerCount: new Error('no ownerCount') })
    await expect(detectCoinbaseSmartWallet(tokenClient, USDC)).resolves.toBe(false)
  })

  it('requires complete ERC-20 metadata and does not invent labels', async () => {
    const ok = mockClient({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    })
    await expect(readStrictErc20Metadata(ok, USDC)).resolves.toEqual({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    })

    const partial = mockClient({
      name: new Error('no name'),
      symbol: new Error('no symbol'),
      decimals: 18,
    })
    await expect(readStrictErc20Metadata(partial, PROTOCOL_CSW_ADDRESS)).resolves.toBeNull()
  })

  it('rejects smart wallets and non-tokens from address import', async () => {
    const known = mockClient({})
    await expect(
      resolveAddressTokenImport({ client: known, address: PROTOCOL_CSW_ADDRESS }),
    ).resolves.toEqual({ ok: false, reason: 'smart_wallet' })

    const detected = mockClient({
      ownerCount: 1n,
      name: new Error('no'),
      symbol: new Error('no'),
      decimals: new Error('no'),
    })
    await expect(
      resolveAddressTokenImport({
        client: detected,
        address: '0x1111111111111111111111111111111111111111',
      }),
    ).resolves.toEqual({ ok: false, reason: 'smart_wallet' })

    const notToken = mockClient({
      ownerCount: new Error('no'),
      name: new Error('no'),
      symbol: new Error('no'),
      decimals: new Error('no'),
    })
    await expect(
      resolveAddressTokenImport({
        client: notToken,
        address: '0x2222222222222222222222222222222222222222',
      }),
    ).resolves.toEqual({ ok: false, reason: 'not_erc20' })

    const token = mockClient({
      ownerCount: new Error('no'),
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    })
    await expect(resolveAddressTokenImport({ client: token, address: USDC })).resolves.toEqual({
      ok: true,
      metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    })
  })

  it('does not treat a valid ERC-20 as a smart wallet when ownerCount also exists', async () => {
    const both = mockClient({
      ownerCount: 2n,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    })
    await expect(resolveAddressTokenImport({ client: both, address: USDC })).resolves.toEqual({
      ok: true,
      metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    })
  })
})
