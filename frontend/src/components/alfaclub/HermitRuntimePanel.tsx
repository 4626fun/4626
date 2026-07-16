import { RefreshCw } from 'lucide-react'

import { useHermitRuntimeStatus } from '@/hooks/useHermitRuntimeStatus'
import type { HermitRuntimeEventStatus } from '@/lib/alfaclub/hermitRuntimeStatus'
import { cn } from '@/lib/shared/utils'

const STATUS_STYLE: Record<HermitRuntimeEventStatus, string> = {
  executed: 'text-emerald-300',
  failed: 'text-red-300',
  blocked: 'text-amber-300',
  rejected: 'text-orange-300',
  incomplete: 'text-zinc-300',
  unknown: 'text-fuchsia-300',
  pending: 'text-sky-300',
}

function formatRoomList(roomIds: string[]): string {
  if (roomIds.length === 0) return '—'
  return roomIds.map((roomId) => `#${roomId}`).join(', ')
}

function formatRelativeMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return 'n/a'
  if (minutes < 0) return `${Math.abs(minutes)}m ago`
  return `${minutes}m`
}

export function HermitRuntimePanel() {
  const status = useHermitRuntimeStatus({ limit: 18 })

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Hermit4626 runtime telemetry</p>
          <h3 className="mt-1 text-sm font-medium text-zinc-200">Room trade-read coverage and misfire log</h3>
        </div>
        <button
          type="button"
          onClick={() => status.refetch()}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Refresh
        </button>
      </div>

      {status.isLoading ? (
        <p className="mt-4 text-xs text-zinc-500" role="status">
          Loading Hermit runtime…
        </p>
      ) : status.error ? (
        <p className="mt-4 text-xs text-red-300" role="alert">
          {(status.error as Error).message || 'Unable to load Hermit runtime telemetry.'}
        </p>
      ) : status.data ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <dt className="text-zinc-500">Configured reaction rooms</dt>
              <dd className="mt-1 font-mono text-zinc-200">
                {formatRoomList(status.data.reactionRooms.configured)}
              </dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <dt className="text-zinc-500">Runtime reaction rooms</dt>
              <dd className="mt-1 font-mono text-zinc-200">
                {formatRoomList(status.data.reactionRooms.runtime)}
              </dd>
            </div>
          </dl>

          {status.data.bridgeAuth ? (
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <StatCell label="JWT TTL" value={formatRelativeMinutes(status.data.bridgeAuth.liveJwtMinutesUntilExpiry)} />
              <StatCell label="Auth fails" value={String(status.data.bridgeAuth.consecutiveAuthFailures)} />
              <StatCell
                label="CF challenges"
                value={`${status.data.bridgeAuth.consecutiveCfChallenges}${status.data.bridgeAuth.cfChallengeSustained ? ' ⚠' : ''}`}
              />
              <StatCell label="WS backoff" value={`${status.data.bridgeAuth.socketBackoffMs}ms`} />
            </dl>
          ) : (
            <p className="text-xs text-zinc-500">Bridge auth telemetry unavailable.</p>
          )}

          <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            <StatCell label="24h total" value={String(status.data.events.last24h.total)} />
            <StatCell label="Executed" value={String(status.data.events.last24h.executed)} />
            <StatCell label="Failed" value={String(status.data.events.last24h.failed)} />
            <StatCell label="Blocked" value={String(status.data.events.last24h.blocked)} />
            <StatCell label="Rejected" value={String(status.data.events.last24h.rejected)} />
            <StatCell label="Pending" value={String(status.data.events.last24h.pending)} />
          </dl>

          <div>
            <p className="text-xs text-zinc-500">Recent events</p>
            {status.data.events.recent.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-500">No recent room decisions logged.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {status.data.events.recent.slice(0, 6).map((event) => (
                  <div key={event.decisionId} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium uppercase', STATUS_STYLE[event.status])}>{event.status}</span>
                      <span className="text-zinc-600">{new Date(event.observedAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-zinc-300">
                      #{event.roomId} · {event.sourceSide} {event.market} → {event.inverseSide}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      {event.authorLabel ?? 'unknown'}{event.reasonCode ? ` · ${event.reasonCode}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">No runtime telemetry available.</p>
      )}
    </section>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-zinc-200">{value}</dd>
    </div>
  )
}
