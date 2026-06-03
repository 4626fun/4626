import type { SwapRouteLeg } from '@/lib/swap/swapQuoteDetails'

type RouteDisplayProps = {
  routeSummary: string | null
  routeLegs?: SwapRouteLeg[]
  aggregator?: string
  executionPrice?: string | null
  marketPrice?: string | null
}

function RouteTokenPath({ routeSummary }: { routeSummary: string }) {
  const tokens = routeSummary
    .split(/\s*(?:→|->)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (tokens.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tokens.map((token, index) => (
        <span key={`${token}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <span className="text-[10px] text-zinc-600">→</span> : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
            {token}
          </span>
        </span>
      ))}
    </div>
  )
}

export function RouteDisplay({
  routeSummary,
  routeLegs = [],
  aggregator,
  executionPrice,
  marketPrice,
}: RouteDisplayProps) {
  if (!routeSummary && routeLegs.length === 0 && !aggregator && !executionPrice && !marketPrice) {
    return null
  }

  return (
    <div className="rounded-xl border border-white/12 bg-linear-to-b from-white/8 to-white/3 p-3 backdrop-blur-sm">
      <div className="mb-2 text-xs font-medium text-zinc-300">Route preview</div>

      {routeSummary ? <RouteTokenPath routeSummary={routeSummary} /> : null}

      {routeLegs.length > 0 ? (
        <div className={routeSummary ? 'mt-3 space-y-1.5' : 'space-y-1.5'}>
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Liquidity pools</div>
          {routeLegs.map((leg, index) => (
            <div
              key={`${leg.protocolLabel}-${leg.tokenIn}-${leg.tokenOut}-${index}`}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0 text-zinc-300">
                <span className="font-medium">{leg.protocolLabel}</span>
                <span className="text-zinc-500"> · </span>
                <span className="text-zinc-400">
                  {leg.tokenIn}/{leg.tokenOut}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-zinc-200">{leg.feePercentLabel ?? '—'}</span>
            </div>
          ))}
        </div>
      ) : routeSummary ? null : (
        <div className="text-xs text-zinc-500">{aggregator ? `Routed via ${aggregator}` : 'Route unknown'}</div>
      )}

      <div className="app-meta-value mt-2 text-zinc-500 space-y-1">
        {aggregator ? (
          <div>
            Aggregator: <span className="text-zinc-300">{aggregator}</span>
          </div>
        ) : null}
        {executionPrice ? (
          <div>
            Execution price: <span className="text-zinc-300">{executionPrice}</span>
          </div>
        ) : null}
        {marketPrice ? (
          <div>
            Market price: <span className="text-zinc-300">{marketPrice}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
