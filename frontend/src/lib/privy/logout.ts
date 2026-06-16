type PrivyTokenReader = (() => Promise<string | null>) | null | undefined

function readErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return String((error as { message: string }).message)
  }
  return ''
}

function readErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const record = error as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown } | null
  }
  const status = Number(record.status ?? record.statusCode ?? record.response?.status)
  return Number.isFinite(status) ? status : null
}

export function isBenignPrivyLogoutError(error: unknown): boolean {
  const status = readErrorStatusCode(error)
  if (status === 400 || status === 401) return true

  const normalized = readErrorMessage(error).trim().toLowerCase()
  if (!normalized) return false

  return (
    normalized.includes('bad request') ||
    normalized.includes('already logged out') ||
    normalized.includes('already signed out') ||
    normalized.includes('session expired') ||
    normalized.includes('session not found') ||
    normalized.includes('no active session') ||
    normalized.includes('missing auth token') ||
    normalized.includes('missing_or_invalid_token')
  )
}

export async function shouldAttemptPrivyLogout(readToken: PrivyTokenReader): Promise<boolean> {
  if (typeof readToken !== 'function') return true
  try {
    const token = await readToken()
    return typeof token === 'string' && token.trim().length > 0
  } catch {
    // If token introspection itself fails, keep the existing defensive logout attempt.
    return true
  }
}

export async function safePrivyLogout(params: {
  logout: (() => Promise<void>) | null | undefined
  readToken?: PrivyTokenReader
}): Promise<void> {
  if (typeof params.logout !== 'function') return
  const shouldAttempt = await shouldAttemptPrivyLogout(params.readToken)
  if (!shouldAttempt) return
  try {
    await params.logout()
  } catch (error: unknown) {
    if (isBenignPrivyLogoutError(error)) return
    throw error
  }
}
