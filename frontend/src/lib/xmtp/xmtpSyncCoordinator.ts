import type { ConversationsApiLike } from '@/lib/xmtp/xmtpHelpers'
import { GROUP_MEMBERSHIP_CONSENT_SYNC_STATES, isXmtpRateLimitError } from '@/lib/xmtp/xmtpHelpers'

export const XMTP_MIN_SYNC_INTERVAL_MS = 10_000
export const XMTP_RATE_LIMIT_BACKOFF_MS = 90_000

let syncInFlight: Promise<void> | null = null
let lastSyncCompletedAt = 0
let rateLimitedUntil = 0
let preferLightweightSyncUntil = 0

export function markXmtpRateLimited(backoffMs = XMTP_RATE_LIMIT_BACKOFF_MS): void {
  const now = Date.now()
  rateLimitedUntil = now + backoffMs
  preferLightweightSyncUntil = rateLimitedUntil + backoffMs
}

export function xmtpSyncBlockedRemainingMs(): number {
  const now = Date.now()
  return Math.max(
    0,
    rateLimitedUntil - now,
    lastSyncCompletedAt + XMTP_MIN_SYNC_INTERVAL_MS - now,
  )
}

export function resetXmtpSyncCoordinatorForTests(): void {
  syncInFlight = null
  lastSyncCompletedAt = 0
  rateLimitedUntil = 0
  preferLightweightSyncUntil = 0
}

async function runSync(
  conversationsApi: ConversationsApiLike,
  mode: 'full' | 'light',
): Promise<void> {
  if (mode === 'light') {
    await conversationsApi.sync()
    return
  }

  if (typeof conversationsApi.syncAll === 'function') {
    try {
      await conversationsApi.syncAll([...GROUP_MEMBERSHIP_CONSENT_SYNC_STATES])
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isXmtpRateLimitError(message)) {
        markXmtpRateLimited()
        throw error
      }
      // fall through to lightweight sync
    }
  }

  await conversationsApi.sync()
}

export type CoordinatedSyncResult = 'synced' | 'skipped_cooldown' | 'skipped_in_flight'

export async function coordinatedConversationSync(
  conversationsApi: ConversationsApiLike,
  options?: { force?: boolean; lightweight?: boolean },
): Promise<CoordinatedSyncResult> {
  const now = Date.now()
  if (!options?.force && now < rateLimitedUntil) {
    return 'skipped_cooldown'
  }
  if (!options?.force && now - lastSyncCompletedAt < XMTP_MIN_SYNC_INTERVAL_MS) {
    return 'skipped_cooldown'
  }

  if (syncInFlight) {
    await syncInFlight.catch(() => undefined)
    return 'skipped_in_flight'
  }

  const mode: 'full' | 'light' =
    options?.lightweight || now < preferLightweightSyncUntil ? 'light' : 'full'

  syncInFlight = (async () => {
    try {
      await runSync(conversationsApi, mode)
      lastSyncCompletedAt = Date.now()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isXmtpRateLimitError(message)) {
        markXmtpRateLimited()
      }
      throw error
    } finally {
      syncInFlight = null
    }
  })()

  await syncInFlight
  return 'synced'
}
