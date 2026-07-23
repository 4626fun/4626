import { PublicKey } from '@solana/web3.js'

/**
 * Meteora DLMM's on-chain admin token_badge account shape.
 *
 * This decoder is shared by the mutation endpoint's finalized preflight and
 * the read-only B2 preflight so pool creation cannot run before the admin
 * badge is independently present and bound to the exact B2 mint.
 */
export const METEORA_TOKEN_BADGE_ACCOUNT_SIZE = 168
export const METEORA_TOKEN_BADGE_DISCRIMINATOR = Buffer.from([
  116, 219, 204, 229, 249, 116, 255, 150,
])

export function decodeMeteoraTokenBadge(
  data: Buffer | Uint8Array,
  mint: PublicKey,
): { valid: boolean; reason: string } {
  const bytes = Buffer.from(data)
  if (bytes.length !== METEORA_TOKEN_BADGE_ACCOUNT_SIZE) {
    return { valid: false, reason: `length=${bytes.length}` }
  }
  if (!bytes.subarray(0, 8).equals(METEORA_TOKEN_BADGE_DISCRIMINATOR)) {
    return { valid: false, reason: 'discriminator_mismatch' }
  }
  if (!bytes.subarray(8, 40).equals(mint.toBuffer())) {
    return { valid: false, reason: 'mint_mismatch' }
  }
  return { valid: true, reason: `mint=${mint.toBase58()}` }
}
