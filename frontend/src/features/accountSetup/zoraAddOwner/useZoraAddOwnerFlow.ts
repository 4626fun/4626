import { useCallback, useEffect, useRef, useState } from 'react'

import {
  confirmOwnerInstall,
  fetchPrepareAddPrivyOwner,
  type PreparedOwnerTxRequest,
} from '@/lib/wallet/zoraAddOwnerApi'

type UseZoraAddOwnerFlowParams = {
  canonicalCswAddress: string | null | undefined
  privyEmbeddedEoaAddress: string | null | undefined
  connectedOnchainEoaOwner: { index: number; ownerAddress: `0x${string}` } | null
  submitOwnerInstallViaOnchainEoa?: (txRequest: PreparedOwnerTxRequest) => Promise<`0x${string}`>
  authHeaders: () => Promise<Record<string, string>>
  enabled?: boolean
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Owner install failed. Retry with the same on-chain owner wallet.'
}

export function useZoraAddOwnerFlow(params: UseZoraAddOwnerFlowParams) {
  const {
    canonicalCswAddress,
    privyEmbeddedEoaAddress,
    connectedOnchainEoaOwner,
    submitOwnerInstallViaOnchainEoa,
    authHeaders,
    enabled = true,
  } = params

  const [prepareLoading, setPrepareLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [txRequest, setTxRequest] = useState<PreparedOwnerTxRequest | null>(null)
  const [alreadyOwner, setAlreadyOwner] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const prepareRequestIdRef = useRef(0)

  const loadPrepare = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !privyEmbeddedEoaAddress) return null
    const requestId = ++prepareRequestIdRef.current
    setPrepareLoading(true)
    setPageError(null)
    try {
      const headers = await authHeaders()
      const prepared = await fetchPrepareAddPrivyOwner({ headers })
      if (requestId !== prepareRequestIdRef.current) return prepared
      if (prepared.alreadyOwner) {
        setAlreadyOwner(true)
        setTxRequest(null)
        return prepared
      }
      setAlreadyOwner(false)
      setTxRequest(prepared.txRequest)
      return prepared
    } catch (error) {
      if (requestId === prepareRequestIdRef.current) {
        setPageError(getErrorMessage(error))
      }
      return null
    } finally {
      if (requestId === prepareRequestIdRef.current) {
        setPrepareLoading(false)
      }
    }
  }, [authHeaders, canonicalCswAddress, enabled, privyEmbeddedEoaAddress])

  useEffect(() => {
    if (!enabled) return
    void loadPrepare()
  }, [enabled, loadPrepare])

  const handleEnableSigning = useCallback(async (): Promise<boolean> => {
    if (!canonicalCswAddress || !privyEmbeddedEoaAddress) {
      setPageError('Canonical wallet or embedded signer is unavailable. Reload and retry.')
      return false
    }
    if (!connectedOnchainEoaOwner) {
      setPageError('Connect one of your on-chain CSW owner wallets first.')
      return false
    }
    if (!submitOwnerInstallViaOnchainEoa) {
      setPageError('Owner install submitter is unavailable in this build.')
      return false
    }

    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    try {
      let activeTxRequest = txRequest
      if (!activeTxRequest || alreadyOwner) {
        const prepared = await loadPrepare()
        if (prepared && 'alreadyOwner' in prepared && prepared.alreadyOwner) {
          setAlreadyOwner(true)
          setPageNotice('4626 signing is already enabled on your canonical wallet.')
          return true
        }
        if (prepared && 'txRequest' in prepared) {
          activeTxRequest = prepared.txRequest
        }
      }
      if (!activeTxRequest) {
        throw new Error('Could not prepare add-owner transaction.')
      }

      const hash = await submitOwnerInstallViaOnchainEoa(activeTxRequest)
      setTxHash(hash)

      const headers = await authHeaders()
      const confirmed = await confirmOwnerInstall({
        cswAddress: canonicalCswAddress,
        ownerAddress: privyEmbeddedEoaAddress,
        txHash: hash,
        headers,
      })
      if (!confirmed.isOwner && confirmed.confirmationState !== 'pending_tx') {
        throw new Error('Transaction submitted but owner confirmation is still pending. Retry shortly.')
      }

      setPageNotice(`4626 signing enabled (tx ${hash.slice(0, 10)}…).`)
      setAlreadyOwner(true)
      return true
    } catch (error) {
      setPageError(getErrorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }, [
    alreadyOwner,
    authHeaders,
    canonicalCswAddress,
    connectedOnchainEoaOwner,
    loadPrepare,
    privyEmbeddedEoaAddress,
    submitOwnerInstallViaOnchainEoa,
    txRequest,
  ])

  return {
    prepareLoading,
    busy,
    txRequest,
    alreadyOwner,
    pageError,
    pageNotice,
    txHash,
    loadPrepare,
    handleEnableSigning,
  }
}
