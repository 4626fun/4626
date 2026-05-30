import { getAddress, recoverAddress, type Hex } from 'viem'

import { buildWalletSendCallsPayload } from '@/lib/wallet/walletSendCallsPayload'
import {
  classifyWebAuthnOwnerSignature,
  hexByteLength,
  parseCoinbaseSignatureWrapper,
  preflightOwnerKeyMismatch,
  unwrapDoubleHexEncodedHash,
} from './onboardingWalletReplayable'

type OwnerApprovalExecutionMode = 'canonicalSmartWallet' | 'ownerDirect' | 'subAccount'
type OwnerApprovalStage =
  | 'preflight'
  | 'prepare'
  | 'prepare_calls'
  | 'userop_typed'
  | 'userop_nontyped'
  | 'send_calls'
  | 'add_sub_account'
  | 'confirm_owner'
type OwnerApprovalStageStatus = 'start' | 'retry' | 'success' | 'error'
type OwnerApprovalStageEvent = {
  runId: string
  stage: OwnerApprovalStage
  status: OwnerApprovalStageStatus
  attempt?: number
  executionMode: OwnerApprovalExecutionMode
  signerAddress?: string | null
  canonicalCswAddress?: string | null
  txHash?: string | null
  code?: string
  message?: string
}

const PREPARED_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 12_000
const PREPARED_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500
const WALLET_SEND_CALLS_REQUEST_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 50 : 60_000
export type PreparedCallsSignaturePayloadMode =
  | 'auto'
  | 'inner_secp256k1'
  | 'full_wrapper_secp256k1'
  | 'full_wrapper_webauthn'
export type PreparedCallsSignHashMode = 'unwrapped' | 'raw_signature_request'
export type PreparedCallsSignRequestMode =
  | 'personal_sign_data_address'
  | 'personal_sign_address_data'
  | 'eth_sign_address_data'

/**
 * Convert a native-value input (hex `0x...` or decimal `"123"`, or undefined)
 * into the 0x-prefixed hex string `wallet_prepareCalls` expects. Empty / null
 * / non-numeric inputs collapse to `'0x0'`.
 */
export function normalizePreparedCallValueToHex(value: string | number | bigint | undefined | null): `0x${string}` {
  if (value === undefined || value === null || value === '') return '0x0'
  if (typeof value === 'bigint') return `0x${value.toString(16)}`
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return '0x0'
    return `0x${BigInt(Math.trunc(value)).toString(16)}`
  }
  const trimmed = value.trim()
  if (!trimmed) return '0x0'
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    // Already hex; canonicalize to lowercase and strip any leading-zero pad.
    try {
      return `0x${BigInt(trimmed).toString(16)}`
    } catch {
      return '0x0'
    }
  }
  if (/^[0-9]+$/.test(trimmed)) {
    try {
      return `0x${BigInt(trimmed).toString(16)}`
    } catch {
      return '0x0'
    }
  }
  return '0x0'
}

/**
 * Convert a native-value input (hex `0x...` or decimal `"123"`, or undefined)
 * into a plain decimal string. Used when forwarding to upstream APIs (like
 * Relay `/quote/v2`) that only accept decimal integers in their `amount` and
 * `value` fields.
 */
