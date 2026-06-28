export type WaitlistTwitterEngagementStepId = 'follow' | 'like' | 'retweet' | 'comment'

export const WAITLIST_X_ENGAGEMENT_STEPS: readonly WaitlistTwitterEngagementStepId[] = [
  'follow',
  'like',
  'retweet',
  'comment',
] as const

export const WAITLIST_X_ENGAGEMENT_COMMENT =
  'a good project and strong team in a predictable and transparent roadmap, planned and projected, i think in the near future we will see an unprecedented growth of this project'

/** Waitlist X account users follow before like/repost/comment steps. */
export const WAITLIST_X_FOLLOW_HANDLE = '4626fun'

/** Campaign post for like → repost → comment steps on /waitlist. */
export const WAITLIST_X_ENGAGEMENT_TWEET_URL =
  'https://x.com/wenakita/status/2031118597704265790'

const STORAGE_PREFIX = 'cv:waitlist-x-engagement'

export type WaitlistTwitterEngagementProgress = Record<WaitlistTwitterEngagementStepId, boolean>

function emptyProgress(): WaitlistTwitterEngagementProgress {
  return { follow: false, like: false, retweet: false, comment: false }
}

export function resolveWaitlistTwitterFollowHandle(): string {
  return WAITLIST_X_FOLLOW_HANDLE
}

export function resolveWaitlistTwitterEngagementTweetUrl(): string {
  return WAITLIST_X_ENGAGEMENT_TWEET_URL
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

export function resolveWaitlistTwitterEngagementTweetId(): string {
  const id = parseTweetIdFromUrl(WAITLIST_X_ENGAGEMENT_TWEET_URL)
  if (!id) throw new Error('waitlist_twitter_engagement_tweet_url_invalid')
  return id
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

export function readWaitlistTwitterEngagementStorageKey(scopeId: string | null | undefined): string {
  const scope = String(scopeId ?? '').trim() || 'anonymous'
  const followHandle = resolveWaitlistTwitterFollowHandle()
  const tweetId = resolveWaitlistTwitterEngagementTweetId()
  return `${STORAGE_PREFIX}:${scope}:${followHandle}:${tweetId}`
}

export function readWaitlistTwitterEngagementProgress(
  scopeId: string | null | undefined,
): WaitlistTwitterEngagementProgress {
  if (typeof localStorage === 'undefined') return emptyProgress()
  try {
    const raw = localStorage.getItem(readWaitlistTwitterEngagementStorageKey(scopeId))
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<WaitlistTwitterEngagementProgress>
    return {
      follow: parsed.follow === true,
      like: parsed.like === true,
      retweet: parsed.retweet === true,
      comment: parsed.comment === true,
    }
  } catch {
    return emptyProgress()
  }
}

export function writeWaitlistTwitterEngagementProgress(
  scopeId: string | null | undefined,
  progress: WaitlistTwitterEngagementProgress,
): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(readWaitlistTwitterEngagementStorageKey(scopeId), JSON.stringify(progress))
  } catch {
    // ignore quota / private mode
  }
}

export function markWaitlistTwitterEngagementStepComplete(
  scopeId: string | null | undefined,
  step: WaitlistTwitterEngagementStepId,
): WaitlistTwitterEngagementProgress {
  const next = { ...readWaitlistTwitterEngagementProgress(scopeId), [step]: true }
  writeWaitlistTwitterEngagementProgress(scopeId, next)
  return next
}

export function resolveActiveWaitlistTwitterEngagementStep(
  progress: WaitlistTwitterEngagementProgress,
): WaitlistTwitterEngagementStepId | 'complete' {
  for (const step of WAITLIST_X_ENGAGEMENT_STEPS) {
    if (!progress[step]) return step
  }
  return 'complete'
}

export function waitlistTwitterEngagementStepIndex(step: WaitlistTwitterEngagementStepId): number {
  return WAITLIST_X_ENGAGEMENT_STEPS.indexOf(step)
}

export const WAITLIST_X_ENGAGEMENT_STEP_COPY: Record<
  WaitlistTwitterEngagementStepId,
  { title: string; description: string; actionLabel: string; doneLabel: string }
> = {
  follow: {
    title: 'Follow us on X',
    description: 'Follow our X account first. Come back here when you are done.',
    actionLabel: 'Open on X to follow',
    doneLabel: 'I followed',
  },
  like: {
    title: 'Like our post',
    description: 'Open the post on X and tap Like. Come back here when you are done.',
    actionLabel: 'Open on X to like',
    doneLabel: 'I liked the post',
  },
  retweet: {
    title: 'Retweet',
    description: 'Share the post with your followers. We will show the comment step next.',
    actionLabel: 'Open on X to repost',
    doneLabel: 'I reposted',
  },
  comment: {
    title: 'Leave a comment',
    description: 'We pre-filled a comment for you — review it on X, then post.',
    actionLabel: 'Open comment on X',
    doneLabel: 'I posted my comment',
  },
}

export function resolveWaitlistTwitterEngagementStepCopy(
  step: WaitlistTwitterEngagementStepId,
): { title: string; description: string; actionLabel: string; doneLabel: string } {
  if (step === 'follow') {
    const handle = resolveWaitlistTwitterFollowHandle()
    return {
      title: `Follow @${handle}`,
      description: `Follow @${handle} on X first. Come back here when you are done.`,
      actionLabel: `Open @${handle} on X`,
      doneLabel: `I followed @${handle}`,
    }
  }
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
