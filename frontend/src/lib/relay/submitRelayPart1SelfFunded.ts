import { decodeAbiParameters, getAddress, type Address, type Hex, type PublicClient } from 'viem'
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
import { waitForCallsTxHash, _submitOwnerViaSendCalls } from '@/lib/wallet/cswSendCalls'
import {
  buildSendPreparedCallsSignaturePayload,
  normalizePreparedCallValueToHex,
  signCswUserOpHashViaTypedDataV4,
  type PreparedCallsSignaturePayloadMode,
} from '@/lib/wallet/onboardingWalletPrepared'
import {
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

export function listSelfAuthPreparedCallsSignaturePayloadModes(params: {
  parsedOwnerIndex: number | null
  sessionKeyOwner?: boolean
}): PreparedCallsSignaturePayloadMode[] {
  if (params.sessionKeyOwner || params.parsedOwnerIndex === SELF_AUTH_SESSION_KEY_OWNER_INDEX) {
    return ['full_wrapper_secp256k1', 'inner_secp256k1', 'auto']
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
  preferSessionKeyNoChain?: boolean
}): Array<{ hash: Hex; mode: string }> {
  const primary = resolveSelfFundedSignHashAfterPaymasterStrip(params)
  const parsed = parseWalletPreparedUserOpV06(params.preparedUserOp)
  const stripped = stripUserOpPaymaster(parsed)
  const withChainId = computeUserOpHashWithChainId(stripped, params.chainId)
  const withoutChainId = getUserOpHashWithoutChainIdLocal(stripped, ENTRY_POINT_V06_BASE)

  const candidates: Array<{ hash: Hex; mode: string }> = []
  const pushUnique = (entry: { hash: Hex; mode: string }) => {
    if (candidates.some((candidate) => candidate.hash.toLowerCase() === entry.hash.toLowerCase())) return
    candidates.push(entry)
  }

  // Session-key CSWs (owner[2]) validate stripped self-funded UserOps on the no-chain domain.
  if (params.preferSessionKeyNoChain) {
    pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_session_key_primary' })
    if (primary.mode !== 'entrypoint_v06_no_chain') {
      pushUnique(primary)
    }
  } else {
    pushUnique(primary)
    if (primary.mode !== 'entrypoint_v06_no_chain') {
      pushUnique({ hash: withoutChainId, mode: 'entrypoint_v06_no_chain_fallback' })
    }
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
  /** When true, only on-chain owner slot addresses — skip ecrecover guesses. */
  sessionKeyOwner?: boolean
}): Array<{ address: `0x${string}`; mode: string }> {
  const candidates: Array<{ address: `0x${string}`; mode: string }> = []
  const pushUnique = (address: `0x${string}` | null | undefined, mode: string) => {
    if (!address) return
    const normalized = getAddress(address)
    if (candidates.some((candidate) => candidate.address.toLowerCase() === normalized.toLowerCase())) return
    candidates.push({ address: normalized, mode })
  }

  pushUnique(params.parsedOwnerAddress, 'owner_at_index')
  pushUnique(params.resolvedOwnerAtIndexAddress, 'owner_at_index_resolved')
  if (!params.sessionKeyOwner) {
    pushUnique(params.recoveredEip191Address, 'recovered_eip191')
    pushUnique(params.recoveredRawAddress, 'recovered_raw')
  }
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

function isRelayPart1UsdcPaymasterLandedError(error: unknown): boolean {
  const message = formatRelayPart1Error(error).toLowerCase()
  return message.includes('usdc paymaster')
}

/** Do not fall through to a second Part 1 lane — user already signed or wallet RPC is broken. */
function isNonCascadeRelayPart1Error(error: unknown): boolean {
  if (isUserRejectedWalletAction(error)) return true
  if (isRelayPart1UsdcPaymasterLandedError(error)) return true
  const message = formatRelayPart1Error(error).toLowerCase()
  return (
    message.includes('failed to fetch rpc request') ||
    message.includes('failed to fetch') ||
    message.includes('internal error was received') ||
    message.includes('error generating message') ||
    message.includes('error generating transaction')
  )
}

async function ensureSelfAuthWalletAuthorized(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  appendEvent: (row: string) => void
}): Promise<void> {
  try {
    const accounts = (await params.walletRequest({ method: 'eth_requestAccounts' })) as string[]
    const normalized = accounts.map((account) => account.toLowerCase())
    params.appendEvent(`relay_part1:authorized_accounts=${accounts.length}`)
    if (!normalized.includes(params.fundingCsw.toLowerCase())) {
      params.appendEvent('relay_part1:warn funding_csw_not_in_authorized_accounts')
    }
  } catch (requestError) {
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
  | 'eth_sign_address_data'

function listSelfAuthSignMethods(params: {
  sessionKeyOwner: boolean
  parsedOwnerIndex: number | null
  bundlerOnly?: boolean
}): SelfAuthSignMethod[] {
  const sessionKeyContext = isSelfAuthSessionKeyOwnerContext({
    sessionKeyOwner: params.sessionKeyOwner,
    ownerIndex: params.parsedOwnerIndex,
  })
  const ecdsaMethods: SelfAuthSignMethod[] = params.bundlerOnly || sessionKeyContext
    ? ['personal_sign_data_address', 'eth_sign_address_data', 'personal_sign_address_data']
    : ['personal_sign_data_address']
  if (sessionKeyContext) {
    return [...ecdsaMethods, 'typed_data_v4_csw']
  }
  return ['typed_data_v4_csw', ...ecdsaMethods]
}

async function requestSelfAuthSignature(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  hashToSign: Hex
  method: SelfAuthSignMethod
  chainId: number
  ownerDiscovery?: SelfAuthOwnerDiscovery
}): Promise<Hex> {
  if (params.method === 'typed_data_v4_csw') {
    const signerAddress =
      isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      }) && params.ownerDiscovery?.ownerSignerAddress
        ? params.ownerDiscovery.ownerSignerAddress
        : params.fundingCsw
    return signCswUserOpHashViaTypedDataV4({
      walletRequest: params.walletRequest,
      smartWallet: params.fundingCsw,
      signerAddress,
      chainId: params.chainId,
      userOpHash: params.hashToSign,
    })
  }

  const request =
    params.method === 'eth_sign_address_data'
      ? { method: 'eth_sign' as const, params: [params.fundingCsw, params.hashToSign] }
      : params.method === 'personal_sign_address_data'
        ? { method: 'personal_sign' as const, params: [params.fundingCsw, params.hashToSign] }
        : { method: 'personal_sign' as const, params: [params.hashToSign, params.fundingCsw] }

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
  signAfterPaymasterStrip: boolean
  forceBundlerOnly?: boolean
  preferSessionKeyNoChain?: boolean
  hadInjectedPaymaster?: boolean
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
    preferSessionKeyNoChain: params.preferSessionKeyNoChain,
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
}): Promise<{
  signature: Hex
  preparedCallsSignerAddress: `0x${string}` | null
  parsedOwnerIndex: number | null
  recoveredRawAddress: `0x${string}` | null
  recoveredEip191Address: `0x${string}` | null
}> {
  params.appendEvent(`relay_part1:sign_mode=${params.signMethod}`)
  const signature = await requestSelfAuthSignature({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    hashToSign: params.hashToSign,
    method: params.signMethod,
    chainId: params.chainId,
    ownerDiscovery: params.ownerDiscovery,
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
}): Promise<`0x${string}`> {
  params.appendEvent('relay_part1:lane=prepared_bundler_self_funded')
  const bundlerClient = createBundlerClient({
    client: params.publicClient as never,
    transport: buildRelayBundlerHttpTransport(params.customOwnerPolicyToken),
  })
  const userOperation = toRpcUserOperation(params.strippedUserOp, params.signature)
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

  const sessionKeyOwner = isSelfAuthSessionKeyOwnerContext({
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
    sessionKeyOwner,
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
    signAfterPaymasterStrip: effectiveStrip,
    forceBundlerOnly: params.forceBundlerOnly,
    preferSessionKeyNoChain: isSelfAuthSessionKeyOwnerContext({
      sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
      ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
    }),
    hadInjectedPaymaster: params.hadInjectedPaymaster,
    appendEvent: params.appendEvent,
  })

  const strippedUserOp = effectiveStrip
    ? stripUserOpPaymaster(parseWalletPreparedUserOpV06(params.preparedUserOpRaw))
    : parseWalletPreparedUserOpV06(params.preparedUserOpRaw)

  let lastSignatureError: unknown = null

  const signMethodsFor = () =>
    listSelfAuthSignMethods({
      sessionKeyOwner: isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      }),
      parsedOwnerIndex: params.ownerDiscovery?.ownerIndex ?? null,
      bundlerOnly: true,
    })

  const attemptPreparedCalls = async (input: {
    hashToSign: Hex
    hashMode: string
    userOp: V06UserOpFields
    lane: string
    sendUserOpData?: unknown
  }): Promise<`0x${string}` | null> => {
    params.appendEvent(`relay_part1:sign_hash_mode=${input.hashMode}`)
    for (const signMethod of signMethodsFor()) {
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
        }))
      } catch (signError) {
        if (isUserRejectedWalletAction(signError)) {
          throw signError
        }
        params.appendEvent(
          `relay_part1:sign_attempt_error=${formatRelayPart1Error(signError).slice(0, 120)} mode=${signMethod}`,
        )
        lastSignatureError = signError
        continue
      }

      const sessionKeyOwner = isSelfAuthSessionKeyOwnerContext({
        sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner,
        ownerIndex: parsedOwnerIndex ?? params.ownerDiscovery?.ownerIndex ?? null,
      })

      try {
        const preparedCallsResult = await trySendPreparedCallsUserOp({
          walletRequest: params.walletRequest,
          publicClient: params.publicClient,
          fundingCsw: params.fundingCsw,
          prepareResult: params.prepareResult,
          chainIdHex: params.chainIdHex,
          userOp: input.userOp,
          sendUserOpData: input.sendUserOpData,
          lane: input.lane,
          signature,
          parsedOwnerIndex,
          preparedCallsSignerAddress,
          recoveredRawAddress,
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

      params.appendEvent('relay_part1:skip_bundler_self_auth=1')
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
      sendUserOpData: stripRawWalletPreparedUserOp(params.preparedUserOpRaw),
    })
    if (strippedTx) {
      return strippedTx
    }
  }

  if (lastSignatureError instanceof Error && isBundlerSignatureRejectedError(lastSignatureError)) {
    throw new Error(
      'UserOp signature verification failed for the Relay deposit. Rebuild the owner-install preview in Base App and retry Enable 4626 signing.',
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
    // Valid Base App shape; discourages mandatory CDP paymaster injection when possible.
    paymasterService: { optional: true },
    requiredFunds: [
      {
        address: '0x0000000000000000000000000000000000000000',
        value: `0x${requiredWei.toString(16)}`,
      },
    ],
  }
}