export function normalizePreparedCallValueToDecimal(
  value: string | number | bigint | undefined | null,
): string {
  if (value === undefined || value === null || value === '') return '0'
  if (typeof value === 'bigint') return value.toString(10)
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return '0'
    return BigInt(Math.trunc(value)).toString(10)
  }
  const trimmed = value.trim()
  if (!trimmed) return '0'
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    try {
      return BigInt(trimmed).toString(10)
    } catch {
      return '0'
    }
  }
  if (/^[0-9]+$/.test(trimmed)) return trimmed
  return '0'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolvePreparedCallsPaymasterUrl(paymasterUrl: string | null): string | null {
  const directEnv = String(import.meta.env.VITE_CDP_SENDCALLS_PAYMASTER_URL ?? '').trim()
  if (/^https?:\/\//i.test(directEnv)) {
    return directEnv.replace(
      'https://api.developer.coinbase.com/',
      'https://api.cdp.coinbase.com/',
    )
  }
  if (!paymasterUrl) return null
  const normalized = String(paymasterUrl).trim()
  if (!/^https?:\/\//i.test(normalized)) return null
  return normalized.replace(
    'https://api.developer.coinbase.com/',
    'https://api.cdp.coinbase.com/',
  )
}

function emitOwnerApprovalStage(
  callback: ((event: OwnerApprovalStageEvent) => void) | null | undefined,
  event: OwnerApprovalStageEvent,
): void {
  try {
    callback?.(event)
  } catch {}
}

function extractWalletCallsId(sendResult: unknown): string {
  if (typeof sendResult === 'string') return sendResult
  if (Array.isArray(sendResult) && typeof sendResult[0] === 'string') return sendResult[0]
  if (sendResult && typeof sendResult === 'object') {
    const record = sendResult as Record<string, unknown>
    if (typeof record.id === 'string') return record.id
    if (Array.isArray(record.ids) && typeof record.ids[0] === 'string') return record.ids[0]
    if (Array.isArray(record.callIds) && typeof record.callIds[0] === 'string') return record.callIds[0]
    if (Array.isArray(record.preparedCallIds) && typeof record.preparedCallIds[0] === 'string') {
      return record.preparedCallIds[0]
    }
  }
  return ''
}

function extractWalletCallsTxHash(statusResult: unknown): `0x${string}` | null {
  const record = statusResult && typeof statusResult === 'object'
    ? statusResult as Record<string, unknown>
    : null
  const capabilities = record?.capabilities && typeof record.capabilities === 'object'
    ? record.capabilities as Record<string, unknown>
    : null
  const caip345 = capabilities?.caip345 && typeof capabilities.caip345 === 'object'
    ? capabilities.caip345 as Record<string, unknown>
    : null
  const capabilityHashes = Array.isArray(caip345?.transactionHashes)
    ? caip345.transactionHashes
    : []
  const receipts = Array.isArray(record?.receipts) ? record.receipts : []
  const candidates = [
    record?.transactionHash,
    record?.txHash,
    ...capabilityHashes,
    ...receipts.map((receipt) => (receipt as { transactionHash?: unknown } | null)?.transactionHash),
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isTxHash(candidate)) return candidate as `0x${string}`
  }
  return null
}

async function pollWalletCallsStatusForTxHash(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  callsId: string
  approvalRunId: string
  stage: OwnerApprovalStage
  executionMode: OwnerApprovalExecutionMode
  signerAddress: string | null
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
}): Promise<`0x${string}`> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < PREPARED_CALLS_STATUS_TIMEOUT_MS) {
    const statusResult = await params.walletRequest({ method: 'wallet_getCallsStatus', params: [params.callsId] })
    const statusCode = Number((statusResult as { status?: unknown } | null)?.status)
    const txHash = extractWalletCallsTxHash(statusResult)
    if (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 300) {
      if (!txHash) {
        throw new Error('wallet_sendCalls completed without a transaction hash. Retry shortly.')
      }
      emitOwnerApprovalStage(params.onStageEvent, {
        runId: params.approvalRunId,
        stage: params.stage,
        status: 'success',
        executionMode: params.executionMode,
        signerAddress: params.signerAddress,
        canonicalCswAddress: params.canonicalCswAddress,
        txHash,
      })
      return txHash
    }
    if (Number.isFinite(statusCode) && statusCode >= 300) {
      throw new Error(`wallet_sendCalls failed with status ${statusCode}`)
    }
    await delay(PREPARED_CALLS_STATUS_POLL_MS)
  }
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: params.stage,
    status: 'error',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
    code: 'wallet_send_calls_pending_timeout',
    message: 'wallet_sendCalls status is still pending.',
  })
  throw new Error('wallet_sendCalls status is still pending. Wait a moment and retry confirmation.')
}

