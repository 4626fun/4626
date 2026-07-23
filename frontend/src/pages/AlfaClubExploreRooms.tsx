import { ArrowRight, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { APP_ORIGIN } from '@/lib/env/host'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import type { AlfaRoomTier } from '@/lib/alfaclub/keyDefense'
import {
  type AlfaClubRoomDirectoryItem,
  type AlfaClubRoomSort,
  formatRoomPct,
  formatRoomUsd,
  formatRoomUsdCompact,
  pnlToneClassName,
  roomCurveTierRingClassName,
  sortAlfaClubRooms,
} from '@/lib/alfaclub/roomDirectory'
import { alfaclubRoomPrimaryTitle } from '@/lib/alfaclub/roomLabel'
import {
  ALFACLUB_EXPLORE_POOLS_PATH,
  ALFACLUB_KEYS_PATH,
} from '@/lib/alfaclub/hostPaths'
import { ALFACLUB_EXECUTABLE_KEY_ID } from '@/lib/swap/alfaclubRoomTokens'
import { cn } from '@/lib/shared/utils'

type RoomTypeFilter = 'all' | AlfaClubRoomDirectoryItem['roomType']
type RoomTierFilter = 'all' | AlfaRoomTier

export type AlfaClubExploreRoomFilters = {
  query: string
  roomType: RoomTypeFilter
  tier: RoomTierFilter
  sort: AlfaClubRoomSort
}

const ROOM_TYPE_OPTIONS: Array<{ value: RoomTypeFilter; label: string }> = [
  { value: 'all', label: 'All room types' },
  { value: 'trading', label: 'Trading rooms' },
  { value: 'social', label: 'Social rooms' },
]

const ROOM_TIER_OPTIONS: Array<{ value: RoomTierFilter; label: string }> = [
  { value: 'all', label: 'All curve tiers' },
  { value: 'casual', label: 'Casual' },
  { value: 'club', label: 'Club' },
  { value: 'exclusive', label: 'Exclusive' },
]

const ROOM_SORT_OPTIONS: Array<{ value: AlfaClubRoomSort; label: string }> = [
  { value: 'volume', label: 'Volume' },
  { value: 'pnl', label: 'PnL (all-time)' },
  { value: 'keys', label: 'Key supply' },
]

const ROOM_PAGE_SIZE = 50

export function filterAlfaClubExploreRooms(
  rooms: readonly AlfaClubRoomDirectoryItem[],
  filters: AlfaClubExploreRoomFilters,
): AlfaClubRoomDirectoryItem[] {
  const query = filters.query.trim().toLowerCase()
  const filtered = rooms.filter((room) => {
    if (filters.roomType !== 'all' && room.roomType !== filters.roomType) return false
    if (filters.tier !== 'all' && room.tier !== filters.tier) return false
    if (!query) return true
    return [room.roomId, room.roomName, room.displayLabel, room.creatorHandle, room.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
  return sortAlfaClubRooms(filtered, filters.sort)
}

async function fetchRooms(signal: AbortSignal): Promise<AlfaClubRoomDirectoryItem[]> {
  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.tradingRooms}?limit=2500`, {
    method: 'GET',
    signal,
  })
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: { rows?: AlfaClubRoomDirectoryItem[] }
    error?: string
  } | null
  if (!response.ok || !payload?.success || !Array.isArray(payload.data?.rows)) {
    throw new Error(payload?.error ?? `alfaclub_rooms_failed_${response.status}`)
  }
  return payload.data.rows
}

function normalizeRoomType(value: string | null): RoomTypeFilter {
  return value === 'trading' || value === 'social' ? value : 'all'
}

function normalizeRoomTier(value: string | null): RoomTierFilter {
  return value === 'casual' || value === 'club' || value === 'exclusive' ? value : 'all'
}

function normalizeRoomSort(value: string | null): AlfaClubRoomSort {
  if (value === 'keys' || value === 'pnl' || value === 'volume') return value
  if (value === 'points' || value === 'updated') return 'volume'
  return 'volume'
}

export function AlfaClubExploreRooms() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rooms, setRooms] = useState<AlfaClubRoomDirectoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [visibleLimit, setVisibleLimit] = useState(ROOM_PAGE_SIZE)
  const filters = useMemo<AlfaClubExploreRoomFilters>(
    () => ({
      query: searchParams.get('q') ?? '',
      roomType: normalizeRoomType(searchParams.get('type')),
      tier: normalizeRoomTier(searchParams.get('tier')),
      sort: normalizeRoomSort(searchParams.get('sort')),
    }),
    [searchParams],
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchRooms(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setRooms(rows)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Unable to load AlfaClub rooms.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const visibleRooms = useMemo(
    () => filterAlfaClubExploreRooms(rooms, filters),
    [filters, rooms],
  )
  const displayedRooms = visibleRooms.slice(0, visibleLimit)
  const tradingCount = rooms.filter((room) => room.roomType === 'trading').length
  const socialCount = rooms.filter((room) => room.roomType === 'social').length

  const updateFilter = (key: 'q' | 'type' | 'tier' | 'sort', value: string) => {
    setVisibleLimit(ROOM_PAGE_SIZE)
    const next = new URLSearchParams(searchParams)
    const defaultValue =
      (key === 'q' && value === '') ||
      (key === 'type' && value === 'all') ||
      (key === 'tier' && value === 'all') ||
      (key === 'sort' && (value === 'volume' || value === 'points'))
    if (defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="relative min-h-[70vh] pb-20">
      <PageMeta
        title="Explore AlfaClub Keys"
        description="Search and compare AlfaClub keys by volume, key quote, fund PnL, and bonding-curve tier."
        canonicalPath="/explore/keys"
        canonicalOrigin={APP_ORIGIN}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_82%_15%,rgba(217,70,239,0.08),transparent_30%)]"
      />

      <main className="mx-auto w-full max-w-[1400px] px-3 pt-6 sm:px-6 sm:pt-10">
        <header className="border-b border-white/[0.06] pb-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-300/90">
            AlfaClub
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">
            Explore keys
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
            Browse AlfaClub keys by price, volume, fund size, and PnL. Secondary FriendKey trading for the official market settles in-app on Sudoswap.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to={ALFACLUB_EXPLORE_POOLS_PATH}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-sky-500 px-4 text-xs font-semibold text-white transition hover:bg-sky-400"
            >
              Browse key markets
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <Link
              to={`${ALFACLUB_KEYS_PATH}?keyId=${ALFACLUB_EXECUTABLE_KEY_ID.toString()}&tab=liquidity`}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-xs font-medium text-zinc-200 ring-1 ring-white/[0.1] transition hover:bg-white/[0.1]"
            >
              Trade Key #{ALFACLUB_EXECUTABLE_KEY_ID.toString()} market
            </Link>
          </div>
          <dl className="mt-6 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08]">
            <Metric label="All keys" value={rooms.length} />
            <Metric label="Trading" value={tradingCount} />
            <Metric label="Social" value={socialCount} />
          </dl>
        </header>

        <section className="py-6" aria-label="Room directory controls">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={filters.query}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="Search keys, creators, or key ID"
                aria-label="Search AlfaClub keys"
                className="h-10 w-full rounded-full border border-white/12 bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide lg:pb-0">
              <SlidersHorizontal className="size-4 shrink-0 text-zinc-600" aria-hidden />
              <RoomSelect
                label="Room type"
                value={filters.roomType}
                options={ROOM_TYPE_OPTIONS}
                onChange={(value) => updateFilter('type', value)}
              />
              <RoomSelect
                label="Curve tier"
                value={filters.tier}
                options={ROOM_TIER_OPTIONS}
                onChange={(value) => updateFilter('tier', value)}
              />
              <RoomSelect
                label="Sort rooms"
                value={filters.sort}
                options={ROOM_SORT_OPTIONS}
                onChange={(value) => updateFilter('sort', value)}
              />
            </div>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-2xl bg-zinc-950/40 ring-1 ring-white/[0.07]"
          aria-label="AlfaClub room results"
        >
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[minmax(260px,2.2fr)_minmax(128px,1fr)_minmax(96px,0.85fr)_minmax(96px,0.85fr)_minmax(132px,1.1fr)_72px] items-center gap-x-4 border-b border-white/[0.06] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:px-5">
                <span>Room</span>
                <span className="text-right">Price</span>
                <span className="text-right">Volume</span>
                <span className="text-right">Fund</span>
                <span className="text-right">PnL</span>
                <span className="text-right">Keys</span>
              </div>

              {loading ? (
                <div className="divide-y divide-white/[0.04]">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="h-[72px] animate-pulse bg-white/[0.015]" />
                  ))}
                </div>
              ) : error ? (
                <DirectoryMessage title="Rooms could not be loaded" detail={error}>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true)
                      setError(null)
                      setReloadKey((value) => value + 1)
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-200 ring-1 ring-white/[0.1] hover:bg-white/[0.1]"
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Retry
                  </button>
                </DirectoryMessage>
              ) : visibleRooms.length === 0 ? (
                <DirectoryMessage
                  title="No rooms match these filters"
                  detail="Try a broader name, room type, or curve tier."
                />
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {displayedRooms.map((room) => (
                    <RoomRow key={room.roomId} room={room} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {!loading && !error ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="text-center text-xs text-zinc-600">
              Showing {displayedRooms.length.toLocaleString()} of{' '}
              {visibleRooms.length.toLocaleString()} matching rooms
            </p>
            {displayedRooms.length < visibleRooms.length ? (
              <button
                type="button"
                onClick={() => setVisibleLimit((value) => value + ROOM_PAGE_SIZE)}
                className="rounded-full bg-white/[0.05] px-5 py-2 text-xs font-medium text-zinc-300 ring-1 ring-white/[0.1] transition hover:bg-white/[0.09] hover:text-white"
              >
                Load more rooms
              </button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/70 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums text-zinc-100">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

function RoomSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-9 shrink-0 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs text-zinc-300 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function RoomMetaChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'trading' | 'social' | 'featured'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize tracking-wide',
        tone === 'trading' && 'bg-cyan-400/10 text-cyan-200/90',
        tone === 'social' && 'bg-fuchsia-400/10 text-fuchsia-200/90',
        tone === 'featured' && 'bg-sky-400/10 text-sky-300',
        tone === 'neutral' && 'bg-white/[0.04] text-zinc-400',
      )}
    >
      {children}
    </span>
  )
}

function RoomRow({ room }: { room: AlfaClubRoomDirectoryItem }) {
  const title = alfaclubRoomPrimaryTitle(room)
  const handle = room.creatorHandle?.trim().replace(/^@+/, '')
  const tierRing = roomCurveTierRingClassName(room)
  const typeTone = room.roomType === 'social' ? 'social' : 'trading'
  const typeLabel = room.roomType === 'social' ? 'Social' : 'Trading'
  const isOfficialMarket = room.roomId === ALFACLUB_EXECUTABLE_KEY_ID.toString()
  const href = isOfficialMarket
    ? `${ALFACLUB_KEYS_PATH}?keyId=${encodeURIComponent(room.roomId)}&tab=liquidity`
    : `${ALFACLUB_KEYS_PATH}?keyId=${encodeURIComponent(room.roomId)}`

  return (
    <Link
      to={href}
      className="group grid grid-cols-[minmax(260px,2.2fr)_minmax(128px,1fr)_minmax(96px,0.85fr)_minmax(96px,0.85fr)_minmax(132px,1.1fr)_72px] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {room.imageUrl ? (
          <img
            src={room.imageUrl}
            alt=""
            className={cn(
              'size-10 shrink-0 rounded-full object-cover ring-1 ring-white/[0.1]',
              tierRing && 'ring-2 ring-offset-2 ring-offset-zinc-950',
              tierRing,
            )}
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-sm font-semibold text-zinc-500 ring-1 ring-white/[0.08]">
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-medium tracking-tight text-zinc-50 group-hover:text-white">
              {title}
            </span>
            {room.featured ? <RoomMetaChip tone="featured">Featured</RoomMetaChip> : null}
            {isOfficialMarket ? <RoomMetaChip tone="featured">Official market</RoomMetaChip> : null}
          </span>
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] tabular-nums text-zinc-600">#{room.roomId}</span>
            {handle ? (
              <span className="truncate text-[11px] text-zinc-500">@{handle}</span>
            ) : null}
            <RoomMetaChip tone={typeTone}>{typeLabel}</RoomMetaChip>
            {room.tier ? <RoomMetaChip>{room.tier}</RoomMetaChip> : null}
          </span>
        </span>
      </div>

      <span className="min-w-0 text-right">
        <span className="block truncate text-sm font-medium tabular-nums text-zinc-50">
          {formatRoomUsd(room.keyPriceUsdc)}
        </span>
        <span className="mt-1 block truncate font-mono text-[10px] tabular-nums text-zinc-500">
          ↑{formatRoomUsdCompact(room.buyPriceUsdc)}
          <span className="mx-1 text-zinc-700">·</span>
          ↓{formatRoomUsdCompact(room.sellPriceUsdc)}
        </span>
      </span>

      <span className="truncate text-right text-sm tabular-nums text-zinc-200">
        {formatRoomUsd(room.volumeUsdc)}
      </span>

      <span className="truncate text-right text-sm tabular-nums text-zinc-200">
        {formatRoomUsd(room.tradingFundUsdc)}
      </span>

      <span className="min-w-0 text-right">
        <span
          className={cn(
            'block truncate text-sm font-medium tabular-nums',
            pnlToneClassName(room.pnlUsdc),
          )}
        >
          {formatRoomUsd(room.pnlUsdc)}
          <span className="ml-1.5 text-[11px] font-normal opacity-90">
            {formatRoomPct(room.pnlPctAllTime)}
          </span>
        </span>
        <span className="mt-1 block truncate font-mono text-[10px] tabular-nums text-zinc-600">
          7D {formatRoomPct(room.pnlPct7d)}
          <span className="mx-1 text-zinc-700">·</span>
          30D {formatRoomPct(room.pnlPct30d)}
        </span>
      </span>

      <span className="flex items-center justify-end gap-1.5 text-sm tabular-nums text-zinc-300">
        {room.keySupply?.toLocaleString() ?? '—'}
        <ArrowRight
          className="size-3.5 shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
          aria-hidden
        />
      </span>
    </Link>
  )
}

function DirectoryMessage({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children?: ReactNode
}) {
  return (
    <div className="px-6 py-16 text-center">
      <h2 className="text-base font-medium text-zinc-200">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500">{detail}</p>
      {children}
    </div>
  )
}
