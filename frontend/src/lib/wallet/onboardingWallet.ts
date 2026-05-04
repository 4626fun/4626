import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import {
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  recoverAddress,
  recoverMessageAddress,
} from 'viem'
import { base } from 'viem/chains'
import { detectSignatureShape } from './signatureShape'
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
      sponsorship?: {
        customOwnerPolicyToken?: string
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
export type OwnerInstallIntent = 'embeddedOwner' | 'customCoOwner'

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

function messageHasOwnerApprovalDebugTag(message: string, token: string): boolean {
  const debugDetails = extractOwnerApprovalDebugTag(message)
  if (!debugDetails) return false
  return debugDetails.toLowerCase().includes(token.toLowerCase())
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
    if (messageHasOwnerApprovalDebugTag(classified.message, 'lane=custom_co_owner_direct')) {
      return new Error(
        appendOwnerApprovalDebug(
          'Direct co-owner approval needs ETH for gas on the signing wallet. Fund the signer wallet and retry Add co-owner.',
          classified,
        ),
      )
    }
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
const PREPARED_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 12_000
const PREPARED_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500
const ENTRY_POINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const
const REPLAYABLE_NONCE_KEY = 8453n

function getConfirmOwnerRetryDelayMs(attempt: number): number {
  const multiplier = Math.min(5, Math.max(1, attempt + 1))
  return CONFIRM_OWNER_RETRY_DELAY_BASE_MS * multiplier
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function toOwnerApprovalDebugError(input: {
  error: unknown
  runId: string
  stage: OwnerApprovalStage
  attempt?: number | null
  lane: 'embedded_owner_sponsored' | 'custom_co_owner_direct'
}): Error {
  const baseMessage =
    input.error instanceof Error
      ? input.error.message
      : String(input.error ?? 'Owner approval failed')
  const details = [
    `runId=${input.runId}`,
    `stage=${input.stage}`,
    `attempt=${input.attempt ?? 'na'}`,
    `lane=${input.lane}`,
    `code=${classifyOwnerApprovalError(input.error).code}`,
  ].join(';')
  return new Error(`${baseMessage} [oa-debug:${details}]`)
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
  // Defaults to 'external_signer' (current behavior — strict mismatch throw).
  // The probe page sets this to 'self_auth' when `connectedAddress === sender`,
  // i.e. the Base App popup is the CSW signing for itself. In that mode the
  // popup may return an ephemeral sub-account session key that does not
  // ecrecover to any on-chain owner; the bundler still accepts it via
  // Coinbase's sub-account / ERC-1271 path, so the local mismatch guard must
  // not block submission. See `preflightOwnerKeyMismatch` for details.
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

  // Step 1: wallet_prepareCalls → goes to Coinbase RPC (default case in SCWSigner).
  // Shape mirrors the Coinbase Wallet SDK exactly:
  //   { version: '1.0', from, chainId, calls, capabilities }
  // (see cb-sdk/packages/wallet-sdk/src/sign/scw/utils/createSubAccountSigner.ts).
  // Capability for paymaster is `paymasterService: { url }` only — no top-level
  // `paymasterUrl` and no per-chainId nested keys; non-standard keys have caused
  // bundler JSON parser errors ("invalid character 'x' after top-level value").
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
    capabilities?: Record<string, unknown>
    context?: string
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  // The hash from wallet_prepareCalls is double-hex-encoded per the CSW SDK
  // (createSubAccountSigner.ts uses viem's hexToString to unwrap one layer).
  // We mirror that: if the bytes UTF-8-decode to a `0x...` string of length 66,
  // it's the double-encoded shape and we decode it; otherwise we pass through.
  // This is idempotent — applying it to an already-unwrapped hash is a no-op.
  const hashToSign = unwrapDoubleHexEncodedHash(
    prepareResult.signatureRequest.hash as `0x${string}`,
  )

  // Step 2: personal_sign → goes to popup. For Base App CSW sessions the popup
  // signs with whichever credential is bound to the session (passkey for owner[0],
  // or an EOA for an embedded-wallet owner). The popup wraps the result for ERC-1271
  // verification, so we MUST pass it through to wallet_sendPreparedCalls without
  // assuming it's a raw 65-byte ECDSA signature.
  const signature = await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, params.sender],
  }) as `0x${string}`

  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }

  // ── Pre-flight mismatch guard ────────────────────────────────────────
  // For EOA owners, the bundler runs ecrecover(userOpHash, sig) directly
  // (CoinbaseSmartWallet.sol:191 – no replaySafeHash wrap on this path). If
  // the wallet returned a key that doesn't recover to the parsed owner, the
  // bundler will reject with -32507. We catch that here with a clear error
  // pointing at the EOA-owner submission lane, instead of letting the
  // failure surface as a cryptic bundler revert.
  //
  // Skip the check for code-bearing owners (passkey owners, smart-contract
  // owners): those are verified via ERC-1271, which we cannot pre-flight
  // statelessly. Surface as 'unknown — proceeding' on recovery failure so a
  // malformed-sig error doesn't block legitimate WebAuthn flows.
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
    // 'ok' (match), 'skipped_code_bearing', 'skipped_webauthn',
    // 'skipped_self_auth_session_key', or 'unknown' all proceed.
  } catch (guardError) {
    // Re-throw the explicit mismatch error; suppress everything else so an
    // unrelated failure in the guard never blocks a valid signature.
    if (guardError instanceof Error && guardError.message.startsWith('Signature does not match parsed owner')) {
      throw guardError
    }
    // Otherwise: tri-state-friendly — log debug, fall through.
  }

  // Step 3: wallet_sendPreparedCalls → goes to Coinbase RPC (default case).
  //
  // The CB SDK source (packages/wallet-sdk/src/core/rpc/wallet_sendPreparedCalls.ts)
  // defines the wire payload as a FLAT object:
  //   { version, type, data, chainId, signature: WebauthnSignatureType | Secp256k1SignatureType }
  // We send that shape. We previously briefly tried the HackMD-style
  // {preparedCalls,signature:Hex,context:Hex} shape but the bundler rejected
  // it with "cannot unmarshal string into ... type types.Alias" — confirming
  // the wrapped union shape is canonical.
  //
  // KNOWN LIMITATION on phone Chrome: webauthn signatures coming back from
  // the popup are pre-wrapped SignatureWrapper bytes, but the bundler webauthn
  // branch wants the raw WebAuthn assertion JSON + publicKey. Hex → secp256k1
  // works fine; webauthn is brittle. The wallet_sendCalls lane should be tried
  // first when the popup is reachable; this lane is kept as a fallback.
  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.sender,
    signature,
  })

  // Diagnostic: log payload before dispatch so we can see what the popup got.
  try {
    console.warn('[_submitOwnerViaPreparedCalls] dispatching wallet_sendPreparedCalls', {
      sender: params.sender,
      type: prepareResult.type ?? 'user-operation-v06',
      chainId: prepareResult.chainId ?? chainIdHex,
      signaturePayloadType: (signaturePayload as { type?: string } | null)?.type ?? 'raw',
      signatureLen: typeof signature === 'string' ? (signature.length - 2) / 2 : 0,
    })
  } catch {}

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
    try {
      console.warn('[_submitOwnerViaPreparedCalls] wallet_sendPreparedCalls returned', {
        kind: typeof sendResult,
        preview: typeof sendResult === 'string'
          ? sendResult.slice(0, 80)
          : JSON.stringify(sendResult).slice(0, 200),
      })
    } catch {}
  } catch (sendErr: unknown) {
    try {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr ?? '')
      const data = (sendErr as any)?.data
      const code = (sendErr as any)?.code
      console.error('[_submitOwnerViaPreparedCalls] wallet_sendPreparedCalls THREW', {
        code,
        message: msg.slice(0, 600),
        data: data ? JSON.stringify(data).slice(0, 600) : null,
      })
    } catch {}
    throw sendErr
  }

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
      if (statusCode >= 300) {
        try {
          console.error('[_submitOwnerViaPreparedCalls] wallet_getCallsStatus FAILED', {
            statusCode,
            result: JSON.stringify(result).slice(0, 600),
          })
        } catch {}
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

// ── Replayable-lane prepared-calls submission ───────────────────────────
// The Mar 9 2026 owner[2] install (tx 0x801b9d4b…) used the
// `executeWithoutChainIdValidation` selector (0x2c2abd1e) with
// REPLAYABLE_NONCE_KEY=8453.  The on-chain trace shows the WebAuthn challenge
// equalled `getUserOpHashWithoutChainId(userOp)` —
// keccak256(abi.encode(UserOperationLib.hash(userOp), entryPoint())) — with
// no replaySafeHash wrap and no chainId in the hash.
//
// CoinbaseSmartWallet.validateUserOp branches on bytes4(callData) ==
// this.executeWithoutChainIdValidation.selector to recompute the userOpHash
// without chainId.  This means: if we ask `wallet_prepareCalls` to build a
// UserOp where calldata IS already `executeWithoutChainIdValidation([...])`
// (instead of asking the wallet to wrap a single inner call for us), the
// wallet's RPC must use REPLAYABLE_NONCE_KEY and return the matching
// chain-id-free hash for signing.  That's the exact shape signed by the
// passkey on Mar 9.
//
// This helper differs from `_submitOwnerViaPreparedCalls` only in that it
// pre-wraps the inner call(s).  The inner selector MUST be one of the
// `canSkipChainIdValidation` whitelist (addOwnerAddress, addOwnerPublicKey,
// removeOwnerAtIndex, removeLastOwner, upgradeToAndCall) or the contract
// reverts with SelectorNotAllowed.
// Selector list mirrors CoinbaseSmartWallet.canSkipChainIdValidation() exactly.
// Verified via keccak against the live signatures in coinbase/smart-wallet@main
// (src/MultiOwnable.sol).
const REPLAYABLE_INNER_SELECTORS = new Set<string>([
  '0x0f0f3f24', // addOwnerAddress(address)
  '0x29565e3b', // addOwnerPublicKey(bytes32,bytes32)
  '0x89625b57', // removeOwnerAtIndex(uint256,bytes)
  '0xb8197367', // removeLastOwner(uint256,bytes)
  '0x4f1ef286', // upgradeToAndCall(address,bytes)
])

/**
 * Encode `executeWithoutChainIdValidation(bytes[] calls)` with a single inner
 * call.  Used to force the replayable-lane signing path on `wallet_prepareCalls`.
 */
export function encodeExecuteWithoutChainIdValidation(
  innerCallData: `0x${string}`,
): `0x${string}` {
  // selector for executeWithoutChainIdValidation(bytes[]) is 0x2c2abd1e
  // We use viem's encodeFunctionData via an ABI fragment for clarity.
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executeWithoutChainIdValidation',
        inputs: [{ name: 'calls', type: 'bytes[]' }],
        outputs: [],
        stateMutability: 'payable',
      },
    ] as const,
    functionName: 'executeWithoutChainIdValidation',
    args: [[innerCallData]],
  })
}

