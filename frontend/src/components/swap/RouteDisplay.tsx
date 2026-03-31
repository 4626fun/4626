import { RouteVisualization } from '@/components/trade/RouteVisualization'

type RouteDisplayProps = {
  routeSummary: string | null
  aggregator?: string
  executionPrice?: string | null
  marketPrice?: string | null
}

export function RouteDisplay({ routeSummary, aggregator, executionPrice, marketPrice }: RouteDisplayProps) {
  if (!routeSummary && !aggregator && !executionPrice && !marketPrice) {
    return null
  }

  return (
    <div className="rounded-xl border border-white/12 bg-linear-to-b from-white/8 to-white/3 p-3 backdrop-blur-sm">
      <div className="mb-2 text-xs font-medium text-zinc-300">Route preview</div>
      {routeSummary ? (
        <RouteVisualization routeSummary={routeSummary} compact />
      ) : (
        <div className="text-xs text-zinc-500">Route unknown</div>
      )}
      <div className="app-meta-value mt-2 text-zinc-500 space-y-1">
        {aggregator ? <div>Aggregator: <span className="text-zinc-300">{aggregator}</span></div> : null}
        {executionPrice ? <div>Execution price: <span className="text-zinc-300">{executionPrice}</span></div> : null}
        {marketPrice ? <div>Market price: <span className="text-zinc-300">{marketPrice}</span></div> : null}
      </div>
    </div>
  )
}
