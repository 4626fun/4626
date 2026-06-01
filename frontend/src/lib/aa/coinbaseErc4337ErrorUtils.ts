import { decodeErrorResult, type Hex } from 'viem'

import { isHexString } from '@/lib/aa/coinbaseErc4337Signature'
import { ZORA_SWAP_SIMULATION_FAILED_MESSAGE } from '@/lib/swap/swapStatusCopy'

/** Bundlers vary receipt shape — read tx hash from nested or top-level fields. */
export function extractUserOpReceiptTxHash(receipt: unknown): Hex | null {
  if (!receipt || typeof receipt !== 'object') return null
  const r = receipt as Record<string, unknown>
  const nested = r.receipt as Record<string, unknown> | undefined
  const candidates = [nested?.transactionHash, nested?.txHash, r.transactionHash, r.txHash]
  for (const candidate of candidates) {
    if (isHexString(candidate)) return candidate
  }
  return null
}

// Known error selectors for decoding revert reasons.
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  '0x08c379a0': 'Error(string)',
  '0x4e487b71': 'Panic(uint256)',
  // Coinbase Smart Wallet errors
  '0x82b42900': 'Unauthorized()',
  // Deployment-batcher errors
  '0x30cd7471': 'NotOwner()',
  '0xd92e233d': 'ZeroAddress()',
  '0xb92e9c7a': 'InvalidPercent()',
  '0x1375159e': 'InvalidCodeId()',
  '0x02058db0': 'Phase1Missing()',
  '0x7c604444': 'Phase1CoreMissing()',
  '0x8d8721fc': 'Phase1StateMismatch()',
  '0x585b9263': 'InvalidWeight()',
  '0xe10fdfee': 'V3PoolMissing()',
  '0x24c0a9e0': 'MissingInitialSqrtPriceX96()',
  '0x18b789e6': 'AuctionAlreadyPending()',
  '0x0fd83a8b': 'NoPendingAuction()',
  '0x56a694d2': 'AuctionShareOFTMismatch()',
  '0x8284e8bf': 'AuctionAmountMismatch()',
  '0xf79c143b': 'Phase2Missing()',
  // UniversalCreate2DeployerFromStore
  '0x8164ae93': 'NotAuthorizedDeployer()',
  '0xb4f54111': 'DeployFailed()',
  '0x2c4029e9': 'ExecutionFailed(uint256,bytes)',
  '0xb0669cbc': 'InvalidContractSignature()',
  '0x3b99b53d': 'SliceOutOfBounds()',
}

export function isAccountNonceMismatchError(error: unknown): boolean {
  const lower = getErrorDiagnosticMessage(error).toLowerCase()
  return lower.includes('aa25') || lower.includes('invalid account nonce')
}

export function isRpcRateLimitError(error: unknown): boolean {
  const code = (error as { code?: number })?.code
  if (code === -32016 || code === -32011 || code === 429) return true
  const lower = getErrorDiagnosticMessage(error).toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('over rate limit') ||
    lower.includes('rate limit')
  )
}

export function classifyUserOpErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (isAccountNonceMismatchError(error)) return 'aa25_nonce'
  if (lower.includes('aa23')) return 'aa23_validation'
  if (lower.includes('signtypeddata') && lower.includes('timed out')) return 'typed_data_timeout'
  if (lower.includes('paymaster')) return 'paymaster_error'
  if (lower.includes('insufficient funds')) return 'insufficient_funds'
  if (lower.includes('timeout')) return 'timeout'
  return 'unknown'
}

function findHexRevertCandidates(value: unknown, depth = 0, out: Hex[] = []): Hex[] {
  if (depth > 12 || value == null) return out
  if (typeof value === 'string') {
    const matches = value.match(/0x[a-fA-F0-9]{8,}/g)
    if (matches) {
      for (const match of matches) out.push(match as Hex)
    }
    return out
  }
  if (typeof value !== 'object') return out
  const node = value as Record<string, unknown>
  for (const key of ['data', 'revertData', 'returnData'] as const) {
    const candidate = node[key]
    if (typeof candidate === 'string' && candidate.startsWith('0x') && candidate.length >= 10) {
      out.push(candidate as Hex)
    }
  }
  if (node.cause) findHexRevertCandidates(node.cause, depth + 1, out)
  if (Array.isArray(node.metaMessages)) {
    for (const entry of node.metaMessages) findHexRevertCandidates(entry, depth + 1, out)
  }
  if (Array.isArray(node)) {
    for (const entry of node) findHexRevertCandidates(entry, depth + 1, out)
  } else {
    for (const entry of Object.values(node)) findHexRevertCandidates(entry, depth + 1, out)
  }
  return out
}

