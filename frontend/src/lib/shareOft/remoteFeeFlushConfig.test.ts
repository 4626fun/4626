import { describe, expect, it, vi } from 'vitest'

import { applyExecutorDropBuffer } from './remoteFeeFlushConfig'

describe('remoteFeeFlushConfig', () => {
  it('applyExecutorDropBuffer adds 5% headroom by default', () => {
    expect(applyExecutorDropBuffer(1_000_000n)).toBe(1_050_000n)
    expect(applyExecutorDropBuffer(0n)).toBe(0n)
  })

  it('parseRemoteFeeFlushTargets rejects missing lzEid', async () => {
    vi.stubEnv('VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS', JSON.stringify([
      {
        chainId: 4663,
        shareOft: '0x0000000000000000000000000000000000000001',
        rpcUrl: 'https://example.invalid',
      },
    ]))

    const { parseRemoteFeeFlushTargets } = await import('./remoteFeeFlushConfig')
    expect(() => parseRemoteFeeFlushTargets()).toThrow(/missing lzEid/i)
    vi.unstubAllEnvs()
  })

  it('parseRemoteFeeFlushTargets rejects duplicate lzEid', async () => {
    vi.stubEnv(
      'VITE_REMOTE_SHARE_OFT_FLUSH_TARGETS',
      JSON.stringify([
        {
          chainId: 4663,
          lzEid: 30416,
          shareOft: '0x0000000000000000000000000000000000000001',
          rpcUrl: 'https://example.invalid',
          label: 'a',
        },
        {
          chainId: 42161,
          lzEid: 30416,
          shareOft: '0x0000000000000000000000000000000000000002',
          rpcUrl: 'https://example.invalid',
          label: 'b',
        },
      ]),
    )

    const { parseRemoteFeeFlushTargets } = await import('./remoteFeeFlushConfig')
    expect(() => parseRemoteFeeFlushTargets()).toThrow(/Duplicate lzEid/)
    vi.unstubAllEnvs()
  })
})
