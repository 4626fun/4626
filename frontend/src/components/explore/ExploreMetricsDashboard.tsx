import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/apiBase'
import { API_ENDPOINTS } from '@/lib/apiEndpoints'
import type { ApiEnvelope } from '@/lib/apiEnvelope'
import type { ExploreMetricHistoryPoint } from './ExploreMetricSparkline'

type ExploreMetrics = {
  scope: 'creators'
  updatedAt: string
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    creatorCoinsFees24hUsd: number | null
  }
  history30d: ExploreMetricHistoryPoint[]
}

type ExploreMetricsDashboardProps = {
  className?: string
}

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

function formatCompactUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ')
}

export function ExploreMetricsDashboard({ className }: ExploreMetricsDashboardProps) {
  const metricsQuery = useQuery({
    queryKey: ['explore', 'creators', 'metrics', 'shared-dashboard'],
    queryFn: fetchExploreCreatorsMetrics,
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    retry: 1,
  })

  const totals = metricsQuery.data?.totals
  const updatedAt = metricsQuery.data?.updatedAt ?? null
  const status = metricsQuery.data?.syncStatus ?? 'idle'
  const exact = metricsQuery.data?.exact === true

  const statusLine = useMemo(() => {
    if (!updatedAt) return 'Loading canonical market totals...'
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

  return (
    <div className={joinClasses('space-y-2', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">Creators</div>
          <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
            {creatorsTotal != null ? creatorsTotal.toLocaleString() : '—'}
          </div>
          <div className="app-meta-value mt-0.5 hidden sm:block">
            {creatorsNew24h != null ? `+${creatorsNew24h.toLocaleString()} today` : 'Tracking newly created creators'}
          </div>
        </div>

        <div className="vault-surface-elevated vault-hover-lift rounded-xl sm:rounded-2xl border-blue-300/30 bg-blue-950/16 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="text-[10px] sm:text-[11px] font-medium text-zinc-400">Market Cap</div>
          <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
            {formatCompactUsd(marketCap)}
          </div>
          <div className="app-meta-value mt-0.5 hidden sm:block">
            Live market-cap snapshot
          </div>
        </div>

        <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Vol</div>
          <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
            {formatCompactUsd(volume24h)}
          </div>
          <div className="app-meta-value mt-0.5 hidden sm:block">
            24H trade volume across creator coins
          </div>
        </div>

        <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Fees</div>
          <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
            {formatCompactUsd(fees24h)}
          </div>
          <div className="app-meta-value mt-0.5 hidden sm:block">
            24H fees from creator-coin trading
          </div>
        </div>
      </div>

      <div className="app-meta-value text-right text-zinc-500/90">{statusLine}</div>
    </div>
  )
}
