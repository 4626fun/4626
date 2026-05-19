import { beforeEach, describe, expect, it, vi } from 'vitest'

const addOwnerMock = vi.fn()

vi.mock('@/lib/wallet/baseAppOwnerCalls', () => ({
  addOwnerViaBaseAppSendCalls: (...args: unknown[]) => addOwnerMock(...args),
}))

import { installEmbeddedOwnerOnSubAccount, readEmbeddedOwnerOnSubAccount } from './subAccountOwnerInstall'

const SUB = '0x1111111111111111111111111111111111111111' as const
const EMBED = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const

describe('subAccountOwnerInstall', () => {
  beforeEach(() => {
    addOwnerMock.mockReset()
    addOwnerMock.mockResolvedValue({
      callBundleId: 'bundle_1',
      transactionHash: '0xabc',
    })
  })

  it('skips addOwner when embedded EOA is already owner', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(true),
    }
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request: vi.fn() },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.alreadyOwner).toBe(true)
    expect(result.installed).toBe(false)
    expect(addOwnerMock).not.toHaveBeenCalled()
  })

  it('submits addOwner on the sub-account when not yet owner', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(false),
    }
    const request = vi.fn()
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(addOwnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        csw: SUB,
        ownerToAdd: EMBED,
      }),
    )
  })

  it('readEmbeddedOwnerOnSubAccount returns null when contract is not deployed', async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error('no code')),
    }
    const result = await readEmbeddedOwnerOnSubAccount({
      publicClient: publicClient as any,
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
    })
    expect(result).toBeNull()
  })
})
