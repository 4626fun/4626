import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits } from 'viem'

import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { CONTRACTS } from '@/config/contracts'
import {
  evaluateSwapPolicyInput,
  evaluateSwapPolicyRouting,
  readClientSwapPolicy,
  shouldEnable7702CanaryForAddress,
} from '@/lib/uniswap/policy'
import { normalizeUniswapError } from '@/lib/uniswap/error'
import { areEquivalentSwapTokens, BASE_CHAIN_ID, getNestedAmountOut, NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'
import type { components } from '@/lib/uniswap/generated/tradeApi'
import {
  assertValidSwapTransaction,
  buildSwap,
  buildSwap5792,
  buildSwap7702,
  checkTradeApproval,
  createOrder,
  fetchDelegationStatus,
  fetchTradeQuote,
  isUniswapXRouting,
  pickQuote,
  pickOrderQuote,
  pickSwapQuote,
  pickPermitData,
  toPermitSignPayload,
  type TradeQuoteResponse,
  type TransactionRequest,
} from '@/lib/uniswap/tradingApi'
import type { TxLifecycleState } from '@/components/trade/TransactionLifecycle'

const QUOTE_TTL_MS = 30_000
const CALIBUR_DELEGATION_ADDRESS = '0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00' as const

type Swap7702Diagnostics = {
  at: number
  chainId: number
  canaryEligible: boolean
  routing: string | null
  delegationOk: boolean
  swap5792Ok: boolean
  swap7702Ok: boolean
  notes: string[]
}

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

function asBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v))
  if (typeof v === 'string' && v.trim()) return BigInt(v)
  return 0n
}

function asOptionalBigInt(v: unknown): bigint | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string' && !v.trim()) return undefined
  return asBigInt(v)
}

function toParsableAmount(value: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.endsWith('.') ? raw.slice(0, -1) : raw
  if (!normalized) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n <= 0) return null
  return normalized
}

function buildRoutingQuotePayload(routing: unknown, quotePayload: Record<string, unknown>): Record<string, unknown> {
  const route = String(routing ?? '')
    .trim()
    .toUpperCase()
  if (route === 'CLASSIC') return { classicQuote: quotePayload }
  if (route === 'WRAP' || route === 'UNWRAP') return { wrapUnwrapQuote: quotePayload }
  if (route === 'BRIDGE') return { bridgeQuote: quotePayload }
  return { priorityQuote: quotePayload }
}

