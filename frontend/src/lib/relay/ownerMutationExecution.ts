import { type PublicClient } from 'viem'
import { base } from 'viem/chains'

import type { OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'
import {
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  formatCompactEth,
  normalizeRelayStatusEndpoint,
  pollRelayStatusEndpoint,
  validatePreviewRelayUserCallIsNativeDepository,
} from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationWalletLike } from '@/lib/relay/resolveOwnerMutationWallet'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

export type ExecuteOwnerMutationViaRelayParams = {
  relay: OwnerMutationRelayFlow
  mutationCalldata: `0x${string}`
  mutationSelector: `0x${string}`
  cswAddress: `0x${string}`
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

async function submitExternalFunderRelayDeposit(params: {
  walletClient: OwnerMutationWalletLike
  userCall: Eip5792Call
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

  const relayGuard = validatePreviewRelayUserCallIsNativeDepository({ relay })
  if (relayGuard) {
    throw new Error(`Relay preview guard failed: ${relayGuard}.`)
  }

  const requiredDepositWei = BigInt(relay.userCall.value)
  appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

  if (params.isSelfAuthSession && publicClient) {
    const latestCswBalanceWei = await publicClient.getBalance({ address: cswAddress })
    appendEvent(`precheck:csw_balance_wei=${latestCswBalanceWei.toString(10)}`)
    if (requiredDepositWei > 0n && latestCswBalanceWei < requiredDepositWei) {
      throw new Error(
        `Canonical CSW balance (${formatCompactEth(latestCswBalanceWei)} ETH) is below required Relay deposit (${formatCompactEth(requiredDepositWei)} ETH). Fund the CSW and retry.`,
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

  const statusEndpoint = normalizeRelayStatusEndpoint(null, relay.requestId)
  appendEvent(`relay:preview_request_id=${relay.requestId}`)
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
    executeTxHash = await submitSelfAuthViaSendCalls({
      walletRequest: params.walletRequest,
      cswAddress,
      calls: [relay.userCall],
      telemetryPrefix: 'csw_wallet_sendcalls',
      appendEvent,
    })
  } else {
    executeTxHash = await submitExternalFunderRelayDeposit({
      walletClient: params.walletClient,
      userCall: relay.userCall,
      appendEvent,
    })
    onTxHash(executeTxHash)
  }

  const status = await pollRelayStatusEndpoint({
    statusEndpoint,
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
      'Relay reported success but no execution tx hash was surfaced by status or deposit submission.',
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
    if (!relayInput.includes(params.mutationSelector.slice(2))) {
      throw new Error(`Relay fill tx missing mutation selector (${params.mutationSelector}).`)
    }
    appendEvent('relay_execution.selector_chain=ok')
  }

  const mutationVerified = await params.verifyMutation()
  if (!mutationVerified) {
    throw new Error('Relay reported success, but the on-chain owner mutation did not apply.')
  }
  appendEvent('relay_execution.mutation_verified=ok')

  return { txHash: verifiedRelayTxHash }
}
