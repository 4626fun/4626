import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { isAddress } from 'viem'
import { base } from 'viem/chains'
export type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export type OwnerDelegationFlags = {
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
}

export type OnboardingBootstrapResponse = {
  chainId: 8453
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  privyIsOwner: boolean
}

export type PrepareOwnerResponse =
  | { alreadyOwner: true }
  | {
      alreadyOwner: false
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
    }

export type ConfirmOwnerResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
  confirmationState?: 'owner_confirmed' | 'pending_tx' | 'owner_not_found_yet' | 'tx_failed'
}

export type PreparedOwnerTxRequest = {
  chainId: 8453
  to: `0x${string}`
  data: `0x${string}`
  value: '0x0'
}

export type OwnerApprovalExecutionMode = 'canonicalSmartWallet' | 'ownerDirect' | 'subAccount'

export type OwnerApprovalStage =
  | 'preflight'
  | 'prepare'
  | 'prepare_calls'
  | 'userop_typed'
  | 'userop_nontyped'
  | 'send_calls'
  | 'add_sub_account'
  | 'confirm_owner'

export type OwnerApprovalStageStatus = 'start' | 'retry' | 'success' | 'error'

export type OwnerApprovalStageEvent = {
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

export function readApiError(payload: unknown, fallback: string): string {
  return resolveApiErrorMessage(payload, fallback)
}

export function readOwnerDelegationFlags(payload: unknown): OwnerDelegationFlags {
  if (!payload || typeof payload !== 'object') return {}
  const record = payload as Record<string, unknown>
  return {
    ...(record.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
    ...(record.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
    ...(typeof record.baseAppUrl === 'string' && record.baseAppUrl.trim() ? { baseAppUrl: record.baseAppUrl.trim() } : null),
  }
}

export function buildOwnerDelegationError(payload: unknown, fallback: string): Error & OwnerDelegationFlags {
  const flags = readOwnerDelegationFlags(payload)
  const hint = flags.needsBaseAppSetup
    ? 'Open Base app, create or connect your Coinbase Smart Wallet, then return here to resume.'
    : flags.needsEmbeddedWallet
      ? 'Your Privy embedded wallet is still provisioning. Retry in a moment.'
      : ''
  const message = hint ? `${readApiError(payload, fallback)} ${hint}` : readApiError(payload, fallback)
  const error = new Error(message) as Error & OwnerDelegationFlags
  if (flags.needsEmbeddedWallet) error.needsEmbeddedWallet = true
  if (flags.needsBaseAppSetup) error.needsBaseAppSetup = true
  if (flags.baseAppUrl) error.baseAppUrl = flags.baseAppUrl
  return error
}

export function deriveOwnerDelegationFlags(flags: {
  needsEmbeddedWallet: boolean
  needsBaseAppSetup: boolean
  baseAppUrl: string | null
}): OwnerDelegationFlags | null {
  if (!flags.needsBaseAppSetup && !flags.needsEmbeddedWallet) return null
  return {
    ...(flags.needsBaseAppSetup ? { needsBaseAppSetup: true } : null),
    ...(flags.needsEmbeddedWallet ? { needsEmbeddedWallet: true } : null),
    ...(flags.baseAppUrl ? { baseAppUrl: flags.baseAppUrl } : null),
  }
}

export function shouldRefreshOwnerDelegationOnForeground(input: {
  privyAuthed: boolean
  ownerDelegationFlags: OwnerDelegationFlags | null
  busy: boolean
}): boolean {
  if (!input.privyAuthed || input.busy) return false
  return Boolean(input.ownerDelegationFlags?.needsBaseAppSetup || input.ownerDelegationFlags?.needsEmbeddedWallet)
}

type OwnerApprovalErrorCode =
  | 'aa23_validation'
  | 'submission_timeout'
  | 'typed_data_timeout'
  | 'paymaster_internal'
  | 'paymaster_rejected'
  | 'paymaster_insufficient'
  | 'wallet_generation_insufficient'
  | 'missing_session_token'
  | 'request_denied'
  | 'not_owner'
  | 'not_onchain_owner'
  | 'unknown'

type ClassifiedOwnerApprovalError = {
  message: string
  lower: string
  code: OwnerApprovalErrorCode
}

function extractOwnerApprovalDebugTag(message: string): string | null {
  const match = message.match(/\[oa-debug:([^\]]+)\]/i)
  if (!match) return null
  const details = String(match[1] ?? '').replace(/\s+/g, ' ').trim()
  return details || null
}

function appendOwnerApprovalDebug(base: string, classified: ClassifiedOwnerApprovalError): string {
  const debugDetails = extractOwnerApprovalDebugTag(classified.message)
  if (!debugDetails) return base
  return `${base} Debug: ${debugDetails}`
}

function classifyOwnerApprovalError(error: unknown): ClassifiedOwnerApprovalError {
  const message = error instanceof Error ? String(error.message || '').trim() : String(error ?? '').trim()
  const lower = message.toLowerCase()
  if (!lower) return { message, lower, code: 'unknown' }
  if (lower.includes('aa23') || (lower.includes('validateuserop') && lower.includes('revert'))) {
    return { message, lower, code: 'aa23_validation' }
  }
  if (lower.includes('userop_submission_timeout')) {
    return { message, lower, code: 'submission_timeout' }
  }
  if (lower.includes('signtypeddata (csw eip-712) timed out') || lower.includes('eth_signtypeddata_v4 (csw eip-712) timed out')) {
    return { message, lower, code: 'typed_data_timeout' }
  }
  if (lower.includes('paymaster proxy internal error')) {
    return { message, lower, code: 'paymaster_internal' }
  }
  if (lower.includes('paymaster rejected this request')) {
    return { message, lower, code: 'paymaster_rejected' }
  }
  if (
    (lower.includes('paymaster') && lower.includes('insufficient funds')) ||
    lower.includes('insufficient sponsorship funds')
  ) {
    return { message, lower, code: 'paymaster_insufficient' }
  }
  if (
    ((lower.includes('error generating transaction') || lower.includes('error generating message')) && lower.includes('enough funds')) ||
    lower.includes('insufficient funds') ||
    lower.includes('not enough funds')
  ) {
    return { message, lower, code: 'wallet_generation_insufficient' }
  }
  if (lower.includes('missing 4626 session token')) {
    return { message, lower, code: 'missing_session_token' }
  }
  if (lower.includes('request denied') || lower.includes('not authenticated')) {
    return { message, lower, code: 'request_denied' }
  }
  if (lower.includes('session principal does not own sender csw') || lower.includes('not_owner')) {
    return { message, lower, code: 'not_owner' }
  }
  if (lower.includes('not an onchain owner of the smart wallet')) {
    return { message, lower, code: 'not_onchain_owner' }
  }
  return { message, lower, code: 'unknown' }
}

export function normalizeOwnerApprovalError(error: unknown): Error {
  const classified = classifyOwnerApprovalError(error)
  if (classified.code === 'aa23_validation') {
    return new Error(
      appendOwnerApprovalDebug(
        'Smart wallet signature validation failed during sponsorship (AA23). Reconnect the same Base smart wallet session and retry.',
        classified,
      ),
    )
  }
  if (classified.code === 'submission_timeout') {
    return new Error(
      appendOwnerApprovalDebug(
        'Smart wallet approval is taking too long after signature confirmation. Retry once; if this keeps happening, reconnect the same Coinbase wallet session.',
        classified,
      ),
    )
  }
  if (classified.code === 'typed_data_timeout') {
    return new Error(
      appendOwnerApprovalDebug(
        'Coinbase Smart Wallet signature confirmation timed out. Retry once; if it repeats, reconnect the same Base wallet session and approve again.',
        classified,
      ),
    )
  }
  if (classified.code === 'paymaster_internal') {
    return new Error(
      appendOwnerApprovalDebug(
        '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
        classified,
      ),
    )
  }
  if (classified.code === 'paymaster_rejected') {
    const reason = classified.message
      .replace(/^.*paymaster rejected this request:\s*/i, '')
      .trim()
    const normalizedReason = reason ? reason.replace(/\s+/g, ' ').trim() : ''
    return new Error(
      appendOwnerApprovalDebug(
        normalizedReason
          ? `Gas sponsorship was rejected for this approval (${normalizedReason}). Retry in Base app after reconnecting the same wallet session.`
          : 'Gas sponsorship was rejected for this approval. Retry in Base app after reconnecting the same wallet session.',
        classified,
      ),
    )
  }
  if (classified.code === 'paymaster_insufficient') {
    return new Error(
      appendOwnerApprovalDebug(
        'Gas sponsorship failed due to paymaster funding limits. This is a sponsor-side budget/policy issue, not your wallet ETH balance.',
        classified,
      ),
    )
  }
  if (classified.code === 'wallet_generation_insufficient') {
    return new Error(
      appendOwnerApprovalDebug(
        'Wallet could not generate the Coinbase Smart Wallet signature/approval. Retry from the same Base/Zora smart wallet, and reconnect it if the sponsor session has gone stale.',
        classified,
      ),
    )
  }
  if (classified.code === 'missing_session_token') {
    return new Error(
      appendOwnerApprovalDebug('4626 could not start the smart-wallet sponsor session. Sign in again and retry.', classified),
    )
  }
  if (classified.code === 'request_denied') {
    return new Error(
      appendOwnerApprovalDebug('4626 sponsor session was rejected. Sign in again and retry the smart-wallet approval.', classified),
    )
  }
  if (classified.code === 'not_owner') {
    return new Error(
      appendOwnerApprovalDebug(
        'The current 4626 session is not authorized for this canonical smart wallet. Reconnect the same Base/Zora wallet and retry.',
        classified,
      ),
    )
  }
  if (classified.code === 'not_onchain_owner') {
    return new Error(
      appendOwnerApprovalDebug(
        'The connected signer is not an onchain owner of this Coinbase Smart Wallet. Reconnect a current owner and retry.',
        classified,
      ),
    )
  }
  if (error instanceof Error) {
    return new Error(appendOwnerApprovalDebug(error.message, classified))
  }
  return new Error(appendOwnerApprovalDebug('Failed to submit the owner approval transaction.', classified))
}

function isRetryablePaymasterSessionError(error: unknown): boolean {
  const { lower, code } = classifyOwnerApprovalError(error)
  if (code === 'paymaster_internal') return true
  return (
    lower.includes('request denied - no_session') ||
    lower.includes('request denied - not authenticated')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

const CONFIRM_OWNER_RETRY_DELAY_BASE_MS = import.meta.env.MODE === 'test' ? 5 : 1_500
const CONFIRM_OWNER_MAX_ATTEMPTS = import.meta.env.MODE === 'test' ? 6 : 10
const PAYMASTER_SESSION_MAX_ATTEMPTS = 3
const PAYMASTER_SESSION_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 5 : 300
const USER_OP_SUBMIT_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 120 : 45_000
const SEND_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 8_000
const SEND_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500
const PREPARED_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 12_000
const PREPARED_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500

function getConfirmOwnerRetryDelayMs(attempt: number): number {
  const multiplier = Math.min(5, Math.max(1, attempt + 1))
  return CONFIRM_OWNER_RETRY_DELAY_BASE_MS * multiplier
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')
}

function emitOwnerApprovalStage(
  callback: ((event: OwnerApprovalStageEvent) => void) | null | undefined,
  event: OwnerApprovalStageEvent,
): void {
  try {
    callback?.(event)
  } catch {
    // keep approval flow resilient even if telemetry callback fails
  }
}

// Retained for reference during ongoing onboarding wallet refactor; exported
// to satisfy tsc noUnusedLocals without deleting the documented implementation.
export async function _submitOwnerTxViaWalletSendCalls(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  paymasterUrl?: string | null
  approvalRunId: string
  executionMode: OwnerApprovalExecutionMode
  signerAddress?: string | null
  canonicalCswAddress?: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
}): Promise<`0x${string}`> {
  const supportsPaymasterCapability = typeof params.paymasterUrl === 'string' && params.paymasterUrl.trim().length > 0
  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'send_calls',
    status: 'start',
    attempt: 1,
    executionMode: params.executionMode,
    signerAddress: params.signerAddress ?? null,
    canonicalCswAddress: params.canonicalCswAddress ?? null,
  })
  const chainIdHex = `0x${params.chainId.toString(16)}`
  const payloadBase = {
    chainId: chainIdHex,
    from: params.sender,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
    atomicRequired: false,
    version: '2.0.0',
  } as Record<string, unknown>
  // Build paymaster capabilities in BOTH flat (EIP-5792 v2) and chain-keyed
  // (ERC-7677) formats so the CSW extension can locate the URL regardless of
  // which spec revision it implements.  Coinbase Wallet SDK issue #1600 notes
  // the extension still follows the older chain-keyed layout; passing both is
  // harmless because the wallet ignores keys it doesn't recognise.
  // Normalise the paymaster domain: the keys.coinbase.com popup CSP allows
  // api.cdp.coinbase.com but NOT api.developer.coinbase.com.  Both endpoints
  // share the same API-key namespace, so swapping the host is safe.
  const rawUrl = String(params.paymasterUrl).trim()
  const paymasterUrlStr = rawUrl.replace(
    'https://api.developer.coinbase.com/',
    'https://api.cdp.coinbase.com/',
  )
  const payloadWithPaymaster = supportsPaymasterCapability
    ? {
        ...payloadBase,
        capabilities: {
          // Flat key used by Base Sub Accounts / newer CSW builds
          paymasterUrl: paymasterUrlStr,
          // ERC-7677 chain-keyed format (older CSW builds per SDK issue #1600)
          paymasterService: {
            url: paymasterUrlStr,
            [chainIdHex]: {
              url: paymasterUrlStr,
            },
          },
        },
      }
    : payloadBase

  let callBundle: unknown
  try {
    callBundle = await params.walletRequest({
      method: 'wallet_sendCalls',
      params: [payloadWithPaymaster],
    })
  } catch (error) {
    if (!supportsPaymasterCapability) throw error
    const message = error instanceof Error ? error.message : String(error ?? '')
    const lower = message.toLowerCase()
    const invalidCapabilities =
      lower.includes('invalid params') ||
      lower.includes('unexpected property') ||
      lower.includes('capabilities')
    if (!invalidCapabilities) throw error
    emitOwnerApprovalStage(params.onStageEvent, {
      runId: params.approvalRunId,
      stage: 'send_calls',
      status: 'retry',
      attempt: 2,
      executionMode: params.executionMode,
      signerAddress: params.signerAddress ?? null,
      canonicalCswAddress: params.canonicalCswAddress ?? null,
      code: 'send_calls_capabilities_rejected',
      message,
    })
    callBundle = await params.walletRequest({
      method: 'wallet_sendCalls',
      params: [payloadBase],
    })
  }
  const callsId =
    typeof callBundle === 'string'
      ? callBundle
      : callBundle && typeof callBundle === 'object' && typeof (callBundle as { id?: unknown }).id === 'string'
        ? String((callBundle as { id: string }).id)
        : ''
  if (!callsId) throw new Error('wallet_sendCalls returned no call bundle id')

  const startedAt = Date.now()
  while (Date.now() - startedAt < SEND_CALLS_STATUS_TIMEOUT_MS) {
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
            stage: 'send_calls',
            status: 'success',
            executionMode: params.executionMode,
            signerAddress: params.signerAddress ?? null,
            canonicalCswAddress: params.canonicalCswAddress ?? null,
            txHash: receiptHash,
          })
          return receiptHash
        }
        throw new Error('wallet_sendCalls completed without a transaction hash yet. Retry confirmation shortly.')
      }
      if (statusCode >= 300) throw new Error(`wallet_sendCalls failed with status ${statusCode}`)
    }
    await delay(SEND_CALLS_STATUS_POLL_MS)
  }

  emitOwnerApprovalStage(params.onStageEvent, {
    runId: params.approvalRunId,
    stage: 'send_calls',
    status: 'error',
    executionMode: params.executionMode,
    signerAddress: params.signerAddress ?? null,
    canonicalCswAddress: params.canonicalCswAddress ?? null,
    code: 'send_calls_pending_timeout',
    message: 'wallet_sendCalls status is still pending. Wait a moment and retry confirmation.',
  })
  throw new Error('wallet_sendCalls status is still pending. Wait a moment and retry confirmation.')
}

