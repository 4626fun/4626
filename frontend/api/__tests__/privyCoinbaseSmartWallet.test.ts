import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters } from 'viem'

const { getWalletByIdMock, secp256k1SignHashMock, walletRpcMock } = vi.hoisted(() => ({
  getWalletByIdMock: vi.fn(),
  secp256k1SignHashMock: vi.fn(),
  walletRpcMock: vi.fn(),
}))

vi.mock('../../server/_lib/wallet/privyWalletApi.js', () => ({
  getWalletById: getWalletByIdMock,
  secp256k1SignHash: secp256k1SignHashMock,
  walletRpc: walletRpcMock,
}))

import {
  findCoinbaseSmartWalletOwnerIndex,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.ts'

const SMART_WALLET = '0x1111111111111111111111111111111111111111'
const OWNER = '0x2222222222222222222222222222222222222222'
const OTHER_OWNER = '0x3333333333333333333333333333333333333333'
const WALLET_ID = 'wallet-123'

describe('resolvePrivyCoinbaseSmartWalletOwnerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the configured owner index when the configured slot matches the Privy wallet owner', async () => {
    getWalletByIdMock.mockResolvedValue({
      walletId: WALLET_ID,
      address: OWNER,
    })
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
      if (functionName === 'ownerAtIndex' && args?.[0] === 7n) {
        return encodeAbiParameters([{ type: 'address' }], [OWNER])
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })

    await expect(
      resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient: { readContract },
        walletId: WALLET_ID,
        smartWallet: SMART_WALLET,
        configuredOwnerIndex: 7,
        expectedOwnerAddress: OWNER,
      }),
    ).resolves.toEqual({
      ownerAddress: OWNER,
      ownerIndex: 7,
    })
    expect(readContract).toHaveBeenCalledTimes(1)
  })

  it('falls back to the configured owner index when wallet lookup is unavailable but the configured slot matches', async () => {
    getWalletByIdMock.mockRejectedValueOnce(new Error('network timeout'))
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
      if (functionName === 'ownerAtIndex' && args?.[0] === 5n) {
        return encodeAbiParameters([{ type: 'address' }], [OWNER])
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })

    await expect(
      resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient: { readContract },
        walletId: WALLET_ID,
        smartWallet: SMART_WALLET,
        configuredOwnerIndex: 5,
        allowConfiguredOwnerIndexFallback: true,
        expectedOwnerAddress: OWNER,
      }),
    ).resolves.toEqual({
      ownerAddress: OWNER,
      ownerIndex: 5,
    })
  })

  it('throws stored_owner_mismatch when the expected owner differs from the resolved Privy wallet owner', async () => {
    getWalletByIdMock.mockResolvedValue({
      walletId: WALLET_ID,
      address: OWNER,
    })
    const readContract = vi.fn()

    await expect(
      resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient: { readContract },
        walletId: WALLET_ID,
        smartWallet: SMART_WALLET,
        expectedOwnerAddress: OTHER_OWNER,
      }),
    ).rejects.toMatchObject({
      name: 'CoinbaseSmartWalletHelperError',
      code: 'stored_owner_mismatch',
      retryable: false,
    })
    expect(readContract).not.toHaveBeenCalled()
  })

  it('propagates retryable wallet lookup failures when no configured fallback is available', async () => {
    getWalletByIdMock.mockRejectedValueOnce(new Error('network timeout'))
    const readContract = vi.fn()

    await expect(
      resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient: { readContract },
        walletId: WALLET_ID,
        smartWallet: SMART_WALLET,
      }),
    ).rejects.toMatchObject({
      name: 'CoinbaseSmartWalletHelperError',
      code: 'privy_wallet_lookup_failed',
      retryable: true,
    })
    expect(readContract).not.toHaveBeenCalled()
  })
})

describe('findCoinbaseSmartWalletOwnerIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws a retryable helper error when owner-slot reads fail during scan and no match is found', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
      if (functionName === 'ownerCount') return 2n
      if (functionName === 'nextOwnerIndex') return 2n
      if (functionName === 'ownerAtIndex' && args?.[0] === 0n) {
        throw new Error('network timeout')
      }
      if (functionName === 'ownerAtIndex' && args?.[0] === 1n) {
        return encodeAbiParameters([{ type: 'address' }], [OTHER_OWNER])
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })

    await expect(
      findCoinbaseSmartWalletOwnerIndex({
        publicClient: { readContract },
        smartWallet: SMART_WALLET,
        ownerAddress: OWNER,
        maxScan: 8,
      }),
    ).rejects.toMatchObject({
      name: 'CoinbaseSmartWalletHelperError',
      code: 'csw_owner_scan_incomplete',
      retryable: true,
    })
  })

  it('throws a retryable helper error when nextOwnerIndex is unavailable and no match is found', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
      if (functionName === 'ownerCount') return 1n
      if (functionName === 'nextOwnerIndex') {
        throw new Error('rpc timeout')
      }
      if (functionName === 'ownerAtIndex' && args?.[0] === 0n) {
        return encodeAbiParameters([{ type: 'address' }], [OTHER_OWNER])
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })

    await expect(
      findCoinbaseSmartWalletOwnerIndex({
        publicClient: { readContract },
        smartWallet: SMART_WALLET,
        ownerAddress: OWNER,
        maxScan: 8,
      }),
    ).rejects.toMatchObject({
      name: 'CoinbaseSmartWalletHelperError',
      code: 'csw_owner_scan_incomplete',
      retryable: true,
    })
  })

  it('throws a retryable helper error when the owner scan is truncated by maxScan and no match is found', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: bigint[] }) => {
      if (functionName === 'ownerCount') return 5n
      if (functionName === 'nextOwnerIndex') return 5n
      if (functionName === 'ownerAtIndex' && args?.[0] === 0n) {
        return encodeAbiParameters([{ type: 'address' }], [OTHER_OWNER])
      }
      if (functionName === 'ownerAtIndex' && args?.[0] === 1n) {
        return encodeAbiParameters([{ type: 'address' }], [OTHER_OWNER])
      }
      throw new Error(`unexpected readContract ${functionName}`)
    })

    await expect(
      findCoinbaseSmartWalletOwnerIndex({
        publicClient: { readContract },
        smartWallet: SMART_WALLET,
        ownerAddress: OWNER,
        maxScan: 2,
      }),
    ).rejects.toMatchObject({
      name: 'CoinbaseSmartWalletHelperError',
      code: 'csw_owner_scan_incomplete',
      retryable: true,
    })
  })
})
