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
  it('reroutes self-recipient to Akita when agent address differs', () => {
    const result = resolveDmRoute({
      recipient: sampleRecipient('0x1111111111111111111111111111111111111111'),
      identityAddress: '0x1111111111111111111111111111111111111111',
      connectedAddress: null,
      agentAddress: '0x2222222222222222222222222222222222222222',
      agentDisplayName: 'akita',
    })

    expect(result.reroutedToAgent).toBe(true)
    expect(result.notice).toContain('Use Akita to chat about your wallet')
    expect(result.recipient.address).toBe('0x2222222222222222222222222222222222222222')
    expect(result.recipient.basenameHint).toBe('akita')
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

  it('returns a self-chat notice when Akita address equals self', () => {
    const result = resolveDmRoute({
      recipient: sampleRecipient('0x1111111111111111111111111111111111111111'),
      identityAddress: '0x1111111111111111111111111111111111111111',
      connectedAddress: null,
      agentAddress: '0x1111111111111111111111111111111111111111',
      agentDisplayName: 'akita',
    })

    expect(result.reroutedToAgent).toBe(false)
    expect(result.notice).toContain('Use Akita to chat about your wallet')
    expect(result.recipient.address).toBe('0x1111111111111111111111111111111111111111')
  })
})
