import type { ReactNode } from 'react'

import type { MarketPosition, MarketSummary } from './types'

const COIN_LOGO_MAP: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: '/protocols/solana.svg',
  ZRO: '/protocols/layerzero-official.svg',
  HYPE: 'https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg',
}

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

function coinLogo(coin: string): string | null {
  if (!coin) return null
  return COIN_LOGO_MAP[coin.toUpperCase()] ?? null
}

function isLayerZeroCoin(coin: string): boolean {
  return coin.toUpperCase() === 'ZRO'
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
  roomPosition: MarketPosition | null
  agentPosition: MarketPosition | null
  lastPrice: number | null
  roomWideMessageCount: number
}) {
  const { summary } = props
  if (!summary) {
    return (
      <div className="rounded-2xl bg-white/[0.03] p-4 sm:p-5 text-sm text-zinc-400">
        Select a market to view its position and social signal.
      </div>
    )
  }

  const winRate =
    summary.closedCount > 0
      ? Math.round((summary.winningClosedCount / summary.closedCount) * 100)
      : null
  const roomLiqCushion = props.roomPosition
    ? distanceToLiqPct({
        side: props.roomPosition.side,
        mark: props.lastPrice,
        liq: props.roomPosition.liquidationPrice,
      })
    : null
  const agentLiqCushion = props.agentPosition
    ? distanceToLiqPct({
        side: props.agentPosition.side,
        mark: props.lastPrice,
        liq: props.agentPosition.liquidationPrice,
      })
    : null

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">Market signal</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            {coinLogo(summary.coin) ? (
              isLayerZeroCoin(summary.coin) ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <img
                    src={coinLogo(summary.coin)!}
                    alt={summary.coin}
                    className="h-3.5 w-3.5 object-contain"
                    loading="lazy"
                  />
                </span>
              ) : (
                <img
                  src={coinLogo(summary.coin)!}
                  alt={summary.coin}
                  className="h-5 w-5 rounded-full object-cover"
                  loading="lazy"
                />
              )
            ) : null}
            <span>{summary.market}</span>
          </div>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase text-zinc-400">
          room + agent live lanes
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Live positions */}
        <div className="rounded-xl bg-white/[0.02] p-2.5">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Live positions</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
            <PositionBlock
              title="Room"
              position={props.roomPosition}
              lastPrice={props.lastPrice}
              liqCushion={roomLiqCushion}
            />
            <PositionBlock
              title="Agent"
              position={props.agentPosition}
              lastPrice={props.lastPrice}
              liqCushion={agentLiqCushion}
            />
          </div>
        </div>

        {/* Historical indicator */}
        <div className="rounded-xl bg-white/[0.02] p-2.5">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            Historical (this window)
          </div>
          <div className="mt-2 space-y-1 text-xs">
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
        <div className="rounded-xl bg-white/[0.02] p-2.5">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Social signal</div>
          <div className="mt-2 space-y-1 text-xs">
            <Row label="Market messages" value={String(summary.messageCount)} />
            <Row label="Room-wide messages" value={String(props.roomWideMessageCount)} />
            <div className="pt-0.5 text-[10px] leading-snug text-zinc-500">
              Market messages reference {summary.coin}; room-wide messages are general.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PositionBlock(props: {
  title: string
  position: MarketPosition | null
  lastPrice: number | null
  liqCushion: number | null
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">{props.title}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            props.position?.side === 'long'
              ? 'bg-emerald-400/15 text-emerald-300'
              : props.position?.side === 'short'
                ? 'bg-rose-400/15 text-rose-300'
                : 'bg-white/5 text-zinc-400'
          }`}
        >
          {props.position?.side ? props.position.side : 'flat'}
        </span>
      </div>
      {props.position ? (
        <div className="space-y-1">
          <Row label="Size" value={formatUsd(props.position.sizeUsd, 0)} />
          <Row label="Entry" value={formatPrice(props.position.entryPrice)} />
          <Row label="Mark" value={formatPrice(props.lastPrice)} />
          <Row
            label="uPnL"
            value={
              <span
                className={
                  (props.position.unrealizedPnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }
              >
                {(props.position.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}
                {formatUsd(props.position.unrealizedPnlUsd)}
              </span>
            }
          />
          <Row label="Liq" value={formatPrice(props.position.liquidationPrice)} />
          {props.position.leverage != null && (
            <Row label="Leverage" value={`${props.position.leverage.toFixed(1)}x`} />
          )}
          {props.liqCushion != null && (
            <Row
              label="Liq cushion"
              value={
                <span className={props.liqCushion < 10 ? 'text-rose-300' : 'text-zinc-100'}>
                  {props.liqCushion.toFixed(1)}%
                </span>
              }
            />
          )}
        </div>
      ) : (
        <div className="text-xs text-zinc-400">No live exposure.</div>
      )}
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
