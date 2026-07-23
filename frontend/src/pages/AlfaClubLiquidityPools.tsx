import { Suspense, lazy, useMemo, type ReactNode } from 'react'
import { ArrowRight, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { formatUnits, type Address, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { waitlistEntryHref, useOptionalAccessContext } from '@/app/accessShared'
import { SmartWalletRoute } from '@/app/routeGuards'
import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { PageMeta } from '@/components/seo/PageMeta'
import { CONTRACTS } from '@/config/contracts'
import {
  filterAlfaClubLiquidityPools,
  filterAlfaClubLiquidityPoolsByRoomId,
  formatAlfaClubPoolFee,
  isAlfaClubSudoswapMarketConfigured,
  useAlfaClubLiquidityPools,
  type AlfaClubLiquidityPoolSummary,
  type AlfaClubSudoswapMarketConfig,
} from '@/hooks/useAlfaClubLiquidityPools'
import { basescanAddressHref } from '@/features/status/statusShared'
import {
  ALFACLUB_EXPLORE_POOLS_PATH,
  ALFACLUB_EXPLORE_ROOMS_PATH,
} from '@/lib/alfaclub/hostPaths'
import { cn } from '@/lib/shared/utils'

import { AlfaClubLiquidity } from './AlfaClubLiquidity'

type TradeMode = 'buy' | 'buyWithEth' | 'sell'

const LazyConnectButton = lazy(async () => {
  const mod = await import('@/components/account/ConnectButton')
  return { default: mod.ConnectButton }
})

const MARKET_CONFIG: AlfaClubSudoswapMarketConfig = {
  pair: CONTRACTS.room1659SudoswapPair as Address,
  adapter: CONTRACTS.alfaClubSudoswapAdapter as Address,
  router: CONTRACTS.alfaClubUniversalRouter as Address,
  permit2: CONTRACTS.permit2 as Address,
  factory: CONTRACTS.sudoswapPairFactory as Address,
  curve: CONTRACTS.sudoswapXykCurve as Address,
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatTokenAmount(value: bigint, decimals: number): string {
  const numeric = Number(formatUnits(value, decimals))
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function roomTypeLabel(roomType: number | null): string {
  if (roomType === 0) return 'Trading'
  if (roomType === 1) return 'Social'
  return 'Unknown'
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[70vh] pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_82%_15%,rgba(217,70,239,0.08),transparent_30%)]"
      />
      {children}
    </div>
  )
}

function AlfaClubEthFundingRoute() {
  return (
    <section
      aria-label="Planned ETH funding route"
      data-testid="eth-to-room-route"
      className="rounded-2xl bg-white/[0.03] px-4 py-4 ring-1 ring-white/[0.07] sm:px-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-sky-300/80">
            ETH funding path (planned)
          </p>
          <h2 className="mt-1.5 text-sm font-medium text-zinc-100">
            ETH → Room 1659 FriendKeys (planned)
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Quote ETH through the Base ZORA and AKITA Creator Coin markets, then
            settle the official Room 1659 Sudoswap v2 pool in the existing
            guarded transaction flow.
          </p>
        </div>
        <span className="shrink-0 self-start rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-400 ring-1 ring-white/[0.08]">
          Base · Uniswap V4 + Sudoswap v2
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-zinc-300">
        {['ETH', 'ZORA', 'AKITA', 'FriendKey #1659'].map(
          (label, index, route) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="rounded-lg bg-black/40 px-2.5 py-1.5 ring-1 ring-white/[0.06]">
                {label}
              </span>
              {index < route.length - 1 ? (
                <ArrowRight className="h-3 w-3 text-sky-300/70" aria-hidden />
              ) : null}
            </span>
          ),
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        <span className="text-zinc-400">Buy with ETH</span> wraps ETH to WETH
        for canonical sponsored wallets, signs the Zora Permit2 authorization,
        and submits one sponsored batch. External wallets keep the native ETH
        quote; providers without atomic batching may submit approval legs
        sequentially.
      </p>
    </section>
  )
}

function MarketsConnectControl({ className }: { className?: string }) {
  return (
    <div className={cn('shrink-0', className)} data-testid="markets-connect">
      <Suspense
        fallback={
          <div className="inline-flex h-9 w-[164px] items-center justify-center rounded-full bg-white/8 px-3 text-[11px] font-medium text-zinc-400">
            Connect
          </div>
        }
      >
        <LazyConnectButton variant="nav" />
      </Suspense>
    </div>
  )
}

export function PoolCard({
  pool,
  selected,
  onTrade,
}: {
  pool: AlfaClubLiquidityPoolSummary
  selected: boolean
  onTrade: (mode: TradeMode) => void
}) {
  return (
    <article
      className={cn(
        'rounded-2xl p-4 text-left transition-colors ring-1',
        selected
          ? 'bg-sky-500/[0.08] ring-sky-400/25'
          : 'bg-black/40 ring-white/[0.07] hover:ring-white/[0.12]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">
            {pool.creatorCoinName || 'Creator Coin'}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {pool.creatorCoinSymbol} · Key #{pool.tokenId.toString()} ·{' '}
            {roomTypeLabel(pool.roomType)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {formatAlfaClubPoolFee(pool.feeBps)} fee
          </span>
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              pool.configurationReady
                ? 'bg-emerald-500/10 text-emerald-200/90'
                : 'bg-amber-500/10 text-amber-200/90',
            )}
          >
            {pool.configurationReady ? 'Ready' : 'Pending'}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
            Creator balance
          </dt>
          <dd className="mt-1 truncate tabular-nums text-zinc-200">
            {formatTokenAmount(
              pool.creatorCoinBalance,
              pool.creatorCoinDecimals,
            )}{' '}
            <span className="text-zinc-500">{pool.creatorCoinSymbol}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
            Key balance
          </dt>
          <dd className="mt-1 tabular-nums text-zinc-200">
            {pool.keyBalance.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
            Spot
          </dt>
          <dd className="mt-1 truncate tabular-nums text-zinc-400">
            {formatTokenAmount(pool.spotPrice, pool.creatorCoinDecimals)} /{' '}
            {pool.delta.toLocaleString()} keys
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
            Pair
          </dt>
          <dd className="mt-1">
            <a
              href={basescanAddressHref(pool.pool)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="font-mono text-[11px] text-sky-200/90 underline-offset-2 hover:underline"
            >
              {shortAddress(pool.pool)}
            </a>
            <div className="mt-1 text-[10px] text-zinc-600">
              Official Sudoswap ERC-1155 / ERC-20
            </div>
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTrade('buyWithEth')}
          disabled={!pool.configurationReady}
          className="col-span-2 inline-flex h-9 items-center justify-center rounded-full bg-sky-500 px-3 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          Buy with ETH
        </button>
        <button
          type="button"
          onClick={() => onTrade('buy')}
          disabled={!pool.configurationReady}
          className="inline-flex h-9 items-center justify-center rounded-full bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] disabled:text-zinc-600"
        >
          Buy keys
        </button>
        <button
          type="button"
          onClick={() => onTrade('sell')}
          disabled={!pool.configurationReady}
          className="inline-flex h-9 items-center justify-center rounded-full bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] disabled:text-zinc-600"
        >
          Sell keys
        </button>
      </div>
    </article>
  )
}

export function AlfaClubLpWriteConsole(props: {
  selectedPool: AlfaClubLiquidityPoolSummary | null
  initialMode?: TradeMode
}) {
  const access = useOptionalAccessContext()
  const location = useLocation()

  if (!access || access.loading) {
    return <AppLoadingRegistrar label="alfaclub-market-write-access" />
  }

  if (!access.sessionValid || !access.accepted) {
    const href = waitlistEntryHref(access.marketingUrl, {
      alfaClubReturnPath: `${location.pathname}${location.search}`,
    })
    const needsSession = !access.sessionValid
    return (
      <div className="rounded-2xl bg-zinc-950/40 p-5 ring-1 ring-white/[0.07] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-zinc-100">
              {needsSession
                ? 'Connect to trade'
                : 'Market trades require access'}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-500">
              {needsSession
                ? 'Browse markets freely. Connect your account to buy or sell FriendKeys with an execution-ready wallet.'
                : 'Your session is connected. An accepted 4626 access grant is still required before trading opens.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsSession ? <MarketsConnectControl /> : null}
            <a
              href={href}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition',
                needsSession
                  ? 'bg-white/[0.06] text-zinc-200 ring-1 ring-white/[0.1] hover:bg-white/[0.1]'
                  : 'bg-sky-500 text-white hover:bg-sky-400',
              )}
            >
              {needsSession ? 'Sign in to trade' : 'Open access setup'}
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!props.selectedPool?.configurationReady) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/40 p-5 ring-1 ring-white/[0.07]">
        <ShieldAlert className="mt-0.5 size-5 text-amber-300" aria-hidden />
        <div>
          <h2 className="text-sm font-medium text-zinc-100">
            No execution-ready market
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Trading stays disabled until the official pair and adapter binding
            are configured.
          </p>
        </div>
      </div>
    )
  }

  const initialMode = props.initialMode ?? 'buy'
  return (
    <SmartWalletRoute>
      <AlfaClubLiquidity
        key={`${props.selectedPool.pool}-${initialMode}`}
        initialCreatorCoin={props.selectedPool.creatorCoin}
        initialTokenId={props.selectedPool.tokenId}
        initialMode={initialMode}
        embedded
      />
    </SmartWalletRoute>
  )
}

export function AlfaClubRoomLiquidity({ roomId }: { roomId: string }) {
  const publicClient = usePublicClient({ chainId: base.id })
  const marketConfigured = isAlfaClubSudoswapMarketConfigured(MARKET_CONFIG)
  const directory = useAlfaClubLiquidityPools(
    publicClient as unknown as PublicClient | undefined,
    marketConfigured ? MARKET_CONFIG : null,
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const pools = useMemo(
    () => directory.data?.pools ?? [],
    [directory.data?.pools],
  )
  const roomPools = useMemo(
    () => filterAlfaClubLiquidityPoolsByRoomId(pools, roomId),
    [pools, roomId],
  )
  const requestedPool = searchParams.get('pool')?.toLowerCase() ?? ''
  const selectedPool =
    roomPools.find((pool) => pool.pool.toLowerCase() === requestedPool) ??
    roomPools[0] ??
    null
  const tradeMode: TradeMode =
    searchParams.get('side') === 'sell'
      ? 'sell'
      : searchParams.get('side') === 'buyWithEth'
        ? 'buyWithEth'
        : 'buy'

  const selectTrade = (pool: AlfaClubLiquidityPoolSummary, mode: TradeMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    next.set('side', mode)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-zinc-950/40 p-5 ring-1 ring-white/[0.07]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-zinc-100">Key market</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Official Sudoswap Creator Coin / FriendKey market for token ID{' '}
              {roomId}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MarketsConnectControl className="md:hidden" />
            {marketConfigured ? (
              <button
                type="button"
                onClick={() => directory.refetch()}
                disabled={directory.isFetching}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    directory.isFetching && 'animate-spin',
                  )}
                  aria-hidden
                />
                Refresh
              </button>
            ) : null}
          </div>
        </div>

        {!marketConfigured ? (
          <p className="mt-5 text-sm text-amber-300">
            Official market deployment is not configured.
          </p>
        ) : directory.isLoading ? (
          <p className="mt-5 text-sm text-zinc-400" role="status">
            Loading key market from Base…
          </p>
        ) : directory.error ? (
          <p className="mt-5 text-sm text-red-300" role="alert">
            Unable to load the key market.
          </p>
        ) : roomPools.length === 0 ? (
          <div className="mt-5 rounded-xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
            <h3 className="text-sm font-medium text-zinc-100">
              No configured market for this key
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              The official AlfaClub Sudoswap market is currently assigned to
              Key #1659.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {roomPools.map((pool) => (
              <PoolCard
                key={pool.pool}
                pool={pool}
                selected={selectedPool?.pool === pool.pool}
                onTrade={(mode) => selectTrade(pool, mode)}
              />
            ))}
          </div>
        )}
      </section>

      <section
        id="room-liquidity-console"
        className="scroll-mt-40 rounded-2xl bg-black/25 p-4 ring-1 ring-white/[0.06]"
      >
        <AlfaClubLpWriteConsole
          selectedPool={selectedPool}
          initialMode={tradeMode}
        />
      </section>
    </div>
  )
}