/** Coinbase Smart Wallet EIP-712 envelope for ERC-4337 UserOp hashes (Base App self-auth). */
export const CSW_USER_OP_EIP712_TYPES = {
  CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
} as const

export function buildCswUserOpTypedDataPayload(params: {
  smartWallet: `0x${string}`
  chainId: number
  userOpHash: Hex
}) {
  return {
    domain: {
      name: 'Coinbase Smart Wallet',
      version: '1',
      chainId: params.chainId,
      verifyingContract: getAddress(params.smartWallet),
    },
    types: CSW_USER_OP_EIP712_TYPES,
    primaryType: 'CoinbaseSmartWalletMessage' as const,
    message: { hash: params.userOpHash },
  }
}

/**
 * Base App self-auth CSW signing for prepared UserOps. Prefer this over
 * `personal_sign` — Coinbase Wallet often rejects raw-hash personal_sign in-app.
 */
export async function signCswUserOpHashViaTypedDataV4(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  smartWallet: `0x${string}`
  /** Self-auth passkey sessions sign with the CSW address as the typed-data account. */
  signerAddress: `0x${string}`
  chainId: number
  userOpHash: Hex
}): Promise<Hex> {
  const typedData = buildCswUserOpTypedDataPayload({
    smartWallet: params.smartWallet,
    chainId: params.chainId,
    userOpHash: params.userOpHash,
  })
  const signature = (await params.walletRequest({
    method: 'eth_signTypedData_v4',
    params: [getAddress(params.signerAddress), JSON.stringify(typedData)],
  })) as Hex
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('eth_signTypedData_v4 did not return a valid signature.')
  }
  return signature
}

export function buildSendPreparedCallsSignaturePayload(input: {
  sender: `0x${string}`
  signature: `0x${string}`
  signerAddress?: `0x${string}` | null
  mode?: PreparedCallsSignaturePayloadMode
}): unknown {
  const mode = input.mode ?? 'auto'
  const wrapped = parseCoinbaseSignatureWrapper(input.signature)
  if (mode === 'full_wrapper_secp256k1') {
    return {
      type: 'secp256k1' as const,
      data: { address: input.signerAddress ?? input.sender, signature: input.signature },
    }
  }
  if (mode === 'full_wrapper_webauthn') {
    return {
      type: 'webauthn' as const,
      data: { address: input.sender, signature: input.signature },
    }
  }
  if (mode === 'inner_secp256k1') {
    return {
      type: 'secp256k1' as const,
      data: { address: input.signerAddress ?? input.sender, signature: wrapped?.signatureData ?? input.signature },
    }
  }
  if (wrapped && hexByteLength(wrapped.signatureData) === 65) {
    return {
      type: 'secp256k1' as const,
      data: { address: input.signerAddress ?? input.sender, signature: wrapped.signatureData },
    }
  }
  const sigBytes = (input.signature.length - 2) / 2
  if (sigBytes === 65) {
    return {
      type: 'secp256k1' as const,
      data: { address: input.sender, signature: input.signature },
    }
  }
  return {
    type: 'webauthn' as const,
    data: {
      signature: input.signature,
      address: input.sender,
    },
  }
}

