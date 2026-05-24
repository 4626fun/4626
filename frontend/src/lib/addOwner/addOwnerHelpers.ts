import { apiFetch } from '@/lib/api/apiBase'
import type {
  OwnerMutationRelayDepositSimulation,
  OwnerMutationRelayFlow,
} from '@/lib/relay/ownerMutationTypes'
import { validatePreviewRelayUserCallIsNativeDepository } from '@/lib/removeOwner/removeOwnerHelpers'

const ADD_OWNER_PREVIEW_STORAGE_PREFIX = '4626:add_owner_preview:'

function addOwnerPreviewStorageKey(cswAddress: string): string {
  return `${ADD_OWNER_PREVIEW_STORAGE_PREFIX}${cswAddress.toLowerCase()}`
}

export function persistAddOwnerPreview(cswAddress: string, preview: AddOwnerPreview): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(addOwnerPreviewStorageKey(cswAddress), JSON.stringify(preview))
  } catch {
    /* WebView storage may be unavailable */
  }
}

export function readPersistedAddOwnerPreview(cswAddress: string): AddOwnerPreview | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(addOwnerPreviewStorageKey(cswAddress))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AddOwnerPreview
    return sanitizeAddOwnerRelayPreview(parsed)
  } catch {
    return null
  }
}

export function clearPersistedAddOwnerPreview(cswAddress: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(addOwnerPreviewStorageKey(cswAddress))
  } catch {
    /* ignore */
  }
}

export type AddOwnerPreview = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  calls: Array<{
    to: `0x${string}`
    data: `0x${string}`
    value: `0x${string}`
  }>
  relay: OwnerMutationRelayFlow | null
  preflight: {
    ownerToAdd: `0x${string}`
    alreadyOwner: boolean
    simulation: {
      ok: boolean
      error: string | null
    }
    relayQuoteError: string | null
    counterfactualSubAccount?: boolean
    relayDepositSimulation: OwnerMutationRelayDepositSimulation | null
    relayQuoteDiagnostics: {
      requestId: `0x${string}` | null
      orderId: `0x${string}` | null
      paymentDetails: {
        chainId: number | null
        depository: `0x${string}` | null
        currency: `0x${string}` | null
        amount: string | null
      } | null
      userTransaction: {
        to: `0x${string}`
        value: string
        chainId: number
        dataSelector: string | null
      } | null
      feeUsd: string | null
      rawSnippet: string | null
    } | null
  }
}

/**
 * Add-owner is native ETH Depository.depositNative only — never Relay router multicall / USDC.
 * Fail closed client-side if a stale or misconfigured preview slips through.
 */
export function sanitizeAddOwnerRelayPreview(preview: AddOwnerPreview): AddOwnerPreview {
  if (preview.preflight.alreadyOwner || !preview.relay) return preview
  const guard = validatePreviewRelayUserCallIsNativeDepository(preview, { depositoryOnly: true })
  if (!guard) return preview
  return {
    ...preview,
    relay: null,
    calls: [],
    preflight: {
      ...preview.preflight,
      relayQuoteError: preview.preflight.relayQuoteError ?? guard,
    },
  }
}

export async function fetchAddOwnerPreview(params: {
  connectedAddress: string
  /** When set, add-owner targets this CSW (e.g. app sub-account) instead of the canonical parent CSW. */
  targetCswAddress?: string | null
  /** CSW that pays Relay Part 1 in self-auth mode — pins server-side funder balance reads. */
  relayFundingCswAddress?: string | null
  headers?: Record<string, string>
}): Promise<AddOwnerPreview> {
  const body: Record<string, string> = {
    connectedAddress: params.connectedAddress,
  }
  if (params.targetCswAddress?.trim()) {
    body.targetCswAddress = params.targetCswAddress.trim()
  }
  if (params.relayFundingCswAddress?.trim()) {
    body.relayFundingCswAddress = params.relayFundingCswAddress.trim()
  }

  const res = await apiFetch('/api/onboarding/preview-add-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(params.headers ?? {}),
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
    data?: AddOwnerPreview
  } | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `preview-add-owner failed (${res.status})`)
  }
  return sanitizeAddOwnerRelayPreview(json.data)
}
