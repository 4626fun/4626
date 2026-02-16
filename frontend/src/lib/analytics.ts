export type AnalyticsPayload = Record<string, unknown>

export function trackEvent(event: string, payload?: AnalyticsPayload): void {
  if (typeof window === 'undefined') return
  const data = { event, ...(payload || {}) }
  try {
    ;(window as any).dataLayer = (window as any).dataLayer || []
    ;(window as any).dataLayer.push(data)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('cv:analytics', { detail: data }))
  } catch {
    // ignore
  }
}
