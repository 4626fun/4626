import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'

import {
  decodeMeteoraTokenBadge,
  METEORA_TOKEN_BADGE_ACCOUNT_SIZE,
  METEORA_TOKEN_BADGE_DISCRIMINATOR,
} from './solanaMeteoraTokenBadge.js'

const MINT = new PublicKey('So11111111111111111111111111111111111111112')

function validBadge(mint = MINT): Buffer {
  const data = Buffer.alloc(METEORA_TOKEN_BADGE_ACCOUNT_SIZE)
  METEORA_TOKEN_BADGE_DISCRIMINATOR.copy(data, 0)
  mint.toBuffer().copy(data, 8)
  return data
}

describe('Meteora B2 token_badge decoder', () => {
  it('accepts the finalized canonical discriminator and exact mint binding', () => {
    expect(decodeMeteoraTokenBadge(validBadge(), MINT)).toMatchObject({ valid: true })
  })

  it('rejects missing, malformed, and differently bound badges', () => {
    expect(decodeMeteoraTokenBadge(Buffer.alloc(0), MINT).valid).toBe(false)
    const wrongDiscriminator = validBadge()
    wrongDiscriminator[0] ^= 0xff
    expect(decodeMeteoraTokenBadge(wrongDiscriminator, MINT).reason).toBe('discriminator_mismatch')
    expect(decodeMeteoraTokenBadge(validBadge(new PublicKey('11111111111111111111111111111111')), MINT).reason).toBe('mint_mismatch')
  })
})
