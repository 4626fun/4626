import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { OnboardingBootstrapResponse } from '@/lib/wallet/onboardingBootstrapTypes'

import { isRecoveryRequiredAuthError } from './waitlistAuthState'
import { readApiErrorMessage } from './waitlistBootstrapUtils'
import type { WaitlistBootstrapResponse } from './waitlistAccountTypes'

export type WaitlistCanonicalizationResult = {
  onboardingBootstrapped: boolean
  onboarding: OnboardingBootstrapResponse | null
  flags: {
    needsEmbeddedWallet: boolean
  }
}

export type WaitlistBootstrapPipelineParams = {
  token: string
  activeReferralCode: string | null
  verifiedEmailHint?: string | null
  fetchWaitlistBootstrap: (headers: Record<string, string>, body: string) => Promise<Response>
  runCanonicalization: (token: string) => Promise<WaitlistCanonicalizationResult>
  ensureEmbeddedWallet: () => Promise<{ address: string }>
}

export type WaitlistBootstrapPipelineSuccess = {
  kind: 'success'
  payload: Extract<WaitlistBootstrapResponse, { requiresPrivyAuth: false }>
  bootstrappedCanonicalWallet: OnboardingBootstrapResponse | null
}

export type WaitlistBootstrapPipelineRequiresAuth = {
  kind: 'requires_privy_auth'
}

export type WaitlistBootstrapPipelineResult =
  | WaitlistBootstrapPipelineSuccess
  | WaitlistBootstrapPipelineRequiresAuth

/**
 * Returning waitlist users verify email on a fresh Privy session while the
 * email remains bound to an older Privy DID. Server-side rebind runs during
 * `/api/waitlist/bootstrap`; `/api/auth/privy` must not run first or wallet
 * sync throws RECOVERY_REQUIRED before rebind can execute.
 */
export async function executeWaitlistBootstrapPipeline(
  params: WaitlistBootstrapPipelineParams,
): Promise<WaitlistBootstrapPipelineResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Privy-Token': params.token,
  }
  const body = JSON.stringify({
    ...(params.activeReferralCode ? { referralCode: params.activeReferralCode } : {}),
    ...(params.verifiedEmailHint ? { email: params.verifiedEmailHint } : {}),
  })

  const response = await params.fetchWaitlistBootstrap(headers, body)
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null

  if (!response.ok || !payload?.success || !payload.data) {
    const err = new Error(readApiErrorMessage(payload, 'Failed to bootstrap waitlist state.')) as Error & {
      status?: number
      code?: string
      recoveryRequired?: boolean
    }
    err.status = response.status
    const code = typeof (payload as any)?.code === 'string' ? String((payload as any).code).trim() : ''
    if (code) err.code = code
    const nextRecoveryRequired =
      response.status === 409 ||
      Boolean((payload as { recoveryRequired?: boolean })?.recoveryRequired) ||
      code.toUpperCase().includes('RECOVERY_REQUIRED')
    if (nextRecoveryRequired) err.recoveryRequired = true
    throw err
  }

  if (payload.data.requiresPrivyAuth) {
    return { kind: 'requires_privy_auth' }
  }

  // Step 1 (email OTP) must not block on embedded-wallet provisioning — that runs
  // in the waitlist setup workspace after emailVerified advances the user to step 2.
  let bootstrappedCanonicalWallet: OnboardingBootstrapResponse | null = null
  try {
    const canonicalization = await params.runCanonicalization(params.token)
    if (canonicalization.onboardingBootstrapped && canonicalization.onboarding) {
      bootstrappedCanonicalWallet = canonicalization.onboarding
    }
  } catch (canonicalizationError: unknown) {
    if (!isRecoveryRequiredAuthError(canonicalizationError)) {
      const message =
        canonicalizationError instanceof Error
          ? canonicalizationError.message
          : String(canonicalizationError ?? 'unknown')
      console.warn('waitlist_bootstrap.canonicalization_deferred', { message })
    }
    // Waitlist identity is already settled from `/api/waitlist/bootstrap`; step 2
    // reloads `/api/accounts/me` and can retry canonicalization there.
  }

  return {
    kind: 'success',
    payload: payload.data,
    bootstrappedCanonicalWallet,
  }
}
