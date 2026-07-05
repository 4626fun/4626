import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { buildPrivyAuthHeaders } from '@/lib/privy/accessToken'

export type ZoraReadOnlyResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: {
    address: string
    name: string | null
    symbol: string | null
    imageUrl: string | null
  } | null
  zoraHandle: string | null
}

export function hasZoraReadOnlySignals(data: ZoraReadOnlyResolveResponse | null | undefined): boolean {
  return Boolean(data?.canonicalCswAddress || data?.zoraHandle || data?.creatorCoin?.address)
}

export async function resolveZoraReadOnlySignals(params: {
  getAccessToken: (() => Promise<string | null>) | null | undefined
}): Promise<ZoraReadOnlyResolveResponse> {
  const headers = await buildPrivyAuthHeaders({
    getAccessToken: params.getAccessToken ?? null,
    missingTokenMessage: 'Could not verify your session. Please try again.',
  })
  const response = await apiFetch('/api/zora/resolve', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraReadOnlyResolveResponse> | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Failed to resolve Zora signals.',
    )
  }
  return payload.data
}
