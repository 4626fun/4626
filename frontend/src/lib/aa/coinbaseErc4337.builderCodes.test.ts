import { describe, expect, it } from 'vitest'
import type { Address, Hex } from 'viem'

import { resolveDataSuffix, payloadEndsWithDataSuffix } from '../baseBuilderCodes'
import { applyBuilderDataSuffixToCalls } from './coinbaseErc4337'

describe('applyBuilderDataSuffixToCalls', () => {
  const target = '0x0000000000000000000000000000000000000001' as Address
  const calls = [{ to: target, value: 0n, data: '0x123456' as Hex }]
  const dataSuffix = resolveDataSuffix({
    VITE_BASE_BUILDER_CODES: 'bc_b7k3p9da',
    DEV: false,
    PROD: false,
  })

  it('appends suffix for Base mainnet userOp calls', () => {
    expect(dataSuffix).toBeDefined()
    const result = applyBuilderDataSuffixToCalls(calls, 8453, dataSuffix)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(true)
  })

  it('appends suffix for Base Sepolia userOp calls', () => {
    expect(dataSuffix).toBeDefined()
    const result = applyBuilderDataSuffixToCalls(calls, 84532, dataSuffix)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(true)
  })

  it('does not append suffix for non-Base chains', () => {
    const result = applyBuilderDataSuffixToCalls(calls, 1, dataSuffix)
    expect(result).toEqual(calls)
  })

  it('keeps outbound userOp call payload attribution idempotent', () => {
    expect(dataSuffix).toBeDefined()
    const once = applyBuilderDataSuffixToCalls(calls, 8453, dataSuffix)
    const twice = applyBuilderDataSuffixToCalls(once, 8453, dataSuffix)
    expect(payloadEndsWithDataSuffix(once[0].data as Hex, dataSuffix as Hex)).toBe(true)
    expect(payloadEndsWithDataSuffix(twice[0].data as Hex, dataSuffix as Hex)).toBe(true)
    expect(twice[0].data).toBe(once[0].data)
  })

  it('preserves canonical Universal Router execute calldata without suffix mutation', () => {
    expect(dataSuffix).toBeDefined()
    const universalRouterCall = [{ to: target, value: 0n, data: '0x3593564c11223344' as Hex }]
    const result = applyBuilderDataSuffixToCalls(universalRouterCall, 8453, dataSuffix)
    expect(result[0].data).toBe(universalRouterCall[0].data)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(false)
  })
})
