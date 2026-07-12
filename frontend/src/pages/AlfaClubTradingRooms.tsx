import { Droplets, ExternalLink, Search, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import type { AlfaRoomTier } from '@/lib/alfaclub/keyDefense'
import { formatAlfaClubRoomLabel } from '@/lib/alfaclub/roomLabel'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { cn } from '@/lib/shared/utils'

type TradingRoomRow = {
  roomId: string
  roomName: string
  displayLabel: string
  creatorHandle: string | null
  tier: AlfaRoomTier | null
  keySupply: number | null
  volumeUsdc: number | null
}

function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
}

function roomLabel(room: TradingRoomRow): string {
  return (
    room.displayLabel ||
    formatAlfaClubRoomLabel({
      roomId: room.roomId,
      roomName: room.roomName,
      creatorHandle: room.creatorHandle,
    })
  )
}

function parseInitialRoomId(): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URLSearchParams(window.location.search).get('roomId')?.trim() ?? ''
  return /^\d+$/.test(fromUrl) ? fromUrl : ''
}

function tierBadgeClass(tier: AlfaRoomTier | null): string {
  switch (tier) {
    case 'casual':
      return 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20'
    case 'club':
      return 'bg-sky-500/15 text-sky-200 ring-sky-400/25'
    case 'exclusive':
      return 'bg-amber-500/15 text-amber-200 ring-amber-400/25'
    case null:
      return 'bg-white/[0.04] text-zinc-400 ring-white/[0.08]'
    default: {
      const _exhaustive: never = tier
      return _exhaustive
    }
  }
}

async function fetchTradingRooms(signal: AbortSignal): Promise<TradingRoomRow[]> {
  const res = await apiFetch(`${API_ENDPOINTS.alfaclub.tradingRooms}?limit=2500`, {
    method: 'GET',
    signal,
  })
  const payload = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { rows?: TradingRoomRow[] }
    error?: string
  } | null
  if (!res.ok || !payload?.success || !Array.isArray(payload.data?.rows)) {
    throw new Error(payload?.error ?? `trading_rooms_failed_${res.status}`)
  }
  return payload.data.rows
}