const ENTRY_POINT_V06_HANDLE_OPS_ABI = [
  {
    type: 'function',
    name: 'handleOps',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
  },
] as const

type V06UserOpFields = {
  sender: `0x${string}`
  nonce: bigint
  initCode: `0x${string}`
  callData: `0x${string}`
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: `0x${string}`
  signature: `0x${string}`
}

function encodeHandleOpsV06(
  signedUserOp: V06UserOpFields,
  beneficiary: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: ENTRY_POINT_V06_HANDLE_OPS_ABI,
    functionName: 'handleOps',
    args: [[signedUserOp], beneficiary],
  })
}

function serializeUserOpForLog(op: V06UserOpFields): Record<string, string> {
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

const ENTRY_POINT_V06_GET_NONCE_ABI = [
  {
    type: 'function',
    name: 'getNonce',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
] as const

async function readReplayableNonce(
  csw: `0x${string}`,
  rpcUrl: string,
): Promise<bigint> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const nonce = await client.readContract({
    address: ENTRY_POINT_V06_ADDRESS,
    abi: ENTRY_POINT_V06_GET_NONCE_ABI,
    functionName: 'getNonce',
    args: [csw, REPLAYABLE_NONCE_KEY],
  })
  return nonce as bigint
}

function hashUserOpV06WithoutChainId(op: V06UserOpFields): `0x${string}` {
  const packed = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bytes32' },
    ],
    [
      op.sender,
      op.nonce,
      keccak256(op.initCode),
      keccak256(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      keccak256(op.paymasterAndData),
    ],
  )
  return keccak256(packed)
}

