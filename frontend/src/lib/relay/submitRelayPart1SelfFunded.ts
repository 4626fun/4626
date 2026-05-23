import { createWalletClient, custom, getAddress, type Address, type Hex, type PublicClient } from 'viem'
import { entryPoint06Address, getUserOperationHash } from 'viem/account-abstraction'
import { base } from 'viem/chains'

import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { getWalletErrorMessage } from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'
import { resolveRelayPart1UserOpGasReserveWei } from '@/lib/relay/relayPart1GasReserve'
import {
  assertRelayPart1LandedSelfFunded,
  resolveRelayBundlerUrl,
  resolveRelayPart1DepositTxHash,
} from '@/lib/relay/resolveRelayPart1DepositTxHash'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'
import { waitForCallsTxHash, _submitOwnerViaSendCalls } from '@/lib/wallet/cswSendCalls'
import {
  buildSendPreparedCallsSignaturePayload,
  normalizePreparedCallValueToHex,
} from '@/lib/wallet/onboardingWalletPrepared'
import {
  getUserOpHashWithoutChainIdLocal,
  preflightOwnerKeyMismatch,
  unwrapDoubleHexEncodedHash,
  type V06UserOpFields,
} from '@/lib/wallet/onboardingWalletReplayable'

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
  return getWalletErrorMessage(error)
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

/**
 * Base App returns 4100 ("Must call eth_requestAccounts before other methods")
 * when prepare/sign RPC runs before the in-app wallet session is authorized.
 */
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
}): Promise<{ signature: Hex; preparedCallsSignerAddress: `0x${string}` | null }> {
  params.appendEvent('relay_part1:sign_mode=personal_sign_data_address')
  const signature = (await params.walletRequest({
    method: 'personal_sign',
    params: [params.hashToSign, params.fundingCsw],
  })) as Hex
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }

  let preparedCallsSignerAddress: `0x${string}` | null = null
  try {
    const guardOutcome = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.fundingCsw,
      hashToSign: params.hashToSign,
      signature,
      sessionKind: 'self_auth',
    })
    if (
      (guardOutcome.kind === 'ok' || guardOutcome.kind === 'skipped_self_auth_session_key') &&
      guardOutcome.parsedOwnerAddress
    ) {
      preparedCallsSignerAddress = guardOutcome.parsedOwnerAddress
      params.appendEvent(`relay_part1:prepared_signer=${preparedCallsSignerAddress}`)
    }
  } catch {
    /* fail open — Base App webauthn payloads use sender address */
  }

  return { signature, preparedCallsSignerAddress }
}

async function sendSignedPreparedUserOp(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
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
}): Promise<`0x${string}`> {
  const hashToSign = await resolvePreparedCallsSignHash({
    preparedUserOpRaw: params.preparedUserOpRaw,
    signatureRequestHash: params.signatureRequestHash,
    chainId: params.chainId,
    signAfterPaymasterStrip: params.signAfterPaymasterStrip,
    appendEvent: params.appendEvent,
  })

  const { signature, preparedCallsSignerAddress } = await signSelfAuthPreparedUserOpHash({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    hashToSign,
    appendEvent: params.appendEvent,
  })

  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.fundingCsw,
    signature,
    signerAddress: preparedCallsSignerAddress,
    mode: 'auto',
  })

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

  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: callsId,
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

  const txHash = await resolveRelayPart1DepositTxHash({
    resolution,
    appendEvent: params.appendEvent,
  })
  params.appendEvent(`relay_part1:prepared_tx=${txHash}`)
  return txHash
}

function extractWalletCallsId(sendResult: unknown): string | null {
  if (typeof sendResult === 'string') return sendResult
  if (!sendResult || typeof sendResult !== 'object') return null
  const record = sendResult as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  if (typeof record.callBundleId === 'string') return record.callBundleId
  return null
}

/** Transport-only client — do not set `account`; Base App rejects CSW-as-account before auth. */
function createWalletRequestClient(walletRequest: WalletRequest) {
  return createWalletClient({
    chain: base,
    transport: custom({
      request: async (request) =>
        await walletRequest({
          method: request.method,
          params: request.params as unknown[] | undefined,
        }),
    }),
  })
}

