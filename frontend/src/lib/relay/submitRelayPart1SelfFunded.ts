import {
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  hashMessage,
  hashTypedData,
  recoverAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import {
  createBundlerClient,
  entryPoint06Address,
  getUserOperationHash,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction'

import { getWalletErrorMessage } from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'
import { resolveRelayPart1UserOpGasReserveWei } from '@/lib/relay/relayPart1GasReserve'
import { buildRelayBundlerHttpTransport } from '@/lib/relay/relayBundlerTransport'
import {
  assertRelayPart1LandedSelfFunded,
  assertRelayPart1TxHashSelfFunded,
  resolveRelayPart1DepositTxHash,
} from '@/lib/relay/resolveRelayPart1DepositTxHash'
import { ENTRY_POINT_V06_BASE, CSW_OWNER_READ_ABI } from '@/lib/wallet/cswOwnerAbi'
import { waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  buildCswUserOpTypedDataPayload,
  buildSendPreparedCallsSignaturePayload,
  normalizePreparedCallValueToHex,
  signCswUserOpHashViaTypedDataV4,
  type PreparedCallsSignaturePayloadMode,
} from '@/lib/wallet/onboardingWalletPrepared'
import {
  classifyWebAuthnOwnerSignature,
  getUserOpHashWithoutChainIdLocal,
  parseCoinbaseSignatureWrapper,
  preflightOwnerKeyMismatch,
  unwrapDoubleHexEncodedHash,
  type V06UserOpFields,
} from '@/lib/wallet/onboardingWalletReplayable'

export type SelfAuthOwnerDiscovery = {
  ownerIndex: number | null
  ownerSignerAddress: `0x${string}` | null
  /** Base App session-key owner at owner[2] — uses inner_secp256k1 prepared-calls payload. */
  sessionKeyOwner: boolean
}

/** Base App session-key lane used for May 5 owner-install Part 1 (4626.base.eth). */
export const SELF_AUTH_SESSION_KEY_OWNER_INDEX = 2

/** Mistaken owner added in a prior bad install — never route Part 1 through this slot. */
export const MISTAKEN_OWNER_INDEX = 3

export function isSelfAuthSessionKeyOwnerContext(params: {
  sessionKeyOwner?: boolean
  ownerIndex?: number | null
}): boolean {
  return (
    params.sessionKeyOwner === true ||
    params.ownerIndex === SELF_AUTH_SESSION_KEY_OWNER_INDEX
  )
}

export function assertOwnerIndexAllowedForSelfAuthPart1(params: {
  ownerIndex: number | null
  appendEvent: (row: string) => void
}): void {
  if (params.ownerIndex === MISTAKEN_OWNER_INDEX) {
    params.appendEvent('relay_part1:reject_owner_index_3=1')
    throw new Error(
      'This smart wallet still has a mistaken owner in slot 3 from an earlier attempt. Remove that owner in Accounts or Base App, then retry Enable 4626 signing.',
    )
  }
}

/** Base App self-auth wraps personal_sign payloads with the CSW owner slot it used. */
export function parseSelfAuthOwnerIndexFromSignature(signature: Hex): number | null {
  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (
    wrapped?.ownerIndex != null &&
    Number.isInteger(wrapped.ownerIndex) &&
    wrapped.ownerIndex >= 0
  ) {
    return wrapped.ownerIndex
  }
  return null
}

const PASSKEY_SIGNATURE_REJECTED_ERROR =
  'passkey signature rejected for session-key Part 1'

/** Inner ECDSA recovers to a Base App session key that is not in the CSW owner array. */
export const BASE_APP_SUBSTITUTED_SIGNER_ERROR =
  'base app substituted signer not in csw owner array'

export type SelfAuthValidateUserOpPreflight = {
  ok: boolean
  recovered: `0x${string}` | null
  ownerAddress: `0x${string}` | null
  ownerIndex: number | null
}

/** WebAuthn / passkey wrapper (owner slot 0) — invalid for session-key Relay Part 1. */
export function isSelfAuthPasskeyOwnerSignature(signature: Hex): boolean {
  const classification = classifyWebAuthnOwnerSignature(signature)
  if (classification.ok) return true
  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (wrapped?.ownerIndex === 0 && hexByteLength(wrapped.signatureData) !== 65) {
    return true
  }
  return false
}

/** Compact ECDSA wrapper for session-key owner slot (default owner[2]). */
export function isSelfAuthSessionKeyEcdsaSignature(
  signature: Hex,
  expectedOwnerIndex = SELF_AUTH_SESSION_KEY_OWNER_INDEX,
): boolean {
  if (isSelfAuthPasskeyOwnerSignature(signature)) return false
  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (wrapped && hexByteLength(wrapped.signatureData) === 65) {
    return wrapped.ownerIndex === expectedOwnerIndex
  }
  return hexByteLength(signature) === 65
}

export function shouldRejectSelfAuthSignatureForSessionKeyLane(params: {
  sessionKeyOwner: boolean
  signature: Hex
  parsedOwnerIndex: number | null
  ownerDiscovery?: SelfAuthOwnerDiscovery
}): boolean {
  if (
    !isSelfAuthSessionKeyOwnerContext({
      sessionKeyOwner: params.sessionKeyOwner,
      ownerIndex: params.parsedOwnerIndex ?? params.ownerDiscovery?.ownerIndex ?? null,
    })
  ) {
    return false
  }
  if (isSelfAuthPasskeyOwnerSignature(params.signature)) return true
  const ownerIndex =
    parseSelfAuthOwnerIndexFromSignature(params.signature) ?? params.parsedOwnerIndex
  return ownerIndex === 0
}

/**
 * CSW EIP-712 replay-safe digest for a stripped UserOp — sign this for EOA owners
 * (Coinbase guidance: not the raw EntryPoint userOpHash). Inner secp256k1 is over this hash.
 */
export function computeSelfAuthReplaySafeHash(params: {
  fundingCsw: `0x${string}`
  chainId: number
  userOpHash: Hex
}): Hex {
  return hashTypedData(
    buildCswUserOpTypedDataPayload({
      smartWallet: params.fundingCsw,
      chainId: params.chainId,
      userOpHash: params.userOpHash,
    }),
  )
}

export function isSelfAuthReplaySafeSignHashMode(mode: string): boolean {
  return mode.startsWith('csw_replay_safe')
}

/** ABI-encoded Coinbase Smart Wallet owner signature wrapper `(ownerIndex, bytes sig)`. */
export function wrapBareSelfAuthOwnerSignature(signature: Hex, ownerIndex: number): Hex {
  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (wrapped && hexByteLength(wrapped.signatureData) === 65) {
    return signature
  }
  if (hexByteLength(signature) !== 65) {
    return signature
  }
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), signature],
  ) as Hex
}

export async function resolveCswOwnerIndexForEoaAddress(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  eoaAddress: `0x${string}`
  maxScan?: number
}): Promise<number | null> {
  const target = getAddress(params.eoaAddress).toLowerCase()
  let ownerCount = params.maxScan ?? 8
  try {
    const count = await params.publicClient.readContract({
      address: params.fundingCsw,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'ownerCount',
      args: [],
    })
    if (typeof count === 'bigint' && count > 0n) {
      ownerCount = Math.min(Number(count), params.maxScan ?? 8)
    }
  } catch {
    /* scan fallback */
  }

  for (let index = 0; index < ownerCount; index += 1) {
    const ownerAddress = await readCswOwnerAddressAtIndex({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      ownerIndex: index,
    })
    if (ownerAddress && ownerAddress.toLowerCase() === target) {
      return index
    }
  }
  return null
}

export function listSelfAuthPreparedCallsSignaturePayloadModes(params: {
  parsedOwnerIndex: number | null
  sessionKeyOwner?: boolean
}): PreparedCallsSignaturePayloadMode[] {
  if (params.sessionKeyOwner || params.parsedOwnerIndex === SELF_AUTH_SESSION_KEY_OWNER_INDEX) {
    return ['inner_secp256k1', 'full_wrapper_secp256k1', 'auto']
  }
  return ['auto', 'full_wrapper_secp256k1', 'inner_secp256k1']
}

function recordSelfAuthOwnerDiscovery(params: {
  discovery: SelfAuthOwnerDiscovery
  ownerIndex: number | null
  ownerSignerAddress: `0x${string}` | null
  sessionKeyOwner?: boolean
  appendEvent: (row: string) => void
}): void {
  if (params.sessionKeyOwner) {
    params.discovery.sessionKeyOwner = true
    params.appendEvent('relay_part1:discovered_session_key_owner=1')
  }
  if (params.ownerIndex != null && Number.isInteger(params.ownerIndex) && params.ownerIndex >= 0) {
    params.discovery.ownerIndex = params.ownerIndex
    params.appendEvent(`relay_part1:discovered_owner_index=${params.ownerIndex}`)
  }
  if (params.ownerSignerAddress) {
    params.discovery.ownerSignerAddress = params.ownerSignerAddress
    params.appendEvent(`relay_part1:discovered_owner_signer=${params.ownerSignerAddress}`)
  }
}

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

const ENTRY_POINT_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CSW_IS_VALID_SIGNATURE_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

const ERC1271_MAGIC_VALUE = '0x1626ba7e' as const

export function readPreparedUserOpPaymasterAndData(userOp: unknown): Hex | null {
  if (!userOp || typeof userOp !== 'object') return null
  const record = userOp as Record<string, unknown>
  const raw = record.paymasterAndData ?? record.paymaster_and_data
  if (typeof raw !== 'string' || !raw.startsWith('0x')) return null
  return raw as Hex
}

/**
 * Mirrors EntryPoint v0.6 `_copyUserOpToMemory`: paymaster is set when
 * `paymasterAndData.length > 0` (first 20 bytes = paymaster address).
 */
export function parseEntryPointPaymasterAddress(paymasterAndData: Hex | null | undefined): Address | null {
  if (!paymasterAndData || paymasterAndData === '0x') return null
  const byteLength = (paymasterAndData.length - 2) / 2
  if (byteLength === 0) return null
  if (byteLength < 20) return null
  return getAddress(`0x${paymasterAndData.slice(2, 42)}`)
}

export function userOpHasPaymaster(userOp: unknown): boolean {
  return parseEntryPointPaymasterAddress(readPreparedUserOpPaymasterAndData(userOp)) != null
}

function parseHexBigInt(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0n
    return trimmed.startsWith('0x') ? BigInt(trimmed) : BigInt(trimmed)
  }
  throw new Error(`Prepared userOp field ${label} is missing or invalid.`)
}

function parseHexData(value: unknown, label: string, fallback?: `0x${string}`): `0x${string}` {
  if (typeof value === 'string' && value.startsWith('0x')) return value as `0x${string}`
  if (fallback !== undefined) return fallback
  throw new Error(`Prepared userOp field ${label} is missing or invalid.`)
}

