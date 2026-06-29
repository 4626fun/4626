import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { verifyTwitterEngagementStep } from './verifyEngagement.js'

const TWEET_ID = '2031118597704265790'
const FOLLOW_HANDLE = '4626fun'
const FOLLOW_TARGET_ID = '555000'

type MockResponse = { status?: number; body: unknown }

function jsonResponse({ status = 200, body }: MockResponse) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/** Route mocked fetch by URL substring → response. */
function mockFetchByUrl(routes: Array<{ match: string; response: MockResponse }>) {
  return vi.fn(async (input: URL | string) => {
    const url = typeof input === 'string' ? input : input.toString()
    const route = routes.find((r) => url.includes(r.match))
    if (!route) throw new Error(`unexpected fetch: ${url}`)
    return jsonResponse(route.response)
  })
}

describe('verifyTwitterEngagementStep', () => {
  beforeEach(() => {
    process.env.X_BEARER_TOKEN = 'test-bearer'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.X_BEARER_TOKEN
  })

  it('returns credentials_unavailable when no bearer token is set', async () => {
    delete process.env.X_BEARER_TOKEN
    delete process.env.TWITTER_BEARER_TOKEN
    delete process.env.HERMIT_TWITTER_BEARER_TOKEN
    const result = await verifyTwitterEngagementStep({
      step: 'retweet',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: false, reason: 'credentials_unavailable' })
  })

  it('verifies a follow by scanning the user following list', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        { match: `/users/by/username/${FOLLOW_HANDLE}`, response: { body: { data: { id: FOLLOW_TARGET_ID } } } },
        {
          match: '/users/123/following',
          response: { body: { data: [{ id: '999' }, { id: FOLLOW_TARGET_ID }] } },
        },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'follow',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: true, reason: 'verified' })
  })

  it('reports not_found when the user does not follow the target', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        { match: `/users/by/username/${FOLLOW_HANDLE}`, response: { body: { data: { id: FOLLOW_TARGET_ID } } } },
        { match: '/users/123/following', response: { body: { data: [{ id: '999' }], meta: {} } } },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'follow',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: false, reason: 'not_found' })
  })

  it('verifies a like by scanning the user liked posts', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        {
          match: '/users/123/liked_tweets',
          response: { body: { data: [{ id: 'other' }, { id: TWEET_ID }] } },
        },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'like',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: true, reason: 'verified' })
  })

  it('verifies a retweet from the user timeline', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        {
          match: '/users/123/tweets',
          response: {
            body: { data: [{ id: 't1', referenced_tweets: [{ type: 'retweeted', id: TWEET_ID }] }] },
          },
        },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'retweet',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: true, reason: 'verified' })
  })

  it('verifies a comment (reply) from the user timeline', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        {
          match: '/users/123/tweets',
          response: {
            body: { data: [{ id: 't2', referenced_tweets: [{ type: 'replied_to', id: TWEET_ID }] }] },
          },
        },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'comment',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: true, reason: 'verified' })
  })

  it('resolves a numeric id from username when only a handle is linked', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        { match: '/users/by/username/somefan', response: { body: { data: { id: '123' } } } },
        {
          match: '/users/123/tweets',
          response: {
            body: { data: [{ id: 't3', referenced_tweets: [{ type: 'retweeted', id: TWEET_ID }] }] },
          },
        },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'retweet',
      actor: { id: null, username: 'somefan' },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: true, reason: 'verified' })
  })

  it('maps a 403 from a gated lookup to lookup_unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([
        { match: '/users/123/liked_tweets', response: { status: 403, body: { title: 'Forbidden' } } },
      ]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'like',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: false, reason: 'lookup_unavailable' })
  })

  it('maps a 429 to rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchByUrl([{ match: '/users/123/tweets', response: { status: 429, body: {} } }]),
    )
    const result = await verifyTwitterEngagementStep({
      step: 'retweet',
      actor: { id: '123', username: null },
      tweetId: TWEET_ID,
      followHandle: FOLLOW_HANDLE,
    })
    expect(result).toEqual({ verified: false, reason: 'rate_limited' })
  })
})
