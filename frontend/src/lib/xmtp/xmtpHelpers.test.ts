import { describe, expect, it, vi } from 'vitest'

import { isLocalXmtpStateInvalidError, shouldFallbackToOriginalXmtpRecipient } from './xmtpHelpers'

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

describe('isLocalXmtpStateInvalidError', () => {
  it('detects inbox validation and partial sync failures', () => {
    expect(
      isLocalXmtpStateInvalidError(
        'InboxValidationFailed("f1cb93da12e9fb6935084c613638d4005e5c5fd91b02e9ef0355add7309ae673")',
      ),
    ).toBe(true)
    expect(isLocalXmtpStateInvalidError('synced 12 messages, 3 failed 9 succeeded')).toBe(true)
    expect(isLocalXmtpStateInvalidError('conversation_not_found')).toBe(false)
  })
})


describe('resolveConversationById', () => {
  it('matches conversation ids case-insensitively', async () => {
    const { conversationIdsEqual, resolveConversationById } = await import('./xmtpHelpers')
    expect(conversationIdsEqual('AbC', 'abc')).toBe(true)

    const convo = { id: 'GroupABC', sync: vi.fn(async () => undefined) }
    const api = {
      sync: vi.fn(async () => undefined),
      getConversationById: vi.fn(async () => null),
      list: vi.fn(async () => [convo]),
    }
    const resolved = await resolveConversationById(api, 'groupabc')
    expect(resolved?.id).toBe('GroupABC')
  })

  it('uses syncAll and listGroups when resolving waitlist group memberships', async () => {
    const { ConsentState } = await import('@xmtp/browser-sdk')
    const { resolveConversationById } = await import('./xmtpHelpers')

    const group = {
      id: 'ed6fbda34f2614536df5cec08dff2266',
      sync: vi.fn(async () => undefined),
      consentState: vi.fn(async () => ConsentState.Unknown),
      updateConsentState: vi.fn(async () => undefined),
    }
    const api = {
      sync: vi.fn(async () => undefined),
      syncAll: vi.fn(async () => undefined),
      getConversationById: vi.fn(async () => null),
      list: vi.fn(async () => []),
      listGroups: vi.fn(async () => [group]),
    }

    const resolved = await resolveConversationById(api, 'ed6fbda34f2614536df5cec08dff2266')
    expect(resolved?.id).toBe(group.id)
    expect(api.syncAll).toHaveBeenCalled()
    expect(group.updateConsentState).toHaveBeenCalledWith(ConsentState.Allowed)
  })
})
