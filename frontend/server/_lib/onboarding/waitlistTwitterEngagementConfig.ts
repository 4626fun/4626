export type WaitlistTwitterEngagementStepId = 'follow' | 'like' | 'retweet' | 'comment'

export const WAITLIST_X_FOLLOW_HANDLE = '4626fun'

/** Full quest chain once a campaign tweet is configured (like omitted — not verifiable on app-only bearer). */
export const WAITLIST_X_ENGAGEMENT_ALL_STEPS: readonly WaitlistTwitterEngagementStepId[] = [
  'follow',
  'retweet',
  'comment',
] as const

const FOLLOW_ONLY_STEPS: readonly WaitlistTwitterEngagementStepId[] = ['follow'] as const

/** Extract a numeric tweet id from an x.com / twitter.com status URL. */
export function parseWaitlistEngagementTweetIdFromUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    if (host !== 'x.com' && host !== 'twitter.com' && !host.endsWith('.x.com') && !host.endsWith('.twitter.com')) {
      return null
    }
    const match = parsed.pathname.match(/\/status\/(\d+)/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function readWaitlistXEngagementTweetUrl(): string | null {
  const url = String(process.env.WAITLIST_X_ENGAGEMENT_TWEET_URL ?? '').trim()
  return url.length > 0 ? url : null
}

/** Campaign tweet id from env. When unset, repost/comment steps stay disabled. */
export function readWaitlistXEngagementTweetId(): string | null {
  const rawId = String(process.env.WAITLIST_X_ENGAGEMENT_TWEET_ID ?? '').trim()
  if (/^\d+$/.test(rawId)) return rawId
  const url = readWaitlistXEngagementTweetUrl()
  if (!url) return null
  return parseWaitlistEngagementTweetIdFromUrl(url)
}

/** Active quest steps: follow-only until a campaign tweet is configured. */
export function readWaitlistXEngagementStepOrder(): readonly WaitlistTwitterEngagementStepId[] {
  return readWaitlistXEngagementTweetId() ? WAITLIST_X_ENGAGEMENT_ALL_STEPS : FOLLOW_ONLY_STEPS
}

export function readWaitlistXEngagementCampaignKey(): string {
  const tweetId = readWaitlistXEngagementTweetId()
  return tweetId ? `${WAITLIST_X_FOLLOW_HANDLE}:${tweetId}` : `${WAITLIST_X_FOLLOW_HANDLE}:follow-only`
}

export function isWaitlistXEngagementStepActive(step: WaitlistTwitterEngagementStepId): boolean {
  return readWaitlistXEngagementStepOrder().includes(step)
}
