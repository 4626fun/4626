import {
  ArrowRight,
  ExternalLink,
  GripVertical,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from 'lucide-react'
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'react-router-dom'

import { CounterTradeStatusPanel } from '@/components/alfaclub/CounterTradeStatusPanel'
import { HermitRuntimePanel } from '@/components/alfaclub/HermitRuntimePanel'
import { CreatorCoinLinkPanel } from '@/components/alfaclub/CreatorCoinLinkPanel'
import { KeyOwnershipSunburst } from '@/components/alfaclub/KeyOwnershipSunburst'
import { keySafetyStatusMeta, type KeySafetyStatus } from '@/components/alfaclub/KeySafetyStatusHero'
import {
  DEFAULT_FILTERS,
  RoomDiscoveryTray,
  type RoomDiscoveryFilters,
} from '@/components/alfaclub/RoomDiscoveryTray'
import { RoomChatPanel } from '@/components/alfaclub/RoomChatPanel'
import { RoomTradingActivity } from '@/components/alfaclub/RoomTradingActivity'
import { Modal } from '@/components/ui/Modal'
import { PageMeta } from '@/components/seo/PageMeta'
import type { AlfaRoomTier } from '@/lib/alfaclub/keyDefense'
import {
  type AlfaClubRoomDirectoryItem,
  formatRoomPoints,
  formatRoomType,
  formatRoomUsd,
  readRecentRoomIds,
  rememberRecentRoom,
  roomCurveTierRingClassName,
} from '@/lib/alfaclub/roomDirectory'
import { alfaclubRoomPrimaryTitle } from '@/lib/alfaclub/roomLabel'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { cn } from '@/lib/shared/utils'

import {
  AlfaClubKeySafety,
  type AlfaClubKeySafetyPricingSummary,
  type AlfaClubKeySafetySummary,
} from './AlfaClubKeySafety'
import { AlfaClubRoomLiquidity } from './AlfaClubLiquidityPools'

export type AlfaClubRoomHubTab = 'overview' | 'safety' | 'liquidity' | 'chat' | 'inverse'

const BASE_TABS: Array<{ id: Exclude<AlfaClubRoomHubTab, 'inverse' | 'safety'>; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'chat', label: 'Chat' },
  { id: 'liquidity', label: 'Liquidity' },
]

const TRAY_WIDTH_STORAGE_KEY = 'alfaclub:room-tray-width:v1'
const TRAY_COLLAPSED_STORAGE_KEY = 'alfaclub:room-tray-collapsed:v1'
const ROOM_FILTERS_STORAGE_KEY = 'alfaclub:room-discovery-filters:v1'
const DEFAULT_TRAY_WIDTH = 320
const MIN_TRAY_WIDTH = 272
const MAX_TRAY_WIDTH = 440
const COLLAPSED_TRAY_WIDTH = 64

export function clampRoomTrayWidth(value: number): number {
  return Math.min(MAX_TRAY_WIDTH, Math.max(MIN_TRAY_WIDTH, Math.round(value)))
}

function readStoredTrayWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_TRAY_WIDTH
  const stored = window.localStorage.getItem(TRAY_WIDTH_STORAGE_KEY)
  if (stored === null) return DEFAULT_TRAY_WIDTH
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? clampRoomTrayWidth(parsed) : DEFAULT_TRAY_WIDTH
}

function readStoredTrayCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(TRAY_COLLAPSED_STORAGE_KEY) === 'true'
}

function readStoredRoomFilters(): RoomDiscoveryFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(ROOM_FILTERS_STORAGE_KEY) ?? '{}',
    ) as Partial<RoomDiscoveryFilters>
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      roomType: ['all', 'trading', 'social'].includes(parsed.roomType ?? '')
        ? (parsed.roomType as RoomDiscoveryFilters['roomType'])
        : 'all',
      tier: ['all', 'casual', 'club', 'exclusive'].includes(parsed.tier ?? '')
        ? (parsed.tier as RoomDiscoveryFilters['tier'])
        : 'all',
      sort: ['points', 'keys', 'updated'].includes(parsed.sort ?? '')
        ? (parsed.sort as RoomDiscoveryFilters['sort'])
        : 'points',
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

