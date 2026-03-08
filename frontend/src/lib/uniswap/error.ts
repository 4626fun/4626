export type UniswapErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_GAS'
  | 'AUTH_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'QUOTE_EXPIRED'
  | 'CHAIN_MISMATCH'
  | 'SLIPPAGE_EXCEEDED'
  | 'RATE_LIMITED'
  | 'WALLET_REJECTED'
  | 'NONCE_CONFLICT'
  | 'NETWORK_TIMEOUT'
  | 'UNKNOWN'

export type NormalizedUniswapError = {
  code: UniswapErrorCode
  message: string
  retryable: boolean
}

const FALLBACK: NormalizedUniswapError = {
  code: 'UNKNOWN',
  message: 'Something went wrong. Check your balance and try again.',
  retryable: true,
}

export function normalizeUniswapError(input: unknown): NormalizedUniswapError {
  const raw = typeof input === 'string'
    ? input
    : (input && typeof input === 'object' && 'message' in input && typeof (input as Record<string, unknown>).message === 'string')
      ? String((input as Record<string, unknown>).message)
      : ''
  const msg = raw.toLowerCase()

  if (!msg.trim()) return FALLBACK

  // Gas / ETH balance
  if (msg.includes('insufficient funds for gas') || msg.includes('not enough eth') || msg.includes('out of gas')) {
    return {
      code: 'INSUFFICIENT_GAS',
      message: 'Not enough ETH for gas. Add ETH to your wallet to continue.',
      retryable: false,
    }
  }

  // Token balance
  if (msg.includes('insufficient') || msg.includes('not enough balance') || msg.includes('exceeds balance')) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient token balance. Reduce the amount or add more tokens.',
      retryable: false,
    }
  }

  // Approval / allowance
  if (msg.includes('approval') || msg.includes('allowance')) {
    return {
      code: 'APPROVAL_REQUIRED',
      message: 'Token approval needed. Click Approve to continue.',
      retryable: true,
    }
  }

  // Restored app session / paymaster auth
  if (
    msg.includes('missing 4626 session token') ||
    msg.includes('request denied - not authenticated') ||
    msg.includes('not authenticated') ||
    msg.includes('session principal does not own sender csw') ||
    msg.includes('not_owner')
  ) {
    const mismatch =
      msg.includes('session principal does not own sender csw') || msg.includes('not_owner')
    return {
      code: 'AUTH_REQUIRED',
      message: mismatch
        ? 'Your restored 4626 session does not match the canonical swap wallet. Restore your account connection and try again.'
        : 'Your 4626 session expired. Restore your 4626 session and sign in again before submitting the swap.',
      retryable: true,
    }
  }

  // Quote expired
  if (msg.includes('expired') || msg.includes('stale quote') || msg.includes('deadline')) {
    return {
      code: 'QUOTE_EXPIRED',
      message: 'Quote expired — prices may have changed. Refresh and try again.',
      retryable: true,
    }
  }

  // Wrong chain
  if ((msg.includes('chain') && msg.includes('mismatch')) || msg.includes('wrong network') || msg.includes('chainid')) {
    return {
      code: 'CHAIN_MISMATCH',
      message: 'Wrong network. Switch to Base to continue.',
      retryable: true,
    }
  }

  // Slippage
  if (msg.includes('slippage') || msg.includes('price impact')) {
    return {
      code: 'SLIPPAGE_EXCEEDED',
      message: 'Price moved beyond slippage tolerance. Try increasing slippage or reducing the amount.',
      retryable: true,
    }
  }

  // Rate limit
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Wait a moment and try again.',
      retryable: true,
    }
  }

  // User rejected
  if (
    msg.includes('rejected') ||
    msg.includes('user denied') ||
    msg.includes('action_rejected') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled')
  ) {
    return {
      code: 'WALLET_REJECTED',
      message: 'Transaction cancelled.',
      retryable: true,
    }
  }

  // Nonce
  if (msg.includes('nonce too low') || msg.includes('replacement transaction underpriced') || msg.includes('nonce conflict')) {
    return {
      code: 'NONCE_CONFLICT',
      message: 'Transaction conflict. Wait a few seconds and try again.',
      retryable: true,
    }
  }

  // Network / timeout
  if (
    msg.includes('timeout') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch error')
  ) {
    return {
      code: 'NETWORK_TIMEOUT',
      message: 'Network error. Check your connection and try again.',
      retryable: true,
    }
  }

  // Generic contract revert — strip hex noise
  if (msg.includes('reverted') || msg.includes('execution reverted')) {
    return {
      code: 'UNKNOWN',
      message: 'Transaction failed. Check your balance and try again.',
      retryable: true,
    }
  }

  return { ...FALLBACK, message: raw.slice(0, 220) }
}
