import { http } from 'viem'

import { isSameOriginUrl } from '@/lib/aa/coinbaseErc4337EndpointUtils'
import { resolveRelayBundlerUrl } from '@/lib/relay/resolveRelayPart1DepositTxHash'

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

function readStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const token = typeof value === 'string' ? value.trim() : ''
    return token.length > 0 ? token : null
  } catch {
    return null
  }
}

/** Bundler JSON-RPC transport for Relay Part 1 — forwards 4626 session + owner-install policy token. */
export function buildRelayBundlerHttpTransport(customOwnerPolicyToken?: string | null) {
  const url = resolveRelayBundlerUrl()
  const sameOrigin = isSameOriginUrl(url)
  const sessionToken = sameOrigin ? readStoredSessionToken() : null
  const policyToken =
    sameOrigin &&
    typeof customOwnerPolicyToken === 'string' &&
    customOwnerPolicyToken.trim()
      ? customOwnerPolicyToken.trim()
      : null

  const headers: Record<string, string> = {
    ...(sameOrigin && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...(policyToken ? { 'X-CV-Custom-Owner-Policy': policyToken } : {}),
  }

  return http(url, {
    fetchOptions: {
      credentials: sameOrigin ? 'include' : 'omit',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    },
  })
}
