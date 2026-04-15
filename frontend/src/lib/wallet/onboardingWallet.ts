import { apiFetch } from '@/lib/apiBase'
import { resolveApiErrorMessage } from '@/lib/apiEnvelope'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import type { ApiEnvelope } from '@/lib/apiEnvelope'
import { isAddress } from 'viem'
import { base } from 'viem/chains'
export type { ApiEnvelope } from '@/lib/apiEnvelope'

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

export type OwnerApprovalExecutionMode = 'canonicalSmartWallet' | 'ownerDirect'

export type OwnerApprovalStage =
  | 'preflight'
  | 'prepare'
  | 'userop_typed'
  | 'userop_nontyped'
  | 'send_calls'
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
    lower.includes('insufficient funds')
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
      'Smart wallet signature validation failed during sponsorship (AA23). Reconnect the same Base smart wallet session and retry.',
    )
  }
  if (classified.code === 'submission_timeout') {
    return new Error(
      'Smart wallet approval is taking too long after signature confirmation. Retry once; if this keeps happening, reconnect the same Coinbase wallet session.',
    )
  }
  if (classified.code === 'typed_data_timeout') {
    return new Error(
      'Coinbase Smart Wallet signature confirmation timed out. Retry once; if it repeats, reconnect the same Base wallet session and approve again.',
    )
  }
  if (classified.code === 'paymaster_internal') {
    return new Error(
      '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
    )
  }
  if (classified.code === 'paymaster_rejected') {
    const reason = classified.message
      .replace(/^.*paymaster rejected this request:\s*/i, '')
      .trim()
    const normalizedReason = reason ? reason.replace(/\s+/g, ' ').trim() : ''
    return new Error(
      normalizedReason
        ? `Gas sponsorship was rejected for this approval (${normalizedReason}). Retry in Base app after reconnecting the same wallet session.`
        : 'Gas sponsorship was rejected for this approval. Retry in Base app after reconnecting the same wallet session.',
    )
  }
  if (classified.code === 'paymaster_insufficient') {
    return new Error(
      'Gas sponsorship failed due to paymaster funding limits. This is a sponsor-side budget/policy issue, not your wallet ETH balance.',
    )
  }
  if (classified.code === 'wallet_generation_insufficient') {
    return new Error(
      'Wallet could not generate the Coinbase Smart Wallet signature/approval. Retry from the same Base/Zora smart wallet, and reconnect it if the sponsor session has gone stale.',
    )
  }
  if (classified.code === 'missing_session_token') {
    return new Error('4626 could not start the smart-wallet sponsor session. Sign in again and retry.')
  }
  if (classified.code === 'request_denied') {
    return new Error('4626 sponsor session was rejected. Sign in again and retry the smart-wallet approval.')
  }
  if (classified.code === 'not_owner') {
    return new Error('The current 4626 session is not authorized for this canonical smart wallet. Reconnect the same Base/Zora wallet and retry.')
  }
  if (classified.code === 'not_onchain_owner') {
    return new Error('The connected signer is not an onchain owner of this Coinbase Smart Wallet. Reconnect a current owner and retry.')
  }
  if (error instanceof Error) return error
  return new Error('Failed to submit the owner approval transaction.')
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
const PREFER_SPONSORED_CANONICAL_SELF_APPROVAL = false

function getConfirmOwnerRetryDelayMs(attempt: number): number {
  const multiplier = Math.min(5, Math.max(1, attempt + 1))
  return CONFIRM_OWNER_RETRY_DELAY_BASE_MS * multiplier
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function isSendCallsUnsupportedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error ? Number((error as { code?: unknown }).code) : Number.NaN
  if (Number.isFinite(code) && (code === -32601 || code === 4200)) return true

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('method not found') ||
    lower.includes('unsupported method') ||
    lower.includes('method is not supported') ||
    lower.includes('does not support')
  )
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')
}

function shouldFallbackSelfAuthenticatedCanonicalToSendCalls(error: unknown): boolean {
  const { code } = classifyOwnerApprovalError(error)
  return code === 'aa23_validation' || code === 'typed_data_timeout' || code === 'wallet_generation_insufficient'
}

