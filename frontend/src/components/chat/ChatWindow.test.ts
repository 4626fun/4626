import { describe, expect, it } from 'vitest'

import { shouldAttemptInactiveDmRecovery } from './ChatWindow'

describe('shouldAttemptInactiveDmRecovery', () => {
  it('returns true for DM inactive-group errors with a peer address', () => {
    expect(
      shouldAttemptInactiveDmRecovery({
        reason: 'Group is inactive',
        conversationType: 'dm',
        dmPeerAddress: '0x1111111111111111111111111111111111111111',
        dmPeerInboxId: null,
      }),
    ).toBe(true)
  })

  it('returns true for DM inactive-group errors with a peer inbox id when address is unavailable', () => {
    expect(
      shouldAttemptInactiveDmRecovery({
        reason: 'Group is inactive',
        conversationType: 'dm',
        dmPeerAddress: null,
        dmPeerInboxId: 'peer-inbox-id',
      }),
    ).toBe(true)
  })

  it('returns false for non-DM conversations', () => {
    expect(
      shouldAttemptInactiveDmRecovery({
        reason: 'Group is inactive',
        conversationType: 'group',
        dmPeerAddress: '0x1111111111111111111111111111111111111111',
        dmPeerInboxId: 'peer-inbox-id',
      }),
    ).toBe(false)
  })

  it('returns false when there is no peer address', () => {
    expect(
      shouldAttemptInactiveDmRecovery({
        reason: 'Group is inactive',
        conversationType: 'dm',
        dmPeerAddress: null,
        dmPeerInboxId: null,
      }),
    ).toBe(false)
  })

  it('returns false for unrelated errors', () => {
    expect(
      shouldAttemptInactiveDmRecovery({
        reason: 'conversation_not_found',
        conversationType: 'dm',
        dmPeerAddress: '0x1111111111111111111111111111111111111111',
        dmPeerInboxId: null,
      }),
    ).toBe(false)
  })
})
