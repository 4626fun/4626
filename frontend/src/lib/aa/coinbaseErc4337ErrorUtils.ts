import type { Hex } from 'viem'

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
  '0xb4f54111': 'DeployFailed()',
}

export function classifyUserOpErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('aa23')) return 'aa23_validation'
  if (lower.includes('signtypeddata') && lower.includes('timed out')) return 'typed_data_timeout'
  if (lower.includes('paymaster')) return 'paymaster_error'
  if (lower.includes('insufficient funds')) return 'insufficient_funds'
  if (lower.includes('timeout')) return 'timeout'
  return 'unknown'
}

export function extractRevertInfo(e: unknown): { error: string; revertData?: Hex; errorName?: string } {
  const errAny = e as any
  const msg = e instanceof Error ? e.message : String(e ?? '')
  const result: { error: string; revertData?: Hex; errorName?: string } = { error: msg }

  // Extract revert data from various error structures.
  const revertData = errAny?.cause?.cause?.data ?? errAny?.cause?.data ?? errAny?.data
  if (revertData && typeof revertData === 'string' && revertData.startsWith('0x')) {
    result.revertData = revertData as Hex
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
    lc.includes('cdp paymaster endpoint is not configured') ||
    lc.includes('server misconfigured') ||
    lc.includes('upstream request failed') ||
    lc.includes('method not allowed')
  )
}

export function isPaymasterPolicyError(error: unknown): boolean {
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