export async function _submitOwnerViaPreparedCalls(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  /**
   * Optional native-currency value to forward with the prepared call. Defaults
   * to `'0x0'` for backwards compatibility with the original owner-install
   * call sites that always passed zero. Callers that lift a tx from a Relay
   * `/quote/v2` step item (which may include a non-zero value for depository
   * top-ups) should forward it here so the prepared UserOp matches Relay's
   * quoted shape. Accepts a hex string (`0x...`) or a decimal string.
   */
  value?: string
  paymasterUrl: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  signerAddress: string | null
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
  sessionKind?: 'self_auth' | 'external_signer'
  requireWebAuthnOwnerIndexZero?: boolean
  signaturePayloadMode?: PreparedCallsSignaturePayloadMode
  signHashMode?: PreparedCallsSignHashMode
  signRequestMode?: PreparedCallsSignRequestMode
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'prepare_calls',
    status: 'start',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
  })

  const capabilities: Record<string, unknown> = {}
  const paymasterUrlStr = resolvePreparedCallsPaymasterUrl(params.paymasterUrl)
  if (paymasterUrlStr) capabilities.paymasterService = { url: paymasterUrlStr }
  // Normalize value to a 0x-prefixed hex string. wallet_prepareCalls expects
  // hex for native value. Accept either hex or decimal input from callers.
  const valueHex = normalizePreparedCallValueToHex(params.value)
  const prepareCallsPayload: Record<string, unknown> = {
    version: '1.0',
    from: params.sender,
    chainId: chainIdHex,
    calls: [{ to: params.to, data: params.data, value: valueHex }],
    capabilities,
  }

  const prepareResult = await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [prepareCallsPayload],
  }) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null
  if (!prepareResult?.signatureRequest?.hash) throw new Error('wallet_prepareCalls did not return a signature request hash.')
  if (!prepareResult.userOp) throw new Error('wallet_prepareCalls did not return a userOp.')

  const signatureRequestHashRaw = prepareResult.signatureRequest.hash as `0x${string}`
  const unwrappedHashToSign = unwrapDoubleHexEncodedHash(signatureRequestHashRaw)
  const hashToSign = params.signHashMode === 'raw_signature_request'
    ? signatureRequestHashRaw
    : unwrappedHashToSign
  const signRequestMode = params.signRequestMode ?? 'personal_sign_data_address'
  const signature = await params.walletRequest(
    signRequestMode === 'eth_sign_address_data'
      ? {
          method: 'eth_sign',
          params: [params.sender, hashToSign],
        }
      : signRequestMode === 'personal_sign_address_data'
        ? {
            method: 'personal_sign',
            params: [params.sender, hashToSign],
          }
        : {
            method: 'personal_sign',
            params: [hashToSign, params.sender],
          },
  ) as `0x${string}`
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }
  const webAuthnClassification = classifyWebAuthnOwnerSignature(signature)
  if (params.requireWebAuthnOwnerIndexZero) {
    if (!webAuthnClassification.ok || webAuthnClassification.ownerIndex !== 0) {
      throw new Error(
        'Expected a Coinbase/Base App WebAuthn owner[0] signature. Re-open in Base App and approve with the canonical passkey.',
      )
    }
  }

  let preparedCallsSignerAddress: `0x${string}` | null = null
  try {
    const guardOutcome = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.sender,
      hashToSign,
      signature,
      sessionKind: params.sessionKind,
    })
    if (guardOutcome.kind === 'mismatch') {
      const rawPart = guardOutcome.recoveredRawAddress ?? 'n/a'
      const eip191Part = guardOutcome.recoveredEip191Address ?? 'n/a'
      throw new Error(
        `Signature does not match parsed owner [${guardOutcome.parsedOwnerIndex}] (${guardOutcome.parsedOwnerAddress}). ` +
          `Recovered raw=${rawPart}, eip191=${eip191Part}. The connected wallet may be signing with a sub-account key ` +
          `that is not on-chain. Try the EOA-owner submission lane (sendPreparedOwnerCallsWithEoaOwner).`,
      )
    }
    if (guardOutcome.kind === 'ok' && guardOutcome.parsedOwnerAddress) {
      preparedCallsSignerAddress = guardOutcome.parsedOwnerAddress
    }
    if (guardOutcome.kind === 'skipped_self_auth_session_key' && guardOutcome.parsedOwnerAddress) {
      preparedCallsSignerAddress = guardOutcome.parsedOwnerAddress
    }
  } catch (guardError) {
    if (guardError instanceof Error && guardError.message.startsWith('Signature does not match parsed owner')) {
      throw guardError
    }
  }

  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.sender,
    signature,
    signerAddress: preparedCallsSignerAddress,
    mode: params.signaturePayloadMode,
  })

  let sendResult: unknown
  try {
    sendResult = await params.walletRequest({
      method: 'wallet_sendPreparedCalls',
      params: [{
        version: '1.0',
        type: prepareResult.type ?? 'user-operation-v06',
        data: prepareResult.userOp,
        chainId: prepareResult.chainId ?? chainIdHex,
        signature: signaturePayload,
      }],
    }) as unknown
  } catch (sendErr: unknown) {
    throw sendErr
  }

  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) throw new Error('wallet_sendPreparedCalls returned no call bundle id.')

  const startedAt = Date.now()
  while (Date.now() - startedAt < PREPARED_CALLS_STATUS_TIMEOUT_MS) {
    const result = await params.walletRequest({ method: 'wallet_getCallsStatus', params: [callsId] })
    const statusCode = Number((result as { status?: unknown } | null)?.status)
    const receipts = Array.isArray((result as { receipts?: unknown[] } | null)?.receipts)
      ? ((result as { receipts: unknown[] }).receipts ?? [])
      : []
    const receiptHash =
      receipts
        .map((receipt) => String((receipt as { transactionHash?: unknown } | null)?.transactionHash ?? ''))
        .find((value) => isTxHash(value)) ?? null
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 200 && statusCode < 300) {
        if (receiptHash) {
          emitOwnerApprovalStage(params.onStageEvent, {
            runId: params.approvalRunId,
            stage: 'prepare_calls',
            status: 'success',
            executionMode: params.executionMode,
            signerAddress: params.signerAddress,
            canonicalCswAddress: params.canonicalCswAddress,
            txHash: receiptHash,
          })
          return receiptHash
        }
        throw new Error('wallet_sendPreparedCalls completed without a transaction hash. Retry shortly.')
      }
      if (statusCode >= 300) {
        throw new Error(`wallet_sendPreparedCalls failed with status ${statusCode}`)
      }
    }
    await delay(PREPARED_CALLS_STATUS_POLL_MS)
  }

  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'prepare_calls',
    status: 'error',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
    code: 'prepared_calls_pending_timeout',
    message: 'wallet_sendPreparedCalls status is still pending.',
  })
  throw new Error('wallet_sendPreparedCalls status is still pending. Wait a moment and retry confirmation.')
}

