import { beforeEach, describe, expect, it, vi } from 'vitest'

const { applyPointEvent, verifyTwitterEngagementStep } = vi.hoisted(() => ({
  applyPointEvent: vi.fn(async () => ({ awarded: true, score: { points: 4, tier: 'Bronze' } })),
  verifyTwitterEngagementStep: vi.fn(
    async (): Promise<{ verified: boolean; reason: string }> => ({ verified: true, reason: 'verified' }),
  ),
}))

vi.mock('../identity/accountsIdentity.js', () => ({
  applyPointEvent,
}))

vi.mock('../../twitter/verifyEngagement.js', () => ({
  verifyTwitterEngagementStep,
}))

import {
  WAITLIST_X_ENGAGEMENT_TWEET_ID,
  WAITLIST_X_FOLLOW_HANDLE,
  awardVerifiedWaitlistTwitterEngagementStep,
  processWaitlistTwitterFavoriteEvent,
  processWaitlistTwitterFollowEvent,
  processWaitlistTwitterTweetCreateEvent,
  readLinkedTwitterIdentityForPrivyUser,
  resolvePrivyUserIdForTwitterActor,
  verifyAndAwardWaitlistTwitterEngagementStep,
} from './waitlistTwitterEngagementServer.js'

function createDb(rows: Record<string, unknown>[]) {
  return {
    sql: vi.fn(async () => ({ rows })),
  }
}

describe('waitlistTwitterEngagementServer', () => {
  beforeEach(() => {
    applyPointEvent.mockClear()
    verifyTwitterEngagementStep.mockClear()
    verifyTwitterEngagementStep.mockResolvedValue({ verified: true, reason: 'verified' as const })
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

  describe('readLinkedTwitterIdentityForPrivyUser', () => {
    it('classifies numeric values as id and handles as username', async () => {
      const db = createDb([{ value: '1502233' }, { value: '@CreatorFan' }])
      await expect(readLinkedTwitterIdentityForPrivyUser(db, 'did:privy:abc')).resolves.toEqual({
        id: '1502233',
        username: 'creatorfan',
      })
    })

    it('returns nulls when no twitter identity is linked', async () => {
      const db = createDb([])
      await expect(readLinkedTwitterIdentityForPrivyUser(db, 'did:privy:abc')).resolves.toEqual({
        id: null,
        username: null,
      })
    })
  })

  describe('verifyAndAwardWaitlistTwitterEngagementStep', () => {
    function createKeyedDb(opts: { progressSources?: string[]; twitterValues?: string[] }) {
      return {
        sql: vi.fn(async (strings: TemplateStringsArray) => {
          const text = strings.join(' ').toLowerCase()
          if (text.includes('account_linked_methods') && text.includes('twitter')) {
            return { rows: (opts.twitterValues ?? []).map((value) => ({ value })) }
          }
          if (text.includes('x_engagement_follow')) {
            return { rows: (opts.progressSources ?? []).map((source) => ({ source })) }
          }
          return { rows: [] }
        }),
      }
    }

    it('rejects out-of-order steps without calling the X API', async () => {
      const db = createKeyedDb({ twitterValues: ['123'] }) // empty progress → active is "follow"
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db,
        privyUserId: 'did:privy:abc',
        step: 'like',
      })
      expect(result).toMatchObject({ ok: false, reason: 'out_of_order' })
      expect(verifyTwitterEngagementStep).not.toHaveBeenCalled()
      expect(applyPointEvent).not.toHaveBeenCalled()
    })

    it('fails with not_linked when no X identity is linked', async () => {
      const db = createKeyedDb({ twitterValues: [] })
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db,
        privyUserId: 'did:privy:abc',
        step: 'follow',
      })
      expect(result).toMatchObject({ ok: false, reason: 'not_linked' })
      expect(verifyTwitterEngagementStep).not.toHaveBeenCalled()
    })

    it('does not award when the X API does not confirm the step', async () => {
      verifyTwitterEngagementStep.mockResolvedValueOnce({ verified: false, reason: 'not_found' })
      const db = createKeyedDb({ twitterValues: ['123'] })
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db,
        privyUserId: 'did:privy:abc',
        step: 'follow',
      })
      expect(result).toMatchObject({ ok: false, reason: 'not_found' })
      expect(applyPointEvent).not.toHaveBeenCalled()
    })

    it('awards the active step once the X API confirms it', async () => {
      const db = createKeyedDb({ twitterValues: ['123'] })
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db,
        privyUserId: 'did:privy:abc',
        step: 'follow',
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.awarded).toBe(true)
      expect(verifyTwitterEngagementStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'follow',
          tweetId: WAITLIST_X_ENGAGEMENT_TWEET_ID,
          followHandle: WAITLIST_X_FOLLOW_HANDLE,
          actor: expect.objectContaining({ id: '123' }),
        }),
      )
      expect(applyPointEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'x_engagement_follow', eventKey: WAITLIST_X_FOLLOW_HANDLE }),
      )
    })

    it('is idempotent for an already-recorded step (no API call)', async () => {
      const db = createKeyedDb({ twitterValues: ['123'], progressSources: ['x_engagement_follow'] })
      const result = await verifyAndAwardWaitlistTwitterEngagementStep({
        db,
        privyUserId: 'did:privy:abc',
        step: 'follow',
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.awarded).toBe(false)
      expect(verifyTwitterEngagementStep).not.toHaveBeenCalled()
      expect(applyPointEvent).not.toHaveBeenCalled()
    })
  })
})
