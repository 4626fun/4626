import { ExternalLink, RefreshCw } from 'lucide-react'

import { useCounterTradeStatus } from '@/hooks/useCounterTradeStatus'

const ARENA_LINKS = [
  { label: 'Status', href: 'https://app.4626.fun/arena/view-status' },
  { label: 'Positions', href: 'https://app.4626.fun/arena/positions' },
  { label: 'Backtest', href: 'https://app.4626.fun/arena/backtest' },
] as const

export function CounterTradeStatusPanel({ showArenaLinks = false }: { showArenaLinks?: boolean }) {
  const status = useCounterTradeStatus()

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Inverse / counter-trade status</p>
          <h2 className="mt-1 text-sm font-medium text-zinc-200">Room 1659 strategy state</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            In-room command: <span className="font-mono text-zinc-300">/strategy status</span>
          </p>
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
          Loading strategy status…
        </p>
      ) : status.isAuthRequired ? (
        <p className="mt-4 text-xs text-amber-300">Sign in to view your strategy status.</p>
      ) : status.error ? (
        <p className="mt-4 text-xs text-red-300" role="alert">
          {(status.error as Error).message || 'Unable to load strategy status.'}
        </p>
      ) : status.data ? (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-zinc-500">Engine</dt>
              <dd className="mt-1 text-zinc-200">{status.data.engineEnabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Your state</dt>
              <dd className="mt-1 text-zinc-200">{status.data.user.state}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Global bias</dt>
              <dd className="mt-1 text-zinc-200">{status.data.strategy?.globalBias ?? 'neutral'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Preset</dt>
              <dd className="mt-1 text-zinc-200">{status.data.user.preset ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-zinc-500">Recent actions</p>
            {status.data.recentActions.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-500">No actions recorded yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {status.data.recentActions.slice(0, 3).map((action) => (
                  <div key={action.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-300">{action.status}</span>
                      <span className="text-zinc-600">{new Date(action.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-zinc-500">
                      {action.counterSide
                        ? `${action.counterSide} @ ${action.counterLeverage ?? '—'}x`
                        : 'No counter order'}
                      {' · '}
                      {action.counterNotionalUsd != null ? `$${action.counterNotionalUsd.toFixed(2)}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">No strategy status available.</p>
      )}

      {showArenaLinks ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
          {ARENA_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-white/[0.08] hover:bg-white/[0.08]"
            >
              Open Arena {link.label.toLowerCase()}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