export async function _submitOwnerViaPreparedCallsAllowAnyOwner(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  paymasterUrl: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  signerAddress: string | null
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'prepare_calls',
    status: 'start',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
  })
  const capabilities: Record<string, unknown> = {}
  const paymasterUrlStr = resolvePreparedCallsPaymasterUrl(params.paymasterUrl)
  if (paymasterUrlStr) capabilities.paymasterService = { url: paymasterUrlStr }
  const prepareResult = await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [{
      version: '1.0',
      from: params.sender,
      chainId: chainIdHex,
      calls: [{ to: params.to, data: params.data, value: '0x0' }],
      capabilities,
    }],
  }) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null
  if (!prepareResult?.signatureRequest?.hash) throw new Error('wallet_prepareCalls did not return a signature request hash.')
  if (!prepareResult.userOp) throw new Error('wallet_prepareCalls did not return a userOp.')

  const hashToSign = unwrapDoubleHexEncodedHash(prepareResult.signatureRequest.hash as `0x${string}`)
  const signature = await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, params.sender],
  }) as `0x${string}`
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }
  const wrappedSignature = parseCoinbaseSignatureWrapper(signature)
  if (wrappedSignature?.ownerIndex === 3) {
    throw new Error(
      'This smart wallet still has a mistaken owner in slot 3 from an earlier attempt. Remove that owner in Accounts or Base App, then retry.',
    )
  }
  let signerAddress: `0x${string}` = params.sender
  try {
    const guardOutcome = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.sender,
      hashToSign,
      signature,
      sessionKind: 'self_auth',
    })
    if (
      (guardOutcome.kind === 'ok' || guardOutcome.kind === 'skipped_self_auth_session_key') &&
      'parsedOwnerAddress' in guardOutcome &&
      guardOutcome.parsedOwnerAddress
    ) {
      if ('parsedOwnerIndex' in guardOutcome && guardOutcome.parsedOwnerIndex === 3) {
        throw new Error(
          'This smart wallet still has a mistaken owner in slot 3 from an earlier attempt. Remove that owner in Accounts or Base App, then retry.',
        )
      }
      signerAddress = guardOutcome.parsedOwnerAddress
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('mistaken owner in slot 3')) {
      throw error
    }
    /* fail open — Base App passkey/session-key payloads use CSW sender address */
  }
  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.sender,
    signature,
    signerAddress,
    mode: 'inner_secp256k1',
  })

  const sendResult = await params.walletRequest({
    method: 'wallet_sendPreparedCalls',
    params: [{
      version: '1.0',
      type: prepareResult.type ?? 'user-operation-v06',
      data: prepareResult.userOp,
      chainId: prepareResult.chainId ?? chainIdHex,
      signature: signaturePayload,
    }],
  }) as unknown
  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
  return await pollWalletCallsStatusForTxHash({
    walletRequest: params.walletRequest,
    callsId,
    approvalRunId: params.approvalRunId,
    stage: 'prepare_calls',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
    onStageEvent: params.onStageEvent,
  })
}

