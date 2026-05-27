import { describe, expect, it } from 'vitest'

import { normalizeUniswapError } from './error'

describe('normalizeUniswapError', () => {
  it('maps insufficient funds for gas', () => {
    expect(normalizeUniswapError('insufficient funds for gas').code).toBe('INSUFFICIENT_GAS')
  })

  it('maps insufficient token balance', () => {
    expect(normalizeUniswapError('insufficient token balance').code).toBe('INSUFFICIENT_FUNDS')
  })

  it('maps approval', () => {
    expect(normalizeUniswapError('approval required').code).toBe('APPROVAL_REQUIRED')
  })

  it('maps transfer_from_failed simulation errors', () => {
    const normalized = normalizeUniswapError(
      'Failed to fetch gas fee and/or simulate transaction: FAILED_TO_ESTIMATE_GAS: TRANSFER_FROM_FAILED',
    )
    expect(normalized.code).toBe('INSUFFICIENT_FUNDS')
    expect(normalized.message).toContain('wrap')
  })

  it('maps missing 4626 session token during canonical submit', () => {
    const normalized = normalizeUniswapError('Missing 4626 session token for paymaster request.')
    expect(normalized.code).toBe('AUTH_REQUIRED')
    expect(normalized.message).toContain('sign in again')
  })

  it('maps paymaster unauthenticated errors', () => {
    const normalized = normalizeUniswapError('request denied - not authenticated')
    expect(normalized.code).toBe('AUTH_REQUIRED')
    expect(normalized.message.toLowerCase()).toContain('restore your 4626 session')
  })

  it('maps canonical ownership mismatch errors', () => {
    const normalized = normalizeUniswapError('not_owner: session principal does not own sender CSW')
    expect(normalized.code).toBe('AUTH_REQUIRED')
    expect(normalized.message).toContain('session does not match')
  })

  it('maps Uniswap transaction value schema validation errors', () => {
    const normalized = normalizeUniswapError(
      'RequestValidationError: "value" does not match any of the allowed types',
    )
    expect(normalized.message).toContain('invalid transaction payload from the router')
    expect(normalized.retryable).toBe(true)
  })

  it('falls back safely', () => {
    const normalized = normalizeUniswapError('weird edge case')
    expect(normalized.code).toBe('UNKNOWN')
    expect(normalized.message).toContain('weird edge case')
  })
})
