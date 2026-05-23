import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBaseAccountSdk } from '@privy-io/react-auth'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import type { PublicClient } from 'viem'

import { executeRemoveOwnerViaRelay } from '@/lib/removeOwner/removeOwnerExecution'
import {
  fetchRemoveOwnerPreview,
  getWalletErrorMessage,
  INITIAL_DIAGNOSTICS,
  loadLiveCswDiagnostics,
  mapRemoveOwnerSubmissionError,
  type LiveDiagnostics,
  type RemoveOwnerPreview,
} from '@/lib/removeOwner/removeOwnerHelpers'
import {
  resolveOwnerMutationSessionWalletRequest,
  resolveOwnerMutationWallet,
} from '@/lib/relay/resolveOwnerMutationWallet'
import { resolveOwnerMutationSignerContext } from '@/lib/relay/resolveOwnerMutationSignerContext'

export type RemoveOwnerErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type UseRemoveOwnerFlowParams = {
  canonicalCswAddress: string | null | undefined
  ownerSignerAddress: string | null | undefined
  privyEmbeddedEoaAddress?: string | null | undefined
  privyExternalOwnerWallet?: unknown
}

export function useRemoveOwnerFlow(params: UseRemoveOwnerFlowParams) {
  const {
    canonicalCswAddress,
    ownerSignerAddress,
    privyEmbeddedEoaAddress,
    privyExternalOwnerWallet,
  } = params
  const signerContext = useMemo(
    () =>
      resolveOwnerMutationSignerContext({
        canonicalCswAddress,
        connectedAddress: ownerSignerAddress,
        privyEmbeddedEoaAddress,
      }),
    [canonicalCswAddress, ownerSignerAddress, privyEmbeddedEoaAddress],
  )
  const relayConnectedAddress = signerContext.relayConnectedAddress
  const isSelfAuthSession = signerContext.isSelfAuthSession
  const signingReady = signerContext.signingReady
  const signingBlockedReason = signerContext.blockedReason
  const { baseAccountSdk } = useBaseAccountSdk()
  const { data: wagmiWalletClient } = useWalletClient()
  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined

  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics>(INITIAL_DIAGNOSTICS)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<RemoveOwnerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRequestIdRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<RemoveOwnerErrorDetail | null>(null)

  const appendEvent = useMemo(
    () =>
      import.meta.env.DEV
        ? (row: string) => setEventLog((prev) => [...prev, row].slice(-40))
        : () => {},
    [],
  )

  useEffect(() => {
    let cancelled = false
    if (!canonicalCswAddress || !publicClient) {
      setDiagnostics(INITIAL_DIAGNOSTICS)
      return () => {
        cancelled = true
      }
    }
    setDiagnostics({ ...INITIAL_DIAGNOSTICS, status: 'loading' })
    void loadLiveCswDiagnostics({
      publicClient,
      cswAddress: canonicalCswAddress as `0x${string}`,
    }).then((next) => {
      if (!cancelled) setDiagnostics(next)
    })
    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress, publicClient])

  const fetchPreview = useCallback(
    async (index: number) => {
      if (!canonicalCswAddress || !signingReady || !relayConnectedAddress) {
        setPageError(
          signingBlockedReason ??
            'Connect your Base smart wallet or an external owner wallet first.',
        )
        return
      }
      const requestId = ++previewRequestIdRef.current
      setPreviewLoading(true)
      setPageError(null)
      setLastErrorDetail(null)
      setPageNotice(null)
      setPreview(null)
      setTxHash(null)
      try {
        const data = await fetchRemoveOwnerPreview({
          cswAddress: canonicalCswAddress,
          connectedAddress: relayConnectedAddress,
          ownerIndex: index,
        })
        if (requestId !== previewRequestIdRef.current) return
        setPreview(data)
      } catch (err: unknown) {
        if (requestId !== previewRequestIdRef.current) return
        setPageError(err instanceof Error ? err.message : 'Failed to build remove-owner preview.')
      } finally {
        if (requestId === previewRequestIdRef.current) {
          setPreviewLoading(false)
        }
      }
    },
    [canonicalCswAddress, relayConnectedAddress, signingBlockedReason, signingReady],
  )

  const handleSelectIndex = useCallback(
    (index: number) => {
      setSelectedIndex(index)
      void fetchPreview(index)
    },
    [fetchPreview],
  )

  const setErrorDetail = useCallback((input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
  }, [])

  const handleRemove = useCallback(async () => {
    if (!preview || !canonicalCswAddress || !signingReady || !relayConnectedAddress || selectedIndex === null) {
      setPageError(
        signingBlockedReason ?? 'Connect your wallet and select an owner index first.',
      )
      return
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
      return
    }

    setBusy(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent('lane:preview_bound_relay_user_call')
    appendEvent(`target:function=${preview.preflight.selectedFunction}`)
    appendEvent(`target:index=${preview.preflight.targetOwnerIndex}`)
    appendEvent(`target:owner=${preview.preflight.targetOwnerAddress ?? '<bytes>'}`)
    appendEvent(`target:selector=${preview.txRequest.data.slice(0, 10)}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)

    let requiredDepositWei: bigint | null = null
    let latestCswBalanceWei: bigint | null = null

    try {
      if (preview.relay?.userCall?.value) {
        requiredDepositWei = BigInt(preview.relay.userCall.value)
      }
      if (isSelfAuthSession && publicClient && canonicalCswAddress) {
        latestCswBalanceWei = await publicClient.getBalance({
          address: canonicalCswAddress as `0x${string}`,
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
        return
      }
      const result = await executeRemoveOwnerViaRelay({
        preview,
        selectedIndex,
        cswAddress: canonicalCswAddress as `0x${string}`,
        publicClient,
        walletClient,
        walletRequest,
        isSelfAuthSession,
        appendEvent,
        onTxHash: setTxHash,
      })

      setPageNotice(`Owner removal confirmed on-chain (execution tx ${result.txHash.slice(0, 10)}…).`)
      setPreview(null)
      setSelectedIndex(null)
      if (publicClient && canonicalCswAddress) {
        void loadLiveCswDiagnostics({
          publicClient,
          cswAddress: canonicalCswAddress as `0x${string}`,
        }).then(setDiagnostics)
      }
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
        fundingCswAddress: canonicalCswAddress,
      })
      setPageError(mapped ?? getWalletErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [
    appendEvent,
    baseAccountSdk,
    canonicalCswAddress,
    isSelfAuthSession,
    preview,
    privyExternalOwnerWallet,
    publicClient,
    relayConnectedAddress,
    selectedIndex,
    setErrorDetail,
    signingBlockedReason,
    signingReady,
    wagmiWalletClient,
  ])

  return {
    diagnostics,
    selectedIndex,
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
    handleSelectIndex,
    handleRemove,
  }
}