export function AlfaClubLiquidityPools() {
  const publicClient = usePublicClient({ chainId: base.id })
  const marketConfigured = isAlfaClubSudoswapMarketConfigured(MARKET_CONFIG)
  const directory = useAlfaClubLiquidityPools(
    publicClient as unknown as PublicClient | undefined,
    marketConfigured ? MARKET_CONFIG : null,
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''

  const pools = useMemo(
    () => directory.data?.pools ?? [],
    [directory.data?.pools],
  )
  const filteredPools = useMemo(
    () => filterAlfaClubLiquidityPools(pools, search),
    [pools, search],
  )
  const requestedPool = searchParams.get('pool')?.toLowerCase() ?? ''
  const selectedPool =
    pools.find((pool) => pool.pool.toLowerCase() === requestedPool) ??
    pools[0] ??
    null
  const tradeMode: TradeMode =
    searchParams.get('side') === 'sell'
      ? 'sell'
      : searchParams.get('side') === 'buyWithEth'
        ? 'buyWithEth'
        : 'buy'

  const selectTrade = (pool: AlfaClubLiquidityPoolSummary, mode: TradeMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    next.set('side', mode)
    setSearchParams(next, { replace: true })
  }

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams)
    const trimmed = value.trim()
    if (trimmed) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <PageShell>
      <PageMeta
        title="AlfaClub Key Markets"
        description="Browse official AlfaClub FriendKey secondary markets on Base. ERC-1155 keys trade in-app against Creator Coins on Sudoswap v2 pairs — not Uniswap token swap."
        canonicalPath={ALFACLUB_EXPLORE_POOLS_PATH}
        canonicalOrigin="https://4626.fun"
        robots="noindex,follow"
      />

      <main className="mx-auto w-full max-w-[1400px] px-3 pt-6 sm:px-6 sm:pt-10">
        <header className="border-b border-white/[0.06] pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-300/90">
                AlfaClub
              </p>
              <h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">
                Key markets
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                Secondary FriendKey trading settles in-app on official Sudoswap
                v2 ERC-1155 / ERC-20 pairs — not Uniswap token swap.
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Looking for rooms?{' '}
                <Link
                  to={ALFACLUB_EXPLORE_ROOMS_PATH}
                  className="text-zinc-300 underline-offset-2 hover:underline"
                >
                  Browse trading rooms
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Desktop nav already exposes Connect; keep an in-page control for mobile. */}
              <MarketsConnectControl className="md:hidden" />
              {marketConfigured ? (
                <button
                  type="button"
                  onClick={() => directory.refetch()}
                  disabled={directory.isFetching}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600"
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      directory.isFetching && 'animate-spin',
                    )}
                    aria-hidden
                  />
                  Refresh
                </button>
              ) : null}
            </div>
          </div>

          <dl className="mt-6 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08]">
            <div className="bg-black/70 px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
                Markets
              </dt>
              <dd className="mt-1 text-lg font-medium tabular-nums text-zinc-100">
                {(directory.data?.totalPoolCount ?? pools.length).toLocaleString()}
              </dd>
            </div>
            <div className="bg-black/70 px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">
                Status
              </dt>
              <dd className="mt-1 text-lg font-medium text-zinc-100">
                {!marketConfigured
                  ? 'Pending'
                  : directory.isLoading
                    ? 'Loading'
                    : directory.error
                      ? 'Error'
                      : 'Live'}
              </dd>
            </div>
          </dl>
        </header>

        <section className="py-6" aria-label="ETH funding path">
          <AlfaClubEthFundingRoute />
        </section>

        <section
          className="overflow-hidden rounded-2xl bg-zinc-950/40 ring-1 ring-white/[0.07]"
          aria-label="Available markets"
        >
          <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">
                Available markets
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                {directory.data?.totalPoolCount != null
                  ? `${directory.data.totalPoolCount.toLocaleString()} configured market${
                      directory.data.totalPoolCount === 1 ? '' : 's'
                    }`
                  : 'Official Sudoswap markets'}
              </p>
            </div>
            {marketConfigured && !directory.isLoading && !directory.error && pools.length > 0 ? (
              <label className="relative block sm:w-72">
                <span className="sr-only">Search key markets</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search coin, key ID, or address"
                  className="h-10 w-full rounded-full border border-white/12 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
                />
              </label>
            ) : null}
          </div>

          <div className="p-4 sm:p-5">
            {!marketConfigured ? (
              <div className="flex items-start gap-3 py-2">
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 text-amber-300"
                  aria-hidden
                />
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    Market deployment pending
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Trading stays disabled until the reviewed Base pair,
                    adapter, factory, and curve addresses are configured.
                  </p>
                </div>
              </div>
            ) : directory.isLoading ? (
              <p className="py-6 text-sm text-zinc-500" role="status">
                Loading markets from Base…
              </p>
            ) : directory.error ? (
              <div className="py-4" role="alert">
                <p className="text-sm text-red-300">
                  Unable to load AlfaClub markets.
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  {directory.error instanceof Error
                    ? directory.error.message
                    : 'Onchain read failed'}
                </p>
              </div>
            ) : pools.length === 0 ? (
              <div className="py-4">
                <h3 className="text-sm font-medium text-zinc-100">
                  No markets configured
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  A reviewed official pair must be configured before trading can
                  open.
                </p>
              </div>
            ) : filteredPools.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-600">
                No markets match that search.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredPools.map((pool) => (
                  <PoolCard
                    key={pool.pool}
                    pool={pool}
                    selected={selectedPool?.pool === pool.pool}
                    onTrade={(mode) => selectTrade(pool, mode)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <section className="mx-auto w-full max-w-[1400px] px-3 pt-6 sm:px-6">
        <AlfaClubLpWriteConsole
          selectedPool={selectedPool}
          initialMode={tradeMode}
        />
      </section>
    </PageShell>
  )
}
