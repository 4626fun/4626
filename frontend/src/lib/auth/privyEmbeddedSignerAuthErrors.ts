/**
 * Privy embedded-wallet signer auth failures that a session refresh
 * (access-token re-read + active-wallet/provider re-acquire) can plausibly fix.
 */
export function isPrivyEmbeddedSignerAuthError(message: string): boolean {
  const m = String(message ?? '').trim().toLowerCase()
  if (!m) return false
  return (
    m.includes('missing auth token') ||
    m.includes('auth token missing') ||
    m.includes('not authenticated') ||
    m.includes('authentication required') ||
    m.includes('no valid authorization signatures') ||
    (m.includes('authorization signatures') && (m.includes('401') || m.includes('unauthorized'))) ||
    (m.includes('unknownrpcerror') && m.includes('auth token')) ||
    (m.includes('signer') && m.includes('auth token')) ||
    (m.includes('embedded wallet') && m.includes('auth')) ||
    m.includes('privy wallet secp256k1_sign failed (401)') ||
    (m.includes('401') && m.includes('privy wallet secp256k1_sign')) ||
    (m.includes('privy') && m.includes('missing auth'))
  )
}

/** Swap/deploy surfaces: user should sign out and sign in again interactively. */
export function isSigningSessionRecoveryRequired(message: string): boolean {
  const m = String(message ?? '').trim()
  if (!m) return false
  if (isPrivyEmbeddedSignerAuthError(m)) return true
  if (/signing session (was refreshed but|could not be refreshed)/i.test(m)) return true
  if (/privy session expired/i.test(m)) return true
  return false
}