function pickBestRevertData(candidates: Hex[]): Hex | undefined {
  if (candidates.length === 0) return undefined
  const executionFailed = candidates.find((c) => c.slice(0, 10).toLowerCase() === '0x2c4029e9')
  if (executionFailed) return executionFailed
  return [...candidates].sort((a, b) => b.length - a.length)[0]
}

function findNestedRevertData(value: unknown, depth = 0): Hex | undefined {
  const fromScan = pickBestRevertData(findHexRevertCandidates(value))
  if (fromScan) return fromScan
  if (depth > 8 || value == null || typeof value !== 'object') return undefined
  const node = value as Record<string, unknown>
  for (const key of ['data', 'revertData', 'returnData'] as const) {
    const candidate = node[key]
    if (typeof candidate === 'string' && candidate.startsWith('0x') && candidate.length >= 10) {
      return candidate as Hex
    }
  }
  if (node.cause) {
    const nested = findNestedRevertData(node.cause, depth + 1)
    if (nested) return nested
  }
  if (Array.isArray(node.metaMessages)) {
    for (const entry of node.metaMessages) {
      if (typeof entry !== 'string') continue
      const match = entry.match(/0x[a-fA-F0-9]{8,}/)
      if (match?.[0]) return match[0] as Hex
    }
  }
  return undefined
}

export function extractRevertInfo(e: unknown): { error: string; revertData?: Hex; errorName?: string } {
  const errAny = e as any
  const msg = e instanceof Error ? e.message : String(e ?? '')
  const result: { error: string; revertData?: Hex; errorName?: string } = { error: msg }

  const revertData = findNestedRevertData(errAny)
  if (revertData) {
    result.revertData = revertData
    const selector = revertData.slice(0, 10).toLowerCase()
    if (KNOWN_ERROR_SELECTORS[selector]) {
      result.errorName = KNOWN_ERROR_SELECTORS[selector]
    }
  }

  // Extract error reason from viem's parsed errors.
  if (errAny?.cause?.reason) result.error = errAny.cause.reason
  if (errAny?.shortMessage) result.error = errAny.shortMessage

  return result
}

export function isLikelyVerificationGasLimitError(message: string): boolean {
  const lc = message.toLowerCase()
  return (
    lc.includes('aa40') ||
    lc.includes('signature verification used more gas') ||
    lc.includes('over verificationgaslimit') ||
    lc.includes('over verification gas limit')
  )
}

export function getErrorDiagnosticMessage(error: unknown): string {
  const err = error as any
  const parts: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== 'string') return
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return
    parts.push(normalized)
  }

  push(err?.message)
  push(err?.shortMessage)
  push(err?.details)
  push(err?.cause?.message)
  push(err?.cause?.shortMessage)
  push(err?.cause?.details)

  const appendMetaMessages = (meta: unknown) => {
    if (!Array.isArray(meta)) return
    for (const entry of meta) {
      if (typeof entry === 'string') {
        push(entry)
      } else {
        try {
          push(JSON.stringify(entry))
        } catch {
          // ignore non-serializable entries
        }
      }
    }
  }

  appendMetaMessages(err?.metaMessages)
  appendMetaMessages(err?.cause?.metaMessages)

  const deduped: string[] = []
  for (const item of parts) {
    if (!deduped.includes(item)) deduped.push(item)
  }
  if (deduped.length === 0) {
    return error instanceof Error ? error.message : String(error ?? '')
  }
  return deduped.join(' | ')
}

export function getRpcErrorDetails(error: unknown): string | null {
  const err = error as any
  const details = typeof err?.details === 'string' ? err.details.trim() : ''
  if (details) return details
  const causeDetails = typeof err?.cause?.details === 'string' ? err.cause.details.trim() : ''
  return causeDetails || null
}

export function ensureUserOperationSucceeded(receipt: unknown, context: string): void {
  const r = receipt as any
  const success = r?.success
  const txStatus = r?.receipt?.status
  const reason =
    (typeof r?.reason === 'string' && r.reason) ||
    (typeof r?.revertReason === 'string' && r.revertReason) ||
    (typeof r?.error === 'string' && r.error) ||
    null

  const txReverted =
    txStatus === 'reverted' ||
    txStatus === 0 ||
    txStatus === '0x0' ||
    txStatus === false

  // Bundlers can return a transaction hash even when the specific UserOp reverted.
  // Guard phase progression on UserOp-level success, not just tx inclusion.
  if (success === false || txReverted) {
    const reasonSuffix = reason ? ` Reason: ${reason}` : ''
    throw new Error(`UserOperation reverted during ${context}.${reasonSuffix}`)
  }
}

