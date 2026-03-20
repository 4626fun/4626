import { apiFetch, type ApiFetchInit } from '@/lib/apiBase'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
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
    needsEmbeddedWallet: boolean
    needsBaseAppSetup: boolean
    baseAppUrl: string | null
  }
}

type CanonicalizationParams = {
  privyToken: string | null | undefined
  strictOnboardingBootstrap?: boolean
  fetcher?: (path: string, init?: ApiFetchInit) => Promise<Response>
}

type CanonicalizationError = Error & {
  recoveryRequired?: boolean
  code?: string
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
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

function isRecoveryRequiredAuthFailure(params: {
  status: number
  payload: ApiEnvelope<unknown> | null
}): boolean {
  if (params.status === 409) return true
  const recoveryRequired = (params.payload as any)?.recoveryRequired
  if (recoveryRequired === true) return true
  const code = String((params.payload as any)?.code ?? '')
    .trim()
    .toUpperCase()
  return code.includes('RECOVERY_REQUIRED')
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
        needsEmbeddedWallet: false,
        needsBaseAppSetup: false,
        baseAppUrl: null,
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
    const recoveryRequired = isRecoveryRequiredAuthFailure({
      status: authRes.status,
      payload: authPayload,
    })
    const fallback = recoveryRequired
      ? 'Recovery required: this email is already linked to another account. Use account recovery to continue.'
      : 'Failed to sync Privy session.'
    const error = new Error(readApiError(authPayload, fallback)) as CanonicalizationError
    if (recoveryRequired) {
      error.recoveryRequired = true
      const code = String((authPayload as any)?.code ?? '').trim()
      if (code.length > 0) error.code = code
    }
    throw error
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
        needsEmbeddedWallet: false,
        needsBaseAppSetup: false,
        baseAppUrl: null,
      },
    }
  }

  const flags = {
    needsEmbeddedWallet: onboardingPayload?.needsEmbeddedWallet === true,
    needsBaseAppSetup: onboardingPayload?.needsBaseAppSetup === true,
    baseAppUrl: typeof onboardingPayload?.baseAppUrl === 'string' && onboardingPayload.baseAppUrl.trim()
      ? onboardingPayload.baseAppUrl.trim()
      : null,
  }
  if (strict) {
    const error = new Error(readApiError(onboardingPayload, 'Failed to bootstrap canonical delegation.')) as CanonicalizationError
    if (flags.needsEmbeddedWallet) error.needsEmbeddedWallet = true
    if (flags.needsBaseAppSetup) error.needsBaseAppSetup = true
    if (flags.baseAppUrl) error.baseAppUrl = flags.baseAppUrl
    throw error
  }

  // In non-strict mode we only tolerate actionable delegation flags.
  // Any other onboarding bootstrap failure should still surface as an error.
  if (!flags.needsEmbeddedWallet && !flags.needsBaseAppSetup) {
    throw new Error(readApiError(onboardingPayload, 'Failed to bootstrap canonical delegation.'))
  }

  return {
    privySynced: true,
    onboardingBootstrapped: false,
    onboarding: null,
    flags,
  }
}
