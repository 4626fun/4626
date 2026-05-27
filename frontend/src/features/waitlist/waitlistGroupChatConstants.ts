/** Backoff schedule (ms) for resolving the waitlist group after server join completes. */
export const WAITLIST_GROUP_SYNC_BACKOFF_MS = [0, 4_000, 10_000, 20_000] as const

/** @deprecated Use WAITLIST_GROUP_SYNC_BACKOFF_MS */
export const WAITLIST_GROUP_SYNC_DELAY_MS = WAITLIST_GROUP_SYNC_BACKOFF_MS[0]

/** Timeout for POST /api/waitlist/xmtp-join. */
export const WAITLIST_JOIN_REQUEST_TIMEOUT_MS = 30_000
