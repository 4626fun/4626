import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

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
    idempotencyFingerprint: string | null
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
    data?: Record<string, unknown>
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
    runAt?: string
    claimedBy?: string | null
    claimExpiresAt?: string | null
    createdAt: string
    updatedAt: string
  }>
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

async function fetchControlPlaneStatus(params: {
  stuckMinutes: number
  limit: number
}): Promise<AdminControlPlaneStatusResponse> {
  const qs = new URLSearchParams({
    stuckMinutes: String(params.stuckMinutes),
    limit: String(params.limit),
  })
  const res = await apiFetch(`/api/admin/control-plane/status?${qs.toString()}`, { withCredentials: true })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminControlPlaneStatusResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to load control-plane status (${res.status})`)
  }
  return json.data
}

async function fetchOperationDetail(params: {
  operationId: string
  eventsLimit: number
  jobsLimit: number
}): Promise<AdminControlPlaneOperationDetail> {
  const qs = new URLSearchParams({
    operationId: params.operationId,
    eventsLimit: String(params.eventsLimit),
    jobsLimit: String(params.jobsLimit),
  })
  const res = await apiFetch(`/api/admin/control-plane/operation?${qs.toString()}`, { withCredentials: true })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminControlPlaneOperationDetail> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to load operation (${res.status})`)
  }
  return json.data
}

async function queueProvision(input: {
  vaultAddress: string
  chainId?: number
  creatorAddress?: string
  strategyVariant?: string
}): Promise<{ accepted: boolean; operationId: string; stageId?: string }> {
  const res = await apiFetch('/api/admin/control-plane/provision', {
    method: 'POST',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accepted: boolean; operationId: string; stageId?: string }> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to queue provision (${res.status})`)
  }
  return json.data
}

async function queueMaintenance(input: {
  vaultAddress: string
}): Promise<{ accepted: boolean; operationId: string; stageId?: string }> {
  const res = await apiFetch('/api/admin/control-plane/maintenance', {
    method: 'POST',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accepted: boolean; operationId: string; stageId?: string }> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to queue maintenance (${res.status})`)
  }
  return json.data
}

