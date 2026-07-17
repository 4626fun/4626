import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Inbox,
  KeyRound,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react'
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  type AlfaClubRoomDirectoryItem,
  type AlfaClubRoomSort,
  type AlfaClubRoomTierFilter,
  type AlfaClubRoomTypeFilter,
  formatRoomUsd,
  roomCurveTierRingClassName,
  sortAlfaClubRooms,
} from '@/lib/alfaclub/roomDirectory'
import { alfaclubRoomPrimaryTitle } from '@/lib/alfaclub/roomLabel'
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
  sort: 'volume',
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
  { id: 'volume', label: 'Volume' },
  { id: 'pnl', label: 'PnL' },
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
        <div
          className="flex items-start gap-2.5 rounded-xl bg-amber-500/[0.08] p-3 ring-1 ring-amber-400/20"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-100">Rooms could not be loaded.</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-amber-200/70">{error}</p>
            <button
              type="button"
              className="mt-2 rounded-lg bg-amber-300 px-2.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-200"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-y border-white/[0.07] px-1 py-8 text-center text-xs text-zinc-400">
          <Inbox className="size-5 text-zinc-600" aria-hidden />
          <p>No rooms match this terminal view.</p>
          <button
            type="button"
            className="font-semibold text-sky-300 underline decoration-sky-400/40 underline-offset-4"
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
        <p className="pt-2.5 text-[10px] text-zinc-500" role="status">
          Checking your keyholdings…
        </p>
      ) : null}
      {!loading && !myRoomsLoading && myRoomIds.length === 0 ? (
        <p className="border-t border-white/[0.06] pt-2.5 font-mono text-[10px] text-zinc-500">
          Hold a room key to pin it in My Rooms.
        </p>
      ) : null}
    </div>
  )
}

