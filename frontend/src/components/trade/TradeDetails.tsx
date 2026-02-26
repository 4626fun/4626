import { useMemo, useState } from 'react'
import { ChevronDown, Clock3 } from 'lucide-react'

type TradeDetailsProps = {
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInUnits: string
  estimatedOut: string
  parsedSlippage: number
  quoteUpdatedAt: number | null
  quoteIsStale: boolean
  priceImpactLabel?: string | null
  gasEstimateLabel?: string | null
  routeSummary?: string | null
}

function formatRate(amountInUnits: string, estimatedOut: string, tokenInSymbol: string, tokenOutSymbol: string): string {
  const inNum = Number(amountInUnits)
  const outNum = Number(estimatedOut)
  if (!Number.isFinite(inNum) || inNum <= 0 || !Number.isFinite(outNum) || outNum <= 0) {
    return '--'
  }
  const rate = outNum / inNum
  return `1 ${tokenInSymbol} = ${rate.toFixed(6)} ${tokenOutSymbol}`
}

export function TradeDetails(props: TradeDetailsProps) {
  const [open, setOpen] = useState(false)
  const rateLabel = useMemo(
    () => formatRate(props.amountInUnits, props.estimatedOut, props.tokenInSymbol, props.tokenOutSymbol),
    [props.amountInUnits, props.estimatedOut, props.tokenInSymbol, props.tokenOutSymbol],
  )

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded-lg"
        aria-expanded={open}
      >
        <div className="text-xs font-medium text-zinc-500">Trade details</div>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-xs text-zinc-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Rate</span>
            <span className="tabular-nums">{rateLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Slippage tolerance</span>
            <span className="tabular-nums">{props.parsedSlippage}%</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Price impact</span>
            <span>{props.priceImpactLabel ?? '--'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Network cost</span>
            <span>{props.gasEstimateLabel ?? '--'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-zinc-500">Route</span>
            <span className="max-w-[70%] text-right">{props.routeSummary ?? '--'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <Clock3 className="h-3 w-3" />
              Quote state
            </span>
            <span className={props.quoteIsStale ? 'text-amber-300' : 'text-zinc-300'}>
              {props.quoteIsStale
                ? 'Expired'
                : props.quoteUpdatedAt
                  ? `Updated ${new Date(props.quoteUpdatedAt).toLocaleTimeString()}`
                  : 'Not quoted'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
