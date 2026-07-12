import { describe, expect, it } from 'vitest'

import { evaluateConditionalInverseEdge } from './walkForwardSelectiveCounter.js'

describe('evaluateConditionalInverseEdge', () => {
  it('disables public claims until sample and CI gates pass', () => {
    const report = evaluateConditionalInverseEdge({
      points: [
        {
          timestampMs: 1,
          asset: 'BTC',
          selectiveCounterNetBps: 10,
          alwaysInverseNetBps: 5,
        },
        {
          timestampMs: 2,
          asset: 'ETH',
          selectiveCounterNetBps: -4,
          alwaysInverseNetBps: 1,
        },
      ],
      methodologyVersion: 'inv-akita-decision-v1.0.0',
      minSample: 100,
    })
    expect(report.sampleSize).toBe(2)
    expect(report.claimAllowed).toBe(false)
    expect(report.notes.join(' ')).toContain('disabled')
  })
})
