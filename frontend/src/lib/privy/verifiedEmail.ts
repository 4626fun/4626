const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const lc = value.trim().toLowerCase()
    return lc === '1' || lc === 'true' || lc === 'yes'
  }
  return false
}

function accountHasVerifiedFlag(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const account = value as Record<string, unknown>
  if (isTruthy(account.verified)) return true
  if (isTruthy(account.isVerified)) return true
  if (isTruthy(account.is_verified)) return true
  const hasTimestamp = (candidate: unknown): boolean => {
    if (typeof candidate === 'number') return Number.isFinite(candidate) && candidate > 0
    if (typeof candidate === 'string') return candidate.trim().length > 0
    return false
  }
  return (
    hasTimestamp(account.verifiedAt) ||
    hasTimestamp(account.verified_at) ||
    hasTimestamp(account.firstVerifiedAt) ||
    hasTimestamp(account.first_verified_at) ||
    hasTimestamp(account.latestVerifiedAt) ||
    hasTimestamp(account.latest_verified_at)
  )
}

function candidateEmailFromAccount(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const account = value as Record<string, unknown>
  const candidates = [account.address, account.emailAddress, account.email_address, account.email]
  for (const candidate of candidates) {
    const normalized = normalizeLower(candidate)
    if (normalized && EMAIL_RE.test(normalized)) return normalized
  }
  return null
}

/** Client-side mirror of server `extractPrivyVerifiedEmail`. */
export function extractPrivyVerifiedEmailFromUser(user: unknown): string | null {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return null

  const directEmail = record.email && typeof record.email === 'object' ? (record.email as Record<string, unknown>) : null
  if (directEmail && accountHasVerifiedFlag(directEmail)) {
    const direct = candidateEmailFromAccount(directEmail)
    if (direct) return direct
  }

  const linked = [
    ...(Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as unknown[]) : []),
    ...(Array.isArray(record.linked_accounts) ? (record.linked_accounts as unknown[]) : []),
  ]
  for (const account of linked) {
    const linkedRecord = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!linkedRecord) continue
    const type = normalizeLower(linkedRecord.type)
    if (!type.includes('email')) continue
    if (!accountHasVerifiedFlag(linkedRecord)) continue
    const candidate = candidateEmailFromAccount(linkedRecord)
    if (candidate) return candidate
  }

  return null
}

/**
 * Best-effort email read for waitlist bootstrap hints right after OTP.
 * Privy client SDKs (especially Base App) can expose a linked email before
 * verified flags or server hydration catch up.
 */
export function extractPrivyLinkedEmailFromUser(user: unknown): string | null {
  const verified = extractPrivyVerifiedEmailFromUser(user)
  if (verified) return verified

  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return null

  const directEmail = record.email && typeof record.email === 'object' ? (record.email as Record<string, unknown>) : null
  if (directEmail) {
    const direct = candidateEmailFromAccount(directEmail)
    if (direct) return direct
  }

  const linked = [
    ...(Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as unknown[]) : []),
    ...(Array.isArray(record.linked_accounts) ? (record.linked_accounts as unknown[]) : []),
  ]
  for (const account of linked) {
    const linkedRecord = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!linkedRecord) continue
    const type = normalizeLower(linkedRecord.type)
    if (!type.includes('email')) continue
    const candidate = candidateEmailFromAccount(linkedRecord)
    if (candidate) return candidate
  }

  return null
}
