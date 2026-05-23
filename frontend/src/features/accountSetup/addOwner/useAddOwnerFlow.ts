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
import { resolveOwnerMutationSignerContext } from '@/lib/relay/resolveOwnerMutationSignerContext'

export type AddOwnerErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type UseAddOwnerFlowParams = {
  canonicalCswAddress: string | null | undefined
  /** When set, owner mutation targets this CSW (sub-account) instead of `canonicalCswAddress`. */
  targetCswAddress?: string | null | undefined
  /** When set, self-auth Relay deposit is paid from this CSW (e.g. parent custody wallet for sub-account track). */
  relayFundingCswAddress?: string | null | undefined
  ownerSignerAddress: string | null | undefined
  privyEmbeddedEoaAddress?: string | null | undefined
  privyExternalOwnerWallet?: unknown
  /** Sub-account panel: parent CSW pays deposit via self-auth even outside Base App WebView. */
  preferFundingCswSelfAuth?: boolean
  enabled?: boolean
}

export function useAddOwnerFlow(params: UseAddOwnerFlowParams) {
  const {
    canonicalCswAddress,
    targetCswAddress,
    relayFundingCswAddress,
    ownerSignerAddress,
    privyEmbeddedEoaAddress,
    privyExternalOwnerWallet,
    preferFundingCswSelfAuth = false,
    enabled = true,
  } = params

  const mutationCswAddress = targetCswAddress ?? canonicalCswAddress
  const fundingCswAddress = relayFundingCswAddress ?? mutationCswAddress
  const signerContext = useMemo(
    () =>
      resolveOwnerMutationSignerContext({
        canonicalCswAddress,
        fundingCswAddress,
        connectedAddress: ownerSignerAddress,
        privyEmbeddedEoaAddress,
        preferFundingCswSelfAuth,
      }),
    [
      canonicalCswAddress,
      fundingCswAddress,
      ownerSignerAddress,
      preferFundingCswSelfAuth,
      privyEmbeddedEoaAddress,
    ],
  )
  const relayConnectedAddress = signerContext.relayConnectedAddress
  const isSelfAuthSession = signerContext.isSelfAuthSession
  const signingReady = signerContext.signingReady
  const signingBlockedReason = signerContext.blockedReason

  const selfAuthWalletLabel =
    targetCswAddress && relayFundingCswAddress ? 'main Base wallet' : targetCswAddress ? 'app wallet' : 'canonical smart wallet'

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

  const appendEvent = useMemo(
    () =>
      import.meta.env.DEV
        ? (row: string) => setEventLog((prev) => [...prev, row].slice(-40))
        : () => {},
    [],
  )

  const fetchPreview = useCallback(async () => {
    if (!enabled || !mutationCswAddress || !signingReady || !relayConnectedAddress) {
      setPageError(
        signingBlockedReason ??
          (isSelfAuthSession
            ? `Connect your ${selfAuthWalletLabel} in Base App first.`
            : 'Connect an on-chain CSW owner wallet first.'),
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
        connectedAddress: relayConnectedAddress,
        targetCswAddress: targetCswAddress ?? undefined,
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
  }, [
    enabled,
    getAccessToken,
    isSelfAuthSession,
    mutationCswAddress,
    relayConnectedAddress,
    selfAuthWalletLabel,
    signingBlockedReason,
    signingReady,
    targetCswAddress,
  ])

  const setErrorDetail = useCallback((input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
  }, [])

  const handleAdd = useCallback(async () => {
    if (!enabled || !mutationCswAddress || !signingReady || !relayConnectedAddress) {
      setPageError(
        signingBlockedReason ??
          (isSelfAuthSession
            ? `Connect your ${selfAuthWalletLabel} in Base App first.`
            : 'Connect an on-chain CSW owner wallet first.'),
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
      ownerSignerAddress: relayConnectedAddress,
      privyExternalOwnerWallet,
      isSelfAuthSession,
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
    let latestCswBalanceWei: bigint | null = null

    try {
      if (activePreview.relay?.userCall?.value) {
        requiredDepositWei = BigInt(activePreview.relay.userCall.value)
      }
      if (isSelfAuthSession && publicClient && fundingCswAddress) {
        latestCswBalanceWei = await publicClient.getBalance({
          address: fundingCswAddress as `0x${string}`,
        })
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
        cswAddress: mutationCswAddress as `0x${string}`,
        fundingCswAddress:
          fundingCswAddress && fundingCswAddress !== mutationCswAddress
            ? (fundingCswAddress as `0x${string}`)
            : undefined,
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
        isSelfAuthSession,
        fundingCswAddress: fundingCswAddress,
      })
      setPageError(mapped ?? getWalletErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [
    appendEvent,
    baseAccountSdk,
    enabled,
    fetchPreview,
    fundingCswAddress,
    isSelfAuthSession,
    mutationCswAddress,
    preview,
    privyExternalOwnerWallet,
    publicClient,
    relayConnectedAddress,
    selfAuthWalletLabel,
    setErrorDetail,
    signingBlockedReason,
    signingReady,
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
    signingReady,
    signingBlockedReason,
    fetchPreview,
    handleAdd,
  }
}