/** Normalize wallet_prepareCalls `userOp` into typed v0.6 fields. */
export function parseWalletPreparedUserOpV06(raw: unknown): V06UserOpFields {
  if (!raw || typeof raw !== 'object') {
    throw new Error('wallet_prepareCalls returned an invalid userOp payload.')
  }
  const record = raw as Record<string, unknown>
  return {
    sender: getAddress(String(record.sender)),
    nonce: parseHexBigInt(record.nonce, 'nonce'),
    initCode: parseHexData(record.initCode ?? record.init_code, 'initCode', '0x'),
    callData: parseHexData(record.callData ?? record.call_data, 'callData'),
    callGasLimit: parseHexBigInt(record.callGasLimit ?? record.call_gas_limit, 'callGasLimit'),
    verificationGasLimit: parseHexBigInt(
      record.verificationGasLimit ?? record.verification_gas_limit,
      'verificationGasLimit',
    ),
    preVerificationGas: parseHexBigInt(
      record.preVerificationGas ?? record.pre_verification_gas,
      'preVerificationGas',
    ),
    maxFeePerGas: parseHexBigInt(record.maxFeePerGas ?? record.max_fee_per_gas, 'maxFeePerGas'),
    maxPriorityFeePerGas: parseHexBigInt(
      record.maxPriorityFeePerGas ?? record.max_priority_fee_per_gas,
      'maxPriorityFeePerGas',
    ),
    paymasterAndData: parseHexData(
      record.paymasterAndData ?? record.paymaster_and_data,
      'paymasterAndData',
      '0x',
    ),
    signature: parseHexData(record.signature, 'signature', '0x'),
  }
}

export function stripUserOpPaymaster(op: V06UserOpFields): V06UserOpFields {
  return { ...op, paymasterAndData: '0x', signature: '0x' }
}

function serializeUserOpForPreparedCallsSend(op: V06UserOpFields): Record<string, string> {
  return {
    sender: op.sender,
    nonce: `0x${op.nonce.toString(16)}`,
    initCode: op.initCode,
    callData: op.callData,
    callGasLimit: `0x${op.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${op.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${op.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${op.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${op.maxPriorityFeePerGas.toString(16)}`,
    paymasterAndData: op.paymasterAndData,
    signature: op.signature,
  }
}

/** Preserve Base App field encoding when resubmitting a prepared userOp. */
export function stripRawWalletPreparedUserOp(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const record = { ...(raw as Record<string, unknown>) }
  // Base App may return snake_case or camelCase — zero every alias so bundlers
  // cannot read paymaster bytes from a field we did not strip.
  for (const key of ['paymasterAndData', 'paymaster_and_data', 'signature'] as const) {
    record[key] = '0x'
  }
  return record
}

function computeUserOpHashWithChainId(op: V06UserOpFields, chainId: number): `0x${string}` {
  return getUserOperationHash({
    chainId,
    entryPointAddress: entryPoint06Address,
    entryPointVersion: '0.6',
    userOperation: {
      sender: op.sender,
      nonce: op.nonce,
      initCode: op.initCode,
      callData: op.callData,
      callGasLimit: op.callGasLimit,
      verificationGasLimit: op.verificationGasLimit,
      preVerificationGas: op.preVerificationGas,
      maxFeePerGas: op.maxFeePerGas,
      maxPriorityFeePerGas: op.maxPriorityFeePerGas,
      paymasterAndData: op.paymasterAndData,
      signature: op.signature,
    },
  })
}

/**
 * Base App signs `signatureRequest.hash` for the prepared userOp. When we strip
 * paymasterAndData, recompute the digest with the same hash domain prepare used.
 */
export function resolveSelfFundedSignHashAfterPaymasterStrip(params: {
  preparedUserOp: unknown
  signatureRequestHash: Hex
  chainId: number
}): { hash: Hex; mode: string } {
  const parsed = parseWalletPreparedUserOpV06(params.preparedUserOp)
  const requestHash = unwrapDoubleHexEncodedHash(params.signatureRequestHash)
  const stripped = stripUserOpPaymaster(parsed)

  const withChainIdPrepared = computeUserOpHashWithChainId(parsed, params.chainId)
  if (withChainIdPrepared.toLowerCase() === requestHash.toLowerCase()) {
    return {
      hash: computeUserOpHashWithChainId(stripped, params.chainId),
      mode: 'entrypoint_v06_chain',
    }
  }

  const withoutChainIdPrepared = getUserOpHashWithoutChainIdLocal(parsed, ENTRY_POINT_V06_BASE)
  if (withoutChainIdPrepared.toLowerCase() === requestHash.toLowerCase()) {
    return {
      hash: getUserOpHashWithoutChainIdLocal(stripped, ENTRY_POINT_V06_BASE),
      mode: 'entrypoint_v06_no_chain',
    }
  }

  return {
    hash: computeUserOpHashWithChainId(stripped, params.chainId),
    mode: 'entrypoint_v06_chain_unmatched_prepare_hash',
  }
}

/** Ordered hash candidates for self-funded submit after paymaster strip. */
export function listSelfAuthBundlerSignHashCandidates(params: {
  preparedUserOp: unknown
  signatureRequestHash: Hex
  chainId: number
  sessionKeyOwner?: boolean
  fundingCsw?: `0x${string}`
  /** When true (default for session-key / funding CSW), try CSW replaySafe hash first. */
  preferReplaySafeHash?: boolean
}): Array<{ hash: Hex; mode: string }> {
  const primary = resolveSelfFundedSignHashAfterPaymasterStrip(params)
  const parsed = parseWalletPreparedUserOpV06(params.preparedUserOp)
  const stripped = stripUserOpPaymaster(parsed)
  const withChainId = computeUserOpHashWithChainId(stripped, params.chainId)
  const withoutChainId = getUserOpHashWithoutChainIdLocal(stripped, ENTRY_POINT_V06_BASE)
  const replaySafeHash = params.fundingCsw
    ? computeSelfAuthReplaySafeHash({
        fundingCsw: params.fundingCsw,
        chainId: params.chainId,
        userOpHash: withChainId,
      })
    : null
  const preferReplaySafe =
    params.preferReplaySafeHash ?? (!params.sessionKeyOwner && Boolean(params.fundingCsw))

  const candidates: Array<{ hash: Hex; mode: string }> = []
  const pushUnique = (entry: { hash: Hex; mode: string }) => {
    if (candidates.some((candidate) => candidate.hash.toLowerCase() === entry.hash.toLowerCase())) return
    candidates.push(entry)
  }

  if (params.sessionKeyOwner) {
    // validateUserOp checks raw EntryPoint userOpHash (not replaySafe). Try that domain first.
    if (
      primary.mode === 'entrypoint_v06_chain' ||
      primary.mode === 'entrypoint_v06_chain_unmatched_prepare_hash'
    ) {
      pushUnique({
        hash: primary.hash,
        mode: `${primary.mode}_session_key_primary`,
      })
      pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_session_key_fallback' })
      if (primary.hash.toLowerCase() !== withChainId.toLowerCase()) {
        pushUnique({ hash: withChainId, mode: 'entrypoint_v06_chain_session_key_fallback' })
      }
    } else {
      pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_session_key_primary' })
      pushUnique({ hash: withChainId, mode: 'entrypoint_v06_chain_session_key_fallback' })
    }

    pushUnique(primary)
    if (primary.mode !== 'entrypoint_v06_no_chain') {
      pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_fallback' })
    }
    if (primary.mode === 'entrypoint_v06_chain_unmatched_prepare_hash') {
      pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_unmatched_fallback' })
    }
    if (primary.hash.toLowerCase() !== withChainId.toLowerCase()) {
      pushUnique({ hash: withChainId, mode: 'entrypoint_v06_chain_fallback' })
    }

    if (replaySafeHash) {
      pushUnique({ hash: replaySafeHash, mode: 'csw_replay_safe_sdk_fallback' })
    }
    return candidates
  }

  if (preferReplaySafe && replaySafeHash) {
    pushUnique({ hash: replaySafeHash, mode: 'csw_replay_safe_primary' })
  }

  pushUnique(primary)
  if (primary.mode !== 'entrypoint_v06_no_chain') {
    pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_fallback' })
  }
  if (primary.mode === 'entrypoint_v06_chain_unmatched_prepare_hash') {
    pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_unmatched_fallback' })
  }
  if (primary.hash.toLowerCase() !== withChainId.toLowerCase()) {
    pushUnique({ hash: withChainId, mode: 'entrypoint_v06_chain_fallback' })
  }

  return candidates
}

/** Signer addresses to try in wallet_sendPreparedCalls for session-key owners. */
export function listSelfAuthPreparedCallsSignerAddressCandidates(params: {
  parsedOwnerAddress: `0x${string}` | null
  recoveredRawAddress?: `0x${string}` | null
  recoveredEip191Address?: `0x${string}` | null
  resolvedOwnerAtIndexAddress?: `0x${string}` | null
  fundingCsw?: `0x${string}` | null
  /** When true, prefer delegated session-key EOA before ownerAtIndex bytes. */
  sessionKeyOwner?: boolean
}): Array<{ address: `0x${string}`; mode: string }> {
  const candidates: Array<{ address: `0x${string}`; mode: string }> = []
  const pushUnique = (address: `0x${string}` | null | undefined, mode: string) => {
    if (!address) return
    const normalized = getAddress(address)
    if (candidates.some((candidate) => candidate.address.toLowerCase() === normalized.toLowerCase())) return
    candidates.push({ address: normalized, mode })
  }

  if (params.sessionKeyOwner) {
    // Base App may sign via a delegated EOA; try it before ownerAtIndex(2) bytes.
    pushUnique(params.recoveredRawAddress, 'session_key_delegated_eoa')
    pushUnique(params.resolvedOwnerAtIndexAddress, 'owner_at_index_resolved')
    pushUnique(params.parsedOwnerAddress, 'owner_at_index')
    pushUnique(params.fundingCsw ?? null, 'funding_csw_session_key')
    return candidates
  }

  pushUnique(params.parsedOwnerAddress, 'owner_at_index')
  pushUnique(params.resolvedOwnerAtIndexAddress, 'owner_at_index_resolved')
  pushUnique(params.recoveredEip191Address, 'recovered_eip191')
  pushUnique(params.recoveredRawAddress, 'recovered_raw')
  return candidates
}