async function queueCustomOperatorAction(input: {
  vaultAddress: string
  actionType: string
  payload?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<{ accepted: boolean; operationId: string; stageId?: string }> {
  const res = await apiFetch('/api/admin/control-plane/operator-action', {
    method: 'POST',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accepted: boolean; operationId: string; stageId?: string }> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || `Failed to queue operator action (${res.status})`)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOperationId = searchParams.get('operationId')?.trim() || ''
  const stuckMinutes = parseBoundedInt(searchParams.get('stuckMinutes'), 30, 1, 24 * 60)
  const limit = parseBoundedInt(searchParams.get('limit'), 20, 1, 200)
  const eventsLimit = parseBoundedInt(searchParams.get('eventsLimit'), 250, 1, 2_000)
  const jobsLimit = parseBoundedInt(searchParams.get('jobsLimit'), 100, 1, 1_000)
  const [operationInput, setOperationInput] = useState(selectedOperationId)
  const [queueVaultAddress, setQueueVaultAddress] = useState('')
  const [queueChainId, setQueueChainId] = useState('')
  const [queueCreatorAddress, setQueueCreatorAddress] = useState('')
  const [queueStrategyVariant, setQueueStrategyVariant] = useState('default')
  const [maintenanceVaultAddress, setMaintenanceVaultAddress] = useState('')
  const [actionVaultAddress, setActionVaultAddress] = useState('')
  const [actionType, setActionType] = useState('vault.sweep')
  const [actionPayloadText, setActionPayloadText] = useState('{"ccaStrategyAddress":""}')
  const [actionIdempotencyKey, setActionIdempotencyKey] = useState('')
  const [actionPayloadError, setActionPayloadError] = useState<string | null>(null)

  useEffect(() => {
    setOperationInput(selectedOperationId)
  }, [selectedOperationId])

  function updateQueryParams(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(updates)) {
          if (!value) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  const statusQuery = useQuery({
    queryKey: ['admin', 'control-plane', 'status', stuckMinutes, limit],
    queryFn: () => fetchControlPlaneStatus({ stuckMinutes, limit }),
    staleTime: 15_000,
  })

  const operationQuery = useQuery({
    queryKey: ['admin', 'control-plane', 'operation', selectedOperationId, eventsLimit, jobsLimit],
    queryFn: () => fetchOperationDetail({ operationId: selectedOperationId, eventsLimit, jobsLimit }),
    enabled: Boolean(selectedOperationId),
    staleTime: 10_000,
  })

  const statusError = statusQuery.error instanceof Error ? statusQuery.error.message : null
  const operationError = operationQuery.error instanceof Error ? operationQuery.error.message : null

  const provisionMutation = useMutation({
    mutationFn: queueProvision,
    onSuccess: (data) => {
      setOperationInput(data.operationId)
      updateQueryParams({ operationId: data.operationId })
      void statusQuery.refetch()
      void operationQuery.refetch()
    },
  })
  const maintenanceMutation = useMutation({
    mutationFn: queueMaintenance,
    onSuccess: (data) => {
      setOperationInput(data.operationId)
      updateQueryParams({ operationId: data.operationId })
      void statusQuery.refetch()
      void operationQuery.refetch()
    },
  })
  const actionMutation = useMutation({
    mutationFn: queueCustomOperatorAction,
    onSuccess: (data) => {
      setActionPayloadError(null)
      setOperationInput(data.operationId)
      updateQueryParams({ operationId: data.operationId })
      void statusQuery.refetch()
      void operationQuery.refetch()
    },
  })

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

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <div className="text-sm text-zinc-200">View Filters (URL synced)</div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-zinc-400 flex items-center gap-2">
            Stuck Minutes
            <select
              value={String(stuckMinutes)}
              onChange={(event) => updateQueryParams({ stuckMinutes: event.target.value })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200"
            >
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="120">120</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400 flex items-center gap-2">
            Status Limit
            <select
              value={String(limit)}
              onChange={(event) => updateQueryParams({ limit: event.target.value })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400 flex items-center gap-2">
            Events Limit
            <select
              value={String(eventsLimit)}
              onChange={(event) => updateQueryParams({ eventsLimit: event.target.value })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200"
            >
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400 flex items-center gap-2">
            Jobs Limit
            <select
              value={String(jobsLimit)}
              onChange={(event) => updateQueryParams({ jobsLimit: event.target.value })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-5">
        <div className="text-sm text-zinc-200">Queue Control-Plane Operations</div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            const chainId = queueChainId.trim() ? Number(queueChainId.trim()) : undefined
            if (chainId !== undefined && (!Number.isFinite(chainId) || chainId <= 0)) return
            provisionMutation.mutate({
              vaultAddress: queueVaultAddress.trim(),
              chainId,
              creatorAddress: queueCreatorAddress.trim() || undefined,
              strategyVariant: queueStrategyVariant.trim() || undefined,
            })
          }}
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">Provision</div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={queueVaultAddress}
              onChange={(event) => setQueueVaultAddress(event.target.value)}
              placeholder="vaultAddress"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              value={queueChainId}
              onChange={(event) => setQueueChainId(event.target.value)}
              placeholder="chainId (optional)"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              value={queueCreatorAddress}
              onChange={(event) => setQueueCreatorAddress(event.target.value)}
              placeholder="creatorAddress (optional)"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              value={queueStrategyVariant}
              onChange={(event) => setQueueStrategyVariant(event.target.value)}
              placeholder="strategyVariant"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <button
            type="submit"
            disabled={provisionMutation.isPending || !queueVaultAddress.trim()}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:border-white/20 disabled:opacity-60"
          >
            {provisionMutation.isPending ? 'Queueing...' : 'Queue Provision'}
          </button>
          {provisionMutation.error instanceof Error ? (
            <div className="text-xs text-red-300">{provisionMutation.error.message}</div>
          ) : null}
        </form>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            maintenanceMutation.mutate({
              vaultAddress: maintenanceVaultAddress.trim(),
            })
          }}
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">Maintenance</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={maintenanceVaultAddress}
              onChange={(event) => setMaintenanceVaultAddress(event.target.value)}
              placeholder="vaultAddress"
              className="min-w-[280px] flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={maintenanceMutation.isPending || !maintenanceVaultAddress.trim()}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:border-white/20 disabled:opacity-60"
            >
              {maintenanceMutation.isPending ? 'Queueing...' : 'Queue Maintenance'}
            </button>
          </div>
          {maintenanceMutation.error instanceof Error ? (
            <div className="text-xs text-red-300">{maintenanceMutation.error.message}</div>
          ) : null}
        </form>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            setActionPayloadError(null)
            let payload: Record<string, unknown> | undefined = undefined
            const raw = actionPayloadText.trim()
            if (raw) {
              try {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  payload = parsed as Record<string, unknown>
                } else {
                  throw new Error('Payload must be a JSON object')
                }
              } catch (error) {
                setActionPayloadError(error instanceof Error ? error.message : 'Invalid JSON payload')
                return
              }
            }
            actionMutation.mutate({
              vaultAddress: actionVaultAddress.trim(),
              actionType: actionType.trim(),
              payload,
              idempotencyKey: actionIdempotencyKey.trim() || undefined,
            })
          }}
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">Operator Action</div>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={actionVaultAddress}
              onChange={(event) => setActionVaultAddress(event.target.value)}
              placeholder="vaultAddress"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              value={actionType}
              onChange={(event) => setActionType(event.target.value)}
              placeholder="actionType"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              value={actionIdempotencyKey}
              onChange={(event) => setActionIdempotencyKey(event.target.value)}
              placeholder="idempotencyKey (optional)"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <textarea
            value={actionPayloadText}
            onChange={(event) => {
              setActionPayloadText(event.target.value)
              if (actionPayloadError) setActionPayloadError(null)
            }}
            rows={4}
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={actionMutation.isPending || !actionVaultAddress.trim() || !actionType.trim()}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:border-white/20 disabled:opacity-60"
          >
            {actionMutation.isPending ? 'Queueing...' : 'Queue Operator Action'}
          </button>
          {actionPayloadError ? <div className="text-xs text-red-300">{actionPayloadError}</div> : null}
          {actionMutation.error instanceof Error ? (
            <div className="text-xs text-red-300">{actionMutation.error.message}</div>
          ) : null}
        </form>
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
                      updateQueryParams({ operationId: op.operationId })
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
            updateQueryParams({ operationId: next })
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
              <div className="mt-2 grid gap-1 text-[11px] text-zinc-500">
                <div>
                  Policy {operationQuery.data.operation.policyVersion ?? '—'} · Lock{' '}
                  {operationQuery.data.operation.lockScope ?? '—'}:
                  {operationQuery.data.operation.lockKey ?? '—'}
                </div>
                <div>
                  Idempotency key {operationQuery.data.operation.idempotencyKey ?? '—'}
                </div>
                <div className="mono break-all">
                  Fingerprint {operationQuery.data.operation.idempotencyFingerprint ?? '—'}
                </div>
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
                        {event.data && Object.keys(event.data).length > 0 ? (
                          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-zinc-400">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        ) : null}
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
                        <div className="text-zinc-500">
                          dedupe {job.dedupeKey ?? '—'}
                          {job.runAt ? ` · run ${formatDateTime(job.runAt)}` : ''}
                        </div>
                        {job.claimedBy ? (
                          <div className="text-zinc-500">
                            lease {job.claimedBy}
                            {job.claimExpiresAt ? ` until ${formatDateTime(job.claimExpiresAt)}` : ''}
                          </div>
                        ) : null}
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

