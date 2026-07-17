import { ArrowRight, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import type { AlfaRoomTier } from '@/lib/alfaclub/keyDefense'
import {
  type AlfaClubRoomDirectoryItem,
  type AlfaClubRoomSort,
  formatRoomKeyQuote,
  formatRoomPct,
  formatRoomType,
  formatRoomUsd,
  pnlToneClassName,
  roomCurveTierRingClassName,
  sortAlfaClubRooms,
} from '@/lib/alfaclub/roomDirectory'
import { alfaclubRoomPrimaryTitle } from '@/lib/alfaclub/roomLabel'
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
        title="Explore AlfaClub Rooms"
        description="Search and compare AlfaClub Trading and Social Rooms by volume, key quote, fund PnL, and bonding-curve tier."
        canonicalPath="/explore/rooms"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_82%_15%,rgba(217,70,239,0.08),transparent_30%)]"
      />

      <main className="mx-auto w-full max-w-[1400px] px-3 pt-6 sm:px-6 sm:pt-10">
        <header className="border-b border-white/[0.08] pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">
            AlfaClub Explore
          </p>
          <h1 className="mt-3 text-3xl font-medium text-white sm:text-4xl">Explore rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Compare Trading and Social Rooms, then open the room workspace for chat,
            ownership, liquidity, safety, and live activity.
          </p>
          <dl className="mt-6 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08]">
            <Metric label="All rooms" value={rooms.length} />
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
                placeholder="Search rooms, creators, or room ID"
                aria-label="Search AlfaClub rooms"
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

        <section className="overflow-hidden rounded-2xl bg-black/30 ring-1 ring-white/[0.08]" aria-label="AlfaClub room results">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[minmax(260px,1.5fr)_90px_70px_210px_100px_100px_140px_60px] border-b border-white/[0.08] bg-zinc-950/90 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-600">
                <span>Room</span>
                <span className="text-center">Type</span>
                <span className="text-center">Tier</span>
                <span className="text-right">Key price</span>
                <span className="text-right">Volume</span>
                <span className="text-right">Trading fund</span>
                <span className="text-right">PnL</span>
                <span className="text-right">Keys</span>
              </div>

              {loading ? (
                <div className="divide-y divide-white/[0.05]">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="h-[68px] animate-pulse bg-white/[0.015]" />
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
                <div className="divide-y divide-white/[0.05]">
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

function RoomRow({ room }: { room: AlfaClubRoomDirectoryItem }) {
  const title = alfaclubRoomPrimaryTitle(room)
  const handle = room.creatorHandle?.trim().replace(/^@+/, '')
  const tierRing = roomCurveTierRingClassName(room)
  return (
    <Link
      to={`/rooms?roomId=${encodeURIComponent(room.roomId)}`}
      className="group grid grid-cols-[minmax(260px,1.5fr)_90px_70px_210px_100px_100px_140px_60px] items-center px-3 py-2.5 text-xs transition hover:bg-white/[0.035]"
    >
      <div className="flex min-w-0 items-center gap-3 pr-4">
        {room.imageUrl ? (
          <img
            src={room.imageUrl}
            alt=""
            className={cn(
              'size-11 shrink-0 rounded-xl object-cover ring-1 ring-white/[0.08]',
              tierRing && 'ring-2 ring-offset-1 ring-offset-black',
              tierRing,
            )}
          />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-sm font-semibold text-zinc-500 ring-1 ring-white/[0.08]">
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-100 group-hover:text-white">
            {title}
          </span>
          <span className="mt-1 block truncate font-mono text-[10px] text-zinc-600">
            #{room.roomId}{handle ? ` · @${handle}` : ''}
          </span>
        </span>
        {room.featured ? (
          <span className="shrink-0 rounded-full bg-sky-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sky-300">
            Featured
          </span>
        ) : null}
      </div>
      <span className="text-center text-zinc-300">{formatRoomType(room.roomType)}</span>
      <span className="text-center capitalize text-zinc-400">{room.tier ?? '—'}</span>
      <span className="truncate text-right font-medium tabular-nums text-zinc-100">
        {formatRoomKeyQuote({
          midUsdc: room.keyPriceUsdc,
          buyUsdc: room.buyPriceUsdc,
          sellUsdc: room.sellPriceUsdc,
        })}
      </span>
      <span className="text-right tabular-nums text-zinc-200">
        {formatRoomUsd(room.volumeUsdc)}
      </span>
      <span className="text-right tabular-nums text-zinc-200">
        {formatRoomUsd(room.tradingFundUsdc)}
      </span>
      <span className="text-right">
        <span className={cn('block whitespace-nowrap font-medium tabular-nums', pnlToneClassName(room.pnlUsdc))}>
          {formatRoomUsd(room.pnlUsdc)}
          <span className="ml-1 text-[10px]">{formatRoomPct(room.pnlPctAllTime)}</span>
        </span>
        <span className="mt-0.5 block whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">
          7D {formatRoomPct(room.pnlPct7d)} · 30D {formatRoomPct(room.pnlPct30d)}
        </span>
      </span>
      <span className="flex items-center justify-end gap-2 text-right tabular-nums text-zinc-300">
        {room.keySupply?.toLocaleString() ?? '—'}
        <ArrowRight className="size-3.5 shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" aria-hidden />
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

