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
