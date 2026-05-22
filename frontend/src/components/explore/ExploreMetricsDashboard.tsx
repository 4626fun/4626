import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ExploreHeroMetric } from '@/components/explore/ExploreUiPrimitives'
import { LoadingText } from '@/components/ui/LoadingState'
import { formatCompactUsd } from '@/features/explore/exploreShared'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

type ExploreMetricHistoryPoint = {
  date: string
  creatorCoinsMarketCapUsd: number | null
}

type ExploreMetrics = {
  scope: 'creators'
  updatedAt: string
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
  sync?: {
    driftEstimateTotal: number | null
  }
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    creatorCoinsFees24hUsd: number | null
    ethosScoredCreators: number | null
    ethos1200Creators: number | null
    ethos1600Creators: number | null
    ethos1800Creators: number | null
  }
  history30d: ExploreMetricHistoryPoint[]
}

type ExploreMetricsDashboardProps = {
  className?: string
}

let cachedExploreMetrics: ExploreMetrics | null = null

async function fetchExploreCreatorsMetrics(): Promise<ExploreMetrics | null> {
  try {
    const res = await apiFetch(`${API_ENDPOINTS.zora.metrics}?scope=creators`, { method: 'GET' })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreMetrics | null> | null
    if (res.ok && json?.success) return json.data ?? null
  } catch {
    // Non-blocking metrics card.
  }
  return null
}

function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ')
}

export function ExploreMetricsDashboard({ className }: ExploreMetricsDashboardProps) {
  const metricsQuery = useQuery({
    queryKey: ['explore', 'creators', 'metrics', 'shared-dashboard'],
    queryFn: fetchExploreCreatorsMetrics,
    initialData: cachedExploreMetrics ?? undefined,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  useEffect(() => {
    if (metricsQuery.data) cachedExploreMetrics = metricsQuery.data
  }, [metricsQuery.data])

  const totals = metricsQuery.data?.totals
  const updatedAt = metricsQuery.data?.updatedAt ?? null
  const status = metricsQuery.data?.syncStatus ?? 'idle'
  const exact = metricsQuery.data?.exact === true
  const syncMeta = metricsQuery.data?.sync ?? null

  const statusLine = useMemo(() => {
    if (!updatedAt) return 'Canonical totals unavailable'
    const time = new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (status === 'error') return `Metrics refresh error — showing last known values (${time})`
    if (status === 'running' || !exact) return `Estimated totals refreshed ${time}`
    return `Canonical totals refreshed ${time}`
  }, [exact, status, updatedAt])

  const creatorsTotal = totals?.creatorsTotal
  const creatorsNew24h = totals?.creatorsNew24h
  const marketCap = totals?.creatorCoinsMarketCapUsd
  const volume24h = totals?.creatorCoinsVolume24hUsd
  const fees24h = totals?.creatorCoinsFees24hUsd
  const creatorsLabel = exact ? 'Creators' : 'Indexed creators'
  const creatorsMetricHint =
    creatorsNew24h != null
      ? `+${creatorsNew24h.toLocaleString()} today`
      : !exact && creatorsTotal != null && syncMeta?.driftEstimateTotal && syncMeta.driftEstimateTotal > creatorsTotal
        ? `~${syncMeta.driftEstimateTotal.toLocaleString()} on Zora`
        : !exact
          ? 'Still indexing creator coins'
          : null

  return (
    <div className={joinClasses('space-y-2', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <ExploreHeroMetric
          label={creatorsLabel}
          value={creatorsTotal != null ? creatorsTotal.toLocaleString() : '—'}
          hint={creatorsMetricHint ?? 'Tracking newly created creators'}
          title={
            creatorsNew24h != null
              ? `+${creatorsNew24h.toLocaleString()} new in the last 24 hours`
              : 'Canonical creator-coin index size'
          }
        />
        <ExploreHeroMetric
          label="Market Cap"
          value={formatCompactUsd(marketCap)}
          hint="Live market-cap snapshot"
          accent
          title="Live market-cap snapshot"
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
        {!updatedAt ? <LoadingText intent="processing" size="sm" labelOverride={statusLine} /> : statusLine}
      </div>
    </div>
  )
}
