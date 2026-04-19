import { describe, expect, it } from 'vitest'

import {
  CoinbaseSmartWalletHelperError,
  isCoinbaseSmartWalletHelperError,
  isRetryableInfraError,
  wrapUnknownHelperError,
} from './privyCoinbaseSmartWallet'

describe('CoinbaseSmartWalletHelperError', () => {
  it('uses the code as message when no message option is provided', () => {
    const err = new CoinbaseSmartWalletHelperError('userop_submission_failed', false)

    expect(err.code).toBe('userop_submission_failed')
    expect(err.message).toBe('userop_submission_failed')
    expect(err.retryable).toBe(false)
    expect(err.causeMessage).toBeUndefined()
  })

  it('accepts a plain string as the third argument for backwards compatibility', () => {
    // privyXmtpSigner.ts still constructs with (code, retryable, message: string).
    const err = new CoinbaseSmartWalletHelperError('xmtp_sign_failed', false, 'could not sign')

    expect(err.code).toBe('xmtp_sign_failed')
    expect(err.message).toBe('could not sign')
    expect(err.causeMessage).toBeUndefined()
  })

  it('preserves causeMessage and cause when the options form is used', () => {
    const underlying = new Error('internal error - error communicating with paymaster')
    ;(underlying as unknown as { code?: number }).code = -32000

    const err = new CoinbaseSmartWalletHelperError('userop_submission_failed', true, {
      causeMessage: underlying.message,
      cause: underlying,
    })

    expect(err.code).toBe('userop_submission_failed')
    // Stable short code is kept as the public `message` so callers match on it.
    expect(err.message).toBe('userop_submission_failed')
    expect(err.causeMessage).toBe('internal error - error communicating with paymaster')
    expect((err as unknown as { cause?: unknown }).cause).toBe(underlying)
  })
})

describe('isCoinbaseSmartWalletHelperError', () => {
  it('recognises real instances', () => {
    const err = new CoinbaseSmartWalletHelperError('code_x', false)
    expect(isCoinbaseSmartWalletHelperError(err)).toBe(true)
  })

  it('recognises duck-typed errors that cross module boundaries', () => {
    const duck = { code: 'code_x', retryable: true, message: 'code_x' }
    expect(isCoinbaseSmartWalletHelperError(duck)).toBe(true)
  })

  it('rejects plain errors and non-objects', () => {
    expect(isCoinbaseSmartWalletHelperError(new Error('boom'))).toBe(false)
    expect(isCoinbaseSmartWalletHelperError(null)).toBe(false)
    expect(isCoinbaseSmartWalletHelperError('nope')).toBe(false)
  })
})

describe('isRetryableInfraError', () => {
  it('classifies paymaster backend errors as retryable', () => {
    const err = new Error(
      'pm_getPaymasterStubData failed: internal error - error communicating with paymaster',
    )
    expect(isRetryableInfraError(err)).toBe(true)
  })

  it('classifies messages mentioning -32000 as retryable', () => {
    expect(isRetryableInfraError(new Error('JSON-RPC error -32000: internal error'))).toBe(true)
  })

  it('classifies messages mentioning -32603 as retryable', () => {
    expect(isRetryableInfraError(new Error('JSON-RPC -32603 internal error'))).toBe(true)
  })

  it('classifies structured JSON-RPC code -32000 on the error object as retryable', () => {
    // viem/ox attach `.code` directly on the thrown RpcRequestError. The text
    // may not contain the code, so we must also look at structured fields.
    const rpcErr: Error & { code?: number } = new Error('paymaster request failed')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(true)
  })

  it('walks the .cause chain for a structured code', () => {
    const inner: Error & { code?: number } = new Error('upstream')
    inner.code = -32603
    const outer = new Error('wrapper')
    ;(outer as unknown as { cause?: unknown }).cause = inner

    expect(isRetryableInfraError(outer)).toBe(true)
  })

  it('treats deterministic UserOp validation errors (AA24 signature) as non-retryable', () => {
    // AA24 is the ERC-4337 validation signature-error code; must not retry.
    const err = new Error('UserOperation reverted during simulation with reason: AA24 signature error')
    expect(isRetryableInfraError(err)).toBe(false)
  })

  it('treats an unrelated deterministic revert as non-retryable', () => {
    expect(isRetryableInfraError(new Error('execution reverted: insufficient balance'))).toBe(false)
  })

  it('still retries classic transient signals (timeout, 502, rate limit)', () => {
    expect(isRetryableInfraError(new Error('request timeout'))).toBe(true)
    expect(isRetryableInfraError(new Error('bad gateway 502'))).toBe(true)
    expect(isRetryableInfraError(new Error('rate limit exceeded'))).toBe(true)
  })
})

describe('wrapUnknownHelperError', () => {
  it('returns existing helper errors untouched', () => {
    const existing = new CoinbaseSmartWalletHelperError('userop_submission_failed', true, {
      causeMessage: 'already wrapped',
    })

    const wrapped = wrapUnknownHelperError('userop_submission_failed', existing)
    expect(wrapped).toBe(existing)
  })

  it('preserves the underlying message on causeMessage and keeps code as public message', () => {
    const underlying = new Error('internal error - error communicating with paymaster')
    const wrapped = wrapUnknownHelperError('userop_submission_failed', underlying)

    expect(wrapped.code).toBe('userop_submission_failed')
    expect(wrapped.message).toBe('userop_submission_failed')
    expect(wrapped.causeMessage).toBe('internal error - error communicating with paymaster')
    expect((wrapped as unknown as { cause?: unknown }).cause).toBe(underlying)
  })

  it('marks paymaster-internal-error failures as retryable', () => {
    const underlying = new Error('internal error - error communicating with paymaster')
    const wrapped = wrapUnknownHelperError('userop_submission_failed', underlying)

    expect(wrapped.retryable).toBe(true)
  })

  it('marks deterministic validation errors (AA24) as non-retryable', () => {
    const underlying = new Error('AA24 signature error')
    const wrapped = wrapUnknownHelperError('userop_submission_failed', underlying)

    expect(wrapped.retryable).toBe(false)
    expect(wrapped.causeMessage).toBe('AA24 signature error')
  })

  it('marks structured -32000 RPC errors as retryable', () => {
    const underlying: Error & { code?: number } = new Error('paymaster request failed')
    underlying.code = -32000
    const wrapped = wrapUnknownHelperError('userop_submission_failed', underlying)

    expect(wrapped.retryable).toBe(true)
    expect(wrapped.causeMessage).toBe('paymaster request failed')
  })
})
