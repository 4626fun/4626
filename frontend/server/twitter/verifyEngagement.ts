import { logger } from '../_lib/infra/logger.js'
import { readTwitterBearerToken } from './twitterEnv.js'

export type TwitterEngagementStep = 'follow' | 'like' | 'retweet' | 'comment'

export type TwitterEngagementVerifyReason =
  | 'verified'
  | 'not_found'
  | 'not_linked'
  | 'credentials_unavailable'
  | 'lookup_unavailable' // tier/permission blocked (403/453)
  | 'rate_limited' // 429
  | 'network_error'

export type TwitterEngagementVerifyResult =
  | { verified: true; reason: 'verified' }
  | { verified: false; reason: Exclude<TwitterEngagementVerifyReason, 'verified'> }

const TWITTER_API_BASE = 'https://api.twitter.com/2'

// Bound pagination so a single verification can never fan out into an
// unbounded number of X API calls. On the Pay-Per-Use tier every request is
// billed, so these caps double as a cost ceiling per verification.
//
// Follow uses a single page: `max_results=1000` returns a user's entire
// following list in one billed request unless they follow >1000 accounts, so a
// 1-page cap is the cheapest check that still covers the vast majority of users.
const MAX_PAGES_FOLLOWING = 1
// We scan the user's *recent* liked posts rather than the tweet's liking_users
// list, because `/2/tweets/:id/liking_users` is capped at 100 users per post
// for all time and would miss likes on any popular post. A fresh quest-like is
// near the top of the user's liked_tweets, so a shallow scan suffices.
const MAX_PAGES_LIKED_TWEETS = 3
const MAX_PAGES_TIMELINE = 2
const PAGE_SIZE = 100

type TwitterFetchResult =
  | { ok: true; payload: any }
  | { ok: false; reason: Exclude<TwitterEngagementVerifyReason, 'verified'> }

