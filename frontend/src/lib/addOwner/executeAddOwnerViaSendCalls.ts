import { encodeFunctionData, type PublicClient } from 'viem'

import {
  _submitOwnerViaSendCalls,
  waitForCallsTxHash,
  type CswSendCallsTelemetry,
} from '@/lib/wallet/cswSendCalls'
import {
  ADD_OWNER_ADDRESS_SELECTOR,
  CSW_OWNER_MUTATION_ABI,
} from '@/lib/wallet/cswOwnerAbi'
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type ExecuteAddOwnerViaSendCallsParams = {
  cswAddress: `0x${string}`
  ownerToAdd: `0x${string}`
  publicClient: PublicClient | undefined
  walletRequest: WalletRequest
  appendEvent: (row: string) => void
  onTxHash?: (txHash: `0x${string}`) => void
}

function isDirectAddOwnerBlockedError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('not enough funds') ||
    lower.includes('error generating transaction') ||
    lower.includes('insufficient funds') ||
    lower.includes('request rejected') ||
    lower.includes('4100') ||
    lower.includes('4200')
  )
}

/**
 * Method D — direct SDK-style owner install via EIP-5792 wallet_sendCalls.
 * Encodes CSW.addOwnerAddress(newOwner) as a self-call; the connected Smart
 * Wallet must sign and submit the UserOp internally.
 */
export async function executeAddOwnerViaSendCalls(
  params: ExecuteAddOwnerViaSendCallsParams,
): Promise<{ txHash: `0x${string}` }> {
  const { cswAddress, ownerToAdd, publicClient, walletRequest, appendEvent } = params

  const mutationCalldata = encodeFunctionData({
    abi: CSW_OWNER_MUTATION_ABI,
    functionName: 'addOwnerAddress',
    args: [ownerToAdd],
  })

  if (mutationCalldata.slice(0, 10).toLowerCase() !== ADD_OWNER_ADDRESS_SELECTOR) {
    throw new Error(
      `Direct addOwner calldata mismatch (expected ${ADD_OWNER_ADDRESS_SELECTOR}, got ${mutationCalldata.slice(0, 10)}).`,
    )
  }

  appendEvent('direct_add_owner:wallet_sendCalls=start')
  appendEvent(`direct_add_owner:target=${ownerToAdd}`)

  const onTelemetry = (event: CswSendCallsTelemetry) => {
    appendEvent(`direct_add_owner:${event.step}`)
  }

  let callBundleId: string
  try {
    const submitted = await _submitOwnerViaSendCalls({
      walletRequest,
      csw: cswAddress,
      chainId: 8453,
      calls: [{ to: cswAddress, data: mutationCalldata, value: 0n }],
      atomicRequired: true,
      onTelemetry,
    })
    callBundleId = submitted.callBundleId
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    appendEvent(`direct_add_owner:send_calls_error=${message.slice(0, 200)}`)
    if (isDirectAddOwnerBlockedError(message)) {
      throw new Error(`direct_add_owner_blocked:${message}`)
    }
    throw error
  }

  appendEvent(`direct_add_owner:bundle_id=${callBundleId}`)

  const status = await waitForCallsTxHash({
    walletRequest,
    callBundleId,
    onTelemetry,
  })

  const txHash = status.transactionHash ?? status.userOperationHash
  if (!txHash) {
    throw new Error(
      'direct_add_owner_blocked:wallet_sendCalls completed without a transaction hash. Retry or use Relay fallback.',
    )
  }

  appendEvent(`direct_add_owner:tx_hash=${txHash}`)
  params.onTxHash?.(txHash)

  if (publicClient) {
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 }).catch(() => {
      /* receipt may lag for AA bundles */
    })
    const installed = await readIsOwnerAddressIfDeployed({
      publicClient,
      cswAddress,
      ownerAddress: ownerToAdd,
    })
    if (installed !== true) {
      throw new Error(
        'direct_add_owner_blocked:transaction landed but isOwnerAddress is still false. Use Relay fallback.',
      )
    }
    appendEvent('direct_add_owner:verify_is_owner=ok')
  }

  return { txHash }
}
