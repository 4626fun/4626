import { describe, expect, it } from 'vitest'

import {
  WAITLIST_X_ENGAGEMENT_COMMENT,
  WAITLIST_X_ENGAGEMENT_TWEET_URL,
  WAITLIST_X_FOLLOW_HANDLE,
  buildWaitlistTwitterCommentIntentUrl,
  buildWaitlistTwitterFollowIntentUrl,
  buildWaitlistTwitterLikeIntentUrl,
  buildWaitlistTwitterRetweetIntentUrl,
  emptyWaitlistTwitterEngagementProgress,
  parseTweetIdFromUrl,
  resolveActiveWaitlistTwitterEngagementStep,
  resolveWaitlistTwitterEngagementStepCopy,
  resolveWaitlistTwitterEngagementTweetId,
  resolveWaitlistTwitterEngagementTweetUrl,
  resolveWaitlistTwitterFollowHandle,
} from './waitlistTwitterEngagement'

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

  it('advances one engagement step at a time from verified progress', () => {
    expect(resolveActiveWaitlistTwitterEngagementStep(emptyWaitlistTwitterEngagementProgress())).toBe('follow')

    expect(
      resolveActiveWaitlistTwitterEngagementStep({
        follow: true,
        like: false,
        retweet: false,
        comment: false,
      }),
    ).toBe('like')

    expect(
      resolveActiveWaitlistTwitterEngagementStep({
        follow: true,
        like: true,
        retweet: true,
        comment: false,
      }),
    ).toBe('comment')

    expect(
      resolveActiveWaitlistTwitterEngagementStep({
        follow: true,
        like: true,
        retweet: true,
        comment: true,
      }),
    ).toBe('complete')
  })
})
