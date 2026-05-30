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

export async function fetchBootstrapExecutionSignals(
  getAccessToken: () => Promise<string | null>,
): Promise<BootstrapExecutionSignals | null> {
  const token = await getAccessToken().catch(() => null)
  if (!token) return null
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
    const body = (await res.json().catch(() => null)) as
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
    if (!res.ok || !body?.success || !body.data) return null
    const ownerFlag =
      body.data.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true || body.data.privyIsOwner === true
    return {
      canonicalCswAddress: String(body.data.canonicalCswAddress ?? ''),
      privyEmbeddedEoaAddress: String(body.data.privyEmbeddedEoaAddress ?? ''),
      executionTrack: body.data.executionTrack ?? 'none-yet',
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: ownerFlag,
      baseSubAccount: body.data.baseSubAccount ?? {
        address: null,
        registered: false,
        isDistinctFromCsw: false,
      },
    }
  } catch {
    return null
  }
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
