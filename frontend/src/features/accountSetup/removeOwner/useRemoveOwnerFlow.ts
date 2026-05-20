import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { useQuote } from '@relayprotocol/relay-kit-hooks'
import type { paths } from '@relayprotocol/relay-sdk'
import type { PublicClient } from 'viem'

import { NATIVE_CURRENCY_ADDRESS } from '@/lib/wallet/cswOwnerAbi'
import { encodeExecuteWithoutChainIdValidation } from '@/lib/wallet/onboardingWalletReplayable'
import { executeRemoveOwnerViaRelay } from '@/lib/removeOwner/removeOwnerExecution'
import {
  fetchRemoveOwnerPreview,
  getWalletErrorMessage,
  INITIAL_DIAGNOSTICS,
  loadLiveCswDiagnostics,
  mapRemoveOwnerSubmissionError,
  toRelayAmountDecimal,
  type LiveDiagnostics,
  type RemoveOwnerPreview,
} from '@/lib/removeOwner/removeOwnerHelpers'
import { createRemoveOwnerRelayClient } from '@/lib/removeOwner/removeOwnerRelayClient'

type RelayQuoteBody = paths['/quote/v2']['post']['requestBody']['content']['application/json']

export type RemoveOwnerErrorDetail = {
  revertReason: string | null
  revertData: string | null
  relayTx: unknown
  rawBody: string | null
}

type UseRemoveOwnerFlowParams = {
  canonicalCswAddress: string | null | undefined
  ownerSignerAddress: string | null | undefined
}

export function useRemoveOwnerFlow(params: UseRemoveOwnerFlowParams) {
  const { canonicalCswAddress, ownerSignerAddress } = params
  const { data: walletClient } = useWalletClient()
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

  const relayClient = useMemo(() => createRemoveOwnerRelayClient(), [])

  const relayQuoteOptions = useMemo<RelayQuoteBody | undefined>(() => {
    if (!preview || !canonicalCswAddress || !ownerSignerAddress) return undefined
    if (!preview.relay) return undefined
    const amountDecimal =
      toRelayAmountDecimal(preview.relay.paymentDetails?.amount) ??
      toRelayAmountDecimal(preview.relay.userCall?.value)
    if (!amountDecimal) return undefined
    return {
      user: ownerSignerAddress,
      recipient: canonicalCswAddress,
      originChainId: base.id,
      destinationChainId: base.id,
      originCurrency: NATIVE_CURRENCY_ADDRESS,
      destinationCurrency: NATIVE_CURRENCY_ADDRESS,
      tradeType: 'EXACT_OUTPUT',
      amount: amountDecimal,
      originGasOverhead: 300000,
      subsidizeFees: true,
      txs: [
        {
          to: canonicalCswAddress,
          data: encodeExecuteWithoutChainIdValidation(preview.txRequest.data),
          value: '0',
        },
      ],
    } satisfies RelayQuoteBody
  }, [canonicalCswAddress, ownerSignerAddress, preview])

  const {
    data: relayHookQuote,
    error: relayHookQuoteError,
    refetch: refetchRelayHookQuote,
    executeQuote,
  } = useQuote(
    relayClient,
    walletClient,
    relayQuoteOptions,
    undefined,
    undefined,
    {
      enabled: Boolean(relayQuoteOptions),
      retry: false,
      refetchOnWindowFocus: false,
    },
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
      if (!canonicalCswAddress || !ownerSignerAddress) {
        setPageError('Connect a wallet that owns this CSW (or the CSW itself) first.')
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
          connectedAddress: ownerSignerAddress,
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
    [canonicalCswAddress, ownerSignerAddress],
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
    if (!preview || !canonicalCswAddress || !walletClient || selectedIndex === null) {
      setPageError('Connect your wallet and select an owner index first.')
      return
    }

    setBusy(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent('lane:relay_hook_execute_quote')
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

      const walletRequest = (walletClient as { request?: WalletRequest }).request
      const result = await executeRemoveOwnerViaRelay({
        preview,
        selectedIndex,
        cswAddress: canonicalCswAddress as `0x${string}`,
        publicClient,
        walletRequest: walletRequest
          ? async (args) => await walletRequest(args)
          : undefined,
        isSelfAuthSession,
        relayQuoteReady: Boolean(relayQuoteOptions),
        relayHookQuote,
        relayHookQuoteError,
        refetchRelayHookQuote: async () => {
          const refetchResult = await refetchRelayHookQuote()
          return { data: refetchResult.data, status: refetchResult.status }
        },
        executeQuote,
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
      })
      setPageError(mapped ?? getWalletErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [
    appendEvent,
    canonicalCswAddress,
    executeQuote,
    isSelfAuthSession,
    preview,
    publicClient,
    refetchRelayHookQuote,
    relayHookQuote,
    relayHookQuoteError,
    relayQuoteOptions,
    selectedIndex,
    setErrorDetail,
    walletClient,
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
    handleSelectIndex,
    handleRemove,
  }
}

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>
