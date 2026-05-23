import { describe, expect, it, vi } from 'vitest'
import type { Address, PublicClient } from 'viem'

import { readSubAccountIsDeployed } from '@/lib/wallet/subAccountDeploy'

describe('readSubAccountIsDeployed', () => {
  it('returns false when bytecode is empty', async () => {
    const publicClient = {
      getBytecode: vi.fn().mockResolvedValue('0x'),
    } as unknown as PublicClient

    await expect(
      readSubAccountIsDeployed(publicClient, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address),
    ).resolves.toBe(false)
  })

  it('returns true when bytecode exists', async () => {
    const publicClient = {
      getBytecode: vi.fn().mockResolvedValue('0x1234'),
    } as unknown as PublicClient

    await expect(
      readSubAccountIsDeployed(publicClient, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address),
    ).resolves.toBe(true)
  })
})
