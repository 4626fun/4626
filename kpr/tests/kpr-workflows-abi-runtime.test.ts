import { describe, expect, it } from 'vitest'

describe('KPR runtime fee ABI module', () => {
  it('exposes the DLMM forwarder ABI through the runtime .js import path', async () => {
    const abi = await import('../utils/gaugeReceiveBridgedFeesAbi.js')

    expect(abi.GaugeReceiveBridgedFeesABI).toHaveLength(4)
  })
})