function isInsufficientFundsLikeWalletSendCallsError(error: unknown): boolean {
  const { code } = classifyOwnerApprovalError(error)
  return code === 'wallet_generation_insufficient' || code === 'paymaster_insufficient'
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

async function submitOwnerTxViaWalletSendCalls(params: {
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
  const payloadBase = {
    chainId: `0x${params.chainId.toString(16)}`,
    from: params.sender,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
    atomicRequired: false,
    version: '2.0.0',
  } as Record<string, unknown>
  const payloadWithPaymaster = supportsPaymasterCapability
    ? {
        ...payloadBase,
        capabilities: {
          paymasterService: {
            url: String(params.paymasterUrl).trim(),
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
        if (!walletClient.account) {
          throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
        }
        if (PREFER_SPONSORED_CANONICAL_SELF_APPROVAL) {
          try {
            txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
          } catch (sponsoredError) {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'userop_typed',
              status: 'error',
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
              code: classifyOwnerApprovalError(sponsoredError).code,
              message: sponsoredError instanceof Error ? sponsoredError.message : String(sponsoredError ?? ''),
            })
            if (!shouldFallbackSelfAuthenticatedCanonicalToSendCalls(sponsoredError)) throw sponsoredError
            let nonTypedRetryError: unknown = null
            try {
              txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
            } catch (retryError) {
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_nontyped',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(retryError).code,
                message: retryError instanceof Error ? retryError.message : String(retryError ?? ''),
              })
              nonTypedRetryError = retryError
            }
            if (txHash) {
              // Retry without typed-data signing succeeded.
            } else if (nonTypedRetryError && !shouldFallbackSelfAuthenticatedCanonicalToSendCalls(nonTypedRetryError)) {
              throw nonTypedRetryError
            } else {
            const walletRequest =
              typeof walletClient.request === 'function'
                ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
                : null
            if (walletRequest) {
              try {
                txHash = await submitOwnerTxViaWalletSendCalls({
                  walletRequest,
                  chainId: txRequest.chainId,
                  sender: canonicalSmartWalletAddress as `0x${string}`,
                  to: txRequest.to,
                  data: txRequest.data,
                  paymasterUrl,
                  approvalRunId: effectiveApprovalRunId,
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  onStageEvent,
                })
              } catch (sendCallsError) {
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'send_calls',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(sendCallsError).code,
                  message: sendCallsError instanceof Error ? sendCallsError.message : String(sendCallsError ?? ''),
                })
                if (!isInsufficientFundsLikeWalletSendCallsError(sendCallsError)) throw sendCallsError
                txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 3 })
              }
            } else {
              txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 3 })
            }
            }
          }
        } else {
        const walletRequest =
          typeof walletClient.request === 'function'
            ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
            : null

        let sendCallsFallbackMode: 'unsupported' | 'insufficient' | null = null
        if (walletRequest) {
          try {
            txHash = await submitOwnerTxViaWalletSendCalls({
              walletRequest,
              chainId: txRequest.chainId,
              sender: canonicalSmartWalletAddress as `0x${string}`,
              to: txRequest.to,
              data: txRequest.data,
              paymasterUrl,
              approvalRunId: effectiveApprovalRunId,
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
              onStageEvent,
            })
          } catch (sendCallsError) {
            if (isUserRejectedWalletAction(sendCallsError)) throw sendCallsError
            if (isSendCallsUnsupportedError(sendCallsError)) {
              sendCallsFallbackMode = 'unsupported'
            } else {
              const message = sendCallsError instanceof Error ? sendCallsError.message : String(sendCallsError ?? '')
              const lower = message.toLowerCase()
              const shouldRetrySponsored =
                (lower.includes('error generating transaction') && lower.includes('enough funds')) ||
                lower.includes('insufficient funds')
              if (!shouldRetrySponsored) throw sendCallsError
              sendCallsFallbackMode = 'insufficient'
            }
          }
        }

        if (!txHash) {
          try {
            txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
          } catch (sponsoredError) {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'userop_typed',
              status: 'error',
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
              code: classifyOwnerApprovalError(sponsoredError).code,
              message: sponsoredError instanceof Error ? sponsoredError.message : String(sponsoredError ?? ''),
            })
            if (sendCallsFallbackMode === 'insufficient') throw sponsoredError
            let nonTypedRetryError: unknown = null
            if (shouldFallbackSelfAuthenticatedCanonicalToSendCalls(sponsoredError)) {
              try {
                txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
              } catch (retryError) {
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'userop_nontyped',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(retryError).code,
                  message: retryError instanceof Error ? retryError.message : String(retryError ?? ''),
                })
                nonTypedRetryError = retryError
              }
              if (
                !txHash &&
                nonTypedRetryError &&
                !shouldFallbackSelfAuthenticatedCanonicalToSendCalls(nonTypedRetryError)
              ) {
                throw nonTypedRetryError
              }
            }
            if (!txHash && walletRequest && (nonTypedRetryError || shouldFallbackSelfAuthenticatedCanonicalToSendCalls(sponsoredError))) {
              try {
                txHash = await submitOwnerTxViaWalletSendCalls({
                  walletRequest,
                  chainId: txRequest.chainId,
                  sender: canonicalSmartWalletAddress as `0x${string}`,
                  to: txRequest.to,
                  data: txRequest.data,
                  paymasterUrl,
                  approvalRunId: effectiveApprovalRunId,
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  onStageEvent,
                })
              } catch (sendCallsRetryError) {
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'send_calls',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(sendCallsRetryError).code,
                  message: sendCallsRetryError instanceof Error ? sendCallsRetryError.message : String(sendCallsRetryError ?? ''),
                })
                if (isUserRejectedWalletAction(sendCallsRetryError)) throw sendCallsRetryError
                if (nonTypedRetryError) throw nonTypedRetryError
                throw sendCallsRetryError
              }
            }
            if (!txHash) {
              throw nonTypedRetryError ?? sponsoredError
            }
          }
        }
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