function resolveBundlerUrl(): string {
  return resolveRelayBundlerUrl()
}

function buildSelfFundedPrepareCapabilities(depositWei: bigint, gasReserveWei: bigint): Record<string, unknown> {
  const requiredWei = depositWei + gasReserveWei
  return {
    // EIP-5792: optional paymaster must not block the request; omit URL so we
    // do not route through 4626/CDP sponsorship for Relay Part 1 deposits.
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
    appendEvent: params.appendEvent,
  })

  const txHash = await resolveRelayPart1DepositTxHash({
    resolution,
    appendEvent: params.appendEvent,
  })
  params.appendEvent(`relay_part1:send_calls_tx=${txHash}`)
  return txHash
}

async function submitViaBundlerSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  publicClient: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  params.appendEvent('relay_part1:lane=bundler_self_funded')
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
  const walletClient = createWalletRequestClient(params.walletRequest)
  const result = await sendCoinbaseSmartWalletUserOperation({
    publicClient: params.publicClient as any,
    walletClient: walletClient as any,
    bundlerUrl: resolveBundlerUrl(),
    smartWallet: params.fundingCsw,
    // Self-auth Base App signs via passkey against the CSW address (personal_sign [hash, csw]).
    ownerAddress: params.fundingCsw,
    calls: [
      {
        to: getAddress(params.userCall.to),
        data: params.userCall.data,
        value: BigInt(params.userCall.value),
      },
    ],
    skipPaymaster: true,
    retryOnPrefund: false,
    useTypedDataSigning: true,
    userOpSignMode: 'auto',
  })
  params.appendEvent(`relay_part1:bundler_tx=${result.transactionHash}`)
  return result.transactionHash
}

async function submitViaPreparedCallsSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  const valueHex = normalizePreparedCallValueToHex(params.userCall.value)
  params.appendEvent('relay_part1:lane=prepare_calls_self_funded')

  await ensureSelfAuthWalletAuthorized({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
  })

  if (params.publicClient) {
    await assertSelfFundedPrefundBudget({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      depositWei: BigInt(params.userCall.value),
      appendEvent: params.appendEvent,
    })
  }

  const depositWei = BigInt(params.userCall.value)
  const gasReserveWei = await resolveRelayPart1UserOpGasReserveWei(params.publicClient ?? null)
  params.appendEvent(`relay_part1:prepare_required_gas_reserve_wei=${gasReserveWei.toString(10)}`)
  const prepareCapabilities = buildSelfFundedPrepareCapabilities(depositWei, gasReserveWei)

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

  if (userOpHasPaymaster(prepareResult.userOp)) {
    const paymaster = parseEntryPointPaymasterAddress(
      readPreparedUserOpPaymasterAndData(prepareResult.userOp),
    )
    params.appendEvent(`relay_part1:warn prepared_userop_paymaster=${paymaster ?? 'unknown'}`)

    params.appendEvent('relay_part1:lane=prepare_calls_strip_paymaster_self_funded')
    let stripError: unknown = null
    try {
      const strippedOp = stripUserOpPaymaster(parseWalletPreparedUserOpV06(prepareResult.userOp))
      params.appendEvent('relay_part1:prepared_userop_paymaster=0x0')

      return await sendSignedPreparedUserOp({
        walletRequest: params.walletRequest,
        fundingCsw: params.fundingCsw,
        prepareResult: {
          type: prepareResult.type,
          chainId: prepareResult.chainId,
          userOp: serializeUserOpForPreparedCallsSend(strippedOp),
        },
        preparedUserOpRaw: prepareResult.userOp,
        signatureRequestHash: prepareResult.signatureRequest.hash as Hex,
        signAfterPaymasterStrip: true,
        chainId: params.chainId,
        chainIdHex,
        appendEvent: params.appendEvent,
      })
    } catch (error) {
      stripError = error
      params.appendEvent(
        `relay_part1:strip_paymaster_error=${formatRelayPart1Error(error).slice(0, 220)}`,
      )
    }

    if (params.publicClient) {
      try {
        return await submitViaBundlerSelfFunded({
          walletRequest: params.walletRequest,
          fundingCsw: params.fundingCsw,
          userCall: params.userCall,
          publicClient: params.publicClient,
          appendEvent: params.appendEvent,
        })
      } catch (bundlerError) {
        params.appendEvent(
          `relay_part1:bundler_fallback_error=${formatRelayPart1Error(bundlerError).slice(0, 220)}`,
        )
      }
    }

    if (stripError) {
      throw stripError
    }

    params.appendEvent('relay_part1:warn send_calls_blocked_paymaster_injected')
    throw new Error(
      'Base App injected a USDC paymaster for this deposit. That path stalls Relay Part 2 (addOwnerAddress). Tap Rebuild preview, then retry Enable 4626 signing so we can submit a self-funded UserOp instead.',
    )
  }

  params.appendEvent('relay_part1:prepared_userop_paymaster=0x0')

  return await sendSignedPreparedUserOp({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    prepareResult: {
      type: prepareResult.type,
      chainId: prepareResult.chainId,
      userOp: serializeUserOpForPreparedCallsSend(parseWalletPreparedUserOpV06(prepareResult.userOp)),
    },
    preparedUserOpRaw: prepareResult.userOp,
    signatureRequestHash: prepareResult.signatureRequest.hash as Hex,
    signAfterPaymasterStrip: false,
    chainId: params.chainId,
    chainIdHex,
    appendEvent: params.appendEvent,
  })
}