async function assertSelfFundedPrefundBudget(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  depositWei: bigint
  appendEvent: (row: string) => void
}): Promise<void> {
  const [nativeWei, entryPointDepositWei] = await Promise.all([
    params.publicClient.getBalance({ address: params.fundingCsw }),
    params.publicClient
      .readContract({
        address: ENTRY_POINT_V06_BASE,
        abi: ENTRY_POINT_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [params.fundingCsw],
      })
      .catch(() => 0n),
  ])

  params.appendEvent(`relay_part1:prefund_native_wei=${nativeWei.toString(10)}`)
  params.appendEvent(`relay_part1:prefund_entrypoint_deposit_wei=${entryPointDepositWei.toString(10)}`)

  const gasReserveWei = await resolveRelayPart1UserOpGasReserveWei(params.publicClient)
  params.appendEvent(`relay_part1:prefund_gas_reserve_wei=${gasReserveWei.toString(10)}`)
  const requiredWei = params.depositWei + gasReserveWei

  if (nativeWei < params.depositWei) {
    throw new Error(
      `Smart wallet native balance (${nativeWei.toString()} wei) is below the Relay deposit (${params.depositWei.toString()} wei). Fund your main Base wallet with ETH and retry.`,
    )
  }

  if (nativeWei + entryPointDepositWei < requiredWei) {
    throw new Error(
      `Smart wallet prefund is too low for a self-funded UserOp (EntryPoint v0.6, paymasterAndData empty). ` +
        `Need deposit + gas reserve (${requiredWei.toString()} wei) from native ETH and/or EntryPoint.depositTo; ` +
        `have ${nativeWei.toString()} wei native + ${entryPointDepositWei.toString()} wei EntryPoint deposit.`,
    )
  }
}

function formatRelayPart1Error(error: unknown): string {
  return formatRelayBundlerRpcError(error)
}

function formatRelayBundlerRpcError(error: unknown): string {
  if (!(error instanceof Error)) return getWalletErrorMessage(error)

  const record = error as Record<string, unknown>
  const shortMessage = typeof record.shortMessage === 'string' ? record.shortMessage.trim() : ''
  if (shortMessage && shortMessage.toLowerCase() !== 'rpc request failed.') {
    return shortMessage
  }

  const details = record.details
  if (typeof details === 'string' && details.trim()) return details
  if (details && typeof details === 'object') {
    const nested = details as { message?: unknown; error?: { message?: unknown } }
    const message = nested.error?.message ?? nested.message
    if (typeof message === 'string' && message.trim()) return message
  }

  const cause = record.cause
  if (cause instanceof Error) {
    const causeMessage = cause.message.trim()
    if (causeMessage && causeMessage.toLowerCase() !== error.message.toLowerCase()) {
      return causeMessage
    }
  }

  return error.message.trim() || getWalletErrorMessage(error)
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = formatRelayPart1Error(error).toLowerCase()
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('request rejected') ||
    message.includes('action_rejected') ||
    message.includes('rejected the request')
  )
}

function isSkippableSelfAuthSignMethodError(error: unknown): boolean {
  const message = formatRelayPart1Error(error).toLowerCase()
  return (
    message.includes('incorrect address') ||
    message.includes('invalid address') ||
    message.includes('does not match') ||
    message.includes('error generating message')
  )
}

function isMisleadingWalletFundsSignError(error: unknown): boolean {
  const message = formatRelayPart1Error(error).toLowerCase()
  return (
    (message.includes('error generating message') || message.includes('error generating transaction')) &&
    message.includes('enough funds')
  )
}

/** CSW multi-owner validateUserOp requires `(ownerIndex, innerSig)` — bare 65-byte ECDSA reverts AA24. */
export function ensureSelfAuthSessionKeyOwnerWrapper(params: {
  signature: Hex
  ownerIndex: number
  sessionKeyOwner: boolean
}): Hex {
  if (!params.sessionKeyOwner) return params.signature
  const wrapped = parseCoinbaseSignatureWrapper(params.signature)
  if (wrapped && hexByteLength(wrapped.signatureData) === 65) {
    if (wrapped.ownerIndex === params.ownerIndex) return params.signature
    return wrapBareSelfAuthOwnerSignature(wrapped.signatureData, params.ownerIndex)
  }
  if (hexByteLength(params.signature) === 65) {
    return wrapBareSelfAuthOwnerSignature(params.signature, params.ownerIndex)
  }
  return params.signature
}

async function ensureSelfAuthWalletAuthorized(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  appendEvent: (row: string) => void
  /** Base App session-key CSWs often expose a delegated EOA in eth_accounts, not the CSW. */
  sessionKeyOwner?: boolean
}): Promise<void> {
  const expected = getAddress(params.fundingCsw)
  try {
    const accounts = (await params.walletRequest({ method: 'eth_requestAccounts' })) as string[]
    const normalized = accounts.map((account) => getAddress(account as `0x${string}`).toLowerCase())
    params.appendEvent(`relay_part1:authorized_accounts=${accounts.length}`)
    if (accounts.length > 0) {
      params.appendEvent(`relay_part1:active_wallet=${getAddress(accounts[0] as `0x${string}`)}`)
    }
    if (!normalized.includes(expected.toLowerCase())) {
      params.appendEvent(`relay_part1:warn funding_csw_not_in_authorized_accounts expected=${expected}`)
      if (params.sessionKeyOwner) {
        params.appendEvent('relay_part1:session_key_skip_strict_account_match=1')
        return
      }
      throw new Error(
        `Incorrect address: Base App is connected to ${accounts[0] ?? 'another wallet'}, not your 4626 smart wallet (${expected}). Close 4626 in Base App, reopen https://4626.fun/waitlist?setup=owner-install, and retry Enable 4626 signing.`,
      )
    }
  } catch (requestError) {
    if (formatRelayPart1Error(requestError).toLowerCase().includes('incorrect address')) {
      throw requestError
    }
    let fallbackAccounts: string[] = []
    try {
      fallbackAccounts = (await params.walletRequest({ method: 'eth_accounts' })) as string[]
    } catch {
      /* ignore */
    }
    if (fallbackAccounts.length > 0) {
      params.appendEvent(`relay_part1:authorized_accounts=${fallbackAccounts.length}`)
      return
    }
    throw new Error(
      `Base App wallet is not authorized for signing. Re-open 4626 inside Base App and approve the wallet connection, then retry. (${formatRelayPart1Error(requestError)})`,
    )
  }
}

type SelfAuthSignMethod =
  | 'typed_data_v4_csw'
  | 'personal_sign_data_address'
  | 'personal_sign_address_data'
  | 'personal_sign_data_session_key'
  | 'personal_sign_session_key_data'
  | 'eth_sign_address_data'

export function listSelfAuthSignMethods(params: {
  sessionKeyOwner: boolean
  parsedOwnerIndex: number | null
  bundlerOnly?: boolean
  sessionKeySignerAddress?: `0x${string}` | null
  /** When replay-safe, prefer CSW EIP-712 (sukanto) over raw-hash personal_sign. */
  hashMode?: string
}): SelfAuthSignMethod[] {
  const sessionKeyContext = isSelfAuthSessionKeyOwnerContext({
    sessionKeyOwner: params.sessionKeyOwner,
    ownerIndex: params.parsedOwnerIndex,
  })
  if (sessionKeyContext && params.hashMode && isSelfAuthReplaySafeSignHashMode(params.hashMode)) {
    // Coinbase guidance: sign replaySafe via CoinbaseSmartWalletMessage typed data.
    // personal_sign on the replaySafe digest surfaces misleading funds errors and
    // "Incorrect address" when the session-key delegated EOA is passed as signer.
    return ['typed_data_v4_csw']
  }
  // EntryPoint-hash session-key lane: personal_sign / eth_sign with funding CSW only.
  // ownerAtIndex(2) bytes are not the Base App connected account — passing them
  // as personal_sign address triggers "Incorrect address / not connected" modals.
  if (sessionKeyContext) {
    return ['personal_sign_data_address', 'personal_sign_address_data', 'eth_sign_address_data']
  }
  const ecdsaMethods: SelfAuthSignMethod[] = params.bundlerOnly
    ? ['personal_sign_data_address', 'eth_sign_address_data', 'personal_sign_address_data']
    : ['personal_sign_data_address']
  return ['typed_data_v4_csw', ...ecdsaMethods]
}

/**
 * Base App sometimes returns a SignatureWrapper with the wrong ownerIndex while the
 * inner secp256k1 signature is valid for the session-key owner. Re-wrap when recovery
 * matches ownerAtIndex(sessionKey).
 */
export async function repairSelfAuthSessionKeyWrapperSignature(params: {
  signature: Hex
  chainId: number
  fundingCsw: `0x${string}`
  userOpHash: Hex
  expectedOwnerIndex: number
  expectedOwnerAddress: `0x${string}`
}): Promise<{ signature: Hex; repaired: boolean }> {
  const wrapped = parseCoinbaseSignatureWrapper(params.signature)
  if (!wrapped || hexByteLength(wrapped.signatureData) !== 65) {
    return { signature: params.signature, repaired: false }
  }

  const replaySafe = hashTypedData(
    buildCswUserOpTypedDataPayload({
      smartWallet: params.fundingCsw,
      chainId: params.chainId,
      userOpHash: params.userOpHash,
    }),
  )

  let recovered: `0x${string}` | null = null
  try {
    recovered = await recoverAddress({ hash: replaySafe, signature: wrapped.signatureData })
  } catch {
    return { signature: params.signature, repaired: false }
  }

  if (recovered.toLowerCase() !== params.expectedOwnerAddress.toLowerCase()) {
    return { signature: params.signature, repaired: false }
  }

  if (wrapped.ownerIndex === params.expectedOwnerIndex) {
    return { signature: params.signature, repaired: false }
  }

  return {
    signature: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [BigInt(params.expectedOwnerIndex), wrapped.signatureData],
    ) as Hex,
    repaired: true,
  }
}

function isSelfAuthWalletAuthorizationError(error: unknown): boolean {
  const message = formatRelayPart1Error(error).toLowerCase()
  return (
    message.includes('eth_requestaccounts') ||
    message.includes('not been authorized') ||
    (message.includes('must call') && message.includes('eth_requestaccounts'))
  )
}

function hexByteLength(value: Hex): number {
  return (value.length - 2) / 2
}

