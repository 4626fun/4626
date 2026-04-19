/**
 * Architecture B Phase 5 — Coinbase Smart Wallet sub-account address derivation.
 *
 * The CoinbaseSmartWalletFactory on Base mainnet deploys CSW instances (including
 * sub-accounts) via CREATE2 at deterministic addresses. We never deploy eagerly:
 * the first UserOp from the sub-account carries initCode, so the address is
 * counterfactual until that point.
 *
 * To avoid reimplementing CREATE2 derivation in TS (and staying aligned with
 * any future factory changes), we call the factory's on-chain `getAddress` view
 * function directly.
 *
 * Owner layout: `[parentCsw, ownerEoa]`. Parent at index 0, Privy-managed
 * signer at index 1. This matches viem's `toCoinbaseSmartAccount` layout.
 * Per viem convention, each owner is ABI-encoded as 32 bytes (left-padded for
 * EOAs) in the `bytes[] owners` input.
 */

import type { Address, Hex, PublicClient } from 'viem'
import { encodeAbiParameters, keccak256, toHex } from 'viem'

/** Coinbase Smart Wallet v1 factory on Base mainnet. */
export const CSW_FACTORY_BASE: Address = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a'

const CSW_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAddress',
    stateMutability: 'view',
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'createAccount',
    stateMutability: 'payable',
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

/**
 * Deterministic salt for a profile's sub-account. Stable across re-provisioning
 * attempts so an interrupted flow resumes to the same counterfactual address.
 */
export function computeSubAccountSalt(params: {
  profileId: number
  parentCsw: Address
}): Hex {
  const normalized = params.parentCsw.toLowerCase()
  const preimage = `4626:subacct:v1:${params.profileId}:${normalized}`
  return keccak256(toHex(preimage))
}

/**
 * Encode an owner EOA/contract address as the `bytes` entry expected by the CSW
 * factory's `bytes[] owners` input — a 32-byte ABI-encoded `address`.
 */
function encodeOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner])
}

/**
 * Compute the counterfactual CSW sub-account address via the factory's
 * `getAddress(owners, nonce)` view call. The factory derives the deploy
 * address via CREATE2 from its own address + the salt (nonce) + the init
 * bytecode (implementation + `initialize(owners)`); calling the view is the
 * safest way to get the exact value that the first-op initCode will produce.
 */
export async function computeSubAccountAddress(params: {
  publicClient: PublicClient
  parentCsw: Address
  ownerEoa: Address
  profileId: number
}): Promise<Address> {
  const owners: Hex[] = [encodeOwnerBytes(params.parentCsw), encodeOwnerBytes(params.ownerEoa)]
  const salt = computeSubAccountSalt({ profileId: params.profileId, parentCsw: params.parentCsw })
  const nonce = BigInt(salt)
  const address = (await params.publicClient.readContract({
    address: CSW_FACTORY_BASE,
    abi: CSW_FACTORY_ABI,
    functionName: 'getAddress',
    args: [owners, nonce],
  })) as Address
  return address.toLowerCase() as Address
}

export const __internal = { CSW_FACTORY_ABI, encodeOwnerBytes }
