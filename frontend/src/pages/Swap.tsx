import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Droplets, Plus, RefreshCw } from 'lucide-react'
import { getAddress, isAddress } from 'viem'
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi'

import { SwapConfirmModal } from '@/components/trade/SwapConfirmModal'
import { SwapPanel } from '@/components/trade/SwapPanel'
import { SwapSettingsSheet } from '@/components/trade/SwapSettingsSheet'
import { TransactionLifecycle } from '@/components/trade/TransactionLifecycle'
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
import { isUniswapXRouting, pickQuote } from '@/lib/uniswap/tradingApi'
import {
  getDefaultWalletMode,
  getExecutionContext,
  isCSWAvailable,
  readPreferredWalletMode,
  writePreferredWalletMode,
  type WalletMode,
} from '@/lib/uniswap/walletMode'
import {
  BASE_CHAIN_ID,
  NATIVE_TOKEN_ADDRESS,
  buildTokenOptions,
  trustWalletBaseLogo,
  type TokenOption,
} from '@/lib/uniswap/swapUtils'

const CORE_TOKENS: TokenOption[] = [
  // Represent ETH as native for Uniswap Trading API + wagmi balances.
  // Keep the logo pointed at WETH so TrustWallet assets load reliably on Base.
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.weth) },
  { symbol: 'USDC', name: 'USD Coin', address: CONTRACTS.usdc, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.usdc) },
  { symbol: 'BTC', name: 'Coinbase Wrapped BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', group: 'core', logoUrl: trustWalletBaseLogo('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf') },
  { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', group: 'core', logoUrl: trustWalletBaseLogo('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2') },
  { symbol: 'ZORA', name: 'Zora', address: CONTRACTS.zora, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.zora) },
]

type QuoteShape = Record<string, unknown>

function fmtBal(d: { formatted: string; symbol: string } | undefined): string | undefined {
  if (!d) return undefined
  const n = parseFloat(d.formatted)
  if (!Number.isFinite(n)) return undefined
  if (n === 0) return `0 ${d.symbol}`
  if (n < 0.0001) return `<0.0001 ${d.symbol}`
  return `${parseFloat(n.toPrecision(4))} ${d.symbol}`
}

