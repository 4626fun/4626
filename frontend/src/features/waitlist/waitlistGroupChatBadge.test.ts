import { describe, expect, it } from 'vitest'

import { deriveWaitlistChatBadge } from './waitlistGroupChatBadge'

describe('deriveWaitlistChatBadge', () => {
  it('shows In chat only when the group is locally visible', () => {
    expect(
      deriveWaitlistChatBadge({
        chatReady: true,
        hasGroupConversation: true,
        joinStatus: 'executed',
      }),
    ).toEqual({ label: 'In chat', tone: 'ready' })
  })

  it('shows Syncing when server join completed but group is missing locally', () => {
    expect(
      deriveWaitlistChatBadge({
        chatReady: true,
        hasGroupConversation: false,
        joinStatus: 'executed',
      }),
    ).toEqual({ label: 'Syncing…', tone: 'progress' })
  })

  it('does not show Added for executed-without-group', () => {
    const badge = deriveWaitlistChatBadge({
      chatReady: true,
      hasGroupConversation: false,
      joinStatus: 'executed',
    })
    expect(badge?.label).not.toBe('Added')
  })
})