// ── wallet_prepareCalls → personal_sign → wallet_sendPreparedCalls ──
// This is the CORRECT path for self-auth mode (CSW signs for itself).
//
// WHY: The popup's eGe function blocks wallet_sendCalls when target === sender
// ("Self calls are not allowed").  addOwnerAddress is inherently a self-call.
// The viem-based UserOp path fails because it can't discover or sign with the
// CSW's passkey owner (the passkey is at owner[0] but signing requires WebAuthn
// which only the popup can mediate).
//
// HOW: wallet_prepareCalls and wallet_sendPreparedCalls both route to Coinbase
// RPC via the SDK's default handler (not the popup).  The RPC builds a UserOp
// and returns a hash.  We sign that hash using personal_sign which DOES go to
// the popup but has NO eGe self-call check — the popup uses the passkey to
// produce the signature.  Then wallet_sendPreparedCalls submits the signed
// UserOp to the RPC.
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

  // Step 1: wallet_prepareCalls → goes to Coinbase RPC (default case in SCWSigner)
  const prepareCallsPayload: Record<string, unknown> = {
    from: params.sender,
    chainId: chainIdHex,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
    capabilities: {} as Record<string, unknown>,
  }
  // Inject paymaster capability if available
  if (params.paymasterUrl) {
    const paymasterUrlStr = String(params.paymasterUrl).trim().replace(
      'https://api.developer.coinbase.com/',
      'https://api.cdp.coinbase.com/',
    )
    ;(prepareCallsPayload.capabilities as Record<string, unknown>).paymasterUrl = paymasterUrlStr
    ;(prepareCallsPayload.capabilities as Record<string, unknown>).paymasterService = {
      url: paymasterUrlStr,
      [chainIdHex]: { url: paymasterUrlStr },
    }
  }

  const prepareResult = await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [prepareCallsPayload],
  }) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
    capabilities?: Record<string, unknown>
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  // The hash from wallet_prepareCalls is double-hex-encoded per the CSW SDK.
  // It comes back as a hex-encoded string of the hex hash.
  let hashToSign = prepareResult.signatureRequest.hash as `0x${string}`
  // If the hash looks like a hex-encoded hex string, decode one layer.
  // The SDK does: hexToString(hash) to unwrap. We check if decoding the hex
  // bytes yields a string starting with '0x'.
  try {
    const decoded = hexToStringInner(hashToSign)
    if (decoded.startsWith('0x') && decoded.length === 66) {
      hashToSign = decoded as `0x${string}`
    }
  } catch { /* use as-is */ }

  // Step 2: personal_sign → goes to popup (no eGe check), passkey signs
  const signature = await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, params.sender],
  }) as `0x${string}`

  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }

  // Step 3: wallet_sendPreparedCalls → goes to Coinbase RPC (default case)
  const sendResult = await params.walletRequest({
    method: 'wallet_sendPreparedCalls',
    params: [{
      version: '1.0',
      type: prepareResult.type ?? 'user-operation-v06',
      data: prepareResult.userOp,
      chainId: prepareResult.chainId ?? chainIdHex,
      signature: {
        type: 'secp256k1' as const,
        data: {
          address: params.sender,
          signature,
        },
      },
    }],
  }) as unknown

  // sendPreparedCalls may return a bare string, string[], or an object with
  // an id/preparedCallIds field depending on the wallet implementation.
  const callsId =
    typeof sendResult === 'string'
      ? sendResult
      : Array.isArray(sendResult) && typeof sendResult[0] === 'string'
        ? sendResult[0]
        : sendResult && typeof sendResult === 'object' && typeof (sendResult as { id?: unknown }).id === 'string'
          ? String((sendResult as { id: string }).id)
          : ''

  if (!callsId) {
    throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
  }

  // Step 4: Poll wallet_getCallsStatus for the transaction hash
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
      if (statusCode >= 300) throw new Error(`wallet_sendPreparedCalls failed with status ${statusCode}`)
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

