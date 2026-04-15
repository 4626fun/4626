import { describe, expect, it } from 'vitest'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'

import { appendDataSuffixToHex, resolveDataSuffix, payloadEndsWithDataSuffix } from '@/lib/base/baseBuilderCodes'
import { applyBuilderDataSuffixToCalls } from './coinbaseErc4337BuilderSuffix'

describe('applyBuilderDataSuffixToCalls', () => {
  const target = '0x0000000000000000000000000000000000000001' as Address
  const calls = [{ to: target, value: 0n, data: '0x123456' as Hex }]
  const dataSuffix = resolveDataSuffix({
    VITE_BASE_BUILDER_CODES: 'bc_b7k3p9da',
    DEV: false,
    PROD: false,
  })
  const universalRouterExecuteAbi = [
    {
      type: 'function',
      name: 'execute',
      stateMutability: 'payable',
      inputs: [
        { name: 'commands', type: 'bytes' },
        { name: 'inputs', type: 'bytes[]' },
        { name: 'deadline', type: 'uint256' },
      ],
      outputs: [],
    },
  ] as const

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
    const universalRouterTarget = '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address
    const universalRouterCall = [{ to: universalRouterTarget, value: 0n, data: '0x3593564c11223344' as Hex }]
    const result = applyBuilderDataSuffixToCalls(universalRouterCall, 8453, dataSuffix)
    expect(result[0].data).toBe(universalRouterCall[0].data)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(false)
  })

  it('strips existing suffix from canonical Universal Router execute calldata', () => {
    expect(dataSuffix).toBeDefined()
    const universalRouterTarget = '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address
    const baseData = '0x3593564c11223344' as Hex
    const alreadySuffixed = appendDataSuffixToHex(baseData, dataSuffix as Hex)
    const universalRouterCall = [{ to: universalRouterTarget, value: 0n, data: alreadySuffixed }]
    const result = applyBuilderDataSuffixToCalls(universalRouterCall, 8453, dataSuffix)
    expect(result[0].data).toBe(baseData)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(false)
  })

  it('never appends suffix to Universal Router non-canonical calldata', () => {
    expect(dataSuffix).toBeDefined()
    const universalRouterTarget = '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address
    const nonCanonicalData = '0x12345678deadbeef' as Hex
    const universalRouterCall = [{ to: universalRouterTarget, value: 0n, data: nonCanonicalData }]
    const result = applyBuilderDataSuffixToCalls(universalRouterCall, 8453, dataSuffix)
    expect(result[0].data).toBe(nonCanonicalData)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(false)
  })

  it('returns canonicalized Universal Router execute calldata when input has trailing bytes', () => {
    expect(dataSuffix).toBeDefined()
    const universalRouterTarget = '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address
    const canonicalData = encodeFunctionData({
      abi: universalRouterExecuteAbi,
      functionName: 'execute',
      args: ['0x00', ['0x1234'], 123n],
    }) as Hex
    const trailingByteVariant = `${canonicalData}00` as Hex
    const universalRouterCall = [{ to: universalRouterTarget, value: 0n, data: trailingByteVariant }]
    const result = applyBuilderDataSuffixToCalls(universalRouterCall, 8453, dataSuffix)
    expect(result[0].data).toBe(canonicalData)
    expect(payloadEndsWithDataSuffix(result[0].data as Hex, dataSuffix as Hex)).toBe(false)
  })
})
