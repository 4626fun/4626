import { type PublicClient } from 'viem'
import { base } from 'viem/chains'

import type { OwnerMutationEip5792Call, OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'
import {
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { submitSelfAuthRelayPart1SelfFunded } from '@/lib/relay/submitRelayPart1SelfFunded'
import {
  decodeDepositoryDepositNativeOrderId,
  findExistingRelayPart1DepositTx,
  persistRelayPart1DepositTx,
} from '@/lib/relay/relayPart1DepositLookup'
import {
  extractRelayExecutionTxHash,
  formatCompactEth,
  normalizeRelayStatusEndpoint,
  pollRelayStatusEndpoint,
  resolveRelayIndexRequestIds,
  resolveRelayStatusEndpoints,
  resolveRelayStatusFallbackRequestId,
  resolveRelayStatusRequestId,
  validatePreviewRelayUserCallIsNativeDepository,
} from '@/lib/removeOwner/removeOwnerHelpers'
import { validateGoldenCswDepositoryPart1UserCall } from '@/lib/relay/goldenRelayPart1Shape'
import { notifyRelaySolverAfterPart1Deposit } from '@/lib/relay/notifyRelaySolverDeposit'
import { ensureRelayIndexablePart1TxHash, assertRelayPart1TxHashSelfFunded } from '@/lib/relay/resolveRelayPart1DepositTxHash'
import { resolveRelayPart1UserOpGasReserveWei } from '@/lib/relay/relayPart1GasReserve'
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
  /** Reuse a prior Part 1 bundle tx for this quote (retry after waiting). */
  part1DepositTxHint?: `0x${string}` | null
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

async function waitForBundleDepositReceipt(params: {
  publicClient: PublicClient | undefined
  depositTxHash: `0x${string}`
  appendEvent: (row: string) => void
}): Promise<void> {
  if (!params.publicClient) return
  try {
    const tx = await params.publicClient.getTransaction({ hash: params.depositTxHash })
    if (tx?.blockNumber == null) {
      params.appendEvent('relay_notify:waiting_for_bundle_receipt')
      await params.publicClient.waitForTransactionReceipt({
        hash: params.depositTxHash,
        timeout: 90_000,
      })
    }
    params.appendEvent('relay_notify:bundle_receipt=confirmed')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? 'receipt wait failed')
    params.appendEvent(`relay_notify:bundle_receipt=warn:${message.slice(0, 220)}`)
  }
}

async function wakeRelaySolverAfterPart1Deposit(params: {
  depositTxHash: `0x${string}`
  indexRequestIds: `0x${string}`[]
  userCall: OwnerMutationEip5792Call
  appendEvent: (row: string) => void
}): Promise<{ indexed: boolean; sameChainSingle: boolean }> {
  params.appendEvent(
    `relay_notify:start index_request_ids=${params.indexRequestIds.join(',') || 'tx_only'}`,
  )
  try {
    const result = await notifyRelaySolverAfterPart1Deposit({
      chainId: base.id,
      depositTxHash: params.depositTxHash,
      indexRequestIds: params.indexRequestIds,
      userCall: params.userCall,
      referrer: '4626-owner-mutation',
    })
    params.appendEvent(
      `relay_notify:index=${result.indexed} same_chain_single=${result.sameChainSingle}`,
    )
    for (const warning of result.warnings) {
      params.appendEvent(`relay_notify:warn=${warning.slice(0, 260)}`)
    }
    return { indexed: result.indexed, sameChainSingle: result.sameChainSingle }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? 'notify failed')
    params.appendEvent(`relay_notify:error=${message.slice(0, 260)}`)
    return { indexed: false, sameChainSingle: false }
  }
}

