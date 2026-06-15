import { sanitizeCrossAppRedirectUrlForAuth, isPrivyRedirectUrlNotAllowedError } from '@/hooks/siweAuthCrossApp'

type CrossAppFn = ((params: { appId: string }) => Promise<unknown>) | null | undefined
const LOCALHOST_PRIVY_CUSTOM_DOMAIN_MESSAGE =
  'Privy localhost + custom domain (privy.4626.fun) configuration required for OAuth/Zora linking. ' +
  'In your Privy dashboard, for the Local Dev client: add http://localhost:5173 and http://localhost:5174 (and 127.0.0.1 variants) to Allowed Origins, ' +
  'and allow the redirect URLs produced by your VITE_APP_ORIGIN / VITE_MARKETING_ORIGIN. ' +
  'Then restart your dev server. See .env.example for details.'

function readErrorStatusCode(error: unknown): number | null {
  const candidate = Number(
    (error as any)?.status ??
      (error as any)?.statusCode ??
      (error as any)?.response?.status ??
      (error as any)?.cause?.status,
  )
  if (!Number.isFinite(candidate)) return null
  return candidate
}

export function isUnauthorizedCrossAppLinkError(error: unknown): boolean {
  const status = readErrorStatusCode(error)
  if (status === 401 || status === 403) return true

  const message = String((error as any)?.message ?? '').trim().toLowerCase()
  if (!message) return false
  const mentionsCrossAppOAuth = message.includes('oauth/init') || message.includes('cross_app') || message.includes('cross-app') || message.includes('oauth/link')
  if (!mentionsCrossAppOAuth) return false
  return message.includes('401') || message.includes('unauthorized') || message.includes('not authorized')
}

export function isMissingPrivyAuthTokenError(error: unknown): boolean {
  const message = String((error as any)?.message ?? '').trim().toLowerCase()
  if (!message) return false
  return message.includes('missing auth token')
}

export function isLocalhostPrivyCustomDomainConfigError(error: unknown): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal) return false

  const message = String((error as any)?.message ?? '').toLowerCase()
  if (isMissingPrivyAuthTokenError(error)) return false
  const status = readErrorStatusCode(error)
  if (status === 401 || status === 403) {
    return (
      message.includes('redirect url is not allowed') ||
      message.includes('redirect') ||
      message.includes('privy.4626.fun')
    )
  }

  return (
    message.includes('redirect url is not allowed') ||
    (message.includes('oauth') && message.includes('401')) ||
    message.includes('privy.4626.fun') && (message.includes('401') || message.includes('unauthorized'))
  )
}

export function isRecoverableCrossAppAuthError(error: unknown): boolean {
  if (isUnauthorizedCrossAppLinkError(error)) return true
  const message = String((error as any)?.message ?? '').trim().toLowerCase()
  if (!message) return false
  // Some Privy cross-app lanes return only this generic string.
  return (
    message.includes('attempted to log in, but user is already logged in') ||
    (message.includes('already logged in') && message.includes('link helper')) ||
    message.includes('unknown rpc error occurred') ||
    message.includes('unable to connect to wallet') ||
    message.includes('error linking account') ||
    message.includes('authentication failed') ||
    message.includes('issue connecting your zora account') ||
    message.includes('issue connecting your account') ||
    message.includes('invalid code during cross-app auth flow') ||
    message.includes('invalid code') ||
    message.includes('invalid authorization code') ||
    message.includes('authorization code') ||
    message.includes('popup') ||
    message.includes('window.open') ||
    message.includes('blocked')
  )
}

export function isUserRejectedCrossAppAuthError(error: unknown): boolean {
  const message = String((error as any)?.message ?? '').trim().toLowerCase()
  if (!message) return false
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected request') ||
    message.includes('rejected the request') ||
    message.includes('request was cancelled') ||
    message.includes('request was canceled')
  )
}

async function runWithSanitizedRedirect<T>(
  work: () => Promise<T>,
  sanitizeRedirect: () => (() => void) | null,
): Promise<T> {
  const restore = sanitizeRedirect()
  try {
    return await work()
  } finally {
    restore?.()
  }
}

export async function performZoraCrossAppAuth(params: {
  privyAuthed: boolean
  appId: string
  linkCrossAppAccount: CrossAppFn
  loginWithCrossAppAccount: CrossAppFn
  sanitizeRedirect?: () => (() => void) | null
  isRedirectUrlNotAllowedError?: (error: unknown) => boolean
}): Promise<void> {
  const sanitizeRedirect = params.sanitizeRedirect ?? sanitizeCrossAppRedirectUrlForAuth
  const isRedirectUrlNotAllowedError = params.isRedirectUrlNotAllowedError ?? isPrivyRedirectUrlNotAllowedError

  const hasLink = typeof params.linkCrossAppAccount === 'function'
  const hasLogin = typeof params.loginWithCrossAppAccount === 'function'
  const action = params.privyAuthed ? (hasLink ? 'link' : hasLogin ? 'login' : null) : (hasLogin ? 'login' : hasLink ? 'link' : null)

  if (!action) {
    throw new Error('Zora linking is unavailable in this environment.')
  }

  if (action === 'link') {
    try {
      await runWithSanitizedRedirect(() => params.linkCrossAppAccount!({ appId: params.appId }), sanitizeRedirect)
      return
    } catch (linkError: unknown) {
      if (isLocalhostPrivyCustomDomainConfigError(linkError)) {
        throw new Error(LOCALHOST_PRIVY_CUSTOM_DOMAIN_MESSAGE)
      }
      if (
        hasLogin &&
        (isRecoverableCrossAppAuthError(linkError) || isRedirectUrlNotAllowedError(linkError))
      ) {
        await runWithSanitizedRedirect(() => params.loginWithCrossAppAccount!({ appId: params.appId }), sanitizeRedirect)
        return
      }
      throw linkError
    }
  }

  try {
    await runWithSanitizedRedirect(
      () => params.loginWithCrossAppAccount!({ appId: params.appId }),
      sanitizeRedirect,
    )
  } catch (loginError: unknown) {
    if (isLocalhostPrivyCustomDomainConfigError(loginError)) {
      throw new Error(LOCALHOST_PRIVY_CUSTOM_DOMAIN_MESSAGE)
    }
    // Some Privy environments surface a generic "Authentication failed" on one lane
    // while the companion cross-app lane succeeds. Mirror the link->login fallback.
    if (
      hasLink &&
      (isRecoverableCrossAppAuthError(loginError) || isRedirectUrlNotAllowedError(loginError))
    ) {
      await runWithSanitizedRedirect(
        () => params.linkCrossAppAccount!({ appId: params.appId }),
        sanitizeRedirect,
      )
      return
    }
    throw loginError
  }
}
