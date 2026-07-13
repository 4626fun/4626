import { useVirtualizer } from '@tanstack/react-virtual'
import { Clock3, KeyRound, Search, Star, Users } from 'lucide-react'
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { AlfaRoomTier } from '@/lib/alfaclub/keyDefense'
import {
  type AlfaClubRoomDirectoryItem,
  type AlfaClubRoomSort,
  type AlfaClubRoomTierFilter,
  type AlfaClubRoomTypeFilter,
  formatRoomPoints,
  sortAlfaClubRooms,
} from '@/lib/alfaclub/roomDirectory'
import { cn } from '@/lib/shared/utils'

type DiscoveryEntry =
  | { kind: 'section'; id: string; label: string; icon: 'my' | 'recent' | 'featured' | 'type' }
  | { kind: 'room'; id: string; room: AlfaClubRoomDirectoryItem }

export type RoomDiscoveryFilters = {
  search: string
  roomType: AlfaClubRoomTypeFilter
  tier: AlfaClubRoomTierFilter
  sort: AlfaClubRoomSort
}

type RoomDiscoveryTrayProps = {
  rooms: AlfaClubRoomDirectoryItem[]
  filters: RoomDiscoveryFilters
  onFiltersChange: (filters: RoomDiscoveryFilters) => void
  recentRoomIds: string[]
  myRoomIds: string[]
  myRoomsLoading?: boolean
  selectedRoomId: string
  loading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (roomId: string) => void
  className?: string
}

const DEFAULT_FILTERS: RoomDiscoveryFilters = {
  search: '',
  roomType: 'all',
  tier: 'all',
  sort: 'points',
}

const TIER_OPTIONS: Array<{ id: AlfaClubRoomTierFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'casual', label: 'Casual' },
  { id: 'club', label: 'Club' },
  { id: 'exclusive', label: 'Exclusive' },
]

const TYPE_OPTIONS: Array<{ id: AlfaClubRoomTypeFilter; label: string }> = [
  { id: 'all', label: 'All rooms' },
  { id: 'trading', label: 'Trading' },
  { id: 'social', label: 'Social' },
]

const SORT_OPTIONS: Array<{ id: AlfaClubRoomSort; label: string }> = [
  { id: 'points', label: 'Points' },
  { id: 'keys', label: 'Keys' },
  { id: 'updated', label: 'Recent' },
]

const TRAY_SCROLL_STORAGE_KEY = 'alfaclub:room-tray-scroll:v1'
const SECTION_ROW_HEIGHT = 32
const ROOM_ROW_HEIGHT = 64
const INITIAL_FALLBACK_ROW_COUNT = 16

function readStoredTrayScrollOffset(): number {
  if (typeof window === 'undefined') return 0
  const offset = Number(window.sessionStorage.getItem(TRAY_SCROLL_STORAGE_KEY))
  return Number.isFinite(offset) && offset > 0 ? offset : 0
}

function estimatedEntrySize(entry: DiscoveryEntry | undefined): number {
  return entry?.kind === 'section' ? SECTION_ROW_HEIGHT : ROOM_ROW_HEIGHT
}

