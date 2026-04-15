export function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return v
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(v, base) : new URL(v)
    return u.toString()
  } catch {
    return v
  }
}

export function isSameOriginUrl(value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(value, window.location.origin)
    return u.origin === window.location.origin
  } catch {
    return false
  }
}

export function isPaymasterProxyUrl(value: string): boolean {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(value, base) : new URL(value)
    return u.pathname === '/api/paymaster'
  } catch {
    return false
  }
}

export function resolveBundlerUrlForNonPaymaster(
  bundlerUrl: string,
  envBundlerUrl: string | undefined,
): string {
  if (!envBundlerUrl?.trim()) return bundlerUrl
  if (!isPaymasterProxyUrl(bundlerUrl)) return bundlerUrl
  return normalizeUrl(envBundlerUrl)
}
