import { encodeAbiParameters, type Hex } from 'viem'

/**
 * Wrap a raw 65-byte secp256k1 owner signature for Permit2 when the token owner is a CSW.
 * Mirrors server `wrapCswOwnerSignature` in `server/_lib/wallet/cswOwnerSignature.ts`.
 */
export function wrapCswOwnerSignature(ownerSignature: Hex, ownerIndex: number = 0): Hex {
  if (!ownerSignature.startsWith('0x') || ownerSignature.length !== 132) {
    throw new Error(
      'Permit2 signature must be a 65-byte ECDSA signature before CSW wrapping. Retry the wallet signature step.',
    )
  }
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), ownerSignature],
  )
}
