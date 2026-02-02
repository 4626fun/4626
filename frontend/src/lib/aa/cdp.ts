export function resolveCdpPaymasterUrl(paymaster: string | null | undefined): string | null {
  const origin = typeof window !== 'undefined' ? window.location?.origin : null
  const forceProxy = Boolean(origin && import.meta.env.PROD && paymaster)
  if (forceProxy && origin) {
    return `${origin}/api/paymaster`
  }
  // Prefer same-origin proxy when the URL points at it.
  // This avoids cross-domain SIWE/session issues when multiple domains (e.g. 4626.fun vs erc4626.fun)
  // are used for the frontend, but the paymaster URL was configured as an absolute URL.
  const normalizePaymasterUrl = (value: string): string => {
    const v = value.trim()
    if (!v) return v
    if (v === '/api/paymaster') {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${v}`
      }
      return v
    }
    try {
      const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined
      const u = base ? new URL(v, base) : new URL(v)
      if (u.pathname === '/api/paymaster') {
        if (typeof window !== 'undefined' && window.location?.origin) {
          return `${window.location.origin}/api/paymaster`
        }
        return '/api/paymaster'
      }
      return u.toString()
    } catch {
      return v
    }
  }

  if (paymaster && typeof paymaster === 'string') return normalizePaymasterUrl(paymaster)
  return null
}
