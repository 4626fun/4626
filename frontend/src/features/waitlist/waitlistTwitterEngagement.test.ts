import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WAITLIST_X_ENGAGEMENT_COMMENT,
  WAITLIST_X_ENGAGEMENT_TWEET_URL,
  WAITLIST_X_FOLLOW_HANDLE,
  buildWaitlistTwitterCommentIntentUrl,
  buildWaitlistTwitterFollowIntentUrl,
  buildWaitlistTwitterLikeIntentUrl,
  buildWaitlistTwitterRetweetIntentUrl,
  markWaitlistTwitterEngagementStepComplete,
  parseTweetIdFromUrl,
  readWaitlistTwitterEngagementProgress,
  resolveActiveWaitlistTwitterEngagementStep,
  resolveWaitlistTwitterEngagementStepCopy,
  resolveWaitlistTwitterEngagementTweetId,
  resolveWaitlistTwitterEngagementTweetUrl,
  resolveWaitlistTwitterFollowHandle,
} from './waitlistTwitterEngagement'

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('waitlistTwitterEngagement', () => {
  it('uses repo constants for follow handle and campaign post', () => {
    expect(resolveWaitlistTwitterFollowHandle()).toBe(WAITLIST_X_FOLLOW_HANDLE)
    expect(resolveWaitlistTwitterEngagementTweetUrl()).toBe(WAITLIST_X_ENGAGEMENT_TWEET_URL)
    expect(resolveWaitlistTwitterEngagementTweetId()).toBe('2031118597704265790')
    expect(resolveWaitlistTwitterEngagementStepCopy('follow').title).toBe('Follow @4626fun')
  })

  it('parses tweet ids from status URLs', () => {
    expect(parseTweetIdFromUrl('https://x.com/4626/status/1234567890123456789')).toBe('1234567890123456789')
    expect(parseTweetIdFromUrl('https://twitter.com/team/status/987654321')).toBe('987654321')
    expect(parseTweetIdFromUrl('1234567890123456789')).toBe('1234567890123456789')
    expect(parseTweetIdFromUrl('https://example.com/nope')).toBeNull()
  })

  it('builds ordered X web intents', () => {
    expect(buildWaitlistTwitterFollowIntentUrl('4626fun')).toBe(
      'https://twitter.com/intent/follow?screen_name=4626fun',
    )
    const id = '1234567890'
    expect(buildWaitlistTwitterLikeIntentUrl(id)).toBe('https://twitter.com/intent/like?tweet_id=1234567890')
    expect(buildWaitlistTwitterRetweetIntentUrl(id)).toBe('https://twitter.com/intent/retweet?tweet_id=1234567890')
    const commentUrl = buildWaitlistTwitterCommentIntentUrl(id, WAITLIST_X_ENGAGEMENT_COMMENT)
    expect(commentUrl).toContain('in_reply_to=1234567890')
    expect(commentUrl).toContain('text=')
    expect(decodeURIComponent(commentUrl.split('text=')[1]?.replace(/\+/g, ' ') ?? '')).toBe(
      WAITLIST_X_ENGAGEMENT_COMMENT,
    )
  })

  it('advances one engagement step at a time', () => {
    expect(resolveActiveWaitlistTwitterEngagementStep(readWaitlistTwitterEngagementProgress('user-a'))).toBe('follow')

    markWaitlistTwitterEngagementStepComplete('user-a', 'follow')
    expect(resolveActiveWaitlistTwitterEngagementStep(readWaitlistTwitterEngagementProgress('user-a'))).toBe('like')

    markWaitlistTwitterEngagementStepComplete('user-a', 'like')
    expect(resolveActiveWaitlistTwitterEngagementStep(readWaitlistTwitterEngagementProgress('user-a'))).toBe('retweet')

    markWaitlistTwitterEngagementStepComplete('user-a', 'retweet')
    expect(resolveActiveWaitlistTwitterEngagementStep(readWaitlistTwitterEngagementProgress('user-a'))).toBe('comment')

    markWaitlistTwitterEngagementStepComplete('user-a', 'comment')
    expect(readWaitlistTwitterEngagementProgress('user-a')).toEqual({
      follow: true,
      like: true,
      retweet: true,
      comment: true,
    })
    expect(resolveActiveWaitlistTwitterEngagementStep(readWaitlistTwitterEngagementProgress('user-a'))).toBe(
      'complete',
    )
  })
})