export function AlfaClubTradingRooms() {
  const [rooms, setRooms] = useState<TradingRoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState(parseInitialRoomId)
  const [mobileListOpen, setMobileListOpen] = useState(!parseInitialRoomId())

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await fetchTradingRooms(controller.signal)
        if (controller.signal.aborted) return
        setRooms(rows)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load trading rooms')
        setRooms([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter((room) => {
      const label = roomLabel(room).toLowerCase()
      const handle = (room.creatorHandle ?? '').toLowerCase()
      return label.includes(q) || handle.includes(q) || room.roomId.includes(q)
    })
  }, [rooms, search])

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null
    return rooms.find((room) => room.roomId === selectedRoomId) ?? null
  }, [rooms, selectedRoomId])

  const selectRoom = (roomId: string) => {
    setSelectedRoomId(roomId)
    setMobileListOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('roomId', roomId)
    window.history.replaceState({}, '', url.toString())
  }

  const selectedHandle = (selectedRoom?.creatorHandle ?? '').trim().replace(/^@+/, '')

  return (
    <div className="relative min-h-[70vh] pb-16">
      <PageMeta
        title="AlfaClub Trading Rooms"
        description="Browse AlfaClub trading rooms by volume — open a room on AlfaClub or check key safety."
        canonicalPath="/rooms"
      />

      <section className="cinematic-section no-divider-top !pt-0">
        <aside
          className="fixed left-0 top-0 z-20 hidden h-screen w-72 border-r border-zinc-900/80 bg-black/55 backdrop-blur-md lg:block"
          aria-label="Trading rooms"
        >
          <div className="flex h-full flex-col px-4 pb-6 pt-24">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">AlfaClub</p>
              <h1 className="mt-1 text-sm font-semibold text-zinc-100">Trading rooms</h1>
              <p className="mt-1 text-xs text-zinc-500">
                {loading ? 'Loading…' : `${filteredRooms.length.toLocaleString()} rooms`}
              </p>
            </div>

            <label htmlFor="trading-rooms-search" className="sr-only">
              Filter trading rooms
            </label>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                id="trading-rooms-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by name or ID…"
                className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {loading ? (
                <p className="px-2 py-3 text-xs text-zinc-500" role="status">
                  Loading rooms…
                </p>
              ) : null}
              {error ? (
                <p className="px-2 py-3 text-xs text-amber-300" role="alert">
                  {error}
                </p>
              ) : null}
              {!loading && !error && filteredRooms.length === 0 ? (
                <p className="px-2 py-3 text-xs text-zinc-500">No rooms matched.</p>
              ) : null}
              {filteredRooms.map((room) => {
                const active = room.roomId === selectedRoomId
                return (
                  <button
                    key={room.roomId}
                    type="button"
                    onClick={() => selectRoom(room.roomId)}
                    className={cn(
                      'mb-1 w-full rounded-xl px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'bg-sky-500/15 text-zinc-50 ring-1 ring-sky-400/30'
                        : 'text-zinc-300 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{roomLabel(room)}</span>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">#{room.roomId}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span className={cn('rounded-md px-1.5 py-0.5 capitalize ring-1', tierBadgeClass(room.tier))}>
                        {room.tier ?? '—'}
                      </span>
                      <span className="tabular-nums">{formatUsd(room.volumeUsdc)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Mobile room list */}
        <div className="border-b border-zinc-900/80 bg-black/40 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">AlfaClub</p>
              <h1 className="text-base font-semibold text-zinc-100">Trading rooms</h1>
            </div>
            <button
              type="button"
              onClick={() => setMobileListOpen((open) => !open)}
              className="rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/[0.08]"
              aria-expanded={mobileListOpen}
            >
              {mobileListOpen ? 'Hide list' : 'Browse rooms'}
            </button>
          </div>
          {mobileListOpen ? (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter by name or ID…"
                  className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-2xl bg-black/30 p-2 ring-1 ring-white/[0.05]">
                {filteredRooms.map((room) => {
                  const active = room.roomId === selectedRoomId
                  return (
                    <button
                      key={room.roomId}
                      type="button"
                      onClick={() => selectRoom(room.roomId)}
                      className={cn(
                        'mb-1 w-full rounded-xl px-2.5 py-2 text-left text-sm',
                        active ? 'bg-sky-500/15 text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.04]',
                      )}
                    >
                      <span className="truncate font-medium">{roomLabel(room)}</span>
                      <span className="ml-2 font-mono text-[10px] text-zinc-500">#{room.roomId}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:pl-[19rem]">
          {!selectedRoomId ? (
            <div className="rounded-3xl bg-black/40 p-6 ring-1 ring-white/[0.05]">
              <h2 className="headline text-2xl tracking-tight text-zinc-100">Pick a trading room</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                The left sidebar lists every AlfaClub trading room in the latest snapshot, sorted by
                volume. Select one to open links for AlfaClub chat and key-safety analysis.
              </p>
            </div>
          ) : selectedRoom ? (
            <div className="space-y-4">
              <header className="rounded-3xl bg-black/40 p-6 ring-1 ring-white/[0.05]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-sky-200/80">#{selectedRoom.roomId}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] capitalize ring-1',
                      tierBadgeClass(selectedRoom.tier),
                    )}
                  >
                    {selectedRoom.tier ?? 'unknown'} tier
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Trading room</span>
                </div>
                <h2 className="headline mt-2 text-2xl tracking-tight text-zinc-100 sm:text-3xl">
                  {roomLabel(selectedRoom)}
                </h2>
                {selectedHandle ? (
                  <p className="mt-1 text-sm text-zinc-400">by @{selectedHandle}</p>
                ) : null}

                <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-black/30 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Volume</dt>
                    <dd className="mt-0.5 font-mono text-base tabular-nums text-zinc-100">
                      {formatUsd(selectedRoom.volumeUsdc)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-black/30 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Key supply</dt>
                    <dd className="mt-0.5 font-mono text-base tabular-nums text-zinc-100">
                      {selectedRoom.keySupply?.toLocaleString() ?? '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-black/30 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Tier</dt>
                    <dd className="mt-0.5 text-base capitalize text-zinc-100">
                      {selectedRoom.tier ?? '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={`https://alfaclub.app/rooms/${selectedRoom.roomId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
                  >
                    Open on AlfaClub
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <Link
                    to={`/safety?roomId=${encodeURIComponent(selectedRoom.roomId)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.08]"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    Key safety
                  </Link>
                  <Link
                    to="/pools"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.08]"
                  >
                    <Droplets className="h-3.5 w-3.5" aria-hidden />
                    Liquidity pools
                  </Link>
                </div>
              </header>
            </div>
          ) : (
            <div className="rounded-3xl bg-black/40 p-6 ring-1 ring-white/[0.05]">
              <h2 className="text-lg font-semibold text-zinc-100">Room #{selectedRoomId}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                This room is not in the current snapshot list. You can still open it on AlfaClub or
                run key-safety analysis by ID.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://alfaclub.app/rooms/${selectedRoomId}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
                >
                  Open on AlfaClub
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <Link
                  to={`/safety?roomId=${encodeURIComponent(selectedRoomId)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/[0.08]"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Key safety
                </Link>
                <Link
                  to="/pools"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/[0.08]"
                >
                  <Droplets className="h-3.5 w-3.5" aria-hidden />
                  Liquidity pools
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
