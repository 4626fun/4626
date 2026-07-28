export function evaluateOwnerInstallResumeAttempt({ ok, status, json }) {
  const payload = json ?? null
  const lastError = String(payload?.data?.lastError ?? payload?.error ?? '')
  const nextAction = payload?.data?.nextAction
  const leaseUnavailable = lastError.toLowerCase().includes('lease_unavailable')

  if (ok && payload?.success === true && !leaseUnavailable) {
    if (nextAction === 'wait_for_owner_install') return 'retry'
    return 'ok'
  }

  if (leaseUnavailable) return 'retry'
  if (status >= 500 || status === 429 || status === 408) return 'retry'
  return 'fail'
}

export function shouldKeepRetryingOwnerInstallResume({ decision, attempts, maxAttempts }) {
  return decision === 'retry' && attempts < maxAttempts
}