export function isPaymasterStakeError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    lc.includes('banned opcode') ||
    lc.includes('stake/unstake delay') ||
    lc.includes('entity stake') ||
    lc.includes('unstake delay too low')
  )
}

export function isPaymasterUnavailableError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  // NOTE: Do NOT match generic viem wrapper text like 'resource not available' /
  // 'requested resource not available'. Viem uses that shortMessage for ALL -32002
  // JSON-RPC errors, so matching it would misclassify upstream CDP policy rejections
  // as "paymaster unavailable" and trigger unwanted no-paymaster fallback.
  // Only match our own specific error strings that indicate genuine unavailability.
  return (
    isPaymasterInternalProxyError(error) ||
    lc.includes('cdp paymaster endpoint is not configured') ||
    lc.includes('server misconfigured') ||
    lc.includes('upstream request failed') ||
    lc.includes('method not allowed')
  )
}

export function isPaymasterPolicyError(error: unknown): boolean {
  if (isPaymasterInternalProxyError(error)) return false
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    lc.includes('request denied') ||
    lc.includes('not authenticated') ||
    // CDP paymaster returns this when a sender hits its daily USD
    // sponsorship cap. Treat it as a policy rejection so the caller can
    // fall back to a self-funded UserOp (when the CSW has ETH) — same
    // remediation we'd apply for any other "paymaster said no" case.
    lc.includes('sponsorship limit exceeded') ||
    lc.includes('exceeds defined limit') ||
    // Local paymaster-proxy validator denials (see
    // `frontend/api/_handlers/paymaster/_paymaster.ts`). Each represents
    // a class of UserOp shape the proxy refuses to sponsor (e.g. native
    // ETH swaps via Universal Router, multiple swap-router calls in one
    // UserOp). Fall back to self-funded rather than dead-ending — the
    // bundler call that follows bypasses the `pm_*` validation path.
    lc.includes('swap_router_value_not_allowed') ||
    lc.includes('swap_router_call_count_not_allowed') ||
    // Broader catch for other `_not_allowed` tags our proxy may add.
    /\b[a-z_]+_not_allowed\b/.test(lc)
  )
}

export function isImmediateUserOpRetrySuppressedError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    isPaymasterPolicyError(error) ||
    lc.includes('request exceeds defined limit') ||
    lc.includes('sponsorship limit exceeded') ||
    lc.includes('rate limit exceeded')
  )
}

/** Bundler/EntryPoint failures that will not succeed on immediate retry. */
export function isDeterministicUserOpExecutionError(error: unknown): boolean {
  if (isRpcRateLimitError(error)) return false
  const revertInfo = extractRevertInfo(error)
  if (revertInfo.errorName === 'ExecutionFailed(uint256,bytes)') return true
  const selector = revertInfo.revertData?.slice(0, 10).toLowerCase()
  if (selector === '0x2c4029e9') return true
  const lc = getErrorDiagnosticMessage(error).toLowerCase()
  return (
    lc.includes('0x2c4029e9') ||
    lc.includes('transfer_from_failed') ||
    lc.includes('execution reverted') ||
    lc.includes('reverted for an unknown reason')
  )
}

/** Broad match for bundler/RPC errors that will not succeed on immediate retry. */
export function isExecutionRevertedLikeError(error: unknown): boolean {
  if (isDeterministicUserOpExecutionError(error)) return true
  try {
    const blob = JSON.stringify(error).toLowerCase()
    return (
      blob.includes('execution reverted') ||
      blob.includes('reverted for an unknown reason')
    )
  } catch {
    return false
  }
}

const ZORA_UNIVERSAL_ROUTER_BASE = '0x6ff5693b99212da76ad316178a184ab56d299b43'

/** Coinbase Smart Wallet `execute(address,uint256,bytes)` — bundlers often echo full UserOp callData in RPC errors. */
const CSW_EXECUTE_SELECTOR = '0xb61d27f6'
/** Coinbase Smart Wallet `executeBatch((address,uint256,bytes)[])` — same echo behavior for batched swaps. */
const CSW_EXECUTE_BATCH_SELECTOR = '0x34fcd5be'

