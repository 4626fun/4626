import { apiFetch } from '@/lib/api/apiBase'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { isAddress } from 'viem'
import { base } from 'viem/chains'
import { detectSignatureShape } from './signatureShape'
import {
  classifyOwnerApprovalError,
  isRetryablePaymasterSessionError,
  messageHasOwnerApprovalDebugTag,
  normalizeOwnerApprovalError,
} from './onboardingWalletErrors'
import {
  _submitOwnerViaSelfBuiltUserOp,
  encodeExecuteWithoutChainIdValidation,
  unwrapDoubleHexEncodedHash,
  REPLAYABLE_INNER_SELECTORS,
} from './onboardingWalletReplayable'
import {
  _submitOwnerViaPreparedCalls,
  _submitOwnerViaPreparedCallsAllowAnyOwner,
  _submitOwnerViaPreparedCallsWithEoaOwner,
  _submitOwnerViaWalletSendCalls,
  buildSendPreparedCallsSignaturePayload,
} from './onboardingWalletPrepared'
import {
  buildOwnerDelegationError,
  deriveOwnerDelegationFlags,
  readApiError,
  shouldRefreshOwnerDelegationOnForeground,
} from './onboardingWalletDelegation'
export type { ApiEnvelope } from '@/lib/api/apiEnvelope'
export { normalizeOwnerApprovalError } from './onboardingWalletErrors'
export {
  _submitOwnerViaSelfBuiltUserOp,
  encodeExecuteWithoutChainIdValidation,
  preflightOwnerKeyMismatch,
  unwrapDoubleHexEncodedHash,
} from './onboardingWalletReplayable'
export {
  _submitOwnerViaPreparedCalls,
  _submitOwnerViaPreparedCallsAllowAnyOwner,
  _submitOwnerViaPreparedCallsWithEoaOwner,
  _submitOwnerViaWalletSendCalls,
  buildSendPreparedCallsSignaturePayload,
} from './onboardingWalletPrepared'
export type {
  PreparedCallsSignaturePayloadMode,
  PreparedCallsSignHashMode,
  PreparedCallsSignRequestMode,
} from './onboardingWalletPrepared'
export type { OwnerDelegationFlags } from './onboardingWalletDelegation'
export {
  buildOwnerDelegationError,
  deriveOwnerDelegationFlags,
  readApiError,
  readOwnerDelegationFlags,
  shouldRefreshOwnerDelegationOnForeground,
} from './onboardingWalletDelegation'

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
      sponsorship?: {
        customOwnerPolicyToken?: string
      }
    }

export type ConfirmOwnerResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
  confirmationState?: 'owner_confirmed' | 'pending_tx' | 'owner_not_found_yet' | 'tx_failed'
}

export type PreparedOwnerTxRequest = {
  chainId: 8453
  to: `0x${string}`
  data: `0x${string}`
  value: '0x0'
}

export type OwnerApprovalExecutionMode = 'canonicalSmartWallet' | 'ownerDirect' | 'subAccount'
export type OwnerInstallIntent = 'embeddedOwner' | 'customCoOwner'

export type OwnerApprovalStage =
  | 'preflight'
  | 'prepare'
  | 'prepare_calls'
  | 'userop_typed'
  | 'userop_nontyped'
  | 'send_calls'
  | 'add_sub_account'
  | 'confirm_owner'

export type OwnerApprovalStageStatus = 'start' | 'retry' | 'success' | 'error'

