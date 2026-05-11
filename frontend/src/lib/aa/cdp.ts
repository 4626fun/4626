const PAYMASTER_PROXY_PATH = '/api/paymaster'

function getWindowOrigin(): string | null {
  if (typeof window === 'undefined') return null
  const origin = String(window.location?.origin ?? '').trim()
  return origin || null
}

function normalizePaymasterUrl(value: string, origin: string | null): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed === PAYMASTER_PROXY_PATH) {
    return origin ? `${origin}${PAYMASTER_PROXY_PATH}` : trimmed
  }
  try {
    const parsed = origin ? new URL(trimmed, origin) : new URL(trimmed)
    if (parsed.pathname === PAYMASTER_PROXY_PATH) {
      return origin ? `${origin}${PAYMASTER_PROXY_PATH}` : PAYMASTER_PROXY_PATH
    }
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function resolveCdpPaymasterUrl(paymaster: string | null | undefined): string | null {
  const origin = getWindowOrigin()
  const forceProxy = Boolean(origin && paymaster)
  if (forceProxy && origin) {
    return `${origin}${PAYMASTER_PROXY_PATH}`
  }
  if (paymaster && typeof paymaster === 'string') return normalizePaymasterUrl(paymaster, origin)
  return null
}
