import { describe, expect, it, vi } from 'vitest'

import { createPrivyEmbeddedUserOpWalletClient } from '@/lib/privy/createPrivyEmbeddedUserOpWalletClient'

const ADDRESS = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' as const
const DIGEST = `0x${'ab'.repeat(32)}` as `0x${string}`
const SIG = `0x${'cd'.repeat(65)}`

vi.mock('@/lib/wallet/safeSwitchToBase', () => ({
  ensureProviderOnBase: vi.fn(async () => undefined),
}))

describe('createPrivyEmbeddedUserOpWalletClient', () => {
  it('routes eth_sign digests through secp256k1_sign', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') return SIG
      throw new Error(`unexpected ${args.method}`)
    })
    const client = createPrivyEmbeddedUserOpWalletClient({
      address: ADDRESS,
      getProvider: async () => ({ request }),
    })
    const out = await client.request({ method: 'eth_sign', params: [ADDRESS, DIGEST] })
    expect(out).toBe(SIG)
    expect(request).toHaveBeenCalledWith({ method: 'secp256k1_sign', params: [DIGEST] })
  })

  it('falls back to eth_sign when secp256k1_sign fails', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') throw new Error('Missing auth token.')
      if (args.method === 'eth_sign') return SIG
      throw new Error(`unexpected ${args.method}`)
    })
    const onFallback = vi.fn()
    const client = createPrivyEmbeddedUserOpWalletClient({
      address: ADDRESS,
      getProvider: async () => ({ request }),
      onSecp256k1Fallback: onFallback,
    })
    const out = await client.request({ method: 'eth_sign', params: [ADDRESS, DIGEST] })
    expect(out).toBe(SIG)
    expect(onFallback).toHaveBeenCalled()
  })
})
