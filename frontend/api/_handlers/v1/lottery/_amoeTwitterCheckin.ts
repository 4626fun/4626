import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'
import { verifyPrivyForAccounts } from '../../../../server/_lib/identity/accountsIdentity.js'
import {
  extractTweetIdFromInput,
  verifyTweetForAmoe,
} from '../../../../server/twitter/verifyTweet.js'

import { claimDailyTwitterCheckin } from '../../../../server/_lib/lottery/lotteryAmoe.js'

type TwitterCheckinBody = {
  tweetUrl?: string
  tweetId?: string
}

function readLinkedTwitterIdentity(privyUser: unknown): {
  usernames: string[]
  userIds: string[]
} {
  const record = privyUser && typeof privyUser === 'object' ? (privyUser as Record<string, unknown>) : null
  const linked = record
    ? [
        ...(Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as any[]) : []),
        ...(Array.isArray(record.linked_accounts) ? (record.linked_accounts as any[]) : []),
      ]
    : []
  const usernames = new Set<string>()
  const userIds = new Set<string>()
  for (const account of linked) {
    const type = String(account?.type ?? '').trim().toLowerCase()
    if (!type.includes('twitter') && type !== 'x') continue
    const username = String(account?.username ?? '').trim().toLowerCase()
    if (username) usernames.add(username.startsWith('@') ? username.slice(1) : username)
    const subject = String(account?.subject ?? '').trim()
    if (subject) userIds.add(subject)
    const userId = String(account?.userId ?? account?.user_id ?? '').trim()
    if (userId) userIds.add(userId)
  }
  return { usernames: [...usernames], userIds: [...userIds] }
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const input = body as TwitterCheckinBody
  const tweetId = extractTweetIdFromInput({
    tweetUrl: typeof input.tweetUrl === 'string' ? input.tweetUrl : null,
    tweetId: typeof input.tweetId === 'string' ? input.tweetId : null,
  })
  if (!tweetId) {
    return res.status(400).json({ success: false, error: 'invalid_tweet_reference' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/twitter-checkin', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-twitter-checkin', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const wallet = g.auth?.address
  if (!wallet) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  let privyContext: Awaited<ReturnType<typeof verifyPrivyForAccounts>>
  try {
    privyContext = await verifyPrivyForAccounts(req)
  } catch {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }
  const twitterIdentity = readLinkedTwitterIdentity(privyContext.privyUser)
  if (twitterIdentity.usernames.length === 0 && twitterIdentity.userIds.length === 0) {
    return res.status(403).json({ success: false, error: 'twitter_not_linked' })
  }

  const resolvedWallet = await resolveAmoeWallet({
    authAddress: wallet,
  })
  if (!resolvedWallet.ok) {
    const status = resolvedWallet.error === 'wallet_authority_mismatch' ? 403 : 400
    return res.status(status).json({
      success: false,
      error: resolvedWallet.error,
    })
  }
  const effectiveWallet = resolvedWallet.value.wallet

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'twitter-checkin', ip, effectiveWallet), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const verifiedTweet = await verifyTweetForAmoe({
      tweetId,
      linkedTwitterUsernames: twitterIdentity.usernames,
      linkedTwitterUserIds: twitterIdentity.userIds,
    })
    const result = await claimDailyTwitterCheckin({
      wallet: effectiveWallet,
      verifiedTweet: {
        tweetId: verifiedTweet.tweetId,
        tweetUrl: verifiedTweet.canonicalUrl,
        authorUsername: verifiedTweet.authorUsername,
        authorId: verifiedTweet.authorId,
      },
    })
    if (!result.awarded) {
      return res.status(409).json({ success: false, error: 'daily_checkin_already_claimed' })
    }
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'amoe_twitter_checkin_failed'
    if (message === 'tweet_not_found' || message === 'tweet_author_mismatch' || message === 'tweet_content_mismatch') {
      return res.status(400).json({ success: false, error: message })
    }
    if (message === 'tweet_already_claimed') {
      return res.status(409).json({ success: false, error: message })
    }
    if (message === 'amoe_requires_verified_privy_account') {
      return res.status(403).json({ success: false, error: message })
    }
    if (message === 'twitter_verification_unavailable') {
      return res.status(503).json({ success: false, error: message })
    }
    return res.status(500).json({ success: false, error: message })
  }
}
