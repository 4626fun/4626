const RELAY_INTENT_STATUS_URL = 'https://api.relay.link/intents/status/v3'

export type RelayIntentStatusQuery =
  | { requestId: `0x${string}`; orderId?: undefined }
  | { orderId: `0x${string}`; requestId?: undefined }

export function buildRelayIntentStatusUpstreamUrl(query: RelayIntentStatusQuery): string {
  const params = new URLSearchParams()
  if ('requestId' in query && query.requestId) {
    params.set('requestId', query.requestId)
  } else if ('orderId' in query && query.orderId) {
    params.set('orderId', query.orderId)
  }
  return `${RELAY_INTENT_STATUS_URL}?${params.toString()}`
}

export async function fetchRelayIntentStatus(query: RelayIntentStatusQuery): Promise<unknown> {
  const upstreamUrl = buildRelayIntentStatusUpstreamUrl(query)
  const response = await fetch(upstreamUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const raw = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      raw && typeof raw === 'object' && raw !== null && 'message' in raw
        ? String((raw as { message?: unknown }).message ?? '')
        : ''
    throw new Error(
      message.trim()
        ? `Relay intent status failed (${response.status}): ${message.trim()}`
        : `Relay intent status failed (${response.status})`,
    )
  }
  return raw
}
