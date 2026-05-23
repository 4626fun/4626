import { type PublicClient } from 'viem'

import type { AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { executeOwnerMutationViaRelay } from '@/lib/relay/ownerMutationExecution'
import type { OwnerMutationWalletLike } from '@/lib/relay/resolveOwnerMutationWallet'
import {
  ADD_OWNER_ADDRESS_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type ExecuteAddOwnerViaRelayParams = {
  preview: AddOwnerPreview
  cswAddress: `0x${string}`
  publicClient: PublicClient | undefined
  walletClient: OwnerMutationWalletLike
  walletRequest: WalletRequest | undefined
  isSelfAuthSession: boolean
  appendEvent: (row: string) => void
  onTxHash: (txHash: string) => void
}

export async function executeAddOwnerViaRelay(
  params: ExecuteAddOwnerViaRelayParams,
): Promise<{ txHash: `0x${string}` }> {
  const { preview, cswAddress, publicClient, appendEvent, onTxHash } = params

  if (preview.preflight.alreadyOwner) {
    throw new Error('Privy embedded signer is already an owner of this CSW.')
  }
  if (!preview.relay) {
    throw new Error(
      preview.preflight.relayQuoteError ??
        'Relay quote unavailable; this route requires Relay orchestration.',
    )
  }
  if (preview.txRequest.data.slice(0, 10).toLowerCase() !== ADD_OWNER_ADDRESS_SELECTOR) {
    throw new Error(
      `Preview mutation selector mismatch (expected ${ADD_OWNER_ADDRESS_SELECTOR}, got ${preview.txRequest.data.slice(0, 10)}).`,
    )
  }

  const ownerToAdd = preview.preflight.ownerToAdd

  return executeOwnerMutationViaRelay({
    relay: preview.relay,
    mutationCalldata: preview.txRequest.data,
    mutationSelector: ADD_OWNER_ADDRESS_SELECTOR,
    cswAddress,
    publicClient,
    walletClient: params.walletClient,
    walletRequest: params.walletRequest,
    isSelfAuthSession: params.isSelfAuthSession,
    appendEvent,
    onTxHash,
    precheckMutation: async () => {
      if (!publicClient) return
      if (!preview.preflight.simulation.ok) {
        throw new Error(
          preview.preflight.simulation.error ??
            'Add-owner simulation failed. Rebuild preview before retrying.',
        )
      }
      appendEvent('precheck:add_owner_call_simulation=ok')
    },
    verifyMutation: async () => {
      if (!publicClient) return true
      const installed = await readIsOwnerAddressIfDeployed({
        publicClient,
        cswAddress,
        ownerAddress: ownerToAdd,
      })
      return installed === true
    },
  })
}
