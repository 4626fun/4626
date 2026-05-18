import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { Spinner } from '@/components/ui/Spinner'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

type AdminControlPlaneStatusResponse = {
  admin: string
  operationCounts: Record<string, number>
  stageCounts: Record<string, number>
  keeperJobCounts: Record<string, number>
  stuck: {
    thresholdMinutes: number
    operations: Array<{
      operationId: string
      operationKind: string
      status: string
      scopeType: string
      scopeId: string
      ageMinutes: number
      updatedAt: string
    }>
  }
  recentFailures: Array<{
    operationId: string
    stageId: string | null
    eventType: string
    message: string
    createdAt: string
  }>
}

type AdminControlPlaneOperationDetail = {
  admin: string
  operation: {
    operationId: string
    operationKind: string
    status: string
    scopeType: string
    scopeId: string
    lockScope: string | null
    lockKey: string | null
    idempotencyKey: string | null
    policyVersion: string | null
    schemaVersion: string | null
    requestedBy: string | null
    errorCode: string | null
    errorMessage: string | null
    input: Record<string, unknown>
    result: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    finishedAt: string | null
  }
  stages: Array<{
    stageId: string
    stageKind: string
    status: string
    attemptCount: number
    errorCode: string | null
    errorMessage: string | null
    startedAt: string | null
    finishedAt: string | null
    createdAt: string
    updatedAt: string
  }>
  events: Array<{
    eventType: string
    stageId: string | null
    message: string
    createdAt: string
  }>
  jobs: Array<{
    id: number
    stageId: string | null
    kind: string
    status: string
    attemptCount: number
    maxAttempts: number
    dedupeKey: string | null
    source: string
    lastError: string | null
    createdAt: string
    updatedAt: string
  }>
}

async function fetchControlPlaneStatus(): Promise<AdminControlPlaneStatusResponse> {
  const res = await apiFetch('/api/admin/control-plane/status', { withCredentials: true })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminControlPlaneStatusResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to load control-plane status (${res.status})`)
  }
  return json.data
}

async function fetchOperationDetail(operationId: string): Promise<AdminControlPlaneOperationDetail> {
  const qs = new URLSearchParams({ operationId })
  const res = await apiFetch(`/api/admin/control-plane/operation?${qs.toString()}`, { withCredentials: true })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminControlPlaneOperationDetail> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to load operation (${res.status})`)
  }
  return json.data
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return value
  return d.toLocaleString()
}

