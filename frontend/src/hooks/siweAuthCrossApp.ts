import { isMarketingWaitlistEntryLocation } from '@/lib/auth/waitlistEntry'

const WAITLIST_STICKY_OPEN_KEY = 'cv:waitlist:sticky_open'

export function isPrivyRedirectUrlNotAllowedError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as any)?.message === 'string'
          ? (error as any).message
          : ''

  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return false
  if (normalized.includes('redirect url is not allowed')) return true
  // Common shape from Privy cross-app errors.
  return normalized.includes('oauth/init') && normalized.includes('401') && normalized.includes('redirect')
}

type CrossAppRedirectLocation = {
  pathname?: string | null
  search?: string | null
  hash?: string | null
}

export function getCrossAppSafeRedirectPath(location: CrossAppRedirectLocation): {
  safePath: string
  shouldSanitize: boolean
} {
  const rawPath = String(location.pathname ?? '').trim()
  const normalizedPath = rawPath.length === 0 ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const search = String(location.search ?? '').trim()
  const hash = String(location.hash ?? '').trim()
  return {
    safePath: normalizedPath,
    shouldSanitize: search.length > 0 || hash.length > 0,
  }
}

export function sanitizeCrossAppRedirectUrlForAuth(): (() => void) | null {
  if (typeof window === 'undefined') return null
  const pathname = window.location.pathname
  const search = window.location.search
  const hash = window.location.hash
  const restorePath = `${pathname || '/'}${search || ''}${hash || ''}`
  const { safePath, shouldSanitize } = getCrossAppSafeRedirectPath({ pathname, search, hash })
  if (!shouldSanitize) return null

  if (isMarketingWaitlistEntryLocation({ pathname, search, hash }) || hash === '#waitlist') {
    try {
      window.sessionStorage.setItem(WAITLIST_STICKY_OPEN_KEY, '1')
    } catch {
      // ignore
    }
  }

  try {
    window.history.replaceState(window.history.state, document.title, safePath)
  } catch {
    return null
  }

  return () => {
    try {
      window.history.replaceState(window.history.state, document.title, restorePath)
    } catch {
      // ignore
    }
  }
}
