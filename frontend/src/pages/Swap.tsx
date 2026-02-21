import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Droplets, Settings, Sparkles } from 'lucide-react'
import { getAddress, isAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { SwapConfirmModal } from '@/components/trade/SwapConfirmModal'
import { SwapPanel } from '@/components/trade/SwapPanel'
import { SwapSettingsSheet } from '@/components/trade/SwapSettingsSheet'
import { TransactionLifecycle } from '@/components/trade/TransactionLifecycle'
import { WalletModeToggle } from '@/components/trade/WalletModeToggle'
import { CONTRACTS } from '@/config/contracts'
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet'
import { useSwapExecution } from '@/hooks/useSwapExecution'
import { useSwapState } from '@/hooks/useSwapState'
import { useTokenIdentity } from '@/hooks/useTokenIdentity'
import { detectUniswapWalletCapabilities } from '@/lib/uniswap/capabilities'
import { claimLiquidityFees, createPosition, fetchLiquidityPositions, quoteCreatePosition, removeLiquidity } from '@/lib/uniswap/liquidityApi'
import { pickSwapQuote } from '@/lib/uniswap/tradingApi'
import {
  getDefaultWalletMode,
  getExecutionContext,
  isCSWAvailable,
  readPreferredWalletMode,
  writePreferredWalletMode,
  type WalletMode,
} from '@/lib/uniswap/walletMode'
import { BASE_CHAIN_ID, buildTokenOptions, trustWalletBaseLogo, type TokenOption } from '@/lib/uniswap/swapUtils'

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', name: 'Ethereum', address: CONTRACTS.weth, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.weth) },
  { symbol: 'USDC', name: 'USD Coin', address: CONTRACTS.usdc, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.usdc) },
  { symbol: 'BTC', name: 'Coinbase Wrapped BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', group: 'core', logoUrl: trustWalletBaseLogo('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf') },
  { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', group: 'core', logoUrl: trustWalletBaseLogo('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2') },
  { symbol: 'ZORA', name: 'Zora', address: CONTRACTS.zora, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.zora) },
]

type QuoteShape = Record<string, unknown>

