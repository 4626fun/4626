import { describe, expect, it, vi } from 'vitest'
import { readVaultStrategyList } from '../_handlers/v1/vault/_readStrategyList'

describe('readVaultStrategyList', () => {
  it('returns empty when strategyCount is zero', async () => {
    const client = {
      readContract: vi.fn(async () => 0n),
      multicall: vi.fn(async () => []),
    }
    await expect(readVaultStrategyList(client, '0x1111111111111111111111111111111111111111')).resolves.toEqual([])
    expect(client.multicall).not.toHaveBeenCalled()
  })

  it('reads strategyList + weights + debt', async () => {
    const a = '0x2222222222222222222222222222222222222222' as const
    const b = '0x3333333333333333333333333333333333333333' as const
    const client = {
      readContract: vi.fn(async () => 2n),
      multicall: vi
        .fn()
        .mockResolvedValueOnce([
          { status: 'success', result: a },
          { status: 'success', result: b },
        ])
        .mockResolvedValueOnce([
          { status: 'success', result: 4500n },
          { status: 'success', result: 100n },
          { status: 'success', result: 4500n },
          { status: 'success', result: 200n },
        ]),
    }
    const rows = await readVaultStrategyList(client, '0x1111111111111111111111111111111111111111')
    expect(rows).toEqual([
      { address: a, weight: 4500n, debt: 100n },
      { address: b, weight: 4500n, debt: 200n },
    ])
  })
})
