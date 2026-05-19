import { beforeEach, describe, expect, it, vi } from 'vitest'

const addOwnerSendCallsMock = vi.fn()

vi.mock('@/lib/wallet/baseAppOwnerCalls', () => ({
  addOwnerViaBaseAppSendCalls: (...args: unknown[]) => addOwnerSendCallsMock(...args),
  encodeAddOwnerCall: (params: { csw: string; ownerToAdd: string }) => ({
    to: params.csw,
    data: '0xdeadbeef',
    value: '0x0' as const,
  }),
}))

import { installEmbeddedOwnerOnSubAccount, readEmbeddedOwnerOnSubAccount } from './subAccountOwnerInstall'

const SUB = '0x1111111111111111111111111111111111111111' as const
const EMBED = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const

describe('subAccountOwnerInstall', () => {
  beforeEach(() => {
    addOwnerSendCallsMock.mockReset()
    addOwnerSendCallsMock.mockResolvedValue({
      callBundleId: 'bundle_1',
      transactionHash: '0xabc',
    })
  })

  it('skips addOwner when embedded EOA is already owner', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(true),
    }
    const request = vi.fn()
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.alreadyOwner).toBe(true)
    expect(result.installed).toBe(false)
    expect(request).not.toHaveBeenCalled()
    expect(addOwnerSendCallsMock).not.toHaveBeenCalled()
  })

  it('submits addOwner via eth_sendTransaction on the sub-account when not yet owner', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(false),
    }
    const request = vi.fn().mockResolvedValue(TX_HASH)
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(result.transactionHash).toBe(TX_HASH)
    expect(result.callBundleId).toBeNull()
    expect(request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [
        {
          from: SUB,
          to: SUB,
          data: '0xdeadbeef',
          value: '0x0',
        },
      ],
    })
    expect(addOwnerSendCallsMock).not.toHaveBeenCalled()
  })

  it('falls back to wallet_sendCalls when eth_sendTransaction fails for non-rejection reasons', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(false),
    }
    const request = vi.fn().mockRejectedValue(new Error('unsupported method'))
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(addOwnerSendCallsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        csw: SUB,
        ownerToAdd: EMBED,
      }),
    )
  })

  it('rethrows user rejection from eth_sendTransaction without sendCalls fallback', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(false),
    }
    const request = vi.fn().mockRejectedValue(new Error('User rejected the request'))
    await expect(
      installEmbeddedOwnerOnSubAccount({
        provider: { request },
        subAccountAddress: SUB,
        embeddedEoaAddress: EMBED,
        publicClient: publicClient as any,
      }),
    ).rejects.toThrow(/user rejected/i)
    expect(addOwnerSendCallsMock).not.toHaveBeenCalled()
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
