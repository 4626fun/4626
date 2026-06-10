import type { ReactNode } from 'react'

import type { MarketSummary } from './types'

function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
}

function distanceToLiqPct(params: {
  side: 'long' | 'short' | null
  mark: number | null
  liq: number | null
}): number | null {
  const { side, mark, liq } = params
  if (side == null || mark == null || liq == null || mark <= 0) return null
  // Percentage move from mark to liquidation (always reported as a positive cushion).
  return Math.abs((liq - mark) / mark) * 100
}

export function PositionsMarketSignal(props: {
  summary: MarketSummary | null
  lastPrice: number | null
  roomWideMessageCount: number
}) {
  const { summary } = props
  if (!summary) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5 text-sm text-zinc-400">
        Select a market to view its position and social signal.
      </div>
    )
  }

  const position = summary.currentPosition
  const winRate =
    summary.closedCount > 0
      ? Math.round((summary.winningClosedCount / summary.closedCount) * 100)
      : null
  const liqCushion = position
    ? distanceToLiqPct({ side: position.side, mark: props.lastPrice, liq: position.liquidationPrice })
    : null

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">Market signal</div>
          <div className="mt-1 text-xl font-semibold text-zinc-100">{summary.market}</div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
            position?.side === 'long'
              ? 'bg-emerald-400/15 text-emerald-300'
              : position?.side === 'short'
                ? 'bg-rose-400/15 text-rose-300'
                : 'bg-white/5 text-zinc-400'
          }`}
        >
          {position?.side ? `${position.side} open` : 'no open position'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* Current position */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Current position</div>
          {position ? (
            <div className="mt-2 space-y-1.5 text-xs">
              <Row label="Size" value={formatUsd(position.sizeUsd, 0)} />
              <Row label="Entry" value={formatPrice(position.entryPrice)} />
              <Row label="Mark" value={formatPrice(props.lastPrice)} />
              <Row
                label="uPnL"
                value={
                  <span
                    className={
                      (position.unrealizedPnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }
                  >
                    {(position.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}
                    {formatUsd(position.unrealizedPnlUsd)}
                  </span>
                }
              />
              <Row label="Liq" value={formatPrice(position.liquidationPrice)} />
              {position.leverage != null && (
                <Row label="Leverage" value={`${position.leverage.toFixed(1)}x`} />
              )}
              {liqCushion != null && (
                <Row
                  label="Liq cushion"
                  value={
                    <span className={liqCushion < 10 ? 'text-rose-300' : 'text-zinc-100'}>
                      {liqCushion.toFixed(1)}%
                    </span>
                  }
                />
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-400">Flat — no live exposure in this market.</div>
          )}
        </div>

        {/* Historical indicator */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            Historical (this window)
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <Row
              label="Realized P/L"
              value={
                <span className={summary.realizedPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {summary.realizedPnlUsd >= 0 ? '+' : ''}
                  {formatUsd(summary.realizedPnlUsd)}
                </span>
              }
            />
            <Row label="Trades" value={String(summary.tradeCount)} />
            <Row label="Closes" value={String(summary.closedCount)} />
            <Row label="Win rate" value={winRate != null ? `${winRate}%` : 'n/a'} />
          </div>
        </div>

        {/* Social signal */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Social signal</div>
          <div className="mt-2 space-y-1.5 text-xs">
            <Row label="Market messages" value={String(summary.messageCount)} />
            <Row label="Room-wide messages" value={String(props.roomWideMessageCount)} />
            <div className="pt-1 text-[11px] text-zinc-500">
              Market messages reference {summary.coin}; room-wide messages are general chatter shown
              across markets.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row(props: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{props.label}</span>
      <span className="text-zinc-100">{props.value}</span>
    </div>
  )
}
