function normalizeCdpUrl(value: string): string {
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

export function resolveCdpPaymasterUrl(paymaster: string | null | undefined): string | null {
  const origin = typeof window !== 'undefined' ? window.location?.origin : null
  const forceProxy = Boolean(origin && import.meta.env.PROD && paymaster)
  if (forceProxy && origin) {
    return `${origin}/api/paymaster`
  }
  if (paymaster && typeof paymaster === 'string') return normalizeCdpUrl(paymaster)
  return null
}

export function resolveCdpBundlerUrl(
  bundler: string | null | undefined,
  paymaster?: string | null | undefined,
): string | null {
  if (bundler && typeof bundler === 'string' && bundler.trim().length > 0) {
    return normalizeCdpUrl(bundler)
  }
  return resolveCdpPaymasterUrl(paymaster)
}
