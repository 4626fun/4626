import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { encodeFunctionData, type PublicClient } from 'viem'
import { useQuote } from '@relayprotocol/relay-kit-hooks'
import { type paths, type ProgressData } from '@relayprotocol/relay-sdk'

import { PageMeta } from '@/components/seo/PageMeta'
import { RemoveOwnerActionPanel } from '@/features/accountSetup/removeOwner/RemoveOwnerActionPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { RemoveOwnerOwnerSlotsCard } from '@/features/accountSetup/removeOwner/RemoveOwnerOwnerSlotsCard'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { encodeExecuteWithoutChainIdValidation } from '@/lib/wallet/onboardingWalletReplayable'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  CSW_OWNER_READ_ABI,
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  NATIVE_CURRENCY_ADDRESS,
  RELAY_DEPOSITORY_ABI,
  RELAY_MULTICALL_SELECTOR,
  REMOVE_OWNER_AT_INDEX_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import {
  decodeOwnerAddress,
  extractExecuteQuotePayload,
  extractRelayExecutionTxHash,
  getWalletErrorMessage,
  formatCompactEth,
  INITIAL_DIAGNOSTICS,
  loadLiveCswDiagnostics,
  mapRemoveOwnerSubmissionError,
  normalizeRelayStatusEndpoint,
  pollRelayStatusEndpoint,
  toRelayAmountDecimal,
  validatePreviewRelayUserCallIsNativeDepository,
  type LiveDiagnostics,
  type RemoveOwnerPreview,
} from '@/lib/removeOwner/removeOwnerHelpers'
import { createRemoveOwnerRelayClient } from '@/lib/removeOwner/removeOwnerRelayClient'

type RelayQuoteBody = paths['/quote/v2']['post']['requestBody']['content']['application/json']