async function submitViaSendCallsSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  params.appendEvent('relay_part1:lane=send_calls_self_funded')
  await ensureSelfAuthWalletAuthorized({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
  })
  const { callBundleId } = await _submitOwnerViaSendCalls({
    walletRequest: params.walletRequest,
    csw: params.fundingCsw,
    chainId: params.chainId,
    calls: [
      {
        to: getAddress(params.userCall.to),
        data: params.userCall.data,
        value: BigInt(params.userCall.value),
      },
    ],
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        params.appendEvent(`relay_part1.send_calls.${event.step}: ${detail.slice(0, 320)}`)
      } catch {
        params.appendEvent(`relay_part1.send_calls.${event.step}: <unloggable>`)
      }
    },
  })

  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId,
    timeoutMs: 90_000,
    intervalMs: 1_500,
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        params.appendEvent(`relay_part1.send_calls_status.${event.step}: ${detail.slice(0, 320)}`)
      } catch {
        params.appendEvent(`relay_part1.send_calls_status.${event.step}: <unloggable>`)
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
  params.appendEvent(`relay_part1:send_calls_tx=${txHash}`)
  return txHash
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
 *   2. Sign prepare hash (typed data + ECDSA) against **native** prepared userOp
 *   3. Sign stripped-hash candidates against paymaster=0 userOp
 *   4. `wallet_sendPreparedCalls` for each pairing above
 *   Never `eth_sendUserOperation` — incompatible with Base App prepared UserOps.
 * Never `wallet_sendCalls` — Base App re-injects USDC paymaster on that path.
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

  params.appendEvent('relay_part1:skip_send_calls_self_auth')

  return await submitViaPreparedCallsSelfFunded({
    ...params,
    publicClient: params.publicClient,
    ownerDiscovery,
    customOwnerPolicyToken: params.customOwnerPolicyToken,
  })
}
