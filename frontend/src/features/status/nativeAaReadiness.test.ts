import { describe, expect, it, vi } from 'vitest'

import {
  EIP_8130,
  EIP_8130_ACTOR_SCOPE,
  classifyNativeAaReadiness,
  nativeAaCheckExitCode,
  probeNativeAaReadiness,
  type NativeAaRpcCall,
} from './nativeAaReadiness'

describe('EIP_8130 constants', () => {
  it('pins the spec transaction types and precompile addresses', () => {
    expect(EIP_8130.txType).toBe(0x79)
    expect(EIP_8130.payerType).toBe(0x7a)
    expect(EIP_8130.nonceManagerAddress).toBe('0x813000000000000000000000000000000000aa01')
    expect(EIP_8130.txContextAddress).toBe('0x813000000000000000000000000000000000aa02')
    expect(EIP_8130.k1Authenticator).toBe('0x0000000000000000000000000000000000000001')
    expect(EIP_8130.nonceKeyMax).toBe(2n ** 256n - 1n)
  })

  it('treats scope 0x00 as the admin predicate and keeps grant bits disjoint', () => {
    expect(EIP_8130_ACTOR_SCOPE.admin).toBe(0x00)
    const grants = [
      EIP_8130_ACTOR_SCOPE.sender,
      EIP_8130_ACTOR_SCOPE.policy,
      EIP_8130_ACTOR_SCOPE.nonce,
      EIP_8130_ACTOR_SCOPE.selfPayer,
      EIP_8130_ACTOR_SCOPE.sponsorPayer,
    ]
    expect(grants.reduce((acc, bit) => acc | bit, 0)).toBe(0x1f)
    expect(new Set(grants).size).toBe(grants.length)
  })
})

describe('classifyNativeAaReadiness', () => {
  it('reports unsupported when no precompile code is present (Base mainnet today)', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: 8453,
      nonceManagerCode: '0x',
      txContextCode: '0x',
      accountConfiguration: null,
    })
    expect(readiness.level).toBe('unsupported')
    expect(readiness.nonceManagerPresent).toBe(false)
    expect(readiness.accountConfigurationPresent).toBeNull()
    expect(readiness.summary).toMatch(/EntryPoint v0\.6/)
  })

  it('reports partial when the nonce manager is live but the tx context is not (Vibenet today)', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: 84538453,
      nonceManagerCode: '0xef',
      txContextCode: '0x',
      accountConfiguration: null,
    })
    expect(readiness.level).toBe('partial')
    expect(readiness.nonceManagerPresent).toBe(true)
    expect(readiness.txContextPresent).toBe(false)
    expect(readiness.summary).toMatch(/transaction context precompile/)
  })

  it('reports partial when the tx context appears before the nonce manager', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: 8453,
      nonceManagerCode: '0x',
      txContextCode: '0xef',
      accountConfiguration: null,
    })
    expect(readiness.level).toBe('partial')
    expect(readiness.nonceManagerPresent).toBe(false)
    expect(readiness.txContextPresent).toBe(true)
    expect(readiness.summary).toMatch(/nonce manager precompile/)
  })

  it('reports supported once both precompiles carry code', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: 8453,
      nonceManagerCode: '0xef',
      txContextCode: '0xef',
      accountConfiguration: null,
    })
    expect(readiness.level).toBe('supported')
  })

  it('downgrades to partial when a supplied account configuration address has no code', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: 8453,
      nonceManagerCode: '0xef',
      txContextCode: '0xef',
      accountConfiguration: { address: '0x0000000000000000000000000000000000009130', code: '0x' },
    })
    expect(readiness.level).toBe('partial')
    expect(readiness.accountConfigurationPresent).toBe(false)
    expect(readiness.summary).toMatch(/account configuration contract/)
  })

  it('treats unreadable and malformed code responses as absent', () => {
    const readiness = classifyNativeAaReadiness({
      chainId: null,
      nonceManagerCode: null,
      txContextCode: 'not-hex',
      accountConfiguration: null,
    })
    expect(readiness.level).toBe('unsupported')
    expect(readiness.txContextPresent).toBe(false)
    expect(readiness.chainId).toBeNull()
  })
})

describe('probeNativeAaReadiness', () => {
  it('reads chain id and both precompiles without probing account config by default', async () => {
    const rpc = vi.fn<NativeAaRpcCall>(async (method, params) => {
      if (method === 'eth_chainId') return '0x2105'
      if (method === 'eth_getCode') {
        const address = String((params as unknown[])[0]).toLowerCase()
        return address === EIP_8130.nonceManagerAddress ? '0xef' : '0x'
      }
      return null
    })

    const readiness = await probeNativeAaReadiness(rpc)

    expect(readiness.chainId).toBe(8453)
    expect(readiness.level).toBe('partial')
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenCalledWith('eth_getCode', [EIP_8130.nonceManagerAddress, 'latest'])
    expect(rpc).toHaveBeenCalledWith('eth_getCode', [EIP_8130.txContextAddress, 'latest'])
  })

  it('probes the account configuration contract when an address is supplied', async () => {
    const accountConfigurationAddress = '0x0000000000000000000000000000000000009130'
    const rpc = vi.fn<NativeAaRpcCall>(async (method) =>
      method === 'eth_chainId' ? '0x2105' : '0xef',
    )

    const readiness = await probeNativeAaReadiness(rpc, { accountConfigurationAddress })

    expect(rpc).toHaveBeenCalledTimes(4)
    expect(rpc).toHaveBeenCalledWith('eth_getCode', [accountConfigurationAddress, 'latest'])
    expect(readiness.accountConfigurationPresent).toBe(true)
    expect(readiness.level).toBe('supported')
  })

  it('rejects when a required RPC call fails', async () => {
    const rpc = vi.fn<NativeAaRpcCall>(async () => {
      throw new Error('upstream 503')
    })

    await expect(probeNativeAaReadiness(rpc)).rejects.toThrow('upstream 503')
  })

  it('rejects malformed RPC results instead of treating them as absent code', async () => {
    const rpc = vi.fn<NativeAaRpcCall>(async (method) =>
      method === 'eth_chainId' ? 'not-hex' : null,
    )

    await expect(probeNativeAaReadiness(rpc)).rejects.toThrow(
      'eth_chainId returned a malformed result',
    )
  })

  it('rejects a valid response from the wrong chain', async () => {
    const rpc = vi.fn<NativeAaRpcCall>(async (method) =>
      method === 'eth_chainId' ? '0x14a34' : '0x',
    )

    await expect(
      probeNativeAaReadiness(rpc, { expectedChainId: 8453 }),
    ).rejects.toThrow('Expected chain 8453, received 84532')
  })
})

describe('nativeAaCheckExitCode', () => {
  it('fails closed when a required probe errors, even if another endpoint drifted', () => {
    expect(
      nativeAaCheckExitCode([
        { required: true, drifted: false, error: 'upstream 503' },
        { required: true, drifted: true, error: null },
      ]),
    ).toBe(1)
  })

  it('signals drift only after required probes complete successfully', () => {
    expect(
      nativeAaCheckExitCode([{ required: true, drifted: true, error: null }]),
    ).toBe(2)
  })

  it('keeps informational endpoint failures non-fatal', () => {
    expect(
      nativeAaCheckExitCode([{ required: false, drifted: false, error: 'preview offline' }]),
    ).toBe(0)
  })
})
