export function shouldAutoStartWaitlistPrivyAuth(params: {
  step: 'email' | 'auth' | 'zora' | 'done'
  privyReady: boolean
  privyAuthed: boolean
  busy: boolean
  authAttemptInFlight: boolean
  authAutoAttempted: boolean
}): boolean {
  if (params.step !== 'auth') return false
  if (!params.privyReady) return false
  if (params.privyAuthed) return false
  if (params.busy) return false
  if (params.authAttemptInFlight) return false
  if (params.authAutoAttempted) return false
  return true
}

export function shouldStopWaitlistAutoAuthRetry(params: {
  isSessionMismatch: boolean
  isRecoveryRequired: boolean
}): boolean {
  return params.isSessionMismatch || params.isRecoveryRequired
}

export function shouldShowWaitlistTelegramCta(params: {
  step: 'email' | 'auth' | 'zora' | 'done'
  busy: boolean
  recoveryRequired: boolean
  isTelegramMiniApp: boolean
}): boolean {
  if (!params.isTelegramMiniApp) return false
  if (params.step !== 'auth') return false
  if (params.busy) return false
  if (params.recoveryRequired) return false
  return true
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