export function RemoveOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/remove-owner' })
  const {
    canonicalCswAddress,
    loading,
    privyAuthed,
    login,
    ownerSignerAddress,
  } = controller
  const { data: walletClient } = useWalletClient()

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalUrl = useMemo(() => externalBrowserUrlFor('/remove-owner'), [])

  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics>(INITIAL_DIAGNOSTICS)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<RemoveOwnerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRequestIdRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    revertReason: string | null
    revertData: string | null
    relayTx: unknown
    rawBody: string | null
  } | null>(null)

  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined
  const relayClient = useMemo(() => createRemoveOwnerRelayClient(), [])
  const relayQuoteOptions = useMemo<RelayQuoteBody | undefined>(() => {
    if (!preview || !canonicalCswAddress || !ownerSignerAddress) return undefined
    if (!preview.relay) return undefined
    const amountDecimal =
      toRelayAmountDecimal(preview.relay.paymentDetails?.amount) ??
      toRelayAmountDecimal(preview.relay.userCall?.value)
    if (!amountDecimal) return undefined
    return {
      user: ownerSignerAddress,
      recipient: canonicalCswAddress,
      originChainId: base.id,
      destinationChainId: base.id,
      originCurrency: NATIVE_CURRENCY_ADDRESS,
      destinationCurrency: NATIVE_CURRENCY_ADDRESS,
      tradeType: 'EXACT_OUTPUT',
      amount: amountDecimal,
      originGasOverhead: 300000,
      subsidizeFees: true,
      txs: [
        {
          to: canonicalCswAddress,
          data: encodeExecuteWithoutChainIdValidation(preview.txRequest.data),
          value: '0',
        },
      ],
    } satisfies RelayQuoteBody
  }, [canonicalCswAddress, ownerSignerAddress, preview])
  const {
    data: relayHookQuote,
    error: relayHookQuoteError,
    refetch: refetchRelayHookQuote,
    executeQuote,
  } = useQuote(
    relayClient,
    walletClient,
    relayQuoteOptions,
    undefined,
    undefined,
    {
      enabled: Boolean(relayQuoteOptions),
      retry: false,
      refetchOnWindowFocus: false,
    },
  )

  useEffect(() => {
    let cancelled = false
    if (!canonicalCswAddress || !publicClient) {
      setDiagnostics(INITIAL_DIAGNOSTICS)
      return () => {
        cancelled = true
      }
    }
    setDiagnostics({ ...INITIAL_DIAGNOSTICS, status: 'loading' })
    void loadLiveCswDiagnostics({
      publicClient,
      cswAddress: canonicalCswAddress as `0x${string}`,
    }).then((next) => {
      if (!cancelled) setDiagnostics(next)
    })
    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress, publicClient])

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])

  const appendEvent = import.meta.env.DEV
    ? (row: string) => setEventLog((prev) => [...prev, row].slice(-40))
    : () => {}

  const submitSelfAuthViaSendCalls = async (params: {
    calls: Array<{ to: `0x${string}`; data: `0x${string}`; value: `0x${string}` }>
    telemetryPrefix: string
  }): Promise<`0x${string}`> => {
    const request = (walletClient as any)?.request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      throw new Error('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
    }
    const sendCallsResult = await _submitOwnerViaSendCalls({
      walletRequest: async (args) => await request(args),
      csw: canonicalCswAddress as `0x${string}`,
      calls: params.calls,
      chainId: base.id,
      onTelemetry: (event) => {
        try {
          const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
          const cap = event.step.includes('error') ? 4000 : 240
          appendEvent(`${params.telemetryPrefix}.${event.step}: ${detail.slice(0, cap)}`)
        } catch {
          appendEvent(`${params.telemetryPrefix}.${event.step}: <unloggable>`)
        }
      },
    })
    appendEvent(`${params.telemetryPrefix}:bundle_id=${sendCallsResult.callBundleId}`)
    const resolution = await waitForCallsTxHash({
      walletRequest: async (args) => await request(args),
      callBundleId: sendCallsResult.callBundleId,
      timeoutMs: 60_000,
      intervalMs: 1_500,
      onTelemetry: (event) => {
        try {
          const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
          const cap = event.step.includes('error') ? 4000 : 320
          appendEvent(`${params.telemetryPrefix}.${event.step}: ${detail.slice(0, cap)}`)
        } catch {
          appendEvent(`${params.telemetryPrefix}.${event.step}: <unloggable>`)
        }
      },
    })
    if (!resolution.transactionHash) {
      throw new Error('ERR_SEND_CALLS_STATUS_NO_TX_HASH')
    }
    return resolution.transactionHash
  }

  const fetchPreview = async (index: number) => {
    if (!canonicalCswAddress || !ownerSignerAddress) {
      setPageError('Connect a wallet that owns this CSW (or the CSW itself) first.')
      return
    }
    const requestId = ++previewRequestIdRef.current
    setPreviewLoading(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setPreview(null)
    setTxHash(null)
    try {
      const res = await apiFetch('/api/onboarding/preview-remove-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cswAddress: canonicalCswAddress,
          connectedAddress: ownerSignerAddress,
          ownerIndex: index,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        data?: RemoveOwnerPreview
      } | null
      if (requestId !== previewRequestIdRef.current) return
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? `preview-remove-owner failed (${res.status})`)
      }
      setPreview(json.data)
    } catch (err: any) {
      if (requestId !== previewRequestIdRef.current) return
      setPageError(typeof err?.message === 'string' ? err.message : 'Failed to build remove-owner preview.')
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }

  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index)
    void fetchPreview(index)
  }

  const setErrorDetail = (input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
  }

  const handleRemove = async () => {
    if (!preview || !canonicalCswAddress || !walletClient) {
      setPageError('Connect your wallet and select an owner index first.')
      return
    }
    if (selectedIndex !== preview.preflight.targetOwnerIndex) {
      setPageError(
        `Preview is for index ${preview.preflight.targetOwnerIndex} but selection is ${selectedIndex ?? 'none'}. Re-click the owner row and retry.`,
      )
      return
    }
    setBusy(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent('lane:relay_hook_execute_quote')
    appendEvent(`target:function=${preview.preflight.selectedFunction}`)
    appendEvent(`target:index=${preview.preflight.targetOwnerIndex}`)
    appendEvent(`target:owner=${preview.preflight.targetOwnerAddress ?? '<bytes>'}`)
    appendEvent(`target:selector=${preview.txRequest.data.slice(0, 10)}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
    let requiredDepositWei: bigint | null = null
    let latestCswBalanceWei: bigint | null = null
    try {
      if (preview.txRequest.data.slice(0, 10).toLowerCase() !== REMOVE_OWNER_AT_INDEX_SELECTOR) {
        throw new Error(
          `Preview mutation selector mismatch (expected ${REMOVE_OWNER_AT_INDEX_SELECTOR}, got ${preview.txRequest.data.slice(0, 10)}).`,
        )
      }
      if (!preview.relay) {
        throw new Error(
          preview.preflight.relayQuoteError ??
            'Relay quote unavailable; this route requires Relay orchestration.',
        )
      }
      const relayGuard = validatePreviewRelayUserCallIsNativeDepository(preview)
      if (relayGuard) {
        throw new Error(`Relay preview guard failed: ${relayGuard}.`)
      }
      requiredDepositWei = BigInt(preview.relay.userCall.value)
      appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

      if (publicClient) {
        appendEvent('precheck:owner_slot_refresh=start')
        const latestTargetOwnerBytes = (await publicClient.readContract({
          address: canonicalCswAddress as `0x${string}`,
          abi: CSW_OWNER_READ_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(preview.preflight.targetOwnerIndex)],
        })) as `0x${string}`
        appendEvent(`precheck:owner_slot_refresh.bytes=${latestTargetOwnerBytes}`)
        if (latestTargetOwnerBytes.toLowerCase() !== preview.preflight.targetOwnerBytes.toLowerCase()) {
          const latestOwnerAddress = decodeOwnerAddress(latestTargetOwnerBytes)
          throw new Error(
            `Owner slot ${preview.preflight.targetOwnerIndex} changed since preview generation (was ${preview.preflight.targetOwnerAddress ?? preview.preflight.targetOwnerBytes}, now ${latestOwnerAddress ?? latestTargetOwnerBytes}). Re-select the owner and retry.`,
          )
        }
      }

      if (isSelfAuthSession && publicClient) {
        latestCswBalanceWei = await publicClient.getBalance({
          address: canonicalCswAddress as `0x${string}`,
        })
        appendEvent(`precheck:csw_balance_wei=${latestCswBalanceWei.toString(10)}`)
        if (requiredDepositWei > 0n && latestCswBalanceWei < requiredDepositWei) {
          throw new Error(
            `Canonical CSW balance (${formatCompactEth(latestCswBalanceWei)} ETH) is below required Relay deposit (${formatCompactEth(requiredDepositWei)} ETH). Fund the CSW and retry.`,
          )
        }
      }

      if (publicClient) {
        appendEvent('precheck:remove_owner_call_simulation=start')
        try {
          await publicClient.call({
            account: canonicalCswAddress as `0x${string}`,
            to: canonicalCswAddress as `0x${string}`,
            data: preview.txRequest.data,
          })
          appendEvent('precheck:remove_owner_call_simulation=ok')
        } catch (simulationError: unknown) {
          const message =
            simulationError instanceof Error
              ? simulationError.message
              : typeof simulationError === 'string'
                ? simulationError
                : 'unknown simulation error'
          appendEvent(`precheck:remove_owner_call_simulation=failed:${message.slice(0, 220)}`)
          throw new Error(
            `On-chain precheck failed for remove-owner mutation: ${message}. Refresh the owner list and rebuild preview before retrying.`,
          )
        }
      }

      const statusEndpoint = normalizeRelayStatusEndpoint(null, preview.relay.requestId)
      appendEvent(`relay:preview_request_id=${preview.relay.requestId}`)
      appendEvent(`relay:user_call_to=${preview.relay.userCall.to}`)
      appendEvent(`relay:user_call_value=${preview.relay.userCall.value}`)
      appendEvent(`relay:user_call_selector=${preview.relay.userCall.data.slice(0, 10)}`)
      appendEvent(`relay:user_call_source=${preview.relay.userCallSource}`)
      appendEvent(`relay:order_id=${preview.relay.orderId ?? 'n/a'}`)
      if (preview.relay.paymentDetails) {
        appendEvent(`relay:payment_depository=${preview.relay.paymentDetails.depository}`)
        appendEvent(`relay:payment_currency=${preview.relay.paymentDetails.currency}`)
        appendEvent(`relay:payment_amount=${preview.relay.paymentDetails.amount}`)
      }
      if (!relayQuoteOptions) {
        throw new Error(
          'Relay quote options are not ready (missing amount/user/recipient/tx payload). Rebuild preview and retry.',
        )
      }
      appendEvent(`relay:status_endpoint_fallback=${statusEndpoint}`)
      let executeTxHash: `0x${string}` | null = null
      let requestId: `0x${string}` = preview.relay.requestId
      let statusEndpointFromExecute = statusEndpoint
      if (isSelfAuthSession) {
        appendEvent('relay_execute:self_auth_compat_route=request_bound_deposit')
        const requestBoundPaymentDetails = preview.relay.paymentDetails
        const requestBoundDepository =
          requestBoundPaymentDetails &&
          /^0x[0-9a-fA-F]{40}$/.test(requestBoundPaymentDetails.depository)
            ? (requestBoundPaymentDetails.depository as `0x${string}`)
            : null
        const requestBoundValueHex =
          requestBoundPaymentDetails &&
          typeof requestBoundPaymentDetails.amount === 'string' &&
          /^[1-9][0-9]*$/.test(requestBoundPaymentDetails.amount)
            ? (`0x${BigInt(requestBoundPaymentDetails.amount).toString(16)}` as `0x${string}`)
            : null
        if (!requestBoundDepository || !requestBoundValueHex) {
          throw new Error(
            'Relay quote missing request-bound payment fields (depository/amount). Cannot submit self-auth compatibility lane safely.',
          )
        }
        appendEvent(`request_bound:request_id=${preview.relay.requestId}`)
        appendEvent(`request_bound:order_id=${preview.relay.orderId ?? 'n/a'}`)
        const requestBoundDepositCall = {
          to: requestBoundDepository,
          data: encodeFunctionData({
            abi: RELAY_DEPOSITORY_ABI,
            functionName: 'depositNative',
            args: [canonicalCswAddress as `0x${string}`, preview.relay.requestId],
          }),
          value: requestBoundValueHex,
        }
        appendEvent(`request_bound:deposit_to=${requestBoundDepositCall.to}`)
        appendEvent(`request_bound:deposit_value=${requestBoundDepositCall.value}`)
        executeTxHash = await submitSelfAuthViaSendCalls({
          calls: [requestBoundDepositCall],
          telemetryPrefix: 'csw_wallet_sendcalls',
        })
        requestId = preview.relay.requestId
        statusEndpointFromExecute = normalizeRelayStatusEndpoint(null, requestId)
      } else {
        let activeQuote = relayHookQuote
        if (!activeQuote) {
          appendEvent('relay_quote:refetch=start')
          const refetchResult = await refetchRelayHookQuote()
          activeQuote = refetchResult.data
          appendEvent(`relay_quote:refetch=status=${refetchResult.status}`)
        }
        if (!activeQuote) {
          const quoteErrorMessage =
            relayHookQuoteError instanceof Error
              ? relayHookQuoteError.message
              : relayHookQuoteError
                ? String(relayHookQuoteError)
                : 'unknown quote error'
          throw new Error(`Relay hook quote unavailable: ${quoteErrorMessage}`)
        }
        const quotedPayload = extractExecuteQuotePayload(activeQuote)
        const quotedRequestId = quotedPayload?.requestId ?? preview.relay.requestId
        appendEvent(`relay_quote:request_id=${quotedRequestId ?? 'n/a'}`)
        appendEvent(`relay_quote:tx_value_wei=${quotedPayload?.txValueWei ?? 'n/a'}`)
        const executeProgressHashes = new Set<string>()
        appendEvent('relay_execute:start')
        const executed = await executeQuote((progress: ProgressData) => {
          const stepId = progress.currentStep?.id ?? 'unknown'
          const stepKind = progress.currentStep?.kind ?? 'unknown'
          const itemStatus = progress.currentStepItem?.status ?? 'unknown'
          const checkStatus = progress.currentStepItem?.checkStatus ?? 'n/a'
          appendEvent(
            `relay_execute:step=${stepId} kind=${stepKind} status=${itemStatus} check=${checkStatus}`,
          )
          const progressTxHashes = Array.isArray(progress.txHashes) ? progress.txHashes : []
          for (const txEntry of progressTxHashes) {
            const txHash = txEntry?.txHash
            if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) continue
            if (executeProgressHashes.has(txHash)) continue
            executeProgressHashes.add(txHash)
            executeTxHash = txHash as `0x${string}`
            setTxHash(txHash)
            appendEvent(`relay_execute:tx_hash=${txHash} chain=${txEntry.chainId}`)
          }
          if (progress.error) {
            appendEvent(`relay_execute:error=${String(progress.error).slice(0, 220)}`)
          }
        })
        if (!executed?.data) {
          appendEvent('relay_execute:no_data')
          throw new Error(
            'Relay hook executeQuote returned no data. This usually means the wallet execution was cancelled before Relay accepted it.',
          )
        }
        const executedPayload = extractExecuteQuotePayload(executed.data)
        requestId = executedPayload?.requestId ?? quotedRequestId ?? preview.relay.requestId
        appendEvent(`relay_execute:request_id=${requestId}`)
        statusEndpointFromExecute = normalizeRelayStatusEndpoint(
          executedPayload?.statusEndpoint ?? quotedPayload?.statusEndpoint ?? null,
          requestId,
        )
        appendEvent(`relay_execute:status_endpoint=${statusEndpointFromExecute}`)
        const executeResultTxHash = extractRelayExecutionTxHash(executed.data)
        if (executeResultTxHash && !executeTxHash) {
          executeTxHash = executeResultTxHash
          setTxHash(executeResultTxHash)
          appendEvent(`relay_execute:result_tx_hash=${executeResultTxHash}`)
        }
      }
      const status = await pollRelayStatusEndpoint({
        statusEndpoint: statusEndpointFromExecute,
        timeoutMs: 120_000,
        intervalMs: 2_000,
        onTick: (message) => appendEvent(`relay_status.${message}`),
      })
      if (!status.done || !status.success) {
        appendEvent('relay_status.result=failed_or_timeout')
        throw new Error(
          `ERR_RELAY_STATUS_INCOMPLETE:${String((status.raw as any)?.status ?? 'unknown')}`,
        )
      }
      const verifiedRelayTxHash = status.txHash ?? executeTxHash
      if (!verifiedRelayTxHash) {
        throw new Error(
          'Relay reported success but no execution tx hash was surfaced by status or executeQuote progress.',
        )
      }
      setTxHash(verifiedRelayTxHash)
      if (publicClient) {
        const relayExecutionTx = await publicClient.getTransaction({
          hash: verifiedRelayTxHash,
        })
        const relayInput = String(relayExecutionTx.input ?? '').toLowerCase()
        appendEvent(`relay_execution.tx_selector=${relayInput.slice(0, 10) || 'n/a'}`)
        if (!relayInput.startsWith(RELAY_MULTICALL_SELECTOR)) {
          throw new Error(
            `Relay fill tx selector mismatch (expected ${RELAY_MULTICALL_SELECTOR}, got ${relayInput.slice(0, 10) || 'n/a'}).`,
          )
        }
        if (!relayInput.includes(EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.slice(2))) {
          throw new Error(
            `Relay fill tx missing executeWithoutChainIdValidation selector (${EXECUTE_WITHOUT_CHAIN_ID_SELECTOR}).`,
          )
        }
        if (!relayInput.includes(REMOVE_OWNER_AT_INDEX_SELECTOR.slice(2))) {
          throw new Error(
            `Relay fill tx missing removeOwnerAtIndex selector (${REMOVE_OWNER_AT_INDEX_SELECTOR}).`,
          )
        }
        appendEvent('relay_execution.selector_chain=ok')
      }

      const slotAfter = (await publicClient?.readContract({
        address: canonicalCswAddress as `0x${string}`,
        abi: CSW_OWNER_READ_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(preview.preflight.targetOwnerIndex)],
      })) as `0x${string}` | undefined
      const ownerRemoved =
        typeof slotAfter === 'string' &&
        slotAfter.toLowerCase() !== preview.preflight.targetOwnerBytes.toLowerCase()
      if (!ownerRemoved) {
        throw new Error(
          `Relay reported success, but owner slot ${preview.preflight.targetOwnerIndex} is unchanged.`,
        )
      }
      appendEvent('relay_execution.owner_slot_changed=ok')
      setPageNotice(
        `Owner removal confirmed on-chain (execution tx ${verifiedRelayTxHash.slice(0, 10)}…).`,
      )
      setPreview(null)
      setSelectedIndex(null)
    } catch (err: any) {
      appendEvent(`error:${getWalletErrorMessage(err).slice(0, 260)}`)
      if (err && typeof err === 'object') {
        const revertDataCandidate =
          typeof err.data === 'string' ? err.data : typeof err.revertData === 'string' ? err.revertData : null
        if (revertDataCandidate || typeof err.shortMessage === 'string') {
          setErrorDetail({
            revertReason:
              typeof err.shortMessage === 'string'
                ? err.shortMessage
                : typeof err.message === 'string'
                  ? err.message
                  : null,
            revertData: revertDataCandidate,
          })
        }
      }
      const mapped = mapRemoveOwnerSubmissionError({
        error: err,
        requiredDepositWei,
        latestCswBalanceWei,
      })
      setPageError(mapped ?? getWalletErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Remove owner"
        description="Remove an owner from your canonical Coinbase Smart Wallet via Relay two-leg execution with strict completion checks."
        canonicalPath="/remove-owner"
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Account setup
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Remove owner</h1>
          <p className="text-sm text-zinc-400">
            Remove an owner from your canonical Coinbase Smart Wallet through the
            Relay two-leg route. This page only reports success when Relay execution
            succeeds and the owner slot is changed on-chain.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to manage owners on your wallet.
            </p>
            <button
              type="button"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
              className="btn-accent btn-no-icon inline-flex"
            >
              Sign in / Continue
            </button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && !isSelfAuthSession ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-4 text-amber-100">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Open in your browser
              </div>
              <div className="text-sm font-semibold">
                {inAppEnv.isCoinbaseInApp
                  ? "Coinbase Wallet's in-app browser can block the passkey popup"
                  : 'This in-app browser can block the passkey popup'}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-amber-100/85">
              You&apos;re connected as an external signer (not the CSW itself). In-app
              browsers can block prompts or return stale signer context. Open in a
              regular browser for the best chance of success.
            </p>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
            >
              Open 4626.fun/remove-owner in browser
            </a>
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && isSelfAuthSession ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/85">
            In-app browser detected with a CSW self-auth session. This page uses
            Relay hook-native quote execution from the active signer context. If the
            wallet prompt stalls, open the page in an external browser and retry.
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <div className="space-y-4">
            {!canonicalCswAddress ? (
              <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
                <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                <div className="mt-2 text-xs text-zinc-500">
                  Connect your CSW first — head to{' '}
                  <Link to="/accounts" className="underline underline-offset-2">
                    /accounts
                  </Link>
                  .
                </div>
              </div>
            ) : (
              <>
                <RemoveOwnerOwnerSlotsCard
                  canonicalCswAddress={canonicalCswAddress as `0x${string}`}
                  ownerSignerAddress={(ownerSignerAddress as `0x${string}` | null) ?? null}
                  isSelfAuthSession={isSelfAuthSession}
                  diagnostics={diagnostics}
                  selectedIndex={selectedIndex}
                  onSelectIndex={handleSelectIndex}
                />

                {/* Preview + submit */}
                <RemoveOwnerActionPanel
                  previewLoading={previewLoading}
                  preview={preview}
                  busy={busy}
                  isSelfAuthSession={isSelfAuthSession}
                  handleRemove={handleRemove}
                  txHash={txHash}
                  pageNotice={pageNotice}
                  pageError={pageError}
                  lastErrorDetail={lastErrorDetail}
                  eventLog={eventLog}
                />
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500 space-y-1">
          <div>
            Looking to install a signing key instead?{' '}
            <Link to="/add-owner" className="underline underline-offset-2">
              /add-owner
            </Link>
            .
          </div>
          <div>
            Need to fund the CSW before submitting?{' '}
            <Link to="/csw-funding" className="underline underline-offset-2">
              /csw-funding
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemoveOwnerPage
