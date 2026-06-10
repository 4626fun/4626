import { describe, expect, it } from 'vitest'

import { parseMinDeviationBps } from './strategyReallocEnv.js'

describe('parseMinDeviationBps', () => {
  it('defaults invalid values to 500', () => {
    expect(parseMinDeviationBps()).toBe(500)
    expect(parseMinDeviationBps(undefined)).toBe(500)
    expect(parseMinDeviationBps('')).toBe(500)
    expect(parseMinDeviationBps('not-a-number')).toBe(500)
    expect(parseMinDeviationBps(-1)).toBe(500)
  })

  it('floors and clamps to 10_000 bps', () => {
    expect(parseMinDeviationBps(750.9)).toBe(750)
    expect(parseMinDeviationBps('2500')).toBe(2500)
    expect(parseMinDeviationBps(99_999)).toBe(10_000)
  })
})
