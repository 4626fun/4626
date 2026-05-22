import { ExploreHeroMetric } from '@/components/explore/ExploreUiPrimitives'
import { LoadingText } from '@/components/ui/LoadingState'
import { formatCompactUsd } from '@/features/explore/exploreShared'
import { useExploreCreatorsHeroMetrics } from '@/features/explore/useExploreCreatorsHeroMetrics'

type ExploreMetricsDashboardProps = {
  className?: string
}

function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ')
}

export function ExploreMetricsDashboard({ className }: ExploreMetricsDashboardProps) {
  const {
    creatorsLabel,
    creatorsTotal,
    creatorsNew24h,
    marketCap,
    volume24h,
    fees24h,
    statusLine,
    isLoading,
    isFetching,
  } = useExploreCreatorsHeroMetrics()

  const creatorsMetricHint =
    creatorsNew24h != null && creatorsNew24h > 0
      ? `+${creatorsNew24h.toLocaleString()} today`
      : 'Tracking newly created creators'

  return (
    <div className={joinClasses('space-y-2', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <ExploreHeroMetric
          label={creatorsLabel}
          value={creatorsTotal != null ? creatorsTotal.toLocaleString() : '—'}
          hint={creatorsMetricHint}
          title={
            creatorsNew24h != null && creatorsNew24h > 0
              ? `+${creatorsNew24h.toLocaleString()} new in the last 24 hours`
              : 'Canonical creator-coin index size'
          }
        />
        <ExploreHeroMetric
          label="Market Cap"
          value={formatCompactUsd(marketCap)}
          hint="Indexed creator market cap"
          accent
          title="Indexed creator-coin market cap"
        />
        <ExploreHeroMetric
          label="1D Vol"
          value={formatCompactUsd(volume24h)}
          hint="24H trade volume"
          title="24H trade volume across creator coins"
        />
        <ExploreHeroMetric
          label="1D Fees"
          value={formatCompactUsd(fees24h)}
          hint="24H trading fees"
          title="24H fees from creator-coin trading"
        />
      </div>

      <div className="app-meta-value text-right text-zinc-500/90">
        {isLoading ? (
          <LoadingText intent="processing" size="sm" labelOverride="Loading explore metrics…" />
        ) : (
          <>
            {statusLine}
            {isFetching ? <span className="ml-2 text-zinc-600">Updating…</span> : null}
          </>
        )}
      </div>
    </div>
  )
}