function countActiveDiscoveryFilters(filters: RoomDiscoveryFilters): number {
  let count = 0
  if (filters.roomType !== 'all') count += 1
  if (filters.tier !== 'all') count += 1
  if (filters.sort !== DEFAULT_FILTERS.sort) count += 1
  return count
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterLabel = describeActiveFilters(filters)
  const hasActiveFilters = activeFilterLabel.length > 0
  const activeFilterCount = countActiveDiscoveryFilters(filters)
  return (
    <div className="shrink-0">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">AlfaClub</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-100">Discover rooms</h2>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] tabular-nums text-zinc-400 ring-1 ring-white/[0.06]">
          {visibleCount.toLocaleString()} / {totalCount.toLocaleString()}
        </span>
      </div>
      <label className="relative mt-3.5 block">
        <span className="sr-only">Search AlfaClub rooms</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search name, creator, or ID…"
          className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-8 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none transition-shadow focus:ring-2 focus:ring-sky-500/40"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
          >
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="alfaclub-room-filters-panel"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors',
            filtersOpen || activeFilterCount > 0
              ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30'
              : 'bg-white/[0.03] text-zinc-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-200',
          )}
        >
          <SlidersHorizontal className="size-3" aria-hidden />
          Filters
          {activeFilterCount > 0 ? (
            <span className="grid size-4 place-items-center rounded-full bg-sky-400 text-[9px] font-bold text-black">
              {activeFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn('size-3 transition-transform', filtersOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="shrink-0 text-[10px] font-semibold text-sky-300 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          >
            Clear
          </button>
        ) : (
          <span className="truncate font-mono text-[10px] text-zinc-500" aria-live="polite">
            All room signals
          </span>
        )}
      </div>
      <div
        id="alfaclub-room-filters-panel"
        hidden={!filtersOpen}
        className="mt-2.5 grid grid-cols-1 gap-2.5 rounded-xl bg-black/30 p-3 ring-1 ring-white/[0.06] sm:grid-cols-3"
      >
        <FilterSelect
          label="Room type"
          value={filters.roomType}
          options={TYPE_OPTIONS}
          onChange={(roomType) => onFiltersChange({ ...filters, roomType })}
        />
        <FilterSelect
          label="Bonding curve"
          value={filters.tier}
          options={TIER_OPTIONS}
          onChange={(tier) => onFiltersChange({ ...filters, tier })}
        />
        <FilterSelect
          label="Sort by"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => onFiltersChange({ ...filters, sort })}
        />
      </div>
      <div className="mb-3 mt-2.5 flex min-h-4 items-center border-t border-white/[0.06] pt-2.5">
        <span className="truncate font-mono text-[10px] text-zinc-500" aria-live="polite">
          {hasActiveFilters ? activeFilterLabel : 'No filters applied'}
        </span>
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
  if (filters.sort !== DEFAULT_FILTERS.sort) {
    labels.push(`sort: ${SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? filters.sort}`)
  }
  return labels.join(' · ')
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="block">
      <span className="block text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full appearance-none rounded-lg bg-black/45 px-2.5 py-1.5 text-xs text-zinc-200 ring-1 ring-white/[0.08] outline-none transition-shadow focus:ring-2 focus:ring-sky-500/40"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-zinc-900 text-zinc-200">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function sectionAccentClassName(label: string): string {
  if (label.startsWith('Trading')) return 'bg-cyan-400'
  if (label.startsWith('Social')) return 'bg-fuchsia-400'
  return 'bg-zinc-600'
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
      <span className={cn('size-1.5 shrink-0 rounded-full', sectionAccentClassName(entry.label))} aria-hidden />
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
  const title = alfaclubRoomPrimaryTitle(room)
  return (
    <button
      type="button"
      id={`alfaclub-room-option-${room.roomId}`}
      role="option"
      aria-label={`${title}, room ${room.roomId}`}
      aria-selected={selected}
      aria-current={selected ? 'true' : undefined}
      tabIndex={-1}
      data-room-entry-index={entryIndex}
      onFocus={onFocus}
      onClick={() => onSelect(room.roomId)}
      data-room-type={room.roomType}
      className={cn(
        'mb-0.5 flex min-h-[3.75rem] w-full items-center gap-2.5 rounded-r-md border-l-[3px] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400/50',
        room.roomType === 'trading'
          ? 'bg-cyan-500/[0.05] hover:bg-cyan-500/[0.09]'
          : 'bg-fuchsia-500/[0.05] hover:bg-fuchsia-500/[0.09]',
        selected
          ? room.roomType === 'trading'
            ? 'border-cyan-400 bg-cyan-500/[0.16] text-zinc-50'
            : 'border-fuchsia-400 bg-fuchsia-500/[0.16] text-zinc-50'
          : active
            ? 'border-white/20 text-zinc-200'
            : 'border-transparent text-zinc-300 hover:border-white/15',
      )}
    >
      <RoomAvatar room={room} />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{title}</span>
          <span className="shrink-0 rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[9px] text-zinc-500">
            #{room.roomId}
          </span>
        </span>
        <span className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[9px] text-zinc-400">
          <span className="sr-only">
            {room.roomType === 'trading' ? 'Trading Room' : 'Social Room'}
            {room.roomType === 'trading' && room.tier ? `, ${room.tier} curve` : ''}
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 font-mono tabular-nums">
            <span className="truncate">{formatRoomUsd(room.volumeUsdc)}</span>
            <span
              className="flex shrink-0 items-center gap-0.5"
              aria-label={`${room.keySupply?.toLocaleString() ?? 'Unknown'} keys`}
            >
              <KeyRound className="size-2.5 text-zinc-500" aria-hidden />
              K {room.keySupply?.toLocaleString() ?? '—'}
            </span>
            <span
              className="flex shrink-0 items-center gap-0.5"
              aria-label={`${room.uniqueHolders?.toLocaleString() ?? 'Unknown'} holders`}
            >
              <Users className="size-2.5 text-zinc-500" aria-hidden />
              H {room.uniqueHolders?.toLocaleString() ?? '—'}
            </span>
          </span>
        </span>
      </span>
    </button>
  )
}

function RoomAvatar({ room }: { room: AlfaClubRoomDirectoryItem }) {
  // Room artwork lives in the CSP-allowlisted room-image bucket (see vercel.json img-src),
  // so it renders directly — no proxy hop needed here.
  const imageSrc = room.imageUrl?.trim() || null
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const tierRing = roomCurveTierRingClassName(room)
  const avatarClassName = cn(
    'size-9 shrink-0 rounded-md object-cover',
    tierRing && 'ring-2 ring-offset-1 ring-offset-black',
    tierRing,
  )
  if (!imageSrc || failedSource === imageSrc) {
    return (
      <span
        data-curve-tier={room.roomType === 'trading' ? room.tier ?? 'unknown' : undefined}
        className={cn(
          avatarClassName,
          'grid place-items-center bg-white/[0.05] text-xs font-semibold text-zinc-400',
        )}
        aria-hidden
      >
        {(room.roomName || room.roomId).slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={imageSrc}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      onError={() => setFailedSource(imageSrc)}
      data-curve-tier={room.roomType === 'trading' ? room.tier ?? 'unknown' : undefined}
      className={avatarClassName}
    />
  )
}

function RoomSkeletons() {
  return (
    <div className="space-y-1.5" aria-label="Loading rooms" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[3.75rem] items-center gap-2.5 rounded-md px-2 py-1.5"
          aria-hidden
        >
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-white/[0.06]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  )
}


export { DEFAULT_FILTERS }
