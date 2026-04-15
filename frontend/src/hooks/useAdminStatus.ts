import { useQuery } from '@tanstack/react-query'
import { useSiweAuth } from './useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
type AdminResponse = { address: string; isAdmin: boolean } | null

type DeriveAdminStatusInput = {
  authAddress: string | null | undefined
  sessionHydrated: boolean
  queryLoading: boolean
  queryIsAdmin: boolean
}

type DeriveAdminStatusOutput = {
  hasSessionAddress: boolean
  isAdmin: boolean
  isLoading: boolean
}

async function fetchAdminStatus(): Promise<AdminResponse> {
  const res = await apiFetch(API_ENDPOINTS.auth.admin, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  const json = await parseApiEnvelope<AdminResponse>(res)
  if (!res.ok || !json) throw new Error(`Admin check failed (${res.status})`)
  if (!json.success) throw new Error(resolveApiErrorMessage(json, 'Admin check failed'))
  return json.data ?? null
}

export function deriveAdminStatus(input: DeriveAdminStatusInput): DeriveAdminStatusOutput {
  const hasSessionAddress = Boolean(input.authAddress)

  return {
    hasSessionAddress,
    isAdmin: hasSessionAddress && input.queryIsAdmin,
    // No session means no admin query is needed; keep this non-blocking.
    isLoading: hasSessionAddress ? (!input.sessionHydrated || input.queryLoading) : false,
  }
}

function useAdminStatusQueryState(params: {
  authAddress: string | null
  sessionHydrated: boolean
  enabled?: boolean
}) {
  const { authAddress, sessionHydrated, enabled = true } = params
  const hasSessionAddress = Boolean(authAddress)
  const queryEnabled = enabled && sessionHydrated && hasSessionAddress

  const query = useQuery({
    queryKey: ['auth', 'admin', authAddress ?? 'none'],
    // Admin identity is session-scoped; do not require a currently connected wallet.
    enabled: queryEnabled,
    queryFn: fetchAdminStatus,
    staleTime: 30_000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const derived = deriveAdminStatus({
    authAddress,
    sessionHydrated,
    queryLoading: queryEnabled ? query.isLoading : false,
    queryIsAdmin: query.data?.isAdmin === true,
  })

  return {
    isAdmin: derived.isAdmin,
    isLoading: derived.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useAdminStatusFromSession(params: {
  authAddress: string | null
  sessionHydrated: boolean
  enabled?: boolean
}) {
  return useAdminStatusQueryState(params)
}

export function useAdminStatus(params?: { enabled?: boolean }) {
  const { authAddress, sessionHydrated } = useSiweAuth()
  return useAdminStatusQueryState({
    authAddress,
    sessionHydrated,
    enabled: params?.enabled,
  })
}
