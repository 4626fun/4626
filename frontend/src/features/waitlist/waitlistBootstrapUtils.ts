export const RECOVERY_REQUIRED_MESSAGE =
  'This email is already on 4626. Tap Use existing account and sign in with the same email you used before.'
export const RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE =
  'This Privy session does not match your existing 4626 account. Tap Use existing account to sign in with the email you used before.'
export const SESSION_MISMATCH_MESSAGE = 'Signed in as a different account. Tap Continue to try again.'
export const SESSION_FINALIZING_RETRY_MESSAGE =
  'Finishing sign-in… this usually takes a few seconds.'
export const STALE_PRIVY_SESSION_MESSAGE =
  'Sign-in session expired. Tap Use existing account to sign in again with email.'
export const WAITLIST_STALE_SESSION_RESET_MESSAGE =
  'Your previous sign-in session expired and was reset. Tap Continue with email to sign in again.'

export const FLOW_TIMEOUT_MS = 20_000
export const PRIVY_TOKEN_READ_TIMEOUT_MS = 4_000
export const TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS = 2_500
export const RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS = 15_000
export const FINALIZING_BACKGROUND_RETRY_MS = 1100
export const FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS = 8
export const PRIVY_LOGOUT_SETTLE_ATTEMPTS = 10
export const PRIVY_LOGOUT_SETTLE_DELAY_MS = 150

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(t))
  })
}

export function getWaitlistNetworkUnstableMessage(): string {
  return '4626 could not reach the server. Stay on this page and tap Continue again in a few seconds.'
}

export function isTransientWaitlistNetworkError(error: unknown): boolean {
  const text =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown })?.message === 'string'
        ? String((error as { message: string }).message)
        : ''
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized === 'failed to fetch' ||
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('networkerror') ||
    normalized.includes('network error') ||
    normalized.includes('load failed') ||
    normalized.includes('blocked by cors') ||
    normalized.includes('err_connection_refused') ||
    normalized.includes('err_network_changed') ||
    (normalized.includes('access-control-allow-origin') && normalized.includes('privy')) ||
    normalized.includes('email verification is unavailable in this client')
  )
}

export function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
}

export function isSessionFinalizingError(error: unknown): boolean {
  const text =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : typeof error === 'string'
        ? error
        : ''
  const normalized = text.toLowerCase()
  return (
    normalized.includes('session is still finalizing') ||
    normalized.includes('finishing sign-in')
  )
}

export async function runPrivyLoginWithTimeout(
  login: (options?: unknown) => Promise<unknown>,
  options: unknown,
): Promise<void> {
  await withTimeout(Promise.resolve().then(() => login(options)), FLOW_TIMEOUT_MS, 'Sign-in')
}

export function isPrivyLoginBootstrapError(error: unknown): boolean {
  return isTransientWaitlistNetworkError(error)
}

export function getSignInNetworkUnstableMessage(): string {
  return getWaitlistNetworkUnstableMessage()
}

export function isStalePrivyTokenError(error: unknown): boolean {
  const text =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : typeof error === 'string'
        ? error
        : ''
  const normalized = text.toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('missing privy auth token') ||
    normalized.includes('invalid privy auth token') ||
    normalized.includes('missing_or_invalid_token') ||
    normalized.includes('privy verification failed') ||
    normalized.includes('session expired')
  )
}

export function isWalletProviderCollisionError(error: unknown): boolean {
  const text =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown })?.message === 'string'
        ? String((error as { message: string }).message)
        : ''
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('cannot set property ethereum of #<window> which has only a getter') ||
    normalized.includes('cannot redefine property: ethereum') ||
    normalized.includes('wallet proxy not initialized')
  )
}

export function getWalletProviderCollisionMessage(): string {
  return 'A browser wallet extension is interfering with sign-in. Disable conflicting wallet extensions, then reload and try again.'
}

export function isTimeoutErrorMessage(message: unknown): boolean {
  const text =
    typeof message === 'string'
      ? message
      : typeof (message as { message?: unknown })?.message === 'string'
        ? String((message as { message: string }).message)
        : ''
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  // withTimeout() above rejects with `${label} timed out`.
  return normalized.includes('timed out') || normalized.includes('timeout')
}
