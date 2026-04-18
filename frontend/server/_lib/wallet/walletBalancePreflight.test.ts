import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_GAS_BUFFER_WEI,
  buildInsufficientFundsRefusal,
  checkWalletBalancePreflight,
  isInsufficientFundsError,
} from './walletBalancePreflight.js'

const WALLET = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const

function makeClient(balanceWei: bigint | Error) {
  return {
    getBalance: vi.fn(async () => {
      if (balanceWei instanceof Error) throw balanceWei
      return balanceWei
    }),
  }
}

describe('checkWalletBalancePreflight', () => {
  it('returns sufficient=true when balance >= value + gas buffer', async () => {
    const value = 1_000_000_000_000_000n // 0.001 ETH
    const client = makeClient(value + DEFAULT_GAS_BUFFER_WEI + 1n)

    const result = await checkWalletBalancePreflight({
      publicClient: client,
      wallet: WALLET,
      valueWei: value,
    })

    expect(result.sufficient).toBe(true)
    if (result.sufficient === true) {
      expect(result.requiredWei).toBe(value + DEFAULT_GAS_BUFFER_WEI)
    }
    expect(client.getBalance).toHaveBeenCalledWith({ address: WALLET, blockTag: 'latest' })
  })

  it('returns sufficient=false with friendly message when balance < required', async () => {
    const value = 1_000_000_000_000_000n
    const client = makeClient(0n)

    const result = await checkWalletBalancePreflight({
      publicClient: client,
      wallet: WALLET,
      valueWei: value,
    })

    expect(result.sufficient).toBe(false)
    if (result.sufficient === false) {
      expect(result.reason).toBe('insufficient_funds')
      expect(result.balanceWei).toBe(0n)
      expect(result.requiredWei).toBe(value + DEFAULT_GAS_BUFFER_WEI)
      expect(result.message).toContain("can't be executed")
      expect(result.message).toContain('needs funding')
    }
  })

  it('treats value=0 correctly (ERC-20 / deploy path, gas only)', async () => {
    const client = makeClient(DEFAULT_GAS_BUFFER_WEI - 1n)

    const result = await checkWalletBalancePreflight({
      publicClient: client,
      wallet: WALLET,
      valueWei: 0n,
    })

    expect(result.sufficient).toBe(false)
    if (result.sufficient === false) {
      expect(result.requiredWei).toBe(DEFAULT_GAS_BUFFER_WEI)
    }
  })

  it('fail-open: returns sufficient=null when balance lookup throws', async () => {
    const client = makeClient(new Error('rpc timeout'))

    const result = await checkWalletBalancePreflight({
      publicClient: client,
      wallet: WALLET,
      valueWei: 1n,
    })

    expect(result.sufficient).toBeNull()
    if (result.sufficient === null) {
      expect(result.reason).toBe('balance_lookup_failed')
    }
  })

  it('respects a custom gasBufferWei override', async () => {
    const customBuffer = 123n
    const client = makeClient(customBuffer)

    const result = await checkWalletBalancePreflight({
      publicClient: client,
      wallet: WALLET,
      valueWei: 0n,
      gasBufferWei: customBuffer,
    })

    expect(result.sufficient).toBe(true)
  })
})

describe('isInsufficientFundsError', () => {
  it('matches the exact Privy 400 error payload seen in production', () => {
    const raw = {
      message:
        'privy_http_400: {"error":"The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account. Details: insufficient funds for gas * price + value: have 0 want 1244"}',
    }
    expect(isInsufficientFundsError(raw)).toBe(true)
  })

  it('matches the insufficient-funds-for-gas substring', () => {
    const err = new Error('insufficient funds for gas * price + value: have 0 want 500')
    expect(isInsufficientFundsError(err)).toBe(true)
  })

  it('matches the exceeds-the-balance substring', () => {
    const err = new Error('execution failed: exceeds the balance of the account')
    expect(isInsufficientFundsError(err)).toBe(true)
  })

  it('is case-insensitive', () => {
    const err = new Error('INSUFFICIENT FUNDS FOR GAS')
    expect(isInsufficientFundsError(err)).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isInsufficientFundsError(new Error('nonce too low'))).toBe(false)
    expect(isInsufficientFundsError(new Error('rate limited'))).toBe(false)
    expect(isInsufficientFundsError(null)).toBe(false)
    expect(isInsufficientFundsError(undefined)).toBe(false)
    expect(isInsufficientFundsError('')).toBe(false)
  })

  it('digs into nested error/cause/message fields', () => {
    const nested = { error: { message: 'insufficient funds for gas * price + value' } }
    expect(isInsufficientFundsError(nested)).toBe(true)
  })
})

describe('buildInsufficientFundsRefusal', () => {
  it('returns a user-safe refusal that never leaks raw wei values', () => {
    const msg = buildInsufficientFundsRefusal({
      balanceWei: 0n,
      requiredWei: 1_000_000_000_000_000_000n,
    })
    expect(msg).not.toContain('wei')
    expect(msg).not.toContain('0x')
    expect(msg).not.toContain('1000000000000000000')
    expect(msg).toContain("can't be executed")
    expect(msg).toContain('needs funding')
  })
})
