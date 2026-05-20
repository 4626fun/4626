import { logger } from '../_lib/infra/logger.js'
import { readTwitterBearerToken } from './twitterEnv.js'

export type VerifiedTweet = {
  tweetId: string
  canonicalUrl: string
  text: string
  authorId: string | null
  authorUsername: string | null
}

export function extractTweetIdFromInput(params: {
  tweetUrl?: string | null
  tweetId?: string | null
}): string | null {
  const direct = String(params.tweetId ?? '').trim()
  if (/^\d{8,32}$/.test(direct)) return direct

  const rawUrl = String(params.tweetUrl ?? '').trim()
  if (!rawUrl) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  if (host !== 'x.com' && host !== 'www.x.com' && host !== 'twitter.com' && host !== 'www.twitter.com') {
    return null
  }
  const match = parsed.pathname.match(/\/status\/(\d{8,32})(?:\/|$)/i)
  if (!match) return null
  return match[1] ?? null
}

function hasRequiredAmoeMarkers(tweetText: string): boolean {
  const lower = tweetText.toLowerCase()
  return (
    lower.includes('4626') &&
    lower.includes('alternative method of entry') &&
    lower.includes('no purchase necessary')
  )
}

function hasRequiredLink(text: string, expandedUrls: string[]): boolean {
  if (text.toLowerCase().includes('4626.fun')) return true
  return expandedUrls.some((url) => url.toLowerCase().includes('4626.fun'))
}

export async function verifyTweetForAmoe(params: {
  tweetId: string
  linkedTwitterUsernames: string[]
  linkedTwitterUserIds: string[]
}): Promise<VerifiedTweet> {
  const bearer = readTwitterBearerToken()
  if (!bearer) {
    throw new Error('twitter_verification_unavailable')
  }
  const tweetId = params.tweetId
  const url = new URL(`https://api.twitter.com/2/tweets/${tweetId}`)
  url.searchParams.set('expansions', 'author_id')
  url.searchParams.set('tweet.fields', 'text,author_id,entities')
  url.searchParams.set('user.fields', 'username')

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('[amoe/twitter-verify] network error', error)
    throw new Error('twitter_verification_unavailable')
  }

  const bodyText = await response.text()
  let payload: any = null
  try {
    payload = bodyText ? JSON.parse(bodyText) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error('tweet_not_found')
    logger.warn('[amoe/twitter-verify] non-ok response', {
      status: response.status,
      body: bodyText.slice(0, 300),
    })
    throw new Error('twitter_verification_unavailable')
  }

  const tweet = payload?.data
  if (!tweet || typeof tweet !== 'object') throw new Error('tweet_not_found')

  const tweetText = typeof tweet.text === 'string' ? tweet.text : ''
  if (!tweetText.trim()) throw new Error('tweet_not_found')

  const authorId = typeof tweet.author_id === 'string' ? tweet.author_id : null
  const includedUsers: any[] = Array.isArray(payload?.includes?.users) ? payload.includes.users : []
  const authorUser = includedUsers.find((user) => typeof user?.id === 'string' && user.id === authorId)
  const authorUsername =
    typeof authorUser?.username === 'string'
      ? authorUser.username.toLowerCase()
      : null

  const normalizedLinkedNames = new Set(
    params.linkedTwitterUsernames.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
  )
  const normalizedLinkedIds = new Set(
    params.linkedTwitterUserIds.map((value) => value.trim()).filter((value) => value.length > 0),
  )
  const authorMatches =
    (authorUsername !== null && normalizedLinkedNames.has(authorUsername)) ||
    (authorId !== null && normalizedLinkedIds.has(authorId))
  if (!authorMatches) {
    throw new Error('tweet_author_mismatch')
  }

  const urls = Array.isArray(tweet?.entities?.urls) ? tweet.entities.urls : []
  const expandedUrls: string[] = urls
    .map((entry: any) => {
      if (typeof entry?.expanded_url === 'string') return entry.expanded_url
      if (typeof entry?.url === 'string') return entry.url
      return null
    })
    .filter((value: string | null): value is string => value !== null)

  if (!hasRequiredAmoeMarkers(tweetText) || !hasRequiredLink(tweetText, expandedUrls)) {
    throw new Error('tweet_content_mismatch')
  }

  return {
    tweetId,
    canonicalUrl: `https://x.com/i/web/status/${tweetId}`,
    text: tweetText,
    authorId,
    authorUsername,
  }
}

