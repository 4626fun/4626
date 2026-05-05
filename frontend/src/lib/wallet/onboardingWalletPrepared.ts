import { recoverAddress } from 'viem'

import { classifyOwnerApprovalError } from './onboardingWalletErrors'
import {
  classifyWebAuthnOwnerSignature,
  hexByteLength,
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

export function buildSendPreparedCallsSignaturePayload(input: {
  sender: `0x${string}`
  signature: `0x${string}`
}): unknown {
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
  paymasterUrl: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  signerAddress: string | null
  canonicalCswAddress: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
  sessionKind?: 'self_auth' | 'external_signer'
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
  if (params.paymasterUrl) {
    const paymasterUrlStr = String(params.paymasterUrl).trim().replace(
      'https://api.developer.coinbase.com/',
      'https://api.cdp.coinbase.com/',
    )
    capabilities.paymasterService = { url: paymasterUrlStr }
  }
  const prepareCallsPayload: Record<string, unknown> = {
    version: '1.0',
    from: params.sender,
    chainId: chainIdHex,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
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

  const hashToSign = unwrapDoubleHexEncodedHash(prepareResult.signatureRequest.hash as `0x${string}`)
  const signature = await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, params.sender],
  }) as `0x${string}`
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }
  const signatureBytes = hexByteLength(signature)
  if (signatureBytes !== 65 && params.sessionKind === 'self_auth') {
    throw new Error(
      `wallet_sendPreparedCalls cannot be submitted with a ${signatureBytes}-byte self-auth signature wrapper. ` +
      'Retry through wallet_sendCalls or relay fallback for this Base App session.',
    )
  }

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
  } catch (guardError) {
    if (guardError instanceof Error && guardError.message.startsWith('Signature does not match parsed owner')) {
      throw guardError
    }
  }

  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.sender,
    signature,
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
  const chainIdHex = `0x${params.chainId.toString(16)}`
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

  const sendResult = await withTimeout(
    params.walletRequest({
      method: 'wallet_sendCalls',
      params: [{
        version: '1.0',
        from: params.sender,
        chainId: chainIdHex,
        atomicRequired: true,
        calls: [{ to: params.to, data: params.data, value: '0x0' }],
        capabilities,
      }],
    }),
    WALLET_SEND_CALLS_REQUEST_TIMEOUT_MS,
    new Error(
      'wallet_sendCalls request timed out waiting for Coinbase Wallet. Retry in your external browser, then continue with relay fallback if needed.',
    ),
  )
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
  if (params.paymasterUrl) {
    const paymasterUrlStr = String(params.paymasterUrl).trim().replace(
      'https://api.developer.coinbase.com/',
      'https://api.cdp.coinbase.com/',
    )
    capabilities.paymasterService = { url: paymasterUrlStr }
  }
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