function formatPercent(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return `${n.toFixed(2)}%`
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

  const {
    tokenIn,
    setTokenIn,
    tokenOut,
    setTokenOut,
    amountInUnits,
    setAmountInUnits,
    slippagePct,
    setSlippagePct,
    activePanel,
    setActivePanel,
    showAdvanced,
    setShowAdvanced,
    deadlineMinutes,
    setDeadlineMinutes,
    parsedSlippage,
    parsedDeadlineMinutes,
    switchTokens,
  } = useSwapState({
    initialTokenIn: NATIVE_TOKEN_ADDRESS,
    initialTokenOut: CONTRACTS.usdc,
  })

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

  const executionContext = useMemo(
    () =>
      getExecutionContext(executionMode, {
        canonicalAddress,
        signerAddress,
        canonicalReady,
        eoaReady,
        supports5792: walletCapabilities.supports5792,
        supports7702: walletCapabilities.supports7702,
      }),
    [
      executionMode,
      canonicalAddress,
      signerAddress,
      canonicalReady,
      eoaReady,
      walletCapabilities.supports5792,
      walletCapabilities.supports7702,
    ],
  )

  const executionAddress = executionContext.address
  const executionReady = executionContext.ready
  const executionFallbackActive = executionMode !== preferredExecutionMode
  const canonicalAvailable = isCSWAvailable({
    canonicalAddress,
    signerAddress,
    canonicalReady,
    eoaReady,
  })

  useEffect(() => {
    writePreferredWalletMode(preferredExecutionMode)
  }, [preferredExecutionMode])

  // ─── Token options ────────────────────────────────────────────────────────
  const tokenOptions = useMemo<TokenOption[]>(() => {
    const creatorCoin = (searchParams.get('token') ?? '').trim()
    const shareCoin = (searchParams.get('share') ?? searchParams.get('shareToken') ?? '').trim()
    const shareSymbolParam = (searchParams.get('shareSymbol') ?? searchParams.get('shareTokenSymbol') ?? '').trim()
    const shareNameParam = (searchParams.get('shareName') ?? searchParams.get('shareTokenName') ?? '').trim()
    return buildTokenOptions({
      coreTokens: CORE_TOKENS,
      creatorCoin,
      shareCoin,
      shareSymbol: shareSymbolParam,
      shareName: shareNameParam,
      chainId: BASE_CHAIN_ID,
    })
  }, [searchParams])

  const tokenInOption = useMemo(
    () => tokenOptions.find((opt) => opt.address.toLowerCase() === tokenIn.toLowerCase()) ?? null,
    [tokenIn, tokenOptions],
  )
  const tokenOutOption = useMemo(
    () => tokenOptions.find((opt) => opt.address.toLowerCase() === tokenOut.toLowerCase()) ?? null,
    [tokenOut, tokenOptions],
  )

  const tokenInIdentity = useTokenIdentity({ address: tokenIn, option: tokenInOption })
  const tokenOutIdentity = useTokenIdentity({ address: tokenOut, option: tokenOutOption })
  const tokenInDisplay = tokenInIdentity.display
  const tokenOutDisplay = tokenOutIdentity.display
  const tokenInSymbol = tokenInDisplay.symbol
  const tokenOutSymbol = tokenOutDisplay.symbol

  // ─── Token balances ───────────────────────────────────────────────────────
  const isTokenInNative = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
  const isTokenOutNative = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
  const { data: tokenInBalData } = useBalance({
    address: executionAddress ?? undefined,
    token: isTokenInNative ? undefined : (tokenIn as `0x${string}`),
    chainId: BASE_CHAIN_ID,
    query: { enabled: Boolean(executionAddress) && isAddress(tokenIn) },
  })
  const { data: tokenOutBalData } = useBalance({
    address: executionAddress ?? undefined,
    token: isTokenOutNative ? undefined : (tokenOut as `0x${string}`),
    chainId: BASE_CHAIN_ID,
    query: { enabled: Boolean(executionAddress) && isAddress(tokenOut) },
  })
  const tokenInBalanceLabel = fmtBal(tokenInBalData)
  const tokenOutBalanceLabel = fmtBal(tokenOutBalData)

  // ─── Swap execution ───────────────────────────────────────────────────────
  const {
    estimatedOut,
    quote,
    busy,
    status,
    error,
    confirmIntent,
    quoteUpdatedAt,
    txState,
    txHash,
    isReady,
    approvalRequired,
    quoteIsStale,
    permitSignatureRequired,
    permitSignaturePending,
    permitSignatureReady,
    handleQuote,
    handleReviewTrade,
    closeConfirm,
    confirmAndExecute,
    resetTradeState,
    tokensEquivalent,
  } = useSwapExecution({
    address,
    walletClient,
    publicClient,
    canonicalAddress,
    signerAddress,
    executionMode,
    executionAddress,
    executionReady,
    tokenIn,
    tokenOut,
    amountInUnits,
    parsedSlippage,
    parsedDeadlineMinutes,
  })

  const selectedQuote = useMemo<QuoteShape | null>(() => {
    if (!quote) return null
    const candidate = pickQuote(quote) ?? quote
    return candidate as QuoteShape
  }, [quote])

  const isOrderRoute = useMemo(() => isUniswapXRouting(quote?.routing), [quote])

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

  // Sync busy into a ref so the auto-quote timer can check it without becoming
  // a dependency — having `busy` in the deps list causes the effect to re-fire
  // every time a quote completes (null→'quote'→null), creating an infinite
  // request flood when the upstream API is unhealthy (e.g. 403/429).
  const busyRef = useRef(busy)
  busyRef.current = busy

  // Debounced auto-quote: only fires when actual swap inputs change.
  useEffect(() => {
    if (!executionReady || !isReady) return
    const timer = window.setTimeout(() => {
      if (busyRef.current) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
    // `busy` intentionally omitted — use busyRef to check at call-time.
  }, [tokenIn, tokenOut, amountInUnits, parsedSlippage, executionReady, isReady, handleQuote])

  // Wallet capabilities
  useEffect(() => {
    let cancelled = false
    void detectUniswapWalletCapabilities(walletClient).then((caps) => {
      if (!cancelled) setWalletCapabilities(caps)
    })
    return () => { cancelled = true }
  }, [walletClient])

  // ─── LP handlers ──────────────────────────────────────────────────────────
  async function handleLpQuote() {
    if (!canonicalAddress) return
    setLpBusy('lpQuote'); setLpError(''); setLpStatus('')
    try {
      const t0 = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenIn
      const t1 = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenOut
      await quoteCreatePosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: t0, token1: t1,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus('Liquidity quote ready')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to quote liquidity')
    } finally { setLpBusy(null) }
  }

  async function handleCreatePosition() {
    if (!canonicalAddress) return
    setLpBusy('lpCreate'); setLpError(''); setLpStatus('')
    try {
      const t0 = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenIn
      const t1 = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenOut
      const data = await createPosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: t0, token1: t1,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus(`Position submitted${(data as Record<string, unknown>)?.requestId ? ` (#${(data as Record<string, unknown>).requestId})` : ''}`)
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to create position')
    } finally { setLpBusy(null) }
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

  // ─── LP positions query ───────────────────────────────────────────────────
  const lpPositionsQuery = useQuery({
    queryKey: ['uniswap', 'lp-positions', canonicalAddress],
    enabled: Boolean(activePanel === 'liquidity' && canonicalAddress),
    queryFn: async () => fetchLiquidityPositions(canonicalAddress!, BASE_CHAIN_ID),
    refetchInterval:
      activePanel === 'liquidity'
        ? () => (typeof document !== 'undefined' && document.hidden ? false : 20_000)
        : false,
    staleTime: 10_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 1_000 * 2 ** attempt),
    refetchOnWindowFocus: false,
  })

  const anyBusy = busy !== null || lpBusy !== null

  const positions: LpPosition[] = useMemo(() => {
    const data = lpPositionsQuery.data
    if (!data) return []
    if (Array.isArray((data as Record<string, unknown>)?.positions)) {
      return (data as { positions: LpPosition[] }).positions
    }
    if (Array.isArray(data)) return data as LpPosition[]
    return []
  }, [lpPositionsQuery.data])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* ─── Trade card ──────────────────────────────────────── */}
            <div className="rounded-[28px] border border-white/8 bg-black/50 p-5 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.95)] backdrop-blur-2xl">

              {activePanel === 'swap' ? (
                <SwapPanel
                  tokenOptions={tokenOptions}
                  tokenIn={tokenIn}
                  tokenOut={tokenOut}
                  tokenInDisplay={tokenInDisplay}
                  tokenOutDisplay={tokenOutDisplay}
                  tokenInIdentityLoading={tokenInIdentity.isLoading}
                  tokenOutIdentityLoading={tokenOutIdentity.isLoading}
                  amountInUnits={amountInUnits}
                  estimatedOut={estimatedOut}
                  tokenInSymbol={tokenInSymbol}
                  tokenOutSymbol={tokenOutSymbol}
                  tokenInBalanceLabel={tokenInBalanceLabel}
                  tokenOutBalanceLabel={tokenOutBalanceLabel}
                  isConnected={isConnected}
                  executionMode={executionMode}
                  preferredMode={preferredExecutionMode}
                  executionAddress={executionAddress}
                  executionReady={executionReady}
                  canonicalAvailable={canonicalAvailable}
                  canonicalConfigured={canonicalConfigured}
                  eoaAvailable={eoaReady}
                  executionFallbackActive={executionFallbackActive}
                  parsedSlippage={parsedSlippage}
                  isReady={isReady}
                  busy={busy}
                  quoteIsStale={quoteIsStale}
                  quoteUpdatedAt={quoteUpdatedAt}
                  status={status}
                  error={error}
                  tokensEquivalent={tokensEquivalent}
                  priceImpactLabel={priceImpactLabel}
                  gasEstimateLabel={gasEstimateLabel}
                  routeSummary={routeSummary}
                  isOrderRoute={isOrderRoute}
                  permitSignatureRequired={permitSignatureRequired}
                  permitSignaturePending={permitSignaturePending}
                  permitSignatureReady={permitSignatureReady}
                  activePanel={activePanel}
                  lifecycle={
                    // Only show the lifecycle widget when a tx is actually in-flight
                    // or has completed. 'idle' and 'review' are pre-execution states
                    // handled by the inline banners below.
                    txState !== 'idle' && txState !== 'review' ? (
                      <TransactionLifecycle
                        state={txState}
                        message={status || undefined}
                        txHash={txHash}
                      />
                    ) : null
                  }
                  onSetTokenIn={setTokenIn}
                  onSetTokenOut={setTokenOut}
                  onSetAmountInUnits={setAmountInUnits}
                  onSwitchTokens={handleSwitchTokens}
                  onReviewTrade={() => void handleReviewTrade()}
                  onRefreshQuote={() => void handleQuote()}
                  onOpenSettings={() => setShowAdvanced(true)}
                  onSetActivePanel={setActivePanel}
                  onSetExecutionMode={handleSetExecutionMode}
                  onEnableCanonical={handleEnableCanonical}
                />
              ) : (
                /* ─── Liquidity panel ───────────────────────────────── */
                <LiquidityPanel
                  tokenInSymbol={tokenInSymbol}
                  tokenOutSymbol={tokenOutSymbol}
                  lpMode={lpMode}
                  lpFeeTier={lpFeeTier}
                  lpAmountA={lpAmountA}
                  lpAmountB={lpAmountB}
                  lpLowerTick={lpLowerTick}
                  lpUpperTick={lpUpperTick}
                  lpPositionId={lpPositionId}
                  lpStatus={lpStatus}
                  lpError={lpError}
                  lpBusy={lpBusy}
                  anyBusy={anyBusy}
                  identityReady={identityReady}
                  positions={positions}
                  positionsLoading={lpPositionsQuery.isLoading}
                  positionsError={lpPositionsQuery.isError ? 'Failed to load positions.' : null}
                  onSetLpMode={setLpMode}
                  onSetLpFeeTier={setLpFeeTier}
                  onSetLpAmountA={setLpAmountA}
                  onSetLpAmountB={setLpAmountB}
                  onSetLpLowerTick={setLpLowerTick}
                  onSetLpUpperTick={setLpUpperTick}
                  onSetLpPositionId={setLpPositionId}
                  onLpQuote={handleLpQuote}
                  onCreatePosition={handleCreatePosition}
                  onClaimFees={handleClaimFees}
                  onRemoveLiquidity={handleRemoveLiquidity}
                  onRefreshPositions={() => void lpPositionsQuery.refetch()}
                  activePanel={activePanel}
                  onSetActivePanel={setActivePanel}
                  onOpenSettings={() => setShowAdvanced(true)}
                />
              )}
            </div>

            {/* ─── Footer note (replaces Supported Assets side panel) ── */}
            <div className="mt-3 px-1 text-center text-[11px] text-zinc-700">
              ETH · USDC · BTC · USDT · ZORA + creator/share tokens · Powered by Uniswap on Base
            </div>
          </motion.div>
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