function getUserOpHashWithoutChainIdLocal(
  op: V06UserOpFields,
  entryPoint: `0x${string}`,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }],
      [hashUserOpV06WithoutChainId(op), entryPoint],
    ),
  )
}

type SelfBuiltUserOpLaneTelemetry = {
  step:
    | 'wrap'
    | 'read_nonce'
    | 'build_userop'
    | 'compute_hash'
    | 'sign'
    | 'signature_preflight'
    | 'splice'
    | 'encode_handle_ops'
    | 'submit_relay'
    | 'success'
    | 'error'
  detail: Record<string, unknown>
}

function extractRelayTxHash(relayResponse: unknown): `0x${string}` | null {
  const root = relayResponse && typeof relayResponse === 'object'
    ? relayResponse as Record<string, unknown>
    : null
  const data = root?.data && typeof root.data === 'object'
    ? root.data as Record<string, unknown>
    : null
  const candidates = [
    root?.txHash,
    root?.transactionHash,
    data?.txHash,
    data?.transactionHash,
    data?.hash,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isTxHash(candidate)) {
      return candidate as `0x${string}`
    }
  }
  return null
}

export async function _submitOwnerViaSelfBuiltUserOp(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  csw: `0x${string}`
  innerCallData: `0x${string}`
  rpcUrl?: string
  beneficiary?: `0x${string}`
  onTelemetry?: (event: SelfBuiltUserOpLaneTelemetry) => void
}): Promise<{
  userOp: V06UserOpFields
  hashSigned: `0x${string}`
  signature: `0x${string}`
  handleOpsCalldata: `0x${string}`
  relayResponse: unknown
  txHash: `0x${string}` | null
}> {
  const emit = (event: SelfBuiltUserOpLaneTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      // telemetry must never block owner recovery
    }
  }

  const innerSelector = params.innerCallData.slice(0, 10).toLowerCase()
  if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
    throw new Error(
      `Inner selector ${innerSelector} is not in canSkipChainIdValidation. Only addOwnerAddress / addOwnerPublicKey / removeOwnerAtIndex / removeLastOwner / upgradeToAndCall are valid for the replayable lane.`,
    )
  }
  const wrappedData = encodeExecuteWithoutChainIdValidation(params.innerCallData)
  emit({ step: 'wrap', detail: { innerSelector, innerCallData: params.innerCallData, wrappedData } })

  const rpcUrl = params.rpcUrl ?? 'https://mainnet.base.org'
  const nonce = await readReplayableNonce(params.csw, rpcUrl)
  emit({ step: 'read_nonce', detail: { nonce: `0x${nonce.toString(16)}` } })

  const userOp: V06UserOpFields = {
    sender: params.csw,
    nonce,
    initCode: '0x',
    callData: wrappedData,
    callGasLimit: 150_000n,
    verificationGasLimit: 1_000_000n,
    preVerificationGas: 0n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    paymasterAndData: '0x',
    signature: '0x',
  }
  emit({ step: 'build_userop', detail: { userOp: serializeUserOpForLog(userOp) } })

  const hashToSign = getUserOpHashWithoutChainIdLocal(userOp, ENTRY_POINT_V06_ADDRESS)
  emit({ step: 'compute_hash', detail: { hashToSign } })

  const signature = (await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, params.csw],
  })) as `0x${string}`
  if (!signature || !signature.startsWith('0x')) {
    emit({ step: 'error', detail: { stage: 'sign', signature } })
    throw new Error('personal_sign did not return a valid signature.')
  }
  emit({
    step: 'sign',
    detail: { hashSigned: hashToSign, signature, signatureLengthBytes: (signature.length - 2) / 2 },
  })
  const parsedSignature = parseSignatureForRecovery(signature)
  if (parsedSignature.ecdsaSignature) {
    const preflight = await preflightOwnerKeyMismatch({
      walletRequest: params.walletRequest,
      sender: params.csw,
      hashToSign,
      signature,
      sessionKind: 'external_signer',
    })
    emit({
      step: 'signature_preflight',
      detail: {
        outcome: preflight.kind,
        ownerIndex: parsedSignature.ownerIndex,
        signatureLengthBytes: (signature.length - 2) / 2,
        recoveredAddress:
          'recoveredAddress' in preflight ? preflight.recoveredAddress : null,
        parsedOwnerAddress:
          'parsedOwnerAddress' in preflight ? preflight.parsedOwnerAddress : null,
      },
    })
    if (preflight.kind === 'mismatch') {
      emit({
        step: 'error',
        detail: {
          stage: 'sign',
          reason: 'coinbase_returned_non_owner_eoa_signature_for_self_auth',
          ownerIndex: parsedSignature.ownerIndex,
          signatureLengthBytes: (signature.length - 2) / 2,
          parsedOwnerAddress: preflight.parsedOwnerAddress,
          recoveredAddress: preflight.recoveredAddress,
          recoveredRawAddress: preflight.recoveredRawAddress,
          recoveredEip191Address: preflight.recoveredEip191Address,
        },
      })
      throw new Error(
        `Coinbase returned an ECDSA signature for owner[${parsedSignature.ownerIndex ?? '?'}], but it does not recover to that on-chain owner. Open /add-owner in a browser session that can sign with the CSW's real owner key.`,
      )
    }
  }

  const signedUserOp: V06UserOpFields = { ...userOp, signature }
  emit({ step: 'splice', detail: { signedUserOp: serializeUserOpForLog(signedUserOp) } })

  const beneficiary = params.beneficiary ?? params.csw
  const handleOpsCalldata = encodeHandleOpsV06(signedUserOp, beneficiary)
  emit({
    step: 'encode_handle_ops',
    detail: {
      entryPointAddress: ENTRY_POINT_V06_ADDRESS,
      beneficiary,
      handleOpsCalldata,
      handleOpsLengthBytes: (handleOpsCalldata.length - 2) / 2,
    },
  })

  const relayBody = {
    chainId: params.chainId,
    to: ENTRY_POINT_V06_ADDRESS,
    data: handleOpsCalldata,
    value: '0',
    user: params.csw,
  }
  emit({ step: 'submit_relay', detail: { stage: 'request', relayBody } })

  const fetchResult = await apiFetch('/api/relay/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayBody),
  })
  if (!fetchResult.ok) {
    let rawText = ''
    let parsedBody: unknown = null
    try {
      rawText = await fetchResult.clone().text()
    } catch {
      // ignore
    }
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null
    } catch {
      // not JSON
    }
    const errMessage = await resolveApiErrorMessage(fetchResult, 'Relay /execute proxy failed')
    emit({
      step: 'error',
      detail: {
        stage: 'submit_relay',
        status: fetchResult.status,
        message: errMessage,
        rawBodyFirst500: rawText.slice(0, 500),
        rawBodyTotalLen: rawText.length,
        parsedBody,
      },
    })
    throw new Error(errMessage)
  }
  const relayResponse = await fetchResult.json()
  const txHash = extractRelayTxHash(relayResponse)
  emit({ step: 'success', detail: { relayResponse, txHash } })
  return {
    userOp: signedUserOp,
    hashSigned: hashToSign,
    signature,
    handleOpsCalldata,
    relayResponse,
    txHash,
  }
}

