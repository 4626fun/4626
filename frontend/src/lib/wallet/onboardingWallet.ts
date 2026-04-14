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
    if (lower.includes('aa23') || (lower.includes('validateuserop') && lower.includes('revert'))) {
      return new Error(
        'Smart wallet signature validation failed during sponsorship (AA23). Reconnect the same Base smart wallet session and retry.',
      )
    }
    if (lower.includes('paymaster proxy internal error')) {
      return new Error(
        '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
      )
    }
    if (lower.includes('paymaster rejected this request')) {
      const reason = message
        .replace(/^.*paymaster rejected this request:\s*/i, '')
        .trim()
      const normalizedReason = reason ? reason.replace(/\s+/g, ' ').trim() : ''
      return new Error(
        normalizedReason
          ? `Gas sponsorship was rejected for this approval (${normalizedReason}). Retry in Base app after reconnecting the same wallet session.`
          : 'Gas sponsorship was rejected for this approval. Retry in Base app after reconnecting the same wallet session.',
      )
    }
    if (lower.includes('paymaster') && lower.includes('insufficient funds')) {
      return new Error(
        'Gas sponsorship failed due to paymaster funding limits. This is a sponsor-side budget/policy issue, not your wallet ETH balance.',
      )
    }
    if (lower.includes('paymaster') && lower.includes('insufficient sponsorship funds')) {
      return new Error(
        'Gas sponsorship failed due to paymaster funding limits. This is a sponsor-side budget/policy issue, not your wallet ETH balance.',
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

function isRetryablePaymasterSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('paymaster proxy internal error') ||
    lower.includes('request denied - no_session') ||
    lower.includes('request denied - not authenticated')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const CONFIRM_OWNER_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 5 : 1_500
const CONFIRM_OWNER_MAX_ATTEMPTS = 6
const PAYMASTER_SESSION_MAX_ATTEMPTS = 3
const PAYMASTER_SESSION_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 5 : 300
const SEND_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 8_000
const SEND_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500
const PREFER_SPONSORED_CANONICAL_SELF_APPROVAL = true

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function isSendCallsUnsupportedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error ? Number((error as { code?: unknown }).code) : Number.NaN
  if (Number.isFinite(code) && (code === -32601 || code === 4200)) return true

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('method not found') ||
    lower.includes('unsupported method') ||
    lower.includes('method is not supported') ||
    lower.includes('does not support')
  )
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')
}

function isValidationRevertedUserOpError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('aa23') ||
    (lower.includes('validateuserop') && lower.includes('revert')) ||
    lower.includes('validation reverted')
  )
}

