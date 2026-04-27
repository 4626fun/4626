// SPDX-License-Identifier: MIT
//
// Typed error classes for the AMOE lottery flow.
//
// Why these exist:
//   `_amoeSubmit.ts` (and other AMOE handlers) classify failures into HTTP
//   status codes (402 / 400 / 500) by `messageText.includes('insufficient')`
//   etc. Substring matching against `Error.message` is fragile — renaming a
//   message string from `'message_expired'` to `'amoe_message_expired'` would
//   silently turn a 400 into a 500 with no test coverage to catch the
//   regression.
//
//   These typed errors let handlers pivot on `instanceof` instead. Each
//   class still carries a stable `message` string so existing string-based
//   classifiers in older callers keep working during the deprecation window.
//
// Compatibility note:
//   We intentionally preserve every existing message string (`invalid_*`,
//   `*_mismatch`, `message_expired`, `message_expires_too_soon`,
//   `insufficient_amoe_credits`, `signature_invalid`, etc.) so callers that
//   still substring-check on `error.message` are unaffected. New callers
//   should pivot on `instanceof AmoeBadRequestError` / etc. instead.

/**
 * Bad-request class. Maps to HTTP 400.
 * Used for: malformed input, mismatched fields, expired challenges,
 *           invalid signatures, replay attempts.
 */
export class AmoeBadRequestError extends Error {
  readonly kind = 'amoe_bad_request' as const
  constructor(message: string) {
    super(message)
    this.name = 'AmoeBadRequestError'
  }
}

/**
 * Insufficient-credits class. Maps to HTTP 402 (Payment Required).
 * Used when the wallet doesn't have enough credits to spend an entry.
 */
export class AmoeInsufficientCreditsError extends Error {
  readonly kind = 'amoe_insufficient_credits' as const
  constructor(message: string = 'insufficient_amoe_credits') {
    super(message)
    this.name = 'AmoeInsufficientCreditsError'
  }
}

/**
 * Authority-mismatch class. Maps to HTTP 403.
 * Used when the authenticated session does not have authority over the
 * wallet it's trying to act on (e.g. submitting on behalf of a different
 * wallet than the auth identity controls).
 */
export class AmoeAuthorityError extends Error {
  readonly kind = 'amoe_authority' as const
  constructor(message: string = 'wallet_authority_mismatch') {
    super(message)
    this.name = 'AmoeAuthorityError'
  }
}

/**
 * Server-side / config / upstream class. Maps to HTTP 500 or 503.
 * Used for missing relay key, RPC failures, downstream contract reads.
 */
export class AmoeServerError extends Error {
  readonly kind = 'amoe_server' as const
  constructor(message: string) {
    super(message)
    this.name = 'AmoeServerError'
  }
}

/**
 * HTTP status mapping for typed AMOE errors. Falls back to substring
 * matching for legacy `Error.message` values so callers can switch
 * incrementally.
 */
export function classifyAmoeError(err: unknown): {
  status: number
  message: string
} {
  if (err instanceof AmoeInsufficientCreditsError) {
    return { status: 402, message: err.message }
  }
  if (err instanceof AmoeAuthorityError) {
    return { status: 403, message: err.message }
  }
  if (err instanceof AmoeBadRequestError) {
    return { status: 400, message: err.message }
  }
  if (err instanceof AmoeServerError) {
    return { status: 500, message: err.message }
  }
  // Legacy string-based classification (kept for any thrower we haven't
  // migrated yet; remove once all sites use the typed classes above).
  const messageText = err instanceof Error ? err.message : 'amoe_submit_failed'
  if (messageText.includes('insufficient')) {
    return { status: 402, message: messageText }
  }
  if (
    messageText.includes('invalid') ||
    messageText.includes('mismatch') ||
    messageText.includes('expired') ||
    messageText.includes('expires_too_soon')
  ) {
    return { status: 400, message: messageText }
  }
  return { status: 500, message: messageText }
}
