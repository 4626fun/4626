import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Droplets, Plus, RefreshCw } from 'lucide-react'

import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import {
  claimLiquidityFees,
  createPosition,
  fetchLiquidityPositions,
  quoteCreatePosition,
  removeLiquidity,
} from '@/lib/uniswap/liquidityApi'
import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'
import { CONTRACTS } from '@/config/contracts'

export type LpPosition = {
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
          <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 app-meta-value text-zinc-600 shrink-0">
            #{posId.slice(-6)}
          </span>
        )}
      </div>
      <div className="app-meta-value mt-2 text-zinc-500">
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

export function LiquidityPanel(props: {
  tokenInSymbol: string
  tokenOutSymbol: string
  identityReady: boolean
  activePanel: 'swap' | 'liquidity'
  onSetActivePanel: (panel: 'swap' | 'liquidity') => void
  onOpenSettings: () => void
  canonicalAddress: string | null
  tokenIn: string
  tokenOut: string
}) {
  // Internal LP state and logic (moved here for condensation of main Swap page)
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

  const handleLpQuote = async () => {
    if (!props.canonicalAddress) return
    setLpBusy('lpQuote'); setLpError(''); setLpStatus('')
    try {
      const t0 = props.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : props.tokenIn
      const t1 = props.tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : props.tokenOut
      await quoteCreatePosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: props.canonicalAddress,
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

  const handleCreatePosition = async () => {
    if (!props.canonicalAddress) return
    setLpBusy('lpCreate'); setLpError(''); setLpStatus('')
    try {
      const t0 = props.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : props.tokenIn
      const t1 = props.tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : props.tokenOut
      const data = await createPosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: props.canonicalAddress,
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

  const handleClaimFees = async (posId?: string) => {
    const id = posId ?? lpPositionId.trim()
    if (!props.canonicalAddress || !id) return
    setLpBusy('lpClaim'); setLpError('')
    try {
      await claimLiquidityFees({ chainId: BASE_CHAIN_ID, walletAddress: props.canonicalAddress, positionId: id })
      setLpStatus('Fee claim submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to claim fees')
    } finally { setLpBusy(null) }
  }

  const handleRemoveLiquidity = async (posId?: string) => {
    const id = posId ?? lpPositionId.trim()
    if (!props.canonicalAddress || !id) return
    setLpBusy('lpRemove'); setLpError('')
    try {
      await removeLiquidity({ chainId: BASE_CHAIN_ID, walletAddress: props.canonicalAddress, positionId: id })
      setLpStatus('Remove liquidity submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to remove liquidity')
    } finally { setLpBusy(null) }
  }

  const lpPositionsQuery = useQuery({
    queryKey: ['uniswap', 'lp-positions', props.canonicalAddress],
    enabled: Boolean(props.activePanel === 'liquidity' && props.canonicalAddress),
    queryFn: async () => fetchLiquidityPositions(props.canonicalAddress!, BASE_CHAIN_ID),
    refetchInterval:
      props.activePanel === 'liquidity'
        ? () => (typeof document !== 'undefined' && document.hidden ? false : 20_000)
        : false,
    staleTime: 10_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 1_000 * 2 ** attempt),
    refetchOnWindowFocus: false,
  })

  const anyBusy = lpBusy !== null
  const positions: LpPosition[] = useMemo(() => {
    const data = lpPositionsQuery.data
    if (!data) return []
    if (Array.isArray((data as Record<string, unknown>)?.positions)) {
      return (data as { positions: LpPosition[] }).positions
    }
    if (Array.isArray(data)) return data as LpPosition[]
    return []
  }, [lpPositionsQuery.data])

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
          aria-label="Swap settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
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
            onClick={() => setLpMode(lpMode === 'simple' ? 'advanced' : 'simple')}
            className="rounded-full border border-white/12 bg-white/4 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          >
            {lpMode === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label mb-1 block">{props.tokenInSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={lpAmountA}
              onChange={(e) => setLpAmountA(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="label mb-1 block">{props.tokenOutSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={lpAmountB}
              onChange={(e) => setLpAmountB(e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="swap-lp-fee-tier" className="label mb-1 block">Fee tier</label>
            <select
              id="swap-lp-fee-tier"
              value={lpFeeTier}
              onChange={(e) => setLpFeeTier(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="500">0.05%</option>
              <option value="3000">0.30%</option>
              <option value="10000">1.00%</option>
            </select>
          </div>
          <div>
            <label htmlFor="swap-lp-position-id" className="label mb-1 block">Position ID</label>
            <input
              id="swap-lp-position-id"
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={lpPositionId}
              onChange={(e) => setLpPositionId(e.target.value)}
              placeholder="For claim / remove"
            />
          </div>
        </div>

        {lpMode === 'advanced' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={lpLowerTick}
              onChange={(e) => setLpLowerTick(e.target.value)}
              placeholder="Lower tick"
            />
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={lpUpperTick}
              onChange={(e) => setLpUpperTick(e.target.value)}
              placeholder="Upper tick"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleLpQuote}
            disabled={anyBusy || !props.identityReady}
            className="rounded-xl border border-white/12 bg-white/4 py-2 text-sm text-zinc-300 transition hover:bg-white/8 disabled:opacity-50"
          >
            {lpBusy === 'lpQuote' ? 'Quoting…' : 'Get quote'}
          </button>
          <button
            type="button"
            onClick={handleCreatePosition}
            disabled={anyBusy || !props.identityReady}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-8px_rgb(var(--brand-primary)/0.5)] transition hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {lpBusy === 'lpCreate' ? 'Adding…' : 'Add liquidity'}
          </button>
          <button
            type="button"
            onClick={() => handleClaimFees()}
            disabled={anyBusy || !props.identityReady || !lpPositionId.trim()}
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            {lpBusy === 'lpClaim' ? 'Claiming…' : 'Claim fees'}
          </button>
          <button
            type="button"
            onClick={() => handleRemoveLiquidity()}
            disabled={anyBusy || !props.identityReady || !lpPositionId.trim()}
            className="rounded-xl border border-rose-400/20 bg-rose-500/8 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            {lpBusy === 'lpRemove' ? 'Removing…' : 'Remove'}
          </button>
        </div>

        {lpStatus && (
          <div className="mt-2"><Alert variant="success">{lpStatus}</Alert></div>
        )}
        {lpError && (
          <div className="mt-2"><Alert variant="error">{lpError}</Alert></div>
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
            onClick={() => lpPositionsQuery.refetch()}
            disabled={lpPositionsQuery.isLoading}
            className="rounded-full border border-white/10 p-1.5 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            aria-label="Refresh positions"
          >
            {lpPositionsQuery.isLoading ? <Spinner size="xs" /> : <RefreshCw className="h-3 w-3" />}
          </button>
        </div>

        {lpPositionsQuery.isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/4" />
            ))}
          </div>
        )}

        {lpPositionsQuery.isError && !lpPositionsQuery.isLoading && (
          <Alert variant="error">Failed to load positions.</Alert>
        )}

        {!lpPositionsQuery.isLoading && !lpPositionsQuery.isError && positions.length === 0 && (
          <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-6 text-center">
            <Droplets className="mx-auto h-8 w-8 text-zinc-700 mb-2" aria-hidden="true" />
            <div className="text-sm text-zinc-500">No active liquidity positions</div>
            <div className="mt-1 text-xs text-zinc-600">Add liquidity above to start earning fees.</div>
          </div>
        )}

        {!lpPositionsQuery.isLoading && positions.length > 0 && (
          <div className="space-y-2">
            {positions.map((pos, i) => (
              <LpPositionCard
                key={pos.id ?? pos.tokenId ?? i}
                position={pos}
                busy={lpBusy}
                onClaim={handleClaimFees}
                onRemove={handleRemoveLiquidity}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
