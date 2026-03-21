import { apiFetch } from '@/lib/apiBase'
import { base } from 'viem/chains'

export type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export type OwnerDelegationFlags = {
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
}

export type OnboardingBootstrapResponse = {
  chainId: 8453
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  privyIsOwner: boolean
}

export type PrepareOwnerResponse =
  | { alreadyOwner: true }
  | {
      alreadyOwner: false
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
    }

export type ConfirmOwnerResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
}

export function readApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
}

export function readOwnerDelegationFlags(payload: unknown): OwnerDelegationFlags {
  if (!payload || typeof payload !== 'object') return {}
  const record = payload as Record<string, unknown>
  return {
    ...(record.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
    ...(record.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
    ...(typeof record.baseAppUrl === 'string' && record.baseAppUrl.trim() ? { baseAppUrl: record.baseAppUrl.trim() } : null),
  }
}

export function buildOwnerDelegationError(payload: unknown, fallback: string): Error & OwnerDelegationFlags {
  const flags = readOwnerDelegationFlags(payload)
  const hint = flags.needsBaseAppSetup
    ? 'Open Base app, create or connect your Coinbase Smart Wallet, then return here to resume.'
    : flags.needsEmbeddedWallet
      ? 'Your Privy embedded wallet is still provisioning. Retry in a moment.'
      : ''
  const message = hint ? `${readApiError(payload, fallback)} ${hint}` : readApiError(payload, fallback)
  const error = new Error(message) as Error & OwnerDelegationFlags
  if (flags.needsEmbeddedWallet) error.needsEmbeddedWallet = true
  if (flags.needsBaseAppSetup) error.needsBaseAppSetup = true
  if (flags.baseAppUrl) error.baseAppUrl = flags.baseAppUrl
  return error
}

export function deriveOwnerDelegationFlags(flags: {
  needsEmbeddedWallet: boolean
  needsBaseAppSetup: boolean
  baseAppUrl: string | null
}): OwnerDelegationFlags | null {
  if (!flags.needsBaseAppSetup && !flags.needsEmbeddedWallet) return null
  return {
    ...(flags.needsBaseAppSetup ? { needsBaseAppSetup: true } : null),
    ...(flags.needsEmbeddedWallet ? { needsEmbeddedWallet: true } : null),
    ...(flags.baseAppUrl ? { baseAppUrl: flags.baseAppUrl } : null),
  }
}

export function shouldRefreshOwnerDelegationOnForeground(input: {
  privyAuthed: boolean
  ownerDelegationFlags: OwnerDelegationFlags | null
  busy: boolean
}): boolean {
  if (!input.privyAuthed || input.busy) return false
  return Boolean(input.ownerDelegationFlags?.needsBaseAppSetup || input.ownerDelegationFlags?.needsEmbeddedWallet)
}

export async function sendPreparedOwnerTx(params: {
  txRequest: { chainId: 8453; to: `0x${string}`; data: `0x${string}`; value: '0x0' }
  walletClient: { account?: unknown; sendTransaction: (...args: any[]) => Promise<`0x${string}`> } | null | undefined
  chainId: number | undefined
  switchChainAsync?: ((args: { chainId: typeof base.id }) => Promise<unknown>) | null
  authHeaders: () => Promise<Record<string, string>>
  ownerAddress?: string | null
}): Promise<ConfirmOwnerResponse> {
  const { txRequest, walletClient, chainId, switchChainAsync, authHeaders, ownerAddress } = params
  if (!walletClient || !walletClient.account) {
    throw new Error('Connect an owner wallet to send this transaction.')
  }
  if (chainId !== base.id && typeof switchChainAsync === 'function') {
    await switchChainAsync({ chainId: base.id })
  }

  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain: base,
    to: txRequest.to,
    data: txRequest.data,
    value: 0n,
  })

  const headers = await authHeaders()
  const confirmRes = await apiFetch('/api/wallet/confirm-owner', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      txHash,
      ownerAddress: ownerAddress ?? null,
    }),
  })
  const confirmPayload = (await confirmRes.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
  if (!confirmRes.ok || !confirmPayload?.success || !confirmPayload.data?.isOwner) {
    throw new Error(readApiError(confirmPayload, 'Owner status is not confirmed yet.'))
  }
  return confirmPayload.data
}
