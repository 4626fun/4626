import type { Hex } from 'viem'

import { ensureSignatureHex } from '@/lib/aa/coinbaseErc4337Signature'

const RAW_DIGEST_RE = /^0x[0-9a-fA-F]{64}$/

export function isRawEcdsaDigest(value: unknown): value is Hex {
  return typeof value === 'string' && RAW_DIGEST_RE.test(value)
}

type WalletClientWithRequest = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  signMessage?: (args: {
    account?: string
    message: { raw: Hex } | Hex | string
  }) => Promise<Hex | string>
}

/**
 * Sign a 32-byte hash for Permit2 / UserOp lanes. Must NOT use personal_sign (EIP-191 prefix).
 * Prefer Privy `secp256k1_sign`, then `eth_sign` on the digest.
 */
export async function signRawEcdsaDigest(params: {
  digest: Hex
  signerAddress: string
  walletClient: WalletClientWithRequest
  label?: string
}): Promise<Hex> {
  if (!isRawEcdsaDigest(params.digest)) {
    throw new Error('Expected a 32-byte digest for raw ECDSA signing.')
  }

  const label = params.label ?? 'signRawEcdsaDigest'
  const request = params.walletClient.request

  if (typeof request === 'function') {
    try {
      const rawSig = await request({
        method: 'secp256k1_sign',
        params: [params.digest],
      })
      return ensureSignatureHex(rawSig, `${label}.secp256k1_sign`)
    } catch {
      // Fall through to eth_sign when secp256k1_sign is unavailable.
    }

    try {
      const rawSig = await request({
        method: 'eth_sign',
        params: [params.signerAddress, params.digest],
      })
      return ensureSignatureHex(rawSig, `${label}.eth_sign`)
    } catch {
      // Fall through to explicit error below.
    }
  }

  throw new Error(
    'Your wallet must support raw digest signing (secp256k1_sign) for smart-wallet Permit2. Reconnect and try again.',
  )
}