export function useSwapExecution(params: {
  address: string | undefined
  walletClient: unknown
  publicClient: any
  canonicalAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  executionMode: 'canonical' | 'eoa'
  executionAddress: `0x${string}` | null
  executionReady: boolean
  tokenIn: string
  tokenOut: string
  amountInUnits: string
  parsedSlippage: number
  parsedDeadlineMinutes: number
  chainId?: number
}) {
  const [estimatedOut, setEstimatedOut] = useState<string>('')
  const [quote, setQuote] = useState<TradeQuoteResponse | null>(null)
  const [approvalData, setApprovalData] = useState<Record<string, unknown> | null>(null)
  const [swapTx, setSwapTx] = useState<TransactionRequest | null>(null)
  const [orderRequest, setOrderRequest] = useState<{
    quote: Record<string, unknown>
    signature: string
    routing?: TradeQuoteResponse['routing']
  } | null>(null)
  const [, setOrderStatus] = useState<{
    orderId: string
    orderStatus: string
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [confirmIntent, setConfirmIntent] = useState<'approval' | 'swap' | 'order' | null>(null)
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null)
  const [quoteClockMs, setQuoteClockMs] = useState<number>(() => Date.now())
  const [permitSignatureRequired, setPermitSignatureRequired] = useState(false)
  const [permitSignaturePending, setPermitSignaturePending] = useState(false)
  const [permitSignatureReady, setPermitSignatureReady] = useState(false)
  const [txState, setTxState] = useState<TxLifecycleState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false)
  const [diagnosticsResult, setDiagnosticsResult] = useState<Swap7702Diagnostics | null>(null)
  const quoteRunRef = useRef(0)
  const getErrorMessage = useCallback((value: unknown, fallback: string): string => {
    const normalized = normalizeUniswapError(value)
    const message = normalized.message.trim()
    return message || fallback
  }, [])
  const swapPolicy = useMemo(() => readClientSwapPolicy(), [])

  type ChainId = components['schemas']['ChainId']
  const swapChainId = (params.chainId ?? BASE_CHAIN_ID) as ChainId
  const canary7702Eligible = useMemo(
    () => shouldEnable7702CanaryForAddress(swapPolicy, params.executionAddress),
    [swapPolicy, params.executionAddress],
  )
  const diagnosticsEnabled = swapPolicy.diagnosticsEnabled || canary7702Eligible

  const tokensEquivalent = useMemo(
    () => areEquivalentSwapTokens(params.tokenIn, params.tokenOut, CONTRACTS.weth),
    [params.tokenIn, params.tokenOut],
  )

  const isReady = useMemo(
    () =>
      isAddress(params.tokenIn) &&
      isAddress(params.tokenOut) &&
      !tokensEquivalent &&
      Number(params.amountInUnits) > 0 &&
      Boolean(params.executionAddress),
    [params.tokenIn, params.tokenOut, params.amountInUnits, params.executionAddress, tokensEquivalent],
  )

  const guardInputPolicy = useCallback(
    (amountBaseUnits: string): boolean => {
      const decision = evaluateSwapPolicyInput({
        policy: swapPolicy,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountBaseUnits,
        slippageBps: Math.round(params.parsedSlippage * 100),
      })
      if (!decision.allowed) {
        console.warn('[swap][policy] input blocked', {
          code: decision.code,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          mode: params.executionMode,
        })
        setError(decision.message)
      }
      return decision.allowed
    },
    [swapPolicy, params.tokenIn, params.tokenOut, params.parsedSlippage, params.executionMode],
  )

  const guardRoutingPolicy = useCallback(
    (routing: unknown): boolean => {
      const decision = evaluateSwapPolicyRouting({
        policy: swapPolicy,
        routing,
      })
      if (!decision.allowed) {
        console.warn('[swap][policy] routing blocked', {
          code: decision.code,
          routing: String(routing ?? ''),
          mode: params.executionMode,
        })
        setError(decision.message)
      }
      return decision.allowed
    },
    [swapPolicy, params.executionMode],
  )

  const approvalTx = approvalData?.approval as Record<string, unknown> | undefined
  const approvalRequired = Boolean(approvalTx?.to && approvalTx?.data)
  const quoteIsStale = quoteUpdatedAt ? quoteClockMs - quoteUpdatedAt > QUOTE_TTL_MS : true

  useEffect(() => {
    if (!quoteUpdatedAt) return
    const tick = window.setInterval(() => setQuoteClockMs(Date.now()), 1_000)
    return () => window.clearInterval(tick)
  }, [quoteUpdatedAt])

  const getTokenDecimals = useCallback(async (token: string): Promise<number> => {
    if (!params.publicClient || !isAddress(token)) return 18
    try {
      const decimals = await params.publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      return Number(decimals)
    } catch {
      return 18
    }
  }, [params.publicClient])

  const syncPermitRequirement = useCallback((nextQuote: TradeQuoteResponse | null | undefined) => {
    const requiresPermit = Boolean(pickPermitData(nextQuote))
    setPermitSignatureRequired(requiresPermit)
    setPermitSignaturePending(false)
    setPermitSignatureReady(false)
  }, [])

  const signPermitIfRequired = useCallback(async (nextQuote: TradeQuoteResponse): Promise<{
    permitData?: Record<string, unknown>
    signature?: string
  }> => {
    const permitData = pickPermitData(nextQuote)
    if (!permitData) {
      setPermitSignatureRequired(false)
      setPermitSignaturePending(false)
      setPermitSignatureReady(false)
      return {}
    }

    setPermitSignatureRequired(true)
    setPermitSignaturePending(true)
    setPermitSignatureReady(false)

    const typed = toPermitSignPayload(permitData)
    if (!typed) {
      setPermitSignaturePending(false)
      throw new Error('Permit2 payload is malformed. Please refresh the quote and try again.')
    }
    if (!params.walletClient || !params.signerAddress) {
      setPermitSignaturePending(false)
      throw new Error('Permit2 signature is required, but owner signer is not available.')
    }
    const signer = params.walletClient as any
    if (typeof signer.signTypedData !== 'function') {
      setPermitSignaturePending(false)
      throw new Error('Connected wallet does not support typed-data signatures required for Permit2.')
    }

    setStatus('Permit2 signature required. Confirm in wallet…')
    try {
      const signature = await signer.signTypedData({
        account: params.signerAddress,
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: typed.message,
      })
      if (typeof signature !== 'string' || !signature.startsWith('0x')) {
        throw new Error('Wallet returned an invalid Permit2 signature.')
      }
      setPermitSignaturePending(false)
      setPermitSignatureReady(true)
      setStatus('Permit2 signature captured. Building swap…')
      return { permitData, signature }
    } catch (error) {
      setPermitSignaturePending(false)
      setPermitSignatureReady(false)
      throw error
    }
  }, [params.walletClient, params.signerAddress])

  const resetTradeState = useCallback(() => {
    quoteRunRef.current += 1
    setQuote(null)
    setApprovalData(null)
    setSwapTx(null)
    setOrderRequest(null)
    setOrderStatus(null)
    setEstimatedOut('')
    setQuoteUpdatedAt(null)
    setPermitSignatureRequired(false)
    setPermitSignaturePending(false)
    setPermitSignatureReady(false)
    setDiagnosticsResult(null)
    setStatus('')
    setError('')
    setTxState('idle')
    setTxHash(null)
  }, [])

  const handleQuote = useCallback(async () => {
    if (!params.address || !isReady || !params.executionAddress) return
    const runId = ++quoteRunRef.current
    setBusy('quote')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(params.tokenIn)
      if (runId !== quoteRunRef.current) return
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return
      const data = await fetchTradeQuote({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        tokenInChainId: swapChainId,
        tokenOutChainId: swapChainId,
        type: 'EXACT_INPUT',
        amount,
        swapper: params.executionAddress,
        slippageTolerance: params.parsedSlippage,
        routingPreference: 'BEST_PRICE',
        // Avoid the Permit2 typed-data using a max uint160 allowance.
        // For ERC20 inputs, this makes Permit2 ask for exactly the swap amount.
        permitAmount: 'EXACT',
        walletModeKey: params.executionMode,
      })
      if (runId !== quoteRunRef.current) return
      if (!guardRoutingPolicy(data.routing)) return
      setQuote(data)
      setQuoteUpdatedAt(Date.now())
      syncPermitRequirement(data)
      setApprovalData(null)
      setSwapTx(null)
      setOrderRequest(null)
      setOrderStatus(null)
      const outRaw = getNestedAmountOut(pickQuote(data) ?? data)
      if (outRaw) {
        const tokenOutDecimals = await getTokenDecimals(params.tokenOut)
        if (runId !== quoteRunRef.current) return
        setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      } else {
        setEstimatedOut('')
      }
      setStatus(
        `Quote ready for ${params.executionMode === 'canonical' ? 'canonical CSW' : 'connected EOA'} (routing=${String(
          data.routing ?? 'unknown',
        )})`,
      )
      setTxState('review')
    } catch (e: any) {
      if (runId !== quoteRunRef.current) return
      setEstimatedOut('')
      setError(getErrorMessage(e, 'Quote failed'))
    } finally {
      if (runId === quoteRunRef.current) setBusy(null)
    }
  }, [
    params.address,
    params.executionAddress,
    params.executionMode,
    params.amountInUnits,
    params.parsedSlippage,
    params.tokenIn,
    params.tokenOut,
    swapChainId,
    isReady,
    getTokenDecimals,
    getErrorMessage,
    guardInputPolicy,
    guardRoutingPolicy,
    syncPermitRequirement,
  ])

  const handleCheckApproval = useCallback(async () => {
    if (!params.executionAddress || !isReady) return
    // Native ETH does not require ERC20 approvals (Permit2/allowance).
    // Uniswap Trading API will embed the amount in `tx.value` for native input.
    if (params.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS) {
      setError('')
      setApprovalData({ approval: null, cancel: null })
      setStatus('No token approval required for ETH')
      return
    }
    setBusy('approval')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(params.tokenIn)
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return
      const data = await checkTradeApproval({
        walletAddress: params.executionAddress,
        token: params.tokenIn,
        amount,
        chainId: swapChainId,
        tokenOut: params.tokenOut,
        tokenOutChainId: swapChainId,
        includeGasInfo: true,
      })
      setApprovalData(data)
      setStatus('Approval check complete')
    } catch (e: any) {
      setError(getErrorMessage(e, 'Approval check failed'))
    } finally {
      setBusy(null)
    }
  }, [
    params.executionAddress,
    params.tokenIn,
    params.tokenOut,
    params.amountInUnits,
    swapChainId,
    isReady,
    getTokenDecimals,
    getErrorMessage,
    guardInputPolicy,
  ])

  const handleBuildSwap = useCallback(async () => {
    if (!quote) return
    setBusy('buildSwap')
    setError('')
    setStatus('')
    try {
      const selectedQuote = pickSwapQuote(quote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const permitPayload = await signPermitIfRequired(quote)
      const data = await buildSwap({
        quote: selectedQuote,
        ...permitPayload,
        includeGasInfo: false,
        refreshGasPrice: true,
        simulateTransaction: true,
        deadline: Math.floor(Date.now() / 1000) + params.parsedDeadlineMinutes * 60,
      })
      assertValidSwapTransaction(data.swap)
      setSwapTx(data.swap)
      setStatus('Swap transaction built')
    } catch (e: any) {
      setError(getErrorMessage(e, 'Swap build failed'))
    } finally {
      setBusy(null)
    }
  }, [quote, params.parsedDeadlineMinutes, getErrorMessage, signPermitIfRequired])

  const handleReviewTrade = useCallback(async () => {
    if (!params.executionAddress || !params.executionReady || !isReady) return
    const runId = ++quoteRunRef.current
    setBusy('review')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(params.tokenIn)
      const tokenOutDecimals = await getTokenDecimals(params.tokenOut)
      if (runId !== quoteRunRef.current) return
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return

      const approvalPromise =
        params.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
          ? Promise.resolve({ approval: null, cancel: null } as any)
          : checkTradeApproval({
              walletAddress: params.executionAddress,
              token: params.tokenIn,
              amount,
              chainId: swapChainId,
              tokenOut: params.tokenOut,
              tokenOutChainId: swapChainId,
              includeGasInfo: true,
            })

      const [nextQuote, nextApproval] = await Promise.all([
        fetchTradeQuote({
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          tokenInChainId: swapChainId,
          tokenOutChainId: swapChainId,
          type: 'EXACT_INPUT',
          amount,
          swapper: params.executionAddress,
          slippageTolerance: params.parsedSlippage,
          routingPreference: 'BEST_PRICE',
          permitAmount: 'EXACT',
          walletModeKey: params.executionMode,
        }),
        approvalPromise,
      ])
      if (runId !== quoteRunRef.current) return
      if (!guardRoutingPolicy(nextQuote.routing)) return
      setQuote(nextQuote)
      setQuoteUpdatedAt(Date.now())
      syncPermitRequirement(nextQuote)
      setApprovalData(nextApproval)

      const outRaw = getNestedAmountOut(pickQuote(nextQuote) ?? nextQuote)
      if (outRaw) setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      else setEstimatedOut('')

      if (isUniswapXRouting(nextQuote.routing)) {
        const orderQuote = pickOrderQuote(nextQuote)
        if (!orderQuote) throw new Error('Quote does not contain executable UniswapX order payload')
        const permitPayload = await signPermitIfRequired(nextQuote)
        if (runId !== quoteRunRef.current) return
        if (!permitPayload.signature) {
          throw new Error('UniswapX order requires a Permit2 signature. Please refresh and try again.')
        }

        setSwapTx(null)
        setOrderRequest({
          quote: orderQuote,
          signature: permitPayload.signature,
          routing: nextQuote.routing,
        })
        setOrderStatus(null)
        setStatus('Review ready')
        setTxState('review')
        setConfirmIntent('order')
        return
      }

      const selectedQuote = pickSwapQuote(nextQuote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const permitPayload = await signPermitIfRequired(nextQuote)
      if (runId !== quoteRunRef.current) return
      const built = await buildSwap({
        quote: selectedQuote,
        ...permitPayload,
        includeGasInfo: false,
        refreshGasPrice: true,
        simulateTransaction: true,
        deadline: Math.floor(Date.now() / 1000) + params.parsedDeadlineMinutes * 60,
      })
      if (runId !== quoteRunRef.current) return
      assertValidSwapTransaction(built.swap)
      setSwapTx(built.swap)
      setOrderRequest(null)
      setOrderStatus(null)
      setStatus('Review ready')
      setTxState('review')
      setConfirmIntent('swap')
    } catch (e: any) {
      if (runId !== quoteRunRef.current) return
      setError(getErrorMessage(e, 'Unable to prepare trade'))
    } finally {
      if (runId === quoteRunRef.current) setBusy(null)
    }
  }, [
    params.tokenIn,
    params.tokenOut,
    params.amountInUnits,
    params.parsedDeadlineMinutes,
    params.parsedSlippage,
    params.executionMode,
    swapChainId,
    isReady,
    getTokenDecimals,
    getErrorMessage,
    guardInputPolicy,
    guardRoutingPolicy,
    syncPermitRequirement,
    signPermitIfRequired,
    params.executionAddress,
    params.executionReady,
  ])

  const run7702DryRun = useCallback(
    async (options?: { silent?: boolean }): Promise<Swap7702Diagnostics | null> => {
      if (!quote || !params.executionAddress) {
        if (!options?.silent) {
          setDiagnosticsResult(null)
          setError('Diagnostics unavailable: quote and execution address are required.')
        }
        return null
      }
      const quotePayload = pickQuote(quote)
      if (!quotePayload) {
        if (!options?.silent) {
          setDiagnosticsResult(null)
          setError('Diagnostics unavailable: quote payload missing.')
        }
        return null
      }

      if (!options?.silent) setDiagnosticsBusy(true)
      const notes: string[] = []
      let delegationOk = false
      let swap5792Ok = false
      let swap7702Ok = false
      const deadline = Math.floor(Date.now() / 1000) + Math.max(60, params.parsedDeadlineMinutes * 60)
      const quoteShape = buildRoutingQuotePayload(quote.routing, quotePayload)

      try {
        await fetchDelegationStatus({
          chainIds: [Number(swapChainId)],
          walletAddresses: [params.executionAddress],
        } as any)
        delegationOk = true
      } catch (error) {
        notes.push(`delegation-check-failed:${getErrorMessage(error, 'delegation check failed')}`)
      }

      try {
        await buildSwap5792({
          ...quoteShape,
          deadline,
        })
        swap5792Ok = true
      } catch (error) {
        notes.push(`swap5792-failed:${getErrorMessage(error, 'swap5792 build failed')}`)
      }

      if (canary7702Eligible) {
        try {
          await buildSwap7702({
            ...quoteShape,
            smartContractDelegationAddress: CALIBUR_DELEGATION_ADDRESS,
          })
          swap7702Ok = true
        } catch (error) {
          notes.push(`swap7702-failed:${getErrorMessage(error, 'swap7702 build failed')}`)
        }
      } else {
        notes.push('swap7702-skipped:not-canary-eligible')
      }

      const result: Swap7702Diagnostics = {
        at: Date.now(),
        chainId: Number(swapChainId),
        canaryEligible: canary7702Eligible,
        routing: quote.routing ? String(quote.routing) : null,
        delegationOk,
        swap5792Ok,
        swap7702Ok,
        notes,
      }
      if (!options?.silent) {
        setDiagnosticsResult(result)
        setStatus('Internal diagnostics complete.')
        setDiagnosticsBusy(false)
      }
      console.info('[swap][7702] dry-run complete', {
        canaryEligible: canary7702Eligible,
        delegationOk,
        swap5792Ok,
        swap7702Ok,
        notes,
      })
      return result
    },
    [
      quote,
      params.executionAddress,
      params.parsedDeadlineMinutes,
      swapChainId,
      canary7702Eligible,
      getErrorMessage,
    ],
  )

  const executeViaCanonical4337 = useCallback(async (executeParams: {
    calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }>
    successLabel: string
  }) => {
    if (!params.canonicalAddress || !params.signerAddress || !params.walletClient || !params.publicClient) {
      throw new Error('Canonical smart wallet or owner signer is not ready')
    }
    const isSelfConnect = params.canonicalAddress.toLowerCase() === params.signerAddress.toLowerCase()
    if (isSelfConnect) {
      const wallet = params.walletClient as any
      const executeBatchData = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI,
        functionName: 'executeBatch',
        args: [
          executeParams.calls.map((call) => ({
            target: call.to,
            value: call.value ?? 0n,
            data: call.data ?? '0x',
          })),
        ],
      })

      const txHashRaw =
        typeof wallet?.sendTransaction === 'function'
          ? await wallet.sendTransaction({
              account: params.signerAddress,
              to: params.canonicalAddress,
              value: 0n,
              data: executeBatchData,
            })
          : await wallet.request({
              method: 'eth_sendTransaction',
              params: [
                {
                  from: params.signerAddress,
                  to: params.canonicalAddress,
                  value: '0x0',
                  data: executeBatchData,
                },
              ],
            })

      const txHash = String(txHashRaw ?? '').trim()
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('Canonical self-connect execution returned an invalid transaction hash.')
      }
      setTxHash(txHash)
      setTxState('pending')
      setStatus(`${executeParams.successLabel} via connected CSW: ${txHash}`)
      return
    }

    const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
    const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
    try {
      const result = await sendCoinbaseSmartWalletUserOperation({
        publicClient: params.publicClient as any,
        walletClient: params.walletClient as any,
        bundlerUrl,
        smartWallet: params.canonicalAddress,
        ownerAddress: params.signerAddress,
        calls: executeParams.calls,
        version: '1',
      })
      setTxHash(result.transactionHash)
      setTxState('pending')
      setStatus(`${executeParams.successLabel}: ${result.transactionHash}`)
    } catch (error) {
      const reason = getErrorMessage(error, 'Canonical ERC-4337 execution failed')
      throw new Error(`Canonical ERC-4337 execution failed with connected owner wallet (${params.signerAddress}): ${reason}`)
    }
  }, [getErrorMessage, params.canonicalAddress, params.signerAddress, params.walletClient, params.publicClient])

  const executeViaEoa = useCallback(async (executeParams: {
    tx: TransactionRequest
    successLabel: string
  }) => {
    if (!params.signerAddress || !params.walletClient) {
      throw new Error('Connected EOA signer is not ready')
    }
    const wallet = params.walletClient as any
    if (typeof wallet.sendTransaction !== 'function') {
      throw new Error('Connected wallet does not support direct transaction sends')
    }

    const hash = await wallet.sendTransaction({
      account: params.signerAddress,
      to: executeParams.tx.to as `0x${string}`,
      data: executeParams.tx.data as `0x${string}`,
      value: asOptionalBigInt(executeParams.tx.value),
      gas: asOptionalBigInt(executeParams.tx.gasLimit),
      gasPrice: asOptionalBigInt(executeParams.tx.gasPrice),
      maxFeePerGas: asOptionalBigInt(executeParams.tx.maxFeePerGas),
      maxPriorityFeePerGas: asOptionalBigInt(executeParams.tx.maxPriorityFeePerGas),
    })

    setTxHash(hash)
    setTxState('pending')
    setStatus(`${executeParams.successLabel}: ${hash}`)
  }, [params.signerAddress, params.walletClient])

  const executeApprovalNow = useCallback(async () => {
    if (!approvalData) return
    const tx = approvalData.approval as Record<string, unknown> | undefined
    if (!tx?.to || !tx?.data) {
      setStatus('No approval transaction required')
      return
    }
    setBusy('executeApproval')
    setError('')
    try {
      if (params.executionMode === 'canonical') {
        await executeViaCanonical4337({
          calls: [
            {
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: asBigInt(tx.value),
            },
          ],
          successLabel: 'Approval submitted via canonical ERC-4337',
        })
      } else {
        await executeViaEoa({
          tx: {
            to: tx.to as string,
            from: (tx.from as string) ?? params.signerAddress ?? '',
            data: tx.data as string,
            value: typeof tx.value === 'string' && tx.value.trim() ? tx.value : '0',
            chainId: swapChainId,
            gasLimit: typeof tx.gasLimit === 'string' ? tx.gasLimit : undefined,
            maxFeePerGas: typeof tx.maxFeePerGas === 'string' ? tx.maxFeePerGas : undefined,
            maxPriorityFeePerGas:
              typeof tx.maxPriorityFeePerGas === 'string' ? tx.maxPriorityFeePerGas : undefined,
            gasPrice: typeof tx.gasPrice === 'string' ? tx.gasPrice : undefined,
          },
          successLabel: 'Approval submitted via connected EOA',
        })
      }
      setTxState('success')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Approval transaction failed')
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [approvalData, executeViaCanonical4337, executeViaEoa, getErrorMessage, params.executionMode, params.signerAddress, swapChainId])

  const executeSwapNow = useCallback(async () => {
    if (!swapTx) return
    assertValidSwapTransaction(swapTx)
    setBusy('executeSwap')
    setError('')
    try {
      // Canary users get a best-effort 7702 preflight; send path still falls
      // back to canonical ERC-4337 on any issue.
      if (params.executionMode === 'canonical' && canary7702Eligible) {
        await run7702DryRun({ silent: true }).catch(() => null)
      }
      if (params.executionMode === 'canonical') {
        await executeViaCanonical4337({
          calls: [
            {
              to: swapTx.to as `0x${string}`,
              data: swapTx.data as `0x${string}`,
              value: asBigInt(swapTx.value),
            },
          ],
          successLabel: 'Swap submitted via canonical ERC-4337',
        })
      } else {
        await executeViaEoa({
          tx: swapTx,
          successLabel: 'Swap submitted via connected EOA',
        })
      }
      setTxState('success')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Swap transaction failed')
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [swapTx, executeViaCanonical4337, executeViaEoa, getErrorMessage, params.executionMode, canary7702Eligible, run7702DryRun])

  const executeOrderNow = useCallback(async () => {
    if (!orderRequest) return
    if (!orderRequest.signature || !orderRequest.signature.startsWith('0x')) {
      throw new Error('Order is missing a valid Permit2 signature. Please refresh the quote and try again.')
    }
    setBusy('executeOrder')
    setError('')
    try {
      setTxHash(null)
      setTxState('pending')
      setStatus('Submitting UniswapX order…')
      const result = await createOrder({
        quote: orderRequest.quote,
        signature: orderRequest.signature,
        routing: orderRequest.routing,
      })
      const orderId = typeof (result as any).orderId === 'string' ? String((result as any).orderId) : ''
      const orderStatusValue =
        typeof (result as any).orderStatus === 'string' ? String((result as any).orderStatus) : ''

      setOrderStatus(orderId ? { orderId, orderStatus: orderStatusValue || 'OPEN' } : null)
      setTxState('success')
      setStatus(orderId ? `Order submitted (id=${orderId})` : 'Order submitted')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Order submission failed')
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [getErrorMessage, orderRequest])

  const openConfirm = useCallback((intent: 'approval' | 'swap' | 'order') => {
    setConfirmIntent(intent)
  }, [])

  const closeConfirm = useCallback(() => {
    if (busy) return
    setConfirmIntent(null)
  }, [busy])

  const confirmAndExecute = useCallback(async () => {
    if (!confirmIntent || busy) return
    const action = confirmIntent
    if ((action === 'swap' || action === 'order') && quoteIsStale) {
      setConfirmIntent(null)
      setError('')
      setStatus('Quote expired. Refreshing quote and rebuilding review…')
      setTxState('review')
      await handleReviewTrade()
      return
    }
    setConfirmIntent(null)
    try {
      setTxState('signing')
      if (action === 'approval') await executeApprovalNow()
      if (action === 'swap') {
        if (approvalRequired) await executeApprovalNow()
        await executeSwapNow()
      }
      if (action === 'order') {
        if (approvalRequired) await executeApprovalNow()
        await executeOrderNow()
      }
    } catch {
      // Errors are already surfaced in state.
    }
  }, [
    approvalRequired,
    busy,
    confirmIntent,
    executeApprovalNow,
    executeOrderNow,
    executeSwapNow,
    handleReviewTrade,
    quoteIsStale,
  ])

  return {
    estimatedOut,
    quote,
    approvalData,
    swapTx,
    busy,
    status,
    error,
    confirmIntent,
    quoteUpdatedAt,
    txState,
    txHash,
    isReady,
    approvalRequired,
    tokensEquivalent,
    quoteIsStale,
    permitSignatureRequired,
    permitSignaturePending,
    permitSignatureReady,
    diagnosticsEnabled,
    canary7702Eligible,
    diagnosticsBusy,
    diagnosticsResult,
    setStatus,
    setError,
    setTxState,
    handleQuote,
    handleCheckApproval,
    handleBuildSwap,
    handleReviewTrade,
    openConfirm,
    closeConfirm,
    confirmAndExecute,
    run7702DryRun,
    resetTradeState,
  }
}
