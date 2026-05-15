import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { formatEther, type PublicClient } from 'viem'
import { useQuote } from '@relayprotocol/relay-kit-hooks'
import {
  createClient,
  MAINNET_RELAY_API,
  type paths,
  type ProgressData,
} from '@relayprotocol/relay-sdk'
import { base as baseChain } from 'viem/chains'

import { PageMeta } from '@/components/seo/PageMeta'
import { RemoveOwnerActionPanel } from '@/features/accountSetup/removeOwner/RemoveOwnerActionPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { RemoveOwnerOwnerSlotsCard } from '@/features/accountSetup/removeOwner/RemoveOwnerOwnerSlotsCard'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { encodeExecuteWithoutChainIdValidation } from '@/lib/wallet/onboardingWalletReplayable'
import * as RemoveOwnerHelpers from '@/lib/removeOwner/removeOwnerHelpers'

// Relay Protocol's depository on Base. Reference tx where this CSW deposited:
// https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
// (UserOp executeBatch -> RelayDepository.depositNative(depositor, id))
const RELAY_DEPOSITORY_BASE = RemoveOwnerHelpers.RELAY_DEPOSITORY_BASE
type RemoveOwnerPreview = RemoveOwnerHelpers.RemoveOwnerPreview
type OnchainOwnerRow = RemoveOwnerHelpers.OnchainOwnerRow
type LiveDiagnostics = RemoveOwnerHelpers.LiveDiagnostics

const normalizeRelayStatusEndpoint = RemoveOwnerHelpers.normalizeRelayStatusEndpoint
const validatePreviewRelayUserCallIsNativeDepository =
  RemoveOwnerHelpers.validatePreviewRelayUserCallIsNativeDepository
const pollRelayStatusEndpoint = RemoveOwnerHelpers.pollRelayStatusEndpoint
const extractExecuteQuotePayload = RemoveOwnerHelpers.extractExecuteQuotePayload
const INITIAL_DIAGNOSTICS = RemoveOwnerHelpers.INITIAL_DIAGNOSTICS
const CSW_OWNER_ABI = RemoveOwnerHelpers.CSW_OWNER_ABI
const classifyOwnerBytes = RemoveOwnerHelpers.classifyOwnerBytes
const decodeOwnerAddress = RemoveOwnerHelpers.decodeOwnerAddress
const REMOVE_OWNER_AT_INDEX_SELECTOR = '0x89625b57'
const RELAY_MULTICALL_SELECTOR = '0xcd6e13f7'
const EXECUTE_WITHOUT_CHAIN_ID_SELECTOR = '0x2c2abd1e'
const NATIVE_CURRENCY_ADDRESS = '0x0000000000000000000000000000000000000000'
type RelayQuoteBody = paths['/quote/v2']['post']['requestBody']['content']['application/json']
type RelayChainConfig = {
  id: number
  name: string
  displayName: string
  httpRpcUrl: string
  wsRpcUrl: string
  icon: { dark: string; light: string; squaredDark: string; squaredLight: string }
  currency: { address: string; name: string; symbol: string; decimals: number }
  explorerUrl: string
  vmType: 'evm'
  depositEnabled: boolean
  viemChain: typeof baseChain
}

const RELAY_BASE_CHAIN: RelayChainConfig = {
  id: baseChain.id,
  name: 'base',
  displayName: 'Base',
  httpRpcUrl: baseChain.rpcUrls.default.http[0] ?? 'https://mainnet.base.org',
  wsRpcUrl:
    ((((baseChain as unknown as { rpcUrls?: { default?: { webSocket?: string[] } } }).rpcUrls?.default
      ?.webSocket?.[0] as string | undefined) ??
      '')),
  icon: {
    dark: `https://assets.relay.link/icons/${baseChain.id}/dark.png`,
    light: `https://assets.relay.link/icons/${baseChain.id}/light.png`,
    squaredDark: `https://assets.relay.link/icons/square/${baseChain.id}/dark.png`,
    squaredLight: `https://assets.relay.link/icons/square/${baseChain.id}/light.png`,
  },
  currency: {
    address: NATIVE_CURRENCY_ADDRESS,
    name: baseChain.nativeCurrency.name,
    symbol: baseChain.nativeCurrency.symbol,
    decimals: baseChain.nativeCurrency.decimals,
  },
  explorerUrl: baseChain.blockExplorers?.default.url ?? 'https://basescan.org',
  vmType: 'evm',
  depositEnabled: true,
  viemChain: baseChain,
}

