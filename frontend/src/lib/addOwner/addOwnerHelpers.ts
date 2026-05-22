import { apiFetch } from '@/lib/api/apiBase'
import type { OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'

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

export async function fetchAddOwnerPreview(params: {
  connectedAddress: string
  headers?: Record<string, string>
}): Promise<AddOwnerPreview> {
  const res = await apiFetch('/api/onboarding/preview-add-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.headers ?? {}),
    },
    body: JSON.stringify({
      connectedAddress: params.connectedAddress,
    }),
  })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
    data?: AddOwnerPreview
  } | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `preview-add-owner failed (${res.status})`)
  }
  return json.data
}
