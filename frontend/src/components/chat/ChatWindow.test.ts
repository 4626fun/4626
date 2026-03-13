import { describe, expect, it } from 'vitest'

import { resolveCommandCenterVisibility, shouldAttemptInactiveDmRecovery } from './chatWindowState'

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

describe('resolveCommandCenterVisibility', () => {
  it('shows command center on mobile when available', () => {
    expect(
      resolveCommandCenterVisibility({
        isMobile: true,
        showCommandCenter: true,
        desktopCommandsOpen: false,
      }),
    ).toBe(true)
  })

  it('shows command center on desktop only when open', () => {
    expect(
      resolveCommandCenterVisibility({
        isMobile: false,
        showCommandCenter: true,
        desktopCommandsOpen: false,
      }),
    ).toBe(false)

    expect(
      resolveCommandCenterVisibility({
        isMobile: false,
        showCommandCenter: true,
        desktopCommandsOpen: true,
      }),
    ).toBe(true)
  })

  it('hides command center when unavailable regardless of device', () => {
    expect(
      resolveCommandCenterVisibility({
        isMobile: true,
        showCommandCenter: false,
        desktopCommandsOpen: true,
      }),
    ).toBe(false)
  })
})
