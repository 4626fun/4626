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

  it('classifies structured JSON-RPC code -32000 on the error object as retryable', () => {
    // viem/ox attach `.code` directly on the thrown RpcRequestError. When the
    // bundler surfaces a bare infrastructure failure with no validation
    // signal in the message, the structured code alone is enough to retry.
    const rpcErr: Error & { code?: number } = new Error('paymaster request failed')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(true)
  })

  it('walks the .cause chain for a structured -32603 code', () => {
    const inner: Error & { code?: number } = new Error('upstream')
    inner.code = -32603
    const outer = new Error('wrapper')
    ;(outer as unknown as { cause?: unknown }).cause = inner

    expect(isRetryableInfraError(outer)).toBe(true)
  })

  // --- Deterministic validation failures must NEVER retry, even when
  // wrapped in a -32000 / -32603 envelope. This is the regression the
  // ChatGPT Codex bot flagged on PR #311: bundlers commonly surface AAxx
  // validation reverts inside a generic JSON-RPC internal error code,
  // and retrying them would reproduce the same failure and burn credits.

  it('treats AA24 signature error as non-retryable', () => {
    const err = new Error('UserOperation reverted during simulation with reason: AA24 signature error')
    expect(isRetryableInfraError(err)).toBe(false)
  })

  it('treats AA24 wrapped in a -32000 structured code as non-retryable', () => {
    // Real-world shape: bundler returns { code: -32000, message: "AA24 signature error" }.
    // The structured code alone would falsely suggest retry; the AAxx text guard must win.
    const rpcErr: Error & { code?: number } = new Error('AA24 signature error')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats AA24 wrapped in a -32603 structured code as non-retryable', () => {
    const rpcErr: Error & { code?: number } = new Error('AA24 signature error')
    rpcErr.code = -32603
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats AA25 invalid nonce wrapped in -32000 as non-retryable', () => {
    const rpcErr: Error & { code?: number } = new Error('AA25 invalid account nonce')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats execution reverted wrapped in -32000 as non-retryable', () => {
    // EXECUTION_REVERTED (-32521) sometimes gets normalized to -32000 by proxies.
    const rpcErr: Error & { code?: number } = new Error('execution reverted: insufficient balance')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats an unrelated deterministic revert (no structured code) as non-retryable', () => {
    expect(isRetryableInfraError(new Error('execution reverted: insufficient balance'))).toBe(false)
  })

  it('treats banned opcode as non-retryable even with -32000 code', () => {
    const rpcErr: Error & { code?: number } = new Error('banned opcode detected in factory')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats invalid signature wrapped in -32000 as non-retryable', () => {
    const rpcErr: Error & { code?: number } = new Error('invalid signature')
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  // --- True transient errors remain retryable even with ambiguous codes.

  it('retries paymaster backend text even when wrapped in -32000', () => {
    const rpcErr: Error & { code?: number } = new Error(
      'internal error - error communicating with paymaster',
    )
    rpcErr.code = -32000
    expect(isRetryableInfraError(rpcErr)).toBe(true)
  })

  it('still retries classic transient signals (timeout, 502, rate limit)', () => {
    expect(isRetryableInfraError(new Error('request timeout'))).toBe(true)
    expect(isRetryableInfraError(new Error('bad gateway 502'))).toBe(true)
    expect(isRetryableInfraError(new Error('rate limit exceeded'))).toBe(true)
  })

  // --- Deterministic CDP policy / EntryPoint rejections with their own
  // dedicated codes must stay non-retryable and NOT be caught by the
  // generic -32000/-32603 branch.

  it('treats -32602 INVALID_ARGUMENT as non-retryable', () => {
    const rpcErr: Error & { code?: number } = new Error('Invalid userOperation parameters')
    rpcErr.code = -32602
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats -32500 REJECTED_BY_EP_OR_ACCOUNT as non-retryable', () => {
    const rpcErr: Error & { code?: number } = new Error('rejected by EntryPoint or smart account')
    rpcErr.code = -32500
    expect(isRetryableInfraError(rpcErr)).toBe(false)
  })

  it('treats -32501 REJECTED_BY_PAYMASTER (policy) as non-retryable', () => {
    // Policy rejections (allowlist, spend limit) are deterministic — retrying
    // would just hit the same policy again and hide the real cause.
    const rpcErr: Error & { code?: number } = new Error('paymaster refused to sponsor')
    rpcErr.code = -32501
    expect(isRetryableInfraError(rpcErr)).toBe(false)
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
