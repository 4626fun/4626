import { logger } from '../_lib/infra/logger.js'

type AccountActivityPayload = {
  follow_events?: unknown[]
  favorite_events?: unknown[]
  tweet_create_events?: unknown[]
  [key: string]: unknown
}

export function summarizeAccountActivityPayload(payload: AccountActivityPayload | null | undefined): {
  followEvents: number
  favoriteEvents: number
  tweetCreateEvents: number
} {
  const record = payload && typeof payload === 'object' ? payload : {}
  return {
    followEvents: Array.isArray(record.follow_events) ? record.follow_events.length : 0,
    favoriteEvents: Array.isArray(record.favorite_events) ? record.favorite_events.length : 0,
    tweetCreateEvents: Array.isArray(record.tweet_create_events) ? record.tweet_create_events.length : 0,
  }
}

export async function handleAccountActivityWebhookPayload(payload: unknown): Promise<void> {
  const record = payload && typeof payload === 'object' ? (payload as AccountActivityPayload) : null
  const summary = summarizeAccountActivityPayload(record)
  if (summary.followEvents + summary.favoriteEvents + summary.tweetCreateEvents === 0) {
    logger.info('[x/account-activity] webhook received with no engagement events', summary)
    return
  }
  logger.info('[x/account-activity] webhook engagement events', summary)
  // Waitlist step verification will match Privy-linked X ids to these events in a follow-up.
}
