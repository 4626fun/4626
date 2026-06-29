import { apiFetch } from '@/lib/api/apiBase'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { mergeCanonicalWaitlistAccount } from '@/features/waitlist/waitlistFlowState'

export type BootstrapExecutionSignals = {
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  executionTrack: AccountSetupMe['accountSignals']['executionTrack']
  privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean
  baseSubAccount: AccountSetupMe['accountSignals']['baseSubAccount']
}

const BOOTSTRAP_CACHE_TTL_MS = 30_000
const BOOTSTRAP_RATE_LIMIT_BACKOFF_MS = 8_000

let bootstrapInFlight: Promise<BootstrapExecutionSignals | null> | null = null
let bootstrapCached:
  | {
      tokenFingerprint: string
      value: BootstrapExecutionSignals | null
      expiresAt: number
    }
  | null = null
let bootstrapRateLimitedUntil = 0

function readTokenFingerprint(token: string): string {
  return token.length <= 24 ? token : `${token.slice(0, 12)}:${token.slice(-8)}`
}

function parseBootstrapResponse(body: unknown): BootstrapExecutionSignals | null {
  const payload = body as
    | {
        success: boolean
        data: {
          canonicalCswAddress?: string
          privyEmbeddedEoaAddress?: string
          executionTrack?: AccountSetupMe['accountSignals']['executionTrack']
          privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean
          privyIsOwner?: boolean
          baseSubAccount?: AccountSetupMe['accountSignals']['baseSubAccount']
        } | null
      }
    | null
  if (!payload?.success || !payload.data) return null
  const ownerFlag =
    payload.data.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true || payload.data.privyIsOwner === true
  return {
    canonicalCswAddress: String(payload.data.canonicalCswAddress ?? ''),
    privyEmbeddedEoaAddress: String(payload.data.privyEmbeddedEoaAddress ?? ''),
    executionTrack: payload.data.executionTrack ?? 'none-yet',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: ownerFlag,
    baseSubAccount: payload.data.baseSubAccount ?? {
      address: null,
      registered: false,
      isDistinctFromCsw: false,
    },
  }
}

function readRetryAfterMs(res: Response): number {
  const raw = res.headers.get('retry-after')
  if (!raw) return BOOTSTRAP_RATE_LIMIT_BACKOFF_MS
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000)
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now())
  return BOOTSTRAP_RATE_LIMIT_BACKOFF_MS
}

async function requestBootstrapExecutionSignals(token: string): Promise<BootstrapExecutionSignals | null> {
  if (Date.now() < bootstrapRateLimitedUntil) return null
  try {
    const res = await apiFetch('/api/onboarding/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Privy-Token': token,
      },
      body: JSON.stringify({}),
    })
    if (res.status === 429) {
      bootstrapRateLimitedUntil = Date.now() + readRetryAfterMs(res)
      return null
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) return null
    return parseBootstrapResponse(body)
  } catch {
    return null
  }
}

export function invalidateBootstrapExecutionSignalsCache(): void {
  bootstrapCached = null
  bootstrapInFlight = null
}

export async function fetchBootstrapExecutionSignals(
  getAccessToken: () => Promise<string | null>,
): Promise<BootstrapExecutionSignals | null> {
  const token = await getAccessToken().catch(() => null)
  if (!token) return null

  const tokenFingerprint = readTokenFingerprint(token)
  const now = Date.now()
  if (
    bootstrapCached &&
    bootstrapCached.tokenFingerprint === tokenFingerprint &&
    bootstrapCached.expiresAt > now
  ) {
    return bootstrapCached.value
  }
  if (bootstrapInFlight) return bootstrapInFlight

  bootstrapInFlight = requestBootstrapExecutionSignals(token)
    .then((value) => {
      bootstrapCached = {
        tokenFingerprint,
        value,
        expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
      }
      return value
    })
    .finally(() => {
      bootstrapInFlight = null
    })

  return bootstrapInFlight
}

export function mergeBootstrapSignals(
  payload: AccountSetupMe | null,
  bootstrap: BootstrapExecutionSignals,
): AccountSetupMe {
  const baseSignals = payload?.accountSignals
  const executionTrack =
    baseSignals?.executionTrack && baseSignals.executionTrack !== 'none-yet'
      ? baseSignals.executionTrack
      : bootstrap.executionTrack
  const privyEmbeddedEoaIsOwnerOfCanonicalCsw =
    baseSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
      ? true
      : bootstrap.privyEmbeddedEoaIsOwnerOfCanonicalCsw
        ? true
        : (baseSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw ?? null)

  const mergedAccount = mergeCanonicalWaitlistAccount(
    {
      privyUserId: payload?.privyUserId ?? '',
      email: payload?.email ?? null,
      emailVerified: payload?.emailVerified ?? false,
      appAccessStatus: payload?.appAccessStatus ?? null,
      baseSubAccount: payload?.baseSubAccount ?? bootstrap.baseSubAccount.address,
      linkedMethods: payload?.linkedMethods ?? {},
      score: payload?.score ?? { points: 0, tier: 0 },
      accountSignals: {
        linked: baseSignals?.linked ?? false,
        canonicalCswAddress: baseSignals?.canonicalCswAddress ?? bootstrap.canonicalCswAddress ?? null,
        creatorCoin: baseSignals?.creatorCoin ?? null,
        zoraHandle: baseSignals?.zoraHandle ?? null,
        lastResolvedAt: baseSignals?.lastResolvedAt ?? null,
        baseSubAccount: baseSignals?.baseSubAccount ?? bootstrap.baseSubAccount,
        executionTrack,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw,
      },
    },
    bootstrap,
  )

  return mergedAccount
}

export async function mergeAccountMeWithBootstrap(
  payload: AccountSetupMe,
  getAccessToken: () => Promise<string | null>,
): Promise<AccountSetupMe> {
  const bootstrap = await fetchBootstrapExecutionSignals(getAccessToken)
  if (!bootstrap) return payload
  return mergeBootstrapSignals(payload, bootstrap)
}
