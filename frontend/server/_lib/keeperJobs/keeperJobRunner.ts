import {
  claimDueKeeperJobs,
  completeKeeperJob,
  enqueueKeeperJob,
  releaseExpiredKeeperJobClaims,
  type KeeperJob,
} from './keeperJobs.js'
import {
  KPR_TRUST_ZONE_HEADER,
  KPR_TRUST_ZONE_KEY_HEADER,
  getKeeprTrustZoneEnvKey,
  resolveKeeprEffectiveActionType,
  resolveKeeprTrustZone,
} from '../agentControl/trustZones.js'

const ALLOWED_INTERNAL_API_PREFIXES = [
  '/api/keeper/',
  '/api/keepr/actions/',
] as const

type RunKeeperJobTickInput = {
  baseUrl: string
  apiKey: string
  workerId: string
  limit?: number | null
  leaseSeconds?: number | null
  retryDelaySeconds?: number | null
}

type KeeperJobRunResult = {
  id: number
  kind: string
  status: 'succeeded' | 'failed' | 'retry'
  error: string | null
  followUpJobId?: number
}

export type KeeperJobTickResult = {
  claimed: number
  releasedExpiredClaims: number
  results: KeeperJobRunResult[]
}

type PendingKeeprAction = {
  id: number
  vaultAddress: string
  groupId: string
  actionType: string | null
  action: Record<string, unknown> | null
  status: string
}

class KeeperJobApiError extends Error {
  status: number
  data: Record<string, unknown> | null

  constructor(message: string, params: { status: number; data?: Record<string, unknown> | null }) {
    super(message)
    this.status = params.status
    this.data = params.data ?? null
  }
}

export type KeeprActionProcessResult = {
  processed: number
  succeeded: number
  failed: number
  retried: number
}

function normalizePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function zoneHeaders(actionType: string | null, action: Record<string, unknown> | null): Record<string, string> {
  const effectiveActionType = resolveKeeprEffectiveActionType(actionType, action)
  const zone = resolveKeeprTrustZone(effectiveActionType ?? actionType)
  const key = String(process.env[getKeeprTrustZoneEnvKey(zone)] ?? '').trim()
  return {
    [KPR_TRUST_ZONE_HEADER]: zone,
    ...(key ? { [KPR_TRUST_ZONE_KEY_HEADER]: key } : null),
  }
}

async function apiGet<T>(params: { baseUrl: string; apiKey: string; path: string }): Promise<T> {
  const response = await fetch(joinUrl(params.baseUrl, params.path), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      Accept: 'application/json',
    },
  })
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null
  if (!response.ok || json?.success !== true || !json.data) {
    throw new Error(json?.error || `request_failed:${params.path}:${response.status}`)
  }
  return json.data
}

async function apiPost<T>(params: {
  baseUrl: string
  apiKey: string
  path: string
  body: Record<string, unknown>
  headers?: Record<string, string>
}): Promise<T> {
  const response = await fetch(joinUrl(params.baseUrl, params.path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(params.headers ?? {}),
    },
    body: JSON.stringify(params.body),
  })
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null
  if (!response.ok || json?.success !== true || !json.data) {
    const data =
      json?.data && typeof json.data === 'object' && !Array.isArray(json.data)
        ? (json.data as Record<string, unknown>)
        : null
    throw new KeeperJobApiError(json?.error || `request_failed:${params.path}:${response.status}`, {
      status: response.status,
      data,
    })
  }
  return json.data
}

function readInternalApiPayload(job: KeeperJob): {
  path: string
  method: string
  body: Record<string, unknown>
} {
  if (job.kind !== 'internal_api') throw new Error(`unsupported_job_kind:${job.kind}`)
  const path = typeof job.payload.path === 'string' ? job.payload.path.trim() : ''
  if (!ALLOWED_INTERNAL_API_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    throw new Error(`internal_api_path_not_allowed:${path || '<missing>'}`)
  }
  const method = typeof job.payload.method === 'string' ? job.payload.method.trim().toUpperCase() : 'POST'
  if (method !== 'POST') throw new Error(`internal_api_method_not_allowed:${method}`)
  const body =
    job.payload.body && typeof job.payload.body === 'object' && !Array.isArray(job.payload.body)
      ? (job.payload.body as Record<string, unknown>)
      : {}
  return { path, method, body }
}

