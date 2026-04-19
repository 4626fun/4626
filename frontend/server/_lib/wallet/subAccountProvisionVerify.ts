/**
 * Shared verification pipeline for sub-account provisioning.
 *
 * Used by both the SIWE-gated /api/arch-b/sub-account/provision/commit endpoint
 * and the admin /api/admin/arch-b/sub-account/provision endpoint. The only
 * difference between the two is how the caller is authenticated and whether
 * Privy delegation is enforced (admin can override with a warning log).
 */

import type { Address, Hex, PublicClient } from 'viem'
import { createPublicClient, http, recoverTypedDataAddress } from 'viem'
import { base } from 'viem/chains'

import type { SpendPermissionPayload } from './commandIssuerContext.js'
import {
  SPEND_PERMISSION_EIP712_DOMAIN,
  SPEND_PERMISSION_TYPES,
  hashSpendPermission,
} from './spendPermission.js'
import { computeSubAccountAddress } from './subAccountAddress.js'
import { isCswOwner } from './cswOwner.js'
import { fetchPrivyWalletFull } from './privyWalletApi.js'
import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

export const CHAIN_ID_BASE = 8453

export const MAX_PER_TX_CAP_WEI = 1_000_000_000_000_000_000n // 1 ETH
export const MAX_DAILY_CAP_WEI = 10_000_000_000_000_000_000n // 10 ETH

const ERC1271_MAGIC: Hex = '0x1626ba7e'
const ERC1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes4' }],
  },
] as const

export type SubAccountVerifyInput = {
  profileId: number
  ownerEoa: Address
  parentCsw: Address
  permission: SpendPermissionPayload
  signature: Hex
  perTxCapWei: bigint
  dailyCapWei: bigint
}

export type SubAccountVerifyOk = {
  ok: true
  subAccountAddress: Address
  permissionHash: Hex
}

export type SubAccountVerifyErrCode =
  | 'invalid_hash'
  | 'invalid_signature'
  | 'signer_not_owner'
  | 'invalid_spender'
  | 'invalid_caps'
  | 'permission_expired'
  | 'signature_verification_failed'

export type SubAccountVerifyErr = {
  ok: false
  code: SubAccountVerifyErrCode
  message?: string
}

export function getBasePublicClient(): PublicClient {
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').split(',')[0].trim()
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 10_000 }) }) as PublicClient
}

/**
 * Confirm the supplied signature was produced by an authorized signer of the
 * parent CSW over the given EIP-712 permission payload.
 *
 *  1. EOA path: recover address via `recoverTypedDataAddress` and check it is
 *     currently an owner of `permission.account` via the CSW's owner scan.
 *  2. ERC-1271 path: fall back to calling `isValidSignature(hash, signature)`
 *     on the parent CSW. Accept the standard magic value `0x1626ba7e`.
 *
 * Either path is sufficient; we try EOA first because it is cheap.
 */