async function alignSelfAuthSessionKeySignature(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  chainId: number
  userOpHash: Hex
  hashToSign: Hex
  signature: Hex
  preferredOwnerIndex: number
  preferredOwnerAddress: `0x${string}` | null
  appendEvent: (row: string) => void
}): Promise<{ signature: Hex; ownerIndex: number | null; recoveredInnerSigner: `0x${string}` | null }> {
  let signature = params.signature
  let ownerIndex = parseSelfAuthOwnerIndexFromSignature(signature)
  let recoveredInnerSigner: `0x${string}` | null = null

  if (ownerIndex == null && hexByteLength(signature) === 65) {
    signature = wrapBareSelfAuthOwnerSignature(signature, params.preferredOwnerIndex)
    ownerIndex = params.preferredOwnerIndex
    params.appendEvent('relay_part1:sig_wrapped_bare_secp256k1=1')
  }

  if (params.preferredOwnerAddress) {
    const repaired = await repairSelfAuthSessionKeyWrapperSignature({
      signature,
      chainId: params.chainId,
      fundingCsw: params.fundingCsw,
      userOpHash: params.userOpHash,
      expectedOwnerIndex: params.preferredOwnerIndex,
      expectedOwnerAddress: params.preferredOwnerAddress,
    })
    if (repaired.repaired) {
      signature = repaired.signature
      ownerIndex = params.preferredOwnerIndex
      params.appendEvent('relay_part1:sig_wrapper_repaired=1')
    }
  }

  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (wrapped && hexByteLength(wrapped.signatureData) === 65) {
    const replaySafe = hashTypedData(
      buildCswUserOpTypedDataPayload({
        smartWallet: params.fundingCsw,
        chainId: params.chainId,
        userOpHash: params.userOpHash,
      }),
    )
    const recoveryHashes: Array<{ hash: Hex; mode: string }> = [
      { hash: replaySafe, mode: 'replay_safe_typed_data' },
      { hash: params.hashToSign, mode: 'signed_hash' },
      { hash: params.userOpHash, mode: 'entrypoint_v06_chain' },
    ]
    for (const candidate of recoveryHashes) {
      try {
        const recovered = await recoverAddress({
          hash: candidate.hash,
          signature: wrapped.signatureData,
        })
        params.appendEvent(
          `relay_part1:onchain_sig_recovered=${recovered} owner_index=${wrapped.ownerIndex ?? 'n/a'}:${candidate.mode}`,
        )
        if (candidate.mode === 'replay_safe_typed_data') {
          recoveredInnerSigner = recovered
        }
        const resolvedIndex = await resolveCswOwnerIndexForEoaAddress({
          publicClient: params.publicClient,
          fundingCsw: params.fundingCsw,
          eoaAddress: recovered,
        })
        if (
          resolvedIndex != null &&
          (wrapped.ownerIndex == null || wrapped.ownerIndex !== resolvedIndex)
        ) {
          signature = wrapBareSelfAuthOwnerSignature(wrapped.signatureData, resolvedIndex)
          ownerIndex = resolvedIndex
          params.appendEvent(`relay_part1:sig_owner_index_resolved=${resolvedIndex}:${candidate.mode}`)
          break
        }
      } catch {
        /* try next hash domain */
      }
    }
  }

  return { signature, ownerIndex, recoveredInnerSigner }
}

async function preflightSelfAuthUserOpSignatureOnChain(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  strippedUserOp: V06UserOpFields
  chainId: number
  hashToSign: Hex
  signMethod: SelfAuthSignMethod
  signature: Hex
  appendEvent: (row: string) => void
}): Promise<boolean> {
  const entryPointHash = computeUserOpHashWithChainId(params.strippedUserOp, params.chainId)
  const replaySafeHash = computeSelfAuthReplaySafeHash({
    fundingCsw: params.fundingCsw,
    chainId: params.chainId,
    userOpHash: entryPointHash,
  })
  const validationHashes: Array<{ hash: Hex; mode: string }> = [
    { hash: entryPointHash, mode: 'entrypoint_v06_chain' },
    { hash: replaySafeHash, mode: 'csw_replay_safe' },
  ]
  if (
    params.hashToSign.toLowerCase() !== entryPointHash.toLowerCase() &&
    params.hashToSign.toLowerCase() !== replaySafeHash.toLowerCase()
  ) {
    validationHashes.push({ hash: params.hashToSign, mode: 'signed_hash' })
  }

  for (const candidate of validationHashes) {
    try {
      const magic = await params.publicClient.readContract({
        address: params.fundingCsw,
        abi: CSW_IS_VALID_SIGNATURE_ABI,
        functionName: 'isValidSignature',
        args: [candidate.hash, params.signature],
      })
      const ok = String(magic).toLowerCase() === ERC1271_MAGIC_VALUE
      params.appendEvent(
        `relay_part1:onchain_sig_preflight=${ok ? 'ok' : 'invalid'}:${candidate.mode}`,
      )
      if (ok) return true
    } catch (error) {
      params.appendEvent(
        `relay_part1:onchain_sig_preflight=skipped:${candidate.mode}:${formatRelayPart1Error(error).slice(0, 80)}`,
      )
    }
  }

  return false
}

/**
 * Mirrors CoinbaseSmartWallet.validateUserOp: `_isValidSignature(userOpHash, sig)` uses the
 * raw EntryPoint hash (no replaySafe wrap). ERC-1271 isValidSignature preflight can pass
 * while validateUserOp still returns AA24 — gate bundler submits on this check.
 */
export async function preflightValidateUserOpStyleSignature(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  strippedUserOp: V06UserOpFields
  chainId: number
  signature: Hex
  appendEvent: (row: string) => void
}): Promise<SelfAuthValidateUserOpPreflight> {
  const userOpHash = computeUserOpHashWithChainId(params.strippedUserOp, params.chainId)
  const wrapped = parseCoinbaseSignatureWrapper(params.signature)
  if (!wrapped) {
    params.appendEvent('relay_part1:validate_user_op_preflight=no_wrapper')
    return { ok: false, recovered: null, ownerAddress: null, ownerIndex: null }
  }

  if (hexByteLength(wrapped.signatureData) !== 65) {
    params.appendEvent('relay_part1:validate_user_op_preflight=skipped_non_ecdsa')
    return {
      ok: true,
      recovered: null,
      ownerAddress: null,
      ownerIndex: wrapped.ownerIndex ?? null,
    }
  }

  const ownerIndex = wrapped.ownerIndex ?? 0
  const ownerAddress = await readCswOwnerAddressAtIndex({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    ownerIndex,
  })
  if (!ownerAddress) {
    params.appendEvent('relay_part1:validate_user_op_preflight=skipped_non_address_owner')
    return {
      ok: true,
      recovered: null,
      ownerAddress: null,
      ownerIndex,
    }
  }

  const inner = wrapped.signatureData
  const recoveryHashes: Array<{ hash: Hex; mode: string }> = [
    { hash: userOpHash, mode: 'entrypoint_v06_chain' },
    { hash: hashMessage({ raw: userOpHash }), mode: 'eip191_entrypoint' },
  ]

  let lastRecovered: `0x${string}` | null = null
  for (const candidate of recoveryHashes) {
    try {
      const recovered = await recoverAddress({ hash: candidate.hash, signature: inner })
      lastRecovered = recovered
      const ok = recovered.toLowerCase() === ownerAddress.toLowerCase()
      params.appendEvent(
        `relay_part1:validate_user_op_preflight=${ok ? 'ok' : 'mismatch'}:${candidate.mode} recovered=${recovered} owner=${ownerAddress}`,
      )
      if (ok) {
        return { ok: true, recovered, ownerAddress, ownerIndex }
      }
    } catch {
      /* try next hash domain */
    }
  }

  params.appendEvent('relay_part1:validate_user_op_preflight=invalid')
  return {
    ok: false,
    recovered: lastRecovered,
    ownerAddress,
    ownerIndex,
  }
}

export function buildBaseAppSubstitutedSignerError(recovered: `0x${string}`): Error {
  return new Error(
    `${BASE_APP_SUBSTITUTED_SIGNER_ERROR}: Base App signed with ${recovered}, which is not an on-chain owner of your smart wallet. ` +
      'Connect one of the listed on-chain EOA owners below (Rabby / MetaMask), or open Enable 4626 signing in Chrome or Safari outside the Base App browser.',
  )
}

async function requestSelfAuthSignature(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  hashToSign: Hex
  method: SelfAuthSignMethod
  chainId: number
  ownerDiscovery?: SelfAuthOwnerDiscovery
  /** EntryPoint v0.6 with-chain hash — required for typed_data_v4 when hashToSign is replaySafe. */
  entryPointUserOpHash?: Hex
}): Promise<Hex> {
  if (params.method === 'typed_data_v4_csw') {
    const userOpHashForTypedData = params.entryPointUserOpHash ?? params.hashToSign
    return signCswUserOpHashViaTypedDataV4({
      walletRequest: params.walletRequest,
      smartWallet: params.fundingCsw,
      signerAddress: params.fundingCsw,
      chainId: params.chainId,
      userOpHash: userOpHashForTypedData,
    })
  }

  const sessionKeySignerAddress = params.ownerDiscovery?.ownerSignerAddress ?? null
  const request =
    params.method === 'eth_sign_address_data'
      ? { method: 'eth_sign' as const, params: [params.fundingCsw, params.hashToSign] }
      : params.method === 'personal_sign_address_data'
        ? { method: 'personal_sign' as const, params: [params.fundingCsw, params.hashToSign] }
        : params.method === 'personal_sign_data_session_key'
          ? sessionKeySignerAddress
            ? {
                method: 'personal_sign' as const,
                params: [params.hashToSign, sessionKeySignerAddress],
              }
            : null
          : params.method === 'personal_sign_session_key_data'
            ? sessionKeySignerAddress
              ? {
                  method: 'personal_sign' as const,
                  params: [sessionKeySignerAddress, params.hashToSign],
                }
              : null
            : { method: 'personal_sign' as const, params: [params.hashToSign, params.fundingCsw] }

  if (!request) {
    throw new Error('Session-key signer address is missing for personal_sign.')
  }

  const signature = (await params.walletRequest(request)) as Hex
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error(`${request.method} did not return a valid signature.`)
  }
  return signature
}

async function resolvePreparedCallsSignHash(params: {
  preparedUserOpRaw: unknown
  signatureRequestHash: Hex
  chainId: number
  fundingCsw: `0x${string}`
  signAfterPaymasterStrip: boolean
  forceBundlerOnly?: boolean
  hadInjectedPaymaster?: boolean
  sessionKeyOwner?: boolean
  appendEvent: (row: string) => void
}): Promise<Array<{ hash: Hex; mode: string }>> {
  if (!params.signAfterPaymasterStrip && !params.forceBundlerOnly) {
    return [{
      hash: unwrapDoubleHexEncodedHash(params.signatureRequestHash),
      mode: 'prepare_signature_request',
    }]
  }
  const candidates = listSelfAuthBundlerSignHashCandidates({
    preparedUserOp: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainId: params.chainId,
    sessionKeyOwner: params.sessionKeyOwner,
    fundingCsw: params.fundingCsw,
    preferReplaySafeHash: params.sessionKeyOwner ?? false,
  })
  params.appendEvent(`relay_part1:strip_paymaster_sign_mode=${candidates[0]?.mode ?? 'unknown'}`)
  if (candidates.length > 1) {
    params.appendEvent(`relay_part1:sign_hash_candidates=${candidates.length}`)
  }
  return candidates
}

function isBundlerSignatureRejectedError(error: unknown): boolean {
  const message = formatRelayBundlerRpcError(error).toLowerCase()
  return (
    message.includes('invalid userop signature') ||
    message.includes('invalid signature') ||
    message.includes('signature check failed') ||
    message.includes('aa24') ||
    message.includes('paymaster signature')
  )
}

function isPreparedCallsSignatureRejectedError(error: unknown): boolean {
  if (isBundlerSignatureRejectedError(error)) return true
  const message = formatRelayBundlerRpcError(error).toLowerCase()
  return (
    message.includes('no matching signer') ||
    message.includes('packed signature') ||
    message.includes('signature.data.address')
  )
}

