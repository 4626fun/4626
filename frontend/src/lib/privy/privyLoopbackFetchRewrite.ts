import { isLocalDevOrigin } from '@/lib/flags/flags'
import {
  isPrivyAppConfigRequest,
  isPrivyDeprecatedSessionRefreshRequest,
  isPrivyOauthLinkOrUnlinkRequest,
  isPrivySiweLinkOrUnlinkRequest,
  normalizeFetchMethod,
  rewritePrivyLegacyRequestInput,
  sanitizePrivyAppConfigResponse,
} from '@/lib/privy/passwordlessFetchGuard'
import { resetPrivyLoopbackSessionAfterAuthFailure } from '@/lib/privy/loopbackSessionMarkerShim'

const LOOPBACK_FETCH_PATCHED_KEY = '__cvPrivyLoopbackFetchPatched'

async function readFetchBodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string | null> {
  if (init?.body != null) {
    return typeof init.body === 'string' ? init.body : null
  }
  if (input instanceof Request) {
    try {
      return await input.clone().text()
    } catch {
      return null
    }
  }
  return null
}

/**
 * On localhost/WSL dev, Privy dashboard config sets custom_api_url to privy.4626.fun
 * (server-cookie mode with refresh_token:"deprecated"). Strip that on app-config fetch,
 * rewrite stray privy.4626.fun API calls to auth.privy.io, and no-op deprecated
 * session refresh POSTs that 400 on loopback.
 */
export function installPrivyLoopbackFetchRewrite(): void {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV) return
  if (!isLocalDevOrigin(window.location.origin)) return
  if ((globalThis as unknown as Record<string, boolean | undefined>)[LOOPBACK_FETCH_PATCHED_KEY]) {
    return
  }

  const originalFetch = globalThis.fetch.bind(globalThis)
  const patchedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rewritten = rewritePrivyLegacyRequestInput(input, init)
    const method = normalizeFetchMethod(
      init?.method ?? (rewritten.input instanceof Request ? rewritten.input.method : undefined),
    )
    const bodyText = await readFetchBodyText(rewritten.input, rewritten.init)
    if (isPrivyDeprecatedSessionRefreshRequest(rewritten.url, method, bodyText)) {
      return new Response(JSON.stringify({ session_update_action: 'ignore' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const response = await originalFetch(rewritten.input, rewritten.init)
    if (
      response.status === 401 &&
      (isPrivySiweLinkOrUnlinkRequest(rewritten.url, method) ||
        isPrivyOauthLinkOrUnlinkRequest(rewritten.url, method))
    ) {
      // Stale access token from the loopback no-op above (or a token that expired
      // mid-session): reset now so the *next* attempt starts from a clean, honestly
      // unauthenticated state instead of repeating the same 401. Covers both the
      // SIWE wallet-link/unlink path and account-linking oauth/link + oauth/unlink
      // calls (handleLinkWallet/handleEditWallet/handleEditTwitter).
      resetPrivyLoopbackSessionAfterAuthFailure()
    }
    if (isPrivyAppConfigRequest(rewritten.url, method)) {
      return sanitizePrivyAppConfigResponse(response)
    }
    return response
  }

  globalThis.fetch = patchedFetch
  window.fetch = patchedFetch
  ;(globalThis as unknown as Record<string, boolean>)[LOOPBACK_FETCH_PATCHED_KEY] = true
}