export async function verifyParentCswSignature(args: {
  publicClient: PublicClient
  parentCsw: Address
  permission: SpendPermissionPayload
  signature: Hex
  permissionHash: Hex
}): Promise<{ ok: true } | { ok: false; code: 'invalid_signature' | 'signer_not_owner' | 'signature_verification_failed'; message?: string }> {
  // EOA path
  try {
    const recovered = await recoverTypedDataAddress({
      domain: SPEND_PERMISSION_EIP712_DOMAIN(CHAIN_ID_BASE),
      types: SPEND_PERMISSION_TYPES,
      primaryType: 'SpendPermission',
      message: {
        account: args.permission.account,
        spender: args.permission.spender,
        token: args.permission.token,
        allowance: BigInt(args.permission.allowance),
        period: args.permission.period,
        start: args.permission.start,
        end: args.permission.end,
        salt: BigInt(args.permission.salt),
        extraData: args.permission.extraData as Hex,
      },
      signature: args.signature,
    })
    const isOwner = await isCswOwner(recovered, args.parentCsw)
    if (isOwner) return { ok: true }
  } catch (err) {
    logger.warn('[arch-b/subacct/verify] EOA path failed; falling back to 1271', {
      parentCsw: args.parentCsw,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // ERC-1271 path
  try {
    const result = (await args.publicClient.readContract({
      address: args.parentCsw,
      abi: ERC1271_ABI,
      functionName: 'isValidSignature',
      args: [args.permissionHash, args.signature],
    })) as Hex
    if (String(result).toLowerCase() === ERC1271_MAGIC.toLowerCase()) {
      return { ok: true }
    }
    return { ok: false, code: 'signer_not_owner' }
  } catch (err) {
    return {
      ok: false,
      code: 'signature_verification_failed',
      message: err instanceof Error ? err.message.slice(0, 200) : undefined,
    }
  }
}

/**
 * Full verification pipeline (hash match, signature, spender correctness, caps,
 * expiry). Returns a typed ok/err result; callers handle HTTP mapping.
 * Does NOT enforce Privy delegation — callers decide.
 */
export async function verifySubAccountProvision(
  args: SubAccountVerifyInput & { publicClient: PublicClient },
): Promise<SubAccountVerifyOk | SubAccountVerifyErr> {
  const { permission, signature, publicClient, parentCsw, ownerEoa, profileId } = args

  // Hash recompute
  const permissionHash = hashSpendPermission(permission, CHAIN_ID_BASE)

  // Caps bounds
  if (args.perTxCapWei <= 0n || args.dailyCapWei <= 0n || args.perTxCapWei > args.dailyCapWei) {
    return { ok: false, code: 'invalid_caps', message: 'per-tx/daily caps out of bounds' }
  }
  if (args.perTxCapWei > MAX_PER_TX_CAP_WEI || args.dailyCapWei > MAX_DAILY_CAP_WEI) {
    return { ok: false, code: 'invalid_caps', message: 'caps exceed server ceiling' }
  }

  // Expiry
  const nowSec = Math.floor(Date.now() / 1000)
  if (permission.end <= nowSec) {
    return { ok: false, code: 'permission_expired' }
  }

  // Spender check
  const expectedSubAccount = await computeSubAccountAddress({
    publicClient: publicClient as unknown as Parameters<typeof computeSubAccountAddress>[0]['publicClient'],
    parentCsw,
    ownerEoa,
    profileId,
  })
  if (expectedSubAccount.toLowerCase() !== permission.spender.toLowerCase()) {
    return { ok: false, code: 'invalid_spender' }
  }
  if (permission.account.toLowerCase() !== parentCsw.toLowerCase()) {
    return { ok: false, code: 'invalid_spender', message: 'permission.account != parent' }
  }

  // Signature
  const sigResult = await verifyParentCswSignature({
    publicClient,
    parentCsw,
    permission,
    signature,
    permissionHash,
  })
  if (!sigResult.ok) {
    return { ok: false, code: sigResult.code, message: sigResult.message }
  }

  return { ok: true, subAccountAddress: expectedSubAccount, permissionHash }
}

/**
 * Verify Privy delegation: the owner EOA's Privy wallet must include the
 * Architecture B signer quorum in its `additional_signers`. Returns `missing`
 * when delegation is not present so callers can either reject (user endpoint)
 * or warn-and-continue (admin endpoint).
 */
export async function checkPrivyDelegation(args: {
  privyOwnerWalletId: string
  quorumId: string
}): Promise<{ present: true } | { present: false; actualSigners: string[] }> {
  const walletFull = await fetchPrivyWalletFull(args.privyOwnerWalletId)
  if (!walletFull) return { present: false, actualSigners: [] }
  const actualSigners = walletFull.additional_signers
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      const v = entry.signer_id ?? entry.id ?? ''
      return typeof v === 'string' && v.trim() ? v.trim() : ''
    })
    .filter((s): s is string => Boolean(s))
  if (actualSigners.includes(args.quorumId)) return { present: true }
  return { present: false, actualSigners }
}