export async function executeOwnerMutationViaRelay(
  params: ExecuteOwnerMutationViaRelayParams,
): Promise<{ txHash: `0x${string}` }> {
  const { relay, cswAddress, publicClient, appendEvent, onTxHash } = params
  const fundingCswAddress = params.fundingCswAddress ?? cswAddress
  const fundingFromParentWallet =
    fundingCswAddress.toLowerCase() !== cswAddress.toLowerCase()

  const relayGuard = validatePreviewRelayUserCallIsNativeDepository(
    { relay },
    { depositoryOnly: params.isSelfAuthSession },
  )
  if (relayGuard) {
    throw new Error(`Relay preview guard failed: ${relayGuard}.`)
  }

  if (params.isSelfAuthSession) {
    const goldenShapeError = validateGoldenCswDepositoryPart1UserCall({
      userCall: relay.userCall,
      fundingCsw: fundingCswAddress,
      orderId: relay.orderId ?? relay.requestId,
    })
    if (goldenShapeError) {
      throw new Error(
        `Part 1 UserOp would not match the golden CSW executeBatch → Depository.depositNative shape: ${goldenShapeError}. Rebuild preview.`,
      )
    }
    appendEvent(
      `relay:golden_part1_shape=ok executeBatch_inner=${JSON.stringify({
        target: relay.userCall.to,
        value: BigInt(relay.userCall.value).toString(10),
        selector: relay.userCall.data.slice(0, 10),
      })}`,
    )
  }

  const requiredDepositWei = BigInt(relay.userCall.value)
  appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

  if (params.isSelfAuthSession && publicClient) {
    const latestCswBalanceWei = await publicClient.getBalance({ address: fundingCswAddress })
    appendEvent(`precheck:funding_csw=${fundingCswAddress}`)
    appendEvent(`precheck:funding_csw_balance_wei=${latestCswBalanceWei.toString(10)}`)
    const gasReserveWei = await resolveRelayPart1UserOpGasReserveWei(publicClient)
    appendEvent(`precheck:gas_reserve_wei=${gasReserveWei.toString(10)}`)
    const requiredWithGasReserve = requiredDepositWei + gasReserveWei
    if (requiredDepositWei > 0n && latestCswBalanceWei < requiredDepositWei) {
      const walletLabel = fundingFromParentWallet ? 'Main Base wallet' : 'Smart wallet'
      const targetHint = fundingFromParentWallet
        ? ' Fund your main Base smart wallet (not the app wallet) and retry.'
        : ' Fund the smart wallet and retry.'
      throw new Error(
        `${walletLabel} balance (${formatCompactEth(latestCswBalanceWei)} ETH) is below required Relay deposit (${formatCompactEth(requiredDepositWei)} ETH).${targetHint}`,
      )
    }
    if (latestCswBalanceWei < requiredWithGasReserve) {
      appendEvent(
        `precheck:warn native balance below deposit+entrypoint_prefund (${requiredWithGasReserve.toString(10)} wei); EntryPoint deposit may cover gas`,
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

  const indexRequestIds = resolveRelayIndexRequestIds(relay)
  const depositOrderId = decodeDepositoryDepositNativeOrderId(relay.userCall.data)
  if (depositOrderId?.orderId) {
    appendEvent(`relay:deposit_native_order_id=${depositOrderId.orderId}`)
  }
  const statusRequestId = resolveRelayStatusRequestId(relay)
  const statusFallbackRequestId = resolveRelayStatusFallbackRequestId(relay)
  const statusEndpoints = resolveRelayStatusEndpoints(relay)
  let statusEndpoint = statusEndpoints[0] ?? normalizeRelayStatusEndpoint(null, statusRequestId)
  appendEvent(`relay:preview_request_id=${relay.requestId}`)
  appendEvent(`relay:index_request_ids=${indexRequestIds.join(',') || 'tx_only'}`)
  appendEvent(`relay:status_request_id=${statusRequestId}`)
  if (statusFallbackRequestId) {
    appendEvent(`relay:status_fallback_request_id=${statusFallbackRequestId}`)
  }
  appendEvent(`relay:user_call_to=${relay.userCall.to}`)
  appendEvent(`relay:user_call_value=${relay.userCall.value}`)
  appendEvent(`relay:user_call_selector=${relay.userCall.data.slice(0, 10)}`)
  appendEvent(`relay:order_id=${relay.orderId ?? 'n/a'}`)
  if (relay.paymentDetails) {
    appendEvent(`relay:payment_depository=${relay.paymentDetails.depository}`)
    appendEvent(`relay:payment_currency=${relay.paymentDetails.currency}`)
    appendEvent(`relay:payment_amount=${relay.paymentDetails.amount}`)
  }
  appendEvent(`relay:status_endpoint=${statusEndpoint}`)

  let executeTxHash: `0x${string}` | null = null

  const boundOrderId = (relay.orderId ?? relay.requestId) as `0x${string}`
  if (publicClient) {
    try {
      const existingPart1Tx = await findExistingRelayPart1DepositTx({
        publicClient,
        fundingCsw: fundingCswAddress,
        userCall: relay.userCall,
        orderId: boundOrderId,
        txHint: params.part1DepositTxHint,
      })
      if (existingPart1Tx) {
        executeTxHash = existingPart1Tx
        appendEvent(`relay_part1:skip_existing_deposit tx=${existingPart1Tx}`)
        appendEvent(`relay_part1:skip_order_id=${boundOrderId}`)
        onTxHash(existingPart1Tx)
      }
    } catch (lookupError: unknown) {
      const message =
        lookupError instanceof Error ? lookupError.message : String(lookupError ?? 'lookup failed')
      appendEvent(`relay_part1:deposit_lookup_skipped reason=${message.slice(0, 180)}`)
    }
  }

  if (!executeTxHash) {
    if (params.isSelfAuthSession) {
      if (!params.walletRequest) {
        throw new Error('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
      }
      appendEvent('relay_execute:self_auth_route=preview_user_call_self_funded')
      appendEvent(`relay_execute:funding_csw=${fundingCswAddress}`)
      executeTxHash = await submitSelfAuthRelayPart1SelfFunded({
        walletRequest: params.walletRequest,
        fundingCsw: fundingCswAddress,
        userCall: relay.userCall,
        chainId: base.id,
        publicClient,
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
  }

  if (executeTxHash) {
    executeTxHash = await ensureRelayIndexablePart1TxHash({
      depositTxHash: executeTxHash,
      publicClient,
      fundingCsw: fundingCswAddress,
      orderId: boundOrderId,
      appendEvent,
    })
    persistRelayPart1DepositTx({ orderId: boundOrderId, txHash: executeTxHash })
  }

  await waitForBundleDepositReceipt({
    publicClient,
    depositTxHash: executeTxHash,
    appendEvent,
  })

  if (publicClient && executeTxHash) {
    await assertRelayPart1TxHashSelfFunded({
      transactionHash: executeTxHash,
      publicClient,
      fundingCsw: fundingCswAddress,
      appendEvent,
    })
  }

  let notifyResult = await wakeRelaySolverAfterPart1Deposit({
    depositTxHash: executeTxHash,
    indexRequestIds,
    userCall: relay.userCall,
    appendEvent,
  })

  if (!notifyResult.indexed) {
    appendEvent('relay_notify:retry_after_receipt')
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    notifyResult = await wakeRelaySolverAfterPart1Deposit({
      depositTxHash: executeTxHash,
      indexRequestIds,
      userCall: relay.userCall,
      appendEvent,
    })
  } else {
    appendEvent('relay_notify:reindex_after_receipt')
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    await wakeRelaySolverAfterPart1Deposit({
      depositTxHash: executeTxHash,
      indexRequestIds,
      userCall: relay.userCall,
      appendEvent,
    })
  }

  const reindexWhileWaiting = async () => {
    await wakeRelaySolverAfterPart1Deposit({
      depositTxHash: executeTxHash!,
      indexRequestIds,
      userCall: relay.userCall,
      appendEvent,
    })
  }

  const pollStatus = async (endpoint: string) =>
    pollRelayStatusEndpoint({
      statusEndpoint: endpoint,
      timeoutMs: 480_000,
      intervalMs: 2_000,
      shouldShortCircuitSuccess: params.verifyMutation,
      onWaiting: reindexWhileWaiting,
      waitingReindexEvery: 2,
      onTick: (message) => appendEvent(`relay_status.${message}`),
    })

  let status = await pollStatus(statusEndpoint)
  let primaryStatusLabel = String(
    (status.raw as Record<string, unknown> | null)?.status ?? '',
  )
    .trim()
    .toLowerCase()

  for (let endpointIndex = 1; endpointIndex < statusEndpoints.length; endpointIndex += 1) {
    if (status.done && status.success) break
    if (primaryStatusLabel !== 'unknown') break
    statusEndpoint = statusEndpoints[endpointIndex]!
    appendEvent(`relay:status_retry_with_endpoint=${statusEndpoint}`)
    status = await pollStatus(statusEndpoint)
    primaryStatusLabel = String(
      (status.raw as Record<string, unknown> | null)?.status ?? '',
    )
      .trim()
      .toLowerCase()
  }

  if (primaryStatusLabel === 'unknown' && statusFallbackRequestId) {
    appendEvent(`relay:status_retry_with_fallback_id=${statusFallbackRequestId}`)
    statusEndpoint = normalizeRelayStatusEndpoint(null, statusFallbackRequestId)
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
    if (statusLabel === 'waiting') {
      throw new Error(
        `Relay received Part 1 (bundle tx ${executeTxHash.slice(0, 10)}…) but Part 2 (addOwnerAddress) is still pending. Tap Recheck Part 2 — do not rebuild preview. Quote requestId ${statusRequestId.slice(0, 12)}…`,
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