async function twitterGet(path: string, params: Record<string, string>): Promise<TwitterFetchResult> {
  const bearer = readTwitterBearerToken()
  if (!bearer) return { ok: false, reason: 'credentials_unavailable' }

  const url = new URL(`${TWITTER_API_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.warn('[x/engagement-verify] network error', { path, error: String(error) })
    return { ok: false, reason: 'network_error' }
  }

  const bodyText = await response.text()
  let payload: any = null
  try {
    payload = bodyText ? JSON.parse(bodyText) : null
  } catch {
    payload = null
  }

  if (response.ok) return { ok: true, payload }

  if (response.status === 404) return { ok: false, reason: 'not_found' }
  if (response.status === 429) return { ok: false, reason: 'rate_limited' }
  // 401/403/453 → app tier or permissions do not allow this lookup.
  if (response.status === 401 || response.status === 403 || response.status === 453) {
    logger.warn('[x/engagement-verify] lookup unavailable', { path, status: response.status })
    return { ok: false, reason: 'lookup_unavailable' }
  }
  logger.warn('[x/engagement-verify] non-ok response', { path, status: response.status })
  return { ok: false, reason: 'network_error' }
}

// X user ids are stable, so cache username→id resolutions for the process
// lifetime. This avoids paying for a repeat `/users/by/username` lookup on every
// verification (notably the constant `@4626fun` follow target).
const usernameIdCache = new Map<string, string>()

/** Resolve a numeric X user id from a username (without leading @). */
export async function resolveTwitterUserIdByUsername(username: string): Promise<string | null> {
  const handle = username.trim().replace(/^@/, '').toLowerCase()
  if (!handle) return null
  const cached = usernameIdCache.get(handle)
  if (cached) return cached
  const result = await twitterGet(`/users/by/username/${encodeURIComponent(handle)}`, {})
  if (!result.ok) return null
  const id = result.payload?.data?.id
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    usernameIdCache.set(handle, id)
    return id
  }
  return null
}

type ResolvedActor = { id: string | null; reason?: Exclude<TwitterEngagementVerifyReason, 'verified'> }

async function resolveActorId(actor: { id: string | null; username: string | null }): Promise<ResolvedActor> {
  if (actor.id && /^\d+$/.test(actor.id)) return { id: actor.id }
  if (actor.username) {
    const resolved = await resolveTwitterUserIdByUsername(actor.username)
    if (resolved) return { id: resolved }
    return { id: null, reason: 'not_found' }
  }
  return { id: null, reason: 'not_linked' }
}

function fail(reason: Exclude<TwitterEngagementVerifyReason, 'verified'>): TwitterEngagementVerifyResult {
  return { verified: false, reason }
}

/** Does `userId` follow `targetUserId`? Scans the user's following list. */
async function verifyFollows(userId: string, targetUserId: string): Promise<TwitterEngagementVerifyResult> {
  let nextToken = ''
  for (let page = 0; page < MAX_PAGES_FOLLOWING; page += 1) {
    const params: Record<string, string> = { max_results: '1000' }
    if (nextToken) params.pagination_token = nextToken
    const result = await twitterGet(`/users/${userId}/following`, params)
    if (!result.ok) return fail(result.reason)
    const data: any[] = Array.isArray(result.payload?.data) ? result.payload.data : []
    if (data.some((entry) => typeof entry?.id === 'string' && entry.id === targetUserId)) {
      return { verified: true, reason: 'verified' }
    }
    nextToken = typeof result.payload?.meta?.next_token === 'string' ? result.payload.meta.next_token : ''
    if (!nextToken) break
  }
  return { verified: false, reason: 'not_found' }
}

/**
 * Did `userId` like `tweetId`? Scans the user's recently liked posts.
 *
 * Uses `/2/users/:id/liked_tweets` (reverse-chronological) instead of the
 * tweet's `liking_users` list, which is hard-capped at 100 users per post.
 */
async function verifyLike(userId: string, tweetId: string): Promise<TwitterEngagementVerifyResult> {
  let nextToken = ''
  for (let page = 0; page < MAX_PAGES_LIKED_TWEETS; page += 1) {
    const params: Record<string, string> = { max_results: String(PAGE_SIZE) }
    if (nextToken) params.pagination_token = nextToken
    const result = await twitterGet(`/users/${userId}/liked_tweets`, params)
    if (!result.ok) return fail(result.reason)
    const data: any[] = Array.isArray(result.payload?.data) ? result.payload.data : []
    if (data.some((entry) => typeof entry?.id === 'string' && entry.id === tweetId)) {
      return { verified: true, reason: 'verified' }
    }
    nextToken = typeof result.payload?.meta?.next_token === 'string' ? result.payload.meta.next_token : ''
    if (!nextToken) break
  }
  return { verified: false, reason: 'not_found' }
}

type ReferencedTweet = { type?: string; id?: string }

/**
 * Scan a user's recent tweets for a referenced campaign tweet of a given kind.
 * Used for retweet (`retweeted`) and comment (`replied_to`) — both reliably
 * available from the user-timeline endpoint on the standard app tier.
 */
async function verifyTimelineReference(
  userId: string,
  tweetId: string,
  referenceType: 'retweeted' | 'replied_to',
): Promise<TwitterEngagementVerifyResult> {
  let nextToken = ''
  for (let page = 0; page < MAX_PAGES_TIMELINE; page += 1) {
    const params: Record<string, string> = {
      max_results: String(PAGE_SIZE),
      'tweet.fields': 'referenced_tweets',
    }
    if (nextToken) params.pagination_token = nextToken
    const result = await twitterGet(`/users/${userId}/tweets`, params)
    if (!result.ok) return fail(result.reason)
    const data: any[] = Array.isArray(result.payload?.data) ? result.payload.data : []
    for (const tweet of data) {
      const refs: ReferencedTweet[] = Array.isArray(tweet?.referenced_tweets) ? tweet.referenced_tweets : []
      if (refs.some((ref) => ref?.type === referenceType && ref?.id === tweetId)) {
        return { verified: true, reason: 'verified' }
      }
    }
    nextToken = typeof result.payload?.meta?.next_token === 'string' ? result.payload.meta.next_token : ''
    if (!nextToken) break
  }
  return { verified: false, reason: 'not_found' }
}

/**
 * Verify a single waitlist X engagement step against the live X API.
 *
 * `actor` is the user's linked X identity (numeric id and/or username). When
 * only a username is known it is resolved to a numeric id first.
 */
export async function verifyTwitterEngagementStep(params: {
  step: TwitterEngagementStep
  actor: { id: string | null; username: string | null }
  tweetId: string
  followHandle: string
}): Promise<TwitterEngagementVerifyResult> {
  if (!readTwitterBearerToken()) return fail('credentials_unavailable')

  const actor = await resolveActorId(params.actor)
  if (!actor.id) return fail(actor.reason ?? 'not_linked')

  switch (params.step) {
    case 'follow': {
      const targetId = await resolveTwitterUserIdByUsername(params.followHandle)
      if (!targetId) return fail('not_found')
      return verifyFollows(actor.id, targetId)
    }
    case 'like':
      return verifyLike(actor.id, params.tweetId)
    case 'retweet':
      return verifyTimelineReference(actor.id, params.tweetId, 'retweeted')
    case 'comment':
      return verifyTimelineReference(actor.id, params.tweetId, 'replied_to')
    default: {
      const exhaustive: never = params.step
      return exhaustive
    }
  }
}
