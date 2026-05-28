import { describe, expect, it, vi } from 'vitest'

import { isRawEcdsaDigest, signRawEcdsaDigest } from '@/lib/wallet/signRawEcdsaDigest'

const DIGEST = `0x${'ab'.repeat(32)}` as const
const SIG = `0x${'11'.repeat(65)}` as const

describe('signRawEcdsaDigest', () => {
  it('recognizes 32-byte digests', () => {
    expect(isRawEcdsaDigest(DIGEST)).toBe(true)
    expect(isRawEcdsaDigest('0x1234')).toBe(false)
  })

  it('prefers secp256k1_sign over personal_sign', async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'secp256k1_sign') return SIG
      throw new Error('should not reach personal_sign')
    })
    const signMessage = vi.fn()

    const out = await signRawEcdsaDigest({
      digest: DIGEST,
      signerAddress: '0xcECa13F2686ed061c57620Ecdf67E1b8C0F285e9',
      walletClient: { request, signMessage },
    })

    expect(out).toBe(SIG)
    expect(request).toHaveBeenCalledWith({ method: 'secp256k1_sign', params: [DIGEST] })
    expect(signMessage).not.toHaveBeenCalled()
  })
})