function CountChips(props: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(props.counts).sort((a, b) => b[1] - a[1])
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{props.title}</div>
      {entries.length === 0 ? (
        <div className="mt-2 text-xs text-zinc-500">No rows</div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map(([status, count]) => (
            <span key={status} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-300">
              <span className="text-zinc-500">{status}</span> · <span className="tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminControlPlane() {
  const [operationInput, setOperationInput] = useState('')
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['admin', 'control-plane', 'status'],
    queryFn: fetchControlPlaneStatus,
    staleTime: 15_000,
  })

  const operationQuery = useQuery({
    queryKey: ['admin', 'control-plane', 'operation', selectedOperationId],
    queryFn: () => fetchOperationDetail(selectedOperationId!),
    enabled: Boolean(selectedOperationId),
    staleTime: 10_000,
  })

  const statusError = statusQuery.error instanceof Error ? statusQuery.error.message : null
  const operationError = operationQuery.error instanceof Error ? operationQuery.error.message : null

  const recentOperationIds = useMemo(
    () => statusQuery.data?.stuck.operations.map((op) => op.operationId) ?? [],
    [statusQuery.data?.stuck.operations],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-2xl text-white">Control Plane</div>
          <div className="text-xs text-zinc-500 mt-1">
            Read-only operator view for lifecycle status, stuck operations, and operation timelines.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void statusQuery.refetch()}
          disabled={statusQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
        >
          {statusQuery.isFetching ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {statusError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">{statusError}</div>
      ) : null}

      {statusQuery.isLoading ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
          <LoadingInline intent="processing" labelOverride="Loading control-plane status..." />
        </div>
      ) : null}

      {statusQuery.data ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <CountChips title="Operations" counts={statusQuery.data.operationCounts} />
            <CountChips title="Stages" counts={statusQuery.data.stageCounts} />
            <CountChips title="Keeper Jobs" counts={statusQuery.data.keeperJobCounts} />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-sm text-zinc-200">Stuck Operations</div>
              <div className="text-[11px] text-zinc-500">
                {statusQuery.data.stuck.operations.length} over {statusQuery.data.stuck.thresholdMinutes}m
              </div>
            </div>
            {statusQuery.data.stuck.operations.length === 0 ? (
              <div className="px-4 py-5 text-sm text-zinc-500">No stuck operations.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {statusQuery.data.stuck.operations.map((op) => (
                  <button
                    key={op.operationId}
                    type="button"
                    onClick={() => {
                      setSelectedOperationId(op.operationId)
                      setOperationInput(op.operationId)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="mono text-xs text-zinc-200">{op.operationId}</div>
                      <div className="text-[11px] text-amber-300">{op.ageMinutes}m</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {op.operationKind} · {op.status} · {op.scopeType}:{op.scopeId}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-sm text-zinc-200">Recent Failure Signals</div>
            {statusQuery.data.recentFailures.length === 0 ? (
              <div className="px-4 py-5 text-sm text-zinc-500">No recent failure/retry/manual-review events.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {statusQuery.data.recentFailures.slice(0, 20).map((event) => (
                  <div key={`${event.operationId}-${event.createdAt}-${event.eventType}`} className="px-4 py-3">
                    <div className="mono text-xs text-zinc-200">{event.operationId}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {event.eventType}
                      {event.stageId ? ` · ${event.stageId}` : ''} · {formatDateTime(event.createdAt)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">{event.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <div className="text-sm text-zinc-200">Operation Detail</div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const next = operationInput.trim()
            if (!next) return
            setSelectedOperationId(next)
          }}
        >
          <input
            value={operationInput}
            onChange={(event) => setOperationInput(event.target.value)}
            placeholder="op_..."
            className="min-w-[280px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Search className="w-4 h-4" />
            Load
          </button>
          <button
            type="button"
            onClick={() => void operationQuery.refetch()}
            disabled={!selectedOperationId || operationQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
          >
            {operationQuery.isFetching ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </form>

        {!selectedOperationId && recentOperationIds.length > 0 ? (
          <div className="text-xs text-zinc-500">
            Tip: click a stuck operation above or paste one of the recent IDs.
          </div>
        ) : null}

        {operationError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">{operationError}</div>
        ) : null}

        {operationQuery.data ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="mono text-xs text-zinc-200">{operationQuery.data.operation.operationId}</div>
              <div className="mt-1 text-xs text-zinc-400">
                {operationQuery.data.operation.operationKind} · {operationQuery.data.operation.status} ·{' '}
                {operationQuery.data.operation.scopeType}:{operationQuery.data.operation.scopeId}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Created {formatDateTime(operationQuery.data.operation.createdAt)} · Updated{' '}
                {formatDateTime(operationQuery.data.operation.updatedAt)}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Stages</div>
                <div className="mt-2 space-y-2">
                  {operationQuery.data.stages.length === 0 ? (
                    <div className="text-xs text-zinc-500">No stages</div>
                  ) : (
                    operationQuery.data.stages.map((stage) => (
                      <div key={stage.stageId} className="text-xs">
                        <div className="mono text-zinc-200">{stage.stageId}</div>
                        <div className="text-zinc-500">
                          {stage.stageKind} · {stage.status} · attempts {stage.attemptCount}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Events</div>
                <div className="mt-2 space-y-2 max-h-72 overflow-auto pr-1">
                  {operationQuery.data.events.length === 0 ? (
                    <div className="text-xs text-zinc-500">No events</div>
                  ) : (
                    operationQuery.data.events.map((event, idx) => (
                      <div key={`${event.createdAt}-${event.eventType}-${idx}`} className="text-xs">
                        <div className="text-zinc-200">{event.eventType}</div>
                        <div className="text-zinc-500">
                          {event.stageId ? `${event.stageId} · ` : ''}
                          {formatDateTime(event.createdAt)}
                        </div>
                        <div className="text-zinc-400">{event.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Keeper Jobs</div>
                <div className="mt-2 space-y-2 max-h-72 overflow-auto pr-1">
                  {operationQuery.data.jobs.length === 0 ? (
                    <div className="text-xs text-zinc-500">No jobs</div>
                  ) : (
                    operationQuery.data.jobs.map((job) => (
                      <div key={job.id} className="text-xs">
                        <div className="text-zinc-200">#{job.id} · {job.kind}</div>
                        <div className="text-zinc-500">
                          {job.status} · attempts {job.attemptCount}/{job.maxAttempts}
                        </div>
                        {job.lastError ? <div className="text-amber-300">{job.lastError}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : selectedOperationId && operationQuery.isLoading ? (
          <div className="text-sm text-zinc-400">
            <LoadingInline intent="processing" labelOverride="Loading operation detail..." />
          </div>
        ) : null}
      </div>
    </div>
  )
}

