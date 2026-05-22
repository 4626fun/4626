import { type PublicClient } from 'viem'

import { executeOwnerMutationViaRelay } from '@/lib/relay/ownerMutationExecution'
import type { OwnerMutationWalletLike } from '@/lib/relay/resolveOwnerMutationWallet'
import {
  CSW_OWNER_READ_ABI,
  REMOVE_OWNER_AT_INDEX_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import {
  decodeOwnerAddress,
  type RemoveOwnerPreview,
} from '@/lib/removeOwner/removeOwnerHelpers'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type ExecuteRemoveOwnerViaRelayParams = {
  preview: RemoveOwnerPreview
  selectedIndex: number
  cswAddress: `0x${string}`
  publicClient: PublicClient | undefined
  walletClient: OwnerMutationWalletLike
  walletRequest: WalletRequest | undefined
  isSelfAuthSession: boolean
  appendEvent: (row: string) => void
  onTxHash: (txHash: string) => void
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

  return executeOwnerMutationViaRelay({
    relay: preview.relay,
    mutationCalldata: preview.txRequest.data,
    mutationSelector: REMOVE_OWNER_AT_INDEX_SELECTOR,
    cswAddress,
    publicClient,
    walletClient: params.walletClient,
    walletRequest: params.walletRequest,
    isSelfAuthSession: params.isSelfAuthSession,
    appendEvent,
    onTxHash,
    precheckMutation: async () => {
      if (!publicClient) return
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
    },
    verifyMutation: async () => {
      if (!publicClient) return true
      const slotAfter = (await publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_READ_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(preview.preflight.targetOwnerIndex)],
      })) as `0x${string}`
      return slotAfter.toLowerCase() !== preview.preflight.targetOwnerBytes.toLowerCase()
    },
  })
}