async function callInternalApi(params: {
  baseUrl: string
  apiKey: string
  job: KeeperJob
}): Promise<Record<string, unknown>> {
  const apiJob = readInternalApiPayload(params.job)
  const response = await fetch(joinUrl(params.baseUrl, apiJob.path), {
    method: apiJob.method,
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(apiJob.body),
  })
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: string } | null
  if (!response.ok || json?.success !== true) {
    throw new Error(json?.error || `request_failed:${apiJob.path}:${response.status}`)
  }
  return json?.data && typeof json.data === 'object' && !Array.isArray(json.data)
    ? (json.data as Record<string, unknown>)
    : { response: json?.data ?? null }
}

function readSweepFollowUpMarkSettled(job: KeeperJob, result: Record<string, unknown>): Record<string, unknown> | null {
  const payloadBody =
    job.payload.body && typeof job.payload.body === 'object' && !Array.isArray(job.payload.body)
      ? (job.payload.body as Record<string, unknown>)
      : null
  const markSettled =
    payloadBody?.markSettled && typeof payloadBody.markSettled === 'object' && !Array.isArray(payloadBody.markSettled)
      ? (payloadBody.markSettled as Record<string, unknown>)
      : null
  const vaultAddress = typeof markSettled?.vaultAddress === 'string' ? markSettled.vaultAddress.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(vaultAddress)) return null
  if (result.completed !== true || result.completionStage !== 'completed') return null

  return {
    vaultAddress,
    settledAt: new Date().toISOString(),
    settlementStage: 'completed',
  }
}

async function enqueueFollowUpIfNeeded(job: KeeperJob, result: Record<string, unknown>): Promise<number | undefined> {
  const path = typeof job.payload.path === 'string' ? job.payload.path.trim() : ''
  if (path !== '/api/keeper/sweep') return undefined
  const markSettledBody = readSweepFollowUpMarkSettled(job, result)
  if (!markSettledBody) return undefined

  const followUp = await enqueueKeeperJob({
    kind: 'internal_api',
    dedupeKey: `mark-settled:${String(markSettledBody.vaultAddress).toLowerCase()}`,
    source: 'keeper-sweep-follow-up',
    payload: {
      path: '/api/keeper/mark-settled',
      body: markSettledBody,
    },
    maxAttempts: 3,
  })
  return followUp.id
}