function toRelayAmountDecimal(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^[1-9][0-9]*$/.test(value)) return value
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    const wei = BigInt(value)
    return wei > 0n ? wei.toString(10) : null
  }
  return null
}

function extractRelayExecutionTxHash(raw: unknown): `0x${string}` | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const txHashes = Array.isArray(obj.txHashes) ? obj.txHashes : []
  for (const tx of txHashes) {
    if (!tx || typeof tx !== 'object') continue
    const txHash = (tx as Record<string, unknown>).txHash
    if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return txHash as `0x${string}`
    }
  }
  const steps = Array.isArray(obj.steps) ? obj.steps : []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const items = Array.isArray((step as Record<string, unknown>).items)
      ? ((step as Record<string, unknown>).items as unknown[])
      : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const itemObj = item as Record<string, unknown>
      const receipt = itemObj.receipt
      if (receipt && typeof receipt === 'object') {
        const txHash = (receipt as Record<string, unknown>).transactionHash
        if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          return txHash as `0x${string}`
        }
      }
      const itemTxHashes = Array.isArray(itemObj.txHashes) ? (itemObj.txHashes as unknown[]) : []
      for (const tx of itemTxHashes) {
        if (!tx || typeof tx !== 'object') continue
        const txHash = (tx as Record<string, unknown>).txHash
        if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          return txHash as `0x${string}`
        }
      }
    }
  }
  return null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const maybeMessage = (error as Record<string, unknown>).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
    try {
      return JSON.stringify(error)
    } catch {}
  }
  return 'unknown error'
}

