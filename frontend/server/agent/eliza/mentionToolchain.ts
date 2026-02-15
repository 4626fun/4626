import { lookupWaitlistByFid } from '../../_lib/waitlistLookup.js'

function isWaitlistIntent(text: string): boolean {
  const lc = text.toLowerCase()
  return lc.includes('waitlist') || lc.includes('early access') || lc.includes('access')
}

export async function resolveMentionThroughElizaToolchain(params: {
  castText: string
  authorUsername: string
  authorFid: number | null
}): Promise<string | null> {
  if (!isWaitlistIntent(params.castText)) return null
  if (!params.authorFid || !Number.isFinite(params.authorFid) || params.authorFid <= 0) {
    return `Hey @${params.authorUsername}! I can check waitlist status if your cast includes a valid Farcaster identity. You can also join directly at https://4626.fun/waitlist`
  }

  const status = await lookupWaitlistByFid(params.authorFid)
  if (!status.found) {
    return `Hey @${params.authorUsername}! I couldn’t find a waitlist entry tied to your FID yet. Join here and I’ll track it: https://4626.fun/waitlist`
  }

  const label = (status.appAccessStatus ?? 'pending').toLowerCase()
  const readable =
    label === 'approved'
      ? 'approved ✅'
      : label === 'denied'
        ? 'not approved yet'
        : 'pending review'

  return `Hey @${params.authorUsername}! I checked your waitlist status via Keepr tools: ${readable}. ${
    status.joinedAt ? `Joined: ${status.joinedAt.slice(0, 10)}. ` : ''
  }Manage profile: https://4626.fun/waitlist`
}
