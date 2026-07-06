import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { readPrivyLinkedAccounts } from '@/lib/privy/linkedAccounts'

const WAITLIST_ZORA_OAUTH_PENDING_KEY = 'cv:waitlist:zora-oauth-pending'

function normalizeLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

export function markWaitlistZoraOAuthPending(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(WAITLIST_ZORA_OAUTH_PENDING_KEY, '1')
  } catch {
    // best-effort
  }
}

export function consumeWaitlistZoraOAuthPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const pending = window.sessionStorage.getItem(WAITLIST_ZORA_OAUTH_PENDING_KEY) === '1'
    window.sessionStorage.removeItem(WAITLIST_ZORA_OAUTH_PENDING_KEY)
    return pending
  } catch {
    return false
  }
}

export function isZoraCrossAppOAuthReturnLocation(location: Pick<Location, 'search' | 'hash'>): boolean {
  const raw = `${location.search ?? ''}${location.hash ?? ''}`.toLowerCase()
  if (!raw) return false
  return (
    raw.includes('privy_oauth') ||
    raw.includes('oauth_state') ||
    raw.includes('oauth_code') ||
    raw.includes('authorization_code') ||
    (raw.includes('code=') && raw.includes('state='))
  )
}

/**
 * Returns the Privy `subject` for the user's linked Zora cross-app account, or
 * null if none is linked. Required by `unlinkCrossAppAccount({ subject })` —
 * unlike the standard OAuth providers, cross-app unlink is keyed by subject,
 * not by a stored provider value. Mirrors `isPrivyZoraCrossAppLinked`'s
 * assumption that Zora is the only cross-app provider configured, so the
 * first `cross_app`-typed linked account is treated as the Zora one even
 * when a Privy build omits the provider app id on the linked account.
 */
export function findZoraCrossAppSubject(user: unknown): string | null {
  for (const account of readPrivyLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    const type = normalizeLower(record.type)
    if (type !== 'cross_app' && type !== 'cross-app' && !type.includes('cross_app')) continue
    const subject = record.subject
    return typeof subject === 'string' && subject.trim() ? subject.trim() : null
  }
  return null
}

export function isPrivyZoraCrossAppLinked(user: unknown, providerAppId: string = ZORA_PRIVY_APP_ID): boolean {
  const normalizedProvider = normalizeLower(providerAppId)
  for (const account of readPrivyLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    const type = normalizeLower(record.type)
    if (type !== 'cross_app' && type !== 'cross-app' && !type.includes('cross_app')) continue

    const providerCandidates = [
      record.providerAppId,
      record.provider_app_id,
      record.appId,
      record.app_id,
      record.subject,
    ]
    if (providerCandidates.some((value) => normalizeLower(value) === normalizedProvider)) {
      return true
    }
    // Some Privy builds omit provider id on the linked account; any cross_app link
    // while Zora is the only configured provider is sufficient.
    return true
  }
  return false
}
