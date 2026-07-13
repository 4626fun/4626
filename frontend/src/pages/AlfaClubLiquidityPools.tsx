import { useMemo, useState } from 'react'
import { Droplets, RefreshCw, Search } from 'lucide-react'
import { formatUnits, type Address, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'
import { Link, useSearchParams } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { waitlistEntryHref, useOptionalAccessContext } from '@/app/accessShared'
import { SmartWalletRoute } from '@/app/routeGuards'
import { CONTRACTS } from '@/config/contracts'
import {
  filterAlfaClubLiquidityPools,
  filterAlfaClubLiquidityPoolsByRoomId,
  formatAlfaClubPoolFee,
  useAlfaClubLiquidityPools,
  type AlfaClubLiquidityPoolSummary,
} from '@/hooks/useAlfaClubLiquidityPools'
import { ALFACLUB_POOLS_PATH } from '@/lib/alfaclub/hostPaths'
import { cn } from '@/lib/shared/utils'
import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'

import { AlfaClubLiquidity } from './AlfaClubLiquidity'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatReserve(value: bigint, decimals: number): string {
  const numeric = Number(formatUnits(value, decimals))
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function roomTypeLabel(roomType: number | null): string {
  if (roomType === 0) return 'Trading'
  if (roomType === 1) return 'Social'
  return 'Unknown'
}

export function PoolCard({
  pool,
  selected,
  onSelect,
}: {
  pool: AlfaClubLiquidityPoolSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl p-4 text-left ring-1 transition-colors',
        selected
          ? 'bg-sky-500/15 ring-sky-400/35'
          : 'bg-black/35 ring-white/[0.08] hover:bg-white/[0.05] hover:ring-white/[0.14]',
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
        <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-zinc-400 ring-1 ring-white/[0.08]">
          {formatAlfaClubPoolFee(pool.feeBps)}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-zinc-600">Creator reserve</dt>
          <dd className="mt-1 truncate text-zinc-300">
            {formatReserve(pool.creatorCoinReserve, pool.creatorCoinDecimals)} {pool.creatorCoinSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Key reserve</dt>
          <dd className="mt-1 text-zinc-300">{pool.keyReserve.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Room type</dt>
          <dd className="mt-1 text-zinc-300">{roomTypeLabel(pool.roomType)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Pool</dt>
          <dd className="mt-1 font-mono text-zinc-300">{shortAddress(pool.pool)}</dd>
        </div>
      </dl>
    </button>
  )
}

export function AlfaClubLpWriteConsole(props: {
  selectedPool: AlfaClubLiquidityPoolSummary | null
  initialTokenId?: bigint | null
}) {
  const access = useOptionalAccessContext()

  if (!access || access.loading) {
    return <AppLoadingRegistrar label="alfaclub-lp-write-access" />
  }

  if (!access.sessionValid || !access.accepted) {
    const href = waitlistEntryHref(access.marketingUrl)
    return (
      <section className="cinematic-section !pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06]">
            <h2 className="text-sm font-semibold text-zinc-100">Liquidity writes require access</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Browse pools freely. Creating, adding, buying, selling, or removing liquidity needs an
              accepted 4626 session and an execution-ready wallet.
            </p>
            <a
              href={href}
              className="mt-4 inline-flex items-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Sign in to manage liquidity
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <SmartWalletRoute>
      <AlfaClubLiquidity
        key={props.selectedPool?.pool ?? 'new-pool'}
        initialCreatorCoin={props.selectedPool?.creatorCoin ?? null}
        initialTokenId={props.selectedPool?.tokenId ?? props.initialTokenId ?? null}
        initialMode={props.selectedPool ? 'buy' : 'create'}
        embedded
      />
    </SmartWalletRoute>
  )
}

export function AlfaClubRoomLiquidity({ roomId }: { roomId: string }) {
  const publicClient = usePublicClient({ chainId: base.id })
  const factory = CONTRACTS.alfaCreatorKeyLpFactory as Address
  const factoryReady = factory.toLowerCase() !== ZERO_ADDRESS
  const directory = useAlfaClubLiquidityPools(
    publicClient as unknown as PublicClient | undefined,
    factoryReady ? factory : null,
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const pools = useMemo(() => directory.data?.pools ?? [], [directory.data?.pools])
  const roomPools = useMemo(
    () => filterAlfaClubLiquidityPoolsByRoomId(pools, roomId),
    [pools, roomId],
  )
  const requestedPool = searchParams.get('pool')?.toLowerCase() ?? ''
  const selectedPool = creating
    ? null
    : roomPools.find((pool) => pool.pool.toLowerCase() === requestedPool) ?? roomPools[0] ?? null
  const tokenId = /^\d+$/.test(roomId) ? BigInt(roomId) : null

  const selectPool = (pool: AlfaClubLiquidityPoolSummary) => {
    setCreating(false)
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    setSearchParams(next, { replace: true })
  }

  const startCreating = () => {
    setCreating(true)
    const next = new URLSearchParams(searchParams)
    next.delete('pool')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Room liquidity</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Creator Coin / FriendKey pools for token ID {roomId}.
            </p>
          </div>
          <div className="flex gap-2">
            {factoryReady ? (
              <button
                type="button"
                onClick={() => directory.refetch()}
                disabled={directory.isFetching}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', directory.isFetching && 'animate-spin')} aria-hidden />
                Refresh
              </button>
            ) : null}
            <button
              type="button"
              onClick={startCreating}
              className="inline-flex h-9 items-center rounded-xl bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-400"
            >
              Create pool
            </button>
          </div>
        </div>

        {!factoryReady ? (
          <p className="mt-5 text-sm text-amber-300">Pool factory deployment is not configured.</p>
        ) : directory.isLoading ? (
          <p className="mt-5 text-sm text-zinc-400" role="status">
            Loading room pools from Base…
          </p>
        ) : directory.error ? (
          <p className="mt-5 text-sm text-red-300" role="alert">
            Unable to load liquidity pools.
          </p>
        ) : roomPools.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
            <h3 className="text-sm font-semibold text-zinc-100">No pool for this room yet</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Use the room-seeded create console below to open the first pair.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {roomPools.map((pool) => (
              <PoolCard
                key={pool.pool}
                pool={pool}
                selected={!creating && selectedPool?.pool === pool.pool}
                onSelect={() => selectPool(pool)}
              />
            ))}
          </div>
        )}
      </section>

      <section id="room-liquidity-console" className="scroll-mt-40 rounded-3xl bg-black/25 p-4 ring-1 ring-white/[0.06]">
        <AlfaClubLpWriteConsole selectedPool={selectedPool} initialTokenId={tokenId} />
      </section>
    </div>
  )
}

export function AlfaClubLiquidityPools() {
  const publicClient = usePublicClient({ chainId: base.id })
  const factory = CONTRACTS.alfaCreatorKeyLpFactory as Address
  const factoryReady = factory.toLowerCase() !== ZERO_ADDRESS
  const directory = useAlfaClubLiquidityPools(
    publicClient as unknown as PublicClient | undefined,
    factoryReady ? factory : null,
  )
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const pools = useMemo(() => directory.data?.pools ?? [], [directory.data?.pools])
  const filteredPools = useMemo(() => filterAlfaClubLiquidityPools(pools, search), [pools, search])
  const requestedPool = searchParams.get('pool')?.toLowerCase() ?? ''
  const selectedPool = pools.find((pool) => pool.pool.toLowerCase() === requestedPool) ?? pools[0] ?? null

  const selectPool = (pool: AlfaClubLiquidityPoolSummary) => {
    const next = new URLSearchParams(searchParams)
    next.set('pool', pool.pool)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <PageMeta
        title="AlfaClub Liquidity Pools"
        description="Browse Creator Coin and AlfaClub FriendKey pools, trade keys, or manage liquidity on Base."
        canonicalPath={ALFACLUB_POOLS_PATH}
      />

      <section className="cinematic-section no-divider-top !pb-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="label">AlfaClub</span>
              <h1 className="headline mt-3 text-3xl sm:text-5xl">Liquidity pools</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Creator Coin and FriendKey secondary markets. Swap fees remain in each pool for LP holders.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Looking for rooms?{' '}
                <Link to="/rooms" className="text-zinc-300 underline-offset-2 hover:underline">
                  Browse trading rooms
                </Link>
              </p>
            </div>
            {factoryReady ? (
              <button
                type="button"
                onClick={() => directory.refetch()}
                disabled={directory.isFetching}
                className="inline-flex h-9 items-center gap-2 self-start rounded-xl bg-white/[0.04] px-3 text-xs text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] disabled:text-zinc-600 sm:self-auto"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', directory.isFetching && 'animate-spin')} aria-hidden />
                Refresh pools
              </button>
            ) : null}
          </div>

          <div className="mt-8 rounded-3xl bg-black/35 p-4 ring-1 ring-white/[0.06] sm:p-5">
            {!factoryReady ? (
              <div className="flex items-start gap-3 py-2">
                <Droplets className="mt-0.5 h-5 w-5 text-amber-300" aria-hidden />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Factory deployment pending</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Pool contracts and the management console are ready, but no Base factory address is configured yet.
                  </p>
                </div>
              </div>
            ) : directory.isLoading ? (
              <p className="py-4 text-sm text-zinc-400" role="status">
                Loading pools from Base…
              </p>
            ) : directory.error ? (
              <div className="py-3" role="alert">
                <p className="text-sm text-red-300">Unable to load AlfaClub liquidity pools.</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {directory.error instanceof Error ? directory.error.message : 'Onchain read failed'}
                </p>
              </div>
            ) : pools.length === 0 ? (
              <div className="py-3">
                <h2 className="text-sm font-semibold text-zinc-100">No pools created yet</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  An allowlisted creator can use the create form below to seed the first pair.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">Available pools</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {directory.data?.totalPoolCount.toLocaleString()} onchain pool
                      {directory.data?.totalPoolCount === 1 ? '' : 's'}
                      {directory.data?.isTruncated ? ' · showing first 100' : ''}
                    </p>
                  </div>
                  <label className="relative block sm:w-72">
                    <span className="sr-only">Search liquidity pools</span>
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
                  <p className="py-8 text-center text-sm text-zinc-500">No pools match that search.</p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredPools.map((pool) => (
                      <PoolCard
                        key={pool.pool}
                        pool={pool}
                        selected={selectedPool?.pool === pool.pool}
                        onSelect={() => selectPool(pool)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <AlfaClubLpWriteConsole selectedPool={selectedPool} />
    </div>
  )
}
