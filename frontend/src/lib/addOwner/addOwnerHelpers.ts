import { apiFetch } from '@/lib/api/apiBase'
import type {
  OwnerMutationRelayDepositSimulation,
  OwnerMutationRelayFlow,
} from '@/lib/relay/ownerMutationTypes'
import { validatePreviewRelayUserCallIsNativeDepository } from '@/lib/removeOwner/removeOwnerHelpers'

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
  headers?: Record<string, string>
}): Promise<AddOwnerPreview> {
  const body: Record<string, string> = {
    connectedAddress: params.connectedAddress,
  }
  if (params.targetCswAddress?.trim()) {
    body.targetCswAddress = params.targetCswAddress.trim()
  }

  const res = await apiFetch('/api/onboarding/preview-add-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
