import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, Clock3, Droplets, Settings, Sparkles } from 'lucide-react'
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { TransactionLifecycle, type TxLifecycleState } from '@/components/trade/TransactionLifecycle'
import { CONTRACTS } from '@/config/contracts'
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet'
import { useSwapExecution } from '@/hooks/useSwapExecution'
import { useSwapState } from '@/hooks/useSwapState'
import { useTokenIdentity } from '@/hooks/useTokenIdentity'
import { detectUniswapWalletCapabilities } from '@/lib/uniswap/capabilities'
import {
  claimLiquidityFees,
  createPosition,
  fetchLiquidityPositions,
  quoteCreatePosition,
  removeLiquidity,
} from '@/lib/uniswap/liquidityApi'
import { pickSwapQuote } from '@/lib/uniswap/tradingApi'
import {
  assertValidSwapTransaction,
  buildSwap,
  checkTradeApproval,
  fetchTradeQuote,
  pickSwapQuote,
  type TradeQuoteResponse,
  type TransactionRequest,
} from '@/lib/uniswap/tradingApi'
import { claimLiquidityFees, createPosition, fetchLiquidityPositions, quoteCreatePosition, removeLiquidity } from '@/lib/uniswap/liquidityApi'
import { detectUniswapWalletCapabilities } from '@/lib/uniswap/capabilities'

const BASE_CHAIN_ID = 8453
const QUOTE_TTL_MS = 30_000
const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type WaitlistMeData = {
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  connectedAccounts?: Array<{
    address?: string | null
    walletType?: string | null
    provider?: string | null
    verifiedAt?: string | null
    isCanonicalSmartWallet?: boolean
  }>
}

type TokenOption = { symbol: string; address: string; group: 'core' | 'creator' | 'share' }

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', address: CONTRACTS.weth, group: 'core' },
  { symbol: 'USDC', address: CONTRACTS.usdc, group: 'core' },
  { symbol: 'BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', group: 'core' }, // cbBTC (Base)
  { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', group: 'core' },
  { symbol: 'ZORA', address: CONTRACTS.zora, group: 'core' },
]

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

// ─── Liquidity position card ────────────────────────────────────────────────

type LpPosition = {
  id?: string
  tokenId?: string
  token0Symbol?: string
  token1Symbol?: string
  feeTier?: number | string
  tickLower?: number | string
  tickUpper?: number | string
  tokensOwed0?: string
  tokensOwed1?: string
  liquidity?: string
}

