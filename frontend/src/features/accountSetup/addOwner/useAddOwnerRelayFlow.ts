import { useCallback, useState } from 'react'
import { useBaseAccountSdk, usePrivy } from '@privy-io/react-auth'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import type { PublicClient } from 'viem'

import { fetchAddOwnerPreview, type AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { executeAddOwnerViaRelay } from '@/lib/addOwner/addOwnerExecution'
import { formatCompactEth } from '@/lib/removeOwner/removeOwnerHelpers'
import {
  resolveOwnerMutationWallet,
  resolveOwnerMutationWalletRequest,
  resolveSelfAuthSendCallsRequest,
} from '@/lib/relay/resolveOwnerMutationWallet'
import { normalizeOwnerApprovalError } from '@/lib/wallet/onboardingWalletErrors'

type UseAddOwnerRelayFlowParams = {
  ownerSignerAddress: string | null | undefined
  canonicalCswAddress: string | null | undefined
  privyExternalOwnerWallet?: unknown
  enabled: boolean
}

export function useAddOwnerRelayFlow(params: UseAddOwnerRelayFlowParams) {
  const { ownerSignerAddress, canonicalCswAddress, privyExternalOwnerWallet, enabled } = params
  const { getAccessToken } = usePrivy()
  const { baseAccountSdk } = useBaseAccountSdk()
  const { data: wagmiWalletClient } = useWalletClient()
  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined

  const [preview, setPreview] = useState<AddOwnerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const isSelfAuthSession =
    Boolean(canonicalCswAddress && ownerSignerAddress) &&
    ownerSignerAddress!.toLowerCase() === canonicalCswAddress!.toLowerCase()

  const loadPreview = useCallback(async () => {
    if (!enabled || !ownerSignerAddress) {
      setError(
        isSelfAuthSession
          ? 'Connect your canonical smart wallet in Base App first.'
          : 'Connect an on-chain CSW owner wallet first.',
      )
      return null
    }
    setPreviewLoading(true)
    setError(null)
    setNotice(null)
    setTxHash(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Missing Privy auth token. Sign in and retry.')
      }
      const data = await fetchAddOwnerPreview({
        connectedAddress: ownerSignerAddress,
        headers: { 'X-Privy-Token': token },
      })
      setPreview(data)
      if (data.preflight.alreadyOwner) {
        setNotice('4626 signing is already enabled on this wallet.')
      }
      return data
    } catch (err: unknown) {
      setPreview(null)
      setError(err instanceof Error ? err.message : 'Failed to build add-owner preview.')
      return null
    } finally {
      setPreviewLoading(false)
    }
  }, [enabled, getAccessToken, isSelfAuthSession, ownerSignerAddress])

  const executeRelayInstall = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !ownerSignerAddress) {
      setError(
        isSelfAuthSession
          ? 'Connect your canonical smart wallet in Base App first.'
          : 'Connect an on-chain CSW owner wallet first.',
      )
      return false
    }

    let activePreview = preview
    if (!activePreview) {
      activePreview = await loadPreview()
    }
    if (!activePreview || activePreview.preflight.alreadyOwner) {
      return activePreview?.preflight.alreadyOwner === true
    }

    const walletClient = await resolveOwnerMutationWallet({
      wagmiWalletClient: wagmiWalletClient,
      ownerSignerAddress,
      privyExternalOwnerWallet,
    })
    if (!walletClient) {
      setError(
        isSelfAuthSession
          ? 'Base App wallet session is unavailable. Reconnect your smart wallet and retry.'
          : 'Connect the owner wallet that will fund the Relay deposit, then retry.',
      )
      return false
    }

    setBusy(true)
    setError(null)
    setNotice(null)
    setTxHash(null)

    const walletRequest = isSelfAuthSession
      ? resolveSelfAuthSendCallsRequest({ wagmiWalletClient, baseAccountSdk })
      : resolveOwnerMutationWalletRequest(walletClient)
    if (isSelfAuthSession && !walletRequest) {
      setError('Base App wallet session is unavailable. Reconnect your smart wallet and retry.')
      return false
    }

    try {
      const appendEvent = import.meta.env.DEV ? (row: string) => console.info('[add-owner-relay]', row) : () => {}
      const result = await executeAddOwnerViaRelay({
        preview: activePreview,
        cswAddress: canonicalCswAddress as `0x${string}`,
        publicClient,
        walletClient,
        walletRequest,
        isSelfAuthSession,
        appendEvent,
        onTxHash: setTxHash,
      })
      setNotice(`4626 signing enabled via Relay (execution tx ${result.txHash.slice(0, 10)}…).`)
      setPreview(null)
      return true
    } catch (err: unknown) {
      const normalized = normalizeOwnerApprovalError(err)
      let message = normalized.message
      if (isSelfAuthSession && activePreview.relay?.userCall?.value) {
        const requiredDepositWei = BigInt(activePreview.relay.userCall.value)
        const depositHint = ` Required Relay deposit: ${formatCompactEth(requiredDepositWei)} ETH.`
        if (normalized.message.toLowerCase().includes('could not generate')) {
          message =
            'Base App could not build the Relay deposit transaction. This is usually a wallet simulation issue, not missing ETH.' +
            depositHint +
            ' Retry once in Base App. If it keeps failing, open /add-owner in Safari or Chrome and connect one of your on-chain CSW owner wallets instead.'
        }
      }
      setError(message)
      return false
    } finally {
      setBusy(false)
    }
  }, [
    canonicalCswAddress,
    enabled,
    isSelfAuthSession,
    loadPreview,
    ownerSignerAddress,
    preview,
    baseAccountSdk,
    privyExternalOwnerWallet,
    publicClient,
    wagmiWalletClient,
  ])

  return {
    preview,
    previewLoading,
    busy,
    error,
    notice,
    txHash,
    loadPreview,
    executeRelayInstall,
    relayReady: Boolean(preview?.relay && preview.preflight.simulation.ok),
  }
}
