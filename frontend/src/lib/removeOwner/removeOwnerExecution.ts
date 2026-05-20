import { encodeFunctionData, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import type { ProgressData } from '@relayprotocol/relay-sdk'

import {
  CSW_OWNER_READ_ABI,
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  RELAY_DEPOSITORY_ABI,
  RELAY_MULTICALL_SELECTOR,
  REMOVE_OWNER_AT_INDEX_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  decodeOwnerAddress,
  extractExecuteQuotePayload,
  extractRelayExecutionTxHash,
  formatCompactEth,
  normalizeRelayStatusEndpoint,
  pollRelayStatusEndpoint,
  validatePreviewRelayUserCallIsNativeDepository,
  type RemoveOwnerPreview,
} from '@/lib/removeOwner/removeOwnerHelpers'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

export type ExecuteRemoveOwnerViaRelayParams = {
  preview: RemoveOwnerPreview
  selectedIndex: number
  cswAddress: `0x${string}`
  publicClient: PublicClient | undefined
  walletRequest: WalletRequest | undefined
  isSelfAuthSession: boolean
  relayQuoteReady: boolean
  relayHookQuote: unknown
  relayHookQuoteError: unknown
  refetchRelayHookQuote: () => Promise<{ data: unknown; status: string }>
  executeQuote: (onProgress: (progress: ProgressData) => void) => Promise<{ data?: unknown } | undefined>
  appendEvent: (row: string) => void
  onTxHash: (txHash: string) => void
}

async function submitSelfAuthViaSendCalls(params: {
  walletRequest: WalletRequest
  cswAddress: `0x${string}`
  calls: Eip5792Call[]
  telemetryPrefix: string
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const sendCallsResult = await _submitOwnerViaSendCalls({
    walletRequest: params.walletRequest,
    csw: params.cswAddress,
    calls: params.calls,
    chainId: base.id,
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        const cap = event.step.includes('error') ? 4000 : 240
        params.appendEvent(`${params.telemetryPrefix}.${event.step}: ${detail.slice(0, cap)}`)
      } catch {
        params.appendEvent(`${params.telemetryPrefix}.${event.step}: <unloggable>`)
      }
    },
  })
  params.appendEvent(`${params.telemetryPrefix}:bundle_id=${sendCallsResult.callBundleId}`)
  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: sendCallsResult.callBundleId,
    timeoutMs: 60_000,
    intervalMs: 1_500,
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        const cap = event.step.includes('error') ? 4000 : 320
        params.appendEvent(`${params.telemetryPrefix}.${event.step}: ${detail.slice(0, cap)}`)
      } catch {
        params.appendEvent(`${params.telemetryPrefix}.${event.step}: <unloggable>`)
      }
    },
  })
  if (!resolution.transactionHash) {
    throw new Error('ERR_SEND_CALLS_STATUS_NO_TX_HASH')
  }
  return resolution.transactionHash
}

export async function executeRemoveOwnerViaRelay(
  params: ExecuteRemoveOwnerViaRelayParams,
): Promise<{ txHash: `0x${string}` }> {
  const { preview, cswAddress, publicClient, appendEvent, onTxHash } = params

  if (params.selectedIndex !== preview.preflight.targetOwnerIndex) {
    throw new Error(
      `Preview is for index ${preview.preflight.targetOwnerIndex} but selection is ${params.selectedIndex}. Re-click the owner row and retry.`,
    )
  }

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

  const requiredDepositWei = BigInt(preview.relay.userCall.value)
  appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

  if (publicClient) {
    appendEvent('precheck:owner_slot_refresh=start')
    const latestTargetOwnerBytes = (await publicClient.readContract({
      address: cswAddress,
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

  if (params.isSelfAuthSession && publicClient) {
    const latestCswBalanceWei = await publicClient.getBalance({ address: cswAddress })
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
        account: cswAddress,
        to: cswAddress,
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
  if (!params.relayQuoteReady) {
    throw new Error(
      'Relay quote options are not ready (missing amount/user/recipient/tx payload). Rebuild preview and retry.',
    )
  }
  appendEvent(`relay:status_endpoint_fallback=${statusEndpoint}`)

  let executeTxHash: `0x${string}` | null = null
  let requestId: `0x${string}` = preview.relay.requestId
  let statusEndpointFromExecute = statusEndpoint

  if (params.isSelfAuthSession) {
    if (!params.walletRequest) {
      throw new Error('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
    }
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
        args: [cswAddress, preview.relay.requestId],
      }),
      value: requestBoundValueHex,
    }
    appendEvent(`request_bound:deposit_to=${requestBoundDepositCall.to}`)
    appendEvent(`request_bound:deposit_value=${requestBoundDepositCall.value}`)
    executeTxHash = await submitSelfAuthViaSendCalls({
      walletRequest: params.walletRequest,
      cswAddress,
      calls: [requestBoundDepositCall],
      telemetryPrefix: 'csw_wallet_sendcalls',
      appendEvent,
    })
    requestId = preview.relay.requestId
    statusEndpointFromExecute = normalizeRelayStatusEndpoint(null, requestId)
  } else {
    let activeQuote = params.relayHookQuote
    if (!activeQuote) {
      appendEvent('relay_quote:refetch=start')
      const refetchResult = await params.refetchRelayHookQuote()
      activeQuote = refetchResult.data
      appendEvent(`relay_quote:refetch=status=${refetchResult.status}`)
    }
    if (!activeQuote) {
      const quoteErrorMessage =
        params.relayHookQuoteError instanceof Error
          ? params.relayHookQuoteError.message
          : params.relayHookQuoteError
            ? String(params.relayHookQuoteError)
            : 'unknown quote error'
      throw new Error(`Relay hook quote unavailable: ${quoteErrorMessage}`)
    }
    const quotedPayload = extractExecuteQuotePayload(activeQuote)
    const quotedRequestId = quotedPayload?.requestId ?? preview.relay.requestId
    appendEvent(`relay_quote:request_id=${quotedRequestId ?? 'n/a'}`)
    appendEvent(`relay_quote:tx_value_wei=${quotedPayload?.txValueWei ?? 'n/a'}`)
    const executeProgressHashes = new Set<string>()
    appendEvent('relay_execute:start')
    const executed = await params.executeQuote((progress: ProgressData) => {
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
        onTxHash(txHash)
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
      onTxHash(executeResultTxHash)
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
      `ERR_RELAY_STATUS_INCOMPLETE:${String((status.raw as Record<string, unknown> | null)?.status ?? 'unknown')}`,
    )
  }

  const verifiedRelayTxHash = status.txHash ?? executeTxHash
  if (!verifiedRelayTxHash) {
    throw new Error(
      'Relay reported success but no execution tx hash was surfaced by status or executeQuote progress.',
    )
  }
  onTxHash(verifiedRelayTxHash)

  if (publicClient) {
    const relayExecutionTx = await publicClient.getTransaction({ hash: verifiedRelayTxHash })
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
    address: cswAddress,
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

  return { txHash: verifiedRelayTxHash }
}
