import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock3, Droplets, Settings, Sparkles } from 'lucide-react'
import { getAddress, isAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { SwapConfirmModal } from '@/components/trade/SwapConfirmModal'
import { SwapPanel } from '@/components/trade/SwapPanel'
import { TransactionLifecycle } from '@/components/trade/TransactionLifecycle'
import { CONTRACTS } from '@/config/contracts'
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet'
import { useSwapExecution } from '@/hooks/useSwapExecution'
import { useSwapState } from '@/hooks/useSwapState'
import { useTokenIdentity } from '@/hooks/useTokenIdentity'
import { detectUniswapWalletCapabilities } from '@/lib/uniswap/capabilities'
import { claimLiquidityFees, createPosition, fetchLiquidityPositions, quoteCreatePosition, removeLiquidity } from '@/lib/uniswap/liquidityApi'
import { BASE_CHAIN_ID, buildTokenOptions, trustWalletBaseLogo, type TokenOption } from '@/lib/uniswap/swapUtils'

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', name: 'Ethereum', address: CONTRACTS.weth, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.weth) },
  { symbol: 'USDC', name: 'USD Coin', address: CONTRACTS.usdc, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.usdc) },
  { symbol: 'BTC', name: 'Coinbase Wrapped BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', group: 'core', logoUrl: trustWalletBaseLogo('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf') },
  { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', group: 'core', logoUrl: trustWalletBaseLogo('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2') },
  { symbol: 'ZORA', name: 'Zora', address: CONTRACTS.zora, group: 'core', logoUrl: trustWalletBaseLogo(CONTRACTS.zora) },
]

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
    quoteIsStale,
    handleQuote,
    handleCheckApproval,
    handleBuildSwap,
    handleReviewTrade,
    openConfirm,
    closeConfirm,
    confirmAndExecute,
    resetTradeState,
  } = useSwapExecution({
    address,
    walletClient,
    publicClient,
    canonicalAddress,
    signerAddress,
    identityReady,
    tokenIn,
    tokenOut,
    amountInUnits,
    parsedSlippage,
    parsedDeadlineMinutes,
  })

  const handleSwitchTokens = useCallback(() => {
    switchTokens()
    resetTradeState()
  }, [switchTokens, resetTradeState])

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
    <div className="relative pb-24 md:pb-0">
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
                  identityReady={identityReady}
                  isReady={isReady}
                  busy={busy}
                  quoteIsStale={quoteIsStale}
                  status={status}
                  error={error}
                  showAdvanced={showAdvanced}
                  slippagePct={slippagePct}
                  deadlineMinutes={deadlineMinutes}
                  approvalRequired={approvalRequired}
                  hasQuote={Boolean(quote)}
                  hasSwapTx={Boolean(swapTx)}
                  lifecycle={<TransactionLifecycle state={txState} message={status || error || (quoteIsStale ? 'Quote needs refresh' : undefined)} txHash={txHash} />}
                  onSetTokenIn={setTokenIn}
                  onSetTokenOut={setTokenOut}
                  onSetAmountInUnits={setAmountInUnits}
                  onSetSlippagePct={setSlippagePct}
                  onSetDeadlineMinutes={setDeadlineMinutes}
                  onSwitchTokens={handleSwitchTokens}
                  onReviewTrade={() => void handleReviewTrade()}
                  onQuote={() => void handleQuote()}
                  onCheckApproval={() => void handleCheckApproval()}
                  onBuildSwap={() => void handleBuildSwap()}
                  onOpenApprovalConfirm={() => openConfirm('approval')}
                  onOpenSwapConfirm={() => openConfirm('swap')}
                  onRefreshQuote={() => void handleQuote()}
                />
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
              <div className="mt-2 text-xs text-zinc-400">5792: {walletCapabilities.supports5792 ? 'supported' : 'fallback'} · 7702: {walletCapabilities.supports7702 ? 'supported' : 'fallback'}</div>
            </div>
          </motion.aside>
        </div>
      </section>

      <SwapConfirmModal
        intent={confirmIntent}
        busy={busy}
        quoteIsStale={quoteIsStale}
        canonicalAddress={canonicalAddress}
        signerAddress={signerAddress}
        tokenInSymbol={tokenInSymbol}
        tokenOutSymbol={tokenOutSymbol}
        amountInUnits={amountInUnits}
        estimatedOut={estimatedOut}
        approvalRequired={approvalRequired}
        onCancel={closeConfirm}
        onConfirm={() => {
          void confirmAndExecute()
        }}
      />
    </div>
  )
}