/**
 * Submit Relay Part 1 (Depository.depositNative) from a Base App self-auth CSW
 * without ERC-4337 paymaster sponsorship (native ETH / EntryPoint prefund only).
 *
 * Lane order matches the May 12 in-repo golden path (`67e90d9b3` /remove-owner):
 *   1. `wallet_sendCalls` with preview-bound Depository `depositNative` only
 *   2. `wallet_prepareCalls` → strip paymaster → `wallet_sendPreparedCalls`
 *   3. Direct self-funded bundler UserOp when publicClient is available
 *
 * EntryPoint v0.6 self-fund path: when `paymasterAndData` is empty, `_validateAccountPrepayment`
 * sets `missingAccountFunds = requiredPrefund - (nativeBalance + EntryPoint.deposits[sender])`
 * and the CSW `payPrefund` modifier tops up EntryPoint from native ETH.
 */
export async function submitSelfAuthRelayPart1SelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  /**
   * When prepare/sendCalls lanes fail, fall back to a direct self-funded bundler
   * UserOp (paymasterAndData = 0x). Requires publicClient.
   */
  allowBundlerFallback?: boolean
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const allowBundlerFallback =
    params.allowBundlerFallback !== false && Boolean(params.publicClient)

  let lastError: unknown = null

  try {
    return await submitViaSendCallsSelfFunded({
      walletRequest: params.walletRequest,
      fundingCsw: params.fundingCsw,
      userCall: params.userCall,
      chainId: params.chainId,
      publicClient: params.publicClient,
      appendEvent: params.appendEvent,
    })
  } catch (sendCallsError) {
    lastError = sendCallsError
    if (isUserRejectedWalletAction(sendCallsError)) {
      throw sendCallsError
    }
    params.appendEvent(
      `relay_part1:send_calls_error=${formatRelayPart1Error(sendCallsError).slice(0, 220)}`,
    )
  }

  try {
    return await submitViaPreparedCallsSelfFunded({
      ...params,
    })
  } catch (preparedError) {
    lastError = preparedError
    if (isUserRejectedWalletAction(preparedError)) {
      throw preparedError
    }
    params.appendEvent(
      `relay_part1:prepare_calls_error=${formatRelayPart1Error(preparedError).slice(0, 220)}`,
    )
  }

  if (!allowBundlerFallback || !params.publicClient) {
    throw lastError instanceof Error
      ? lastError
      : new Error(formatRelayPart1Error(lastError))
  }

  return await submitViaBundlerSelfFunded({
    walletRequest: params.walletRequest,
    fundingCsw: params.fundingCsw,
    userCall: params.userCall,
    publicClient: params.publicClient,
    appendEvent: params.appendEvent,
  })
}
