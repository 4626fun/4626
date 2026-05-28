export const RECOVERY_REQUIRED_MESSAGE =
  'This email already has a 4626 account. Use existing account sign-in to continue.'
export const SESSION_MISMATCH_MESSAGE = 'Signed in as a different account. Tap Continue to try again.'
export const SESSION_FINALIZING_RETRY_MESSAGE =
  'Sign-in session is still finalizing. We will keep retrying automatically.'
export const STALE_PRIVY_SESSION_MESSAGE =
  'Sign-in got stuck in an old session. Tap Continue to retry with a fresh email sign-in.'

export const FLOW_TIMEOUT_MS = 20_000
export const TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS = 2_500
export const RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS = 15_000
export const FINALIZING_BACKGROUND_RETRY_MS = 1_500
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
  return text.toLowerCase().includes('session is still finalizing')
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