export async function _submitOwnerViaWalletSendCalls(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  paymasterUrl: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  signerAddress: string | null
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
}): Promise<`0x${string}`> {
  const capabilities: Record<string, unknown> = {}
  if (params.paymasterUrl) {
    const normalizedPaymaster = String(params.paymasterUrl).trim()
    if (/^https?:\/\//i.test(normalizedPaymaster)) {
      capabilities.paymasterService = {
        url: normalizedPaymaster.replace(
          'https://api.developer.coinbase.com/',
          'https://api.cdp.coinbase.com/',
        ),
      }
    }
  }
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'send_calls',
    status: 'start',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
  })

  const sendCallsPayload = {
    ...buildWalletSendCallsPayload({
      from: params.sender,
      chainId: params.chainId,
      atomicRequired: true,
      calls: [{ to: params.to, data: params.data, value: 0n }],
    }),
    ...(Object.keys(capabilities).length > 0 ? { capabilities } : {}),
  }
  let sendResult: unknown
  try {
    sendResult = await withTimeout(
      params.walletRequest({
        method: 'wallet_sendCalls',
        params: [sendCallsPayload],
      }),
      WALLET_SEND_CALLS_REQUEST_TIMEOUT_MS,
      new Error(
        'wallet_sendCalls request timed out waiting for Coinbase Wallet. Retry in your external browser, then continue with relay fallback if needed.',
      ),
    )
  } catch (sendCallsError) {
    throw sendCallsError
  }
  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) throw new Error('wallet_sendCalls returned no call bundle id.')

  return await pollWalletCallsStatusForTxHash({
    walletRequest: params.walletRequest,
    callsId,
    approvalRunId: params.approvalRunId,
    stage: 'send_calls',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
    onStageEvent: params.onStageEvent,
  })
}