export function resolveAlfaClubRoomHubTab(
  value: string | null,
  roomId: string,
): AlfaClubRoomHubTab {
  switch (value) {
    case null:
    case 'overview':
      return 'overview'
    case 'safety':
      return 'overview'
    case 'chat':
      return 'chat'
    case 'liquidity':
      return 'liquidity'
    case 'inverse':
      return roomId === '1659' ? 'inverse' : 'overview'
    default:
      return 'overview'
  }
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

async function fetchMyRoomIds(signal: AbortSignal): Promise<string[]> {
  const response = await apiFetch(API_ENDPOINTS.wallet.friendKeyHoldings, {
    method: 'GET',
    signal,
  })
  if (response.status === 401 || response.status === 403) return []
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: { roomIds?: string[] }
  } | null
  if (!response.ok || !payload?.success || !Array.isArray(payload.data?.roomIds)) return []
  return payload.data.roomIds
}

async function fetchSafetySummary(
  roomId: string,
  signal: AbortSignal,
): Promise<NonNullable<AlfaClubKeySafetySummary> | null> {
  const response = await apiFetch(
    `${API_ENDPOINTS.alfaclub.keySafetySummary}?roomId=${encodeURIComponent(roomId)}`,
    { method: 'GET', signal },
  )
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    data?: { summary?: { status?: KeySafetyStatus } }
  } | null
  const status = payload?.data?.summary?.status
  if (!response.ok || !payload?.success || !status) return null
  const meta = keySafetyStatusMeta(status)
  return { status, label: meta.label, headline: meta.headline }
}

