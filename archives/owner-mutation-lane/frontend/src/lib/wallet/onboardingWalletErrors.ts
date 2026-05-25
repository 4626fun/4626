export type OwnerApprovalErrorCode =
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

export type ClassifiedOwnerApprovalError = {
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

export function messageHasOwnerApprovalDebugTag(message: string, token: string): boolean {
  const debugDetails = extractOwnerApprovalDebugTag(message)
  if (!debugDetails) return false
  return debugDetails.toLowerCase().includes(token.toLowerCase())
}

export function classifyOwnerApprovalError(error: unknown): ClassifiedOwnerApprovalError {
  const message = error instanceof Error ? String(error.message || '').trim() : String(error ?? '').trim()
  const lower = message.toLowerCase()
  if (!lower) return { message, lower, code: 'unknown' }
  if (lower.includes('aa23') || (lower.includes('validateuserop') && lower.includes('revert'))) {
    return { message, lower, code: 'aa23_validation' }
  }
  if (
    lower.includes('failed to estimate gas for user operation') &&
    lower.includes('useroperation reverted')
  ) {
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
      appendOwnerApprovalDebug(
        '4626 could not start the smart-wallet sponsor session. Sign in again and retry.',
        classified,
      ),
    )
  }
  if (classified.code === 'request_denied') {
    return new Error(
      appendOwnerApprovalDebug(
        '4626 sponsor session was rejected. Sign in again and retry the smart-wallet approval.',
        classified,
      ),
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

export function isRetryablePaymasterSessionError(error: unknown): boolean {
  const { lower, code } = classifyOwnerApprovalError(error)
  if (code === 'paymaster_internal') return true
  return (
    lower.includes('request denied - no_session') ||
    lower.includes('request denied - not authenticated')
  )
}