export function createRoomDiscoveryEntries({
  rooms,
  filters,
  recentRoomIds,
  myRoomIds,
}: {
  rooms: readonly AlfaClubRoomDirectoryItem[]
  filters: RoomDiscoveryFilters
  recentRoomIds: readonly string[]
  myRoomIds: readonly string[]
}): DiscoveryEntry[] {
  const query = filters.search.trim().toLowerCase()
  const filtered = sortAlfaClubRooms(
    rooms.filter((room) => {
      if (filters.roomType !== 'all' && room.roomType !== filters.roomType) return false
      if (filters.tier !== 'all' && room.tier !== filters.tier) return false
      if (!query) return true
      return (
        room.displayLabel.toLowerCase().includes(query) ||
        room.roomName.toLowerCase().includes(query) ||
        (room.creatorHandle ?? '').toLowerCase().includes(query) ||
        room.roomId.includes(query)
      )
    }),
    filters.sort,
  )
  const byId = new Map(filtered.map((room) => [room.roomId, room]))
  const claimed = new Set<string>()
  const entries: DiscoveryEntry[] = []

  const appendRooms = (
    id: string,
    label: string,
    icon: Extract<DiscoveryEntry, { kind: 'section' }>['icon'],
    sectionRooms: readonly AlfaClubRoomDirectoryItem[],
  ) => {
    const unique = sectionRooms.filter((room) => !claimed.has(room.roomId))
    if (unique.length === 0) return
    entries.push({ kind: 'section', id, label, icon })
    for (const room of unique) {
      claimed.add(room.roomId)
      entries.push({ kind: 'room', id: `${id}:${room.roomId}`, room })
    }
  }

  appendRooms(
    'my',
    'My Rooms',
    'my',
    myRoomIds.map((id) => byId.get(id)).filter(isRoom),
  )
  appendRooms(
    'recent',
    'Recent',
    'recent',
    recentRoomIds.map((id) => byId.get(id)).filter(isRoom),
  )
  appendRooms(
    'featured',
    'Featured',
    'featured',
    filtered.filter((room) => room.featured),
  )
  if (query) {
    appendRooms('matches', 'Matches', 'type', filtered)
  } else if (filters.roomType !== 'all') {
    appendRooms('results', 'Results', 'type', filtered)
  } else {
    appendRooms(
      'trading',
      'Trading Rooms',
      'type',
      filtered.filter((room) => room.roomType === 'trading'),
    )
    appendRooms(
      'social',
      'Social Rooms',
      'type',
      filtered.filter((room) => room.roomType === 'social'),
    )
  }

  return entries
}

function isRoom(
  room: AlfaClubRoomDirectoryItem | undefined,
): room is AlfaClubRoomDirectoryItem {
  return room !== undefined
}

