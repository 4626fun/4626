import { useQuery } from '@tanstack/react-query'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { apiFetch } from '@/lib/api/apiBase'

export type CreatorAllowlistMode = 'disabled' | 'enforced'

export type CreatorAllowlistStatus = {
  address: string | null
  coin: string | null
  creator: string | null
  payoutRecipient: string | null
  mode: CreatorAllowlistMode
  allowed: boolean
}

type CreatorAllowlistQuery = {
  address?: string | null
  coin?: string | null
}

async function fetchCreatorAllowlistStatus(params: CreatorAllowlistQuery): Promise<CreatorAllowlistStatus> {
  const qs = new URLSearchParams()
  if (params.address) qs.set('address', params.address)
  if (params.coin) qs.set('coin', params.coin)

  const res = await apiFetch(`${API_ENDPOINTS.creator.allowlist}?${qs.toString()}`, { method: 'GET' })
  if (!res.ok) throw new Error(`Allowlist check failed (${res.status})`)
  const json = await parseApiEnvelope<CreatorAllowlistStatus>(res)
  if (!json?.success) throw new Error(resolveApiErrorMessage(json, 'Allowlist check failed'))
  if (!json.data) throw new Error('Allowlist response missing data')
  return json.data
}

export function useCreatorAllowlist(address?: string | null): ReturnType<typeof useQuery<CreatorAllowlistStatus>> // overload
export function useCreatorAllowlist(params?: CreatorAllowlistQuery): ReturnType<typeof useQuery<CreatorAllowlistStatus>>
export function useCreatorAllowlist(
  input?: string | null | CreatorAllowlistQuery,
): ReturnType<typeof useQuery<CreatorAllowlistStatus>> {
  const params: CreatorAllowlistQuery =
    typeof input === 'string' || input === null || input === undefined
      ? { address: input ?? null }
      : { address: input.address ?? null, coin: input.coin ?? null }

  const keyAddress = params.address ? params.address.toLowerCase() : ''
  const keyCoin = params.coin ? params.coin.toLowerCase() : ''

  return useQuery({
    queryKey: ['creatorAllowlist', keyAddress, keyCoin],
    enabled: Boolean(params.address || params.coin),
    queryFn: () => fetchCreatorAllowlistStatus(params),
    staleTime: 60_000,
    retry: 1,
  })
}