type ReplayableLaneTelemetry = {
  step: 'wrap' | 'prepare' | 'sign' | 'send' | 'poll' | 'success' | 'error'
  detail: Record<string, unknown>
}

export async function _submitOwnerViaReplayablePreparedCalls(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  csw: `0x${string}`
  innerCallData: `0x${string}`
  paymasterUrl: string | null
  onTelemetry?: (event: ReplayableLaneTelemetry) => void
}): Promise<{
  txHash: `0x${string}` | null
  callsId: string | null
  signatureRequestHash: `0x${string}` | null
  hashSigned: `0x${string}` | null
  signature: `0x${string}` | null
  preparedUserOp: unknown
  rawCallsStatus: unknown
}> {
  const emit = (event: ReplayableLaneTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      // telemetry must never block owner recovery
    }
  }
  const innerSelector = params.innerCallData.slice(0, 10).toLowerCase()
  if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
    throw new Error(
      `Inner selector ${innerSelector} is not in canSkipChainIdValidation. Only addOwnerAddress / addOwnerPublicKey / removeOwnerAtIndex / removeLastOwner / upgradeToAndCall are valid for the replayable lane.`,
    )
  }

  const wrappedData = encodeExecuteWithoutChainIdValidation(params.innerCallData)
  emit({ step: 'wrap', detail: { innerSelector, innerCallData: params.innerCallData, wrappedData } })

  const chainIdHex = `0x${params.chainId.toString(16)}`
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
    from: params.csw,
    chainId: chainIdHex,
    calls: [{ to: params.csw, data: wrappedData, value: '0x0' }],
    capabilities,
  }
  emit({ step: 'prepare', detail: { prepareCallsPayload } })

  const prepareResult = (await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [prepareCallsPayload],
  })) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    emit({ step: 'error', detail: { stage: 'prepare', prepareResult } })
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    emit({ step: 'error', detail: { stage: 'prepare', prepareResult } })
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  const hashToSign = unwrapDoubleHexEncodedHash(
    prepareResult.signatureRequest.hash as `0x${string}`,
  )
  emit({
    step: 'prepare',
    detail: {
      stage: 'prepared',
      signatureRequestHash: prepareResult.signatureRequest.hash,
      hashToSign,
      preparedUserOp: prepareResult.userOp,
    },
  })

  let signature: `0x${string}` | null = null
  try {
    signature = (await params.walletRequest({
      method: 'personal_sign',
      params: [hashToSign, params.csw],
    })) as `0x${string}`
  } catch (signError) {
    emit({
      step: 'error',
      detail: {
        stage: 'sign',
        error: signError instanceof Error ? signError.message : String(signError ?? ''),
      },
    })
    throw signError
  }
  if (!signature || !signature.startsWith('0x')) {
    emit({ step: 'error', detail: { stage: 'sign', signature } })
    throw new Error('personal_sign did not return a valid signature.')
  }
  emit({
    step: 'sign',
    detail: { hashSigned: hashToSign, signature, signatureLengthBytes: (signature.length - 2) / 2 },
  })

  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.csw,
    signature,
  })

  const sendResult = (await params.walletRequest({
    method: 'wallet_sendPreparedCalls',
    params: [{
      version: '1.0',
      type: prepareResult.type ?? 'user-operation-v06',
      data: prepareResult.userOp,
      chainId: prepareResult.chainId ?? chainIdHex,
      signature: signaturePayload,
    }],
  })) as unknown

  const callsId =
    typeof sendResult === 'string'
      ? sendResult
      : Array.isArray(sendResult) && typeof sendResult[0] === 'string'
        ? sendResult[0]
        : sendResult && typeof sendResult === 'object' && typeof (sendResult as { id?: unknown }).id === 'string'
          ? String((sendResult as { id: string }).id)
          : ''
  emit({ step: 'send', detail: { sendResult, callsId } })

  if (!callsId) {
    return {
      txHash: null,
      callsId: null,
      signatureRequestHash: prepareResult.signatureRequest.hash as `0x${string}`,
      hashSigned: hashToSign,
      signature,
      preparedUserOp: prepareResult.userOp,
      rawCallsStatus: sendResult,
    }
  }

  const startedAt = Date.now()
  let lastStatus: unknown = null
  while (Date.now() - startedAt < PREPARED_CALLS_STATUS_TIMEOUT_MS) {
    const statusResult = await params.walletRequest({
      method: 'wallet_getCallsStatus',
      params: [callsId],
    })
    lastStatus = statusResult
    const statusCode = Number((statusResult as { status?: unknown } | null)?.status)
    const receipts = Array.isArray((statusResult as { receipts?: unknown[] } | null)?.receipts)
      ? ((statusResult as { receipts: unknown[] }).receipts ?? [])
      : []
    const receiptHash =
      receipts
        .map((receipt) => String((receipt as { transactionHash?: unknown } | null)?.transactionHash ?? ''))
        .find((value) => isTxHash(value)) ?? null
    emit({ step: 'poll', detail: { statusCode, hasReceipt: Boolean(receiptHash) } })
    if (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 300) {
      emit({ step: 'success', detail: { txHash: receiptHash, statusCode } })
      return {
        txHash: receiptHash as `0x${string}` | null,
        callsId,
        signatureRequestHash: prepareResult.signatureRequest.hash as `0x${string}`,
        hashSigned: hashToSign,
        signature,
        preparedUserOp: prepareResult.userOp,
        rawCallsStatus: statusResult,
      }
    }
    if (Number.isFinite(statusCode) && statusCode >= 300) {
      emit({ step: 'error', detail: { stage: 'poll', statusCode, statusResult } })
      throw new Error(`wallet_sendPreparedCalls failed with status ${statusCode}`)
    }
    await delay(PREPARED_CALLS_STATUS_POLL_MS)
  }
  return {
    txHash: null,
    callsId,
    signatureRequestHash: prepareResult.signatureRequest.hash as `0x${string}`,
    hashSigned: hashToSign,
    signature,
    preparedUserOp: prepareResult.userOp,
    rawCallsStatus: lastStatus,
  }
}

