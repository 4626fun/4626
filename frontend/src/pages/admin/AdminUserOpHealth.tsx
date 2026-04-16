import { useQuery } from '@tanstack/react-query'
import { RefreshCw, ShieldAlert, Activity, Clock, Zap, AlertTriangle } from 'lucide-react'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { LoadingText } from '@/components/ui/LoadingState'

type SignatureModeStat = { mode: string; count: number }
type PaymasterModeStat = { mode: string; count: number }
type ErrorCodeStat = { code: string; count: number }

type WindowStats = {
  batchCount: number
  totalSamples: number
  successCount: number
  errorCount: number
  timeoutCount: number
  successRate: number | null
  fallbackToSelfFundedCount: number
  fallbackRate: number | null
  ownerIsContractCount: number
  avgP50Ms: number | null
  avgP95Ms: number | null
  avgP99Ms: number | null
  signatureModeBreakdown: SignatureModeStat[]
  paymasterModeBreakdown: PaymasterModeStat[]
  topErrorCodes: ErrorCodeStat[]
  firstEventAt: string | null
  lastEventAt: string | null
}

type UserOpHealthResponse = {
  admin: string
  source: string
  event: string
  windows: {
    last24h: WindowStats
    last7d: WindowStats
  }
}

type PaymasterHealth = {
  endpointConfigured: boolean
  ok: boolean
  error: string | null
}

type HealthResponse = {
  ok: boolean
  time: string
  paymaster: PaymasterHealth
}

async function fetchUserOpHealth(): Promise<UserOpHealthResponse> {
  const res = await apiFetch('/api/admin/userop/health', { withCredentials: true })
  const json = (await res.json()) as ApiEnvelope<UserOpHealthResponse>
  if (!res.ok || !json.success || !json.data) {
    const message = typeof json.error === 'string' && json.error ? json.error : `HTTP ${res.status}`
    throw new Error(message)
  }
  return json.data
}

async function fetchInfraHealth(): Promise<HealthResponse | null> {
  try {
    const res = await apiFetch('/api/health', { withCredentials: true })
    if (!res.ok) return null
    const json = (await res.json()) as HealthResponse
    return json
  } catch {
    return null
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)}%`
}

function formatMs(value: number | null): string {
  if (value === null) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`
  return `${value}ms`
}

