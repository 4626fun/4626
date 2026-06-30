import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  parseWaitlistEngagementTweetIdFromUrl,
  readWaitlistXEngagementCampaignKey,
  readWaitlistXEngagementStepOrder,
  readWaitlistXEngagementTweetId,
  readWaitlistXEngagementTweetUrl,
} from './waitlistTwitterEngagementConfig.js'

describe('waitlistTwitterEngagementConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses tweet ids from status URLs', () => {
    expect(parseWaitlistEngagementTweetIdFromUrl('https://x.com/4626fun/status/1234567890123456789')).toBe(
      '1234567890123456789',
    )
    expect(parseWaitlistEngagementTweetIdFromUrl('1234567890123456789')).toBe('1234567890123456789')
    expect(parseWaitlistEngagementTweetIdFromUrl('https://example.com/nope')).toBeNull()
  })

  it('defaults to follow-only when no campaign tweet is configured', () => {
    expect(readWaitlistXEngagementTweetUrl()).toBeNull()
    expect(readWaitlistXEngagementTweetId()).toBeNull()
    expect(readWaitlistXEngagementStepOrder()).toEqual(['follow'])
    expect(readWaitlistXEngagementCampaignKey()).toBe('4626fun:follow-only')
  })

  it('enables the full quest when WAITLIST_X_ENGAGEMENT_TWEET_URL is set', () => {
    vi.stubEnv(
      'WAITLIST_X_ENGAGEMENT_TWEET_URL',
      'https://x.com/4626fun/status/9876543210123456789',
    )
    expect(readWaitlistXEngagementTweetUrl()).toBe('https://x.com/4626fun/status/9876543210123456789')
    expect(readWaitlistXEngagementTweetId()).toBe('9876543210123456789')
    expect(readWaitlistXEngagementStepOrder()).toEqual(['follow', 'retweet', 'comment'])
    expect(readWaitlistXEngagementCampaignKey()).toBe('4626fun:9876543210123456789')
  })

  it('accepts WAITLIST_X_ENGAGEMENT_TWEET_ID directly', () => {
    vi.stubEnv('WAITLIST_X_ENGAGEMENT_TWEET_ID', '111222333444555666')
    expect(readWaitlistXEngagementTweetId()).toBe('111222333444555666')
    expect(readWaitlistXEngagementStepOrder()).toEqual(['follow', 'retweet', 'comment'])
  })
})