export async function _submitOwnerViaPreparedCallsWithEoaOwner(params: {
  // Coinbase / Base App provider request fn. Routes the
  // `wallet_prepareCalls` and `wallet_sendPreparedCalls` Coinbase-only RPC
  // methods (and the status poll) through the CSW provider.
  cswRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  // External EOA connector request fn. Routes `personal_sign` to the
  // wallet whose connected address matches `eoaOwnerAddress` — the whole
  // point of this lane is to bypass the Base App popup, which substitutes
  // a sub-account key not present in the CSW owner array. If both
  // transports happen to be the same provider (e.g. the on-chain EOA
  // owner is the same wallet that's hosting the CSW), the caller can
  // pass the same request fn for both.
  signerRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  // The on-chain EOA owner address signing this userOp. Used as the
  // `from` field for personal_sign and the recovery target for the
  // mismatch guard.
  eoaOwnerAddress: `0x${string}`
  // Owner index inside the CSW.owners[] array for `eoaOwnerAddress`.
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
    capabilities?: Record<string, unknown>
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

  // Sign userOpHash with the connected EOA owner's connector. `from` MUST be
  // the EOA address, not the CSW — this is the key difference vs the popup
  // self-auth lane. The bundler does plain ecrecover(userOpHash, sig) on this
  // path, so no replaySafeHash wrap is applied here either.
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

  // Recover for sanity. If recovery doesn't land on the connected EOA, the
  // wallet is signing with a different key (e.g. Base App sub-account). Fail
  // fast with a clear message so the user knows to try a different connector.
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

  // Wrap as ERC-1271 SignatureWrapper(ownerIndex, ecdsaSig) and frame as
  // `secp256k1` so the bundler RPC routes it through ecrecover for this owner
  // index.
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
      // The CSW owner index for `eoaOwnerAddress`. Some bundler builds key
      // off `ownerIndex` directly; passing it as a hint is harmless and
      // matches the SignatureWrapper convention.
      ownerIndex: params.eoaOwnerIndex,
    }],
  })) as unknown

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
        try {
          console.error('[_submitOwnerViaPreparedCalls] wallet_getCallsStatus FAILED', {
            statusCode,
            result: JSON.stringify(result).slice(0, 600),
          })
        } catch {}
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

