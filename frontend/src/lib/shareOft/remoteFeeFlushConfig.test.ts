import { describe, expect, it, vi } from 'vitest'

describe('remoteFeeFlushConfig', () => {
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
