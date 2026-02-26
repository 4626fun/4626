import { useState } from 'react'
import { DetailsSheet } from '@/components/trade/DetailsSheet'

type InfoStripProps = {
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

function formatRate(amountIn: string, estimatedOut: string, symIn: string, symOut: string): string {
  const inN = Number(amountIn)
  const outN = Number(estimatedOut)
  if (!Number.isFinite(inN) || inN <= 0 || !Number.isFinite(outN) || outN <= 0) return '--'
  const rate = outN / inN
  if (rate >= 1000) return `1 ${symIn} = ${rate.toFixed(0)} ${symOut}`
  if (rate >= 1) return `1 ${symIn} = ${rate.toFixed(2)} ${symOut}`
  return `1 ${symIn} = ${rate.toFixed(6)} ${symOut}`
}

function Chip(props: {
  label: string
  value: string
  stale?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary ${
        props.stale
          ? 'border-amber-400/25 bg-amber-500/8 text-amber-300 hover:bg-amber-500/12'
          : 'border-white/8 bg-vault-card/60 text-zinc-300 hover:bg-white/8 hover:text-zinc-100'
      }`}
    >
      <span className="text-zinc-500">{props.label}:</span>
      <span className="font-medium tabular-nums">{props.value}</span>
    </button>
  )
}

export function InfoStrip(props: InfoStripProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const rateLabel = formatRate(props.amountInUnits, props.estimatedOut, props.tokenInSymbol, props.tokenOutSymbol)

  const routeLabel = props.routeSummary
    ? props.routeSummary.length > 18
      ? props.routeSummary.slice(0, 18) + '…'
      : props.routeSummary
    : 'Smart routed'

  const chips = [
    { label: 'Rate', value: rateLabel },
    { label: 'Slippage', value: `${props.parsedSlippage}%` },
    { label: 'Network', value: props.gasEstimateLabel ?? '--' },
    { label: 'Route', value: routeLabel },
  ]

  return (
    <>
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {chips.map((chip) => (
          <Chip
            key={chip.label}
            label={chip.label}
            value={chip.value}
            stale={chip.label === 'Rate' && props.quoteIsStale}
            onClick={() => setDetailsOpen(true)}
          />
        ))}
      </div>

      <DetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        tokenInSymbol={props.tokenInSymbol}
        tokenOutSymbol={props.tokenOutSymbol}
        amountInUnits={props.amountInUnits}
        estimatedOut={props.estimatedOut}
        parsedSlippage={props.parsedSlippage}
        quoteUpdatedAt={props.quoteUpdatedAt}
        quoteIsStale={props.quoteIsStale}
        priceImpactLabel={props.priceImpactLabel}
        gasEstimateLabel={props.gasEstimateLabel}
        routeSummary={props.routeSummary}
      />
    </>
  )
}