export type OwnerApprovalStageEvent = {
  runId: string
  stage: OwnerApprovalStage
  status: OwnerApprovalStageStatus
  attempt?: number
  executionMode: OwnerApprovalExecutionMode
  signerAddress?: string | null
  canonicalCswAddress?: string | null
  txHash?: string | null
  code?: string
  message?: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const CONFIRM_OWNER_RETRY_DELAY_BASE_MS = import.meta.env.MODE === 'test' ? 5 : 1_500
const CONFIRM_OWNER_MAX_ATTEMPTS = import.meta.env.MODE === 'test' ? 6 : 10
const PAYMASTER_SESSION_MAX_ATTEMPTS = 3
const PAYMASTER_SESSION_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 5 : 300
const USER_OP_SUBMIT_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 120 : 45_000
const PREPARED_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 12_000
const PREPARED_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500
const ENTRY_POINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const
const REPLAYABLE_NONCE_KEY = 8453n

function getConfirmOwnerRetryDelayMs(attempt: number): number {
  const multiplier = Math.min(5, Math.max(1, attempt + 1))
  return CONFIRM_OWNER_RETRY_DELAY_BASE_MS * multiplier
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function toOwnerApprovalDebugError(input: {
  error: unknown
  runId: string
  stage: OwnerApprovalStage
  attempt?: number | null
  lane: 'embedded_owner_sponsored' | 'custom_co_owner_direct'
}): Error {
  const baseMessage =
    input.error instanceof Error
      ? input.error.message
      : String(input.error ?? 'Owner approval failed')
  const details = [
    `runId=${input.runId}`,
    `stage=${input.stage}`,
    `attempt=${input.attempt ?? 'na'}`,
    `lane=${input.lane}`,
    `code=${classifyOwnerApprovalError(input.error).code}`,
  ].join(';')
  return new Error(`${baseMessage} [oa-debug:${details}]`)
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')
}

function emitOwnerApprovalStage(
  callback: ((event: OwnerApprovalStageEvent) => void) | null | undefined,
  event: OwnerApprovalStageEvent,
): void {
  try {
    callback?.(event)
  } catch {}
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
  ownerIndexLookupAddress?: string | null
  signerAddress?: string | null
  executionMode: OwnerApprovalExecutionMode
  canonicalSmartWalletAddress?: string | null
  publicClient?: unknown
  ensurePaymasterSession?: (() => Promise<boolean>) | null
  approvalRunId?: string | null
  onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
  ownerInstallIntent?: OwnerInstallIntent
  customOwnerPolicyToken?: string | null
  preferSponsoredFirst?: boolean
  enforceSelfAuthEmbeddedOwner?: boolean
}): Promise<ConfirmOwnerResponse> {
  const {
    txRequest,
    walletClient,
    chainId,
    switchChainAsync,
    authHeaders,
    ownerAddress,
    ownerIndexLookupAddress,
    signerAddress,
    executionMode,
    canonicalSmartWalletAddress,
    publicClient,
    ensurePaymasterSession,
    approvalRunId,
    onStageEvent,
    ownerInstallIntent,
    customOwnerPolicyToken,
    preferSponsoredFirst,
    enforceSelfAuthEmbeddedOwner,
  } = params
  const effectiveApprovalRunId = typeof approvalRunId === 'string' && approvalRunId.trim() ? approvalRunId.trim() : `approval-${Date.now()}`
  const effectiveOwnerInstallIntent: OwnerInstallIntent = ownerInstallIntent ?? 'embeddedOwner'
  const effectiveCustomOwnerPolicyToken =
    typeof customOwnerPolicyToken === 'string' && customOwnerPolicyToken.trim()
      ? customOwnerPolicyToken.trim()
      : null
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
      const walletAccountAddress =
        typeof walletClient.account === 'string' && isAddress(walletClient.account)
          ? walletClient.account.toLowerCase()
          : typeof walletClient.account === 'object' &&
              walletClient.account !== null &&
              'address' in walletClient.account &&
              typeof (walletClient.account as { address?: unknown }).address === 'string' &&
              isAddress((walletClient.account as { address: string }).address)
            ? (walletClient.account as { address: string }).address.toLowerCase()
            : null
      const canonicalCswLower = canonicalSmartWalletAddress.toLowerCase()
      const selfAuthenticatedCanonicalSession =
        signerAddress.toLowerCase() === canonicalCswLower ||
        walletAccountAddress === canonicalCswLower
      if (
        enforceSelfAuthEmbeddedOwner &&
        effectiveOwnerInstallIntent === 'embeddedOwner' &&
        !selfAuthenticatedCanonicalSession
      ) {
        throw new Error(
          'Reconnect with your canonical Coinbase Smart Wallet session in Base App to enable 4626 signing.',
        )
      }
      const customCoOwnerSponsoredLane =
        effectiveOwnerInstallIntent === 'customCoOwner' && Boolean(effectiveCustomOwnerPolicyToken)
      const customCoOwnerDirectLane =
        effectiveOwnerInstallIntent === 'customCoOwner' && !customCoOwnerSponsoredLane
      const ownerIndexLookupAddressForUserOp =
        selfAuthenticatedCanonicalSession &&
        !customCoOwnerSponsoredLane &&
        typeof ownerIndexLookupAddress === 'string' &&
        isAddress(ownerIndexLookupAddress)
          ? ownerIndexLookupAddress
          : selfAuthenticatedCanonicalSession &&
              effectiveOwnerInstallIntent !== 'customCoOwner' &&
              !preferSponsoredFirst &&
              typeof ownerAddress === 'string' &&
              isAddress(ownerAddress)
            ? ownerAddress
            : null
      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const paymasterUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      const submitSponsoredCanonicalUserOp = async (opts?: { disableTypedDataSigning?: boolean; attempt?: number }) => {
        const stage: OwnerApprovalStage = opts?.disableTypedDataSigning ? 'userop_nontyped' : 'userop_typed'
        emitOwnerApprovalStage(onStageEvent, {
          runId: effectiveApprovalRunId,
          stage,
          status: opts?.attempt && opts.attempt > 1 ? 'retry' : 'start',
          attempt: opts?.attempt,
          executionMode,
          signerAddress,
          canonicalCswAddress: canonicalSmartWalletAddress,
        })
        if (!publicClient) {
          throw new Error('Canonical wallet client is unavailable. Reload and retry.')
        }
        if (typeof ensurePaymasterSession === 'function') {
          const sessionOk = await ensurePaymasterSession()
          if (!sessionOk) {
            throw new Error('Missing 4626 session token for paymaster request.')
          }
        }
        const submitUserOpWithTimeout = async () =>
          await withTimeout(
            sendCoinbaseSmartWalletUserOperation({
              publicClient: publicClient as any,
              walletClient: walletClient as any,
              bundlerUrl: paymasterUrl,
              smartWallet: canonicalSmartWalletAddress as `0x${string}`,
              ownerAddress: signerAddress as `0x${string}`,
              ownerIndexLookupAddress:
                typeof ownerIndexLookupAddressForUserOp === 'string'
                  ? (ownerIndexLookupAddressForUserOp as `0x${string}`)
                  : undefined,
              ownerIndexOverride:
                selfAuthenticatedCanonicalSession && customCoOwnerSponsoredLane ? 0 : undefined,
              calls: [{ to: txRequest.to, data: txRequest.data, value: 0n }],
              version: '1',
              useTypedDataSigning: selfAuthenticatedCanonicalSession && opts?.disableTypedDataSigning !== true,
              ownerApprovalContext: {
                approvalRunId: effectiveApprovalRunId,
                stage,
                executionMode,
                attempt: opts?.attempt ?? null,
                customOwnerPolicyToken: customCoOwnerSponsoredLane ? effectiveCustomOwnerPolicyToken : null,
              },
            }),
            USER_OP_SUBMIT_TIMEOUT_MS,
            new Error('userop_submission_timeout'),
          )

        let result: Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>> | null = null
        let lastRetryableError: unknown = null
        for (let attempt = 0; attempt < PAYMASTER_SESSION_MAX_ATTEMPTS; attempt += 1) {
          try {
            result = await submitUserOpWithTimeout()
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
        if (!result) {
          const terminalError = lastRetryableError ?? new Error('Paymaster session retry exhausted.')
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage,
            status: 'error',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
            code: classifyOwnerApprovalError(terminalError).code,
            message: terminalError instanceof Error ? terminalError.message : String(terminalError ?? ''),
          })
          throw terminalError
        }
        emitOwnerApprovalStage(onStageEvent, {
          runId: effectiveApprovalRunId,
          stage,
          status: 'success',
          executionMode,
          signerAddress,
          canonicalCswAddress: canonicalSmartWalletAddress,
          txHash: result.transactionHash,
        })
        return result.transactionHash
      }
      if (selfAuthenticatedCanonicalSession) {
        if (!walletClient.account) {
          throw new Error('Reconnect the canonical Coinbase Smart Wallet and retry.')
        }
        const walletRequest =
          typeof walletClient.request === 'function'
            ? async (args: { method: string; params?: unknown[] }) => await walletClient.request!(args as any)
            : null

        if (walletRequest) {
          const submitDirectSelfAuthTx = async (): Promise<`0x${string}`> => {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              status: 'start',
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
            })
            const sendTxResult = await walletRequest({
              method: 'eth_sendTransaction',
              params: [{
                from: canonicalSmartWalletAddress,
                to: txRequest.to,
                data: txRequest.data,
                value: '0x0',
              }],
            })
            if (typeof sendTxResult === 'string' && isTxHash(sendTxResult)) {
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                status: 'success',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                txHash: sendTxResult,
              })
              return sendTxResult
            } else {
              throw new Error('eth_sendTransaction did not return a transaction hash.')
            }
          }

          const submitDirectSelfAuthTxWithDiagnostics = async (): Promise<`0x${string}`> => {
            try {
              return await submitDirectSelfAuthTx()
            } catch (sendTxError) {
              if (isUserRejectedWalletAction(sendTxError)) throw sendTxError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(sendTxError).code,
                message: sendTxError instanceof Error ? sendTxError.message : String(sendTxError ?? ''),
              })
              throw toOwnerApprovalDebugError({
                error: sendTxError,
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                attempt: 1,
                lane: 'custom_co_owner_direct',
              })
            }
          }

          const trySponsoredPreferredFallback = async () => {
            try {
              txHash = await submitSponsoredCanonicalUserOp({ attempt: 1 })
              return
            } catch (typedUserOpError) {
              if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_typed',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(typedUserOpError).code,
                message: typedUserOpError instanceof Error ? typedUserOpError.message : String(typedUserOpError ?? ''),
              })
              try {
                txHash = await submitSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
                return
              } catch (nonTypedUserOpError) {
                if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
                throw nonTypedUserOpError
              }
            }
          }

          const trySponsoredCustomCoOwnerFallback = async () => {
            try {
              txHash = await submitSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 1 })
              return
            } catch (nonTypedUserOpError) {
              if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'userop_nontyped',
                status: 'error',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                code: classifyOwnerApprovalError(nonTypedUserOpError).code,
                message: nonTypedUserOpError instanceof Error ? nonTypedUserOpError.message : String(nonTypedUserOpError ?? ''),
              })
              txHash = await submitSponsoredCanonicalUserOp({ attempt: 2 })
            }
          }

          if (customCoOwnerDirectLane) {
            txHash = await submitDirectSelfAuthTxWithDiagnostics()
          } else if (customCoOwnerSponsoredLane) {
            await trySponsoredCustomCoOwnerFallback()
          } else if (preferSponsoredFirst) {
            await trySponsoredPreferredFallback()
          } else {
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              status: 'start',
              attempt: 0,
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
            })
            const expectedAddOwnerAddress =
              effectiveOwnerInstallIntent === 'embeddedOwner'
                ? ownerIndexLookupAddress ?? null
                : ownerAddress ?? null
            const forceRelayFirstForEmbeddedSelfAuth =
              false
            const preferReplayablePreparedCallsFirst =
              effectiveOwnerInstallIntent === 'embeddedOwner' && selfAuthenticatedCanonicalSession
            const preferSelfBuiltRelayFirst =
              !preferReplayablePreparedCallsFirst && (
                forceRelayFirstForEmbeddedSelfAuth ||
              (
                ownerInstallIntent == null &&
                Boolean(canonicalSmartWalletAddress) &&
                Boolean(signerAddress) &&
                signerAddress?.toLowerCase() === canonicalSmartWalletAddress?.toLowerCase()
              )
              )
            const preferWalletSendCallsFirst =
              effectiveOwnerInstallIntent === 'embeddedOwner' &&
              selfAuthenticatedCanonicalSession &&
              !preferReplayablePreparedCallsFirst &&
              !preferSelfBuiltRelayFirst
            try {
              if (preferReplayablePreparedCallsFirst) {
                const innerSelector = txRequest.data.slice(0, 10).toLowerCase()
                if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
                  throw new Error(`Prepared owner install selector ${innerSelector} cannot use the replayable self-auth lane.`)
                }
                const wrappedData = encodeExecuteWithoutChainIdValidation(txRequest.data)
                txHash = await _submitOwnerViaPreparedCalls({
                  walletRequest,
                  chainId: base.id,
                  sender: canonicalSmartWalletAddress as `0x${string}`,
                  to: canonicalSmartWalletAddress as `0x${string}`,
                  data: wrappedData,
                  paymasterUrl: null,
                  approvalRunId: effectiveApprovalRunId,
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  onStageEvent,
                  sessionKind: 'self_auth',
                })
              } else if (preferWalletSendCallsFirst) {
                txHash = await _submitOwnerViaWalletSendCalls({
                  walletRequest,
                  chainId: base.id,
                  sender: canonicalSmartWalletAddress as `0x${string}`,
                  to: txRequest.to,
                  data: txRequest.data,
                  paymasterUrl: null,
                  approvalRunId: effectiveApprovalRunId,
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  onStageEvent,
                })
              } else if (preferSelfBuiltRelayFirst) {
                const relayResult = await _submitOwnerViaSelfBuiltUserOp({
                  walletRequest,
                  chainId: base.id,
                  csw: canonicalSmartWalletAddress as `0x${string}`,
                  innerCallData: txRequest.data as `0x${string}`,
                  expectedOwnerAddress: expectedAddOwnerAddress ? (expectedAddOwnerAddress as `0x${string}`) : null,
                  requireWebAuthnOwnerSignature: effectiveOwnerInstallIntent === 'embeddedOwner',
                  sessionKind: selfAuthenticatedCanonicalSession ? 'self_auth' : 'external_signer',
                  onTelemetry: (event) => {
                    try {
                      if (event.step === 'error') {
                        console.warn('[selfBuiltUserOpRelay]', event.step, event.detail)
                      } else {
                        console.info('[selfBuiltUserOpRelay]', event.step, event.detail)
                      }
                    } catch {}
                  },
                })
                if (relayResult.txHash) {
                  txHash = relayResult.txHash
                } else {
                  throw new Error('selfBuiltUserOpRelay did not return a transaction hash for owner install.')
                }
              } else {
                const innerSelector = txRequest.data.slice(0, 10).toLowerCase()
                if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
                  throw new Error(`Prepared owner install selector ${innerSelector} cannot use the replayable self-auth lane.`)
                }
                const wrappedData = encodeExecuteWithoutChainIdValidation(txRequest.data)
                try {
                  console.info('[replayableDirectOwner]', 'send', {
                    from: canonicalSmartWalletAddress,
                    to: canonicalSmartWalletAddress,
                    innerSelector,
                    wrappedSelector: wrappedData.slice(0, 10),
                  })
                } catch {}
                const directResult = await walletRequest({
                  method: 'eth_sendTransaction',
                  params: [{
                    from: canonicalSmartWalletAddress,
                    to: canonicalSmartWalletAddress,
                    data: wrappedData,
                    value: '0x0',
                  }],
                })
                if (typeof directResult !== 'string' || !isTxHash(directResult)) {
                  throw new Error('eth_sendTransaction did not return a transaction hash for the replayable owner install.')
                }
                txHash = directResult
              }
              emitOwnerApprovalStage(onStageEvent, {
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                status: 'success',
                executionMode,
                signerAddress,
                canonicalCswAddress: canonicalSmartWalletAddress,
                txHash,
              })
            } catch (replayableDirectError) {
              if (isUserRejectedWalletAction(replayableDirectError)) throw replayableDirectError
              if (preferWalletSendCallsFirst) {
                const walletSendCallsErrorMessage =
                  replayableDirectError instanceof Error
                    ? `${replayableDirectError.message}\n${replayableDirectError.stack ?? ''}`
                    : String(replayableDirectError ?? '')
                const shouldSkipPreparedFallback =
                  /(self calls are not allowed|keys\.coinbase\.com|vge)/i.test(walletSendCallsErrorMessage)
                if (!shouldSkipPreparedFallback) {
                  try {
                    txHash = await _submitOwnerViaPreparedCalls({
                      walletRequest,
                      chainId: base.id,
                      sender: canonicalSmartWalletAddress as `0x${string}`,
                      to: txRequest.to,
                      data: txRequest.data,
                      paymasterUrl: null,
                      approvalRunId: effectiveApprovalRunId,
                      executionMode,
                      signerAddress,
                      canonicalCswAddress: canonicalSmartWalletAddress,
                      onStageEvent,
                      sessionKind: 'self_auth',
                    })
                  } catch {}
                }
                if (txHash) {
                  emitOwnerApprovalStage(onStageEvent, {
                    runId: effectiveApprovalRunId,
                    stage: 'send_calls',
                    status: 'success',
                    executionMode,
                    signerAddress,
                    canonicalCswAddress: canonicalSmartWalletAddress,
                    txHash,
                  })
                }
                if (!txHash) {
                  let relayFallbackError: unknown = null
                  try {
                    const relayFallback = await _submitOwnerViaSelfBuiltUserOp({
                      walletRequest,
                      chainId: base.id,
                      csw: canonicalSmartWalletAddress as `0x${string}`,
                      innerCallData: txRequest.data as `0x${string}`,
                      expectedOwnerAddress: expectedAddOwnerAddress ? (expectedAddOwnerAddress as `0x${string}`) : null,
                      requireWebAuthnOwnerSignature: effectiveOwnerInstallIntent === 'embeddedOwner',
                      sessionKind: selfAuthenticatedCanonicalSession ? 'self_auth' : 'external_signer',
                      onTelemetry: (event) => {
                        try {
                          if (event.step === 'error') {
                            console.warn('[selfBuiltUserOpRelay]', event.step, event.detail)
                          } else {
                            console.info('[selfBuiltUserOpRelay]', event.step, event.detail)
                          }
                        } catch {}
                      },
                    })
                    if (relayFallback.txHash) {
                      txHash = relayFallback.txHash
                      emitOwnerApprovalStage(onStageEvent, {
                        runId: effectiveApprovalRunId,
                        stage: 'send_calls',
                        status: 'success',
                        executionMode,
                        signerAddress,
                        canonicalCswAddress: canonicalSmartWalletAddress,
                        txHash,
                      })
                    } else {
                      relayFallbackError = new Error(
                        'selfBuiltUserOpRelay fallback did not return a transaction hash for owner install.',
                      )
                    }
                  } catch (fallbackError) {
                    relayFallbackError = fallbackError
                  }
                  if (!txHash) {
                    const finalReplayableError = relayFallbackError ?? replayableDirectError
                    emitOwnerApprovalStage(onStageEvent, {
                      runId: effectiveApprovalRunId,
                      stage: 'send_calls',
                      status: 'error',
                      executionMode,
                      signerAddress,
                      canonicalCswAddress: canonicalSmartWalletAddress,
                      code: classifyOwnerApprovalError(finalReplayableError).code,
                      message: finalReplayableError instanceof Error
                        ? finalReplayableError.message
                        : String(finalReplayableError ?? ''),
                    })
                    throw finalReplayableError
                  }
                }
              } else if (preferSelfBuiltRelayFirst) {
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'send_calls',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(replayableDirectError).code,
                  message: replayableDirectError instanceof Error
                    ? replayableDirectError.message
                    : String(replayableDirectError ?? ''),
                })
                throw replayableDirectError
              }
              const replayableDirectMessage =
                replayableDirectError instanceof Error
                  ? `${replayableDirectError.message}\n${replayableDirectError.stack ?? ''}`
                  : String(replayableDirectError ?? '')
              let relayFallbackError: unknown = null
              if (/(self calls are not allowed|keys\.coinbase\.com|vge)/i.test(replayableDirectMessage)) {
                try {
                  const relayFallback = await _submitOwnerViaSelfBuiltUserOp({
                    walletRequest,
                    chainId: base.id,
                    csw: canonicalSmartWalletAddress as `0x${string}`,
                    innerCallData: txRequest.data as `0x${string}`,
                    expectedOwnerAddress: expectedAddOwnerAddress ? (expectedAddOwnerAddress as `0x${string}`) : null,
                    requireWebAuthnOwnerSignature: effectiveOwnerInstallIntent === 'embeddedOwner',
                    sessionKind: selfAuthenticatedCanonicalSession ? 'self_auth' : 'external_signer',
                    onTelemetry: (event) => {
                      try {
                        if (event.step === 'error') {
                          console.warn('[selfBuiltUserOpRelay]', event.step, event.detail)
                        } else {
                          console.info('[selfBuiltUserOpRelay]', event.step, event.detail)
                        }
                      } catch {}
                    },
                  })
                  if (relayFallback.txHash) {
                    txHash = relayFallback.txHash
                    emitOwnerApprovalStage(onStageEvent, {
                      runId: effectiveApprovalRunId,
                      stage: 'send_calls',
                      status: 'success',
                      executionMode,
                      signerAddress,
                      canonicalCswAddress: canonicalSmartWalletAddress,
                      txHash,
                    })
                  }
                } catch (fallbackError) {
                  relayFallbackError = fallbackError
                }
              }
              if (!txHash) {
                const finalReplayableError = relayFallbackError ?? replayableDirectError
                emitOwnerApprovalStage(onStageEvent, {
                  runId: effectiveApprovalRunId,
                  stage: 'send_calls',
                  status: 'error',
                  executionMode,
                  signerAddress,
                  canonicalCswAddress: canonicalSmartWalletAddress,
                  code: classifyOwnerApprovalError(finalReplayableError).code,
                  message: finalReplayableError instanceof Error
                    ? finalReplayableError.message
                    : String(finalReplayableError ?? ''),
                })
                throw finalReplayableError
              }
            }
          }
        } else {
          if (customCoOwnerDirectLane) {
            if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
              throw new Error('Signer wallet does not expose eth_sendTransaction in this session. Reconnect and retry.')
            }
            try {
              txHash = await walletClient.sendTransaction({
                account: walletClient.account as any,
                chain: base,
                to: txRequest.to,
                data: txRequest.data,
                value: 0n,
              })
            } catch (sendTxError) {
              if (isUserRejectedWalletAction(sendTxError)) throw sendTxError
              throw toOwnerApprovalDebugError({
                error: sendTxError,
                runId: effectiveApprovalRunId,
                stage: 'send_calls',
                attempt: 1,
                lane: 'custom_co_owner_direct',
              })
            }
          } else {
            if (customCoOwnerSponsoredLane) {
              try {
                txHash = await submitSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 1 })
              } catch (nonTypedUserOpError) {
                if (isUserRejectedWalletAction(nonTypedUserOpError)) throw nonTypedUserOpError
                txHash = await submitSponsoredCanonicalUserOp({ attempt: 2 })
              }
            } else {
              try {
                txHash = await submitSponsoredCanonicalUserOp({ attempt: 1 })
              } catch (typedUserOpError) {
                if (isUserRejectedWalletAction(typedUserOpError)) throw typedUserOpError
                txHash = await submitSponsoredCanonicalUserOp({ disableTypedDataSigning: true, attempt: 2 })
              }
            }
          }
        }
        if (!txHash) {
          throw new Error('Owner approval failed: no execution path produced a result.')
        }
      } else {
        if (customCoOwnerDirectLane) {
          if (!walletClient.account || typeof walletClient.sendTransaction !== 'function') {
            throw new Error('Connect the current owner wallet to submit this co-owner approval.')
          }
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage: 'send_calls',
            status: 'start',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
          })
          try {
            txHash = await walletClient.sendTransaction({
              account: walletClient.account as any,
              chain: base,
              to: txRequest.to,
              data: txRequest.data,
              value: 0n,
            })
          } catch (sendTxError) {
            if (isUserRejectedWalletAction(sendTxError)) throw sendTxError
            emitOwnerApprovalStage(onStageEvent, {
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              status: 'error',
              executionMode,
              signerAddress,
              canonicalCswAddress: canonicalSmartWalletAddress,
              code: classifyOwnerApprovalError(sendTxError).code,
              message: sendTxError instanceof Error ? sendTxError.message : String(sendTxError ?? ''),
            })
            throw toOwnerApprovalDebugError({
              error: sendTxError,
              runId: effectiveApprovalRunId,
              stage: 'send_calls',
              attempt: 1,
              lane: 'custom_co_owner_direct',
            })
          }
          emitOwnerApprovalStage(onStageEvent, {
            runId: effectiveApprovalRunId,
            stage: 'send_calls',
            status: 'success',
            executionMode,
            signerAddress,
            canonicalCswAddress: canonicalSmartWalletAddress,
            txHash,
          })
        } else {
          txHash = await submitSponsoredCanonicalUserOp()
        }
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
  emitOwnerApprovalStage(onStageEvent, {
    runId: effectiveApprovalRunId,
    stage: 'confirm_owner',
    status: 'start',
    attempt: 1,
    executionMode,
    signerAddress,
    canonicalCswAddress: canonicalSmartWalletAddress ?? null,
    txHash,
  })
  for (let attempt = 0; attempt < CONFIRM_OWNER_MAX_ATTEMPTS; attempt += 1) {
    const confirmRes = await apiFetch('/api/wallet/confirm-owner', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        txHash,
        ownerAddress: ownerAddress ?? null,
        approvalRunId: effectiveApprovalRunId,
      }),
    })
    const confirmPayload = (await confirmRes.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
    lastPayload = confirmPayload

    if (confirmRes.ok && confirmPayload?.success && confirmPayload.data?.isOwner) {
      emitOwnerApprovalStage(onStageEvent, {
        runId: effectiveApprovalRunId,
        stage: 'confirm_owner',
        status: 'success',
        attempt: attempt + 1,
        executionMode,
        signerAddress,
        canonicalCswAddress: confirmPayload.data.canonicalCswAddress,
        txHash,
      })
      return confirmPayload.data
    }

    lastMessage = readApiError(confirmPayload, 'Owner status is not confirmed yet.')
    const confirmationState = confirmPayload?.data?.confirmationState
    const pendingConfirmationState =
      confirmationState === 'pending_tx' || confirmationState === 'owner_not_found_yet'
    const terminalConfirmationState = confirmationState === 'tx_failed'
    const canRetry =
      !terminalConfirmationState &&
      attempt + 1 < CONFIRM_OWNER_MAX_ATTEMPTS &&
      (
        pendingConfirmationState ||
        (confirmRes.ok && confirmPayload?.success && confirmPayload?.data?.isOwner === false) ||
        String(lastMessage).toLowerCase().includes('not confirmed')
      )
    if (canRetry) {
      emitOwnerApprovalStage(onStageEvent, {
        runId: effectiveApprovalRunId,
        stage: 'confirm_owner',
        status: 'retry',
        attempt: attempt + 2,
        executionMode,
        signerAddress,
        canonicalCswAddress: canonicalSmartWalletAddress ?? null,
        txHash,
        code: confirmPayload?.data?.confirmationState ?? 'pending_confirmation',
        message: lastMessage,
      })
    }
    if (!canRetry) break
    await delay(getConfirmOwnerRetryDelayMs(attempt))
  }

  emitOwnerApprovalStage(onStageEvent, {
    runId: effectiveApprovalRunId,
    stage: 'confirm_owner',
    status: 'error',
    executionMode,
    signerAddress,
    canonicalCswAddress: canonicalSmartWalletAddress ?? null,
    txHash,
    code: lastPayload?.data?.confirmationState ?? classifyOwnerApprovalError(lastMessage).code,
    message: lastMessage,
  })
  throw buildOwnerDelegationError(lastPayload, lastMessage)
}
