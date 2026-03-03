import { describe, expect, it } from 'vitest'
import type { Hex } from 'viem'

import {
  appendBuilderSuffixToHex,
  appendDataSuffixToHex,
  hasErc8021RepeatingMarker,
  payloadEndsWithDataSuffix,
  resolveBuilderCodes,
  resolveDataSuffix,
} from './baseBuilderCodes'

describe('baseBuilderCodes', () => {
  const envWithBuilderCode = {
    VITE_BASE_BUILDER_CODES: 'bc_b7k3p9da',
    DEV: false,
    PROD: false,
  }

  it('produces a non-empty ERC-8021 data suffix from builder code', () => {
    const suffix = resolveDataSuffix(envWithBuilderCode)
    expect(typeof suffix).toBe('string')
    expect(Boolean(suffix && /^0x[0-9a-fA-F]+$/.test(suffix))).toBe(true)
    expect((suffix ?? '').length).toBeGreaterThan(2)
    expect(hasErc8021RepeatingMarker(suffix as Hex)).toBe(true)
  })

  it('merges singular and plural builder code env vars', () => {
    const codes = resolveBuilderCodes({
      VITE_BASE_BUILDER_CODES: 'bc_alpha,bc_beta',
      VITE_BASE_BUILDER_CODE: 'bc_beta',
    })
    expect(codes).toEqual(['bc_alpha', 'bc_beta'])
  })

  it('appends suffix idempotently', () => {
    const suffix = resolveDataSuffix(envWithBuilderCode) as Hex
    const initialData = '0xaabbcc' as Hex

    const once = appendDataSuffixToHex(initialData, suffix)
    const twice = appendDataSuffixToHex(once, suffix)

    expect(once).toBe(twice)
    expect(payloadEndsWithDataSuffix(once, suffix)).toBe(true)
  })

  it('gates append behavior to Base/Base Sepolia when chainId is provided', () => {
    const suffix = resolveDataSuffix(envWithBuilderCode) as Hex
    const payload = '0x1234' as Hex

    const onBaseMainnet = appendBuilderSuffixToHex(payload, { chainId: 8453, dataSuffix: suffix })
    const onBaseSepolia = appendBuilderSuffixToHex(payload, { chainId: 84532, dataSuffix: suffix })
    const onNonBase = appendBuilderSuffixToHex(payload, { chainId: 1, dataSuffix: suffix })

    expect(payloadEndsWithDataSuffix(onBaseMainnet as Hex, suffix)).toBe(true)
    expect(payloadEndsWithDataSuffix(onBaseSepolia as Hex, suffix)).toBe(true)
    expect(onNonBase).toBe(payload)
  })

  it('validates marker tails in payloads', () => {
    const suffix = resolveDataSuffix(envWithBuilderCode) as Hex
    const payloadWithSuffix = appendDataSuffixToHex('0xdeadbeef' as Hex, suffix)
    const payloadWithoutSuffix = '0xdeadbeef' as Hex

    expect(hasErc8021RepeatingMarker(payloadWithSuffix)).toBe(true)
    expect(hasErc8021RepeatingMarker(payloadWithoutSuffix)).toBe(false)
  })
})
