import { describe, expect, it } from 'vitest'

import { classifyHookBytecodeStrings } from '../../../scripts/ops/hookBytecodeClassify.js'

describe('hook bytecode classifier', () => {
  it('requires the relay/settle surface for canonical classification', () => {
    expect(classifyHookBytecodeStrings('RelayEntries settle_fees')).toBe('canonical')
  })

  it('identifies the retired drain/flush surface', () => {
    expect(classifyHookBytecodeStrings('drain_entries FlushFees')).toBe('legacy')
  })

  it('fails closed for mixed or absent instruction markers', () => {
    expect(classifyHookBytecodeStrings('relay_entries drain_entries')).toBe('unknown')
    expect(classifyHookBytecodeStrings('unrelated program')).toBe('unknown')
  })
})
