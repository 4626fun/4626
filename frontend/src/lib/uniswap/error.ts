export type UniswapErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'APPROVAL_REQUIRED'
  | 'QUOTE_EXPIRED'
  | 'CHAIN_MISMATCH'
  | 'SLIPPAGE_EXCEEDED'
  | 'RATE_LIMITED'
  | 'UNKNOWN'

export type NormalizedUniswapError = {
  code: UniswapErrorCode
  message: string
  retryable: boolean
}

const FALLBACK: NormalizedUniswapError = {
  code: 'UNKNOWN',
  message: 'Something went wrong while talking to Uniswap. Please try again.',
  retryable: true,
}

export function normalizeUniswapError(input: unknown): NormalizedUniswapError {
  const raw = typeof input === 'string'
    ? input
    : (input && typeof input === 'object' && 'message' in input && typeof (input as any).message === 'string')
      ? String((input as any).message)
      : ''
  const msg = raw.toLowerCase()

  if (!msg.trim()) return FALLBACK
  if (msg.includes('insufficient') || msg.includes('not enough balance')) {
    return { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance for this action.', retryable: false }
  }
  if (msg.includes('approval') || msg.includes('allowance')) {
    return { code: 'APPROVAL_REQUIRED', message: 'Approval is required before continuing.', retryable: true }
  }
  if (msg.includes('expired') || msg.includes('stale quote')) {
    return { code: 'QUOTE_EXPIRED', message: 'Quote expired. Refresh and try again.', retryable: true }
  }
  if (msg.includes('chain') && msg.includes('mismatch')) {
    return { code: 'CHAIN_MISMATCH', message: 'Wrong network selected. Please switch chain.', retryable: true }
  }
  if (msg.includes('slippage')) {
    return { code: 'SLIPPAGE_EXCEEDED', message: 'Price moved beyond slippage tolerance.', retryable: true }
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.', retryable: true }
  }

  return { ...FALLBACK, message: raw.slice(0, 220) }
}
