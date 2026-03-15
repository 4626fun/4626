import { apiFetch, type ApiFetchInit } from '@/lib/apiBase'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  needsConnectedOwnerWallet?: boolean
  needsZoraIdentitySignal?: boolean
}

type OnboardingBootstrapResponse = {
  chainId: 8453
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  privyIsOwner: boolean
}

export type CanonicalizationResult = {
  privySynced: boolean
  onboardingBootstrapped: boolean
  onboarding: OnboardingBootstrapResponse | null
  flags: {
    needsConnectedOwnerWallet: boolean
    needsZoraIdentitySignal: boolean
  }
}

type CanonicalizationParams = {
  privyToken: string | null | undefined
  strictOnboardingBootstrap?: boolean
  fetcher?: (path: string, init?: ApiFetchInit) => Promise<Response>
}

function readApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
}

function normalizeToken(token: string | null | undefined): string {
  return typeof token === 'string' ? token.trim() : ''
}

export async function runCanonicalizationPipeline(params: CanonicalizationParams): Promise<CanonicalizationResult> {
  const token = normalizeToken(params.privyToken)
  const fetcher = params.fetcher ?? apiFetch
  const strict = params.strictOnboardingBootstrap === true

  if (!token) {
    return {
      privySynced: false,
      onboardingBootstrapped: false,
      onboarding: null,
      flags: {
        needsConnectedOwnerWallet: false,
        needsZoraIdentitySignal: false,
      },
    }
  }

  const authRes = await fetcher('/api/auth/privy', {
    method: 'POST',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const authPayload = (await authRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!authRes.ok || !authPayload?.success) {
    throw new Error(readApiError(authPayload, 'Failed to sync Privy session.'))
  }

  const onboardingRes = await fetcher('/api/onboarding/bootstrap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Privy-Token': token,
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  })
  const onboardingPayload = (await onboardingRes.json().catch(() => null)) as ApiEnvelope<OnboardingBootstrapResponse> | null
  if (onboardingRes.ok && onboardingPayload?.success && onboardingPayload.data) {
    return {
      privySynced: true,
      onboardingBootstrapped: true,
      onboarding: onboardingPayload.data,
      flags: {
        needsConnectedOwnerWallet: false,
        needsZoraIdentitySignal: false,
      },
    }
  }

  const flags = {
    needsConnectedOwnerWallet: onboardingPayload?.needsConnectedOwnerWallet === true,
    needsZoraIdentitySignal: onboardingPayload?.needsZoraIdentitySignal === true,
  }
  if (strict) {
    const error = new Error(readApiError(onboardingPayload, 'Failed to bootstrap canonical delegation.')) as Error & {
      needsConnectedOwnerWallet?: boolean
      needsZoraIdentitySignal?: boolean
    }
    if (flags.needsConnectedOwnerWallet) error.needsConnectedOwnerWallet = true
    if (flags.needsZoraIdentitySignal) error.needsZoraIdentitySignal = true
    throw error
  }

  // In non-strict mode we only tolerate actionable delegation flags.
  // Any other onboarding bootstrap failure should still surface as an error.
  if (!flags.needsConnectedOwnerWallet && !flags.needsZoraIdentitySignal) {
    throw new Error(readApiError(onboardingPayload, 'Failed to bootstrap canonical delegation.'))
  }

  return {
    privySynced: true,
    onboardingBootstrapped: false,
    onboarding: null,
    flags,
  }
}
