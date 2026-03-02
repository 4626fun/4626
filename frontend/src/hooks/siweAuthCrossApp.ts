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

export function shouldAttemptCrossAppLoginOnPath(pathname: string | null | undefined): boolean {
  const value = String(pathname ?? '').trim()
  if (!value) return true
  return value === '/'
}
