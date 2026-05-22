import { useCallback, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import type { PublicClient } from 'viem'

import { fetchAddOwnerPreview, type AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { executeAddOwnerViaRelay } from '@/lib/addOwner/addOwnerExecution'
import { getWalletErrorMessage } from '@/lib/removeOwner/removeOwnerHelpers'
import {
  resolveOwnerMutationWallet,
  resolveOwnerMutationWalletRequest,
} from '@/lib/relay/resolveOwnerMutationWallet'

type UseAddOwnerRelayFlowParams = {
  ownerSignerAddress: string | null | undefined
  canonicalCswAddress: string | null | undefined
  privyExternalOwnerWallet?: unknown
  enabled: boolean
}

export function useAddOwnerRelayFlow(params: UseAddOwnerRelayFlowParams) {
  const { ownerSignerAddress, canonicalCswAddress, privyExternalOwnerWallet, enabled } = params
  const { getAccessToken } = usePrivy()
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
      setError('Connect an on-chain CSW owner wallet first.')
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
  }, [enabled, getAccessToken, ownerSignerAddress])

  const executeRelayInstall = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !ownerSignerAddress) {
      setError('Connect an on-chain CSW owner wallet first.')
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
      setError('Connect the owner wallet that will fund the Relay deposit, then retry.')
      return false
    }

    setBusy(true)
    setError(null)
    setNotice(null)
    setTxHash(null)

    try {
      const appendEvent = import.meta.env.DEV ? (row: string) => console.info('[add-owner-relay]', row) : () => {}
      const result = await executeAddOwnerViaRelay({
        preview: activePreview,
        cswAddress: canonicalCswAddress as `0x${string}`,
        publicClient,
        walletClient,
        walletRequest: resolveOwnerMutationWalletRequest(walletClient),
        isSelfAuthSession,
        appendEvent,
        onTxHash: setTxHash,
      })
      setNotice(`4626 signing enabled via Relay (execution tx ${result.txHash.slice(0, 10)}…).`)
      setPreview(null)
      return true
    } catch (err: unknown) {
      setError(getWalletErrorMessage(err))
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
