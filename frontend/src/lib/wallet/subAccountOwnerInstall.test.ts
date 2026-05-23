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

function mockPublicClient(readContract: ReturnType<typeof vi.fn>, bytecode: `0x${string}` | null = '0x60016000') {
  return {
    getBytecode: vi.fn().mockResolvedValue(bytecode),
    readContract,
  }
}

describe('subAccountOwnerInstall', () => {
  beforeEach(() => {
    addOwnerSendCallsMock.mockReset()
    addOwnerSendCallsMock.mockResolvedValue({
      callBundleId: 'bundle_1',
      transactionHash: '0xabc',
    })
  })

  it('skips addOwner when embedded EOA is already owner', async () => {
    const publicClient = mockPublicClient(vi.fn().mockResolvedValue(true))
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

  it('submits addOwner via wallet_sendCalls when not yet owner', async () => {
    const publicClient = mockPublicClient(vi.fn().mockResolvedValue(false))
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x2105')
      .mockResolvedValueOnce([SUB])
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(result.callBundleId).toBe('bundle_1')
    expect(addOwnerSendCallsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        csw: SUB,
        ownerToAdd: EMBED,
      }),
    )
    expect(request).toHaveBeenNthCalledWith(1, { method: 'eth_chainId' })
    expect(request).toHaveBeenNthCalledWith(2, { method: 'eth_requestAccounts' })
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
  })

  it('falls back to eth_sendTransaction when wallet_sendCalls fails for non-rejection reasons', async () => {
    const publicClient = mockPublicClient(vi.fn().mockResolvedValue(false))
    addOwnerSendCallsMock.mockRejectedValueOnce(new Error('unsupported method'))
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x2105')
      .mockResolvedValueOnce([SUB])
      .mockResolvedValueOnce(TX_HASH)
    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(result.transactionHash).toBe(TX_HASH)
    expect(result.callBundleId).toBeNull()
    expect(addOwnerSendCallsMock).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenNthCalledWith(3, {
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
  })

  it('retries sendCalls after reauth, then falls back to eth_sendTransaction when still unauthorized', async () => {
    const publicClient = mockPublicClient(vi.fn().mockResolvedValue(false))
    addOwnerSendCallsMock
      .mockRejectedValueOnce(new Error('requested method and/or account has not been authorized by the user'))
      .mockRejectedValueOnce(new Error('still unauthorized'))
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x2105')
      .mockResolvedValueOnce([SUB])
      .mockResolvedValueOnce([SUB])
      .mockResolvedValueOnce(TX_HASH)

    const result = await installEmbeddedOwnerOnSubAccount({
      provider: { request },
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
      publicClient: publicClient as any,
    })
    expect(result.installed).toBe(true)
    expect(result.transactionHash).toBe(TX_HASH)
    expect(addOwnerSendCallsMock).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(2, { method: 'eth_requestAccounts' })
    expect(request).toHaveBeenNthCalledWith(3, { method: 'eth_requestAccounts' })
  })

  it('rethrows user rejection from wallet_sendCalls without eth_sendTransaction fallback', async () => {
    const publicClient = mockPublicClient(vi.fn().mockResolvedValue(false))
    addOwnerSendCallsMock.mockRejectedValueOnce(new Error('User rejected the request'))
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x2105')
      .mockResolvedValueOnce([SUB])
    await expect(
      installEmbeddedOwnerOnSubAccount({
        provider: { request },
        subAccountAddress: SUB,
        embeddedEoaAddress: EMBED,
        publicClient: publicClient as any,
      }),
    ).rejects.toThrow(/user rejected/i)
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
  })

  it('readEmbeddedOwnerOnSubAccount returns null when contract is not deployed', async () => {
    const publicClient = mockPublicClient(vi.fn(), '0x')
    const result = await readEmbeddedOwnerOnSubAccount({
      publicClient: publicClient as any,
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
    })
    expect(result).toBeNull()
  })
})
