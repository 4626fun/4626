import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'

export type PreparedOwnerTxRequest = {
  chainId: 8453
  to: `0x${string}`
  data: `0x${string}`
  value: '0x0'
}

type PrepareAddPrivyOwnerResponse =
  | { alreadyOwner: true }
  | { alreadyOwner: false; txRequest: PreparedOwnerTxRequest }

export type ConfirmOwnerResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
  confirmationState: 'owner_confirmed' | 'pending_tx' | 'owner_not_found_yet' | 'tx_failed'
}

export async function fetchPrepareAddPrivyOwner(params: {
  headers?: Record<string, string>
}): Promise<PrepareAddPrivyOwnerResponse> {
  const res = await apiFetch('/api/wallet/prepare-add-privy-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(params.headers ?? {}),
    },
    body: JSON.stringify({}),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<PrepareAddPrivyOwnerResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `prepare-add-privy-owner failed (${res.status})`)
  }
  return json.data
}

export async function confirmOwnerInstall(params: {
  cswAddress: string
  ownerAddress: string
  txHash: `0x${string}`
  headers?: Record<string, string>
}): Promise<ConfirmOwnerResponse> {
  const res = await apiFetch('/api/wallet/confirm-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.headers ?? {}),
    },
    body: JSON.stringify({
      cswAddress: params.cswAddress,
      ownerAddress: params.ownerAddress,
      txHash: params.txHash,
    }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `confirm-owner failed (${res.status})`)
  }
  return json.data
}
