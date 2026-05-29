/**
 * Architecture B Phase 5 — SpendPermission encoding helpers.
 *
 * The SpendPermissionManager is a singleton on Base mainnet that records
 * parent→spender allowances for CSW sub-accounts. On each sub-account UserOp
 * that needs funding from the parent, we prepend a `spend(permission, amount)`
 * call to the multicall. On the very first call (before `approveWithSignature`
 * has landed on-chain), we also prepend `approveWithSignature(permission, sig)`.
 *
 * This module is a pure encoder:
 * - No env reads.
 * - No RPC calls (except the optional reader helper `isSpendPermissionApproved`).
 * - Inputs come from `command_issuer_execution_context.spend_permission_*`,
 *   which are server-side-trusted.
 */

import type { Address, Hex, PublicClient } from 'viem'
import { encodeFunctionData, hashTypedData } from 'viem'

// Canonical implementation of CommandIssuerContext / SpendPermissionPayload now lives
// in @4626/server-core (commandIssuerContext.ts). Local file is a thin transitional re-export.
import type { SpendPermissionPayload } from '../../../packages/server-core/src/identity.js'
import type { CoinbaseSmartWalletCall } from './privyCoinbaseSmartWallet.js'

/** SpendPermissionManager singleton, deployed on Base mainnet. */
export const SPEND_PERMISSION_MANAGER_BASE: Address =
  '0xf85210B21cC50302F477BA56686d2019dC9b67Ad'

/**
 * Sentinel address for native ETH in the SpendPermissionManager spec.
 * Matches Coinbase's canonical constant.
 */
export const NATIVE_TOKEN_SENTINEL: Address =
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const SPEND_PERMISSION_MANAGER_NAME = 'Spend Permission Manager'
export const SPEND_PERMISSION_MANAGER_VERSION = '1'

export const SPEND_PERMISSION_TYPES = {
  SpendPermission: [
    { name: 'account', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'allowance', type: 'uint160' },
    { name: 'period', type: 'uint48' },
    { name: 'start', type: 'uint48' },
    { name: 'end', type: 'uint48' },
    { name: 'salt', type: 'uint256' },
    { name: 'extraData', type: 'bytes' },
  ],
} as const

export function SPEND_PERMISSION_EIP712_DOMAIN(chainId: number): {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
} {
  return {
    name: SPEND_PERMISSION_MANAGER_NAME,
    version: SPEND_PERMISSION_MANAGER_VERSION,
    chainId,
    verifyingContract: SPEND_PERMISSION_MANAGER_BASE,
  }
}

/**
 * Minimal ABI subset needed by the submitter and reader helper.
 * The manager's `SpendPermission` tuple must match `SPEND_PERMISSION_TYPES`.
 */
const SPEND_PERMISSION_STRUCT_TUPLE = {
  type: 'tuple',
  components: [
    { name: 'account', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'allowance', type: 'uint160' },
    { name: 'period', type: 'uint48' },
    { name: 'start', type: 'uint48' },
    { name: 'end', type: 'uint48' },
    { name: 'salt', type: 'uint256' },
    { name: 'extraData', type: 'bytes' },
  ],
} as const

