import { useMemo, useState } from 'react'
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
import { ALFACLUB_EXPLORE_POOLS_PATH } from '@/lib/alfaclub/hostPaths'
import { cn } from '@/lib/shared/utils'

import { AlfaClubLiquidity } from './AlfaClubLiquidity'

type TradeMode = 'buy' | 'sell'

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

function AlfaClubEthFundingRoute() {
  return (
    <section
      aria-label="ETH funding route"
      data-testid="eth-to-room-route"
      className="mt-6 rounded-3xl bg-sky-500/[0.07] p-4 ring-1 ring-sky-400/20 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            ETH funding path
          </span>
          <h2 className="mt-2 text-base font-semibold text-zinc-100">
            Buy Room 1659 FriendKeys with ETH
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            ETH can route through the Zora and AKITA Creator Coin markets before
            settling into the official Sudoswap ERC-1155 pool.
          </p>
        </div>
        <span className="self-start rounded-full bg-black/25 px-3 py-1.5 text-[10px] font-medium text-sky-200 ring-1 ring-sky-300/20 lg:self-auto">
          Base · Uniswap V4 + Sudoswap v2
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-200">
        {['ETH', 'ZORA', 'AKITA', 'FriendKey #1659'].map(
          (label, index, route) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className="rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/[0.08]">
                {label}
              </span>
              {index < route.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 text-sky-300" aria-hidden />
              ) : null}
            </span>
          ),
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        The route is shown here as the funding path; execution still uses the
        selected market controls below.
      </p>
    </section>
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
        'rounded-2xl p-4 text-left ring-1 transition-colors',
        selected
          ? 'bg-sky-500/10 ring-sky-400/25'
          : 'bg-black/35 ring-white/[0.08]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">
            {pool.creatorCoinName || 'Creator Coin'}
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            {pool.creatorCoinSymbol} / Key #{pool.tokenId.toString()}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-zinc-400 ring-1 ring-white/[0.08]">
            {formatAlfaClubPoolFee(pool.feeBps)} fee
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-1 text-[10px] ring-1',
              pool.configurationReady
                ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/20'
                : 'bg-amber-500/10 text-amber-200 ring-amber-400/20',
            )}
          >
            {pool.configurationReady
              ? 'Official market ready'
              : 'Configuration mismatch'}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-zinc-600">Creator balance</dt>
          <dd className="mt-1 truncate text-zinc-300">
            {formatTokenAmount(
              pool.creatorCoinBalance,
              pool.creatorCoinDecimals,
            )}{' '}
            {pool.creatorCoinSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Key balance</dt>
          <dd className="mt-1 text-zinc-300">
            {pool.keyBalance.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Virtual creator balance</dt>
          <dd className="mt-1 truncate text-zinc-300">
            {formatTokenAmount(pool.spotPrice, pool.creatorCoinDecimals)}{' '}
            {pool.creatorCoinSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Virtual key balance</dt>
          <dd className="mt-1 text-zinc-300">{pool.delta.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Room type</dt>
          <dd className="mt-1 text-zinc-300">{roomTypeLabel(pool.roomType)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Pair</dt>
          <dd className="mt-1 font-mono text-zinc-300">
            {shortAddress(pool.pool)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTrade('buy')}
          disabled={!pool.configurationReady}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          Buy keys
        </button>
        <button
          type="button"
          onClick={() => onTrade('sell')}
          disabled={!pool.configurationReady}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/[0.08] hover:bg-white/[0.1] disabled:text-zinc-600"
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
    return (
      <section className="cinematic-section !pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06]">
            <h2 className="text-sm font-semibold text-zinc-100">
              Market trades require access
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Browse markets freely. Buying or selling FriendKeys needs an
              accepted 4626 session and an execution-ready wallet.
            </p>
            <a
              href={href}
              className="mt-4 inline-flex items-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Sign in to trade
            </a>
          </div>
        </div>
      </section>
    )
  }

  if (!props.selectedPool?.configurationReady) {
    return (
      <section className="cinematic-section !pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06]">
            <ShieldAlert className="mt-0.5 size-5 text-amber-300" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                No execution-ready market
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Trading stays disabled until the official pair and adapter
                binding are configured.
              </p>
            </div>
          </div>
        </div>
      </section>
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
    searchParams.get('side') === 'sell' ? 'sell' : 'buy'

  const selectTrade = (pool: AlfaClubLiquidityPoolSummary, mode: TradeMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    next.set('side', mode)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Room market
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Official Sudoswap Creator Coin / FriendKey market for token ID{' '}
              {roomId}.
            </p>
          </div>
          {marketConfigured ? (
            <button
              type="button"
              onClick={() => directory.refetch()}
              disabled={directory.isFetching}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600"
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

        {!marketConfigured ? (
          <p className="mt-5 text-sm text-amber-300">
            Official market deployment is not configured.
          </p>
        ) : directory.isLoading ? (
          <p className="mt-5 text-sm text-zinc-400" role="status">
            Loading room market from Base…
          </p>
        ) : directory.error ? (
          <p className="mt-5 text-sm text-red-300" role="alert">
            Unable to load the room market.
          </p>
        ) : roomPools.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
            <h3 className="text-sm font-semibold text-zinc-100">
              No configured market for this room
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              The official AlfaClub Sudoswap market is currently assigned to
              Room 1659.
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
        className="scroll-mt-40 rounded-3xl bg-black/25 p-4 ring-1 ring-white/[0.06]"
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
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

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
    searchParams.get('side') === 'sell' ? 'sell' : 'buy'

  const selectTrade = (pool: AlfaClubLiquidityPoolSummary, mode: TradeMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    next.set('side', mode)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <PageMeta
        title="AlfaClub markets"
        description="Browse the official Creator Coin and FriendKey Sudoswap market, then buy or sell through the AlfaClub router on Base."
        canonicalPath={ALFACLUB_EXPLORE_POOLS_PATH}
      />

      <section className="cinematic-section no-divider-top !pb-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="label">AlfaClub</span>
              <h1 className="headline mt-3 text-3xl sm:text-5xl">
                Room markets
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Creator Coin and FriendKey secondary markets on official
                Sudoswap v2 pairs.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Looking for rooms?{' '}
                <Link
                  to="/rooms"
                  className="text-zinc-300 underline-offset-2 hover:underline"
                >
                  Browse trading rooms
                </Link>
              </p>
              <AlfaClubEthFundingRoute />
            </div>
            {marketConfigured ? (
              <button
                type="button"
                onClick={() => directory.refetch()}
                disabled={directory.isFetching}
                className="inline-flex h-9 items-center gap-2 self-start rounded-xl bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600 sm:self-auto"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    directory.isFetching && 'animate-spin',
                  )}
                  aria-hidden
                />
                Refresh markets
              </button>
            ) : null}
          </div>

          <div className="mt-8 rounded-3xl bg-black/35 p-4 ring-1 ring-white/[0.06] sm:p-5">
            {!marketConfigured ? (
              <div className="flex items-start gap-3 py-2">
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 text-amber-300"
                  aria-hidden
                />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Market deployment pending
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Trading stays disabled until the reviewed Base pair,
                    adapter, factory, and curve addresses are configured.
                  </p>
                </div>
              </div>
            ) : directory.isLoading ? (
              <p className="py-4 text-sm text-zinc-400" role="status">
                Loading markets from Base…
              </p>
            ) : directory.error ? (
              <div className="py-3" role="alert">
                <p className="text-sm text-red-300">
                  Unable to load AlfaClub markets.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {directory.error instanceof Error
                    ? directory.error.message
                    : 'Onchain read failed'}
                </p>
              </div>
            ) : pools.length === 0 ? (
              <div className="py-3">
                <h2 className="text-sm font-semibold text-zinc-100">
                  No markets configured
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  A reviewed official pair must be configured before trading can
                  open.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Available markets
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {directory.data?.totalPoolCount.toLocaleString()}{' '}
                      configured market
                      {directory.data?.totalPoolCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <label className="relative block sm:w-72">
                    <span className="sr-only">Search room markets</span>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search coin, key ID, or address"
                      className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40"
                    />
                  </label>
                </div>

                {filteredPools.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    No markets match that search.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              </>
            )}
          </div>
        </div>
      </section>

      <AlfaClubLpWriteConsole
        selectedPool={selectedPool}
        initialMode={tradeMode}
      />
    </div>
  )
}
