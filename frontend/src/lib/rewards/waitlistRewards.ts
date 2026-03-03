export type WaitlistPoints = {
  total: number
  invite: number
  signup: number
  tasks: number
  csw: number
  social: number
  bonus: number
}

export type WaitlistRank = {
  invite: number | null
  total: number | null
}

export type WaitlistReferrals = {
  qualifiedCount: number
  pendingCount: number
}

export type WaitlistPositionData = {
  profileCompletedAt?: string | null
  referralCode?: string | null
  borderTier?: number | null
  points?: Partial<WaitlistPoints> | null
  rank?: Partial<WaitlistRank> | null
  referrals?: Partial<WaitlistReferrals> | null
}

export type WaitlistRewards = {
  pointsBalance: number
  tier: number
  tierLabel: string
  badgeEarned: boolean
  rankTotal: number | null
  referralRef: string | null
  referralUrl: string
}

export type RewardTaskStatus = 'locked' | 'available' | 'completed'

export type RewardTask = {
  key: 'complete_profile' | 'connect_x' | 'verify_email' | 'refer_friend' | 'join_discord'
  title: string
  points: number
  status: RewardTaskStatus
  ctaLabel: string
  href: string
}

const DEFAULT_REFERRAL_BASE_URL = 'https://4626.fun'

function toPositiveInt(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.floor(numeric)
}

function sanitizeHandle(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw
  const cleaned = withoutAt.replace(/[^a-zA-Z0-9_.-]/g, '')
  return cleaned.length > 0 ? cleaned : null
}

function sanitizeReferralCode(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned.length > 0 ? cleaned : null
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const raw = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  if (!raw) return DEFAULT_REFERRAL_BASE_URL
  return raw.replace(/\/+$/, '')
}

export function buildReferralUrl(input: {
  handle?: string | null
  referralCode?: string | null
  baseUrl?: string
}): { referralRef: string | null; referralUrl: string } {
  const handle = sanitizeHandle(input.handle)
  const referralCode = sanitizeReferralCode(input.referralCode)
  // TODO(rewards): promote handle aliases to backend referral lookup once supported.
  const referralRef = handle ?? referralCode ?? null
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!referralRef) {
    return { referralRef: null, referralUrl: `${baseUrl}/` }
  }
  return {
    referralRef,
    referralUrl: `${baseUrl}/?ref=${encodeURIComponent(referralRef)}`,
  }
}

export function deriveWaitlistRewards(input: {
  position: WaitlistPositionData | null | undefined
  fallbackBorderTier?: number | null
  handle?: string | null
  referralCode?: string | null
  referralBaseUrl?: string
}): WaitlistRewards {
  const position = input.position ?? null
  const tierFromPosition = toPositiveInt(position?.borderTier)
  const fallbackTier = toPositiveInt(input.fallbackBorderTier)
  const tier = tierFromPosition > 0 ? tierFromPosition : fallbackTier
  const tierLabel = `Tier ${tier > 0 ? tier : 1}`
  const pointsBalance = toPositiveInt(position?.points?.total)
  const rankTotal = typeof position?.rank?.total === 'number' && Number.isFinite(position.rank.total) ? position.rank.total : null
  const badgeEarned = tier > 0

  const referral = buildReferralUrl({
    handle: input.handle,
    referralCode: input.referralCode ?? position?.referralCode ?? null,
    baseUrl: input.referralBaseUrl,
  })

  return {
    pointsBalance,
    tier,
    tierLabel,
    badgeEarned,
    rankTotal,
    referralRef: referral.referralRef,
    referralUrl: referral.referralUrl,
  }
}

export function buildSettingsTasks(input: {
  profileCompleted: boolean
  xVerified: boolean
  emailVerified: boolean
  hasReferralRef: boolean
  hasQualifiedReferrals: boolean
}): RewardTask[] {
  const completeProfileStatus: RewardTaskStatus = input.profileCompleted ? 'completed' : 'available'
  const connectXStatus: RewardTaskStatus = input.xVerified
    ? 'completed'
    : input.profileCompleted
      ? 'available'
      : 'locked'
  const verifyEmailStatus: RewardTaskStatus = input.emailVerified ? 'completed' : 'available'
  const referFriendStatus: RewardTaskStatus = input.hasQualifiedReferrals
    ? 'completed'
    : input.hasReferralRef
      ? 'available'
      : 'locked'
  const joinDiscordStatus: RewardTaskStatus = input.profileCompleted ? 'available' : 'locked'

  return [
    {
      key: 'complete_profile',
      title: 'Complete profile',
      points: 150,
      status: completeProfileStatus,
      ctaLabel: completeProfileStatus === 'completed' ? 'Completed' : 'Open waitlist',
      href: '/waitlist#waitlist',
    },
    {
      key: 'connect_x',
      title: 'Connect Twitter/X',
      points: 100,
      status: connectXStatus,
      ctaLabel: connectXStatus === 'completed' ? 'Completed' : 'Verify on waitlist',
      href: '/waitlist#waitlist',
    },
    {
      key: 'verify_email',
      title: 'Verify email',
      points: 50,
      status: verifyEmailStatus,
      ctaLabel: verifyEmailStatus === 'completed' ? 'Completed' : 'Update email',
      href: '#account-email',
    },
    {
      key: 'refer_friend',
      title: 'Refer a friend',
      points: 200,
      status: referFriendStatus,
      ctaLabel: referFriendStatus === 'completed' ? 'Completed' : 'Copy referral link',
      href: '#account-points-tasks',
    },
    {
      key: 'join_discord',
      title: 'Join Discord',
      points: 100,
      status: joinDiscordStatus,
      ctaLabel: joinDiscordStatus === 'locked' ? 'Complete profile first' : 'Join Discord',
      href: 'https://discord.gg/4626',
    },
  ]
}
