import { applyPointEvent } from '../identity/accountsIdentity.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }

export type WaitlistTwitterEngagementStepId = 'follow' | 'like' | 'retweet' | 'comment'

export const WAITLIST_X_FOLLOW_HANDLE = '4626fun'
export const WAITLIST_X_ENGAGEMENT_TWEET_ID = '2031118597704265790'
export const WAITLIST_X_ENGAGEMENT_CAMPAIGN_KEY = `${WAITLIST_X_FOLLOW_HANDLE}:${WAITLIST_X_ENGAGEMENT_TWEET_ID}`

export const WAITLIST_X_ENGAGEMENT_POINTS: Record<WaitlistTwitterEngagementStepId, number> = {
  follow: 4,
  like: 4,
  retweet: 4,
  comment: 4,
}

const STEP_TO_POINT_SOURCE: Record<WaitlistTwitterEngagementStepId, string> = {
  follow: 'x_engagement_follow',
  like: 'x_engagement_like',
  retweet: 'x_engagement_repost',
  comment: 'x_engagement_comment',
}

const POINT_SOURCE_TO_STEP: Record<string, WaitlistTwitterEngagementStepId> = {
  x_engagement_follow: 'follow',
  x_engagement_like: 'like',
  x_engagement_repost: 'retweet',
  x_engagement_comment: 'comment',
}

export type WaitlistTwitterEngagementProgress = Record<WaitlistTwitterEngagementStepId, boolean>

function emptyProgress(): WaitlistTwitterEngagementProgress {
  return { follow: false, like: false, retweet: false, comment: false }
}

function stepSourceId(step: WaitlistTwitterEngagementStepId): string {
  if (step === 'follow') return WAITLIST_X_FOLLOW_HANDLE
  return WAITLIST_X_ENGAGEMENT_TWEET_ID
}

function normalizeTwitterUsername(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : ''
  return raw || null
}

function normalizeTwitterUserId(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  return /^\d+$/.test(raw) ? raw : null
}

function readUserObject(value: unknown): { id: string | null; username: string | null } {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!record) return { id: null, username: null }
  return {
    id: normalizeTwitterUserId(record.id_str ?? record.id),
    username: normalizeTwitterUsername(record.screen_name ?? record.username),
  }
}

function readTweetId(value: unknown): string | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!record) return null
  return normalizeTwitterUserId(record.id_str ?? record.id)
}

export async function resolvePrivyUserIdForTwitterActor(
  db: Db,
  actor: { id: string | null; username: string | null },
): Promise<string | null> {
  const userId = actor.id
  const username = actor.username
  if (!userId && !username) return null

  const result = await db.sql`
    SELECT DISTINCT accounts.privy_user_id AS privy_user_id
    FROM account_linked_methods
    INNER JOIN accounts ON accounts.privy_user_id = account_linked_methods.privy_user_id
    WHERE account_linked_methods.type = 'twitter'
      AND (
        (${userId}::text IS NOT NULL AND account_linked_methods.value = ${userId})
        OR (
          ${username}::text IS NOT NULL
          AND LOWER(REGEXP_REPLACE(account_linked_methods.value, '^@', '')) = ${username}
        )
      )
    LIMIT 1;
  `
  const privyUserId = result.rows?.[0]?.privy_user_id
  return typeof privyUserId === 'string' && privyUserId.trim() ? privyUserId.trim() : null
}

export async function readWaitlistTwitterEngagementProgressForPrivyUser(
  db: Db,
  privyUserId: string,
): Promise<WaitlistTwitterEngagementProgress> {
  const result = await db.sql`
    SELECT DISTINCT points.source AS source
    FROM points
    INNER JOIN profiles ON profiles.id = points.signup_id
    WHERE profiles.privy_user_id = ${privyUserId}
      AND points.source IN (
        'x_engagement_follow',
        'x_engagement_like',
        'x_engagement_repost',
        'x_engagement_comment'
      );
  `
  const progress = emptyProgress()
  for (const row of result.rows ?? []) {
    const step = POINT_SOURCE_TO_STEP[String(row?.source ?? '').trim()]
    if (step) progress[step] = true
  }
  return progress
}

