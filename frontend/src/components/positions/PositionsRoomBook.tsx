import type { MarketPosition, MarketSummary } from './types'

const COIN_LOGO_MAP: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: '/protocols/solana.svg',
  ZRO: '/protocols/layerzero-official.svg',
  HYPE: 'https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg',
}

function formatUsdCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function coinLogo(coin: string): string | null {
  if (!coin) return null
  return COIN_LOGO_MAP[coin.toUpperCase()] ?? null
}

function isLayerZeroCoin(coin: string): boolean {
  return coin.toUpperCase() === 'ZRO'
}

/**
 * Compact "position book" for the room: every market with a live position (open) and every
 * market it has traded but is now flat (had). Clicking a pill selects that market.
 */
export function PositionsRoomBook(props: {
  summaries: MarketSummary[]
  currentPositions: MarketPosition[]
  selectedMarket: string
  onSelect: (market: string) => void
}) {
  if (props.summaries.length === 0) return null

  const openMarketMap = new Map<string, string>()
  for (const position of props.currentPositions) {
    if (position.side == null) continue
    if (!openMarketMap.has(position.market)) openMarketMap.set(position.market, position.coin)
  }
  const openMarkets = [...openMarketMap.entries()].map(([market, coin]) => ({ market, coin }))
  const openMarketSet = new Set(openMarkets.map((item) => item.market))
  const flat = props.summaries.filter((s) => !openMarketSet.has(s.market) && s.tradeCount > 0)

  return (
    <div className="rounded-2xl bg-white/[0.03] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="label">Room positions</span>
        <span className="text-[11px] text-zinc-500">
          {openMarkets.length} open · {flat.length} traded (flat)
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {/* Open positions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Open</span>
          {openMarkets.length === 0 ? (
            <span className="text-[11px] text-zinc-500">No live exposure.</span>
          ) : (
            openMarkets.map((position, index) => {
              const isSelected = position.market === props.selectedMarket
              return (
                <button
                  key={`${position.market}:${index}`}
                  type="button"
                  onClick={() => props.onSelect(position.market)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition ${
                    isSelected
                      ? 'bg-sky-400/10'
                      : 'bg-white/[0.03] hover:bg-sky-400/10'
                  }`}
                >
                  {coinLogo(position.coin) ? (
                    isLayerZeroCoin(position.coin) ? (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                        <img
                          src={coinLogo(position.coin)!}
                          alt={position.coin}
                          className="h-2.5 w-2.5 object-contain"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <img
                        src={coinLogo(position.coin)!}
                        alt={position.coin}
                        className="h-3.5 w-3.5 rounded-full object-cover"
                        loading="lazy"
                      />
                    )
                  ) : null}
                  <span className="font-semibold text-zinc-100">{position.coin}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Historically traded, now flat */}
        {flat.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Traded</span>
            {flat.map((s) => {
              const isSelected = s.market === props.selectedMarket
              return (
                <button
                  key={s.market}
                  type="button"
                  onClick={() => props.onSelect(s.market)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition ${
                    isSelected
                      ? 'bg-sky-400/10'
                      : 'bg-white/[0.02] hover:bg-sky-400/10'
                  }`}
                >
                  {coinLogo(s.coin) ? (
                    isLayerZeroCoin(s.coin) ? (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                        <img
                          src={coinLogo(s.coin)!}
                          alt={s.coin}
                          className="h-2.5 w-2.5 object-contain"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <img
                        src={coinLogo(s.coin)!}
                        alt={s.coin}
                        className="h-3.5 w-3.5 rounded-full object-cover"
                        loading="lazy"
                      />
                    )
                  ) : null}
                  <span className="font-medium text-zinc-300">{s.coin}</span>
                  <span className={s.realizedPnlUsd >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'}>
                    {s.realizedPnlUsd >= 0 ? '+' : ''}
                    {formatUsdCompact(s.realizedPnlUsd)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
