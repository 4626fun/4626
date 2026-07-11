import { http } from 'viem'

import { isSameOriginUrl } from '@/lib/aa/coinbaseErc4337EndpointUtils'
import { resolveRelayBundlerUrl } from '@/lib/relay/resolveRelayPart1DepositTxHash'

/** Bundler JSON-RPC transport for Relay Part 1 — forwards 4626 session + owner-install policy token. */
export function buildRelayBundlerHttpTransport(customOwnerPolicyToken?: string | null) {
  const url = resolveRelayBundlerUrl()
  const sameOrigin = isSameOriginUrl(url)
  const policyToken =
    sameOrigin &&
    typeof customOwnerPolicyToken === 'string' &&
    customOwnerPolicyToken.trim()
      ? customOwnerPolicyToken.trim()
      : null
  const headers: Record<string, string> = {
    ...(policyToken ? { 'X-CV-Custom-Owner-Policy': policyToken } : {}),
  }

  return http(url, {
    fetchOptions: {
      credentials: sameOrigin ? 'include' : 'omit',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    },
  })
}
