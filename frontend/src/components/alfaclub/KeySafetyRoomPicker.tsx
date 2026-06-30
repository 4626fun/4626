import { ChevronDown, Pencil, Search } from 'lucide-react'
import { useId, useState } from 'react'

import { formatAlfaClubRoomOptionLabel } from '@/lib/alfaclub/roomLabel'
import { cn } from '@/lib/shared/utils'

export type KeySafetyRoomOption = {
  roomId: string
  roomName: string
  displayLabel?: string
  creatorHandle: string | null
  keySupply: number | null
}

type KeySafetyRoomPickerProps = {
  roomIdDraft: string
  onRoomIdDraftChange: (value: string) => void
  onAnalyze: () => void
  selectedRoomId: string
  roomSearch: string
  onRoomSearchChange: (value: string) => void
  filteredRoomOptions: KeySafetyRoomOption[]
  onSelectRoom: (roomId: string) => void
  roomOptionsLoading: boolean
  roomOptionsError: string | null
  roomContextLoading: boolean
  roomContextError: string | null
  loadedRoomLabel: string | null
  /** Force the full picker form (skip the compact loaded summary). */
  alwaysShowForm?: boolean
}

function roomOptionLabel(room: KeySafetyRoomOption): string {
  return formatAlfaClubRoomOptionLabel({
    roomId: room.roomId,
    roomName: room.roomName,
    creatorHandle: room.creatorHandle,
    displayLabel: room.displayLabel,
    keySupply: room.keySupply,
  })
}

export function KeySafetyRoomPicker({
  roomIdDraft,
  onRoomIdDraftChange,
  onAnalyze,
  selectedRoomId,
  roomSearch,
  onRoomSearchChange,
  filteredRoomOptions,
  onSelectRoom,
  roomOptionsLoading,
  roomOptionsError,
  roomContextLoading,
  roomContextError,
  loadedRoomLabel,
  alwaysShowForm = false,
}: KeySafetyRoomPickerProps) {
  const roomIdInputId = useId()
  const browseSearchId = useId()
  const browseSelectId = useId()
  const canAnalyze = /^\d+$/.test(roomIdDraft.trim())
  const isLoaded = Boolean(loadedRoomLabel && selectedRoomId)
  const [expanded, setExpanded] = useState(false)

  // Collapse back to the compact summary whenever a new room is selected, using
  // the recommended "store previous value" pattern instead of an effect.
  const [prevRoomId, setPrevRoomId] = useState(selectedRoomId)
  if (selectedRoomId !== prevRoomId) {
    setPrevRoomId(selectedRoomId)
    setExpanded(false)
  }

  if (isLoaded && !expanded && !alwaysShowForm) {
    return (
      <div className="rounded-3xl bg-black/45 p-3 ring-1 ring-white/[0.05]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-xl bg-sky-500/10 px-2.5 py-1 font-mono text-xs text-sky-200 ring-1 ring-sky-400/20">
              #{selectedRoomId}
            </span>
            <span className="truncate text-sm font-medium text-zinc-100">{loadedRoomLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.08]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Change room
          </button>
        </div>
        {roomContextError ? (
          <p className={cn('mt-2 px-1 text-xs text-amber-300', roomContextLoading && 'opacity-70')} role="alert">
            {roomContextError}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-black/45 p-5 ring-1 ring-white/[0.05]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Step 1 · Choose room</p>

      <label htmlFor={roomIdInputId} className="mt-4 block text-sm text-zinc-300">
        Room ID
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={roomIdInputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={roomIdDraft}
          onChange={(event) => onRoomIdDraftChange(event.target.value.replace(/\D/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canAnalyze) onAnalyze()
          }}
          placeholder="e.g. 1659"
          className="min-w-0 flex-1 rounded-xl bg-black/45 px-3 py-2.5 font-mono text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/50"
        />
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze || roomContextLoading}
          className="shrink-0 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {roomContextLoading ? 'Loading…' : 'Analyze'}
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Works even if your room is not in the volume leaderboard yet — we resolve live onchain data.
      </p>

      <details className="group mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-300 [&::-webkit-details-marker]:hidden">
          <span>Browse top rooms by volume</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
          <label htmlFor={browseSearchId} className="sr-only">
            Filter rooms
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              id={browseSearchId}
              type="search"
              value={roomSearch}
              onChange={(event) => onRoomSearchChange(event.target.value)}
              placeholder="Filter by name or ID…"
              className="w-full rounded-xl bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-200 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/40"
            />
          </div>
          <label htmlFor={browseSelectId} className="sr-only">
            Select a room
          </label>
          <select
            id={browseSelectId}
            value={selectedRoomId}
            onChange={(event) => onSelectRoom(event.target.value)}
            className="w-full rounded-xl bg-black/45 px-3 py-2.5 text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/50"
          >
            <option value="">Choose a room…</option>
            {filteredRoomOptions.map((room) => (
              <option key={room.roomId} value={room.roomId}>
                {roomOptionLabel(room)}
              </option>
            ))}
          </select>
          {roomOptionsLoading ? (
            <p className="text-xs text-zinc-500" role="status">
              Loading room list…
            </p>
          ) : null}
          {roomOptionsError ? (
            <p className="text-xs text-amber-300" role="alert">
              {roomOptionsError}
            </p>
          ) : null}
        </div>
      </details>

      {roomContextError ? (
        <p className={cn('mt-3 text-xs text-amber-300', roomContextLoading && 'opacity-70')} role="alert">
          {roomContextError}
        </p>
      ) : null}
    </div>
  )
}
