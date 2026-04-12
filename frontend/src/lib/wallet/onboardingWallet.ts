import { apiFetch } from '@/lib/apiBase'
import { resolveApiErrorMessage } from '@/lib/apiEnvelope'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import type { ApiEnvelope } from '@/lib/apiEnvelope'
import { base } from 'viem/chains'
export type { ApiEnvelope } from '@/lib/apiEnvelope'

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

export type PreparedOwnerTxRequest = {
  chainId: 8453
  to: `0x${string}`
  data: `0x${string}`
  value: '0x0'
}

export type OwnerApprovalExecutionMode = 'canonicalSmartWallet' | 'ownerDirect'

export function readApiError(payload: unknown, fallback: string): string {
  return resolveApiErrorMessage(payload, fallback)
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

export function normalizeOwnerApprovalError(error: unknown): Error {
  if (error instanceof Error) {
    const message = String(error.message || '').trim()
    const lower = message.toLowerCase()
    if (lower.includes('paymaster proxy internal error')) {
      return new Error(
        '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
      )
    }
    if (lower.includes('paymaster rejected this request')) {
      return new Error(
        'Gas sponsorship was rejected for this approval. Retry in Base app after reconnecting the same wallet session.',
      )
    }
    if (
      (lower.includes('error generating transaction') && lower.includes('enough funds')) ||
      lower.includes('insufficient funds')
    ) {
      return new Error(
        'Wallet could not generate the Coinbase Smart Wallet approval. Retry from the same Base/Zora smart wallet, and reconnect it if the sponsor session has gone stale.',
      )
    }
    if (lower.includes('missing 4626 session token')) {
      return new Error('4626 could not start the smart-wallet sponsor session. Sign in again and retry.')
    }
    if (lower.includes('request denied') || lower.includes('not authenticated')) {
      return new Error('4626 sponsor session was rejected. Sign in again and retry the smart-wallet approval.')
    }
    if (lower.includes('session principal does not own sender csw') || lower.includes('not_owner')) {
      return new Error('The current 4626 session is not authorized for this canonical smart wallet. Reconnect the same Base/Zora wallet and retry.')
    }
    if (lower.includes('not an onchain owner of the smart wallet')) {
      return new Error('The connected signer is not an onchain owner of this Coinbase Smart Wallet. Reconnect a current owner and retry.')
    }
    return error
  }
  return new Error('Failed to submit the owner approval transaction.')
}

export async function sendPreparedOwnerTx(params: {
  txRequest: PreparedOwnerTxRequest
  walletClient:
    | {
        account?: unknown
        sendTransaction?: (...args: any[]) => Promise<`0x${string}`>
        request?: (...args: any[]) => Promise<unknown>
      }
    | null
    | undefined
  chainId: number | undefined
  switchChainAsync?: ((args: { chainId: typeof base.id }) => Promise<unknown>) | null
  authHeaders: () => Promise<Record<string, string>>
  ownerAddress?: string | null
  signerAddress?: string | null
  executionMode: OwnerApprovalExecutionMode
  canonicalSmartWalletAddress?: string | null
  publicClient?: unknown
  ensurePaymasterSession?: (() => Promise<boolean>) | null
}): Promise<ConfirmOwnerResponse> {
  const {
    txRequest,
    walletClient,
    chainId,
    switchChainAsync,
    authHeaders,
    ownerAddress,
    signerAddress,
    executionMode,
    canonicalSmartWalletAddress,
    publicClient,
    ensurePaymasterSession,
  } = params
  if (!walletClient) {
    throw new Error('Connect an owner wallet to send this transaction.')
  }
  if (chainId !== base.id && typeof switchChainAsync === 'function') {
    await switchChainAsync({ chainId: base.id })
  }

  let txHash: `0x${string}`
  try {
    if (executionMode === 'canonicalSmartWallet') {
      if (!canonicalSmartWalletAddress || !signerAddress) {
        throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
      }
      if (txRequest.to.toLowerCase() !== canonicalSmartWalletAddress.toLowerCase()) {
        throw new Error('Prepared owner install target does not match the canonical Coinbase Smart Wallet.')
      }
      if (!publicClient) {
        throw new Error('Canonical wallet client is unavailable. Reload and retry.')
      }
      if (typeof ensurePaymasterSession === 'function') {
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Missing 4626 session token for paymaster request.')
        }
      }
      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      const runUserOp = async () =>
        await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalSmartWalletAddress as `0x${string}`,
          ownerAddress: signerAddress as `0x${string}`,
          calls: [{ to: txRequest.to, data: txRequest.data, value: 0n }],
          version: '1',
        })

      let result: Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>>
      try {
        result = await runUserOp()
      } catch (firstError) {
        const firstMessage =
          firstError instanceof Error ? firstError.message.toLowerCase() : String(firstError ?? '').toLowerCase()
        const shouldRetryOnce =
          firstMessage.includes('paymaster proxy internal error') ||
          firstMessage.includes('request denied - no_session') ||
          firstMessage.includes('request denied - not authenticated')
        if (!shouldRetryOnce) throw firstError
        result = await runUserOp()
      }
      txHash = result.transactionHash
    } else {
      if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
        throw new Error('Connect an owner wallet to send this transaction.')
      }
      txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        chain: base,
        to: txRequest.to,
        data: txRequest.data,
        value: 0n,
      })
    }
  } catch (error) {
    throw normalizeOwnerApprovalError(error)
  }

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