function formatPercent(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return `${n.toFixed(2)}%`
}

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
    initialTokenIn: CONTRACTS.weth,
    initialTokenOut: CONTRACTS.usdc,
  })

  const [walletCapabilities, setWalletCapabilities] = useState<{ supports5792: boolean; supports7702: boolean }>({
    supports5792: false,
    supports7702: false,
  })
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

  useEffect(() => {
    const qToken = (searchParams.get('token') ?? '').trim()
    if (isAddress(qToken)) setTokenOut(getAddress(qToken))
  }, [searchParams, setTokenOut])

  const { canonicalAddress, signerAddress, identityReady } = useCanonicalWallet({
    address,
    publicClient,
    walletReady: Boolean(walletClient),
  })

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

  useEffect(() => {
    resetTradeState()
  }, [executionAddress, resetTradeState])

  useEffect(() => {
    if (!executionReady || !isReady) return
    const timer = window.setTimeout(() => {
      if (busy) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
  }, [tokenIn, tokenOut, amountInUnits, parsedSlippage, executionReady, isReady, busy, handleQuote])

  useEffect(() => {
    let cancelled = false
    void detectUniswapWalletCapabilities(walletClient).then((caps) => {
      if (!cancelled) setWalletCapabilities(caps)
    })
    return () => {
      cancelled = true
    }
  }, [walletClient])

  async function handleLpQuote() {
    if (!canonicalAddress) return
    setLpBusy('lpQuote')
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
      setLpBusy(null)
    }
  }

  async function handleCreatePosition() {
    if (!canonicalAddress) return
    setLpBusy('lpCreate')
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
      setLpBusy(null)
    }
  }

  async function handleClaimFees() {
    if (!canonicalAddress || !lpPositionId.trim()) return
    setLpBusy('lpClaim')
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
      setLpBusy(null)
    }
  }

  async function handleRemoveLiquidity() {
    if (!canonicalAddress || !lpPositionId.trim()) return
    setLpBusy('lpRemove')
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
      setLpBusy(null)
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

  const anyBusy = busy !== null || lpBusy !== null

  return (
    <div className="relative pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
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
                    <span className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 font-medium text-cyan-200">
                      Base
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" /> Smart routed
                    </span>
                    {quoteUpdatedAt ? (
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Updated {new Date(quoteUpdatedAt).toLocaleTimeString()}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="rounded-full border border-white/15 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  title="Trade settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {activePanel === 'swap' ? (
                <>
                  <div className="mb-3">
                    <WalletModeToggle
                      mode={executionMode}
                      preferredMode={preferredExecutionMode}
                      executionAddress={executionAddress}
                      busy={busy !== null}
                      canonicalAvailable={canonicalAvailable}
                      eoaAvailable={eoaReady}
                      fallbackActive={executionFallbackActive}
                      onChange={handleSetExecutionMode}
                      onEnableCanonical={handleEnableCanonical}
                    />
                    {executionMode === 'eoa' ? (
                      <div className="mt-1 text-[11px] text-amber-300">
                        EOA mode submits approval and swap transactions directly from your connected wallet.
                      </div>
                    ) : null}
                  </div>

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
                    parsedSlippage={parsedSlippage}
                    isConnected={isConnected}
                    executionMode={executionMode}
                    executionReady={executionReady}
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
                    permitSignatureRequired={permitSignatureRequired}
                    permitSignaturePending={permitSignaturePending}
                    permitSignatureReady={permitSignatureReady}
                    lifecycle={<TransactionLifecycle state={txState} message={status || error || (quoteIsStale ? 'Quote needs refresh' : undefined)} txHash={txHash} />}
                    onSetTokenIn={setTokenIn}
                    onSetTokenOut={setTokenOut}
                    onSetAmountInUnits={setAmountInUnits}
                    onSwitchTokens={handleSwitchTokens}
                    onReviewTrade={() => void handleReviewTrade()}
                    onRefreshQuote={() => void handleQuote()}
                  />
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
                    <button type="button" onClick={() => { void handleLpQuote() }} disabled={anyBusy || !identityReady} className="rounded-2xl border border-white/20 px-3 py-2 text-sm">Quote LP</button>
                    <button type="button" onClick={() => { void handleCreatePosition() }} disabled={anyBusy || !identityReady} className="rounded-2xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white">Add liquidity</button>
                    <button type="button" onClick={() => { void handleClaimFees() }} disabled={anyBusy || !identityReady || !lpPositionId.trim()} className="rounded-2xl border border-white/20 px-3 py-2 text-sm">Claim fees</button>
                    <button type="button" onClick={() => { void handleRemoveLiquidity() }} disabled={anyBusy || !identityReady || !lpPositionId.trim()} className="rounded-2xl border border-rose-400/40 px-3 py-2 text-sm text-rose-200">Remove</button>
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
                <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2">ETH · USDC · BTC · USDT · ZORA</div>
                <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2">Creator coins + share tokens (when opened from a creator page)</div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-5 text-sm text-zinc-300 backdrop-blur-xl">
              Powered by Uniswap APIs on Base with mobile-first swap + LP flows, including graceful fallbacks when advanced wallet capabilities are unavailable.
              <div className="mt-2 text-xs text-zinc-400">
                Active mode: {executionMode === 'canonical' ? 'Canonical CSW' : 'Connected EOA'} · 5792:{' '}
                {executionContext.capabilities.supports5792 ? 'supported' : 'fallback'} · 7702:{' '}
                {executionContext.capabilities.supports7702 ? 'supported' : 'fallback'}
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

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
        amountInUnits={amountInUnits}
        estimatedOut={estimatedOut}
        approvalRequired={approvalRequired}
        permitSignatureRequired={permitSignatureRequired}
        permitSignaturePending={permitSignaturePending}
        permitSignatureReady={permitSignatureReady}
        onCancel={closeConfirm}
        onConfirm={() => {
          void confirmAndExecute()
        }}
      />
    </div>
  )
}

