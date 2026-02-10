/**
 * Lens Protocol authentication helper.
 *
 * Implements the Lens challenge-response authentication flow using the
 * official `@lens-protocol/client` SDK. This enables the agent to perform
 * authenticated actions (posting, following, etc.) on behalf of a Lens account.
 *
 * The flow:
 *   1. Request a challenge from Lens for the agent's account address
 *   2. Sign the challenge with the agent's wallet (EIP-191 personal_sign)
 *   3. Authenticate with the signed challenge to get a session client
 *
 * The session client is cached and reused until it expires.
 */
import {
  PublicClient,
  mainnet,
  evmAddress,
} from '@lens-protocol/client'

import { getLensPublicClient } from './lensClient.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LensSignerFn = (message: string) => Promise<string>

export type LensSessionClient = Awaited<ReturnType<InstanceType<typeof PublicClient>['login']>> extends
  | infer R
  ? R extends { isErr(): boolean; value: infer V }
    ? V
    : any
  : any

// ---------------------------------------------------------------------------
// Session cache
// ---------------------------------------------------------------------------

let _sessionClient: any | null = null
let _sessionAccountAddress: string | null = null

/**
 * Get an authenticated Lens session client for the given account.
 *
 * @param accountAddress - The Lens account address (evmAddress format)
 * @param signerFn - A function that signs messages (EIP-191 personal_sign)
 * @returns An authenticated session client, or null if auth fails
 */
export async function getLensSessionClient(
  accountAddress: string,
  signerFn: LensSignerFn,
): Promise<any | null> {
  // Return cached session if it's for the same account
  if (_sessionClient && _sessionAccountAddress === accountAddress.toLowerCase()) {
    // Check if the session is still valid
    if (!_sessionClient.isPublicClient?.()) {
      return _sessionClient
    }
  }

  const publicClient = getLensPublicClient()

  try {
    const result = await publicClient.login({
      accountOwner: {
        account: evmAddress(accountAddress),
        owner: evmAddress(accountAddress),
        app: evmAddress('0xe5439696f4057aF073c0FB2dc6e023b1C568Fbcd'), // Lens default app
      },
      signMessage: async (message: string) => signerFn(message),
    })

    if (result.isErr()) {
      console.error('[lensAuth] Login failed:', result.error)
      return null
    }

    _sessionClient = result.value
    _sessionAccountAddress = accountAddress.toLowerCase()
    return _sessionClient
  } catch (err) {
    console.error('[lensAuth] Login error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Clear the cached session (e.g., on logout or key rotation).
 */
export function clearLensSession(): void {
  _sessionClient = null
  _sessionAccountAddress = null
}
