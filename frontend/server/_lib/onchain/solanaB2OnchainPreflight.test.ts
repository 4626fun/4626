import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { decodeMeteoraTokenBadge } from '../../../scripts/ops/preflight-solana-b2-onchain.js'

const TOKEN_BADGE_DISCRIMINATOR = Buffer.from([116, 219, 204, 229, 249, 116, 255, 150])

function badgeData(mint: ReturnType<typeof Keypair.generate>['publicKey']): Buffer {
  const data = Buffer.alloc(168)
  TOKEN_BADGE_DISCRIMINATOR.copy(data, 0)
  Buffer.from(mint.toBytes()).copy(data, 8)
  return data
}

describe('decodeMeteoraTokenBadge', () => {
  it('accepts the canonical TokenBadge discriminator and mint binding', () => {
    const mint = Keypair.generate().publicKey
    expect(decodeMeteoraTokenBadge(badgeData(mint), mint)).toEqual({
      valid: true,
      reason: `mint=${mint.toBase58()}`,
    })
  })

  it('rejects malformed, forged, or differently bound badges', () => {
    const mint = Keypair.generate().publicKey
    const otherMint = Keypair.generate().publicKey
    expect(decodeMeteoraTokenBadge(Buffer.alloc(40), mint).valid).toBe(false)
    const forged = badgeData(mint)
    forged[0] ^= 0xff
    expect(decodeMeteoraTokenBadge(forged, mint).reason).toBe('discriminator_mismatch')
    expect(decodeMeteoraTokenBadge(badgeData(otherMint), mint).reason).toBe('mint_mismatch')
  })
})
