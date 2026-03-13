import { describe, expect, it } from 'vitest'

import type { DmRecipientResolution } from '@/lib/xmtp/socialIdentity'
import { resolveDmRoute } from './dmRouting'

function sampleRecipient(address: `0x${string}`): DmRecipientResolution {
  return {
    address,
    basenameHint: null,
    avatarUrl: null,
  }
}

describe('resolveDmRoute', () => {
  it('keeps self-recipient unchanged', () => {
    const result = resolveDmRoute({
      recipient: sampleRecipient('0x1111111111111111111111111111111111111111'),
      identityAddress: '0x1111111111111111111111111111111111111111',
      connectedAddress: null,
      agentAddress: '0x2222222222222222222222222222222222222222',
      agentDisplayName: 'akita',
    })

    expect(result.reroutedToAgent).toBe(false)
    expect(result.notice).toBeNull()
    expect(result.recipient.address).toBe('0x1111111111111111111111111111111111111111')
  })

  it('keeps recipient unchanged when it is not self', () => {
    const result = resolveDmRoute({
      recipient: sampleRecipient('0x1111111111111111111111111111111111111111'),
      identityAddress: '0x3333333333333333333333333333333333333333',
      connectedAddress: '0x4444444444444444444444444444444444444444',
      agentAddress: '0x2222222222222222222222222222222222222222',
      agentDisplayName: 'akita',
    })

    expect(result.reroutedToAgent).toBe(false)
    expect(result.notice).toBeNull()
    expect(result.recipient.address).toBe('0x1111111111111111111111111111111111111111')
  })

  it('does not emit self-chat notice when recipient equals self', () => {
    const result = resolveDmRoute({
      recipient: sampleRecipient('0x1111111111111111111111111111111111111111'),
      identityAddress: '0x1111111111111111111111111111111111111111',
      connectedAddress: null,
      agentAddress: '0x1111111111111111111111111111111111111111',
      agentDisplayName: 'akita',
    })

    expect(result.reroutedToAgent).toBe(false)
    expect(result.notice).toBeNull()
    expect(result.recipient.address).toBe('0x1111111111111111111111111111111111111111')
  })
})
