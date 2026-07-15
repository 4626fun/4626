import type { AlfaClubChatTokenMeta } from '../../_lib/alfaclub/chatTokenStore.js'

export type TokenExpiryHealthMetadata = {
  chatJwtExpiresAt: string | null
  accessTokenExpiresAt: string | null
  lastSuccessfulTokenRefreshAt: string | null
}

type TokenExpiryHealthState = TokenExpiryHealthMetadata

type TokenExpiryHealthRefresherOptions = {
  readChatMeta: () => Promise<AlfaClubChatTokenMeta>
  readAccessMeta: () => Promise<AlfaClubChatTokenMeta>
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TOKEN_EXPIRY_HEALTH_TTL_MS = 5_000
const EMPTY_TOKEN_META: AlfaClubChatTokenMeta = {
  hasToken: false,
  updatedAt: null,
  expiresAt: null,
  updatedBy: null,
  isExpired: null,
}

export function createTokenExpiryHealthRefresher(
  options: TokenExpiryHealthRefresherOptions,
): () => Promise<TokenExpiryHealthMetadata> {
  const ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_TOKEN_EXPIRY_HEALTH_TTL_MS)
  const now = options.now ?? Date.now
  let cached: TokenExpiryHealthMetadata | null = null
  let cachedAtMs = 0
  let inFlight: Promise<TokenExpiryHealthMetadata> | null = null

  return () => {
    const nowMs = now()
    if (cached && nowMs - cachedAtMs < ttlMs) return Promise.resolve(cached)
    if (inFlight) return inFlight

    const pending = Promise.all([
      options.readChatMeta().catch(() => EMPTY_TOKEN_META),
      options.readAccessMeta().catch(() => EMPTY_TOKEN_META),
    ]).then(([chatToken, accessToken]) => {
      const metadata = {
        chatJwtExpiresAt: chatToken.expiresAt,
        accessTokenExpiresAt: accessToken.expiresAt,
        lastSuccessfulTokenRefreshAt: chatToken.updatedAt,
      }
      cached = metadata
      cachedAtMs = now()
      return metadata
    })
    inFlight = pending
    void pending.finally(() => {
      if (inFlight === pending) inFlight = null
    })
    return pending
  }
}

export function applyTokenExpiryHealthMetadata(
  state: TokenExpiryHealthState,
  metadata: TokenExpiryHealthMetadata,
): void {
  if (metadata.chatJwtExpiresAt) state.chatJwtExpiresAt = metadata.chatJwtExpiresAt
  if (metadata.accessTokenExpiresAt) state.accessTokenExpiresAt = metadata.accessTokenExpiresAt
  if (metadata.lastSuccessfulTokenRefreshAt) {
    state.lastSuccessfulTokenRefreshAt = metadata.lastSuccessfulTokenRefreshAt
  }
}