async function signSelfAuthPreparedUserOpOnce(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  hashToSign: Hex
  signMethod: SelfAuthSignMethod
  chainId: number
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
  entryPointUserOpHash?: Hex
}): Promise<{
  signature: Hex
  preparedCallsSignerAddress: `0x${string}` | null
  parsedOwnerIndex: number | null
  recoveredRawAddress: `0x${string}` | null
  recoveredEip191Address: `0x${string}` | null
}> {
  params.appendEvent(`relay_part1:sign_mode=${params.signMethod}`)
  await ensureSelfAuthWalletAuthorized({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
    sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
      sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
      ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
    }),
  })
  const signature = await requestSelfAuthSignature({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    hashToSign: params.hashToSign,
    method: params.signMethod,
    chainId: params.chainId,
    ownerDiscovery: params.ownerDiscovery,
    entryPointUserOpHash: params.entryPointUserOpHash,
  })

  let preparedCallsSignerAddress: `0x${string}` | null = null
  let recoveredRawAddress: `0x${string}` | null = null
  let recoveredEip191Address: `0x${string}` | null = null
  let parsedOwnerIndex = parseSelfAuthOwnerIndexFromSignature(signature)
  let sessionKeyOwner = false
  try {
    const guardOutcome = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.fundingCsw,
      hashToSign: params.hashToSign,
      signature,
      sessionKind: 'self_auth',
    })
    if (
      guardOutcome.kind === 'ok' ||
      guardOutcome.kind === 'skipped_self_auth_session_key' ||
      guardOutcome.kind === 'skipped_code_bearing'
    ) {
      if (guardOutcome.kind === 'skipped_self_auth_session_key') {
        sessionKeyOwner = true
      }
      if ('parsedOwnerIndex' in guardOutcome && guardOutcome.parsedOwnerIndex != null) {
        parsedOwnerIndex = guardOutcome.parsedOwnerIndex
      }
      if ('parsedOwnerAddress' in guardOutcome && guardOutcome.parsedOwnerAddress) {
        preparedCallsSignerAddress = guardOutcome.parsedOwnerAddress
        params.appendEvent(`relay_part1:prepared_signer=${preparedCallsSignerAddress}`)
      }
      if ('recoveredRawAddress' in guardOutcome && guardOutcome.recoveredRawAddress) {
        recoveredRawAddress = guardOutcome.recoveredRawAddress
      }
      if ('recoveredEip191Address' in guardOutcome && guardOutcome.recoveredEip191Address) {
        recoveredEip191Address = guardOutcome.recoveredEip191Address
      }
    }
  } catch {
    /* fail open — Base App webauthn payloads use sender address */
  }

  if (parsedOwnerIndex != null) {
    params.appendEvent(`relay_part1:parsed_owner_index=${parsedOwnerIndex}`)
    assertOwnerIndexAllowedForSelfAuthPart1({
      ownerIndex: parsedOwnerIndex,
      appendEvent: params.appendEvent,
    })
  }
  if (params.ownerDiscovery) {
    recordSelfAuthOwnerDiscovery({
      discovery: params.ownerDiscovery,
      ownerIndex: parsedOwnerIndex,
      ownerSignerAddress: preparedCallsSignerAddress,
      sessionKeyOwner,
      appendEvent: params.appendEvent,
    })
  }

  return {
    signature,
    preparedCallsSignerAddress,
    parsedOwnerIndex,
    recoveredRawAddress,
    recoveredEip191Address,
  }
}

type PreparedCallsSubmitOutcome =
  | { ok: true; txHash: `0x${string}` }
  | { ok: false; signatureRejected: true; error: unknown }
  | { ok: false; signatureRejected: false }

async function trySendPreparedCallsUserOp(params: {
  walletRequest: WalletRequest
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  prepareResult: {
    type?: string
    chainId?: string
  }
  chainIdHex: `0x${string}`
  userOp: V06UserOpFields
  /** When set, forwarded verbatim as wallet_sendPreparedCalls `data` (Base App encoding). */
  sendUserOpData?: unknown
  lane: string
  signature: Hex
  parsedOwnerIndex: number | null
  preparedCallsSignerAddress: `0x${string}` | null
  recoveredRawAddress?: `0x${string}` | null
  recoveredEip191Address?: `0x${string}` | null
  sessionKeyOwner: boolean
  ownerDiscovery?: SelfAuthOwnerDiscovery
  appendEvent: (row: string) => void
}): Promise<PreparedCallsSubmitOutcome> {
  const effectiveOwnerIndex =
    params.parsedOwnerIndex ?? params.ownerDiscovery?.ownerIndex ?? null
  const payloadModes = listSelfAuthPreparedCallsSignaturePayloadModes({
    parsedOwnerIndex: effectiveOwnerIndex,
    sessionKeyOwner: params.sessionKeyOwner,
  })
  let resolvedOwnerAtIndexAddress: `0x${string}` | null = null
  if (effectiveOwnerIndex != null) {
    resolvedOwnerAtIndexAddress = await readCswOwnerAddressAtIndex({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      ownerIndex: effectiveOwnerIndex,
    })
    if (resolvedOwnerAtIndexAddress) {
      params.appendEvent(`relay_part1:resolved_owner_signer=${resolvedOwnerAtIndexAddress}`)
    }
  }

  const signerAddressCandidates = listSelfAuthPreparedCallsSignerAddressCandidates({
    parsedOwnerAddress:
      params.preparedCallsSignerAddress ?? params.ownerDiscovery?.ownerSignerAddress ?? null,
    recoveredRawAddress: params.recoveredRawAddress,
    recoveredEip191Address: params.recoveredEip191Address,
    resolvedOwnerAtIndexAddress,
    fundingCsw: params.fundingCsw,
    sessionKeyOwner: params.sessionKeyOwner,
  })

  const userOpPayload =
    params.sendUserOpData ?? serializeUserOpForPreparedCallsSend(params.userOp)
  params.appendEvent(`relay_part1:lane=${params.lane}`)

  let lastSignatureRejection: unknown = null
  for (const mode of payloadModes) {
    params.appendEvent(`relay_part1:prepared_calls_signature_mode=${mode}`)
    const signerCandidates =
      signerAddressCandidates.length > 0
        ? signerAddressCandidates
        : [{ address: params.fundingCsw, mode: 'funding_csw_fallback' }]

    for (const signerCandidate of signerCandidates) {
      params.appendEvent(
        `relay_part1:prepared_calls_signer=${signerCandidate.address} mode=${signerCandidate.mode}`,
      )

      const signaturePayload = buildSendPreparedCallsSignaturePayload({
        sender: params.fundingCsw,
        signature: params.signature,
        signerAddress: signerCandidate.address,
        mode,
      })

      try {
        const sendResult = await params.walletRequest({
          method: 'wallet_sendPreparedCalls',
          params: [
            {
              version: '1.0',
              type: params.prepareResult.type ?? 'user-operation-v06',
              data: userOpPayload,
              chainId: params.prepareResult.chainId ?? params.chainIdHex,
              signature: signaturePayload,
            },
          ],
        })

        const callsId = extractWalletCallsId(sendResult)
        if (!callsId) {
          throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
        }
        params.appendEvent(`relay_part1:prepared_calls_bundle=${callsId}`)
        try {
          const txHash = await pollPreparedCallsBundle({
            walletRequest: params.walletRequest,
            publicClient: params.publicClient,
            fundingCsw: params.fundingCsw,
            callsId,
            appendEvent: params.appendEvent,
          })
          return { ok: true, txHash }
        } catch (landError) {
          const landMessage = formatRelayPart1Error(landError)
          if (
            landMessage.includes('USDC paymaster') ||
            landMessage.includes('paymaster = 0')
          ) {
            params.appendEvent('relay_part1:prepared_calls_paymaster_landed=1')
            return { ok: false, signatureRejected: false }
          }
          throw landError
        }
      } catch (sendError) {
        if (isUserRejectedWalletAction(sendError)) {
          throw sendError
        }
        params.appendEvent(
          `relay_part1:prepared_calls_send_error=${formatRelayPart1Error(sendError).slice(0, 180)} mode=${mode} signer=${signerCandidate.mode}`,
        )
        if (!isPreparedCallsSignatureRejectedError(sendError)) {
          throw sendError
        }
        lastSignatureRejection = sendError
      }
    }
  }

  if (lastSignatureRejection) {
    return { ok: false, signatureRejected: true, error: lastSignatureRejection }
  }
  return { ok: false, signatureRejected: false }
}