async function runOneJob(params: {
  baseUrl: string
  apiKey: string
  workerId: string
  job: KeeperJob
  retryDelaySeconds: number
}): Promise<KeeperJobRunResult> {
  try {
    const result =
      params.job.kind === 'noop'
        ? { ok: true, kind: 'noop' }
        : await callInternalApi({
            baseUrl: params.baseUrl,
            apiKey: params.apiKey,
            job: params.job,
          })

    await completeKeeperJob({
      id: params.job.id,
      workerId: params.workerId,
      status: 'succeeded',
      result,
    })

    let followUpJobId: number | undefined
    try {
      followUpJobId = await enqueueFollowUpIfNeeded(params.job, result)
    } catch (error) {
      console.warn('[keeper/jobs] follow-up enqueue failed after primary success', {
        jobId: params.job.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return {
      id: params.job.id,
      kind: params.job.kind,
      status: 'succeeded',
      error: null,
      ...(followUpJobId ? { followUpJobId } : null),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const retryable = !message.startsWith('unsupported_job_kind') && !message.includes('_not_allowed')
    await completeKeeperJob({
      id: params.job.id,
      workerId: params.workerId,
      status: retryable ? 'retry' : 'failed',
      error: message,
      retryDelaySeconds: params.retryDelaySeconds,
    })
    return {
      id: params.job.id,
      kind: params.job.kind,
      status: retryable ? 'retry' : 'failed',
      error: message,
    }
  }
}

export async function runKeeperJobTick(input: RunKeeperJobTickInput): Promise<KeeperJobTickResult> {
  const baseUrl = String(input.baseUrl ?? '').trim()
  if (!baseUrl) throw new Error('keeper_coordination_base_url_required')
  const apiKey = String(input.apiKey ?? '').trim()
  if (!apiKey) throw new Error('keepr_api_key_required')
  const workerId = String(input.workerId ?? '').trim()
  if (!workerId) throw new Error('keeper_worker_id_required')

  const limit = normalizePositiveInt(input.limit, 1, 1, 10)
  const leaseSeconds = normalizePositiveInt(input.leaseSeconds, 300, 30, 3600)
  const retryDelaySeconds = normalizePositiveInt(input.retryDelaySeconds, 60, 1, 86_400)
  const releasedExpiredClaims = await releaseExpiredKeeperJobClaims()
  const jobs = await claimDueKeeperJobs({
    workerId,
    limit,
    leaseSeconds,
    kinds: ['internal_api', 'noop'],
  })

  const results: KeeperJobRunResult[] = []
  for (const job of jobs) {
    results.push(await runOneJob({ baseUrl, apiKey, workerId, job, retryDelaySeconds }))
  }

  return {
    claimed: jobs.length,
    releasedExpiredClaims,
    results,
  }
}

export async function processKeeprActions(input: {
  baseUrl: string
  apiKey: string
  limit?: number | null
  retryDelaySeconds?: number | null
}): Promise<KeeprActionProcessResult> {
  const baseUrl = String(input.baseUrl ?? '').trim()
  if (!baseUrl) throw new Error('keeper_coordination_base_url_required')
  const apiKey = String(input.apiKey ?? '').trim()
  if (!apiKey) throw new Error('keepr_api_key_required')
  const limit = normalizePositiveInt(input.limit, 1, 1, 10)
  const retryDelaySeconds = normalizePositiveInt(input.retryDelaySeconds, 60, 1, 86_400)

  const pending = await apiGet<{ actions: PendingKeeprAction[]; count: number }>({
    baseUrl,
    apiKey,
    path: `/api/keepr/actions/pending?limit=${limit}`,
  })

  const result: KeeprActionProcessResult = { processed: 0, succeeded: 0, failed: 0, retried: 0 }
  for (const action of pending.actions ?? []) {
    const actionPayload =
      action.action && typeof action.action === 'object' && !Array.isArray(action.action)
        ? action.action
        : null
    const headers = zoneHeaders(action.actionType, actionPayload)
    const effectiveActionType = resolveKeeprEffectiveActionType(action.actionType, actionPayload) ?? action.actionType

    const claim = await apiPost<{ updated: boolean }>({
      baseUrl,
      apiKey,
      path: '/api/keepr/actions/updateStatus',
      headers,
      body: {
        id: action.id,
        status: 'executing',
        actionType: effectiveActionType,
        action: actionPayload,
      },
    })
    if (!claim.updated) continue

    result.processed += 1
    try {
      const execution = await apiPost<{ executed?: boolean; retryable?: boolean; error?: string }>({
        baseUrl,
        apiKey,
        path: '/api/keepr/actions/execute',
        headers,
        body: {
          id: action.id,
          vaultAddress: action.vaultAddress,
          groupId: action.groupId,
          actionType: effectiveActionType,
          action: actionPayload,
        },
      })
      if (execution.executed === true) {
        await apiPost({
          baseUrl,
          apiKey,
          path: '/api/keepr/actions/updateStatus',
          headers,
          body: {
            id: action.id,
            status: 'executed',
            actionType: effectiveActionType,
            action: actionPayload,
          },
        })
        result.succeeded += 1
      } else {
        throw new Error(execution.error || 'action_not_executed')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const explicitRetryable =
        error instanceof KeeperJobApiError && typeof error.data?.retryable === 'boolean'
          ? error.data.retryable
          : null
      const retryable = explicitRetryable ?? (!message.includes('not_authorized') && !message.includes('invalid_'))
      await apiPost({
        baseUrl,
        apiKey,
        path: '/api/keepr/actions/updateStatus',
        headers,
        body: {
          id: action.id,
          status: retryable ? 'retry' : 'failed',
          error: message,
          retryDelaySeconds,
          actionType: effectiveActionType,
          action: actionPayload,
        },
      })
      if (retryable) result.retried += 1
      else result.failed += 1
    }
  }

  return result
}
