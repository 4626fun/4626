export const RECOVERY_REQUIRED_MESSAGE =
  'This email is already on 4626. Tap Use existing account and sign in with the same email you used before.'
export const RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE =
  'This Privy session does not match your existing 4626 account. Tap Use existing account to sign in with the email you used before.'
export const SESSION_MISMATCH_MESSAGE = 'Signed in as a different account. Tap Continue to try again.'
export const SESSION_FINALIZING_RETRY_MESSAGE =
  'Finishing sign-in… this usually takes a few seconds.'
export const STALE_PRIVY_SESSION_MESSAGE =
  'Sign-in session expired. Tap Use existing account to sign in again with email.'

export const FLOW_TIMEOUT_MS = 20_000
export const TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS = 2_500
export const RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS = 15_000
export const FINALIZING_BACKGROUND_RETRY_MS = 900
export const FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS = 5
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