// Decode hex-encoded bytes to a UTF-8 string (used to unwrap the
// double-hex-encoded `signatureRequest.hash` returned by wallet_prepareCalls).
// Mirrors viem's hexToString, which is what the Coinbase Wallet SDK uses
// (see createSubAccountSigner.ts).
function hexBytesToUtf8(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  if (stripped.length % 2 !== 0) throw new Error('odd-length hex')
  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

// Idempotently unwrap the double-hex-encoded hash returned by wallet_prepareCalls.
// If the bytes UTF-8-decode to a `0x...` string of length 66, that is the
// outer encoding and we return the inner hex string. Otherwise we return the
// original value untouched. Safe to call on an already-unwrapped hash.
export function unwrapDoubleHexEncodedHash(hash: `0x${string}`): `0x${string}` {
  try {
    const decoded = hexBytesToUtf8(hash)
    if (
      decoded.length === 66 &&
      (decoded.startsWith('0x') || decoded.startsWith('0X')) &&
      /^0x[0-9a-fA-F]{64}$/.test(decoded)
    ) {
      return decoded.toLowerCase() as `0x${string}`
    }
  } catch { /* not double-encoded; fall through */ }
  return hash
}

// Decide which `signature` payload shape to send to wallet_sendPreparedCalls
// based on the bytes returned by personal_sign. The CB SDK's
// createSubAccountSigner.ts uses the same heuristic: hex => secp256k1, anything
// else => webauthn.
//
// The non-obvious case is that the Base App popup, for a CSW session backed by
// a passkey, returns a hex-prefixed string that is NOT a 65-byte EOA signature
// — it is an ERC-1271 SignatureWrapper produced by the wallet for the active
// owner. Sending that as `type: 'secp256k1'` causes the bundler to ecrecover
// against the wrong shape and reject with -32507. In that case we omit the
// `secp256k1` framing and pass the wrapped signature through verbatim, which
// matches what the bundler’s ERC-1271 verification path expects.
export function buildSendPreparedCallsSignaturePayload(input: {
  sender: `0x${string}`
  signature: `0x${string}`
}): unknown {
  const sigBytes = (input.signature.length - 2) / 2
  // 65 bytes is the only valid raw-ECDSA shape.
  if (sigBytes === 65) {
    return {
      type: 'secp256k1' as const,
      data: { address: input.sender, signature: input.signature },
    }
  }
  // Otherwise treat it as an ERC-1271-style wrapped signature produced by the
  // popup. Newer Base App / CB SDK builds accept this shape directly.
  return {
    type: 'webauthn' as const,
    data: {
      // The popup already produced the SignatureWrapper bytes; we forward them.
      signature: input.signature,
      // Address is included as a hint for verifiers that key off of the signer.
      address: input.sender,
    },
  }
}

// ── Pre-flight mismatch guard helpers ─────────────────────────────────
// Tri-state-friendly: `ok` (recovered === owner), `mismatch` (recovered !== owner,
// owner is an EOA), `skipped_code_bearing` (owner has code so we can't pre-flight
// the bundler ecrecover path), `unknown` (recovery failed or owner snapshot
// unavailable — caller should proceed without blocking).
type PreflightOutcome =
  | {
      kind: 'ok'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}`
      recoveredAddress: `0x${string}`
      recoveredRawAddress: `0x${string}` | null
      recoveredEip191Address: `0x${string}` | null
    }
  | {
      kind: 'mismatch'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}`
      recoveredAddress: `0x${string}`
      recoveredRawAddress: `0x${string}` | null
      recoveredEip191Address: `0x${string}` | null
    }
  | { kind: 'skipped_code_bearing'; parsedOwnerIndex: number | null; parsedOwnerAddress: `0x${string}` | null }
  | { kind: 'skipped_webauthn'; reason: string }
  | {
      // Self-auth Base App / CSW session: `sender === walletProvider`, so the
      // popup may sign with an ephemeral session-key (sub-account) that is not
      // present in the CSW owner array. The bundler validates that signature
      // through Coinbase's sub-account / ERC-1271 path — local ecrecover
      // against `ownerAtIndex(parsedOwnerIndex)` is inapplicable. We surface
      // this as its own outcome (instead of `mismatch`) so the caller can
      // proceed without throwing while still distinguishing it from a real
      // EOA-owner mismatch in logs/telemetry.
      kind: 'skipped_self_auth_session_key'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}`
      recoveredAddress: `0x${string}`
      recoveredRawAddress: `0x${string}` | null
      recoveredEip191Address: `0x${string}` | null
    }
  | { kind: 'unknown'; reason: string }

const CSW_OWNER_AT_INDEX_ABI = [
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

function hexByteLength(value: string): number {
  if (typeof value !== 'string' || !value.startsWith('0x')) return 0
  return Math.max(0, (value.length - 2) / 2)
}

// Parse an ERC-1271 SignatureWrapper-shaped payload (or a raw 65-byte ECDSA sig)
// into an ownerIndex + inner ECDSA bytes. Mirrors the probe's parseWalletSignature
// but returns only what the guard needs.
function parseSignatureForRecovery(signature: `0x${string}`): {
  ownerIndex: number | null
  ecdsaSignature: `0x${string}` | null
} {
  if (hexByteLength(signature) === 65) {
    return { ownerIndex: null, ecdsaSignature: signature }
  }
  const tryDecodeTuple = (value: `0x${string}`) => {
    const [ownerIndexRaw, signatureData] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      value,
    )
    const ownerIndex = Number(ownerIndexRaw)
    const sigData = signatureData as `0x${string}`
    return {
      ownerIndex,
      ecdsaSignature: hexByteLength(sigData) === 65 ? sigData : null,
    }
  }
  try {
    return tryDecodeTuple(signature)
  } catch {
    /* fall through */
  }
  try {
    const [innerBytes] = decodeAbiParameters([{ type: 'bytes' }], signature)
    return tryDecodeTuple(innerBytes as `0x${string}`)
  } catch {
    /* fall through */
  }
  // Single leading 0x20 ABI offset word seen with the Base App popup wrapper.
  if (hexByteLength(signature) >= 96) {
    const headWord = signature.slice(2, 66).toLowerCase()
    if (headWord === '0000000000000000000000000000000000000000000000000000000000000020') {
      try {
        const stripped = (`0x${signature.slice(66)}`) as `0x${string}`
        return tryDecodeTuple(stripped)
      } catch {
        /* fall through */
      }
    }
  }
  return { ownerIndex: null, ecdsaSignature: null }
}

function decodeOwnerBytesAsAddress(ownerBytes: `0x${string}`): `0x${string}` | null {
  const len = hexByteLength(ownerBytes)
  if (len !== 32) return null
  try {
    const [decoded] = decodeAbiParameters([{ type: 'address' }], ownerBytes)
    const lower = String(decoded).toLowerCase()
    if (!isAddress(lower) || lower === '0x0000000000000000000000000000000000000000') return null
    return getAddress(lower) as `0x${string}`
  } catch {
    return null
  }
}

export async function preflightOwnerKeyMismatch(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  sender: `0x${string}`
  hashToSign: `0x${string}`
  signature: `0x${string}`
  // Optional. When set to 'self_auth' (Base App / CSW signing for itself,
  // i.e. `sender === walletProvider`), an ECDSA mismatch against the parsed
  // on-chain owner is downgraded from `mismatch` to
  // `skipped_self_auth_session_key` because the popup may legitimately
  // return an ephemeral sub-account session key that the bundler validates
  // via Coinbase's sub-account path. Default ('external_signer') preserves
  // strict mismatch-throws behavior for EOA-owner connectors that should be
  // signing with an on-chain owner key.
  sessionKind?: 'self_auth' | 'external_signer'
}): Promise<PreflightOutcome> {
  // Recognize passkey signatures up front. The bundler routes WebAuthnAuth
  // payloads through CSW's `WebAuthn.verify` (FCL_Elliptic_ZZ ecZZ_mulmuladd_S_asm)
  // rather than `ecrecover`, so any ecrecover-based pre-flight would garbage
  // out. Skip the guard cleanly so a real passkey signature is never blocked
  // on the way to the bundler. We cannot pre-flight WebAuthn statelessly.
  const shape = detectSignatureShape(params.signature)
  if (shape.kind === 'webauthn') {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[preflightOwnerKeyMismatch] passkey signature — skipping EOA recovery preflight')
    }
    return { kind: 'skipped_webauthn', reason: 'webauthn signature shape — bundler will verify via CSW.WebAuthn.verify' }
  }

  const parsed = parseSignatureForRecovery(params.signature)
  if (!parsed.ecdsaSignature) {
    return { kind: 'unknown', reason: 'no recoverable 65-byte ecdsa component' }
  }
  // For a raw-ECDSA signature (no wrapper), the ownerIndex is unknown and we
  // can't look up the owner without an extra RPC; let it through.
  if (parsed.ownerIndex === null) {
    return { kind: 'unknown', reason: 'raw 65-byte ecdsa with no parsed owner index' }
  }

  let ownerBytes: `0x${string}` | null = null
  try {
    const result = (await params.walletRequest({
      method: 'eth_call',
      params: [
        {
          to: params.sender,
          data: encodeOwnerAtIndexCall(parsed.ownerIndex),
        },
        'latest',
      ],
    })) as string
    if (typeof result === 'string' && result.startsWith('0x')) {
      ownerBytes = decodeOwnerAtIndexResult(result as `0x${string}`)
    }
  } catch {
    return { kind: 'unknown', reason: 'eth_call ownerAtIndex failed' }
  }
  if (!ownerBytes) {
    return { kind: 'unknown', reason: 'ownerAtIndex returned no bytes' }
  }
  const ownerAddress = decodeOwnerBytesAsAddress(ownerBytes)
  if (!ownerAddress) {
    // 64-byte passkey or non-address slot → ERC-1271-only path, skip pre-flight.
    return { kind: 'skipped_code_bearing', parsedOwnerIndex: parsed.ownerIndex, parsedOwnerAddress: null }
  }

  let codeAtOwner = '0x'
  try {
    const code = (await params.walletRequest({
      method: 'eth_getCode',
      params: [ownerAddress, 'latest'],
    })) as string
    if (typeof code === 'string') codeAtOwner = code
  } catch {
    return { kind: 'unknown', reason: 'eth_getCode failed' }
  }
  if (codeAtOwner !== '0x' && codeAtOwner !== '0x0') {
    return {
      kind: 'skipped_code_bearing',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
    }
  }

  // CSW EOA owner verification accepts BOTH raw ecrecover(hash, sig) AND
  // ecrecover(toEthSignedMessageHash(hash), sig) — Solady's
  // SignatureCheckerLib.isValidSignatureNowCalldata tries both, mirroring
  // the dual-path note at coinbaseErc4337.ts:1889-1891. Connectors that
  // return a standard `personal_sign` (EIP-191 prefixed) signature only
  // recover correctly against the EIP-191-wrapped hash, so the guard must
  // accept either match before declaring a mismatch.
  let recoveredRaw: `0x${string}` | null = null
  try {
    recoveredRaw = await recoverAddress({ hash: params.hashToSign, signature: parsed.ecdsaSignature })
  } catch {
    /* fall through — still try EIP-191 path */
  }
  let recoveredEip191: `0x${string}` | null = null
  try {
    recoveredEip191 = await recoverMessageAddress({
      message: { raw: params.hashToSign },
      signature: parsed.ecdsaSignature,
    })
  } catch {
    /* fall through — handled below */
  }

  if (!recoveredRaw && !recoveredEip191) {
    // Both recoveries failed — malformed signature. Preserve tri-state:
    // surface as 'unknown — proceeding' rather than blocking, so flows
    // we can't pre-flight (e.g. WebAuthn) keep working.
    return { kind: 'unknown', reason: 'ecrecover failed (raw and eip191)' }
  }

  const ownerLower = ownerAddress.toLowerCase()
  if (recoveredRaw && recoveredRaw.toLowerCase() === ownerLower) {
    return {
      kind: 'ok',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredRaw,
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  if (recoveredEip191 && recoveredEip191.toLowerCase() === ownerLower) {
    return {
      kind: 'ok',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredEip191,
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  // Self-auth lane: the wallet provider IS the CSW (sender === connected
  // address). The Base App popup is allowed to sign with an ephemeral
  // sub-account session key that is not on-chain at the parsed owner index;
  // the bundler still validates through Coinbase's sub-account path. Don't
  // block submission — surface the recovered keys so callers (and the probe
  // page) can still log/telemetry the substitution, but mark it as a skip
  // rather than a hard mismatch.
  if (params.sessionKind === 'self_auth') {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(
        '[preflightOwnerKeyMismatch] self-auth session key substitution — bundler will validate via sub-account path',
        {
          parsedOwnerIndex: parsed.ownerIndex,
          parsedOwnerAddress: ownerAddress,
          recoveredRaw,
          recoveredEip191,
        },
      )
    }
    return {
      kind: 'skipped_self_auth_session_key',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredRaw ?? recoveredEip191 ?? ('0x' as `0x${string}`),
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  return {
    kind: 'mismatch',
    parsedOwnerIndex: parsed.ownerIndex,
    parsedOwnerAddress: ownerAddress,
    recoveredAddress: recoveredRaw ?? recoveredEip191 ?? ('0x' as `0x${string}`),
    recoveredRawAddress: recoveredRaw,
    recoveredEip191Address: recoveredEip191,
  }
}

function encodeOwnerAtIndexCall(index: number): `0x${string}` {
  return encodeFunctionData({
    abi: CSW_OWNER_AT_INDEX_ABI,
    functionName: 'ownerAtIndex',
    args: [BigInt(index)],
  })
}

function decodeOwnerAtIndexResult(result: `0x${string}`): `0x${string}` | null {
  try {
    const [bytes] = decodeAbiParameters([{ type: 'bytes' }], result)
    return bytes as `0x${string}`
  } catch {
    return null
  }
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
  ownerInstallIntent?: OwnerInstallIntent
  customOwnerPolicyToken?: string | null
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
    ownerInstallIntent,
    customOwnerPolicyToken,
    preferSponsoredFirst,
  } = params
  const effectiveApprovalRunId = typeof approvalRunId === 'string' && approvalRunId.trim() ? approvalRunId.trim() : `approval-${Date.now()}`
  const effectiveOwnerInstallIntent: OwnerInstallIntent = ownerInstallIntent ?? 'embeddedOwner'
  const effectiveCustomOwnerPolicyToken =
    typeof customOwnerPolicyToken === 'string' && customOwnerPolicyToken.trim()
      ? customOwnerPolicyToken.trim()
      : null
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
      const customCoOwnerSponsoredLane =
        effectiveOwnerInstallIntent === 'customCoOwner' && Boolean(effectiveCustomOwnerPolicyToken)
      const customCoOwnerDirectLane =
        effectiveOwnerInstallIntent === 'customCoOwner' && !customCoOwnerSponsoredLane
      const ownerIndexLookupAddressForUserOp =
        selfAuthenticatedCanonicalSession &&
        !customCoOwnerSponsoredLane &&
        typeof ownerIndexLookupAddress === 'string' &&
        isAddress(ownerIndexLookupAddress)
          ? ownerIndexLookupAddress
          : selfAuthenticatedCanonicalSession &&
              effectiveOwnerInstallIntent !== 'customCoOwner' &&
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
              ownerIndexOverride:
                selfAuthenticatedCanonicalSession && customCoOwnerSponsoredLane ? 0 : undefined,
              calls: [{ to: txRequest.to, data: txRequest.data, value: 0n }],
              version: '1',
              useTypedDataSigning: selfAuthenticatedCanonicalSession && opts?.disableTypedDataSigning !== true,
              ownerApprovalContext: {
                approvalRunId: effectiveApprovalRunId,
                stage,
                executionMode,
                attempt: opts?.attempt ?? null,
                customOwnerPolicyToken: customCoOwnerSponsoredLane ? effectiveCustomOwnerPolicyToken : null,
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

          const runDirectSendTxWithDiagnostics = async (): Promise<`0x${string}`> => {
            try {
              return await runDirectSendTx()
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
              throw toOwnerApprovalDebugError({
                error: sendTxError,
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                attempt: 1,
                lane: 'custom_co_owner_direct',
              })
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

          const runSponsoredCustomCoOwnerFallback = async () => {
            try {
              txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 1 })
              return
            } catch (nonTypedUserOpError) {
              if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_nontyped',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(nonTypedUserOpError).code,
                message: nonTypedUserOpError instanceof Error ? nonTypedUserOpError.message : String(nonTypedUserOpError ?? ''),
              })
              txHash = await runSponsoredCanonicalUserOp({ attempt: 2 })
            }
          }

          if (customCoOwnerDirectLane) {
            txHash = await runDirectSendTxWithDiagnostics()
          } else if (customCoOwnerSponsoredLane) {
            await runSponsoredCustomCoOwnerFallback()
          } else if (preferSponsoredFirst) {
            await runSponsoredThenDirectFallback()
          } else {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'userop_typed',
              status: 'start',
              attempt: 0,
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
            })
            try {
              const innerSelector = txRequest.data.slice(0, 10).toLowerCase()
              if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
                throw new Error(`Prepared owner install selector ${innerSelector} cannot use the replayable self-auth lane.`)
              }
              const selfBuiltResult = await _submitOwnerViaSelfBuiltUserOp({
                walletRequest,
                chainId: base.id,
                csw: canonicalSmartWalletAddress as `0x${string}`,
                innerCallData: txRequest.data,
                onTelemetry: (event) => {
                  try {
                    if (event.step === 'error') {
                      console.warn('[selfBuiltUserOpRelay]', event.step, event.detail)
                    } else {
                      console.info('[selfBuiltUserOpRelay]', event.step, event.detail)
                    }
                  } catch {
                    // console telemetry must never block owner recovery
                  }
                },
              })
              if (!selfBuiltResult.txHash) {
                throw new Error('Relay accepted the self-built UserOp without returning a transaction hash. Retry shortly before attempting another lane.')
              }
              txHash = selfBuiltResult.txHash
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_typed',
                status: 'success',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                txHash,
              })
            } catch (selfBuiltUserOpError) {
              if (isUserRejectedWalletAction(selfBuiltUserOpError)) throw selfBuiltUserOpError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_typed',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(selfBuiltUserOpError).code,
                message: selfBuiltUserOpError instanceof Error
                  ? selfBuiltUserOpError.message
                  : String(selfBuiltUserOpError ?? ''),
              })
              throw selfBuiltUserOpError
            }
          }
        } else {
          if (customCoOwnerDirectLane) {
            if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
              throw new Error('Signer wallet does not expose eth_sendTransaction in this session. Reconnect and retry.')
            }
            try {
              txHash = await walletClient.sendTransaction({
                account: walletClient.account as any,
                chain: base,
                to: txRequest.to,
                data: txRequest.data,
                value: 0n,
              })
            } catch (sendTxError) {
              if (isUserRejectedWalletAction(sendTxError)) throw sendTxError
              throw toOwnerApprovalDebugError({
                error: sendTxError,
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                attempt: 1,
                lane: 'custom_co_owner_direct',
              })
            }
          } else {
            // No walletRequest available — try UserOp paths directly
            if (customCoOwnerSponsoredLane) {
              try {
                txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 1 })
              } catch (nonTypedUserOpError) {
                if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
                txHash = await runSponsoredCanonicalUserOp({ attempt: 2 })
              }
            } else {
              try {
                txHash = await runSponsoredCanonicalUserOp({ attempt: 1 })
              } catch (typedUserOpError) {
                if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
                txHash = await runSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
              }
            }
          }
        }
        if (!txHash) {
          throw new Error('Owner approval failed: no execution path produced a result.')
        }
      } else {
        if (customCoOwnerDirectLane) {
          if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
            throw new Error('Connect the current owner wallet to submit this co-owner approval.')
          }
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage: 'send_calls',
            status: 'start',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
          })
          try {
            txHash = await walletClient.sendTransaction({
              account: walletClient.account as any,
              chain: base,
              to: txRequest.to,
              data: txRequest.data,
              value: 0n,
            })
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
            throw toOwnerApprovalDebugError({
              error: sendTxError,
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              attempt: 1,
              lane: 'custom_co_owner_direct',
            })
          }
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage: 'send_calls',
            status: 'success',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
            txHash,
          })
        } else {
          txHash = await runSponsoredCanonicalUserOp()
        }
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
