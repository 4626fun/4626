import { describe, expect, it } from 'vitest'

import { parseCapabilities } from './getCapabilities'

describe('parseCapabilities', () => {
  it('reads paymaster and atomic from chain-scoped capabilities', () => {
    const parsed = parseCapabilities(
      {
        '0x2105': {
          paymasterService: { supported: true },
          atomic: { status: 'ready' },
        },
      },
      '0x2105',
    )

    expect(parsed).toEqual({
      paymasterService: true,
      atomicStatus: 'ready',
      supports5792: true,
    })
  })

  it('returns unknown when shape is unsupported', () => {
    const parsed = parseCapabilities(null, '0x2105')
    expect(parsed).toEqual({
      paymasterService: false,
      atomicStatus: 'unknown',
      supports5792: false,
    })
  })
})