const ACTIONABLE_BUNDLER_REVERT_SELECTORS = new Set([
  '0x2c4029e9', // ExecutionFailed(uint256,bytes)
  '0xb0669cbc', // InvalidContractSignature()
  '0x3b99b53d', // SliceOutOfBounds()
  '0x08c379a0', // Error(string)
  '0x4e487b71', // Panic(uint256)
  '0x82b42900', // Unauthorized()
])

/** Long CSW execute/executeBatch payloads are echoed callData, not a decodable on-chain revert. */
export function isEchoedBundlerUserOpCallData(revertData: Hex | undefined): boolean {
  if (!revertData || revertData.length < 200) return false
  const selector = revertData.slice(0, 10).toLowerCase()
  return selector === CSW_EXECUTE_SELECTOR || selector === CSW_EXECUTE_BATCH_SELECTOR
}

export function isActionableBundlerSimulationRevert(revertData: Hex | undefined): boolean {
  if (!revertData || revertData.length < 10) return false
  const selector = revertData.slice(0, 10).toLowerCase()
  if (isEchoedBundlerUserOpCallData(revertData)) return false
  return ACTIONABLE_BUNDLER_REVERT_SELECTORS.has(selector)
}

export function isRpcInvalidParametersEstimateError(error: unknown): boolean {
  const lower = getErrorDiagnosticMessage(error).toLowerCase()
  return (
    lower.includes('invalid parameters were provided') ||
    lower.includes('missing or invalid parameters')
  )
}

export function isPaymasterInternalProxyError(error: unknown): boolean {
  const lower = getErrorDiagnosticMessage(error).toLowerCase()
  return (
    lower.includes('paymaster proxy internal error') ||
    lower.includes('paymaster_proxy_internal_error')
  )
}

/** Bundler stub signatures can false-positive InvalidContractSignature during estimate (not ExecutionFailed). */
export function isBundlerStubSignatureSimulationArtifact(
  revertData: Hex | undefined,
  preflightDirectCallSucceeded: boolean,
): boolean {
  if (!preflightDirectCallSucceeded || !revertData || revertData.length < 10) return false
  return revertData.slice(0, 10).toLowerCase() === '0xb0669cbc'
}

/**
 * Bundler gas estimate can fail while eth_call preflight still passes (stub sig, paymaster stub, state drift).
 * When a swap-router floor callGasLimit is configured, proceed with that floor only for non-actionable estimate noise
 * (invalid RPC params + echoed UserOp callData). Real execution reverts must block send.
 */
export function shouldAdvisorySkipBundlerGasEstimate(params: {
  error: unknown
  firstCallTo?: string
  floorCallGasLimit?: bigint | null
  preflightDirectCallSucceeded?: boolean
}): boolean {
  const floor = params.floorCallGasLimit
  if (typeof floor !== 'bigint' || floor <= 0n) return false
  const revertInfo = extractRevertInfo(params.error)
  if (isActionableBundlerSimulationRevert(revertInfo.revertData)) {
    return isBundlerStubSignatureSimulationArtifact(
      revertInfo.revertData,
      params.preflightDirectCallSucceeded === true,
    )
  }
  const lower = String(revertInfo.error ?? getErrorDiagnosticMessage(params.error)).toLowerCase()
  if (isRpcInvalidParametersEstimateError(params.error)) {
    return isEchoedBundlerUserOpCallData(revertInfo.revertData) || !revertInfo.revertData
  }
  if (isEchoedBundlerUserOpCallData(revertInfo.revertData)) return true
  return (
    lower.includes('execution reverted') ||
    lower.includes('reverted for an unknown reason')
  )
}

export function buildUserOpGasEstimateFailureError(
  error: unknown,
  firstCallTo?: string,
): Error {
  const revertInfo = extractRevertInfo(error)
  const directCallResult = {
    success: false as const,
    error: revertInfo.error,
    revertData: revertInfo.revertData,
    errorName: revertInfo.errorName,
  }
  const callTo = String(firstCallTo ?? '').toLowerCase()
  if (revertInfo.revertData?.slice(0, 10).toLowerCase() === '0x3b99b53d') {
    return buildPreflightSimulationRejectionError({
      simResult: { directCallResult },
      firstCallTo,
    })
  }

  if (
    callTo === ZORA_UNIVERSAL_ROUTER_BASE ||
    revertInfo.errorName === 'ExecutionFailed(uint256,bytes)' ||
    revertInfo.revertData?.slice(0, 10).toLowerCase() === '0x2c4029e9'
  ) {
    return buildPreflightSimulationRejectionError({
      simResult: { directCallResult },
      firstCallTo,
    })
  }
  const detail = getErrorDiagnosticMessage(error)
  return new Error(
    `Bundler could not simulate this smart-wallet transaction (${detail}). Refresh the quote and try again.`,
  )
}