export async function awardVerifiedWaitlistTwitterEngagementStep(params: {
  db: Db
  privyUserId: string
  step: WaitlistTwitterEngagementStepId
}): Promise<boolean> {
  const progress = await readWaitlistTwitterEngagementProgressForPrivyUser(params.db, params.privyUserId)
  if (progress[params.step]) return false

  const source = STEP_TO_POINT_SOURCE[params.step]
  const sourceId = stepSourceId(params.step)
  const points = WAITLIST_X_ENGAGEMENT_POINTS[params.step]
  const result = await applyPointEvent({
    db: params.db,
    privyUserId: params.privyUserId,
    eventType: source,
    eventKey: sourceId,
    points,
  })
  return result.awarded
}

async function verifyStepForTwitterActor(params: {
  db: Db
  actor: { id: string | null; username: string | null }
  step: WaitlistTwitterEngagementStepId
}): Promise<boolean> {
  const privyUserId = await resolvePrivyUserIdForTwitterActor(params.db, params.actor)
  if (!privyUserId) return false
  return awardVerifiedWaitlistTwitterEngagementStep({
    db: params.db,
    privyUserId,
    step: params.step,
  })
}

export async function processWaitlistTwitterFollowEvent(
  db: Db,
  event: { source: unknown; target: unknown },
): Promise<boolean> {
  const source = readUserObject(event.source)
  const target = readUserObject(event.target)
  if (target.username?.toLowerCase() !== WAITLIST_X_FOLLOW_HANDLE) return false
  return verifyStepForTwitterActor({ db, actor: source, step: 'follow' })
}

export async function processWaitlistTwitterFavoriteEvent(
  db: Db,
  event: { user: unknown; favorited_status: unknown },
): Promise<boolean> {
  const actor = readUserObject(event.user)
  const tweetId = readTweetId(event.favorited_status)
  if (tweetId !== WAITLIST_X_ENGAGEMENT_TWEET_ID) return false
  return verifyStepForTwitterActor({ db, actor, step: 'like' })
}

export async function processWaitlistTwitterTweetCreateEvent(db: Db, tweet: unknown): Promise<boolean> {
  const record = tweet && typeof tweet === 'object' ? (tweet as Record<string, unknown>) : null
  if (!record) return false

  const actor = readUserObject(record.user)
  const retweetedStatus = record.retweeted_status
  const retweetedId = readTweetId(retweetedStatus)
  if (retweetedId === WAITLIST_X_ENGAGEMENT_TWEET_ID) {
    return verifyStepForTwitterActor({ db, actor, step: 'retweet' })
  }

  const replyTo =
    normalizeTwitterUserId(record.in_reply_to_status_id_str) ??
    normalizeTwitterUserId(record.in_reply_to_status_id)
  if (replyTo === WAITLIST_X_ENGAGEMENT_TWEET_ID) {
    return verifyStepForTwitterActor({ db, actor, step: 'comment' })
  }

  return false
}

export async function handleWaitlistTwitterAccountActivityPayload(db: Db, payload: unknown): Promise<void> {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  if (!record) return

  const followEvents = Array.isArray(record.follow_events) ? record.follow_events : []
  for (const event of followEvents) {
    if (!event || typeof event !== 'object') continue
    await processWaitlistTwitterFollowEvent(db, event as { source: unknown; target: unknown })
  }

  const favoriteEvents = Array.isArray(record.favorite_events) ? record.favorite_events : []
  for (const event of favoriteEvents) {
    if (!event || typeof event !== 'object') continue
    await processWaitlistTwitterFavoriteEvent(db, event as { user: unknown; favorited_status: unknown })
  }

  const tweetCreateEvents = Array.isArray(record.tweet_create_events) ? record.tweet_create_events : []
  for (const event of tweetCreateEvents) {
    await processWaitlistTwitterTweetCreateEvent(db, event)
  }
}
