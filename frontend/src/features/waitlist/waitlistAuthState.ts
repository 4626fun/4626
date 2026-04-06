import { apiFetch } from '@/lib/apiBase'

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'
const SESSION_TOKEN_CHANGED_EVENT = 'cv-siwe-session-token-change'

export function clearStoredWaitlistSessionToken() {
  let changed = false
  try {
    const previous = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (previous !== null) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
      changed = true
    }
  } catch {
    return
  }

  if (!changed || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT))
}

async function clearServerWaitlistSession(): Promise<void> {
  await apiFetch('/api/auth/logout', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  }).catch(() => undefined)
}

export function isRecoveryRequiredAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const record = error as { status?: unknown; recoveryRequired?: unknown; code?: unknown; message?: unknown }
    const status = typeof record.status === 'number' ? record.status : Number(record.status)
    if (Number.isFinite(status) && status === 409) return true
    if (record.recoveryRequired === true) return true
    const code = typeof record.code === 'string' ? record.code.toLowerCase() : ''
    if (code.includes('recovery_required')) return true
    const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
    if (
      message.includes('recovery required') ||
      message.includes('already linked to another account') ||
      message.includes('recovery_required')
    ) {
      return true
    }
    return false
  }

  const text = typeof error === 'string' ? error.toLowerCase() : ''
  return (
    text.includes('recovery required') ||
    text.includes('already linked to another account') ||
    text.includes('recovery_required')
  )
}

export function isEmailAlreadyLinkedAuthError(error: unknown): boolean {
  const recordMessage =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : ''
  const text = `${recordMessage} ${typeof error === 'string' ? error : ''}`.trim().toLowerCase()
  return (
    text.includes('already has an account of type email linked') ||
    (text.includes('account of type email') && text.includes('linked'))
  )
}

export function isAlreadyLoggedInAuthError(error: unknown): boolean {
  const recordMessage =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : ''
  const text = `${recordMessage} ${typeof error === 'string' ? error : ''}`.trim().toLowerCase()
  return (
    text.includes('attempted to log in, but user is already logged in') ||
    (text.includes('already logged in') && text.includes('link')) ||
    text.includes('use a `link` helper') ||
    text.includes('use a link helper')
  )
}

export function shouldStopWaitlistAutoAuthRetry(params: {
  isSessionMismatch: boolean
  isRecoveryRequired: boolean
}): boolean {
  return params.isSessionMismatch || params.isRecoveryRequired
}

export async function runWaitlistPrivyLogout(params: {
  logout: (() => Promise<void>) | null | undefined
  timeoutMs?: number
  shouldLogout?: boolean
}): Promise<void> {
  clearStoredWaitlistSessionToken()
  const clearServerSessionPromise = clearServerWaitlistSession()
  const logout = params.logout
  const shouldLogout = params.shouldLogout !== false

  const timeoutCandidate = params.timeoutMs
  const timeoutMs =
    typeof timeoutCandidate === 'number' && Number.isFinite(timeoutCandidate)
      ? Math.max(0, Math.floor(timeoutCandidate))
      : 1_500

  const settleWithinTimeout = async (work: Promise<unknown>): Promise<void> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, timeoutMs)
    })
    try {
      await Promise.race([work.then(() => undefined).catch(() => undefined), timeoutPromise])
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  const tasks: Promise<void>[] = [settleWithinTimeout(clearServerSessionPromise)]
  if (shouldLogout && typeof logout === 'function') {
    tasks.push(
      settleWithinTimeout(
        Promise.resolve()
          .then(() => logout())
          .catch(() => undefined),
      ),
    )
  }

  await Promise.all(tasks)
}
