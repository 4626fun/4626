import { type PublicClient } from 'viem'
import { base } from 'viem/chains'

import type { OwnerMutationEip5792Call, OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'
import {
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  extractRelayExecutionTxHash,
  formatCompactEth,
  normalizeRelayStatusEndpoint,
  pollRelayStatusEndpoint,
  resolveRelayStatusRequestId,
  validatePreviewRelayUserCallIsNativeDepository,
} from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationWalletLike } from '@/lib/relay/resolveOwnerMutationWallet'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type ExecuteOwnerMutationViaRelayParams = {
  relay: OwnerMutationRelayFlow
  mutationCalldata: `0x${string}`
  mutationSelector: `0x${string}`
  /** CSW that receives the on-chain owner mutation. */
  cswAddress: `0x${string}`
  /** CSW that pays the Relay deposit in self-auth mode (defaults to `cswAddress`). */
  fundingCswAddress?: `0x${string}`
  publicClient: PublicClient | undefined
  walletClient: OwnerMutationWalletLike
  walletRequest: WalletRequest | undefined
  isSelfAuthSession: boolean
  appendEvent: (row: string) => void
  onTxHash: (txHash: string) => void
  verifyMutation: () => Promise<boolean>
  precheckMutation?: () => Promise<void>
}

async function submitSelfAuthViaSendCalls(params: {
  walletRequest: WalletRequest
  cswAddress: `0x${string}`
  calls: OwnerMutationEip5792Call[]
  atomicRequired?: boolean
  telemetryPrefix: string
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const sendCallsResult = await _submitOwnerViaSendCalls({
    walletRequest: params.walletRequest,
    csw: params.cswAddress,
    calls: params.calls,
    chainId: base.id,
    atomicRequired: params.atomicRequired,
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

async function submitExternalFunderRelayDeposit(params: {
  walletClient: OwnerMutationWalletLike
  userCall: OwnerMutationEip5792Call
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  if (typeof params.walletClient.sendTransaction !== 'function') {
    throw new Error('Connected owner wallet does not expose eth_sendTransaction. Reconnect and retry.')
  }
  const account =
    typeof params.walletClient.account === 'string'
      ? params.walletClient.account
      : typeof params.walletClient.account === 'object' &&
          params.walletClient.account !== null &&
          'address' in params.walletClient.account
        ? (params.walletClient.account as { address: string }).address
        : null
  if (!account) {
    throw new Error('Connected owner wallet is missing an active account. Reconnect and retry.')
  }
  params.appendEvent('relay_execute:external_send_transaction=start')
  const txHash = await params.walletClient.sendTransaction({
    account: params.walletClient.account,
    chain: base,
    to: params.userCall.to,
    data: params.userCall.data,
    value: BigInt(params.userCall.value),
  })
  params.appendEvent(`relay_execute:external_send_transaction=tx_hash=${txHash}`)
  return txHash
}

export async function executeOwnerMutationViaRelay(
  params: ExecuteOwnerMutationViaRelayParams,
): Promise<{ txHash: `0x${string}` }> {
  const { relay, cswAddress, publicClient, appendEvent, onTxHash } = params
  const fundingCswAddress = params.fundingCswAddress ?? cswAddress
  const fundingFromParentWallet =
    fundingCswAddress.toLowerCase() !== cswAddress.toLowerCase()

  const relayGuard = validatePreviewRelayUserCallIsNativeDepository({ relay })
  if (relayGuard) {
    throw new Error(`Relay preview guard failed: ${relayGuard}.`)
  }

  const requiredDepositWei = BigInt(relay.userCall.value)
  appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

  if (params.isSelfAuthSession && publicClient) {
    const latestCswBalanceWei = await publicClient.getBalance({ address: fundingCswAddress })
    appendEvent(`precheck:funding_csw=${fundingCswAddress}`)
    appendEvent(`precheck:funding_csw_balance_wei=${latestCswBalanceWei.toString(10)}`)
    if (requiredDepositWei > 0n && latestCswBalanceWei < requiredDepositWei) {
      const walletLabel = fundingFromParentWallet ? 'Main Base wallet' : 'Smart wallet'
      const targetHint = fundingFromParentWallet
        ? ' Fund your main Base smart wallet (not the app wallet) and retry.'
        : ' Fund the smart wallet and retry.'
      throw new Error(
        `${walletLabel} balance (${formatCompactEth(latestCswBalanceWei)} ETH) is below required Relay deposit (${formatCompactEth(requiredDepositWei)} ETH).${targetHint}`,
      )
    }
  }

  if (params.precheckMutation) {
    await params.precheckMutation()
  } else if (publicClient) {
    appendEvent('precheck:mutation_call_simulation=start')
    try {
      await publicClient.call({
        account: cswAddress,
        to: cswAddress,
        data: params.mutationCalldata,
      })
      appendEvent('precheck:mutation_call_simulation=ok')
    } catch (simulationError: unknown) {
      const message =
        simulationError instanceof Error
          ? simulationError.message
          : typeof simulationError === 'string'
            ? simulationError
            : 'unknown simulation error'
      appendEvent(`precheck:mutation_call_simulation=failed:${message.slice(0, 220)}`)
      throw new Error(
        `On-chain precheck failed for owner mutation: ${message}. Rebuild preview before retrying.`,
      )
    }
  }

  const statusRequestId = resolveRelayStatusRequestId(relay)
  let statusEndpoint = normalizeRelayStatusEndpoint(null, statusRequestId)
  appendEvent(`relay:preview_request_id=${relay.requestId}`)
  appendEvent(`relay:status_request_id=${statusRequestId}`)
  appendEvent(`relay:user_call_to=${relay.userCall.to}`)
  appendEvent(`relay:user_call_value=${relay.userCall.value}`)
  appendEvent(`relay:user_call_selector=${relay.userCall.data.slice(0, 10)}`)
  appendEvent(`relay:user_call_source=${relay.userCallSource}`)
  appendEvent(`relay:order_id=${relay.orderId ?? 'n/a'}`)
  if (relay.paymentDetails) {
    appendEvent(`relay:payment_depository=${relay.paymentDetails.depository}`)
    appendEvent(`relay:payment_currency=${relay.paymentDetails.currency}`)
    appendEvent(`relay:payment_amount=${relay.paymentDetails.amount}`)
  }
  appendEvent(`relay:status_endpoint=${statusEndpoint}`)

  let executeTxHash: `0x${string}` | null = null

  if (params.isSelfAuthSession) {
    if (!params.walletRequest) {
      throw new Error('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
    }
    appendEvent('relay_execute:self_auth_route=preview_user_call_send_calls')
    appendEvent(`relay_execute:funding_csw=${fundingCswAddress}`)
    executeTxHash = await submitSelfAuthViaSendCalls({
      walletRequest: params.walletRequest,
      cswAddress: fundingCswAddress,
      calls: [relay.userCall],
      // Single native deposit call — atomic bundling can fail Base App simulation.
      atomicRequired: false,
      telemetryPrefix: 'csw_wallet_sendcalls',
      appendEvent,
    })
    onTxHash(executeTxHash)
  } else {
    executeTxHash = await submitExternalFunderRelayDeposit({
      walletClient: params.walletClient,
      userCall: relay.userCall,
      appendEvent,
    })
    onTxHash(executeTxHash)
  }

  const pollStatus = async (endpoint: string) =>
    pollRelayStatusEndpoint({
      statusEndpoint: endpoint,
      timeoutMs: 120_000,
      intervalMs: 2_000,
      shouldShortCircuitSuccess: params.verifyMutation,
      onTick: (message) => appendEvent(`relay_status.${message}`),
    })

  let status = await pollStatus(statusEndpoint)
  const primaryStatusLabel = String(
    (status.raw as Record<string, unknown> | null)?.status ?? '',
  )
    .trim()
    .toLowerCase()
  if (
    primaryStatusLabel === 'unknown' &&
    relay.orderId &&
    relay.requestId &&
    relay.orderId.toLowerCase() !== relay.requestId.toLowerCase()
  ) {
    appendEvent(`relay:status_retry_with_request_id=${relay.requestId}`)
    statusEndpoint = normalizeRelayStatusEndpoint(null, relay.requestId)
    appendEvent(`relay:status_endpoint=${statusEndpoint}`)
    status = await pollStatus(statusEndpoint)
  }

  if (!status.done || !status.success) {
    const verifiedOnChain = await params.verifyMutation()
    if (verifiedOnChain) {
      appendEvent('relay_status.result=timeout_or_failed_but_on_chain_verified')
      const fillTxHash =
        extractRelayExecutionTxHash(status.raw) ?? status.txHash ?? executeTxHash
      if (fillTxHash) onTxHash(fillTxHash)
      return { txHash: fillTxHash ?? executeTxHash! }
    }

    const statusLabel = String(
      (status.raw as Record<string, unknown> | null)?.status ?? 'unknown',
    )
      .trim()
      .toLowerCase()
    appendEvent(`relay_status.result=failed_or_timeout status=${statusLabel || 'unknown'}`)
    if (statusLabel === 'unknown') {
      throw new Error(
        'Relay does not recognize this quote requestId. Rebuild the preview and submit again without waiting.',
      )
    }
    throw new Error(
      `Relay owner mutation did not complete (${statusLabel || 'timeout'}). If your wallet was charged, wait a minute and verify on-chain before retrying.`,
    )
  }

  const fillTxHash =
    extractRelayExecutionTxHash(status.raw) ?? status.txHash ?? executeTxHash
  if (!fillTxHash) {
    throw new Error(
      'Relay reported success but no execution tx hash was surfaced by status or deposit submission.',
    )
  }
  onTxHash(fillTxHash)

  const mutationVerified = await params.verifyMutation()
  if (mutationVerified) {
    appendEvent('relay_execution.mutation_verified=ok')
    return { txHash: fillTxHash }
  }

  if (publicClient) {
    const relayExecutionTx = await publicClient.getTransaction({ hash: fillTxHash })
    const relayInput = String(relayExecutionTx.input ?? '').toLowerCase()
    appendEvent(`relay_execution.tx_selector=${relayInput.slice(0, 10) || 'n/a'}`)
    const looksLikeFillTx =
      relayInput.startsWith(RELAY_MULTICALL_SELECTOR) ||
      relayInput.includes(EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.slice(2))
    if (!looksLikeFillTx) {
      appendEvent('relay_execution.selector_chain=skipped_non_fill_tx')
    } else {
      if (!relayInput.startsWith(RELAY_MULTICALL_SELECTOR)) {
        appendEvent(
          `relay_execution.selector_chain=missing_multicall expected=${RELAY_MULTICALL_SELECTOR}`,
        )
      } else if (!relayInput.includes(EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.slice(2))) {
        appendEvent(
          `relay_execution.selector_chain=missing_execute_without_chain_id=${EXECUTE_WITHOUT_CHAIN_ID_SELECTOR}`,
        )
      } else if (!relayInput.includes(params.mutationSelector.slice(2))) {
        appendEvent(
          `relay_execution.selector_chain=missing_mutation_selector=${params.mutationSelector}`,
        )
      } else {
        appendEvent('relay_execution.selector_chain=ok')
      }
    }
  }

  throw new Error('Relay reported success, but the on-chain owner mutation did not apply.')
}
