import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, getAddress } from 'viem'

import {
  clearCswOwnerIndexPersistenceForTests,
  writePersistedCswOwnerIndex,
} from './cswOwnerIndexPersistence'
import { findCoinbaseSmartWalletOwnerIndex, resetOwnerIndexCacheForTests } from './coinbaseErc4337Owners'

const SMART_WALLET = getAddress('0x1111111111111111111111111111111111111111')
const OWNER_ADDRESS = getAddress('0x2222222222222222222222222222222222222222')
const OTHER_ADDRESS = getAddress('0x3333333333333333333333333333333333333333')

class MemoryStorage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

function createPublicClient(params: { ownerCount: () => bigint; ownerAtIndex?: (index: number) => string }) {
  const ownerBytes = encodeAbiParameters([{ type: 'address' }], [OWNER_ADDRESS])
  const otherBytes = encodeAbiParameters([{ type: 'address' }], [OTHER_ADDRESS])

  const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
    if (functionName === 'ownerCount') return params.ownerCount()
    if (functionName === 'nextOwnerIndex') return params.ownerCount()
    if (functionName === 'ownerAtIndex') {
      const index = Number((args?.[0] as bigint | undefined) ?? 0n)
      if (params.ownerAtIndex) return params.ownerAtIndex(index)
      return index === 2 ? ownerBytes : otherBytes
    }
    throw new Error(`Unexpected functionName: ${functionName}`)
  })

  return { chain: { id: 8453 }, readContract }
}

describe('findCoinbaseSmartWalletOwnerIndex persisted hints', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    resetOwnerIndexCacheForTests()
    clearCswOwnerIndexPersistenceForTests()
  })

  afterEach(() => {
    resetOwnerIndexCacheForTests()
    clearCswOwnerIndexPersistenceForTests()
  })

  it('uses a persisted owner index after one verify read instead of scanning from zero', async () => {
    writePersistedCswOwnerIndex({
      chainId: 8453,
      smartWallet: SMART_WALLET,
      ownerAddress: OWNER_ADDRESS,
      ownerIndex: 2,
      ownerCountSnapshot: 3,
    })

    const publicClient = createPublicClient({ ownerCount: () => 3n })
    const result = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: publicClient as any,
      smartWallet: SMART_WALLET,
      ownerAddress: OWNER_ADDRESS,
    })

    expect(result).toEqual({ ownerIndex: 2, ownerCount: 3 })
    expect(publicClient.readContract.mock.calls.filter((call) => call[0]?.functionName === 'ownerCount').length).toBe(0)
    expect(publicClient.readContract.mock.calls.filter((call) => call[0]?.functionName === 'ownerAtIndex').length).toBe(1)
  })
})
