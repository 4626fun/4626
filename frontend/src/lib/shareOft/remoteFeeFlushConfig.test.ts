import { describe, expect, it } from 'vitest'

import { applyExecutorDropBuffer } from './remoteFeeFlushConfig'

describe('remoteFeeFlushConfig', () => {
  it('applyExecutorDropBuffer adds 5% headroom by default', () => {
    expect(applyExecutorDropBuffer(1_000_000n)).toBe(1_050_000n)
    expect(applyExecutorDropBuffer(0n)).toBe(0n)
  })
})
