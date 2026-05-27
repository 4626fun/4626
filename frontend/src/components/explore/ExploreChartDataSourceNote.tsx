import { cn } from '@/lib/shared/utils'

type ExploreChartDataSourceNoteProps = {
  className?: string
  /** When fees are unavailable from the subgraph path. */
  feesUnavailable?: boolean
}

export function ExploreChartDataSourceNote({ className, feesUnavailable }: ExploreChartDataSourceNoteProps) {
  return (
    <p className={cn('text-[10px] text-zinc-600 leading-relaxed', className)}>
      Charts use Uniswap V4 pool history when indexed; otherwise Zora swap activity is used to build candles.
      {feesUnavailable ? ' Fee totals require subgraph fee events and may show as unavailable.' : null}
    </p>
  )
}
