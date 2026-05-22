import { useCallback, useMemo, useRef, useState } from 'react'
import { useBaseAccountSdk, usePrivy } from '@privy-io/react-auth'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import type { PublicClient } from 'viem'

import { fetchAddOwnerPreview, type AddOwnerPreview } from '@/lib/addOwner/addOwnerHelpers'
import { executeAddOwnerViaRelay } from '@/lib/addOwner/addOwnerExecution'
import {
  getWalletErrorMessage,
  mapRemoveOwnerSubmissionError,
} from '@/lib/removeOwner/removeOwnerHelpers'
import {
  resolveOwnerMutationSessionWalletRequest,
  resolveOwnerMutationWallet,
} from '@/lib/relay/resolveOwnerMutationWallet'

export type AddOwnerErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type UseAddOwnerFlowParams = {
  canonicalCswAddress: string | null | undefined
  ownerSignerAddress: string | null | undefined
  privyExternalOwnerWallet?: unknown
  enabled?: boolean
}

export function useAddOwnerFlow(params: UseAddOwnerFlowParams) {
  const {
    canonicalCswAddress,
    ownerSignerAddress,
    privyExternalOwnerWallet,
    enabled = true,
  } = params
  const { getAccessToken } = usePrivy()
  const { baseAccountSdk } = useBaseAccountSdk()
  const { data: wagmiWalletClient } = useWalletClient()
  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined

  const [preview, setPreview] = useState<AddOwnerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRequestIdRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<AddOwnerErrorDetail | null>(null)

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])

  const appendEvent = useMemo(
    () =>
      import.meta.env.DEV
        ? (row: string) => setEventLog((prev) => [...prev, row].slice(-40))
        : () => {},
    [],
  )

  const fetchPreview = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !ownerSignerAddress) {
      setPageError(
        isSelfAuthSession
          ? 'Connect your canonical smart wallet in Base App first.'
          : 'Connect an on-chain CSW owner wallet first.',
      )
      return null
    }

    const requestId = ++previewRequestIdRef.current
    setPreviewLoading(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setPreview(null)
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
      if (requestId !== previewRequestIdRef.current) return null
      setPreview(data)
      if (data.preflight.alreadyOwner) {
        setPageNotice('4626 signing is already enabled on this wallet.')
      }
      return data
    } catch (err: unknown) {
      if (requestId !== previewRequestIdRef.current) return null
      setPageError(err instanceof Error ? err.message : 'Failed to build add-owner preview.')
      return null
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }, [canonicalCswAddress, enabled, getAccessToken, isSelfAuthSession, ownerSignerAddress])

  const setErrorDetail = useCallback((input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
  }, [])

  const handleAdd = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !ownerSignerAddress) {
      setPageError(
        isSelfAuthSession
          ? 'Connect your canonical smart wallet in Base App first.'
          : 'Connect an on-chain CSW owner wallet first.',
      )
      return false
    }

    let activePreview = preview
    if (!activePreview) {
      activePreview = await fetchPreview()
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
      setPageError(
        isSelfAuthSession
          ? 'Base App wallet session is unavailable. Reconnect your smart wallet and retry.'
          : 'Connect the owner wallet that will fund the Relay deposit, then retry.',
      )
      return false
    }

    setBusy(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent('lane:preview_bound_relay_user_call')
    appendEvent(`target:owner=${activePreview.preflight.ownerToAdd}`)
    appendEvent(`target:selector=${activePreview.txRequest.data.slice(0, 10)}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)

    let requiredDepositWei: bigint | null = null
    const latestCswBalanceWei: bigint | null = null

    try {
      if (activePreview.relay?.userCall?.value) {
        requiredDepositWei = BigInt(activePreview.relay.userCall.value)
      }

      const walletRequest = resolveOwnerMutationSessionWalletRequest({
        isSelfAuthSession,
        walletClient,
        wagmiWalletClient,
        baseAccountSdk,
      })
      if (isSelfAuthSession && !walletRequest) {
        setPageError('Base App wallet session is unavailable. Reconnect your smart wallet and retry.')
        return false
      }

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

      setPageNotice(`4626 signing enabled via Relay (execution tx ${result.txHash.slice(0, 10)}…).`)
      setPreview(null)
      return true
    } catch (err: unknown) {
      appendEvent(`error:${getWalletErrorMessage(err).slice(0, 260)}`)
      if (err && typeof err === 'object') {
        const record = err as Record<string, unknown>
        const revertDataCandidate =
          typeof record.data === 'string'
            ? record.data
            : typeof record.revertData === 'string'
              ? record.revertData
              : null
        if (revertDataCandidate || typeof record.shortMessage === 'string') {
          setErrorDetail({
            revertReason:
              typeof record.shortMessage === 'string'
                ? record.shortMessage
                : typeof record.message === 'string'
                  ? record.message
                  : null,
            revertData: revertDataCandidate,
          })
        }
      }
      const mapped = mapRemoveOwnerSubmissionError({
        error: err,
        requiredDepositWei,
        latestCswBalanceWei,
      })
      setPageError(mapped ?? getWalletErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [
    appendEvent,
    baseAccountSdk,
    canonicalCswAddress,
    enabled,
    fetchPreview,
    isSelfAuthSession,
    ownerSignerAddress,
    preview,
    privyExternalOwnerWallet,
    publicClient,
    setErrorDetail,
    wagmiWalletClient,
  ])

  return {
    preview,
    previewLoading,
    busy,
    pageError,
    pageNotice,
    txHash,
    eventLog,
    lastErrorDetail,
    isSelfAuthSession,
    fetchPreview,
    handleAdd,
  }
}
