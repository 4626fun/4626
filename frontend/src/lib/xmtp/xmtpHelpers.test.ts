import { describe, expect, it } from 'vitest'

import { shouldFallbackToOriginalXmtpRecipient } from './xmtpHelpers'

describe('shouldFallbackToOriginalXmtpRecipient', () => {
  const original = '0xb05cf01231cf2ff99499682e64d3780d57c80fdd' as const
  const canonical = '0x8da9aff7112e7aca19ffda892979197e3a465319' as const

  it('falls back when the canonical recipient is not reachable but the original input address is', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: true,
      }),
    ).toBe(true)
  })

  it('does not fall back when the canonical recipient is reachable', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: true,
        originalCanMessage: true,
      }),
    ).toBe(false)
  })

  it('does not fall back when the original input address is not reachable', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: false,
      }),
    ).toBe(false)
  })

  it('does not fall back without a canonical remap', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: canonical,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: true,
      }),
    ).toBe(false)
  })
})
