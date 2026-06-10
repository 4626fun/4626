import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import { clearAppActivityJournalForTests, readAppActivityJournal, appendAppSwapActivity } from './appActivityJournal'
import { buildMergedTrayActivityRows } from './trayActivity'

const CSW = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')

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

describe('appActivityJournal', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  afterEach(() => {
    clearAppActivityJournalForTests()
    vi.unstubAllGlobals()
  })

  it('stores and reads swap entries per wallet', () => {
    appendAppSwapActivity({
      walletAddress: CSW,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      amountInUnits: '1.0',
      estimatedOut: '2500',
      tokenIn: '0x0000000000000000000000000000000000000000',
      tokenOut: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    })

    const rows = readAppActivityJournal(CSW)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('swap')
    expect(rows[0]?.txHash).toMatch(/^0x/)
  })
})

describe('buildMergedTrayActivityRows', () => {
  it('prefers app swap labels when tx hash matches on-chain row', () => {
    const txHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const merged = buildMergedTrayActivityRows({
      wallets: [{ address: '0xab6d5c10b03300326cd7fab7267ae192842967b5', label: '4626 CSW' }],
      appEntries: [
        {
          id: `swap:${txHash}`,
          kind: 'swap',
          walletAddress: '0xAb6d5c10b03300326cd7fab7267ae192842967b5',
          txHash,
          userOpHash: null,
          amountInUnits: '0.5',
          estimatedOut: '1200',
          tokenIn: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          tokenOut: '0x0000000000000000000000000000000000000000',
          completedAtMs: 1_700_000_000_000,
        },
      ],
      onchainMerged: [
        {
          txHash,
          walletAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          timestampMs: 1_700_000_000_000,
          title: 'Swap or trade',
          subtitle: 'execute',
          kind: 'swap',
          failed: false,
        },
      ],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0]?.title).toBe('Swap on 4626')
    expect(merged[0]?.source).toBe('app')
  })
})
