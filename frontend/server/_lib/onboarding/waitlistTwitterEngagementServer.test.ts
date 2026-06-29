import { beforeEach, describe, expect, it, vi } from 'vitest'

const { applyPointEvent } = vi.hoisted(() => ({
  applyPointEvent: vi.fn(async () => ({ awarded: true, score: { points: 4, tier: 'Bronze' } })),
}))

vi.mock('../identity/accountsIdentity.js', () => ({
  applyPointEvent,
}))

import {
  WAITLIST_X_ENGAGEMENT_TWEET_ID,
  WAITLIST_X_FOLLOW_HANDLE,
  awardVerifiedWaitlistTwitterEngagementStep,
  processWaitlistTwitterFavoriteEvent,
  processWaitlistTwitterFollowEvent,
  processWaitlistTwitterTweetCreateEvent,
  resolvePrivyUserIdForTwitterActor,
} from './waitlistTwitterEngagementServer.js'

function createDb(rows: Record<string, unknown>[]) {
  return {
    sql: vi.fn(async () => ({ rows })),
  }
}

describe('waitlistTwitterEngagementServer', () => {
  beforeEach(() => {
    applyPointEvent.mockClear()
  })

  it('resolves privy users by twitter id or username', async () => {
    const byId = createDb([{ privy_user_id: 'did:privy:abc' }])
    await expect(resolvePrivyUserIdForTwitterActor(byId, { id: '12345', username: null })).resolves.toBe(
      'did:privy:abc',
    )

    const byUsername = createDb([{ privy_user_id: 'did:privy:def' }])
    await expect(
      resolvePrivyUserIdForTwitterActor(byUsername, { id: null, username: 'creator' }),
    ).resolves.toBe('did:privy:def')
  })

  it('awards follow when target is @4626fun', async () => {
    const db = createDb([{ privy_user_id: 'did:privy:abc' }])
    const awarded = await processWaitlistTwitterFollowEvent(db, {
      source: { id_str: '999', screen_name: 'fan' },
      target: { id_str: '111', screen_name: WAITLIST_X_FOLLOW_HANDLE },
    })
    expect(awarded).toBe(true)
    expect(applyPointEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        privyUserId: 'did:privy:abc',
        eventType: 'x_engagement_follow',
        eventKey: WAITLIST_X_FOLLOW_HANDLE,
      }),
    )
  })

  it('ignores likes on other tweets', async () => {
    const db = createDb([{ privy_user_id: 'did:privy:abc' }])
    const awarded = await processWaitlistTwitterFavoriteEvent(db, {
      user: { id_str: '999', screen_name: 'fan' },
      favorited_status: { id_str: '123' },
    })
    expect(awarded).toBe(false)
    expect(applyPointEvent).not.toHaveBeenCalled()
  })

  it('awards like for the campaign tweet', async () => {
    const db = createDb([{ privy_user_id: 'did:privy:abc' }])
    const awarded = await processWaitlistTwitterFavoriteEvent(db, {
      user: { id_str: '999', screen_name: 'fan' },
      favorited_status: { id_str: WAITLIST_X_ENGAGEMENT_TWEET_ID },
    })
    expect(awarded).toBe(true)
    expect(applyPointEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'x_engagement_like',
        eventKey: WAITLIST_X_ENGAGEMENT_TWEET_ID,
      }),
    )
  })

  it('awards retweet and comment from tweet_create_events', async () => {
    const db = createDb([{ privy_user_id: 'did:privy:abc' }])

    const retweeted = await processWaitlistTwitterTweetCreateEvent(db, {
      user: { id_str: '999', screen_name: 'fan' },
      retweeted_status: { id_str: WAITLIST_X_ENGAGEMENT_TWEET_ID },
    })
    expect(retweeted).toBe(true)

    const replied = await processWaitlistTwitterTweetCreateEvent(db, {
      user: { id_str: '999', screen_name: 'fan' },
      in_reply_to_status_id_str: WAITLIST_X_ENGAGEMENT_TWEET_ID,
      text: 'great post',
    })
    expect(replied).toBe(true)
  })

  it('does not re-award engagement steps already recorded', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('x_engagement_follow')) {
          return { rows: [{ source: 'x_engagement_follow' }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardVerifiedWaitlistTwitterEngagementStep({
      db,
      privyUserId: 'did:privy:abc',
      step: 'follow',
    })

    expect(awarded).toBe(false)
    expect(applyPointEvent).not.toHaveBeenCalled()
  })
})
