/**
 * ERC-1271 contract-signature wrapper for Coinbase Smart Wallet (CSW) + Permit2.
 *
 * Why this wrapping is needed
 * ---------------------------
 * When the Zora quote API returns Permit2 permit objects for a sell trade, the
 * permit must be authorized by the *signer* that Permit2 knows — in our case
 * the CSW itself (a contract). Permit2 checks authorization by calling
 * `isValidSignature(digest, signature)` on the signer (ERC-1271). For a
 * contract signer, the raw 65-byte ECDSA signature that a standard EOA would
 * produce is not accepted — Permit2 expects the Coinbase SmartWallet
 * `SignatureWrapper` encoding instead.
 *
 * The `SignatureWrapper` struct (from Coinbase SmartWallet source):
 *   struct SignatureWrapper {
 *     uint256 ownerIndex;
 *     bytes   signatureData;
 *   }
 * Encoded as `abi.encode(uint256 ownerIndex, bytes signatureData)`.
 *
 * Where the owner signature comes from
 * -------------------------------------
 * The CSW owner EOA's private key is held by Privy in the backend quorum.
 * We compute the Permit2 typed-data digest off-chain (via viem's
 * `hashTypedData`) and call `secp256k1SignHash` (Privy's raw secp256k1 RPC)
 * with that digest. The resulting 65-byte ECDSA signature is then wrapped with
 * `wrapCswOwnerSignature` before being sent back to Zora in the re-quote call.
 *
 * Assumption: 1-of-1 CSW (ownerIndex = 0)
 * -----------------------------------------
 * The current provisioning flow creates a single-owner CSW. `ownerIndex` is
 * therefore always 0 (the first and only owner). If multi-owner CSWs are
 * introduced in a future phase, callers should pass the correct `ownerIndex`
 * from the `CommandIssuerContext.ownerIndex` field.
 */

import { encodeAbiParameters, type Hex } from 'viem'

/**
 * Wrap a raw 65-byte secp256k1 owner signature into the ERC-1271
 * `SignatureWrapper` format that Permit2 expects when the signer is a
 * Coinbase Smart Wallet.
 *
 * @param ownerSignature - 65-byte ECDSA signature as a `0x`-prefixed hex
 *   string (output of `secp256k1SignHash` / Privy `secp256k1_sign`).
 * @param ownerIndex - Index of the owner within the CSW owner array.
 *   Defaults to 0 for the standard 1-of-1 provisioning setup.
 * @returns abi.encode(uint256 ownerIndex, bytes signatureData) — the
 *   exact bytes that CSW's `isValidSignature` will decode.
 * @throws Error when `ownerSignature` is not exactly 65 bytes (132 hex
 *   chars plus the 0x prefix, for a total length of 134).
 */
export function wrapCswOwnerSignature(ownerSignature: Hex, ownerIndex: number = 0): Hex {
  // 65 bytes = 130 hex chars + 2 for '0x' prefix = 132 total chars.
  if (!ownerSignature.startsWith('0x') || ownerSignature.length !== 132) {
    throw new Error(
      `wrapCswOwnerSignature: expected a 65-byte (132-hex-char) signature, got length ${ownerSignature.length}. ` +
        'Ensure the signature comes from Privy secp256k1_sign and is not truncated.',
    )
  }
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), ownerSignature],
  )
}