export const spendPermissionManagerAbi = [
  {
    type: 'function',
    name: 'approveWithSignature',
    stateMutability: 'nonpayable',
    inputs: [
      { ...SPEND_PERMISSION_STRUCT_TUPLE, name: 'permission' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'spend',
    stateMutability: 'nonpayable',
    inputs: [
      { ...SPEND_PERMISSION_STRUCT_TUPLE, name: 'permission' },
      { name: 'value', type: 'uint160' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isApproved',
    stateMutability: 'view',
    inputs: [{ ...SPEND_PERMISSION_STRUCT_TUPLE, name: 'permission' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getCurrentPeriodSpend',
    stateMutability: 'view',
    inputs: [{ ...SPEND_PERMISSION_STRUCT_TUPLE, name: 'permission' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'start', type: 'uint48' },
          { name: 'end', type: 'uint48' },
          { name: 'spend', type: 'uint160' },
        ],
      },
    ],
  },
] as const

/**
 * Convert JSON-friendly SpendPermissionPayload into the viem-friendly tuple
 * form expected by `encodeFunctionData` and `hashTypedData`. `allowance` and
 * `salt` are bigint for on-chain encoding; `period`/`start`/`end` are numbers
 * (uint48).
 */
function toOnchainPermission(permission: SpendPermissionPayload): {
  account: Address
  spender: Address
  token: Address
  allowance: bigint
  period: number
  start: number
  end: number
  salt: bigint
  extraData: Hex
} {
  return {
    account: permission.account,
    spender: permission.spender,
    token: permission.token,
    allowance: BigInt(permission.allowance),
    period: permission.period,
    start: permission.start,
    end: permission.end,
    salt: BigInt(permission.salt),
    extraData: permission.extraData as Hex,
  }
}

/** EIP-712 hash for dedupe / on-chain identity. */
export function hashSpendPermission(
  permission: SpendPermissionPayload,
  chainId: number,
): Hex {
  const onchain = toOnchainPermission(permission)
  return hashTypedData({
    domain: SPEND_PERMISSION_EIP712_DOMAIN(chainId),
    types: SPEND_PERMISSION_TYPES,
    primaryType: 'SpendPermission',
    message: onchain,
  })
}

/**
 * Build the SpendPermissionManager calls to prepend to a sub-account UserOp.
 * When the permission has not yet been approved on-chain, we first call
 * `approveWithSignature(permission, signature)`, then `spend(permission,
 * amount)`. The manager short-circuits `approveWithSignature` when the
 * permission is already approved, so including it is harmless — we rely on
 * this property when `isSpendPermissionApproved` fails-open (returns false).
 *
 * The `spend(...)` call is skipped when `amountWei === 0n` because
 * `SpendPermissionManager.spend` reverts with `ZeroValue` on a zero amount.
 * ERC-20 sends, sells, trend-reserve ops — any userop with no native ETH
 * value — must not prepend a `spend(0)` call. `approveWithSignature` is still
 * emitted when not approved so first-time sub-accounts can register the
 * permission even when the triggering op carries zero value.
 */
export function buildSpendPermissionCalls(args: {
  permission: SpendPermissionPayload
  signature: Hex
  amountWei: bigint
  isApprovedOnChain: boolean
}): CoinbaseSmartWalletCall[] {
  const onchain = toOnchainPermission(args.permission)
  const calls: CoinbaseSmartWalletCall[] = []
  if (!args.isApprovedOnChain) {
    calls.push({
      to: SPEND_PERMISSION_MANAGER_BASE,
      value: 0n,
      data: encodeFunctionData({
        abi: spendPermissionManagerAbi,
        functionName: 'approveWithSignature',
        args: [onchain, args.signature],
      }),
    })
  }
  if (args.amountWei > 0n) {
    calls.push({
      to: SPEND_PERMISSION_MANAGER_BASE,
      value: 0n,
      data: encodeFunctionData({
        abi: spendPermissionManagerAbi,
        functionName: 'spend',
        args: [onchain, args.amountWei],
      }),
    })
  }
  return calls
}

/**
 * Back-compat single-call encoder used by earlier Phase 5 drafts. Prefer
 * `buildSpendPermissionCalls` for new callers — it handles the
 * approve-first-then-spend transition atomically.
 */
export function encodeSpendPermissionSpendCall(args: {
  manager: Address
  permission: SpendPermissionPayload
  signature: Hex
  amountWei: bigint
}): CoinbaseSmartWalletCall {
  const onchain = toOnchainPermission(args.permission)
  return {
    to: args.manager,
    value: 0n,
    data: encodeFunctionData({
      abi: spendPermissionManagerAbi,
      functionName: 'spend',
      args: [onchain, args.amountWei],
    }),
  }
}

/**
 * Read-only check: has the manager recorded approval for this permission?
 * Callers should fail-open: on RPC error, assume not approved and include the
 * `approveWithSignature` call. The manager short-circuits if it's already
 * approved, so this is safe.
 */
export async function isSpendPermissionApproved(args: {
  publicClient: PublicClient
  permission: SpendPermissionPayload
}): Promise<boolean> {
  const onchain = toOnchainPermission(args.permission)
  const result = await args.publicClient.readContract({
    address: SPEND_PERMISSION_MANAGER_BASE,
    abi: spendPermissionManagerAbi,
    functionName: 'isApproved',
    args: [onchain],
  })
  return Boolean(result)
}