export class PreflightSimulationRejectionError extends Error {
  override readonly name = 'PreflightSimulationRejectionError'
}

export function isPreflightSimulationRejection(error: unknown): error is PreflightSimulationRejectionError {
  return error instanceof PreflightSimulationRejectionError
}

/** True when a fresh quote + higher slippage may fix a CSW preflight revert (not Permit2/auth). */
export function isSwapPreflightSimulationRetryable(error: unknown): boolean {
  if (isPreflightSimulationRejection(error)) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('permit2 rejected') ||
      msg.includes('permit2 approval is missing') ||
      msg.includes('malformed or stale') ||
      msg.includes('transfer_from_failed') ||
      msg.includes('not an on-chain owner') ||
      msg.includes('embedded signer is not')
    ) {
      return false
    }
    return (
      msg.includes('slippage') ||
      msg.includes('would fail on-chain') ||
      msg.includes('would revert') ||
      msg.includes('stale') ||
      msg.includes('too tight') ||
      msg.includes('liquidity')
    )
  }
  const msg = getErrorDiagnosticMessage(error).toLowerCase()
  if (
    msg.includes('permit2 rejected') ||
    msg.includes('0xb0669cbc') ||
    msg.includes('invalidcontractsignature') ||
    msg.includes('not an on-chain owner')
  ) {
    return false
  }
  return (
    msg.includes('would fail on-chain') ||
    msg.includes('would revert') ||
    msg.includes('0x2c4029e9') ||
    msg.includes('slippage') ||
    msg.includes('stale quote') ||
    msg.includes('liquidity')
  )
}

