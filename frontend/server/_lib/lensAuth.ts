/**
 * Lens Protocol authentication helper.
 *
 * Implements the Lens challenge-response authentication flow using the
 * Lens V3 GraphQL API directly. This enables the agent to perform
 * authenticated actions (posting, following, etc.) on behalf of a Lens account.
 *
 * The flow:
 *   1. Request a challenge from Lens for the agent's account address
 *   2. Sign the challenge with the agent's wallet (EIP-191 personal_sign)
 *   3. Authenticate with the signed challenge to get access/refresh tokens
 *
 * The session tokens are cached and reused until they expire.
 */
import { lensGql } from './lensClient.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LensSignerFn = (message: string) => Promise<string>

export type LensSession = {
  accessToken: string
  refreshToken: string
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const CHALLENGE_MUTATION = /* GraphQL */ `
  mutation Challenge($request: ChallengeRequest!) {
    challenge(request: $request) {
      id
      text
    }
  }
`

const AUTHENTICATE_MUTATION = /* GraphQL */ `
  mutation Authenticate($request: SignedAuthChallenge!) {
    authenticate(request: $request) {
      ... on AuthenticationTokens {
        accessToken
        refreshToken
      }
      ... on WrongSignerError {
        reason
      }
      ... on ExpiredChallengeError {
        reason
      }
      ... on ForbiddenError {
        reason
      }
    }
  }
`

type ChallengeResponse = {
  challenge: { id: string; text: string }
}

type AuthenticateResponse = {
  authenticate:
    | { accessToken: string; refreshToken: string }
    | { reason: string }
}

// ---------------------------------------------------------------------------
// Session cache
// ---------------------------------------------------------------------------

let _session: LensSession | null = null
let _sessionAccountAddress: string | null = null

/**
 * Get an authenticated Lens session for the given account.
 *
 * @param accountAddress - The Lens account address
 * @param signerFn - A function that signs messages (EIP-191 personal_sign)
 * @returns An authenticated session with tokens, or null if auth fails
 */
export async function getLensSessionClient(
  accountAddress: string,
  signerFn: LensSignerFn,
): Promise<LensSession | null> {
  // Return cached session if it's for the same account
  if (_session && _sessionAccountAddress === accountAddress.toLowerCase()) {
    return _session
  }

  try {
    // Step 1: Request challenge
    const challengeData = await lensGql<ChallengeResponse>(CHALLENGE_MUTATION, {
      request: {
        accountOwner: {
          account: accountAddress,
          owner: accountAddress,
          app: '0xe5439696f4057aF073c0FB2dc6e023b1C568Fbcd', // Lens default app
        },
      },
    })

    const { id, text } = challengeData.challenge

    // Step 2: Sign the challenge
    const signature = await signerFn(text)

    // Step 3: Authenticate
    const authData = await lensGql<AuthenticateResponse>(AUTHENTICATE_MUTATION, {
      request: { id, signature },
    })

    const authResult = authData.authenticate
    if (!('accessToken' in authResult)) {
      console.error('[lensAuth] Login failed:', (authResult as { reason: string }).reason)
      return null
    }

    _session = {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
    }
    _sessionAccountAddress = accountAddress.toLowerCase()
    return _session
  } catch (err) {
    console.error('[lensAuth] Login error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Clear the cached session (e.g., on logout or key rotation).
 */
export function clearLensSession(): void {
  _session = null
  _sessionAccountAddress = null
}