function formatUserOpRpcHexField(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}`
}

async function readCswOwnerAddressAtIndex(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  ownerIndex: number
}): Promise<`0x${string}` | null> {
  try {
    const ownerBytes = await params.publicClient.readContract({
      address: params.fundingCsw,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(params.ownerIndex)],
    })
    if (typeof ownerBytes !== 'string' || !ownerBytes.startsWith('0x')) return null
    try {
      const [ownerAddress] = decodeAbiParameters([{ type: 'address' }], ownerBytes as Hex)
      return getAddress(ownerAddress)
    } catch {
      const hex = ownerBytes.slice(2)
      if (hex.length < 40) return null
      return getAddress(`0x${hex.slice(-40)}`)
    }
  } catch {
    return null
  }
}

function toRpcUserOperation(userOp: V06UserOpFields, signature: Hex) {
  return {
    sender: getAddress(userOp.sender),
    nonce: formatUserOpRpcHexField(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: formatUserOpRpcHexField(userOp.callGasLimit),
    verificationGasLimit: formatUserOpRpcHexField(userOp.verificationGasLimit),
    preVerificationGas: formatUserOpRpcHexField(userOp.preVerificationGas),
    maxFeePerGas: formatUserOpRpcHexField(userOp.maxFeePerGas),
    maxPriorityFeePerGas: formatUserOpRpcHexField(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature,
  }
}

async function submitSignedPreparedUserOpViaBundler(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  strippedUserOp: V06UserOpFields
  signature: Hex
  appendEvent: (row: string) => void
  customOwnerPolicyToken?: string | null
  sessionKeyOwner?: boolean
  ownerIndex?: number | null
}): Promise<`0x${string}`> {
  params.appendEvent('relay_part1:lane=prepared_bundler_self_funded')
  if (userOpHasPaymaster(params.strippedUserOp)) {
    throw new Error('Relay Part 1 bundler submit requires paymasterAndData=0x.')
  }
  const ownerIndex = params.ownerIndex ?? SELF_AUTH_SESSION_KEY_OWNER_INDEX
  const signature = ensureSelfAuthSessionKeyOwnerWrapper({
    signature: params.signature,
    ownerIndex,
    sessionKeyOwner: params.sessionKeyOwner ?? false,
  })
  if (params.sessionKeyOwner && !parseCoinbaseSignatureWrapper(signature)) {
    throw new Error('Relay Part 1 session-key signature is missing owner-index wrapper.')
  }
  const bundlerClient = createBundlerClient({
    client: params.publicClient as never,
    transport: buildRelayBundlerHttpTransport(params.customOwnerPolicyToken),
  })
  const userOperation = toRpcUserOperation(params.strippedUserOp, signature)
  let userOpHash: Hex
  try {
    userOpHash = (await bundlerClient.request({
      method: 'eth_sendUserOperation',
      params: [userOperation, entryPoint06Address],
    })) as Hex
  } catch (error) {
    const message = formatRelayBundlerRpcError(error)
    params.appendEvent(`relay_part1:prepared_bundler_error=${message.slice(0, 260)}`)
    throw new Error(message)
  }
  params.appendEvent(`relay_part1:prepared_bundler_userop=${userOpHash}`)

  const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: userOpHash })
  const transactionHash = receipt.receipt.transactionHash
  params.appendEvent(`relay_part1:prepared_bundler_tx=${transactionHash}`)
  await assertRelayPart1TxHashSelfFunded({
    transactionHash,
    userOperationHash: userOpHash,
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
  })
  return transactionHash
}

async function pollPreparedCallsBundle(params: {
  walletRequest: WalletRequest
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  callsId: string
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: params.callsId,
    timeoutMs: 90_000,
    intervalMs: 1_500,
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        params.appendEvent(`relay_part1.prepared_status.${event.step}: ${detail.slice(0, 320)}`)
      } catch {
        params.appendEvent(`relay_part1.prepared_status.${event.step}: <unloggable>`)
      }
    },
  })

  await assertRelayPart1LandedSelfFunded({
    resolution,
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
  })

  const txHash = await resolveRelayPart1DepositTxHash({
    resolution,
    appendEvent: params.appendEvent,
  })
  params.appendEvent(`relay_part1:prepared_tx=${txHash}`)
  return txHash
}

/**
 * Mirror the working owner-install prepared-calls path: personal_sign the unwrapped
 * prepare hash and submit the raw prepared userOp (no paymaster strip, no typed-data).
 */
async function attemptPrepareNativeMirrorLane(params: {
  walletRequest: WalletRequest
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  prepareResult: {
    type?: string
    chainId?: string
  }
  preparedUserOpRaw: unknown
  signatureRequestHash: Hex
  chainIdHex: `0x${string}`
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
}): Promise<`0x${string}` | null> {
  if (userOpHasPaymaster(params.preparedUserOpRaw)) {
    params.appendEvent('relay_part1:skip_prepare_native_paymaster_injected=1')
    return null
  }

  params.appendEvent('relay_part1:lane=prepared_calls_prepare_native')
  const hashToSign = unwrapDoubleHexEncodedHash(params.signatureRequestHash)
  params.appendEvent('relay_part1:sign_hash_mode=prepare_signature_request_native_userop')
  params.appendEvent('relay_part1:sign_mode=personal_sign_data_address')

  let signature: Hex
  try {
    signature = (await params.walletRequest({
      method: 'personal_sign',
      params: [hashToSign, params.fundingCsw],
    })) as Hex
  } catch (signError) {
    if (isUserRejectedWalletAction(signError)) {
      throw signError
    }
    params.appendEvent(
      `relay_part1:prepare_native_sign_error=${formatRelayPart1Error(signError).slice(0, 120)}`,
    )
    return null
  }
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    return null
  }

  if (
    params.ownerDiscovery?.sessionKeyOwner &&
    shouldRejectSelfAuthSignatureForSessionKeyLane({
      sessionKeyOwner: true,
      signature,
      parsedOwnerIndex: params.ownerDiscovery.ownerIndex,
      ownerDiscovery: params.ownerDiscovery,
    })
  ) {
    params.appendEvent('relay_part1:reject_passkey_sig_prepare_native=1')
    return null
  }

  let preparedCallsSignerAddress: `0x${string}` | null =
    params.ownerDiscovery?.ownerSignerAddress ?? null
  try {
    const guardOutcome = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.fundingCsw,
      hashToSign,
      signature,
      sessionKind: 'self_auth',
    })
    if (
      (guardOutcome.kind === 'ok' || guardOutcome.kind === 'skipped_self_auth_session_key') &&
      'parsedOwnerAddress' in guardOutcome &&
      guardOutcome.parsedOwnerAddress
    ) {
      preparedCallsSignerAddress = guardOutcome.parsedOwnerAddress
      params.appendEvent(`relay_part1:prepared_signer=${preparedCallsSignerAddress}`)
    }
  } catch {
    /* fail open — Base App webauthn/session-key payloads use sender address */
  }

  let parsedOwnerIndex: number | null = params.ownerDiscovery?.ownerIndex ?? null
  try {
    parsedOwnerIndex =
      parseSelfAuthOwnerIndexFromSignature(signature) ?? parsedOwnerIndex
  } catch {
    /* optional */
  }

  const sessionKeyOwnerResolved = isSelfAuthSessionKeyOwnerContext({
    sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
    ownerIndex: parsedOwnerIndex,
  })

  const preparedCallsResult = await trySendPreparedCallsUserOp({
    walletRequest: params.walletRequest,
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    prepareResult: params.prepareResult,
    chainIdHex: params.chainIdHex,
    userOp: parseWalletPreparedUserOpV06(params.preparedUserOpRaw),
    sendUserOpData: params.preparedUserOpRaw,
    lane: 'prepared_calls_prepare_native',
    signature,
    parsedOwnerIndex,
    preparedCallsSignerAddress,
    sessionKeyOwner: sessionKeyOwnerResolved,
    ownerDiscovery: params.ownerDiscovery,
    appendEvent: params.appendEvent,
  })
  return preparedCallsResult.ok ? preparedCallsResult.txHash : null
}

async function sendSignedPreparedUserOp(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  publicClient: PublicClient
  prepareResult: {
    type?: string
    chainId?: string
    userOp: Record<string, string>
  }
  preparedUserOpRaw: unknown
  signatureRequestHash: Hex
  signAfterPaymasterStrip: boolean
  forceBundlerOnly?: boolean
  hadInjectedPaymaster?: boolean
  chainId: number
  chainIdHex: `0x${string}`
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
  customOwnerPolicyToken?: string | null
}): Promise<`0x${string}`> {
  const effectiveStrip = params.signAfterPaymasterStrip || Boolean(params.forceBundlerOnly)
  const hashCandidates = await resolvePreparedCallsSignHash({
    preparedUserOpRaw: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainId: params.chainId,
    fundingCsw: params.fundingCsw,
    signAfterPaymasterStrip: effectiveStrip,
    forceBundlerOnly: params.forceBundlerOnly,
    hadInjectedPaymaster: params.hadInjectedPaymaster,
    sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
      sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
      ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
    }),
    appendEvent: params.appendEvent,
  })

  const strippedUserOp = effectiveStrip
    ? stripUserOpPaymaster(parseWalletPreparedUserOpV06(params.preparedUserOpRaw))
    : parseWalletPreparedUserOpV06(params.preparedUserOpRaw)
  const entryPointUserOpHash = computeUserOpHashWithChainId(strippedUserOp, params.chainId)
  const strippedRawSendData = stripRawWalletPreparedUserOp(params.preparedUserOpRaw)

  let lastSignatureError: unknown = null
  let lastBundlerSignature: Hex | null = null

  const signMethodsFor = (hashMode: string) =>
    listSelfAuthSignMethods({
      sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      }),
      parsedOwnerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      sessionKeySignerAddress: params.ownerDiscovery?.ownerSignerAddress ?? null,
      bundlerOnly: true,
      hashMode,
    })

  const attemptPreparedCalls = async (input: {
    hashToSign: Hex
    hashMode: string
    userOp: V06UserOpFields
    lane: string
    sendUserOpData?: unknown
  }): Promise<`0x${string}` | null> => {
    params.appendEvent(`relay_part1:sign_hash_mode=${input.hashMode}`)
    for (const signMethod of signMethodsFor(input.hashMode)) {
      let signature: Hex
      let preparedCallsSignerAddress: `0x${string}` | null
      let parsedOwnerIndex: number | null
      let recoveredRawAddress: `0x${string}` | null
      let recoveredEip191Address: `0x${string}` | null
      try {
        ;({
          signature,
          preparedCallsSignerAddress,
          parsedOwnerIndex,
          recoveredRawAddress,
          recoveredEip191Address,
        } = await signSelfAuthPreparedUserOpOnce({
          walletRequest: params.walletRequest,
          fundingCsw: params.fundingCsw,
          hashToSign: input.hashToSign,
          signMethod,
          chainId: params.chainId,
          appendEvent: params.appendEvent,
          ownerDiscovery: params.ownerDiscovery,
          entryPointUserOpHash,
        }))
      } catch (signError) {
        if (isUserRejectedWalletAction(signError)) {
          throw signError
        }
        if (
          signError instanceof Error &&
          signError.message.includes('mistaken owner in slot 3')
        ) {
          throw signError
        }
        if (isSkippableSelfAuthSignMethodError(signError)) {
          params.appendEvent(`relay_part1:skip_sign_method=${signMethod}`)
        }
        params.appendEvent(
          `relay_part1:sign_attempt_error=${formatRelayPart1Error(signError).slice(0, 120)} mode=${signMethod}`,
        )
        lastSignatureError = signError
        continue
      }

      let sessionKeyOwner = isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: parsedOwnerIndex ?? params.ownerDiscovery?.ownerIndex ?? null,
      })

      if (
        shouldRejectSelfAuthSignatureForSessionKeyLane({
          sessionKeyOwner,
          signature,
          parsedOwnerIndex,
          ownerDiscovery: params.ownerDiscovery,
        })
      ) {
        params.appendEvent('relay_part1:reject_passkey_sig_session_key_lane=1')
        lastSignatureError = new Error(PASSKEY_SIGNATURE_REJECTED_ERROR)
        continue
      }

      const entryPointHash = entryPointUserOpHash
      let alignedRecoveredInnerSigner: `0x${string}` | null = null
      const sukantoReplaySafeLane = sessionKeyOwner && isSelfAuthReplaySafeSignHashMode(input.hashMode)
      if (sessionKeyOwner) {
        const preferredOwnerIndex =
          params.ownerDiscovery?.ownerIndex ?? SELF_AUTH_SESSION_KEY_OWNER_INDEX
        const aligned = await alignSelfAuthSessionKeySignature({
          publicClient: params.publicClient,
          fundingCsw: params.fundingCsw,
          chainId: params.chainId,
          userOpHash: entryPointHash,
          hashToSign: input.hashToSign,
          signature,
          preferredOwnerIndex,
          preferredOwnerAddress: params.ownerDiscovery?.ownerSignerAddress ?? null,
          appendEvent: params.appendEvent,
        })
        signature = aligned.signature
        alignedRecoveredInnerSigner = aligned.recoveredInnerSigner
        if (alignedRecoveredInnerSigner) {
          recoveredRawAddress = alignedRecoveredInnerSigner
          params.appendEvent(
            `relay_part1:session_key_delegated_signer=${alignedRecoveredInnerSigner}`,
          )
        }
        if (aligned.ownerIndex != null) {
          parsedOwnerIndex = aligned.ownerIndex
          sessionKeyOwner = isSelfAuthSessionKeyOwnerContext({
            sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
            ownerIndex: aligned.ownerIndex,
          })
        }
        signature = ensureSelfAuthSessionKeyOwnerWrapper({
          signature,
          ownerIndex: parsedOwnerIndex ?? SELF_AUTH_SESSION_KEY_OWNER_INDEX,
          sessionKeyOwner,
        })
        if (!parseCoinbaseSignatureWrapper(signature)) {
          params.appendEvent('relay_part1:skip_submit_unwrapped_session_key_sig=1')
          lastSignatureError = new Error('Session-key signature missing owner-index wrapper')
          continue
        }
      }

      const onChainSignatureOk = await preflightSelfAuthUserOpSignatureOnChain({
        publicClient: params.publicClient,
        fundingCsw: params.fundingCsw,
        strippedUserOp: input.userOp,
        chainId: params.chainId,
        hashToSign: input.hashToSign,
        signMethod,
        signature,
        appendEvent: params.appendEvent,
      })
      const expectedOwnerIndex =
        parsedOwnerIndex ?? params.ownerDiscovery?.ownerIndex ?? SELF_AUTH_SESSION_KEY_OWNER_INDEX
      const sessionKeyEcdsaOk =
        sessionKeyOwner && isSelfAuthSessionKeyEcdsaSignature(signature, expectedOwnerIndex)
      if (!onChainSignatureOk && !sessionKeyEcdsaOk) {
        params.appendEvent(`relay_part1:skip_submit_invalid_onchain_sig mode=${signMethod}`)
        lastSignatureError = new Error('On-chain isValidSignature preflight rejected signature')
        continue
      }
      if (!onChainSignatureOk && sessionKeyEcdsaOk) {
        params.appendEvent(
          `relay_part1:onchain_sig_preflight=advisory_invalid_session_key mode=${signMethod}`,
        )
      }

      const validateUserOpPreflight = await preflightValidateUserOpStyleSignature({
        publicClient: params.publicClient,
        fundingCsw: params.fundingCsw,
        strippedUserOp: input.userOp,
        chainId: params.chainId,
        signature,
        appendEvent: params.appendEvent,
      })
      const validateUserOpOk = validateUserOpPreflight.ok
      const replaySafeSignHash = isSelfAuthReplaySafeSignHashMode(input.hashMode)

      if (
        sessionKeyOwner &&
        !replaySafeSignHash &&
        !validateUserOpOk &&
        validateUserOpPreflight.recovered &&
        hexByteLength(parseCoinbaseSignatureWrapper(signature)?.signatureData ?? '0x') === 65
      ) {
        const recoveredOwnerIndex = await resolveCswOwnerIndexForEoaAddress({
          publicClient: params.publicClient,
          fundingCsw: params.fundingCsw,
          eoaAddress: validateUserOpPreflight.recovered,
        })
        if (recoveredOwnerIndex == null) {
          params.appendEvent(
            `relay_part1:substituted_signer=${validateUserOpPreflight.recovered}`,
          )
          throw buildBaseAppSubstitutedSignerError(validateUserOpPreflight.recovered)
        }
      }

      const sessionKeySubmitEligible =
        sessionKeyOwner &&
        (validateUserOpOk ||
          (onChainSignatureOk && replaySafeSignHash) ||
          (sessionKeyEcdsaOk && replaySafeSignHash))
      const bundlerSubmitEligible = validateUserOpOk || (onChainSignatureOk && replaySafeSignHash)

      if (bundlerSubmitEligible) {
        lastBundlerSignature = signature
      } else {
        params.appendEvent('relay_part1:skip_bundler_validate_user_op_preflight=1')
      }

      if (
        !validateUserOpOk &&
        isSelfAuthReplaySafeSignHashMode(input.hashMode) &&
        sessionKeySubmitEligible
      ) {
        params.appendEvent(
          'relay_part1:validate_user_op_preflight=advisory_mismatch_session_key_replay_safe',
        )
      }

      if (
        !validateUserOpOk &&
        !isSelfAuthReplaySafeSignHashMode(input.hashMode) &&
        sessionKeySubmitEligible
      ) {
        params.appendEvent(
          'relay_part1:validate_user_op_preflight=advisory_mismatch_session_key_entrypoint',
        )
      }

      const bypassSdkViaBundler =
        sessionKeyOwner &&
        bundlerSubmitEligible &&
        (replaySafeSignHash || validateUserOpOk)

      const submitPreparedCalls = async (laneSuffix: string): Promise<`0x${string}` | null> => {
        try {
          const preparedCallsResult = await trySendPreparedCallsUserOp({
            walletRequest: params.walletRequest,
            publicClient: params.publicClient,
            fundingCsw: params.fundingCsw,
            prepareResult: params.prepareResult,
            chainIdHex: params.chainIdHex,
            userOp: input.userOp,
            sendUserOpData: input.sendUserOpData,
            lane: `${input.lane}_${laneSuffix}`,
            signature,
            parsedOwnerIndex,
            preparedCallsSignerAddress,
            recoveredRawAddress: alignedRecoveredInnerSigner ?? recoveredRawAddress,
            recoveredEip191Address,
            sessionKeyOwner,
            ownerDiscovery: params.ownerDiscovery,
            appendEvent: params.appendEvent,
          })
          if (preparedCallsResult.ok) {
            return preparedCallsResult.txHash
          }
          if (preparedCallsResult.signatureRejected) {
            lastSignatureError = preparedCallsResult.error
            params.appendEvent(
              `relay_part1:prepared_calls_signature_rejected=${formatRelayPart1Error(preparedCallsResult.error).slice(0, 120)}`,
            )
          }
        } catch (preparedCallsError) {
          if (isUserRejectedWalletAction(preparedCallsError)) {
            throw preparedCallsError
          }
          if (isPreparedCallsSignatureRejectedError(preparedCallsError)) {
            lastSignatureError = preparedCallsError
            params.appendEvent(
              `relay_part1:prepared_calls_signature_rejected=${formatRelayPart1Error(preparedCallsError).slice(0, 120)}`,
            )
          } else {
            throw preparedCallsError
          }
        }
        return null
      }

      // Base App session keys: SDK packing with delegated EOA before raw bundler.
      if (sukantoReplaySafeLane) {
        params.appendEvent('relay_part1:lane=sukanto_prepared_calls_primary')
        const preparedTx = await submitPreparedCalls('sukanto_prepared_primary')
        if (preparedTx) {
          return preparedTx
        }
      } else if (sessionKeySubmitEligible) {
        params.appendEvent('relay_part1:lane=session_key_prepared_calls_primary')
        const preparedTx = await submitPreparedCalls('session_key_primary')
        if (preparedTx) {
          return preparedTx
        }
      }

      if (bypassSdkViaBundler && params.customOwnerPolicyToken) {
        params.appendEvent('relay_part1:lane=sukanto_bundler_primary')
        try {
          return await submitSignedPreparedUserOpViaBundler({
            publicClient: params.publicClient,
            fundingCsw: params.fundingCsw,
            strippedUserOp: input.userOp,
            signature,
            appendEvent: params.appendEvent,
            customOwnerPolicyToken: params.customOwnerPolicyToken,
            sessionKeyOwner,
            ownerIndex: parsedOwnerIndex,
          })
        } catch (bundlerError) {
          if (isUserRejectedWalletAction(bundlerError)) {
            throw bundlerError
          }
          params.appendEvent(
            `relay_part1:sukanto_bundler_error=${formatRelayPart1Error(bundlerError).slice(0, 180)}`,
          )
          lastSignatureError = bundlerError
        }
      }

      const preparedTx = await submitPreparedCalls('fallback')
      if (preparedTx) {
        return preparedTx
      }

      if (params.customOwnerPolicyToken && bundlerSubmitEligible) {
        try {
          return await submitSignedPreparedUserOpViaBundler({
            publicClient: params.publicClient,
            fundingCsw: params.fundingCsw,
            strippedUserOp: input.userOp,
            signature,
            appendEvent: params.appendEvent,
            customOwnerPolicyToken: params.customOwnerPolicyToken,
            sessionKeyOwner,
            ownerIndex: parsedOwnerIndex,
          })
        } catch (bundlerError) {
          if (isUserRejectedWalletAction(bundlerError)) {
            throw bundlerError
          }
          params.appendEvent(
            `relay_part1:prepared_bundler_inline_error=${formatRelayPart1Error(bundlerError).slice(0, 180)}`,
          )
          lastSignatureError = bundlerError
        }
      } else if (params.customOwnerPolicyToken && !bundlerSubmitEligible) {
        params.appendEvent('relay_part1:skip_bundler_inline_validate_user_op_preflight=1')
      }

      // Try the next sign method for this hash before advancing hash candidates.
      continue
    }
    return null
  }

  const prepareNativeTx = await attemptPrepareNativeMirrorLane({
    walletRequest: params.walletRequest,
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    prepareResult: params.prepareResult,
    preparedUserOpRaw: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainIdHex: params.chainIdHex,
    appendEvent: params.appendEvent,
    ownerDiscovery: params.ownerDiscovery,
  })
  if (prepareNativeTx) {
    return prepareNativeTx
  }

  for (const candidate of hashCandidates) {
    const strippedTx = await attemptPreparedCalls({
      hashToSign: candidate.hash,
      hashMode: candidate.mode,
      userOp: strippedUserOp,
      lane: 'prepared_calls_stripped_self_funded',
      sendUserOpData: effectiveStrip ? strippedRawSendData : params.preparedUserOpRaw,
    })
    if (strippedTx) {
      return strippedTx
    }
  }

  if (
    lastBundlerSignature &&
    params.customOwnerPolicyToken &&
    effectiveStrip &&
    !(
      isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      }) && isSelfAuthPasskeyOwnerSignature(lastBundlerSignature)
    )
  ) {
    params.appendEvent('relay_part1:lane=prepared_bundler_self_funded_fallback')
    try {
      return await submitSignedPreparedUserOpViaBundler({
        publicClient: params.publicClient,
        fundingCsw: params.fundingCsw,
        strippedUserOp,
        signature: lastBundlerSignature,
        appendEvent: params.appendEvent,
        customOwnerPolicyToken: params.customOwnerPolicyToken,
        sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
          sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
          ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
        }),
        ownerIndex: params.ownerDiscovery?.ownerIndex ?? SELF_AUTH_SESSION_KEY_OWNER_INDEX,
      })
    } catch (bundlerError) {
      if (isUserRejectedWalletAction(bundlerError)) {
        throw bundlerError
      }
      params.appendEvent(
        `relay_part1:prepared_bundler_fallback_error=${formatRelayPart1Error(bundlerError).slice(0, 180)}`,
      )
      lastSignatureError = bundlerError
    }
  }

  if (lastSignatureError instanceof Error && isBundlerSignatureRejectedError(lastSignatureError)) {
    throw new Error(
      'UserOp signature verification failed for the Relay deposit. Rebuild the owner-install preview in Base App and retry Enable 4626 signing.',
    )
  }

  const lastErrorMessage = lastSignatureError instanceof Error ? lastSignatureError.message : ''
  if (lastErrorMessage.includes(BASE_APP_SUBSTITUTED_SIGNER_ERROR)) {
    throw lastSignatureError instanceof Error
      ? lastSignatureError
      : buildBaseAppSubstitutedSignerError('0x0000000000000000000000000000000000000000')
  }
  if (lastErrorMessage.includes(PASSKEY_SIGNATURE_REJECTED_ERROR)) {
    throw new Error(
      'Base App signed Relay Part 1 with your passkey (owner slot 0). This deposit must be signed by the session key at owner slot 2. Force-close Base App, reopen /waitlist?setup=owner-install, rebuild the preview, and retry Enable 4626 signing. Part 2 still uses passkey approval — Part 1 must not.',
    )
  }
  if (lastErrorMessage.includes('On-chain isValidSignature preflight rejected signature')) {
    throw new Error(
      'Base App returned a Relay deposit signature that did not validate on-chain for your smart wallet. ' +
        'Rebuild the preview and retry once. If lane events show onchain_sig_recovered with an address that is not your session-key owner, open Enable 4626 signing in Chrome or Safari outside the Base App in-app browser.',
    )
  }

  if (lastSignatureError instanceof Error && isUserRejectedWalletAction(lastSignatureError)) {
    throw new Error('Relay deposit signing was cancelled. Rebuild the preview and retry when ready.')
  }

  if (lastSignatureError && isMisleadingWalletFundsSignError(lastSignatureError)) {
    throw new Error(
      'Base App blocked the Relay deposit signature ("not enough funds" on Signature Request). ' +
        'This is usually not your ETH balance — Base App often shows that message when it cannot sign the requested hash format. ' +
        'Rebuild a fresh owner-install preview and retry inside Base App after the latest 4626 deploy. ' +
        'If it repeats, open Enable 4626 signing in Chrome or Safari outside the Base App in-app browser.',
    )
  }

  if (lastSignatureError && isSelfAuthWalletAuthorizationError(lastSignatureError)) {
    throw new Error(
      'Base App did not authorize the Relay deposit signature after prepare. When Base App shows a signing prompt, approve it — then rebuild the preview and retry Enable 4626 signing. Do not leave the flow mid-session.',
    )
  }

  if (params.hadInjectedPaymaster) {
    throw new Error(
      'Base App injected a USDC paymaster on prepare, and the self-funded strip-and-sign path could not complete. ' +
        'Ensure your smart wallet holds enough native ETH for gas, rebuild a fresh Relay preview, and retry. ' +
        'Do not resubmit while Relay still shows "waiting" for an earlier deposit.',
    )
  }

  throw lastSignatureError instanceof Error
    ? lastSignatureError
    : new Error('Could not submit the Relay deposit UserOp. Rebuild the preview in Base App and retry.')
}

async function submitSignedPreparedUserOpWithBundlerFallback(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  publicClient: PublicClient
  prepareResult: {
    type?: string
    chainId?: string
    userOp: Record<string, string>
  }
  preparedUserOpRaw: unknown
  signatureRequestHash: Hex
  signAfterPaymasterStrip: boolean
  chainId: number
  chainIdHex: `0x${string}`
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
  customOwnerPolicyToken?: string | null
  forceBundlerOnly?: boolean
  hadInjectedPaymaster?: boolean
}): Promise<`0x${string}`> {
  return await sendSignedPreparedUserOp(params)
}

function extractWalletCallsId(sendResult: unknown): string | null {
  if (typeof sendResult === 'string') return sendResult
  if (!sendResult || typeof sendResult !== 'object') return null
  const record = sendResult as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  if (typeof record.callBundleId === 'string') return record.callBundleId
  return null
}

/** Relay Part 1 prepare must stay self-funded (paymaster=0) or Relay Part 2 stalls. */
export function buildSelfFundedRelayPrepareCapabilities(
  depositWei: bigint,
  gasReserveWei: bigint,
): Record<string, unknown> {
  const requiredWei = depositWei + gasReserveWei
  return {
    requiredFunds: [
      {
        address: '0x0000000000000000000000000000000000000000',
        value: `0x${requiredWei.toString(16)}`,
      },
    ],
  }
}

async function discoverSelfAuthSessionKeyOwner(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  ownerDiscovery: SelfAuthOwnerDiscovery
  appendEvent: (row: string) => void
}): Promise<void> {
  const sessionKeyOwnerAddress = await readCswOwnerAddressAtIndex({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    ownerIndex: SELF_AUTH_SESSION_KEY_OWNER_INDEX,
  })
  if (sessionKeyOwnerAddress) {
    params.ownerDiscovery.ownerIndex = SELF_AUTH_SESSION_KEY_OWNER_INDEX
    params.ownerDiscovery.ownerSignerAddress = sessionKeyOwnerAddress
    params.ownerDiscovery.sessionKeyOwner = true
    params.appendEvent('relay_part1:preflight_session_key_owner=1')
    params.appendEvent(`relay_part1:preflight_session_key_address=${sessionKeyOwnerAddress}`)
  }

  const mistakenOwnerAddress = await readCswOwnerAddressAtIndex({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    ownerIndex: MISTAKEN_OWNER_INDEX,
  })
  if (mistakenOwnerAddress) {
    params.appendEvent(`relay_part1:warn_mistaken_owner_slot_3_present=${mistakenOwnerAddress}`)
  }
}

async function submitViaPreparedCallsSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient: PublicClient
  appendEvent: (row: string) => void
  ownerDiscovery: SelfAuthOwnerDiscovery
  customOwnerPolicyToken?: string | null
}): Promise<`0x${string}`> {
  const policyToken =
    typeof params.customOwnerPolicyToken === 'string' && params.customOwnerPolicyToken.trim()
      ? params.customOwnerPolicyToken.trim()
      : null
  if (!policyToken) {
    throw new Error(
      'Owner-install preview is missing the Relay Part 1 sponsorship token. Refresh Enable 4626 signing to build a fresh preview, then retry.',
    )
  }

  const chainIdHex = `0x${params.chainId.toString(16)}` as `0x${string}`
  const valueHex = normalizePreparedCallValueToHex(params.userCall.value)
  params.appendEvent('relay_part1:lane=prepare_calls_self_funded')
  const forceBundlerOnly = true

  await ensureSelfAuthWalletAuthorized({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
    sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
      sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
      ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
    }),
  })

  await assertSelfFundedPrefundBudget({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    depositWei: BigInt(params.userCall.value),
    appendEvent: params.appendEvent,
  })

  const depositWei = BigInt(params.userCall.value)
  const gasReserveWei = await resolveRelayPart1UserOpGasReserveWei(params.publicClient)
  params.appendEvent(`relay_part1:prepare_required_gas_reserve_wei=${gasReserveWei.toString(10)}`)
  const prepareCapabilities = buildSelfFundedRelayPrepareCapabilities(depositWei, gasReserveWei)

  const prepareResult = (await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [
      {
        version: '1.0',
        from: getAddress(params.fundingCsw),
        chainId: chainIdHex,
        calls: [
          {
            to: getAddress(params.userCall.to),
            data: params.userCall.data,
            value: valueHex,
          },
        ],
        capabilities: prepareCapabilities,
      },
    ],
  })) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  const sendParams = {
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    publicClient: params.publicClient,
    preparedUserOpRaw: prepareResult.userOp,
    signatureRequestHash: prepareResult.signatureRequest.hash as Hex,
    chainId: params.chainId,
    chainIdHex,
    appendEvent: params.appendEvent,
    ownerDiscovery: params.ownerDiscovery,
  }

  if (userOpHasPaymaster(prepareResult.userOp)) {
    const paymaster = parseEntryPointPaymasterAddress(
      readPreparedUserOpPaymasterAndData(prepareResult.userOp),
    )
    params.appendEvent(`relay_part1:warn prepared_userop_paymaster=${paymaster ?? 'unknown'}`)
    params.appendEvent('relay_part1:lane=prepare_strip_paymaster_self_funded')

    const stripped = stripUserOpPaymaster(parseWalletPreparedUserOpV06(prepareResult.userOp))
    return await submitSignedPreparedUserOpWithBundlerFallback({
      ...sendParams,
      prepareResult: {
        type: prepareResult.type,
        chainId: prepareResult.chainId,
        userOp: serializeUserOpForPreparedCallsSend(stripped),
      },
      signAfterPaymasterStrip: true,
      forceBundlerOnly,
      hadInjectedPaymaster: true,
      customOwnerPolicyToken: policyToken,
    })
  }

  params.appendEvent('relay_part1:prepared_userop_paymaster=0x0')

  return await submitSignedPreparedUserOpWithBundlerFallback({
    ...sendParams,
    prepareResult: {
      type: prepareResult.type,
      chainId: prepareResult.chainId,
      userOp: serializeUserOpForPreparedCallsSend(parseWalletPreparedUserOpV06(prepareResult.userOp)),
    },
    signAfterPaymasterStrip: true,
    forceBundlerOnly,
    hadInjectedPaymaster: false,
    customOwnerPolicyToken: policyToken,
  })
}

/**
 * Submit Relay Part 1 (Depository.depositNative) from a Base App self-auth CSW
 * without ERC-4337 paymaster sponsorship (native ETH / EntryPoint prefund only).
 *
 * Lane order (self-auth owner-install only):
 *   1. `wallet_prepareCalls` (self-funded capabilities)
 *   2. Sign prepare hash (typed data for session keys; ECDSA otherwise)
 *   3. Sign stripped-hash candidates against paymaster=0 userOp
 *   4. `wallet_sendPreparedCalls` for each pairing above
 *   5. `eth_sendUserOperation` via 4626 custom-owner bundler when prepared-calls reject
 *
 * Never fall back to `wallet_sendCalls` — Base App re-injects USDC paymaster and Relay Part 2 stalls.
 */
export async function submitSelfAuthRelayPart1SelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  appendEvent: (row: string) => void
  customOwnerPolicyToken?: string | null
}): Promise<`0x${string}`> {
  if (!params.publicClient) {
    throw new Error(
      'Relay Part 1 requires an on-chain client to verify self-funded UserOps. Reload the page and retry Enable 4626 signing.',
    )
  }

  const ownerDiscovery: SelfAuthOwnerDiscovery = {
    ownerIndex: null,
    ownerSignerAddress: null,
    sessionKeyOwner: false,
  }

  await discoverSelfAuthSessionKeyOwner({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    ownerDiscovery,
    appendEvent: params.appendEvent,
  })

  return await submitViaPreparedCallsSelfFunded({
    ...params,
    publicClient: params.publicClient,
    ownerDiscovery,
    customOwnerPolicyToken: params.customOwnerPolicyToken,
  })
}
