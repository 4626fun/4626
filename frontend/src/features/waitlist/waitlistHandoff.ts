import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/wallet/onboardingWallet'

export type PrivyAuthSessionResponse = {
  address: string
  sessionToken: string
  privyUserId?: string
}

export type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

function readSessionTokenFromPrivyAuthPayload(payload: ApiEnvelope<PrivyAuthSessionResponse> | null): string | null {
  const token =
    payload?.success && typeof payload.data?.sessionToken === 'string' ? payload.data.sessionToken.trim() : ''
  return token || null
}

export async function bridgePrivySession(privyToken: string | null): Promise<string | null> {
  const token = typeof privyToken === 'string' ? privyToken.trim() : ''
  if (!token) return null

  const authRes = await apiFetch('/api/auth/privy', {
    method: 'POST',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => null)

  const authJson = authRes
    ? ((await authRes.json().catch(() => null)) as ApiEnvelope<PrivyAuthSessionResponse> | null)
    : null

  return authRes?.ok ? readSessionTokenFromPrivyAuthPayload(authJson) : null
}

export async function createAuthHandoffCode(params: {
  privyToken: string | null
  sessionToken: string | null
}): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const sessionToken = typeof params.sessionToken === 'string' ? params.sessionToken.trim() : ''
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`
  }

  const handoffRes = await apiFetch('/api/auth/handoff/create', {
    method: 'POST',
    withCredentials: true,
    headers,
    body: JSON.stringify({ privyToken: params.privyToken }),
  }).catch(() => null)

  const handoffJson = handoffRes
    ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null)
    : null

  return handoffRes?.ok && handoffJson?.success && typeof handoffJson.data?.code === 'string'
    ? handoffJson.data.code.trim()
    : ''
}