export function AlfaClubTradingRooms() {
  const { authAddress, hasSession, sessionHydrated } = useSiweAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRoomId = /^\d+$/.test(searchParams.get('roomId')?.trim() ?? '')
    ? searchParams.get('roomId')!.trim()
    : ''
  const requestedTab = searchParams.get('tab')
  const activeTab = resolveAlfaClubRoomHubTab(requestedTab, selectedRoomId)
  const [rooms, setRooms] = useState<AlfaClubRoomDirectoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<RoomDiscoveryFilters>(readStoredRoomFilters)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [trayWidth, setTrayWidth] = useState(readStoredTrayWidth)
  const [trayCollapsed, setTrayCollapsed] = useState(readStoredTrayCollapsed)
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null)
  const [recentRoomIds, setRecentRoomIds] = useState<string[]>(() =>
    readRecentRoomIds(typeof window === 'undefined' ? null : window.localStorage),
  )
  const [myRoomsState, setMyRoomsState] = useState<{
    authAddress: string
    roomIds: string[]
  }>({ authAddress: '', roomIds: [] })
  const normalizedAuthAddress = authAddress?.trim().toLowerCase() ?? ''
  const myRoomIds =
    hasSession && normalizedAuthAddress === myRoomsState.authAddress
      ? myRoomsState.roomIds
      : []
  const myRoomsLoading =
    !sessionHydrated ||
    (hasSession && normalizedAuthAddress !== myRoomsState.authAddress)
  const [safetyState, setSafetyState] = useState<{
    roomId: string
    summary: AlfaClubKeySafetySummary
  }>({ roomId: '', summary: null })
  const safetySummary = safetyState.roomId === selectedRoomId ? safetyState.summary : null

  useEffect(() => {
    const invalidTab =
      requestedTab !== null &&
      !['overview', 'safety', 'liquidity', 'chat', 'inverse'].includes(requestedTab)
    const unavailableInverse = requestedTab === 'inverse' && selectedRoomId !== '1659'
    const legacySafetyTab = requestedTab === 'safety'
    if (!invalidTab && !unavailableInverse && !legacySafetyTab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'overview')
    setSearchParams(next, { replace: true })
  }, [requestedTab, searchParams, selectedRoomId, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    void fetchRooms(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setRooms(rows)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Failed to load AlfaClub rooms')
        setRooms([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    if (!sessionHydrated) return
    if (!hasSession || !normalizedAuthAddress) return

    const controller = new AbortController()
    void fetchMyRoomIds(controller.signal)
      .catch(() => [])
      .then((roomIds) => {
        if (!controller.signal.aborted) {
          setMyRoomsState({ authAddress: normalizedAuthAddress, roomIds })
        }
      })
    return () => controller.abort()
  }, [hasSession, normalizedAuthAddress, sessionHydrated])

  useEffect(() => {
    if (!selectedRoomId || activeTab === 'overview') return
    const controller = new AbortController()
    void fetchSafetySummary(selectedRoomId, controller.signal).then((summary) => {
      if (!controller.signal.aborted) {
        setSafetyState({ roomId: selectedRoomId, summary })
      }
    })
    return () => controller.abort()
  }, [activeTab, selectedRoomId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TRAY_WIDTH_STORAGE_KEY, String(trayWidth))
  }, [trayWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TRAY_COLLAPSED_STORAGE_KEY, String(trayCollapsed))
  }, [trayCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(ROOM_FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.roomId === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  )
  const tabs = useMemo(
    () =>
      selectedRoomId === '1659'
        ? [...BASE_TABS, { id: 'inverse' as const, label: 'Inverse' }]
        : BASE_TABS,
    [selectedRoomId],
  )

  const updateQuery = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  const selectRoom = (roomId: string) => {
    updateQuery({
      roomId,
      tab: activeTab === 'inverse' && roomId !== '1659' ? 'overview' : activeTab,
      pool: null,
    })
    setRecentRoomIds(
      rememberRecentRoom(typeof window === 'undefined' ? null : window.localStorage, roomId),
    )
    setMobileListOpen(false)
  }

  const handleSafetySummary = useCallback(
    (summary: AlfaClubKeySafetySummary) => {
      setSafetyState({ roomId: selectedRoomId, summary })
    },
    [selectedRoomId],
  )

  const beginTrayResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    resizeStartRef.current = { pointerX: event.clientX, width: trayWidth }
    const handleMove = (moveEvent: PointerEvent) => {
      const start = resizeStartRef.current
      if (!start) return
      setTrayWidth(clampRoomTrayWidth(start.width + moveEvent.clientX - start.pointerX))
    }
    const handleEnd = () => {
      resizeStartRef.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
  }

  const resizeTrayByKeyboard = (direction: -1 | 1) => {
    setTrayCollapsed(false)
    setTrayWidth((width) => clampRoomTrayWidth(width + direction * 16))
  }

  const effectiveTrayWidth = trayCollapsed ? COLLAPSED_TRAY_WIDTH : trayWidth
  const layoutStyle = {
    '--alfaclub-room-tray-width': `${effectiveTrayWidth}px`,
  } as CSSProperties

  const tray = (
    <RoomDiscoveryTray
      rooms={rooms}
      filters={filters}
      onFiltersChange={setFilters}
      recentRoomIds={recentRoomIds}
      myRoomIds={myRoomIds}
      myRoomsLoading={myRoomsLoading}
      selectedRoomId={selectedRoomId}
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true)
        setError(null)
        setReloadKey((key) => key + 1)
      }}
      onSelect={selectRoom}
    />
  )

  return (
    <div className="relative min-h-[70vh] pb-16" style={layoutStyle}>
      <PageMeta
        title="AlfaClub Rooms"
        description="Discover AlfaClub Trading and Social Rooms, review key safety, and manage room liquidity."
        canonicalPath="/rooms"
      />

      <aside
        className="fixed left-0 top-0 z-20 hidden h-screen overflow-hidden border-r border-zinc-900/70 bg-black/70 backdrop-blur-md transition-[width] duration-200 motion-reduce:transition-none lg:block"
        aria-label="Discover AlfaClub rooms"
        style={{ width: effectiveTrayWidth }}
      >
        <button
          type="button"
          onClick={() => setTrayCollapsed((collapsed) => !collapsed)}
          className="absolute right-3 top-20 z-10 grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
          aria-label={trayCollapsed ? 'Expand room tray' : 'Collapse room tray'}
          aria-expanded={!trayCollapsed}
        >
          {trayCollapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </button>
        {trayCollapsed ? (
          <CollapsedRoomRail
            room={selectedRoom}
            roomId={selectedRoomId}
            roomCount={rooms.length}
          />
        ) : null}
        <div
          className={cn(
            'flex h-full flex-col px-4 pb-6 pt-24 transition-opacity duration-150 motion-reduce:transition-none',
            trayCollapsed && 'pointer-events-none opacity-0',
          )}
          style={{ width: trayWidth }}
          aria-hidden={trayCollapsed}
          inert={trayCollapsed}
        >
          {tray}
        </div>
        {!trayCollapsed ? (
          <button
            type="button"
            role="slider"
            aria-label="Resize room tray"
            aria-orientation="vertical"
            aria-valuemin={MIN_TRAY_WIDTH}
            aria-valuemax={MAX_TRAY_WIDTH}
            aria-valuenow={trayWidth}
            tabIndex={0}
            onPointerDown={beginTrayResize}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                resizeTrayByKeyboard(-1)
              } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                resizeTrayByKeyboard(1)
              }
            }}
            className="absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center text-zinc-700 outline-none transition hover:bg-sky-400/10 hover:text-sky-300 focus-visible:bg-sky-400/10 focus-visible:text-sky-300"
          >
            <GripVertical className="size-3" aria-hidden />
          </button>
        ) : null}
      </aside>

      <div className="sticky top-0 z-20 border-b border-zinc-900/80 bg-black/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileListOpen(true)}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-2xl border-l-[3px] bg-white/[0.04] px-3 py-2.5 text-left ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06]',
            selectedRoom?.roomType === 'trading'
              ? 'border-cyan-400/70'
              : selectedRoom?.roomType === 'social'
                ? 'border-fuchsia-400/70'
                : 'border-transparent',
          )}
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              AlfaClub rooms
            </span>
            <span className="block truncate text-sm font-medium text-zinc-200">
              {selectedRoom ? alfaclubRoomPrimaryTitle(selectedRoom) : selectedRoomId ? `Room #${selectedRoomId}` : 'Choose a room'}
            </span>
            {selectedRoom ? (
              <span className="mt-0.5 block truncate font-mono text-[10px] capitalize text-zinc-400">
                {formatRoomType(selectedRoom.roomType)} · {selectedRoom.tier ?? 'unknown'} ·{' '}
                {formatRoomPoints(selectedRoom.roomPoints)}
              </span>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-200">
            <Menu className="size-4" aria-hidden />
            Change
          </span>
        </button>
      </div>

      <Modal
        open={mobileListOpen}
        onClose={() => setMobileListOpen(false)}
        title="Discover rooms"
        description="Browse Trading and Social Rooms."
        placement="bottom-sheet"
        maxWidth="max-w-xl"
        className="h-[100dvh] max-h-[100dvh] rounded-none bg-zinc-950 px-4 pb-5 pt-4 lg:hidden"
      >
        <div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col">{tray}</div>
      </Modal>

      <main className="w-auto px-4 py-5 transition-[margin] duration-200 motion-reduce:transition-none sm:px-6 lg:ml-[var(--alfaclub-room-tray-width)]">
        <div className="mx-auto w-full max-w-7xl">
          {!selectedRoomId ? (
            <DiscoveryLanding rooms={rooms} loading={loading} onSelect={selectRoom} />
          ) : (
            <>
            {!loading && !selectedRoom ? (
              <MissingRoomBanner
                roomId={selectedRoomId}
                onBrowse={() => {
                  updateQuery({ roomId: null, tab: null, pool: null })
                  setMobileListOpen(true)
                }}
              />
            ) : null}
            <RoomHeader
              roomId={selectedRoomId}
              room={selectedRoom}
              tabs={tabs}
              activeTab={activeTab}
              safetySummary={safetySummary}
              onSelectTab={(tab) => updateQuery({ tab })}
            />
            <div className="mt-6">
              {activeTab === 'overview' ? (
                <section
                  role="tabpanel"
                  id="room-panel-overview"
                  aria-labelledby="room-tab-overview"
                  className="space-y-10 border-b border-white/[0.07] pb-10"
                >
                  {safetySummary?.ownership ? (
                    <div className="rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.04]">
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
                        Key safety
                      </p>
                      <KeyOwnershipSunburst
                        keySupply={safetySummary.ownership.keySupply}
                        ownerKeys={safetySummary.ownership.ownerKeys}
                        ownerStakedKeys={safetySummary.ownership.ownerStakedKeys}
                        stakedSupply={safetySummary.ownership.stakedSupply}
                        ownerLabel={safetySummary.ownership.ownerLabel}
                        ownerWalletKeys={safetySummary.ownership.ownerWalletKeys}
                        dataSource={safetySummary.ownership.dataSource}
                        othersHolders={safetySummary.ownership.othersHolders}
                        takeoverKeys={safetySummary.ownership.takeoverKeys}
                        onResetTakeover={safetySummary.ownership.onResetTakeover}
                      />
                      <a
                        href="#room-key-safety-analysis"
                        className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 underline decoration-dotted underline-offset-2 hover:text-sky-200"
                      >
                        Stress-test a hostile buyer
                        <ArrowRight className="size-3" aria-hidden />
                      </a>
                    </div>
                  ) : null}
                  <OverviewPanel
                    roomId={selectedRoomId}
                    room={selectedRoom}
                    pricing={safetySummary?.pricing}
                  />
                  <CreatorCoinLinkPanel
                    key={`creator-coin-${selectedRoomId}`}
                    roomId={selectedRoomId}
                    onOpenLiquidity={() => updateQuery({ tab: 'liquidity' })}
                  />
                  <div
                    id="room-key-safety-analysis"
                    className="scroll-mt-6 border-t border-white/[0.07] pt-8"
                  >
                    <div className="mb-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
                        Key safety
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
                        Ownership and takeover analysis
                      </h2>
                    </div>
                    <AlfaClubKeySafety
                      key={selectedRoomId}
                      roomId={selectedRoomId}
                      embedded
                      showOwnershipCard={false}
                      onSummaryChange={handleSafetySummary}
                    />
                  </div>
                </section>
              ) : null}
              {activeTab === 'liquidity' ? (
                <section
                  role="tabpanel"
                  id="room-panel-liquidity"
                  aria-labelledby="room-tab-liquidity"
                  className="border-b border-white/[0.07] pb-10"
                >
                  <AlfaClubRoomLiquidity key={selectedRoomId} roomId={selectedRoomId} />
                </section>
              ) : null}
              {activeTab === 'chat' ? (
                <RoomChatPanel key={selectedRoomId} roomId={selectedRoomId} />
              ) : null}
              {activeTab === 'inverse' && selectedRoomId === '1659' ? (
                <section
                  role="tabpanel"
                  id="room-panel-inverse"
                  aria-labelledby="room-tab-inverse"
                  className="space-y-4 border-b border-white/[0.07] pb-10"
                >
                  <CounterTradeStatusPanel showArenaLinks />
                  <HermitRuntimePanel />
                </section>
              ) : null}
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function CollapsedRoomRail({
  room,
  roomId,
  roomCount,
}: {
  room: AlfaClubRoomDirectoryItem | null
  roomId: string
  roomCount: number
}) {
  return (
    <div
      className="absolute inset-x-0 top-32 flex flex-col items-center gap-3 px-2 text-center"
      aria-label={roomId ? `Selected room #${roomId}` : 'No room selected'}
    >
      <SelectedRoomAvatar room={room} />
      <span className="max-w-full truncate rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-sky-200">
        {roomId ? `#${roomId}` : '—'}
      </span>
      <span className="h-px w-6 bg-white/[0.08]" aria-hidden />
      <span className="font-mono text-[9px] tabular-nums text-zinc-500">
        {roomCount.toLocaleString()}
        <span className="sr-only"> rooms</span>
      </span>
    </div>
  )
}

function RoomHeader({
  roomId,
  room,
  tabs,
  activeTab,
  safetySummary,
  onSelectTab,
}: {
  roomId: string
  room: AlfaClubRoomDirectoryItem | null
  tabs: Array<{ id: AlfaClubRoomHubTab; label: string }>
  activeTab: AlfaClubRoomHubTab
  safetySummary: AlfaClubKeySafetySummary
  onSelectTab: (tab: AlfaClubRoomHubTab) => void
}) {
  const selectedHandle = (room?.creatorHandle ?? '').trim().replace(/^@+/, '')
  const title = room
    ? alfaclubRoomPrimaryTitle(room)
    : `Room #${roomId}`
  const bannerSrc = room?.imageUrl?.trim() || null
  return (
    <header className="pt-2">
      <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/[0.06]">
        {bannerSrc ? (
          <div className="absolute inset-0" aria-hidden>
            <img src={bannerSrc} alt="" className="h-full w-full object-cover opacity-[0.16]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/75 to-black" />
          </div>
        ) : null}
        <div className="relative flex flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SelectedRoomAvatar room={room} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-sky-200/80">#{roomId}</span>
                {room ? (
                  <span className="text-[11px] text-zinc-400">
                    {formatRoomType(room.roomType)}
                  </span>
                ) : null}
                <TierBadge tier={room?.tier ?? null} />
              </div>
              <h1 className="headline mt-2 truncate text-2xl text-zinc-100 sm:text-3xl">
                {title}
              </h1>
              {selectedHandle ? <p className="mt-1 text-sm text-zinc-400">by @{selectedHandle}</p> : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3 xl:grid-cols-6">
            <HeaderStat
              label="Key price"
              value={
                safetySummary?.pricing
                  ? formatRoomUsd(safetySummary.pricing.currentUsdc)
                  : formatRoomUsd(room?.keyPriceUsdc)
              }
            />
            <HeaderStat label="Volume" value={formatRoomUsd(room?.volumeUsdc)} />
            <HeaderStat label="Fees generated" value={formatRoomUsd(room?.feesGeneratedUsdc)} />
            <HeaderStat
              label="Trading fund"
              value={
                safetySummary?.pricing
                  ? formatRoomUsd(safetySummary.pricing.treasuryUsdc)
                  : formatRoomUsd(room?.tradingFundUsdc)
              }
            />
            <HeaderStat label="Room Points" value={formatRoomPoints(room?.roomPoints ?? null)} />
            <HeaderStat label="Safety" value={safetySummary?.label ?? 'Open tab'} />
          </dl>
        </div>
      </div>
      <div
        className="sticky top-20 z-10 -mx-4 mt-5 flex gap-1 overflow-x-auto border-y border-white/[0.07] bg-black/85 px-4 py-2 backdrop-blur-xl md:top-16 sm:-mx-6 sm:px-6"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`room-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-controls={`room-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-sky-500/12 text-sky-100'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  )
}

function DiscoveryLanding({
  rooms,
  loading,
  onSelect,
}: {
  rooms: AlfaClubRoomDirectoryItem[]
  loading: boolean
  onSelect: (roomId: string) => void
}) {
  const featured = rooms.filter((room) => room.featured).slice(0, 6)
  const tradingCount = rooms.filter((room) => room.roomType === 'trading').length
  const socialCount = rooms.filter((room) => room.roomType === 'social').length
  return (
    <>
      <section className="hidden border-b border-white/[0.07] py-14 lg:block">
        <p className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sky-300 ring-1 ring-sky-400/15">
          AlfaClub discovery terminal
        </p>
        <h1 className="headline mt-4 max-w-2xl text-3xl text-zinc-100">
          Select a room from the discovery rail
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Scan Trading and Social Rooms by points, keys, or freshness. Your filters and
          position stay intact while you move through the workspace.
        </p>
        <dl className="mt-8 grid max-w-2xl grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07] py-4">
          <HeaderStat label="All rooms" value={rooms.length.toLocaleString()} />
          <HeaderStat label="Trading" value={tradingCount.toLocaleString()} />
          <HeaderStat label="Social" value={socialCount.toLocaleString()} />
        </dl>
        <p className="mt-5 font-mono text-[10px] text-zinc-500">
          ↑↓ navigate · Enter open · drag the rail edge to resize
        </p>
      </section>
      <div className="space-y-6 lg:hidden">
        <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_45%)] pb-8 pt-5">
        <p className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-400/15">
          Room discovery
        </p>
        <h1 className="headline mt-4 max-w-2xl text-3xl text-zinc-100 sm:text-4xl">
          Find your next AlfaClub room
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Browse Trading Rooms for market discussion or Social Rooms for community. Casual,
          Club, and Exclusive describe each room&apos;s bonding curve.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <CategoryCard label="Trading Rooms" count={tradingCount} detail="Markets, trades, and alpha" accent="cyan" />
          <CategoryCard label="Social Rooms" count={socialCount} detail="Creators and communities" accent="fuchsia" />
        </div>
      </section>
        {featured.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Curated</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">Featured rooms</h2>
            </div>
            <p className="text-xs text-zinc-500">Points reflect room activity, not USD volume.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((room) => (
              <button
                key={room.roomId}
                type="button"
                onClick={() => onSelect(room.roomId)}
                className="group rounded-xl border-b border-white/[0.07] px-2 py-4 text-left transition hover:border-sky-400/30 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <SelectedRoomAvatar room={room} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {alfaclubRoomPrimaryTitle(room)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{formatRoomType(room.roomType)}</p>
                  </div>
                  <ArrowRight className="size-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300" aria-hidden />
                </div>
                <p className="mt-3 font-mono text-xs text-zinc-400">{formatRoomPoints(room.roomPoints)}</p>
              </button>
            ))}
          </div>
        </section>
        ) : loading ? (
          <p className="text-sm text-zinc-500" role="status">Loading featured rooms…</p>
        ) : null}
      </div>
    </>
  )
}

function CategoryCard({
  label,
  count,
  detail,
  accent,
}: {
  label: string
  count: number
  detail: string
  accent: 'cyan' | 'fuchsia'
}) {
  return (
    <div
      className={cn(
        'border-l-2 py-2 pl-4',
        accent === 'cyan' ? 'border-cyan-400/50' : 'border-fuchsia-400/50',
      )}
    >
      <div className="flex items-center gap-2 text-zinc-200">
        <Users className={cn('size-4', accent === 'cyan' ? 'text-cyan-300' : 'text-fuchsia-300')} aria-hidden />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{count.toLocaleString()}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  )
}

function MissingRoomBanner({ roomId, onBrowse }: { roomId: string; onBrowse: () => void }) {
  return (
    <div className="mb-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-amber-400/20" role="alert">
      <p>Room #{roomId} is not in the latest directory snapshot. Live room tools may still resolve it.</p>
      <button type="button" onClick={onBrowse} className="mt-2 font-semibold text-amber-200 underline underline-offset-4">
        Browse available rooms
      </button>
    </div>
  )
}

function OverviewPanel({
  roomId,
  room,
  pricing,
}: {
  roomId: string
  room: AlfaClubRoomDirectoryItem | null
  pricing?: AlfaClubKeySafetyPricingSummary
}) {
  // Only trading rooms have a Hyperliquid trading wallet to report on. Social rooms have no
  // host trading activity, so rendering the widget there would either sit empty or, worse,
  // attribute an unrelated chat participant's personal trades to the room (see
  // resolveRoomHostAddress's most-active-sender fallback for non-1659 rooms).
  const isTradingRoom = room?.roomType === 'trading'
  return (
    <section
      className={cn(
        'grid gap-5 lg:items-start',
        isTradingRoom
          ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
          : 'lg:grid-cols-1',
      )}
    >
      <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-100">Room overview</h2>
          <a
            href={`https://alfaclub.app/rooms/${roomId}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400"
          >
            Open on AlfaClub
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
        {room?.description ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{room.description}</p>
        ) : null}
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <FactCard
            label="Key price"
            value={
              pricing ? formatUsd(pricing.currentUsdc) : formatRoomUsd(room?.keyPriceUsdc)
            }
          />
          <FactCard label="Volume" value={formatRoomUsd(room?.volumeUsdc)} />
          <FactCard label="Fees generated" value={formatRoomUsd(room?.feesGeneratedUsdc)} />
          <FactCard
            label="Trading fund"
            value={
              pricing
                ? formatUsd(pricing.treasuryUsdc)
                : formatRoomUsd(room?.tradingFundUsdc)
            }
          />
          <FactCard label="Holders" value={room?.uniqueHolders?.toLocaleString() ?? '—'} />
          <FactCard label="Key supply" value={room?.keySupply?.toLocaleString() ?? '—'} />
          <FactCard label="Room type" value={room ? formatRoomType(room.roomType) : '—'} />
          <FactCard label="Bonding curve" value={room?.tier ?? '—'} />
          <FactCard label="Last updated" value={formatUpdatedAt(room?.ingestedAt ?? null)} />
        </dl>
        {pricing ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FactCard label="Buy next key" value={formatUsd(pricing.buyUsdc)} />
            <FactCard label="Sell 1 key" value={formatUsd(pricing.sellUsdc)} />
            <FactCard label="Reported fund" value={formatUsd(pricing.reportedFundUsdc)} />
            <FactCard label={pricing.treasuryLabel} value={formatUsd(pricing.treasuryUsdc)} />
          </dl>
        ) : null}
      </div>
      {isTradingRoom ? <RoomTradingActivity key={roomId} roomId={roomId} /> : null}
    </section>
  )
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-medium capitalize text-zinc-100">{value}</dd>
    </div>
  )
}

function SelectedRoomAvatar({ room }: { room: AlfaClubRoomDirectoryItem | null }) {
  // Room artwork lives in the CSP-allowlisted room-image bucket (see vercel.json img-src),
  // so it renders directly — no proxy hop needed here.
  const imageSrc = room?.imageUrl?.trim() || null
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const tierRing = room ? roomCurveTierRingClassName(room) : null
  const avatarClassName = cn(
    'size-11 shrink-0 rounded-xl object-cover',
    tierRing && 'ring-2 ring-offset-1 ring-offset-black',
    tierRing,
  )
  if (!imageSrc || failedSource === imageSrc) {
    return (
      <span
        className={cn(
          avatarClassName,
          'grid place-items-center bg-white/[0.05] text-sm font-semibold text-zinc-400',
        )}
        aria-hidden
      >
        {(room?.roomName ?? '#').slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={imageSrc}
      alt=""
      width={44}
      height={44}
      loading="lazy"
      onError={() => setFailedSource(imageSrc)}
      className={avatarClassName}
    />
  )
}

function TierBadge({ tier }: { tier: AlfaRoomTier | null }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[11px] capitalize ring-1',
        tier === 'exclusive'
          ? 'bg-amber-500/15 text-amber-200 ring-amber-400/25'
          : tier === 'club'
            ? 'bg-sky-500/15 text-sky-200 ring-sky-400/25'
            : 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20',
      )}
    >
      {tier ?? 'unknown'} curve
    </span>
  )
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 border-l border-white/[0.08] px-3 py-1">
      <dt className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-medium capitalize text-zinc-200">{value}</dd>
    </div>
  )
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return '—'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '—'
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
}
