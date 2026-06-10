import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import {
  clearCswOwnerIndexPersistenceForTests,
  readPersistedCswOwnerIndex,
  writePersistedCswOwnerIndex,
} from './cswOwnerIndexPersistence'

const CSW = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
const OWNER = getAddress('0xcECa13F2686ed061c57620Ecdf67E1b8C0F285e9')

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

describe('cswOwnerIndexPersistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    clearCswOwnerIndexPersistenceForTests()
  })

  afterEach(() => {
    clearCswOwnerIndexPersistenceForTests()
  })

  it('round-trips owner index hints in localStorage', () => {
    writePersistedCswOwnerIndex({
      chainId: 8453,
      smartWallet: CSW,
      ownerAddress: OWNER,
      ownerIndex: 18,
      ownerCountSnapshot: 9,
    })

    expect(readPersistedCswOwnerIndex({ chainId: 8453, smartWallet: CSW, ownerAddress: OWNER })).toEqual({
      ownerIndex: 18,
      ownerCountSnapshot: 9,
      savedAt: expect.any(Number),
    })
  })

  it('scopes hints by chain, csw, and owner', () => {
    writePersistedCswOwnerIndex({
      chainId: 8453,
      smartWallet: CSW,
      ownerAddress: OWNER,
      ownerIndex: 2,
      ownerCountSnapshot: 3,
    })

    expect(
      readPersistedCswOwnerIndex({
        chainId: 8453,
        smartWallet: CSW,
        ownerAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      }),
    ).toBeNull()
  })
})
