export type OwnerInstallResumeDecision = 'ok' | 'retry' | 'fail'

/**
 * Decide whether an owner-install resume attempt advanced the session or needs
 * another try. Transient 5xx/`lease_unavailable` must not strand the session at
 * `created` / `wait_for_owner_install`.
 */
export function evaluateOwnerInstallResumeAttempt(input: {
  ok: boolean
  status: number
  json: unknown
}): OwnerInstallResumeDecision {
  const json = (input.json ?? null) as {
    success?: unknown
    error?: unknown
    data?: {
      nextAction?: unknown
      step?: unknown
      lastError?: unknown
    }
  } | null

  const lastError = String(json?.data?.lastError ?? json?.error ?? '')
  const nextAction = json?.data?.nextAction
  const leaseUnavailable = lastError.toLowerCase().includes('lease_unavailable')

  if (input.ok && json?.success === true && !leaseUnavailable) {
    // Still waiting means the server did not accept the continue yet.
    if (nextAction === 'wait_for_owner_install') return 'retry'
    return 'ok'
  }

  if (leaseUnavailable) return 'retry'
  if (input.status >= 500 || input.status === 429 || input.status === 408) return 'retry'
  return 'fail'
}

export function shouldKeepRetryingOwnerInstallResume(input: {
  decision: OwnerInstallResumeDecision
  attempts: number
  maxAttempts: number
}): boolean {
  return input.decision === 'retry' && input.attempts < input.maxAttempts
}
