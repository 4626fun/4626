import { getAddress, type PublicClient } from 'viem'

import { executeAddOwnerViaRelay } from '@/lib/addOwner/addOwnerExecution'
import { fetchAddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { mapRemoveOwnerSubmissionError } from '@/lib/removeOwner/removeOwnerHelpers'
import { mapBaseAppOwnerInstallSubmissionError } from '@/lib/relay/baseAppOwnerInstallGuard'
import { resolveOwnerMutationSessionWalletRequest } from '@/lib/relay/resolveOwnerMutationWallet'
import { resolveOwnerMutationSignerContext } from '@/lib/relay/resolveOwnerMutationSignerContext'

export { shouldAttemptRelayMethodAFallback } from '@/features/accountSetup/addUserOp/addOwnerRelayFallbackPolicy'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type AddOwnerRelayFallbackParams = {
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  authHeaders: Record<string, string>
  publicClient: PublicClient | undefined
  walletRequest: WalletRequest
  baseAccountSdk: unknown
  fundingPreflightOk: boolean
  appendEvent: (row: string) => void
  onTxHash: (txHash: string) => void
}

export async function executeAddOwnerRelayMethodA(
  params: AddOwnerRelayFallbackParams,
): Promise<{ txHash: `0x${string}` }> {
  const csw = getAddress(params.canonicalCswAddress) as `0x${string}`
  const ownerToAdd = getAddress(params.privyEmbeddedEoaAddress) as `0x${string}`

  const signerContext = resolveOwnerMutationSignerContext({
    canonicalCswAddress: csw,
    fundingCswAddress: csw,
    connectedAddress: params.privyEmbeddedEoaAddress,
    privyEmbeddedEoaAddress: ownerToAdd,
    preferFundingCswSelfAuth: true,
  })

  if (!signerContext.signingReady || !signerContext.relayConnectedAddress) {
    throw new Error(
      signerContext.blockedReason ??
        'Connect your Base smart wallet before trying the Relay fallback.',
    )
  }

  params.appendEvent('fallback:relay_method_a_preview_start')
  const preview = await fetchAddOwnerPreview({
    connectedAddress: signerContext.relayConnectedAddress,
    relayFundingCswAddress: csw,
    headers: params.authHeaders,
  })

  if (preview.preflight.alreadyOwner) {
    params.appendEvent('fallback:relay_method_a_already_owner')
    throw new Error('Privy embedded signer is already an owner of this CSW.')
  }
  if (!preview.relay) {
    throw new Error(
      preview.preflight.relayQuoteError ??
        'Relay quote unavailable for add-owner fallback. Rebuild preview and retry.',
    )
  }

  params.appendEvent(`fallback:relay_method_a_order=${preview.relay.orderId ?? preview.relay.requestId}`)
  params.appendEvent('fallback:relay_method_a_part1_deposit_native')

  const walletRequest = resolveOwnerMutationSessionWalletRequest({
    isSelfAuthSession: signerContext.isSelfAuthSession,
    walletClient: { account: signerContext.relayConnectedAddress },
    wagmiWalletClient: null,
    baseAccountSdk: params.baseAccountSdk as
      | { getProvider?: () => { request?: (args: unknown) => Promise<unknown> } | null | undefined }
      | null
      | undefined,
  })
  if (!walletRequest) {
    throw new Error('Base App wallet session is unavailable for Relay Part 1. Reconnect and retry.')
  }

  try {
    const result = await executeAddOwnerViaRelay({
      preview,
      cswAddress: csw,
      fundingCswAddress: csw,
      publicClient: params.publicClient,
      walletClient: { account: signerContext.relayConnectedAddress },
      walletRequest,
      isSelfAuthSession: signerContext.isSelfAuthSession,
      appendEvent: params.appendEvent,
      onTxHash: params.onTxHash,
    })
    params.appendEvent(`fallback:relay_method_a_success tx=${result.txHash.slice(0, 10)}…`)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    const mapped =
      mapBaseAppOwnerInstallSubmissionError(message) ??
      mapRemoveOwnerSubmissionError({
        error,
        requiredDepositWei: preview.relay?.userCall?.value
          ? BigInt(preview.relay.userCall.value)
          : null,
        latestCswBalanceWei: null,
        isSelfAuthSession: signerContext.isSelfAuthSession,
        fundingCswAddress: csw,
      })
    throw new Error(mapped ?? message)
  }
}