async function submitOwnerTxViaWalletSendCalls(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
}): Promise<`0x${string}`> {
  const callBundle = await params.walletRequest({
    method: 'wallet_sendCalls',
    params: [
      {
        chainId: `0x${params.chainId.toString(16)}`,
        from: params.sender,
        calls: [{ to: params.to, data: params.data, value: '0x0' }],
        atomicRequired: false,
        version: '2.0.0',
      },
    ],
  })
  const callsId =
    typeof callBundle === 'string'
      ? callBundle
      : callBundle && typeof callBundle === 'object' && typeof (callBundle as { id?: unknown }).id === 'string'
        ? String((callBundle as { id: string }).id)
        : ''
  if (!callsId) throw new Error('wallet_sendCalls returned no call bundle id')

  const startedAt = Date.now()
  while (Date.now() - startedAt < SEND_CALLS_STATUS_TIMEOUT_MS) {
    const result = await params.walletRequest({ method: 'wallet_getCallsStatus', params: [callsId] })
    const statusCode = Number((result as { status?: unknown } | null)?.status)
    const receipts = Array.isArray((result as { receipts?: unknown[] } | null)?.receipts)
      ? ((result as { receipts: unknown[] }).receipts ?? [])
      : []
    const receiptHash =
      receipts
        .map((receipt) => String((receipt as { transactionHash?: unknown } | null)?.transactionHash ?? ''))
        .find((value) => isTxHash(value)) ?? null
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 200 && statusCode < 300) {
        if (receiptHash) return receiptHash
        throw new Error('wallet_sendCalls completed without a transaction hash yet. Retry confirmation shortly.')
      }
      if (statusCode >= 300) throw new Error(`wallet_sendCalls failed with status ${statusCode}`)
    }
    await delay(SEND_CALLS_STATUS_POLL_MS)
  }

  throw new Error('wallet_sendCalls status is still pending. Wait a moment and retry confirmation.')
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

  let txHash: `0x${string}` | null = null
  try {
    if (executionMode === 'canonicalSmartWallet') {
      if (!canonicalSmartWalletAddress || !signerAddress) {
        throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
      }
      if (txRequest.to.toLowerCase() !== canonicalSmartWalletAddress.toLowerCase()) {
        throw new Error('Prepared owner install target does not match the canonical Coinbase Smart Wallet.')
      }
      const runSponsoredCanonicalUserOp = async () => {
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

        let result: Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>> | null = null
        let lastRetryableError: unknown = null
        for (let attempt = 0; attempt < PAYMASTER_SESSION_MAX_ATTEMPTS; attempt += 1) {
          try {
            result = await runUserOp()
            break
          } catch (attemptError) {
            if (!isRetryablePaymasterSessionError(attemptError)) throw attemptError
            lastRetryableError = attemptError
            if (typeof ensurePaymasterSession === 'function') {
              await ensurePaymasterSession().catch(() => false)
            }
            const hasNextAttempt = attempt + 1 < PAYMASTER_SESSION_MAX_ATTEMPTS
            if (hasNextAttempt) {
              await delay(PAYMASTER_SESSION_RETRY_DELAY_MS * (attempt + 1))
            }
          }
        }
        if (!result) throw (lastRetryableError ?? new Error('Paymaster session retry exhausted.'))
        return result.transactionHash
      }
      const selfAuthenticatedCanonicalSession =
        signerAddress.toLowerCase() === canonicalSmartWalletAddress.toLowerCase()

      if (selfAuthenticatedCanonicalSession) {
        if (!walletClient.account) {
          throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
        }
        if (PREFER_SPONSORED_CANONICAL_SELF_APPROVAL) {
          try {
            txHash = await runSponsoredCanonicalUserOp()
          } catch (sponsoredError) {
            if (!isValidationRevertedUserOpError(sponsoredError)) throw sponsoredError
            const walletRequest =
              typeof walletClient.request === 'function'
                ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
                : null
            if (walletRequest) {
              txHash = await submitOwnerTxViaWalletSendCalls({
                walletRequest,
                chainId: txRequest.chainId,
                sender: canonicalSmartWalletAddress as `0x${string}`,
                to: txRequest.to,
                data: txRequest.data,
              })
            } else {
              if (typeof walletClient.sendTransaction !== 'function') throw sponsoredError
              txHash = await walletClient.sendTransaction({
                account: walletClient.account,
                chain: base,
                to: txRequest.to,
                data: txRequest.data,
                value: 0n,
              })
            }
          }
        } else {
        const walletRequest =
          typeof walletClient.request === 'function'
            ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
            : null

        let sendCallsFallbackMode: 'unsupported' | 'insufficient' | null = null
        if (walletRequest) {
          try {
            txHash = await submitOwnerTxViaWalletSendCalls({
              walletRequest,
              chainId: txRequest.chainId,
              sender: canonicalSmartWalletAddress as `0x${string}`,
              to: txRequest.to,
              data: txRequest.data,
            })
          } catch (sendCallsError) {
            if (isUserRejectedWalletAction(sendCallsError)) throw sendCallsError
            if (isSendCallsUnsupportedError(sendCallsError)) {
              sendCallsFallbackMode = 'unsupported'
            } else {
              const message = sendCallsError instanceof Error ? sendCallsError.message : String(sendCallsError ?? '')
              const lower = message.toLowerCase()
              const shouldRetrySponsored =
                (lower.includes('error generating transaction') && lower.includes('enough funds')) ||
                lower.includes('insufficient funds')
              if (!shouldRetrySponsored) throw sendCallsError
              sendCallsFallbackMode = 'insufficient'
            }
          }
        }

        if (!txHash) {
          try {
            txHash = await runSponsoredCanonicalUserOp()
          } catch (sponsoredError) {
            if (sendCallsFallbackMode === 'insufficient') throw sponsoredError
            if (typeof walletClient.sendTransaction !== 'function') {
              throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
            }
            txHash = await walletClient.sendTransaction({
              account: walletClient.account,
              chain: base,
              to: txRequest.to,
              data: txRequest.data,
              value: 0n,
            })
          }
        }
        }
      } else {
        txHash = await runSponsoredCanonicalUserOp()
      }
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
  if (!txHash) {
    throw new Error('Failed to submit the owner approval transaction.')
  }

  const headers = await authHeaders()
  let lastPayload: ApiEnvelope<ConfirmOwnerResponse> | null = null
  let lastMessage = 'Owner status is not confirmed yet. Please retry in a moment.'
  for (let attempt = 0; attempt < CONFIRM_OWNER_MAX_ATTEMPTS; attempt += 1) {
    const confirmRes = await apiFetch('/api/wallet/confirm-owner', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        txHash,
        ownerAddress: ownerAddress ?? null,
      }),
    })
    const confirmPayload = (await confirmRes.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
    lastPayload = confirmPayload

    if (confirmRes.ok && confirmPayload?.success && confirmPayload.data?.isOwner) {
      return confirmPayload.data
    }

    lastMessage = readApiError(confirmPayload, 'Owner status is not confirmed yet.')
    const canRetry =
      attempt + 1 < CONFIRM_OWNER_MAX_ATTEMPTS &&
      (
        (confirmRes.ok && confirmPayload?.success && confirmPayload?.data?.isOwner === false) ||
        String(lastMessage).toLowerCase().includes('not confirmed')
      )
    if (!canRetry) break
    await delay(CONFIRM_OWNER_RETRY_DELAY_MS)
  }

  throw buildOwnerDelegationError(lastPayload, lastMessage)
}