export function parseUserOpGasLimitField(value: unknown): bigint | null {
  if (typeof value === 'bigint' && value > 0n) return value
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return BigInt(Math.floor(value))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      const parsed = trimmed.startsWith('0x') ? BigInt(trimmed) : BigInt(trimmed)
      return parsed > 0n ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/** Prefer bundler-estimated call gas (buffered) over a static Zora floor when both exist. */
export function resolveUserOpCallGasLimit(params: {
  estimatedCallGasLimit?: bigint | null
  floorCallGasLimit?: bigint | null
  bufferNumerator?: bigint
  bufferDenominator?: bigint
}): bigint | undefined {
  const numerator = params.bufferNumerator ?? 130n
  const denominator = params.bufferDenominator ?? 100n
  const estimated = params.estimatedCallGasLimit
  const floor = params.floorCallGasLimit
  let buffered: bigint | undefined
  if (typeof estimated === 'bigint' && estimated > 0n) {
    buffered = (estimated * numerator) / denominator
  }
  if (buffered && floor) return buffered > floor ? buffered : floor
  return buffered ?? floor ?? undefined
}

export function mapUserOpExecutionFailureMessage(
  error: unknown,
  context?: { firstCallTo?: string },
): Error | null {
  const revertInfo = extractRevertInfo(error)
  if (!revertInfo.revertData && !revertInfo.errorName) {
    const lc = getErrorDiagnosticMessage(error).toLowerCase()
    if (!lc.includes('execution reverted') && !lc.includes('reverted for an unknown reason')) {
      return null
    }
  }
  return buildPreflightSimulationRejectionError({
    simResult: {
      success: false,
      error: revertInfo.error,
      revertData: revertInfo.revertData,
      errorName: revertInfo.errorName,
      directCallResult: {
        success: false,
        error: revertInfo.error,
        revertData: revertInfo.revertData,
        errorName: revertInfo.errorName,
      },
    },
    firstCallTo: context?.firstCallTo,
  })
}

export function extractExecutionFailedInnerSelector(revertData?: Hex): string | null {
  if (!revertData || !revertData.startsWith('0x2c4029e9')) return null
  try {
    const decoded = decodeErrorResult({
      abi: [
        {
          type: 'error',
          name: 'ExecutionFailed',
          inputs: [
            { name: 'commandIndex', type: 'uint256' },
            { name: 'message', type: 'bytes' },
          ],
        },
      ],
      data: revertData,
    })
    const inner = decoded.args?.[1]
    if (typeof inner === 'string' && inner.startsWith('0x') && inner.length >= 10) {
      return inner.slice(0, 10).toLowerCase()
    }
  } catch {
    // Fall through — some RPC simulators return partially encoded nested reverts.
  }
  const lower = revertData.toLowerCase()
  for (const selector of ['0x486aa621', '0x8199f5f3', '0xb0669cbc', '0x3b99b53d']) {
    if (lower.includes(selector.slice(2))) return selector
  }
  return null
}

export function buildPreflightSimulationRejectionError(params: {
  simResult: {
    success?: boolean
    error?: string
    revertData?: Hex
    errorName?: string
    directCallResult?: { success?: boolean; error?: string; revertData?: Hex; errorName?: string }
  }
  firstCallTo?: string
}): Error {
  const direct = params.simResult.directCallResult
  const errorName = direct?.errorName ?? params.simResult.errorName
  const revertData = (direct?.revertData ?? params.simResult.revertData)?.toLowerCase()
  const callTo = String(params.firstCallTo ?? '').toLowerCase()

  const directRevert = (direct?.revertData ?? params.simResult.revertData)?.toLowerCase()
  if (directRevert?.startsWith('0x3b99b53d')) {
    return new PreflightSimulationRejectionError(
      'Swap route data from Zora is malformed or stale. Refresh the quote and try again.',
    )
  }

  const innerSelector = extractExecutionFailedInnerSelector(direct?.revertData ?? params.simResult.revertData)
  if (innerSelector === '0xb0669cbc') {
    return new PreflightSimulationRejectionError(
      'Permit2 rejected the smart-wallet signature. Refresh the quote, sign again when prompted, then retry the swap.',
    )
  }

  const detail = direct?.error ?? params.simResult.error ?? 'Underlying call would revert'
  const detailLc = String(detail).toLowerCase()
  const slippageInnerSelectors = new Set(['0x486aa621', '0x8199f5f3'])
  const likelySlippageFailure =
    (innerSelector != null && slippageInnerSelectors.has(innerSelector)) ||
    detailLc.includes('slippage') ||
    detailLc.includes('too little') ||
    detailLc.includes('toolittle') ||
    detailLc.includes('minimum output') ||
    detailLc.includes('minout') ||
    detailLc.includes('stf')

  if (likelySlippageFailure) {
    return new PreflightSimulationRejectionError(
      'Slippage tolerance is too tight for this pool. Auto mode will retry with higher slippage; you can also raise slippage manually and refresh the quote.',
    )
  }

  if (
    errorName === 'ExecutionFailed(uint256,bytes)' ||
    revertData?.startsWith('0x2c4029e9') ||
    callTo === ZORA_UNIVERSAL_ROUTER_BASE
  ) {
    return new PreflightSimulationRejectionError(ZORA_SWAP_SIMULATION_FAILED_MESSAGE)
  }
  if (detailLc.includes('transfer_from_failed')) {
    return new PreflightSimulationRejectionError(
      'Permit2 approval is missing for this smart-wallet swap. Refresh the quote, sign the Permit2 prompt when asked, then retry.',
    )
  }
  return new PreflightSimulationRejectionError(
    `This transaction would revert on your smart wallet (${detail}). Refresh and try again.`,
  )
}

export function isPaymasterAuthPolicyError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    lc.includes('request denied - no_session') ||
    lc.includes('request denied - not authenticated') ||
    lc.includes('not authenticated') ||
    lc.includes('session expired')
  )
}

export function isPaymasterRoutingPolicyError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return lc.includes('unsupported chainid') || lc.includes('unsupported entrypoint')
}

export function formatMetaMessages(error: unknown): string | null {
  const meta = (error as any)?.metaMessages
  if (!Array.isArray(meta) || meta.length === 0) return null
  const messages = meta
    .map((m) => {
      if (typeof m === 'string') return m
      try {
        return JSON.stringify(m)
      } catch {
        return ''
      }
    })
    .map((m) => String(m).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (messages.length === 0) return null
  const limited = messages.slice(0, 3)
  return limited.join(' | ') + (messages.length > limited.length ? ' | ...' : '')
}

export function isExpectedUserOpTimeoutError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error).toLowerCase()
  if (!msg) return false
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('request took too long') ||
    msg.includes('gateway timeout')
  )
}