export function RoomDiscoveryTray({
  rooms,
  filters,
  onFiltersChange,
  recentRoomIds,
  myRoomIds,
  myRoomsLoading = false,
  selectedRoomId,
  loading,
  error,
  onRetry,
  onSelect,
  className,
}: RoomDiscoveryTrayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const initialScrollOffsetRef = useRef(readStoredTrayScrollOffset())
  const skipInitialSelectionScrollRef = useRef(initialScrollOffsetRef.current > 0)
  const entries = useMemo(
    () => createRoomDiscoveryEntries({ rooms, filters, recentRoomIds, myRoomIds }),
    [filters, myRoomIds, recentRoomIds, rooms],
  )
  const roomEntryIndexes = useMemo(
    () =>
      entries.flatMap((entry, index) => (entry.kind === 'room' ? [index] : [])),
    [entries],
  )
  const visibleRoomCount = roomEntryIndexes.length
  // TanStack Virtual intentionally exposes an imperative instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimatedEntrySize(entries[index]),
    overscan: 8,
    initialRect: { width: 288, height: 640 },
    initialOffset: initialScrollOffsetRef.current,
  })
  const effectiveActiveRoomId =
    activeRoomId ??
    (entries.some(
      (entry) => entry.kind === 'room' && entry.room.roomId === selectedRoomId,
    )
      ? selectedRoomId
      : entries.find((entry) => entry.kind === 'room')?.room.roomId ?? null)

  useEffect(() => {
    if (skipInitialSelectionScrollRef.current) {
      skipInitialSelectionScrollRef.current = false
      return
    }
    const selectedEntryIndex = entries.findIndex(
      (entry) => entry.kind === 'room' && entry.room.roomId === selectedRoomId,
    )
    const selectedRoomIndex = roomEntryIndexes.indexOf(selectedEntryIndex)
    if (selectedRoomIndex >= 0) {
      setActiveRoomId(selectedRoomId)
      virtualizer.scrollToIndex(selectedEntryIndex, { align: 'auto' })
    }
  }, [entries, roomEntryIndexes, selectedRoomId, virtualizer])

  const focusRoom = (roomIndex: number) => {
    if (roomEntryIndexes.length === 0) return
    const wrapped = (roomIndex + roomEntryIndexes.length) % roomEntryIndexes.length
    const entryIndex = roomEntryIndexes[wrapped]!
    const entry = entries[entryIndex]
    if (entry?.kind === 'room') setActiveRoomId(entry.room.roomId)
    virtualizer.scrollToIndex(entryIndex, { align: 'auto' })
  }

  const handleRoomKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const activeEntryIndex = entries.findIndex(
      (entry) => entry.kind === 'room' && entry.room.roomId === effectiveActiveRoomId,
    )
    const activeRoomIndex = Math.max(0, roomEntryIndexes.indexOf(activeEntryIndex))
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRoom(activeRoomIndex + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRoom(activeRoomIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        focusRoom(0)
        break
      case 'End':
        event.preventDefault()
        focusRoom(roomEntryIndexes.length - 1)
        break
      case 'Enter':
      case ' ':
        if (!effectiveActiveRoomId) break
        event.preventDefault()
        onSelect(effectiveActiveRoomId)
        break
      default:
        break
    }
  }
  const measuredRows = virtualizer.getVirtualItems()
  let fallbackOffset = 0
  const fallbackRows = entries.slice(0, INITIAL_FALLBACK_ROW_COUNT).map((entry, index) => {
    const row = { index, start: fallbackOffset }
    fallbackOffset += estimatedEntrySize(entry)
    return row
  })
  const rowsToRender = measuredRows.length > 0 ? measuredRows : fallbackRows
  const estimatedTotalSize = entries.reduce(
    (total, entry) => total + estimatedEntrySize(entry),
    0,
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <DiscoveryHeader
        totalCount={rooms.length}
        visibleCount={visibleRoomCount}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
      {loading ? <RoomSkeletons /> : null}
      {error ? (
        <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200" role="alert">
          <p>Rooms could not be loaded.</p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-amber-300 px-2.5 py-1.5 font-semibold text-black"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <div className="border-y border-white/[0.07] px-1 py-5 text-xs text-zinc-400">
          <p>No rooms match this terminal view.</p>
          <button
            type="button"
            className="mt-2 font-semibold text-sky-300 underline decoration-sky-400/40 underline-offset-4"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          >
            Clear filters
          </button>
        </div>
      ) : null}
      {!loading && !error && entries.length > 0 ? (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
          role="listbox"
          aria-label="AlfaClub rooms"
          aria-activedescendant={
            effectiveActiveRoomId ? `alfaclub-room-option-${effectiveActiveRoomId}` : undefined
          }
          tabIndex={0}
          onKeyDown={handleRoomKeyDown}
          onScroll={(event) => {
            if (typeof window === 'undefined') return
            window.sessionStorage.setItem(
              TRAY_SCROLL_STORAGE_KEY,
              String(event.currentTarget.scrollTop),
            )
          }}
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize() || estimatedTotalSize}px` }}
          >
            {rowsToRender.map((virtualRow) => {
              const entry = entries[virtualRow.index]
              if (!entry) return null
              return (
                <div
                  key={entry.id}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                >
                  {entry.kind === 'section' ? (
                    <SectionHeader entry={entry} />
                  ) : (
                    <RoomRow
                      room={entry.room}
                      selected={entry.room.roomId === selectedRoomId}
                      active={entry.room.roomId === effectiveActiveRoomId}
                      entryIndex={virtualRow.index}
                      onFocus={() => setActiveRoomId(entry.room.roomId)}
                      onSelect={onSelect}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {myRoomsLoading ? (
        <p className="pt-2 text-[10px] text-zinc-500" role="status">
          Checking your keyholdings…
        </p>
      ) : null}
      {!loading && !myRoomsLoading && myRoomIds.length === 0 ? (
        <p className="border-t border-white/[0.06] pt-2 font-mono text-[10px] text-zinc-500">
          Hold a room key to pin it in My Rooms.
        </p>
      ) : null}
      <Freshness rooms={rooms} />
    </div>
  )
}

function DiscoveryHeader({
  totalCount,
  visibleCount,
  filters,
  onFiltersChange,
}: {
  totalCount: number
  visibleCount: number
  filters: RoomDiscoveryFilters
  onFiltersChange: (filters: RoomDiscoveryFilters) => void
}) {
  const activeFilterLabel = describeActiveFilters(filters)
  const hasActiveFilters = activeFilterLabel.length > 0
  return (
    <div className="shrink-0">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">AlfaClub</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Discover rooms</h2>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">
          {visibleCount.toLocaleString()} / {totalCount.toLocaleString()}
        </span>
      </div>
      <label className="relative mt-3 block">
        <span className="sr-only">Search AlfaClub rooms</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search name, creator, or ID…"
          className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40"
        />
      </label>
      <div className="mt-3 flex gap-1" aria-label="Room type">
        {TYPE_OPTIONS.map((option) => (
          <FilterButton
            key={option.id}
            active={filters.roomType === option.id}
            onClick={() => onFiltersChange({ ...filters, roomType: option.id })}
          >
            {option.label}
          </FilterButton>
        ))}
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label="Bonding curve tier">
        {TIER_OPTIONS.map((option) => (
          <FilterButton
            key={option.id}
            active={filters.tier === option.id}
            onClick={() => onFiltersChange({ ...filters, tier: option.id })}
          >
            {option.label}
          </FilterButton>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2" aria-label="Sort rooms">
        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Sort</span>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((option) => (
            <FilterButton
              key={option.id}
              active={filters.sort === option.id}
              onClick={() => onFiltersChange({ ...filters, sort: option.id })}
            >
              {option.label}
            </FilterButton>
          ))}
        </div>
      </div>
      <div className="mb-3 mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
        <span className="truncate font-mono text-[10px] text-zinc-500" aria-live="polite">
          {hasActiveFilters ? activeFilterLabel : 'All room signals'}
        </span>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="shrink-0 text-[10px] font-semibold text-sky-300 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}

function describeActiveFilters(filters: RoomDiscoveryFilters): string {
  const labels: string[] = []
  const query = filters.search.trim()
  if (query) labels.push(`“${query}”`)
  if (filters.roomType !== 'all') labels.push(filters.roomType)
  if (filters.tier !== 'all') labels.push(filters.tier)
  return labels.join(' · ')
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-md px-2 py-1 font-mono text-[10px] transition-colors',
        active
          ? 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/25'
          : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200',
      )}
    >
      {children}
    </button>
  )
}

function SectionHeader({ entry }: { entry: Extract<DiscoveryEntry, { kind: 'section' }> }) {
  const Icon =
    entry.icon === 'my'
      ? KeyRound
      : entry.icon === 'recent'
        ? Clock3
        : entry.icon === 'featured'
          ? Star
          : Users
  return (
    <div className="flex h-8 items-center gap-2 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
      <Icon className="size-3" aria-hidden />
      {entry.label}
    </div>
  )
}

function RoomRow({
  room,
  selected,
  active,
  entryIndex,
  onFocus,
  onSelect,
}: {
  room: AlfaClubRoomDirectoryItem
  selected: boolean
  active: boolean
  entryIndex: number
  onFocus: () => void
  onSelect: (roomId: string) => void
}) {
  return (
    <button
      type="button"
      id={`alfaclub-room-option-${room.roomId}`}
      role="option"
      aria-selected={selected}
      aria-current={selected ? 'true' : undefined}
      tabIndex={-1}
      data-room-entry-index={entryIndex}
      onFocus={onFocus}
      onClick={() => onSelect(room.roomId)}
      className={cn(
        'mb-0.5 flex min-h-[3.75rem] w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400/50',
        selected
          ? 'border-sky-400 bg-sky-500/12 text-zinc-50'
          : active
            ? 'border-white/20 bg-white/[0.055] text-zinc-200'
            : 'border-transparent text-zinc-300 hover:border-white/15 hover:bg-white/[0.04]',
      )}
    >
      <RoomAvatar room={room} />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">{room.displayLabel || room.roomName}</span>
          <span className="shrink-0 font-mono text-[9px] text-zinc-500">#{room.roomId}</span>
        </span>
        <span className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[9px] text-zinc-400">
          <span className="flex shrink-0 items-center gap-1">
            <RoomTypeBadge roomType={room.roomType} />
            <TierBadge tier={room.tier} />
          </span>
          <span className="flex min-w-0 items-center justify-end gap-1.5 font-mono tabular-nums">
            <span className="truncate">{formatRoomPoints(room.roomPoints)}</span>
            <span className="shrink-0" aria-label={`${room.keySupply?.toLocaleString() ?? 'Unknown'} keys`}>
              K {room.keySupply?.toLocaleString() ?? '—'}
            </span>
            <span className="shrink-0" aria-label={`${room.uniqueHolders?.toLocaleString() ?? 'Unknown'} holders`}>
              H {room.uniqueHolders?.toLocaleString() ?? '—'}
            </span>
          </span>
        </span>
      </span>
    </button>
  )
}

function RoomAvatar({ room }: { room: AlfaClubRoomDirectoryItem }) {
  const [failed, setFailed] = useState(false)
  if (!room.imageUrl || failed) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[11px] font-semibold text-zinc-400">
        {(room.roomName || room.roomId).slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={room.imageUrl}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-8 shrink-0 rounded-md object-cover"
    />
  )
}

function TierBadge({ tier }: { tier: AlfaRoomTier | null }) {
  return (
    <span
      className={cn(
        'rounded-sm px-1 py-0.5 capitalize ring-1',
        tier === 'exclusive'
          ? 'bg-amber-500/15 text-amber-200 ring-amber-400/25'
          : tier === 'club'
            ? 'bg-sky-500/15 text-sky-200 ring-sky-400/25'
            : 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20',
      )}
    >
      {tier ?? 'unknown'}
    </span>
  )
}

function RoomTypeBadge({
  roomType,
}: {
  roomType: AlfaClubRoomDirectoryItem['roomType']
}) {
  const label = roomType === 'trading' ? 'TRD' : 'SOC'
  return (
    <span
      className={cn(
        'rounded-sm px-1 py-0.5 font-mono uppercase ring-1',
        roomType === 'trading'
          ? 'bg-cyan-500/10 text-cyan-200 ring-cyan-400/20'
          : 'bg-fuchsia-500/10 text-fuchsia-200 ring-fuchsia-400/20',
      )}
      title={roomType === 'trading' ? 'Trading Room' : 'Social Room'}
    >
      {label}
    </span>
  )
}

function RoomSkeletons() {
  return (
    <div className="space-y-2" aria-label="Loading rooms" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-[3.75rem] animate-pulse rounded-md bg-white/[0.04]"
          aria-hidden
        />
      ))}
    </div>
  )
}

function Freshness({ rooms }: { rooms: AlfaClubRoomDirectoryItem[] }) {
  const latest = rooms.reduce<number | null>((current, room) => {
    const timestamp = Date.parse(room.ingestedAt)
    if (!Number.isFinite(timestamp)) return current
    return current == null || timestamp > current ? timestamp : current
  }, null)
  if (latest == null) return null
  const label = `Updated ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(latest)}`
  return <p className="shrink-0 pt-2 text-[10px] text-zinc-600">{label}</p>
}

export { DEFAULT_FILTERS }
