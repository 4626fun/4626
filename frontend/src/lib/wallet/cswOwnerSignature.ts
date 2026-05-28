import {
  encodeAbiParameters,
  hashTypedData,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'

import { parseCoinbaseSignatureWrapper } from '@/lib/wallet/coinbaseSignatureWrapper'
import { signRawEcdsaDigest } from '@/lib/wallet/signRawEcdsaDigest'

const EIP1271_MAGIC = '0x1626ba7e' as const

const SIGNATURE_WRAPPER_TUPLE = [
  {
    type: 'tuple' as const,
    components: [
      { name: 'ownerIndex', type: 'uint256' as const },
      { name: 'signatureData', type: 'bytes' as const },
    ],
  },
] as const

export const CSW_REPLAY_SAFE_HASH_ABI = [
  {
    type: 'function' as const,
    name: 'replaySafeHash' as const,
    inputs: [{ name: 'hash', type: 'bytes32' as const }],
    outputs: [{ name: '', type: 'bytes32' as const }],
    stateMutability: 'view' as const,
  },
] as const

export const CSW_OWNER_EIP712_DOMAIN = {
  name: 'Coinbase Smart Wallet',
  version: '1',
} as const

export const CSW_OWNER_MESSAGE_TYPES = {
  CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
} as const

/**
 * Wrap a raw 65-byte secp256k1 owner signature for Permit2 when the token owner is a CSW.
 * Must use Solidity struct/tuple encoding — flat `(uint256, bytes)` makes CSW `isValidSignature` revert.
 * Mirrors server `wrapCswOwnerSignature` in `server/_lib/wallet/cswOwnerSignature.ts`.
 */
export function wrapCswOwnerSignature(ownerSignature: Hex, ownerIndex: number = 0): Hex {
  if (!ownerSignature.startsWith('0x') || ownerSignature.length !== 132) {
    throw new Error(
      'Permit2 signature must be a 65-byte ECDSA signature before CSW wrapping. Retry the wallet signature step.',
    )
  }
  const wrapped = encodeAbiParameters(SIGNATURE_WRAPPER_TUPLE, [
    { ownerIndex: BigInt(ownerIndex), signatureData: ownerSignature },
  ])
  const parsed = parseCoinbaseSignatureWrapper(wrapped)
  if (!parsed || parsed.ownerIndex !== ownerIndex) {
    throw new Error('Failed to encode CSW owner signature wrapper for Permit2.')
  }
  return wrapped
}

export async function readCswReplaySafeHash(params: {
  publicClient: PublicClient
  smartWallet: Address
  innerHash: Hex
}): Promise<Hex> {
  return (await params.publicClient.readContract({
    address: params.smartWallet,
    abi: CSW_REPLAY_SAFE_HASH_ABI,
    functionName: 'replaySafeHash',
    args: [params.innerHash],
  })) as Hex
}

type CswOwnerWalletClient = {
  signTypedData?: (args: Record<string, unknown>) => Promise<Hex | string>
  signMessage?: (args: Record<string, unknown>) => Promise<Hex | string>
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Produce ERC-1271 SignatureWrapper bytes for a CSW owner authorizing `innerTypedDataDigest`
 * (e.g. Permit2 PermitSingle hash). CSW `isValidSignature` applies `replaySafeHash` before ecrecover.
 */
export async function signOwnerSignatureForCswErc1271(params: {
  innerTypedDataDigest: Hex
  smartWallet: Address
  ownerIndex: number
  signerAddress: Address
  walletClient: CswOwnerWalletClient
  publicClient: PublicClient
  chainId?: number
}): Promise<Hex> {
  const chainId = params.chainId ?? base.id
  const cswDomain = {
    ...CSW_OWNER_EIP712_DOMAIN,
    chainId,
    verifyingContract: params.smartWallet,
  }

  if (typeof params.walletClient.signTypedData === 'function') {
    try {
      const ownerSig = (await params.walletClient.signTypedData({
        account: params.signerAddress,
        domain: cswDomain,
        types: CSW_OWNER_MESSAGE_TYPES,
        primaryType: 'CoinbaseSmartWalletMessage',
        message: { hash: params.innerTypedDataDigest },
      })) as Hex
      return wrapCswOwnerSignature(ownerSig, params.ownerIndex)
    } catch {
      // Fall through to replaySafeHash + raw digest signing.
    }
  }

  const replaySafeHash = await readCswReplaySafeHash({
    publicClient: params.publicClient,
    smartWallet: params.smartWallet,
    innerHash: params.innerTypedDataDigest,
  })
  const ownerSig = await signRawEcdsaDigest({
    digest: replaySafeHash,
    signerAddress: params.signerAddress,
    walletClient: params.walletClient,
    label: 'cswErc1271',
  })
  return wrapCswOwnerSignature(ownerSig, params.ownerIndex)
}

export async function assertCswAcceptsErc1271Signature(params: {
  publicClient: PublicClient
  smartWallet: Address
  digest: Hex
  signature: Hex
}): Promise<void> {
  const magic = (await params.publicClient.readContract({
    address: params.smartWallet,
    abi: [
      {
        name: 'isValidSignature',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'hash', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
        outputs: [{ type: 'bytes4' }],
      },
    ],
    functionName: 'isValidSignature',
    args: [params.digest, params.signature],
  })) as Hex

  if (magic?.toLowerCase() !== EIP1271_MAGIC) {
    throw new Error(
      'Smart wallet rejected the Permit2 signature. Refresh the quote, sign again, and retry the swap.',
    )
  }
}
