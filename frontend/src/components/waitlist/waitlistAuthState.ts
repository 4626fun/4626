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

export function shouldStopWaitlistAutoAuthRetry(params: {
  isSessionMismatch: boolean
  isRecoveryRequired: boolean
}): boolean {
  return params.isSessionMismatch || params.isRecoveryRequired
}

export async function runWaitlistPrivyLogout(params: {
  logout: (() => Promise<void>) | null | undefined
  timeoutMs?: number
}): Promise<void> {
  const logout = params.logout
  if (typeof logout !== 'function') return

  const timeoutCandidate = params.timeoutMs
  const timeoutMs =
    typeof timeoutCandidate === 'number' && Number.isFinite(timeoutCandidate)
      ? Math.max(0, Math.floor(timeoutCandidate))
      : 1_500
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, timeoutMs)
  })
  const logoutPromise = Promise.resolve()
    .then(() => logout())
    .catch(() => undefined)

  try {
    await Promise.race([logoutPromise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