function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function StatCard(props: { label: string; value: string; sublabel?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const toneRing =
    props.tone === 'good'
      ? 'border-emerald-400/20 bg-emerald-400/5'
      : props.tone === 'warn'
        ? 'border-amber-400/20 bg-amber-400/5'
        : props.tone === 'bad'
          ? 'border-red-400/20 bg-red-400/5'
          : 'border-white/10 bg-black/30'
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneRing}`}>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className="mt-1 font-display text-2xl text-white">{props.value}</div>
      {props.sublabel ? <div className="mt-1 text-[11px] text-zinc-500">{props.sublabel}</div> : null}
    </div>
  )
}

function BreakdownList(props: {
  title: string
  items: Array<{ label: string; count: number }>
  emptyLabel: string
  total: number
}) {
  if (props.items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">{props.title}</div>
        <div className="mt-2 text-xs text-zinc-500">{props.emptyLabel}</div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{props.title}</div>
      <div className="mt-3 space-y-1.5">
        {props.items.map((item) => {
          const pct = props.total > 0 ? (item.count / props.total) * 100 : 0
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-zinc-300" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500">
                {formatNumber(item.count)}
                {props.total > 0 ? ` · ${pct.toFixed(1)}%` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WindowPanel(props: { label: string; stats: WindowStats }) {
  const { stats } = props
  const successTone: 'good' | 'warn' | 'bad' | 'neutral' =
    stats.successRate === null ? 'neutral' : stats.successRate >= 95 ? 'good' : stats.successRate >= 80 ? 'warn' : 'bad'
  const fallbackTone: 'good' | 'warn' | 'neutral' =
    stats.fallbackRate === null ? 'neutral' : stats.fallbackRate <= 5 ? 'good' : 'warn'
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg text-white">{props.label}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {stats.batchCount === 0
              ? 'No telemetry batches in this window'
              : `${formatNumber(stats.batchCount)} batches · last event ${formatAbsoluteTime(stats.lastEventAt)}`}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Success rate" value={formatPercent(stats.successRate)} sublabel={`${formatNumber(stats.successCount)} / ${formatNumber(stats.successCount + stats.errorCount + stats.timeoutCount)}`} tone={successTone} />
        <StatCard label="Samples" value={formatNumber(stats.totalSamples)} sublabel="UserOp observations" />
        <StatCard
          label="Self-funded fallback"
          value={formatPercent(stats.fallbackRate)}
          sublabel={`${formatNumber(stats.fallbackToSelfFundedCount)} of ${formatNumber(stats.totalSamples)}`}
          tone={fallbackTone}
        />
        <StatCard label="Errors / Timeouts" value={`${formatNumber(stats.errorCount)} / ${formatNumber(stats.timeoutCount)}`} sublabel="Across all batches" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="p50 latency" value={formatMs(stats.avgP50Ms)} sublabel="weighted by samples" />
        <StatCard label="p95 latency" value={formatMs(stats.avgP95Ms)} sublabel="weighted by samples" />
        <StatCard label="p99 latency" value={formatMs(stats.avgP99Ms)} sublabel="weighted by samples" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <BreakdownList
          title="Paymaster mode"
          items={stats.paymasterModeBreakdown.map((s) => ({ label: s.mode, count: s.count }))}
          emptyLabel="No paymaster mode data"
          total={stats.totalSamples}
        />
        <BreakdownList
          title="Signature mode"
          items={stats.signatureModeBreakdown.map((s) => ({ label: s.mode, count: s.count }))}
          emptyLabel="No signature mode data"
          total={stats.totalSamples}
        />
        <BreakdownList
          title="Top error codes"
          items={stats.topErrorCodes.map((s) => ({ label: s.code, count: s.count }))}
          emptyLabel="No errors in window"
          total={stats.errorCount}
        />
      </div>
    </div>
  )
}

export function AdminUserOpHealth() {
  const telemetry = useQuery({
    queryKey: ['admin', 'userop-health'],
    queryFn: fetchUserOpHealth,
    staleTime: 60_000,
  })
  const infra = useQuery({
    queryKey: ['admin', 'userop-health', 'infra'],
    queryFn: fetchInfraHealth,
    staleTime: 60_000,
  })

  const paymaster = infra.data?.paymaster ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-2xl text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-primary" /> UserOp / Paymaster Health
          </div>
          <div className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Aggregated from browser-sampled telemetry batches (event{' '}
            <code className="text-zinc-400">xmtp_userop_submission_batch</code>) plus live paymaster probe from{' '}
            <code className="text-zinc-400">/api/health</code>. Numbers are sampled, not exhaustive — use for trendspotting, not
            billing reconciliation.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void telemetry.refetch()
            void infra.refetch()
          }}
          disabled={telemetry.isFetching || infra.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:border-white/20 hover:text-white transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${telemetry.isFetching || infra.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
          <Zap className="w-3.5 h-3.5" /> Paymaster probe
        </div>
        {infra.isLoading ? (
          <div className="mt-2 text-xs text-zinc-400">
            <LoadingText size="sm" labelOverride="Checking paymaster…" />
          </div>
        ) : paymaster ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${paymaster.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-zinc-300">{paymaster.ok ? 'Reachable' : 'Not reachable'}</span>
            </div>
            <div className="text-zinc-500">Endpoint configured: {paymaster.endpointConfigured ? 'yes' : 'no'}</div>
            <div className="text-zinc-500 truncate" title={paymaster.error ?? ''}>
              {paymaster.error ? `Error: ${paymaster.error}` : 'No errors reported'}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Could not read /api/health
          </div>
        )}
      </div>

      {telemetry.isLoading ? (
        <div className="text-sm text-zinc-400">
          <LoadingText size="sm" labelOverride="Loading telemetry…" />
        </div>
      ) : telemetry.isError ? (
        <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          {telemetry.error instanceof Error ? telemetry.error.message : 'Failed to load UserOp telemetry'}
        </div>
      ) : telemetry.data ? (
        <div className="space-y-4">
          <WindowPanel label="Last 24 hours" stats={telemetry.data.windows.last24h} />
          <WindowPanel label="Last 7 days" stats={telemetry.data.windows.last7d} />
          <div className="text-[11px] text-zinc-600 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Source: <code className="text-zinc-500">{telemetry.data.source}</code> · event{' '}
            <code className="text-zinc-500">{telemetry.data.event}</code>
          </div>
        </div>
      ) : null}
    </div>
  )
}
