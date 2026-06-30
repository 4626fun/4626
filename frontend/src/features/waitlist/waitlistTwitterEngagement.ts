export type WaitlistTwitterEngagementStepId = 'follow' | 'like' | 'retweet' | 'comment'

/** Full quest chain once the server has a campaign tweet configured (no Like — not verifiable on app-only bearer). */
export const WAITLIST_X_ENGAGEMENT_ALL_STEPS: readonly WaitlistTwitterEngagementStepId[] = [
  'follow',
  'retweet',
  'comment',
] as const

/** Default until the API reports a configured campaign tweet. */
export const WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS: readonly WaitlistTwitterEngagementStepId[] = ['follow'] as const

export const WAITLIST_X_ENGAGEMENT_COMMENT =
  'a good project and strong team in a predictable and transparent roadmap, planned and projected, i think in the near future we will see an unprecedented growth of this project'

/**
 * Per-step XP reward shown in the quest UI. Mirrors the server-side
 * `WAITLIST_X_ENGAGEMENT_POINTS` in
 * `frontend/server/_lib/onboarding/waitlistTwitterEngagementServer.ts` so the
 * gamified reward badges match the points actually awarded on verification.
 */
export const WAITLIST_X_ENGAGEMENT_STEP_POINTS: Record<WaitlistTwitterEngagementStepId, number> = {
  follow: 4,
  like: 4,
  retweet: 4,
  comment: 4,
}

/** Waitlist X account users follow before repost/comment steps. */
export const WAITLIST_X_FOLLOW_HANDLE = '4626fun'

export type WaitlistTwitterEngagementProgress = Record<WaitlistTwitterEngagementStepId, boolean>

export function emptyWaitlistTwitterEngagementProgress(): WaitlistTwitterEngagementProgress {
  return { follow: false, like: false, retweet: false, comment: false }
}

export function resolveWaitlistTwitterFollowHandle(): string {
  return WAITLIST_X_FOLLOW_HANDLE
}

/** Extract a numeric tweet id from an x.com / twitter.com status URL. */
export function parseTweetIdFromUrl(input: string): string | null {
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

export function buildWaitlistTwitterFollowIntentUrl(screenName: string): string {
  const handle = screenName.trim().replace(/^@/, '')
  return `https://twitter.com/intent/follow?${new URLSearchParams({ screen_name: handle }).toString()}`
}

export function buildWaitlistTwitterProfileUrl(screenName: string): string {
  const handle = screenName.trim().replace(/^@/, '')
  return `https://x.com/${handle}`
}

export function buildWaitlistTwitterLikeIntentUrl(tweetId: string): string {
  return `https://twitter.com/intent/like?${new URLSearchParams({ tweet_id: tweetId }).toString()}`
}

export function buildWaitlistTwitterRetweetIntentUrl(tweetId: string): string {
  return `https://twitter.com/intent/retweet?${new URLSearchParams({ tweet_id: tweetId }).toString()}`
}

export function buildWaitlistTwitterCommentIntentUrl(tweetId: string, text: string): string {
  return `https://twitter.com/intent/tweet?${new URLSearchParams({
    in_reply_to: tweetId,
    text,
  }).toString()}`
}

export function buildWaitlistTwitterStatusUrl(tweetId: string): string {
  return `https://x.com/i/status/${tweetId}`
}

export function resolveActiveWaitlistTwitterEngagementStep(
  progress: WaitlistTwitterEngagementProgress,
  steps: readonly WaitlistTwitterEngagementStepId[] = WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS,
): WaitlistTwitterEngagementStepId | 'complete' {
  for (const step of steps) {
    if (!progress[step]) return step
  }
  return 'complete'
}

export function waitlistTwitterEngagementStepIndex(
  step: WaitlistTwitterEngagementStepId,
  steps: readonly WaitlistTwitterEngagementStepId[] = WAITLIST_X_ENGAGEMENT_DEFAULT_STEPS,
): number {
  return steps.indexOf(step)
}

export function totalWaitlistTwitterEngagementXp(
  steps: readonly WaitlistTwitterEngagementStepId[],
): number {
  return steps.reduce((sum, step) => sum + WAITLIST_X_ENGAGEMENT_STEP_POINTS[step], 0)
}

export const WAITLIST_X_ENGAGEMENT_STEP_COPY: Record<
  WaitlistTwitterEngagementStepId,
  { title: string; description: string; actionLabel: string; doneLabel: string }
> = {
  follow: {
    title: 'Follow on X',
    description: '',
    actionLabel: 'Follow on X',
    doneLabel: 'Followed',
  },
  like: {
    title: 'Like on X',
    description: '',
    actionLabel: 'Like on X',
    doneLabel: 'Liked',
  },
  retweet: {
    title: 'Repost on X',
    description: '',
    actionLabel: 'Repost on X',
    doneLabel: 'Reposted',
  },
  comment: {
    title: 'Comment on X',
    description: '',
    actionLabel: 'Comment on X',
    doneLabel: 'Commented',
  },
}

export function resolveWaitlistTwitterEngagementStepCopy(
  step: WaitlistTwitterEngagementStepId,
): { title: string; description: string; actionLabel: string; doneLabel: string } {
  return WAITLIST_X_ENGAGEMENT_STEP_COPY[step]
}

export function openWaitlistTwitterIntent(url: string): void {
  if (typeof window === 'undefined') return
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // popup blocked — caller may surface retry
  }
}