export function RemoveOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/remove-owner' })
  const {
    canonicalCswAddress,
    loading,
    privyAuthed,
    login,
    ownerSignerAddress,
  } = controller
  const { data: walletClient } = useWalletClient()

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalUrl = useMemo(() => externalBrowserUrlFor('/remove-owner'), [])

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
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    revertReason: string | null
    revertData: string | null
    relayTx: unknown
    rawBody: string | null
  } | null>(null)

  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined
  const relayClient = useMemo(
    () =>
      createClient({
        baseApiUrl: MAINNET_RELAY_API,
        source: '4626-remove-owner',
        chains: [RELAY_BASE_CHAIN],
      }),
    [],
  )
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
    void (async () => {
      try {
        const cswAddress = canonicalCswAddress as `0x${string}`
        const [ownerCountRaw, nextOwnerIndexRaw, cswBalance, depositoryBalance] = await Promise.all([
          publicClient.readContract({
            address: cswAddress,
            abi: CSW_OWNER_ABI,
            functionName: 'ownerCount',
          }),
          publicClient.readContract({
            address: cswAddress,
            abi: CSW_OWNER_ABI,
            functionName: 'nextOwnerIndex',
          }),
          publicClient.getBalance({ address: cswAddress }),
          publicClient.getBalance({ address: RELAY_DEPOSITORY_BASE }),
        ])
        const nextOwnerIndex = Number(nextOwnerIndexRaw)
        const SCAN_HARD_CEILING = 256
        const rawScanLimit = Math.max(nextOwnerIndex, Number(ownerCountRaw))
        const scanLimit = Math.min(rawScanLimit, SCAN_HARD_CEILING)
        const slotResults = await Promise.allSettled(
          Array.from({ length: scanLimit }, (_, idx) =>
            publicClient.readContract({
              address: cswAddress,
              abi: CSW_OWNER_ABI,
              functionName: 'ownerAtIndex',
              args: [BigInt(idx)],
            }),
          ),
        )
        const owners: OnchainOwnerRow[] = slotResults.map((result, idx) => {
          if (result.status === 'rejected') {
            const message =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason ?? 'read failed')
            return {
              index: idx,
              ownerBytes: '0x',
              ownerAddress: null,
              type: 'unreadable',
              readError: message,
            }
          }
          const ownerBytes = result.value as `0x${string}`
          return {
            index: idx,
            ownerBytes,
            ownerAddress: decodeOwnerAddress(ownerBytes),
            type: classifyOwnerBytes(ownerBytes),
            readError: null,
          }
        })
        if (cancelled) return
        setDiagnostics({
          status: 'ready',
          ownerCount: Number(ownerCountRaw),
          nextOwnerIndex,
          owners,
          cswEthBalance: cswBalance,
          relayDepositoryEthBalance: depositoryBalance,
          error: null,
        })
      } catch (err: any) {
        if (cancelled) return
        setDiagnostics({
          ...INITIAL_DIAGNOSTICS,
          status: 'error',
          error: typeof err?.message === 'string' ? err.message : 'Failed to load on-chain diagnostics.',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress, publicClient])

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])

  const appendEvent = (row: string) => {
    setEventLog((prev) => [...prev, row].slice(-40))
  }

  const formatEthAmount = (value: bigint): string => {
    const raw = formatEther(value)
    const [whole = '0', fraction = ''] = raw.split('.')
    const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 6)
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
  }

  const mapRemoveOwnerSubmissionError = (params: {
    error: unknown
    requiredDepositWei: bigint | null
    latestCswBalanceWei: bigint | null
  }): string | null => {
    const message =
      params.error instanceof Error
        ? params.error.message
        : typeof params.error === 'string'
          ? params.error
          : ''
    const normalized = message.toLowerCase()

    if (normalized.includes('networkid must be provided and not empty')) {
      return (
        'Relay quote metadata is missing a network identifier. Refresh the preview, keep your wallet on Base, and retry. ' +
        'If this keeps happening, regenerate the preview from the owner list before submitting.'
      )
    }

    if (
      normalized.includes('failed to estimate gas for user operation') &&
      normalized.includes('useroperation reverted')
    ) {
      const depositHint =
        params.requiredDepositWei && params.requiredDepositWei > 0n
          ? ` Required relay deposit: ${formatEthAmount(params.requiredDepositWei)} ETH.`
          : ''
      const balanceHint =
        params.latestCswBalanceWei !== null
          ? ` Current CSW balance: ${formatEthAmount(params.latestCswBalanceWei)} ETH.`
          : ''
      return (
        'Coinbase Wallet could not simulate this remove-owner UserOp. ' +
        'This usually means the targeted owner slot changed, the signer context is stale, or the CSW does not have enough ETH for Relay deposit.' +
        depositHint +
        balanceHint +
        ' Re-open the owner list to rebuild preview state, confirm the same owner is still at that index, and fund the CSW if needed.'
      )
    }
    return null
  }

  const fetchPreview = async (index: number) => {
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
      const res = await apiFetch('/api/onboarding/preview-remove-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cswAddress: canonicalCswAddress,
          connectedAddress: ownerSignerAddress,
          ownerIndex: index,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        data?: RemoveOwnerPreview
      } | null
      if (requestId !== previewRequestIdRef.current) return
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? `preview-remove-owner failed (${res.status})`)
      }
      setPreview(json.data)
    } catch (err: any) {
      if (requestId !== previewRequestIdRef.current) return
      setPageError(typeof err?.message === 'string' ? err.message : 'Failed to build remove-owner preview.')
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }

  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index)
    void fetchPreview(index)
  }

  const setErrorDetail = (input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
  }

  const handleRemove = async () => {
    if (!preview || !canonicalCswAddress || !walletClient) {
      setPageError('Connect your wallet and select an owner index first.')
      return
    }
    if (selectedIndex !== preview.preflight.targetOwnerIndex) {
      setPageError(
        `Preview is for index ${preview.preflight.targetOwnerIndex} but selection is ${selectedIndex ?? 'none'}. Re-click the owner row and retry.`,
      )
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
      if (preview.txRequest.data.slice(0, 10).toLowerCase() !== REMOVE_OWNER_AT_INDEX_SELECTOR) {
        throw new Error(
          `Preview mutation selector mismatch (expected ${REMOVE_OWNER_AT_INDEX_SELECTOR}, got ${preview.txRequest.data.slice(0, 10)}).`,
        )
      }
      if (!preview.relay) {
        throw new Error(
          preview.preflight.relayQuoteError ??
            'Relay quote unavailable; this route requires Relay orchestration.',
        )
      }
      const relayGuard = validatePreviewRelayUserCallIsNativeDepository(preview)
      if (relayGuard) {
        throw new Error(`Relay preview guard failed: ${relayGuard}.`)
      }
      requiredDepositWei = BigInt(preview.relay.userCall.value)
      appendEvent(`precheck:required_deposit_wei=${requiredDepositWei.toString(10)}`)

      if (publicClient) {
        appendEvent('precheck:owner_slot_refresh=start')
        const latestTargetOwnerBytes = (await publicClient.readContract({
          address: canonicalCswAddress as `0x${string}`,
          abi: CSW_OWNER_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(preview.preflight.targetOwnerIndex)],
        })) as `0x${string}`
        appendEvent(`precheck:owner_slot_refresh.bytes=${latestTargetOwnerBytes}`)
        if (latestTargetOwnerBytes.toLowerCase() !== preview.preflight.targetOwnerBytes.toLowerCase()) {
          const latestOwnerAddress = decodeOwnerAddress(latestTargetOwnerBytes)
          throw new Error(
            `Owner slot ${preview.preflight.targetOwnerIndex} changed since preview generation (was ${preview.preflight.targetOwnerAddress ?? preview.preflight.targetOwnerBytes}, now ${latestOwnerAddress ?? latestTargetOwnerBytes}). Re-select the owner and retry.`,
          )
        }
      }

      if (isSelfAuthSession && publicClient) {
        latestCswBalanceWei = await publicClient.getBalance({
          address: canonicalCswAddress as `0x${string}`,
        })
        appendEvent(`precheck:csw_balance_wei=${latestCswBalanceWei.toString(10)}`)
        if (requiredDepositWei > 0n && latestCswBalanceWei < requiredDepositWei) {
          throw new Error(
            `Canonical CSW balance (${formatEthAmount(latestCswBalanceWei)} ETH) is below required Relay deposit (${formatEthAmount(requiredDepositWei)} ETH). Fund the CSW and retry.`,
          )
        }
      }

      if (publicClient) {
        appendEvent('precheck:remove_owner_call_simulation=start')
        try {
          await publicClient.call({
            account: canonicalCswAddress as `0x${string}`,
            to: canonicalCswAddress as `0x${string}`,
            data: preview.txRequest.data,
          })
          appendEvent('precheck:remove_owner_call_simulation=ok')
        } catch (simulationError: unknown) {
          const message =
            simulationError instanceof Error
              ? simulationError.message
              : typeof simulationError === 'string'
                ? simulationError
                : 'unknown simulation error'
          appendEvent(`precheck:remove_owner_call_simulation=failed:${message.slice(0, 220)}`)
          throw new Error(
            `On-chain precheck failed for remove-owner mutation: ${message}. Refresh the owner list and rebuild preview before retrying.`,
          )
        }
      }

      const statusEndpoint = normalizeRelayStatusEndpoint(null, preview.relay.requestId)
      appendEvent(`relay:preview_request_id=${preview.relay.requestId}`)
      appendEvent(`relay:user_call_to=${preview.relay.userCall.to}`)
      appendEvent(`relay:user_call_value=${preview.relay.userCall.value}`)
      appendEvent(`relay:user_call_selector=${preview.relay.userCall.data.slice(0, 10)}`)
      appendEvent(`relay:user_call_source=${preview.relay.userCallSource}`)
      appendEvent(`relay:order_id=${preview.relay.orderId ?? 'n/a'}`)
      if (preview.relay.paymentDetails) {
        appendEvent(`relay:payment_depository=${preview.relay.paymentDetails.depository}`)
        appendEvent(`relay:payment_currency=${preview.relay.paymentDetails.currency}`)
        appendEvent(`relay:payment_amount=${preview.relay.paymentDetails.amount}`)
      }
      if (!relayQuoteOptions) {
        throw new Error(
          'Relay quote options are not ready (missing amount/user/recipient/tx payload). Rebuild preview and retry.',
        )
      }
      appendEvent(`relay:status_endpoint_fallback=${statusEndpoint}`)
      let executeTxHash: `0x${string}` | null = null
      let requestId: `0x${string}` = preview.relay.requestId
      let statusEndpointFromExecute = statusEndpoint
      let activeQuote = relayHookQuote
      if (!activeQuote) {
        appendEvent('relay_quote:refetch=start')
        const refetchResult = await refetchRelayHookQuote()
        activeQuote = refetchResult.data
        appendEvent(`relay_quote:refetch=status=${refetchResult.status}`)
      }
      if (!activeQuote) {
        const quoteErrorMessage =
          relayHookQuoteError instanceof Error
            ? relayHookQuoteError.message
            : relayHookQuoteError
              ? String(relayHookQuoteError)
              : 'unknown quote error'
        throw new Error(`Relay hook quote unavailable: ${quoteErrorMessage}`)
      }
      const quotedPayload = extractExecuteQuotePayload(activeQuote)
      const quotedRequestId = quotedPayload?.requestId ?? preview.relay.requestId
      appendEvent(`relay_quote:request_id=${quotedRequestId ?? 'n/a'}`)
      appendEvent(`relay_quote:tx_value_wei=${quotedPayload?.txValueWei ?? 'n/a'}`)
      const executeProgressHashes = new Set<string>()
      appendEvent('relay_execute:start')
      const executed = await executeQuote((progress: ProgressData) => {
        const stepId = progress.currentStep?.id ?? 'unknown'
        const stepKind = progress.currentStep?.kind ?? 'unknown'
        const itemStatus = progress.currentStepItem?.status ?? 'unknown'
        const checkStatus = progress.currentStepItem?.checkStatus ?? 'n/a'
        appendEvent(
          `relay_execute:step=${stepId} kind=${stepKind} status=${itemStatus} check=${checkStatus}`,
        )
        const progressTxHashes = Array.isArray(progress.txHashes) ? progress.txHashes : []
        for (const txEntry of progressTxHashes) {
          const txHash = txEntry?.txHash
          if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) continue
          if (executeProgressHashes.has(txHash)) continue
          executeProgressHashes.add(txHash)
          executeTxHash = txHash as `0x${string}`
          setTxHash(txHash)
          appendEvent(`relay_execute:tx_hash=${txHash} chain=${txEntry.chainId}`)
        }
        if (progress.error) {
          appendEvent(`relay_execute:error=${String(progress.error).slice(0, 220)}`)
        }
      })
      if (!executed?.data) {
        appendEvent('relay_execute:no_data')
        throw new Error(
          'Relay hook executeQuote returned no data. This usually means the wallet execution was cancelled before Relay accepted it.',
        )
      }
      const executedPayload = extractExecuteQuotePayload(executed.data)
      requestId = executedPayload?.requestId ?? quotedRequestId ?? preview.relay.requestId
      appendEvent(`relay_execute:request_id=${requestId}`)
      statusEndpointFromExecute = normalizeRelayStatusEndpoint(
        executedPayload?.statusEndpoint ?? quotedPayload?.statusEndpoint ?? null,
        requestId,
      )
      appendEvent(`relay_execute:status_endpoint=${statusEndpointFromExecute}`)
      const executeResultTxHash = extractRelayExecutionTxHash(executed.data)
      if (executeResultTxHash && !executeTxHash) {
        executeTxHash = executeResultTxHash
        setTxHash(executeResultTxHash)
        appendEvent(`relay_execute:result_tx_hash=${executeResultTxHash}`)
      }
      const status = await pollRelayStatusEndpoint({
        statusEndpoint: statusEndpointFromExecute,
        timeoutMs: 120_000,
        intervalMs: 2_000,
        onTick: (message) => appendEvent(`relay_status.${message}`),
      })
      if (!status.done || !status.success) {
        appendEvent('relay_status.result=failed_or_timeout')
        throw new Error(
          `ERR_RELAY_STATUS_INCOMPLETE:${String((status.raw as any)?.status ?? 'unknown')}`,
        )
      }
      const verifiedRelayTxHash = status.txHash ?? executeTxHash
      if (!verifiedRelayTxHash) {
        throw new Error(
          'Relay reported success but no execution tx hash was surfaced by status or executeQuote progress.',
        )
      }
      setTxHash(verifiedRelayTxHash)
      if (publicClient) {
        const relayExecutionTx = await publicClient.getTransaction({
          hash: verifiedRelayTxHash,
        })
        const relayInput = String(relayExecutionTx.input ?? '').toLowerCase()
        appendEvent(`relay_execution.tx_selector=${relayInput.slice(0, 10) || 'n/a'}`)
        if (!relayInput.startsWith(RELAY_MULTICALL_SELECTOR)) {
          throw new Error(
            `Relay fill tx selector mismatch (expected ${RELAY_MULTICALL_SELECTOR}, got ${relayInput.slice(0, 10) || 'n/a'}).`,
          )
        }
        if (!relayInput.includes(EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.slice(2))) {
          throw new Error(
            `Relay fill tx missing executeWithoutChainIdValidation selector (${EXECUTE_WITHOUT_CHAIN_ID_SELECTOR}).`,
          )
        }
        if (!relayInput.includes(REMOVE_OWNER_AT_INDEX_SELECTOR.slice(2))) {
          throw new Error(
            `Relay fill tx missing removeOwnerAtIndex selector (${REMOVE_OWNER_AT_INDEX_SELECTOR}).`,
          )
        }
        appendEvent('relay_execution.selector_chain=ok')
      }

      const slotAfter = (await publicClient?.readContract({
        address: canonicalCswAddress as `0x${string}`,
        abi: CSW_OWNER_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(preview.preflight.targetOwnerIndex)],
      })) as `0x${string}` | undefined
      const ownerRemoved =
        typeof slotAfter === 'string' &&
        slotAfter.toLowerCase() !== preview.preflight.targetOwnerBytes.toLowerCase()
      if (!ownerRemoved) {
        throw new Error(
          `Relay reported success, but owner slot ${preview.preflight.targetOwnerIndex} is unchanged.`,
        )
      }
      appendEvent('relay_execution.owner_slot_changed=ok')
      setPageNotice(
        `Owner removal confirmed on-chain (execution tx ${verifiedRelayTxHash.slice(0, 10)}…).`,
      )
      setPreview(null)
      setSelectedIndex(null)
    } catch (err: any) {
      appendEvent(`error:${getErrorMessage(err).slice(0, 260)}`)
      if (err && typeof err === 'object') {
        const revertDataCandidate =
          typeof err.data === 'string' ? err.data : typeof err.revertData === 'string' ? err.revertData : null
        if (revertDataCandidate || typeof err.shortMessage === 'string') {
          setErrorDetail({
            revertReason:
              typeof err.shortMessage === 'string'
                ? err.shortMessage
                : typeof err.message === 'string'
                  ? err.message
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
      setPageError(mapped ?? getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Remove owner"
        description="Remove an owner from your canonical Coinbase Smart Wallet via Relay two-leg execution with strict completion checks."
        canonicalPath="/remove-owner"
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Account setup
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Remove owner</h1>
          <p className="text-sm text-zinc-400">
            Remove an owner from your canonical Coinbase Smart Wallet through the
            Relay two-leg route. This page only reports success when Relay execution
            succeeds and the owner slot is changed on-chain.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to manage owners on your wallet.
            </p>
            <button
              type="button"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
              className="btn-accent btn-no-icon inline-flex"
            >
              Sign in / Continue
            </button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && !isSelfAuthSession ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-4 text-amber-100">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Open in your browser
              </div>
              <div className="text-sm font-semibold">
                {inAppEnv.isCoinbaseInApp
                  ? "Coinbase Wallet's in-app browser can block the passkey popup"
                  : 'This in-app browser can block the passkey popup'}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-amber-100/85">
              You&apos;re connected as an external signer (not the CSW itself). In-app
              browsers can block prompts or return stale signer context. Open in a
              regular browser for the best chance of success.
            </p>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
            >
              Open 4626.fun/remove-owner in browser
            </a>
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && isSelfAuthSession ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/85">
            In-app browser detected with a CSW self-auth session. This page uses
            Relay hook-native quote execution from the active signer context. If the
            wallet prompt stalls, open the page in an external browser and retry.
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <div className="space-y-4">
            {!canonicalCswAddress ? (
              <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
                <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                <div className="mt-2 text-xs text-zinc-500">
                  Connect your CSW first — head to{' '}
                  <Link to="/accounts" className="underline underline-offset-2">
                    /accounts
                  </Link>
                  .
                </div>
              </div>
            ) : (
              <>
                <RemoveOwnerOwnerSlotsCard
                  canonicalCswAddress={canonicalCswAddress as `0x${string}`}
                  ownerSignerAddress={(ownerSignerAddress as `0x${string}` | null) ?? null}
                  isSelfAuthSession={isSelfAuthSession}
                  diagnostics={diagnostics}
                  selectedIndex={selectedIndex}
                  onSelectIndex={handleSelectIndex}
                />

                {/* Preview + submit */}
                <RemoveOwnerActionPanel
                  previewLoading={previewLoading}
                  preview={preview}
                  busy={busy}
                  handleRemove={handleRemove}
                  txHash={txHash}
                  pageNotice={pageNotice}
                  pageError={pageError}
                  lastErrorDetail={lastErrorDetail}
                  eventLog={eventLog}
                />
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500 space-y-1">
          <div>
            Looking to install a signing key instead?{' '}
            <Link to="/add-owner" className="underline underline-offset-2">
              /add-owner
            </Link>
            .
          </div>
          <div>
            Need to fund the CSW before submitting?{' '}
            <Link to="/csw-funding" className="underline underline-offset-2">
              /csw-funding
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemoveOwnerPage
