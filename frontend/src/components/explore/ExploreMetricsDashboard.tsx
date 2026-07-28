import { ExploreAnalyticsSyncBadge } from '@/components/explore/ExploreAnalyticsSyncBadge'
import { ExploreHeroMetric } from '@/components/explore/ExploreUiPrimitives'
import { ExploreHeroSparkline } from '@/components/explore/ExploreHeroSparkline'
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
    partial,
    history30d,
    isLoading,
    isRefreshing,
    exact,
    syncStatus,
  } = useExploreCreatorsHeroMetrics()

  const creatorsMetricHint =
    creatorsNew24h != null && creatorsNew24h > 0
      ? `+${creatorsNew24h.toLocaleString()} today`
      : 'Tracking newly created creators'

  const financialHint = partial ? 'Sum of indexed coins' : 'All Base creator coins'
  const financialTitleSuffix = partial ? ' (indexed coins only)' : ''
  const marketCapHint = partial
    ? 'Liquidity-filtered indexed mcap'
    : 'Liquidity-filtered Base creator coins'
  const feesHint = 'On-chain indexed (est. fallback)'

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
          hint={marketCapHint}
          accent
          title={`Liquidity-filtered creator-coin market cap${financialTitleSuffix} · excludes illiquid spoof FDV · 30D trend uses daily Supabase snapshots`}
          background={
            <ExploreHeroSparkline
              fill
              history={history30d}
              title={`Indexed creator-coin market cap trend · last ${history30d.length} daily snapshots`}
            />
          }
        />
        <ExploreHeroMetric
          label="1D Vol"
          value={formatCompactUsd(volume24h)}
          hint={financialHint}
          title={`24H trade volume${financialTitleSuffix}`}
        />
        <ExploreHeroMetric
          label="1D Fees"
          value={formatCompactUsd(fees24h)}
          hint={feesHint}
          title={`24H trading fees${financialTitleSuffix} · CoinMarketRewardsV4-indexed across active coins; volume × rate only when not yet indexed`}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="app-meta-value text-zinc-500/90 sm:flex-1">
          {isLoading ? (
            <div data-screenshot-hide="true">
              <LoadingText intent="processing" size="sm" labelOverride="Loading explore metrics…" />
            </div>
          ) : (
            <>
              {statusLine}
              {isRefreshing ? <span className="ml-2 text-zinc-600">Updating…</span> : null}
            </>
          )}
        </div>
        {!isLoading && syncStatus === 'error' ? (
          <ExploreAnalyticsSyncBadge exact={exact} syncStatus={syncStatus} />
        ) : null}
      </div>
    </div>
  )
}
