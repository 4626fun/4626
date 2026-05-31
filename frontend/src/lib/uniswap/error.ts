import { ZORA_SWAP_SIMULATION_FAILED_MESSAGE } from '@/lib/swap/swapStatusCopy'

export type UniswapErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_GAS'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN_ORIGIN'
  | 'APPROVAL_REQUIRED'
  | 'QUOTE_EXPIRED'
  | 'CHAIN_MISMATCH'
  | 'SLIPPAGE_EXCEEDED'
  | 'RATE_LIMITED'
  | 'RPC_UNAVAILABLE'
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

import { isPreflightSimulationRejection } from '@/lib/aa/coinbaseErc4337ErrorUtils'

function collectSwapErrorText(input: unknown): string {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let cursor: unknown = input
  for (let depth = 0; depth < 8 && cursor != null && !seen.has(cursor); depth += 1) {
    seen.add(cursor)
    if (isPreflightSimulationRejection(cursor)) {
      parts.push(cursor.message)
      break
    }
    if (typeof cursor === 'string') {
      parts.push(cursor)
      break
    }
    if (cursor instanceof Error) {
      parts.push(cursor.message)
      const shortMessage = (cursor as Error & { shortMessage?: string }).shortMessage
      if (typeof shortMessage === 'string' && shortMessage.trim()) parts.push(shortMessage)
      cursor = (cursor as Error & { cause?: unknown }).cause
      continue
    }
    if (typeof cursor === 'object') {
      const record = cursor as Record<string, unknown>
      if (typeof record.message === 'string' && record.message.trim()) parts.push(record.message)
      if (typeof record.details === 'string' && record.details.trim()) parts.push(record.details)
      cursor = record.cause
      continue
    }
    break
  }
  return parts.join(' ')
}

export function normalizeUniswapError(input: unknown): NormalizedUniswapError {
  if (isPreflightSimulationRejection(input)) {
    return {
      code: 'APPROVAL_REQUIRED',
      message: input.message,
      retryable: true,
    }
  }

  const raw = collectSwapErrorText(input)
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

  // Swap proxy pull failed (often WETH transferFrom before deposit is simulated)
  if (
    msg.includes('transfer_from_failed') ||
    (msg.includes('failed_to_estimate_gas') && msg.includes('transfer_from'))
  ) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message:
        'The swap could not pull tokens from your smart wallet. For ETH sells, keep enough ETH to wrap in the same transaction, or reduce the amount and refresh the quote.',
      retryable: true,
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

  // CSW execute wrapper / Zora router leg reverted during simulation or gas estimate
  if (
    msg.includes('0x2c4029e9') ||
    msg.includes('executionfailed') ||
    msg.includes('zora swap would revert') ||
    msg.includes('swap route data from zora') ||
    msg.includes('0x3b99b53d') ||
    msg.includes('sliceoutofbounds') ||
    msg.includes('malformed or stale')
  ) {
    return {
      code: 'SLIPPAGE_EXCEEDED',
      message: ZORA_SWAP_SIMULATION_FAILED_MESSAGE,
      retryable: true,
    }
  }

  if (msg.includes('permit2 rejected') || msg.includes('0xb0669cbc') || msg.includes('invalidcontractsignature')) {
    return {
      code: 'APPROVAL_REQUIRED',
      message:
        'Permit2 rejected the smart-wallet signature. Refresh the quote, sign again when prompted, then retry.',
      retryable: true,
    }
  }

  if (
    msg.includes('swap simulation passed but the sponsored') ||
    msg.includes('bundler rejected') ||
    msg.includes('bundler could not simulate')
  ) {
    return {
      code: 'QUOTE_EXPIRED',
      message:
        'The swap looked valid locally but the sponsored transaction was rejected. Refresh the quote and try once more. If a prior swap is still confirming, wait ~30 seconds first.',
      retryable: true,
    }
  }

  if (
    msg.includes('swap is already pending') ||
    msg.includes('previous swap is still confirming') ||
    msg.includes('aa25') ||
    msg.includes('invalid account nonce')
  ) {
    return {
      code: 'NONCE_CONFLICT',
      message:
        'A swap is already pending on this smart wallet. Wait about 30 seconds for it to confirm, then try again once.',
      retryable: true,
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

  // Trusted-origin / cookie-session CSRF guard and forbidden request surfaces
  if (
    msg.includes('forbidden') ||
    msg.includes('trusted origin') ||
    msg.includes('origin or session policy')
  ) {
    return {
      code: 'FORBIDDEN_ORIGIN',
      message: 'Request blocked by origin/session policy. Refresh and sign in again on the app domain.',
      retryable: true,
    }
  }

  // Uniswap Trading API schema validation (often transaction `value` typed as number in JSON)
  if (msg.includes('does not match any of the allowed types') && msg.includes('value')) {
    return {
      code: 'UNKNOWN',
      message:
        'Swap build failed due to an invalid transaction payload from the router. Refresh the quote and try again.',
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

  // RPC proxy / upstream availability
  if (
    msg.includes('rpc_upstream') ||
    msg.includes('upstream rpc') ||
    msg.includes('rpc proxy') ||
    msg.includes('rpc request timeout') ||
    msg.includes('rpc unavailable')
  ) {
    return {
      code: 'RPC_UNAVAILABLE',
      message: 'RPC provider is temporarily unavailable. Retry in a few seconds.',
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

  // Generic contract revert — do not blame balance when the wallet already holds the sell token
  if (msg.includes('reverted') || msg.includes('execution reverted')) {
    return {
      code: 'QUOTE_EXPIRED',
      message:
        'The swap would revert on-chain (often a stale quote, Permit2 signature, or pool slippage). Refresh the quote and try again. Your USDC balance is not the blocker if it covers the amount shown.',
      retryable: true,
    }
  }

  return { ...FALLBACK, message: raw.slice(0, 220) }
}
