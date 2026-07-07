import { useCallback, useEffect, useRef, useState } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { getAddress } from 'viem'
import { base } from 'viem/chains'

import { buildPrivyAuthHeaders } from '@/lib/privy/accessToken'
import { useSafePrivyAccessToken } from '@/lib/privy/safeHooks'
import { encodeAddOwnerCall } from '@/lib/wallet/baseAppOwnerCalls'
import {
  confirmOwnerInstall,
  fetchPrepareAddPrivyOwner,
  type PreparedOwnerTxRequest,
} from '@/lib/wallet/zoraAddOwnerApi'

import { useEmbeddedOwnerOnCsw } from './useEmbeddedOwnerOnCsw'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Could not enable 4626 signing. Retry in a moment.'
}

export function usePrivyCswWebOwnerInstall(params: {
  enabled: boolean
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  onSuccess?: () => void | Promise<void>
}) {
  const getAccessToken = useSafePrivyAccessToken()
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const [busy, setBusy] = useState(false)
  const [prepareLoading, setPrepareLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [alreadyOwner, setAlreadyOwner] = useState(false)
  const [txRequest, setTxRequest] = useState<PreparedOwnerTxRequest | null>(null)
  const autoCheckedRef = useRef(false)
  const autoPrepareStartedRef = useRef(false)

  const authHeaders = useCallback(
    () =>
      buildPrivyAuthHeaders({
        getAccessToken: getAccessToken ?? (async () => null),
        attempts: 6,
        retryDelayMs: 200,
      }),
    [getAccessToken],
  )

  const { isOwner: embeddedOwnerOnChain, refresh: refreshEmbeddedOwner } = useEmbeddedOwnerOnCsw({
    cswAddress: params.canonicalCswAddress,
    embeddedEoaAddress: params.embeddedEoaAddress,
    enabled: params.enabled,
  })

  const onSuccess = params.onSuccess

  const markReady = useCallback(async () => {
    setAlreadyOwner(true)
    setPageNotice('4626 signing is enabled on your smart wallet.')
    await onSuccess?.()
  }, [onSuccess])

  const loadPrepare = useCallback(async () => {
    if (!params.enabled || !params.canonicalCswAddress || !params.embeddedEoaAddress) return null
    setPrepareLoading(true)
    setPageError(null)
    try {
      const headers = await authHeaders()
      const prepared = await fetchPrepareAddPrivyOwner({ headers })
      if (prepared.alreadyOwner) {
        setAlreadyOwner(true)
        await markReady()
        return prepared
      }
      setAlreadyOwner(false)
      setTxRequest('txRequest' in prepared ? prepared.txRequest : null)
      return prepared
    } catch (error) {
      setPageError(getErrorMessage(error))
      return null
    } finally {
      setPrepareLoading(false)
    }
  }, [authHeaders, markReady, params.canonicalCswAddress, params.embeddedEoaAddress, params.enabled])

  useEffect(() => {
    if (!params.enabled) return
    if (embeddedOwnerOnChain) {
      setAlreadyOwner(true)
      if (!autoCheckedRef.current) {
        autoCheckedRef.current = true
        void markReady()
      }
      return
    }
    if (autoPrepareStartedRef.current) return
    autoPrepareStartedRef.current = true
    void loadPrepare()
  }, [embeddedOwnerOnChain, loadPrepare, markReady, params.enabled])

  const submitViaSmartWalletClient = useCallback(async (): Promise<boolean> => {
    const canonical = params.canonicalCswAddress?.trim()
    const embedded = params.embeddedEoaAddress?.trim()
    if (!canonical || !embedded) return false

    let client = smartWalletClient
    if (!client?.account?.address && typeof getClientForChain === 'function') {
      client = (await getClientForChain({ id: base.id })) as typeof smartWalletClient
    }
    if (!client?.sendTransaction) {
      throw new Error('Your 4626 smart wallet client is still loading. Wait a few seconds and retry.')
    }

    const preparedCall = txRequest
      ? { to: txRequest.to, data: txRequest.data }
      : encodeAddOwnerCall({
          csw: getAddress(canonical) as `0x${string}`,
          ownerToAdd: getAddress(embedded) as `0x${string}`,
        })

    const hash = await client.sendTransaction({
      chain: base,
      to: preparedCall.to,
      data: preparedCall.data,
      value: 0n,
    } as never)

    if (!hash || typeof hash !== 'string') {
      throw new Error('Smart wallet owner install did not return a transaction hash.')
    }

    const headers = await authHeaders()
    const confirmed = await confirmOwnerInstall({
      cswAddress: canonical,
      ownerAddress: embedded,
      txHash: hash as `0x${string}`,
      headers,
    })
    if (!confirmed.isOwner && confirmed.confirmationState !== 'pending_tx') {
      throw new Error('Transaction submitted but owner confirmation is still pending. Retry shortly.')
    }
    return true
  }, [
    authHeaders,
    getClientForChain,
    params.canonicalCswAddress,
    params.embeddedEoaAddress,
    smartWalletClient,
    txRequest,
  ])

  const handleEnableSigning = useCallback(async () => {
    if (!params.canonicalCswAddress || !params.embeddedEoaAddress) {
      setPageError('Canonical wallet or embedded signer is unavailable. Reload and retry.')
      return false
    }

    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    try {
      if (embeddedOwnerOnChain || alreadyOwner) {
        await markReady()
        return true
      }

      const prepared = await loadPrepare()
      if (prepared && 'alreadyOwner' in prepared && prepared.alreadyOwner) {
        return true
      }

      await refreshEmbeddedOwner()

      if (await submitViaSmartWalletClient()) {
        await markReady()
        return true
      }

      return false
    } catch (error) {
      setPageError(getErrorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }, [
    alreadyOwner,
    embeddedOwnerOnChain,
    loadPrepare,
    markReady,
    params.canonicalCswAddress,
    params.embeddedEoaAddress,
    refreshEmbeddedOwner,
    submitViaSmartWalletClient,
  ])

  return {
    busy: busy || prepareLoading,
    prepareLoading,
    alreadyOwner,
    pageError,
    pageNotice,
    embeddedOwnerOnChain,
    handleEnableSigning,
    refreshEmbeddedOwner,
  }
}