function LpPositionCard(props: {
  position: LpPosition
  busy: string | null
  onClaim: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { position } = props
  const posId = String(position.id ?? position.tokenId ?? '')
  const pair = [position.token0Symbol, position.token1Symbol].filter(Boolean).join(' / ') || 'Unknown pair'
  const feeTier = position.feeTier ? `${(Number(position.feeTier) / 10000).toFixed(2)}%` : '--'
  const range =
    position.tickLower !== undefined && position.tickUpper !== undefined
      ? `${position.tickLower} → ${position.tickUpper}`
      : '--'
  const fees = [position.tokensOwed0, position.tokensOwed1].filter(Boolean).join(' / ') || '--'

  return (
    <div className="rounded-2xl border border-white/8 bg-vault-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{pair}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-500">
              Fee {feeTier}
            </span>
            <span className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-500">
              Range {range}
            </span>
          </div>
        </div>
        {posId && (
          <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 font-mono text-[10px] text-zinc-600 shrink-0">
            #{posId.slice(-6)}
          </span>
        )}
      </div>
      <div className="mt-2 text-[11px] text-zinc-500">
        Unclaimed fees: <span className="text-zinc-400">{fees}</span>
      </div>
      {posId && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => props.onClaim(posId)}
            disabled={props.busy !== null}
            className="flex-1 rounded-xl border border-emerald-400/25 bg-emerald-500/8 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            Claim fees
          </button>
          <button
            type="button"
            onClick={() => props.onRemove(posId)}
            disabled={props.busy !== null}
            className="flex-1 rounded-xl border border-rose-400/25 bg-rose-500/8 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export function Swap() {
  const [searchParams] = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [tokenIn, setTokenIn] = useState<string>(CONTRACTS.weth)
  const [tokenOut, setTokenOut] = useState<string>(CONTRACTS.usdc)
  const [amountInUnits, setAmountInUnits] = useState<string>('1')
  const [slippagePct, setSlippagePct] = useState<string>('0.5')
  const [estimatedOut, setEstimatedOut] = useState<string>('')
  const [quote, setQuote] = useState<TradeQuoteResponse | null>(null)
  const [approvalData, setApprovalData] = useState<Record<string, unknown> | null>(null)
  const [swapTx, setSwapTx] = useState<TransactionRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [confirmIntent, setConfirmIntent] = useState<'approval' | 'swap' | null>(null)
  const [activePanel, setActivePanel] = useState<'swap' | 'liquidity'>('swap')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null)
  const [deadlineMinutes, setDeadlineMinutes] = useState<string>('15')
  const [txState, setTxState] = useState<TxLifecycleState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [walletCapabilities, setWalletCapabilities] = useState<{ supports5792: boolean; supports7702: boolean }>({
    supports5792: false,
    supports7702: false,
  })
  const [lpMode, setLpMode] = useState<'simple' | 'advanced'>('simple')
  const [lpFeeTier, setLpFeeTier] = useState<string>('3000')
  const [lpAmountA, setLpAmountA] = useState<string>('1')
  const [lpAmountB, setLpAmountB] = useState<string>('1')
  const [lpLowerTick, setLpLowerTick] = useState<string>('')
  const [lpUpperTick, setLpUpperTick] = useState<string>('')
  const [lpPositionId, setLpPositionId] = useState<string>('')
  const [lpStatus, setLpStatus] = useState<string>('')
  const [lpError, setLpError] = useState<string>('')

  const [walletCapabilities, setWalletCapabilities] = useState<{
    supports5792: boolean
    supports7702: boolean
  }>({ supports5792: false, supports7702: false })

  // ─── LP state ─────────────────────────────────────────────────────────────
  const [lpBusy, setLpBusy] = useState<string | null>(null)
  const [lpMode, setLpMode] = useState<'simple' | 'advanced'>('simple')
  const [lpFeeTier, setLpFeeTier] = useState<string>('3000')
  const [lpAmountA, setLpAmountA] = useState<string>('1')
  const [lpAmountB, setLpAmountB] = useState<string>('1')
  const [lpLowerTick, setLpLowerTick] = useState<string>('')
  const [lpUpperTick, setLpUpperTick] = useState<string>('')
  const [lpPositionId, setLpPositionId] = useState<string>('')
  const [lpStatus, setLpStatus] = useState<string>('')
  const [lpError, setLpError] = useState<string>('')

  // ─── URL params ───────────────────────────────────────────────────────────
  useEffect(() => {
    const qToken = (searchParams.get('token') ?? '').trim()
    if (isAddress(qToken)) setTokenOut(getAddress(qToken))
  }, [searchParams, setTokenOut])

  // ─── Canonical wallet ─────────────────────────────────────────────────────
  const {
    canonicalAddress,
    signerAddress,
    identityReady,
  } = useCanonicalWallet({
    address,
    publicClient,
    walletReady: Boolean(walletClient),
  })

  // Whether the system has a canonical CSW address on file for this user.
  // When false (null DB row), "Smart Wallet" mode is unavailable AND linking
  // requires account registration — not just the ownership check failure.
  const canonicalConfigured = canonicalAddress !== null

  const canonicalReady = identityReady
  const eoaReady = Boolean(signerAddress && walletClient && publicClient)

  const [preferredExecutionMode, setPreferredExecutionMode] = useState<WalletMode>(() =>
    readPreferredWalletMode(),
  )

  const executionMode = useMemo<WalletMode>(
    () =>
      getDefaultWalletMode({
        preferredMode: preferredExecutionMode,
        canonicalReady,
        eoaReady,
      }),
    [preferredExecutionMode, canonicalReady, eoaReady],
  )

  const tokenOptions = useMemo<TokenOption[]>(() => {
    const creatorCoin = (searchParams.get('token') ?? '').trim()
    const shareCoin = (searchParams.get('share') ?? searchParams.get('shareToken') ?? '').trim()
    const base = [...CORE_TOKENS]

    if (isAddress(creatorCoin)) {
      base.push({ symbol: 'Creator Coin', address: getAddress(creatorCoin), group: 'creator' })
    }
    if (isAddress(shareCoin)) {
      base.push({ symbol: 'Share Token', address: getAddress(shareCoin), group: 'share' })
    }

    const seen = new Set<string>()
    return base.filter((token) => {
      const lc = token.address.toLowerCase()
      if (seen.has(lc)) return false
      seen.add(lc)
      return true
    })
  }, [searchParams])

  const tokenInSymbol = useMemo(() => {
    const match = tokenOptions.find((opt) => opt.address.toLowerCase() === tokenIn.toLowerCase())
    return match?.symbol ?? shortAddress(tokenIn)
  }, [tokenIn, tokenOptions])

  const tokenOutSymbol = useMemo(() => {
    const match = tokenOptions.find((opt) => opt.address.toLowerCase() === tokenOut.toLowerCase())
    return match?.symbol ?? shortAddress(tokenOut)
  }, [tokenOut, tokenOptions])

  const signerAddress = connectedAddressLc ? (connectedAddressLc as `0x${string}`) : null
  const canonicalAddress = canonicalSmartWalletAddress ? (canonicalSmartWalletAddress as `0x${string}`) : null
  const canOperateCanonical = connectedOwnerQuery.data === true
  const identityReady = Boolean(canonicalAddress && signerAddress && walletClient && publicClient && canOperateCanonical)
  const isReady = isAddress(tokenIn) && isAddress(tokenOut) && tokenIn.toLowerCase() !== tokenOut.toLowerCase() && Number(amountInUnits) > 0 && Boolean(canonicalAddress)
  const approvalTx = approvalData?.approval as Record<string, unknown> | undefined
  const approvalRequired = Boolean(approvalTx?.to && approvalTx?.data)
  const quoteIsStale = quoteUpdatedAt ? Date.now() - quoteUpdatedAt > QUOTE_TTL_MS : true
  const parsedDeadlineMinutes = useMemo(() => {
    const n = Number(deadlineMinutes)
    if (!Number.isFinite(n) || n <= 0) return 15
    return Math.min(30, n)
  }, [deadlineMinutes])

  const getTokenDecimals = useCallback(async (token: string): Promise<number> => {
    if (!publicClient || !isAddress(token)) return 18
    try {
      const decimals = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      return Number(decimals)
    } catch {
      return 18
    }
  }, [publicClient])

  const handleQuote = useCallback(async () => {
    if (!address || !isReady) return
    setBusy('quote')
    setError('')
    setStatus('')
    try {
      const tokenInDecimals = await getTokenDecimals(tokenIn)
      const amount = parseUnits(amountInUnits, tokenInDecimals).toString()
      const data = await fetchTradeQuote({
        tokenIn,
        tokenOut,
        tokenInChainId: BASE_CHAIN_ID,
        tokenOutChainId: BASE_CHAIN_ID,
        type: 'EXACT_INPUT',
        amount,
        swapper: canonicalAddress!,
        slippageTolerance: parsedSlippage,
      })
      setQuote(data)
      setQuoteUpdatedAt(Date.now())
      setApprovalData(null)
      setSwapTx(null)
      const outRaw = getNestedAmountOut(pickSwapQuote(data) ?? data)
      if (outRaw) {
        const tokenOutDecimals = await getTokenDecimals(tokenOut)
        setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      } else {
        setEstimatedOut('')
      }
      setStatus(`Quote ready for canonical CSW (routing=${String(data.routing ?? 'unknown')})`)
      setTxState('review')
    } catch (e: any) {
      setEstimatedOut('')
      setError(e?.message || 'Quote failed')
    } finally {
      setBusy(null)
    }
  }, [address, canonicalAddress, isReady, parsedSlippage, tokenIn, tokenOut, amountInUnits, getTokenDecimals])

  useEffect(() => {
    writePreferredWalletMode(preferredExecutionMode)
  }, [preferredExecutionMode])

  async function handleBuildSwap() {
    if (!quote) return
    setBusy('buildSwap')
    setError('')
    setStatus('')
    try {
      const selectedQuote = pickSwapQuote(quote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const data = await buildSwap({
        quote: selectedQuote,
        refreshGasPrice: true,
        simulateTransaction: true,
        deadline: Math.floor(Date.now() / 1000) + parsedDeadlineMinutes * 60,
      })
      assertValidSwapTransaction(data.swap)
      setSwapTx(data.swap)
      setStatus('Swap transaction built')
    } catch (e: any) {
      setError(e?.message || 'Swap build failed')
    } finally {
      setBusy(null)
    }
  }

  function handleSwitchTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setQuote(null)
    setApprovalData(null)
    setSwapTx(null)
    setEstimatedOut('')
    setQuoteUpdatedAt(null)
    setStatus('')
    setError('')
  }

  async function handleReviewTrade() {
    if (!canonicalAddress || !identityReady || !isReady) return
    setBusy('review')
    setError('')
    setStatus('')
    try {
      const tokenInDecimals = await getTokenDecimals(tokenIn)
      const tokenOutDecimals = await getTokenDecimals(tokenOut)
      const amount = parseUnits(amountInUnits, tokenInDecimals).toString()

      const [nextQuote, nextApproval] = await Promise.all([
        fetchTradeQuote({
          tokenIn,
          tokenOut,
          tokenInChainId: BASE_CHAIN_ID,
          tokenOutChainId: BASE_CHAIN_ID,
          type: 'EXACT_INPUT',
          amount,
          swapper: canonicalAddress,
          slippageTolerance: parsedSlippage,
        }),
        checkTradeApproval({
          walletAddress: canonicalAddress,
          token: tokenIn,
          amount,
          chainId: BASE_CHAIN_ID,
          tokenOut,
          tokenOutChainId: BASE_CHAIN_ID,
          includeGasInfo: true,
        }),
      ])
      setQuote(nextQuote)
      setQuoteUpdatedAt(Date.now())
      setApprovalData(nextApproval)

  const selectedQuote = useMemo<QuoteShape | null>(() => {
    if (!quote) return null
    const candidate = pickSwapQuote(quote) ?? quote
    return candidate as QuoteShape
  }, [quote])

  const routeSummary = useMemo(() => {
    const routeCandidate =
      selectedQuote?.route ?? selectedQuote?.routeString ?? selectedQuote?.routing ?? quote?.routing
    if (routeCandidate === null || routeCandidate === undefined) return null
    const text = String(routeCandidate).trim()
    return text || null
  }, [selectedQuote, quote])

  const priceImpactLabel = useMemo(() => {
    const priceImpactCandidate =
      selectedQuote?.priceImpact ??
      selectedQuote?.priceImpactPercent ??
      quote?.priceImpact ??
      quote?.priceImpactPercent
    return formatPercent(priceImpactCandidate)
  }, [selectedQuote, quote])

  const gasEstimateLabel = useMemo(() => {
    const gasCandidate =
      selectedQuote?.gasFeeUSD ??
      selectedQuote?.gasEstimateUSD ??
      quote?.gasFeeUSD ??
      quote?.gasEstimateUSD
    if (typeof gasCandidate === 'string' && gasCandidate.trim()) return gasCandidate
    const numeric = typeof gasCandidate === 'number' ? gasCandidate : Number(gasCandidate)
    if (!Number.isFinite(numeric)) return null
    return `$${numeric.toFixed(2)}`
  }, [selectedQuote, quote])

  const handleSwitchTokens = useCallback(() => {
    switchTokens()
    resetTradeState()
  }, [switchTokens, resetTradeState])

  const handleSetExecutionMode = useCallback((nextMode: WalletMode) => {
    setPreferredExecutionMode(nextMode)
  }, [])

  const handleEnableCanonical = useCallback(() => {
    window.location.assign('/account')
  }, [])

  // Reset when execution address changes
  useEffect(() => {
    resetTradeState()
  }, [executionAddress, resetTradeState])

      const selectedQuote = pickSwapQuote(nextQuote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const built = await buildSwap({
        quote: selectedQuote,
        refreshGasPrice: true,
        simulateTransaction: true,
        deadline: Math.floor(Date.now() / 1000) + parsedDeadlineMinutes * 60,
      })
      assertValidSwapTransaction(built.swap)
      setSwapTx(built.swap)
      setStatus('Review ready')
      setTxState('review')
      setConfirmIntent('swap')
    } catch (e: any) {
      setError(e?.message || 'Unable to prepare trade')
    } finally {
      setBusy(null)
    }
  }

  // Debounced auto-quote: only fires when actual swap inputs change.
  useEffect(() => {
    if (!executionReady || !isReady) return
    const timer = window.setTimeout(() => {
      if (busyRef.current) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
    // `busy` intentionally omitted — use busyRef to check at call-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenOut, amountInUnits, parsedSlippage, executionReady, isReady, handleQuote])

  // Wallet capabilities
  useEffect(() => {
    let cancelled = false
    void detectUniswapWalletCapabilities(walletClient).then((caps) => {
      if (!cancelled) setWalletCapabilities(caps)
    })
    setTxHash(result.transactionHash)
    setTxState('pending')
    setStatus(`${params.successLabel}: ${result.transactionHash}`)
  }

  // ─── LP handlers ──────────────────────────────────────────────────────────
  async function handleLpQuote() {
    if (!canonicalAddress) return
    setLpBusy('lpQuote'); setLpError(''); setLpStatus('')
    try {
      await quoteCreatePosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: tokenIn, token1: tokenOut,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setTxState('success')
    } catch (e: any) {
      const message = e?.message || 'Approval transaction failed'
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }

  async function handleCreatePosition() {
    if (!canonicalAddress) return
    setLpBusy('lpCreate'); setLpError(''); setLpStatus('')
    try {
      const data = await createPosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: tokenIn, token1: tokenOut,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setTxState('success')
    } catch (e: any) {
      const message = e?.message || 'Swap transaction failed'
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }

  async function handleClaimFees(posId?: string) {
    const id = posId ?? lpPositionId.trim()
    if (!canonicalAddress || !id) return
    setLpBusy('lpClaim'); setLpError('')
    try {
      await claimLiquidityFees({ chainId: BASE_CHAIN_ID, walletAddress: canonicalAddress, positionId: id })
      setLpStatus('Fee claim submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to claim fees')
    } finally { setLpBusy(null) }
  }

  async function handleRemoveLiquidity(posId?: string) {
    const id = posId ?? lpPositionId.trim()
    if (!canonicalAddress || !id) return
    setLpBusy('lpRemove'); setLpError('')
    try {
      await removeLiquidity({ chainId: BASE_CHAIN_ID, walletAddress: canonicalAddress, positionId: id })
      setLpStatus('Remove liquidity submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to remove liquidity')
    } finally { setLpBusy(null) }
  }

  useEffect(() => {
    if (!identityReady || !isReady) return
    const timer = window.setTimeout(() => {
      if (busy) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
  }, [tokenIn, tokenOut, amountInUnits, parsedSlippage, identityReady, isReady, busy, handleQuote])

  useEffect(() => {
    let cancelled = false
    void detectUniswapWalletCapabilities(walletClient).then((caps) => {
      if (!cancelled) setWalletCapabilities(caps)
    })
    return () => {
      cancelled = true
    }
  }, [walletClient])

  async function confirmAndExecute() {
    if (!confirmIntent || busy) return
    if (quoteIsStale) {
      setError('Quote is stale. Please refresh quote before submitting.')
      setTxState('error')
      return
    }
    const action = confirmIntent
    setConfirmIntent(null)
    try {
      setTxState('signing')
      if (action === 'approval') await executeApprovalNow()
      if (action === 'swap') {
        if (approvalRequired) await executeApprovalNow()
        await executeSwapNow()
      }
    } catch {
      // Errors are already surfaced via `setError`.
    }
    if (Array.isArray(data)) return data as LpPosition[]
    return []
  }, [lpPositionsQuery.data])


  async function handleLpQuote() {
    if (!canonicalAddress) return
    setBusy('lpQuote')
    setLpError('')
    setLpStatus('')
    try {
      await quoteCreatePosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: tokenIn,
        token1: tokenOut,
        amount0: lpAmountA,
        amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus('Liquidity quote ready')
    } catch (e: any) {
      setLpError(e?.message || 'Unable to quote liquidity')
    } finally {
      setBusy(null)
    }
  }

  async function handleCreatePosition() {
    if (!canonicalAddress) return
    setBusy('lpCreate')
    setLpError('')
    setLpStatus('')
    try {
      const data = await createPosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: tokenIn,
        token1: tokenOut,
        amount0: lpAmountA,
        amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus(`Position submitted${(data as any)?.requestId ? ` (#${(data as any).requestId})` : ''}`)
    } catch (e: any) {
      setLpError(e?.message || 'Unable to create position')
    } finally {
      setBusy(null)
    }
  }

  async function handleClaimFees() {
    if (!canonicalAddress || !lpPositionId.trim()) return
    setBusy('lpClaim')
    setLpError('')
    try {
      await claimLiquidityFees({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        positionId: lpPositionId.trim(),
      })
      setLpStatus('Fee claim submitted')
    } catch (e: any) {
      setLpError(e?.message || 'Unable to claim fees')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemoveLiquidity() {
    if (!canonicalAddress || !lpPositionId.trim()) return
    setBusy('lpRemove')
    setLpError('')
    try {
      await removeLiquidity({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        positionId: lpPositionId.trim(),
      })
      setLpStatus('Remove liquidity submitted')
    } catch (e: any) {
      setLpError(e?.message || 'Unable to remove liquidity')
    } finally {
      setBusy(null)
    }
  }

  const lpPositionsQuery = useQuery({
    queryKey: ['uniswap', 'lp-positions', canonicalAddress],
    enabled: Boolean(activePanel === 'liquidity' && canonicalAddress),
    queryFn: async () => fetchLiquidityPositions(canonicalAddress!, BASE_CHAIN_ID),
    refetchInterval: activePanel === 'liquidity' ? () => (typeof document !== 'undefined' && document.hidden ? false : 20_000) : false,
    staleTime: 10_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 1_000 * 2 ** attempt),
    refetchOnWindowFocus: false,
  })

  return (
    <div className="relative pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            <div className="rounded-[28px] border border-white/10 bg-black/45 p-6 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Uniswap routing</div>
                  <div className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-xs">
                    <button type="button" onClick={() => setActivePanel('swap')} className={`rounded-full px-3 py-1 ${activePanel === 'swap' ? 'bg-white/15 text-white' : 'text-zinc-400'}`}>Swap</button>
                    <button type="button" onClick={() => setActivePanel('liquidity')} className={`rounded-full px-3 py-1 ${activePanel === 'liquidity' ? 'bg-white/15 text-white' : 'text-zinc-400'}`}>Liquidity</button>
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold text-white">{activePanel === 'swap' ? 'Trade' : 'Provide Liquidity'}</h1>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                    <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" /> Smart routed
                    {quoteUpdatedAt ? (
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Updated {new Date(quoteUpdatedAt).toLocaleTimeString()}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="rounded-full border border-white/15 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  title="Trade settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {activePanel === 'swap' ? (
                <>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4"> 
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sell</div>
                    <div className="flex items-end justify-between gap-3">
                      <input className="w-full bg-transparent text-4xl leading-none font-medium text-white outline-none" value={amountInUnits} onChange={(e) => setAmountInUnits(e.target.value)} placeholder="0.0" />
                      <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white">
                        <optgroup label="Core tokens">{tokenOptions.filter((opt) => opt.group === 'core').map((opt) => <option key={opt.address} value={opt.address}>{opt.symbol}</option>)}</optgroup>
                        <optgroup label="Creator ecosystem">{tokenOptions.filter((opt) => opt.group !== 'core').map((opt) => <option key={opt.address} value={opt.address}>{opt.symbol}</option>)}</optgroup>
                      </select>
                    </div>
                    <div className="text-xs text-zinc-500 break-all">{tokenIn}</div>
                  </div>

                  <div className="relative z-10 -my-3 flex justify-center">
                    <button type="button" onClick={handleSwitchTokens} className="rounded-xl border border-white/20 bg-[#15161b] p-2 text-zinc-300 transition hover:text-white" title="Switch tokens"><ArrowDown className="h-4 w-4" /></button>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Buy</div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="w-full text-4xl leading-none font-medium text-white">{estimatedOut ? formatDisplayAmount(estimatedOut) : '0.0'}</div>
                      <select value={tokenOut} onChange={(e) => setTokenOut(e.target.value)} className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white">
                        <optgroup label="Core tokens">{tokenOptions.filter((opt) => opt.group === 'core').map((opt) => <option key={opt.address} value={opt.address}>{opt.symbol}</option>)}</optgroup>
                        <optgroup label="Creator ecosystem">{tokenOptions.filter((opt) => opt.group !== 'core').map((opt) => <option key={opt.address} value={opt.address}>{opt.symbol}</option>)}</optgroup>
                      </select>
                    </div>
                    <div className="text-xs text-zinc-500 break-all">{tokenOut}</div>
                  </div>

                  <button type="button" onClick={handleReviewTrade} disabled={!isConnected || !identityReady || !isReady || busy !== null || quoteIsStale} className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-lg font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50">{busy === 'review' ? 'Reviewing…' : 'Review trade'}</button>
                  {tokenIn.toLowerCase() === tokenOut.toLowerCase() ? <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Choose two different tokens to generate a quote.</div> : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Pair: {tokenInSymbol} / {tokenOutSymbol}</div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">Slippage {parsedSlippage}%</div>
                  </div>
                  {status ? <div className="mt-2 text-xs text-emerald-300">{status}</div> : null}
                  {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
                  {!isConnected ? <div className="mt-3"><ConnectButtonWeb3 /></div> : null}
                  {isConnected && !identityReady ? <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Connect an owner signer for your canonical smart wallet to trade.</div> : null}

                  {showAdvanced ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div>
                        <label className="label">Slippage %</label>
                        <input className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-xs" value={slippagePct} onChange={(e) => setSlippagePct(e.target.value)} placeholder="0.5" />
                      </div>
                      <div>
                        <label className="label">Deadline (minutes)</label>
                        <input className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-xs" value={deadlineMinutes} onChange={(e) => setDeadlineMinutes(e.target.value)} placeholder="15" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={handleQuote} disabled={busy !== null || !identityReady} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Quote</button>
                        <button type="button" onClick={handleCheckApproval} disabled={busy !== null || !identityReady} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Approval</button>
                        <button type="button" onClick={handleBuildSwap} disabled={busy !== null || !quote} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Build</button>
                        <button type="button" onClick={() => openConfirm('approval')} disabled={busy !== null || !approvalRequired} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Approve now</button>
                        <button type="button" onClick={() => openConfirm('swap')} disabled={busy !== null || !swapTx} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Swap now</button>
                      </div>
                    </div>
                  ) : null}
                  {quoteIsStale ? <button type="button" onClick={() => { void handleQuote() }} disabled={busy !== null || !identityReady} className="mt-2 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200 disabled:opacity-50">Refresh quote</button> : null}
                  <TransactionLifecycle state={txState} message={status || error || (quoteIsStale ? 'Quote needs refresh' : undefined)} txHash={txHash} />
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">LP mode</div>
                      <button type="button" onClick={() => setLpMode((v) => v === 'simple' ? 'advanced' : 'simple')} className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-300">{lpMode === 'simple' ? 'Simple' : 'Advanced'}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm" value={lpAmountA} onChange={(e) => setLpAmountA(e.target.value)} placeholder={`Amount ${tokenInSymbol}`} />
                      <input className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm" value={lpAmountB} onChange={(e) => setLpAmountB(e.target.value)} placeholder={`Amount ${tokenOutSymbol}`} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select value={lpFeeTier} onChange={(e) => setLpFeeTier(e.target.value)} className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white"><option value="500">0.05%</option><option value="3000">0.30%</option><option value="10000">1.00%</option></select>
                      <input className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm" value={lpPositionId} onChange={(e) => setLpPositionId(e.target.value)} placeholder="Position ID (for claim/remove)" />
                    </div>
                    {lpMode === 'advanced' ? <div className="mt-2 grid grid-cols-2 gap-2"><input className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm" value={lpLowerTick} onChange={(e) => setLpLowerTick(e.target.value)} placeholder="Lower tick" /><input className="rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-sm" value={lpUpperTick} onChange={(e) => setLpUpperTick(e.target.value)} placeholder="Upper tick" /></div> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={handleLpQuote} disabled={busy !== null || !identityReady} className="rounded-2xl border border-white/20 px-3 py-2 text-sm">Quote LP</button>
                    <button type="button" onClick={handleCreatePosition} disabled={busy !== null || !identityReady} className="rounded-2xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white">Add liquidity</button>
                    <button type="button" onClick={handleClaimFees} disabled={busy !== null || !identityReady || !lpPositionId.trim()} className="rounded-2xl border border-white/20 px-3 py-2 text-sm">Claim fees</button>
                    <button type="button" onClick={handleRemoveLiquidity} disabled={busy !== null || !identityReady || !lpPositionId.trim()} className="rounded-2xl border border-rose-400/40 px-3 py-2 text-sm text-rose-200">Remove</button>
                  </div>
                  {lpStatus ? <div className="text-xs text-emerald-300">{lpStatus}</div> : null}
                  {lpError ? <div className="text-xs text-rose-300">{lpError}</div> : null}

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500"><Droplets className="h-3.5 w-3.5" />Your positions</div>
                    <pre className="max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-zinc-300">{lpPositionsQuery.isLoading ? 'Loading positions…' : JSON.stringify(lpPositionsQuery.data ?? { positions: [] }, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="space-y-3"
          >
            <div className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Supported assets</h2>
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">ETH · USDC · BTC · USDT · ZORA</div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Creator coins + share tokens (when opened from a creator page)</div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-5 text-sm text-zinc-300 backdrop-blur-xl">
              Powered by Uniswap APIs on Base with mobile-first swap + LP flows, including graceful fallbacks when advanced wallet capabilities are unavailable.
              <div className="mt-2 text-xs text-zinc-400">5792: {walletCapabilities.supports5792 ? 'supported' : 'fallback'} · 7702: {walletCapabilities.supports7702 ? 'supported' : 'fallback'}</div>
            </div>
          </motion.aside>
        </div>
      </section>

      {/* ─── Sheets / Modals ────────────────────────────────────────────── */}
      <SwapSettingsSheet
        open={showAdvanced}
        busy={busy !== null}
        slippagePct={slippagePct}
        deadlineMinutes={deadlineMinutes}
        onClose={() => setShowAdvanced(false)}
        onSetSlippagePct={setSlippagePct}
        onSetDeadlineMinutes={setDeadlineMinutes}
      />

      <SwapConfirmModal
        intent={confirmIntent}
        busy={busy}
        quoteIsStale={quoteIsStale}
        executionMode={executionMode}
        executionAddress={executionAddress}
        signerAddress={signerAddress}
        tokenInSymbol={tokenInSymbol}
        tokenOutSymbol={tokenOutSymbol}
        tokenInLogoUrl={tokenInDisplay.logoUrl}
        tokenOutLogoUrl={tokenOutDisplay.logoUrl}
        amountInUnits={amountInUnits}
        estimatedOut={estimatedOut}
        parsedSlippage={parsedSlippage}
        gasEstimateLabel={gasEstimateLabel}
        priceImpactLabel={priceImpactLabel}
        routeSummary={routeSummary}
        approvalRequired={approvalRequired}
        permitSignatureRequired={permitSignatureRequired}
        permitSignaturePending={permitSignaturePending}
        permitSignatureReady={permitSignatureReady}
        onCancel={closeConfirm}
        onConfirm={() => { void confirmAndExecute() }}
      />
    </div>
  )
}

// ─── Liquidity panel component ──────────────────────────────────────────────

function LiquidityPanel(props: {
  tokenInSymbol: string
  tokenOutSymbol: string
  lpMode: 'simple' | 'advanced'
  lpFeeTier: string
  lpAmountA: string
  lpAmountB: string
  lpLowerTick: string
  lpUpperTick: string
  lpPositionId: string
  lpStatus: string
  lpError: string
  lpBusy: string | null
  anyBusy: boolean
  identityReady: boolean
  positions: LpPosition[]
  positionsLoading: boolean
  positionsError: string | null
  activePanel: 'swap' | 'liquidity'
  onSetLpMode: (m: 'simple' | 'advanced') => void
  onSetLpFeeTier: (v: string) => void
  onSetLpAmountA: (v: string) => void
  onSetLpAmountB: (v: string) => void
  onSetLpLowerTick: (v: string) => void
  onSetLpUpperTick: (v: string) => void
  onSetLpPositionId: (v: string) => void
  onLpQuote: () => void
  onCreatePosition: () => void
  onClaimFees: (id?: string) => void
  onRemoveLiquidity: (id?: string) => void
  onRefreshPositions: () => void
  onSetActivePanel: (panel: 'swap' | 'liquidity') => void
  onOpenSettings: () => void
}) {
  return (
    <div className="space-y-4">
      {/* ─── Execution bar (mirrors swap panel) ─── */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-full border border-white/12 bg-black/40 p-0.5 text-xs">
          {(['swap', 'liquidity'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => props.onSetActivePanel(panel)}
              className={`min-h-7 rounded-full px-3 py-1 transition-colors capitalize ${
                props.activePanel === panel
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {panel}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={props.onOpenSettings}
          className="rounded-full border border-white/12 bg-white/4 p-2 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          title="Settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="8" cy="8" r="2" /><path d="M8 2v1M8 13v1M2 8H1m13 0h1M4.05 4.05l-.71-.71m9.32 9.32-.71-.71M4.05 11.95l-.71.71m9.32-9.32-.71.71" />
          </svg>
        </button>
      </div>

      {/* ─── Add liquidity form ─── */}
      <div className="rounded-2xl border border-white/8 bg-vault-card/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Add position</span>
          <button
            type="button"
            onClick={() => props.onSetLpMode(props.lpMode === 'simple' ? 'advanced' : 'simple')}
            className="rounded-full border border-white/12 bg-white/4 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          >
            {props.lpMode === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label mb-1 block">{props.tokenInSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={props.lpAmountA}
              onChange={(e) => props.onSetLpAmountA(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="label mb-1 block">{props.tokenOutSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={props.lpAmountB}
              onChange={(e) => props.onSetLpAmountB(e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="label mb-1 block">Fee tier</label>
            <select
              value={props.lpFeeTier}
              onChange={(e) => props.onSetLpFeeTier(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="500">0.05%</option>
              <option value="3000">0.30%</option>
              <option value="10000">1.00%</option>
            </select>
          </div>
          <div>
            <label className="label mb-1 block">Position ID</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpPositionId}
              onChange={(e) => props.onSetLpPositionId(e.target.value)}
              placeholder="For claim / remove"
            />
          </div>
        </div>

        {props.lpMode === 'advanced' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpLowerTick}
              onChange={(e) => props.onSetLpLowerTick(e.target.value)}
              placeholder="Lower tick"
            />
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpUpperTick}
              onChange={(e) => props.onSetLpUpperTick(e.target.value)}
              placeholder="Upper tick"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={props.onLpQuote}
            disabled={props.anyBusy || !props.identityReady}
            className="rounded-xl border border-white/12 bg-white/4 py-2 text-sm text-zinc-300 transition hover:bg-white/8 disabled:opacity-50"
          >
            {props.lpBusy === 'lpQuote' ? 'Quoting…' : 'Get quote'}
          </button>
          <button
            type="button"
            onClick={props.onCreatePosition}
            disabled={props.anyBusy || !props.identityReady}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-8px_rgba(0,82,255,0.5)] transition hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {props.lpBusy === 'lpCreate' ? 'Adding…' : 'Add liquidity'}
          </button>
          <button
            type="button"
            onClick={() => props.onClaimFees()}
            disabled={props.anyBusy || !props.identityReady || !props.lpPositionId.trim()}
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            {props.lpBusy === 'lpClaim' ? 'Claiming…' : 'Claim fees'}
          </button>
          <button
            type="button"
            onClick={() => props.onRemoveLiquidity()}
            disabled={props.anyBusy || !props.identityReady || !props.lpPositionId.trim()}
            className="rounded-xl border border-rose-400/20 bg-rose-500/8 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            {props.lpBusy === 'lpRemove' ? 'Removing…' : 'Remove'}
          </button>
        </div>

        {props.lpStatus && (
          <div className="mt-2 text-xs text-emerald-400">{props.lpStatus}</div>
        )}
        {props.lpError && (
          <div className="mt-2 text-xs text-rose-400">{props.lpError}</div>
        )}
      </div>

      {/* ─── Positions ─── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Droplets className="h-3.5 w-3.5" />
            Your positions
          </div>
          <button
            type="button"
            onClick={props.onRefreshPositions}
            disabled={props.positionsLoading}
            className="rounded-full border border-white/10 p-1.5 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            aria-label="Refresh positions"
          >
            <RefreshCw className={`h-3 w-3 ${props.positionsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {props.positionsLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/4" />
            ))}
          </div>
        )}

        {props.positionsError && !props.positionsLoading && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-400">
            {props.positionsError}
          </div>
        )}

        {!props.positionsLoading && !props.positionsError && props.positions.length === 0 && (
          <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-6 text-center text-sm text-zinc-600">
            No active positions
          </div>
        )}

        {!props.positionsLoading && props.positions.length > 0 && (
          <div className="space-y-2">
            {props.positions.map((pos, i) => (
              <LpPositionCard
                key={pos.id ?? pos.tokenId ?? i}
                position={pos}
                busy={props.lpBusy}
                onClaim={props.onClaimFees}
                onRemove={props.onRemoveLiquidity}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