// Decode hex-encoded bytes to a UTF-8 string (for double-hex-encoded hashes)
function hexToStringInner(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

export async function sendPreparedOwnerTx(params: {
  txRequest: PreparedOwnerTxRequest
  walletClient:
    | {
        account?: unknown
        sendTransaction?: (...args: any[]) => Promise<`0x${string}`>
        request?: (...args: any[]) => Promise<unknown>
      }
    | null
    | undefined
  chainId: number | undefined
  switchChainAsync?: ((args: { chainId: typeof base.id }) => Promise<unknown>) | null
  authHeaders: () => Promise<Record<string, string>>
  ownerAddress?: string | null
  ownerIndexLookupAddress?: string | null
  signerAddress?: string | null
  executionMode: OwnerApprovalExecutionMode
  canonicalSmartWalletAddress?: string | null
  publicClient?: unknown
  ensurePaymasterSession?: (() => Promise<boolean>) | null
  approvalRunId?: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
  preferSponsoredFirst?: boolean
}): Promise<ConfirmOwnerResponse> {
  const {
    txRequest,
    walletClient,
    chainId,
    switchChainAsync,
    authHeaders,
    ownerAddress,
    ownerIndexLookupAddress,
    signerAddress,
    executionMode,
    canonicalSmartWalletAddress,
    publicClient,
    ensurePaymasterSession,
    approvalRunId,
    onStageEvent,
    preferSponsoredFirst,
  } = params
  const effectiveApprovalRunId = typeof approvalRunId === 'string' && approvalRunId.trim() ? approvalRunId.trim() : `approval-${Date.now()}`
  if (!walletClient) {
    throw new Error('Connect an owner wallet to send this transaction.')
  }
  if (chainId !== base.id && typeof switchChainAsync === 'function') {
    await switchChainAsync({ chainId: base.id })
  }

  let txHash: `0x${string}` | null = null
  try {
    if (executionMode === 'canonicalSmartWallet') {
      if (!canonicalSmartWalletAddress || !signerAddress) {
        throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
      }
      if (txRequest.to.toLowerCase() !== canonicalSmartWalletAddress.toLowerCase()) {
        throw new Error('Prepared owner install target does not match the canonical Coinbase Smart Wallet.')
      }
      const selfAuthenticatedCanonicalSession =
        signerAddress.toLowerCase() === canonicalSmartWalletAddress.toLowerCase()
      const ownerIndexLookupAddressForUserOp =
        selfAuthenticatedCanonicalSession &&
        typeof ownerIndexLookupAddress === 'string' &&
        isAddress(ownerIndexLookupAddress)
          ? ownerIndexLookupAddress
          : selfAuthenticatedCanonicalSession &&
              !preferSponsoredFirst &&
              typeof ownerAddress === 'string' &&
              isAddress(ownerAddress)
            ? ownerAddress
            : null
      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const paymasterUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      const runSponsoredCanonicalUserOp = async (opts?: { disableTypedDataSigning?: boolean; attempt?: number }) => {
        const stage: OwnerApprovalStage = opts?.disableTypedDataSigning ? 'userop_nontyped' : 'userop_typed'
        emitOwnerApprovalStage(onStageEvent, {
          runId: effectiveApprovalRunId,
          stage,
          status: opts?.attempt && opts.attempt > 1 ? 'retry' : 'start',
          attempt: opts?.attempt,
          executionMode,
          signerAddress,
          canonicalCswAddress: canonicalSmartWalletAddress,
        })
        if (!publicClient) {
          throw new Error('Canonical wallet client is unavailable. Reload and retry.')
        }
        if (typeof ensurePaymasterSession === 'function') {
          const sessionOk = await ensurePaymasterSession()
          if (!sessionOk) {
            throw new Error('Missing 4626 session token for paymaster request.')
          }
        }
        const runUserOp = async () =>
          await withTimeout(
            sendCoinbaseSmartWalletUserOperation({
              publicClient: publicClient as any,
              walletClient: walletClient as any,
              bundlerUrl: paymasterUrl,
              smartWallet: canonicalSmartWalletAddress as `0x${string}`,
              ownerAddress: signerAddress as `0x${string}`,
              ownerIndexLookupAddress:
                typeof ownerIndexLookupAddressForUserOp === 'string'
                  ? (ownerIndexLookupAddressForUserOp as `0x${string}`)
                  : undefined,
              calls: [{ to: txRequest.to, data: txRequest.data, value: 0n }],
              version: '1',
              useTypedDataSigning: selfAuthenticatedCanonicalSession && opts?.disableTypedDataSigning !== true,
              ownerApprovalContext: {
                approvalRunId: effectiveApprovalRunId,
                stage,
                executionMode,
                attempt: opts?.attempt ?? null,
              },
            }),
            USER_OP_SUBMIT_TIMEOUT_MS,
            new Error('userop_submission_timeout'),
          )

        let result: Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>> | null = null
        let lastRetryableError: unknown = null
        for (let attempt = 0; attempt < PAYMASTER_SESSION_MAX_ATTEMPTS; attempt += 1) {
          try {
            result = await runUserOp()
            break
          } catch (attemptError) {
            if (!isRetryablePaymasterSessionError(attemptError)) throw attemptError
            lastRetryableError = attemptError
            if (typeof ensurePaymasterSession === 'function') {
              await ensurePaymasterSession().catch(() => false)
            }
            const hasNextAttempt = attempt + 1 < PAYMASTER_SESSION_MAX_ATTEMPTS
            if (hasNextAttempt) {
              await delay(PAYMASTER_SESSION_RETRY_DELAY_MS * (attempt + 1))
            }
          }
        }
        if (!result) {
          const terminalError = lastRetryableError ?? new Error('Paymaster session retry exhausted.')
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage,
            status: 'error',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
            code: classifyOwnerApprovalError(terminalError).code,
            message: terminalError instanceof Error ? terminalError.message : String(terminalError ?? ''),
          })
          throw terminalError
        }
        emitOwnerApprovalStage(onStageEvent, {
          runId: effectiveApprovalRunId,
          stage,
          status: 'success',
          executionMode,
          signerAddress,
          canonicalCswAddress: canonicalSmartWalletAddress,
          txHash: result.transactionHash,
        })
        return result.transactionHash
      }
      if (selfAuthenticatedCanonicalSession) {
        // ── Self-authenticated session: eth_sendTransaction FIRST ──
        // In self-auth mode (CSW signs for itself), the popup's eGe function
        // blocks wallet_sendCalls where target === sender ("Self calls are not
        // allowed").  addOwnerAddress is inherently a self-call.
        //
        // The viem-based UserOp path (runSponsoredCanonicalUserOp) also fails
        // because the CSW's primary signer is a passkey (WebAuthn at owner[0]).
        // The UserOp function can't discover or match the passkey owner index.
        //
        // wallet_prepareCalls → wallet_sendPreparedCalls fails because
        // wallet_sendPreparedCalls expects a raw signer signature (secp256k1
        // address or webauthn credential), but we can't produce the passkey's
        // WebAuthn credential data from code.
        //
        // eth_sendTransaction goes through the popup but uses the standard
        // transaction approval UI, NOT the wallet_sendCalls batch handler.
        // The eGe self-call check ONLY applies to wallet_sendCalls.
        //
        // Fallback chain: eth_sendTransaction → UserOp(typed) → UserOp(non-typed)
        if (!walletClient.account) {
          throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
        }
        const walletRequest =
          typeof walletClient.request === 'function'
            ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
            : null

        if (walletRequest) {
          const runDirectSendTx = async (): Promise<`0x${string}`> => {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              status: 'start',
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
            })
            const sendTxResult = await walletRequest({
              method: 'eth_sendTransaction',
              params: [{
                from: canonicalSmartWalletAddress,
                to: txRequest.to,
                data: txRequest.data,
                value: '0x0',
              }],
            })
            if (typeof sendTxResult === 'string' && isTxHash(sendTxResult)) {
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                status: 'success',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                txHash: sendTxResult,
              })
              return sendTxResult
            } else {
              throw new Error('eth_sendTransaction did not return a transaction hash.')
            }
          }

          const runSponsoredThenDirectFallback = async () => {
            try {
              txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
              return
            } catch (typedUserOpError) {
              if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_typed',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(typedUserOpError).code,
                message: typedUserOpError instanceof Error ? typedUserOpError.message : String(typedUserOpError ?? ''),
              })
              try {
                txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
                return
              } catch (nonTypedUserOpError) {
                if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
                // Sponsored-first mode is intentionally strict: do not fall back
                // to direct eth_sendTransaction, because that path surfaces the
                // wallet's own "insufficient funds" popup and hides the actual
                // sponsor/UserOp failure reason we need to fix.
                throw nonTypedUserOpError
              }
            }
          }

          if (preferSponsoredFirst) {
            await runSponsoredThenDirectFallback()
          } else {
            try {
              txHash = await runDirectSendTx()
            } catch (sendTxError) {
              if (isUserRejectedWalletAction(sendTxError)) throw sendTxError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(sendTxError).code,
                message: sendTxError instanceof Error ? sendTxError.message : String(sendTxError ?? ''),
              })

              // ── Fallback: sponsored UserOp with EIP-712 typed signing ──
              try {
                txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
              } catch (typedUserOpError) {
                if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'userop_typed',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(typedUserOpError).code,
                  message: typedUserOpError instanceof Error ? typedUserOpError.message : String(typedUserOpError ?? ''),
                })

                // ── Last fallback: UserOp with non-typed signing ──
                try {
                  txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
                } catch (nonTypedUserOpError) {
                  if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
                  // All paths exhausted — throw the sendTx error (most informative)
                  throw sendTxError
                }
              }
            }
          }
        } else {
          // No walletRequest available — try UserOp paths directly
          try {
            txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
          } catch (typedUserOpError) {
            if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
            txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
          }
        }
        if (!txHash) {
          throw new Error('Owner approval failed: no execution path produced a result.')
        }
      } else {
        txHash = await runSponsoredCanonicalUserOp()
      }
    } else {
      if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
        throw new Error('Connect an owner wallet to send this transaction.')
      }
      txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        chain: base,
        to: txRequest.to,
        data: txRequest.data,
        value: 0n,
      })
    }
  } catch (error) {
    throw normalizeOwnerApprovalError(error)
  }
  if (!txHash) {
    throw new Error('Failed to submit the owner approval transaction.')
  }

  const headers = await authHeaders()
  let lastPayload: ApiEnvelope<ConfirmOwnerResponse> | null = null
  let lastMessage = 'Owner status is not confirmed yet. Please retry in a moment.'
  emitOwnerApprovalStage(onStageEvent, {
    runId: effectiveApprovalRunId,
    stage: 'confirm_owner',
    status: 'start',
    attempt: 1,
    executionMode,
    signerAddress,
    canonicalCswAddress: canonicalSmartWalletAddress ?? null,
    txHash,
  })
  for (let attempt = 0; attempt < CONFIRM_OWNER_MAX_ATTEMPTS; attempt += 1) {
    const confirmRes = await apiFetch('/api/wallet/confirm-owner', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        txHash,
        ownerAddress: ownerAddress ?? null,
        approvalRunId: effectiveApprovalRunId,
      }),
    })
    const confirmPayload = (await confirmRes.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
    lastPayload = confirmPayload

    if (confirmRes.ok && confirmPayload?.success && confirmPayload.data?.isOwner) {
      emitOwnerApprovalStage(onStageEvent, {
        runId: effectiveApprovalRunId,
        stage: 'confirm_owner',
        status: 'success',
        attempt: attempt + 1,
        executionMode,
        signerAddress,
        canonicalCswAddress: confirmPayload.data.canonicalCswAddress,
        txHash,
      })
      return confirmPayload.data
    }

    lastMessage = readApiError(confirmPayload, 'Owner status is not confirmed yet.')
    const confirmationState = confirmPayload?.data?.confirmationState
    const pendingConfirmationState =
      confirmationState === 'pending_tx' || confirmationState === 'owner_not_found_yet'
    const terminalConfirmationState = confirmationState === 'tx_failed'
    const canRetry =
      !terminalConfirmationState &&
      attempt + 1 < CONFIRM_OWNER_MAX_ATTEMPTS &&
      (
        pendingConfirmationState ||
        (confirmRes.ok && confirmPayload?.success && confirmPayload?.data?.isOwner === false) ||
        String(lastMessage).toLowerCase().includes('not confirmed')
      )
    if (canRetry) {
      emitOwnerApprovalStage(onStageEvent, {
        runId: effectiveApprovalRunId,
        stage: 'confirm_owner',
        status: 'retry',
        attempt: attempt + 2,
        executionMode,
        signerAddress,
        canonicalCswAddress: canonicalSmartWalletAddress ?? null,
        txHash,
        code: confirmPayload?.data?.confirmationState ?? 'pending_confirmation',
        message: lastMessage,
      })
    }
    if (!canRetry) break
    await delay(getConfirmOwnerRetryDelayMs(attempt))
  }

  emitOwnerApprovalStage(onStageEvent, {
    runId: effectiveApprovalRunId,
    stage: 'confirm_owner',
    status: 'error',
    executionMode,
    signerAddress,
    canonicalCswAddress: canonicalSmartWalletAddress ?? null,
    txHash,
    code: lastPayload?.data?.confirmationState ?? classifyOwnerApprovalError(lastMessage).code,
    message: lastMessage,
  })
  throw buildOwnerDelegationError(lastPayload, lastMessage)
}
