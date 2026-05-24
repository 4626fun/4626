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
  /** Base App session-key owner — uses inner_secp256k1 prepared-calls payload. */
  sessionKeyOwner: boolean
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

/** Prepared userOp was signed client-side; wallet_sendPreparedCalls rejected all payload shapes. */
class RelayPart1PreparedUserOpHandoff extends Error {
  readonly strippedUserOp: V06UserOpFields
  readonly signature: Hex

  constructor(strippedUserOp: V06UserOpFields, signature: Hex) {
    super('relay_part1_prepared_userop_handoff')
    this.name = 'RelayPart1PreparedUserOpHandoff'
    this.strippedUserOp = strippedUserOp
    this.signature = signature
  }
}

export function listSelfAuthPreparedCallsSignaturePayloadModes(params: {
  parsedOwnerIndex: number | null
  sessionKeyOwner?: boolean
}): PreparedCallsSignaturePayloadMode[] {
  if (params.sessionKeyOwner || params.parsedOwnerIndex === 2) {
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

async function resolvePreparedCallsSignHash(params: {
  preparedUserOpRaw: unknown
  signatureRequestHash: Hex
  chainId: number
  signAfterPaymasterStrip: boolean
  appendEvent: (row: string) => void
}): Promise<Hex> {
  if (!params.signAfterPaymasterStrip) {
    return unwrapDoubleHexEncodedHash(params.signatureRequestHash)
  }
  const resolved = resolveSelfFundedSignHashAfterPaymasterStrip({
    preparedUserOp: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainId: params.chainId,
  })
  params.appendEvent(`relay_part1:strip_paymaster_sign_mode=${resolved.mode}`)
  return resolved.hash
}

async function signSelfAuthPreparedUserOpHash(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  hashToSign: Hex
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
}): Promise<{
  signature: Hex
  preparedCallsSignerAddress: `0x${string}` | null
  parsedOwnerIndex: number | null
}> {
  params.appendEvent('relay_part1:sign_mode=personal_sign_data_address')
  const signature = (await params.walletRequest({
    method: 'personal_sign',
    params: [params.hashToSign, params.fundingCsw],
  })) as Hex
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }

  let preparedCallsSignerAddress: `0x${string}` | null = null
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
    }
  } catch {
    /* fail open — Base App webauthn payloads use sender address */
  }

  if (parsedOwnerIndex != null) {
    params.appendEvent(`relay_part1:parsed_owner_index=${parsedOwnerIndex}`)
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

  return { signature, preparedCallsSignerAddress, parsedOwnerIndex }
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
  chainId: number
  chainIdHex: `0x${string}`
  appendEvent: (row: string) => void
  ownerDiscovery?: SelfAuthOwnerDiscovery
}): Promise<`0x${string}`> {
  const hashToSign = await resolvePreparedCallsSignHash({
    preparedUserOpRaw: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainId: params.chainId,
    signAfterPaymasterStrip: params.signAfterPaymasterStrip,
    appendEvent: params.appendEvent,
  })

  const { signature, preparedCallsSignerAddress, parsedOwnerIndex } =
    await signSelfAuthPreparedUserOpHash({
      walletRequest: params.walletRequest,
      fundingCsw: params.fundingCsw,
      hashToSign,
      appendEvent: params.appendEvent,
      ownerDiscovery: params.ownerDiscovery,
    })

  const strippedUserOp = params.signAfterPaymasterStrip
    ? stripUserOpPaymaster(parseWalletPreparedUserOpV06(params.preparedUserOpRaw))
    : parseWalletPreparedUserOpV06(params.preparedUserOpRaw)

  // Base App `wallet_sendPreparedCalls` re-injects USDC paymaster even when we strip
  // paymasterAndData — owner-install always submits via bundler with custom-owner policy.
  if (params.signAfterPaymasterStrip || params.forceBundlerOnly) {
    params.appendEvent(
      params.forceBundlerOnly
        ? 'relay_part1:skip_send_prepared_calls_self_auth_bundler_only'
        : 'relay_part1:skip_send_prepared_calls_after_paymaster_strip',
    )
    throw new RelayPart1PreparedUserOpHandoff(strippedUserOp, signature)
  }

  const payloadModes = listSelfAuthPreparedCallsSignaturePayloadModes({
    parsedOwnerIndex,
    sessionKeyOwner: params.ownerDiscovery?.sessionKeyOwner ?? false,
  })
  let signerAddressForPayload = preparedCallsSignerAddress
  if (!signerAddressForPayload && parsedOwnerIndex != null) {
    signerAddressForPayload = await readCswOwnerAddressAtIndex({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      ownerIndex: parsedOwnerIndex,
    })
    if (signerAddressForPayload) {
      params.appendEvent(`relay_part1:resolved_owner_signer=${signerAddressForPayload}`)
    }
  }
  if (
    (params.ownerDiscovery?.sessionKeyOwner || parsedOwnerIndex === 2) &&
    !signerAddressForPayload
  ) {
    throw new Error(
      'Could not resolve the Base App session-key signer for this smart wallet. Refresh the owner-install preview and retry.',
    )
  }

  for (const mode of payloadModes) {
    params.appendEvent(`relay_part1:prepared_calls_signature_mode=${mode}`)
    if (signerAddressForPayload) {
      params.appendEvent(`relay_part1:prepared_calls_signer=${signerAddressForPayload}`)
    }

    const signaturePayload = buildSendPreparedCallsSignaturePayload({
      sender: params.fundingCsw,
      signature,
      signerAddress: signerAddressForPayload,
      mode,
    })

    try {
      const sendResult = await params.walletRequest({
        method: 'wallet_sendPreparedCalls',
        params: [
          {
            version: '1.0',
            type: params.prepareResult.type ?? 'user-operation-v06',
            data: params.prepareResult.userOp,
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
      return await pollPreparedCallsBundle({
        walletRequest: params.walletRequest,
        publicClient: params.publicClient,
        fundingCsw: params.fundingCsw,
        callsId,
        appendEvent: params.appendEvent,
      })
    } catch (sendError) {
      if (isUserRejectedWalletAction(sendError)) {
        throw sendError
      }
      params.appendEvent(
        `relay_part1:prepared_calls_send_error=${formatRelayPart1Error(sendError).slice(0, 180)} mode=${mode}`,
      )
    }
  }

  throw new RelayPart1PreparedUserOpHandoff(strippedUserOp, signature)
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
}): Promise<`0x${string}`> {
  try {
    return await sendSignedPreparedUserOp(params)
  } catch (error) {
    if (!(error instanceof RelayPart1PreparedUserOpHandoff)) {
      throw error
    }
    return await submitSignedPreparedUserOpViaBundler({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      strippedUserOp: error.strippedUserOp,
      signature: error.signature,
      appendEvent: params.appendEvent,
      customOwnerPolicyToken: params.customOwnerPolicyToken,
    })
  }
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
    signAfterPaymasterStrip: false,
    forceBundlerOnly,
    customOwnerPolicyToken: policyToken,
  })
}

/**
 * Submit Relay Part 1 (Depository.depositNative) from a Base App self-auth CSW
 * without ERC-4337 paymaster sponsorship (native ETH / EntryPoint prefund only).
 *
 * Lane order (self-auth owner-install only):
 *   1. `wallet_prepareCalls` (self-funded capabilities)
 *   2. Sign + strip paymaster when Base App injects USDC sponsorship
 *   3. `eth_sendUserOperation` via 4626 bundler with custom-owner policy (never `wallet_sendCalls`
 *      or `wallet_sendPreparedCalls` — Base App re-injects USDC paymaster on those paths)
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

  params.appendEvent('relay_part1:skip_send_calls_self_auth')

  return await submitViaPreparedCallsSelfFunded({
    ...params,
    publicClient: params.publicClient,
    ownerDiscovery,
    customOwnerPolicyToken: params.customOwnerPolicyToken,
  })
}
