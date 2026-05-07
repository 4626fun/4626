import {
  claimDueKeeperJobs,
  completeKeeperJob,
  releaseExpiredKeeperJobClaims,
  type KeeperJob,
} from './keeperJobs.js'

const ALLOWED_INTERNAL_API_PREFIXES = [
  '/api/cre/keeper/',
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
}

export type KeeperJobTickResult = {
  claimed: number
  releasedExpiredClaims: number
  results: KeeperJobRunResult[]
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
    return { id: params.job.id, kind: params.job.kind, status: 'succeeded', error: null }
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