export async function _submitOwnerViaPreparedCallsWithEoaOwner(params: {
  cswRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  signerRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  eoaOwnerAddress: `0x${string}`
  eoaOwnerIndex: number
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  paymasterUrl: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'prepare_calls',
    status: 'start',
    executionMode: params.executionMode,
    signerAddress: params.eoaOwnerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
  })

  const capabilities: Record<string, unknown> = {}
  const paymasterUrlStr = resolvePreparedCallsPaymasterUrl(params.paymasterUrl)
  if (paymasterUrlStr) capabilities.paymasterService = { url: paymasterUrlStr }
  const prepareCallsPayload: Record<string, unknown> = {
    version: '1.0',
    from: params.sender,
    chainId: chainIdHex,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
    capabilities,
  }

  const prepareResult = (await params.cswRequest({
    method: 'wallet_prepareCalls',
    params: [prepareCallsPayload],
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

  const userOpHash = unwrapDoubleHexEncodedHash(
    prepareResult.signatureRequest.hash as `0x${string}`,
  )
  const rawSignature = (await params.signerRequest({
    method: 'personal_sign',
    params: [userOpHash, params.eoaOwnerAddress],
  })) as `0x${string}`

  if (!rawSignature || typeof rawSignature !== 'string' || !rawSignature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }
  if (hexByteLength(rawSignature) !== 65) {
    throw new Error(
      `EOA-owner submission expects a 65-byte ECDSA signature, got ${hexByteLength(rawSignature)} bytes.`,
    )
  }

  let recovered: `0x${string}`
  try {
    recovered = await recoverAddress({ hash: userOpHash, signature: rawSignature })
  } catch (recoveryError) {
    throw new Error(
      `Could not recover signer from userOpHash signature: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
    )
  }
  if (recovered.toLowerCase() !== params.eoaOwnerAddress.toLowerCase()) {
    throw new Error(
      `EOA-owner signature recovered to ${recovered}, not the expected on-chain owner ${params.eoaOwnerAddress}. ` +
        `The connected wallet may be signing with a substituted key. Connect ${params.eoaOwnerAddress} directly and retry.`,
    )
  }

  const signaturePayload = {
    type: 'secp256k1' as const,
    data: {
      address: params.eoaOwnerAddress,
      signature: rawSignature,
    },
  }

  const sendResult = (await params.cswRequest({
    method: 'wallet_sendPreparedCalls',
    params: [{
      version: '1.0',
      type: prepareResult.type ?? 'user-operation-v06',
      data: prepareResult.userOp,
      chainId: prepareResult.chainId ?? chainIdHex,
      signature: signaturePayload,
      ownerIndex: params.eoaOwnerIndex,
    }],
  })) as unknown

  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) {
    throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < PREPARED_CALLS_STATUS_TIMEOUT_MS) {
    const result = await params.cswRequest({ method: 'wallet_getCallsStatus', params: [callsId] })
    const statusCode = Number((result as { status?: unknown } | null)?.status)
    const receipts = Array.isArray((result as { receipts?: unknown[] } | null)?.receipts)
      ? ((result as { receipts: unknown[] }).receipts ?? [])
      : []
    const receiptHash =
      receipts
        .map((receipt) => String((receipt as { transactionHash?: unknown } | null)?.transactionHash ?? ''))
        .find((value) => isTxHash(value)) ?? null
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 200 && statusCode < 300) {
        if (receiptHash) {
          emitOwnerApprovalStage(params.onStageEvent, {
            runId: params.approvalRunId,
            stage: 'prepare_calls',
            status: 'success',
            executionMode: params.executionMode,
            signerAddress: params.eoaOwnerAddress,
            canonicalCswAddress: params.canonicalCswAddress,
            txHash: receiptHash,
          })
          return receiptHash
        }
        throw new Error('wallet_sendPreparedCalls completed without a transaction hash. Retry shortly.')
      }
      if (statusCode >= 300) {
        throw new Error(`wallet_sendPreparedCalls failed with status ${statusCode}`)
      }
    }
    await delay(PREPARED_CALLS_STATUS_POLL_MS)
  }

  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'prepare_calls',
    status: 'error',
    executionMode: params.executionMode,
    signerAddress: params.eoaOwnerAddress,
    canonicalCswAddress: params.canonicalCswAddress,
    code: 'prepared_calls_pending_timeout',
    message: 'wallet_sendPreparedCalls status is still pending.',
  })
  throw new Error('wallet_sendPreparedCalls status is still pending. Wait a moment and retry confirmation.')
}
