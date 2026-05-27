export type XmtpConnectPrecheckInput = {
  walletAddress: string | null
  walletClientReady: boolean
  alreadyHasClient: boolean
  connectInFlight: boolean
  resetLocalStateInFlight: boolean
  connectCooldownUntilMs: number
  nowMs: number
  currentOrigin: string
  canonicalAppOrigin: string
  hostname: string
}

export type XmtpConnectPrecheckDenyReason =
  | 'no_wallet'
  | 'reset_in_flight'
  | 'already_connected'
  | 'connect_in_flight'
  | 'cooldown'
  | 'wrong_origin'

export type XmtpConnectPrecheckResult =
  | { allowed: true }
  | { allowed: false; reason: XmtpConnectPrecheckDenyReason; retryInSeconds?: number }

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function isLocalDevHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1'
}

/** Production hosts where browser XMTP installs are intentionally allowed. */
const TRUSTED_MESSAGING_HOSTNAMES = new Set(['4626.fun', 'www.4626.fun', 'app.4626.fun'])

export function isTrustedMessagingHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (isLocalDevHostname(host)) return true
  return TRUSTED_MESSAGING_HOSTNAMES.has(host)
}

export function isCanonicalMessagingOrigin(input: {
  currentOrigin: string
  canonicalAppOrigin: string
  hostname: string
}): boolean {
  if (isTrustedMessagingHostname(input.hostname)) return true
  return normalizeOrigin(input.currentOrigin) === normalizeOrigin(input.canonicalAppOrigin)
}

/**
 * Pure preflight gate mirrored at the top of provider.connect().
 * Blocks accidental connect churn on preview hosts, duplicate in-flight work, etc.
 */
export function evaluateXmtpConnectPrecheck(input: XmtpConnectPrecheckInput): XmtpConnectPrecheckResult {
  if (!input.walletAddress || !input.walletClientReady) {
    return { allowed: false, reason: 'no_wallet' }
  }
  if (input.resetLocalStateInFlight) {
    return { allowed: false, reason: 'reset_in_flight' }
  }
  if (input.alreadyHasClient) {
    return { allowed: false, reason: 'already_connected' }
  }
  if (input.connectInFlight) {
    return { allowed: false, reason: 'connect_in_flight' }
  }
  if (input.connectCooldownUntilMs > input.nowMs) {
    const retryInSeconds = Math.max(1, Math.ceil((input.connectCooldownUntilMs - input.nowMs) / 1000))
    return { allowed: false, reason: 'cooldown', retryInSeconds }
  }
  if (
    !isCanonicalMessagingOrigin({
      currentOrigin: input.currentOrigin,
      canonicalAppOrigin: input.canonicalAppOrigin,
      hostname: input.hostname,
    })
  ) {
    return { allowed: false, reason: 'wrong_origin' }
  }
  return { allowed: true }
}

export function buildWrongOriginConnectError(currentOrigin: string, canonicalAppOrigin: string): string {
  const originLabel = currentOrigin.trim() || 'this origin'
  return (
    `Messaging is disabled on ${originLabel} to prevent XMTP installation churn. ` +
    `Open ${normalizeOrigin(canonicalAppOrigin)} to use chat.`
  )
}
