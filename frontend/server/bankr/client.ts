type JsonObject = Record<string, unknown>

const DEFAULT_BANKR_API_BASE = 'https://api.bankr.bot'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_POLL_INTERVAL_MS = 2_000
const DEFAULT_POLL_TIMEOUT_MS = 25_000

export type BankrWallet = {
  chain?: string
  address?: string
}

export type BankrMeResponse = {
  success?: boolean
  wallets?: BankrWallet[]
  socialAccounts?: Array<{ platform?: string; username?: string }>
  bankrClub?: {
    active?: boolean
    subscriptionType?: string
    renewOrCancelOn?: number
  }
  leaderboard?: {
    score?: number
    rank?: number
  }
  [key: string]: unknown
}

export type BankrBalancesResponse = {
  success?: boolean
  balances?: unknown[]
  [key: string]: unknown
}

export type BankrPromptSubmitResponse = {
  success?: boolean
  jobId?: string
  threadId?: string
  status?: string
  message?: string
  [key: string]: unknown
}

export type BankrJobResponse = {
  success?: boolean
  jobId?: string
  status?: string
  response?: string
  error?: string
  threadId?: string
  [key: string]: unknown
}

export type BankrPromptCompletion = {
  jobId: string
  threadId: string | null
  status: string
  response: string | null
  raw: BankrJobResponse
}

export type BankrProfileResponse = {
  success?: boolean
  profile?: Record<string, unknown> | null
  approved?: boolean
  [key: string]: unknown
}

type BankrOk<T> = {
  ok: true
  status: number
  data: T
}

type BankrErr = {
  ok: false
  status: number
  error: string
  payload?: unknown
}

export type BankrResult<T> = BankrOk<T> | BankrErr

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim().slice(0, 400)
  if (isObject(payload)) {
    const error = typeof payload.error === 'string' ? payload.error.trim() : ''
    if (error) return error.slice(0, 400)
    const message = typeof payload.message === 'string' ? payload.message.trim() : ''
    if (message) return message.slice(0, 400)
  }
  return fallback
}

function toApiBase(raw: string): string {
  if (!raw) return DEFAULT_BANKR_API_BASE
  return raw.replace(/\/+$/, '')
}

export function getBankrApiBase(): string {
  const envBase = (process.env.BANKR_API_URL ?? process.env.BANKR_AGENT_API_URL ?? '').trim()
  return toApiBase(envBase)
}

export function getBankrApiKey(): string {
  return (process.env.BANKR_API_KEY ?? '').trim()
}

export function isBankrConfigured(): boolean {
  return getBankrApiKey().length > 0
}

async function bankrRequest<T>(params: {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: JsonObject
  query?: Record<string, string | number | boolean | undefined>
  timeoutMs?: number
}): Promise<BankrResult<T>> {
  const apiKey = getBankrApiKey()
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'BANKR_API_KEY is not configured',
    }
  }

  const base = getBankrApiBase()
  const path = params.path.startsWith('/') ? params.path : `/${params.path}`
  const url = new URL(`${base}${path}`)
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined) continue
      url.searchParams.set(key, String(value))
    }
  }

  const timeoutMs = Math.max(1_000, Number(params.timeoutMs ?? DEFAULT_TIMEOUT_MS))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url.toString(), {
      method: params.method,
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
        ...(params.method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
      },
      body: params.method === 'GET' ? undefined : JSON.stringify(params.body ?? {}),
      signal: controller.signal,
    })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text || null
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: toErrorMessage(payload, `Bankr request failed (${response.status})`),
        payload,
      }
    }

    return {
      ok: true,
      status: response.status,
      data: (payload ?? {}) as T,
    }
  } catch (error: unknown) {
    const message = String((error as Error | undefined)?.message ?? '')
    const isAbort = String((error as Error | undefined)?.name ?? '').toLowerCase() === 'aborterror'
    return {
      ok: false,
      status: isAbort ? 504 : 502,
      error: isAbort ? 'Bankr request timed out' : toErrorMessage(message, 'Bankr request failed'),
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function bankrGetMe(): Promise<BankrResult<BankrMeResponse>> {
  return bankrRequest<BankrMeResponse>({ path: '/agent/me', method: 'GET' })
}

export async function bankrGetBalances(params?: {
  chains?: string
}): Promise<BankrResult<BankrBalancesResponse>> {
  const chains = typeof params?.chains === 'string' ? params.chains.trim() : ''
  return bankrRequest<BankrBalancesResponse>({
    path: '/agent/balances',
    method: 'GET',
    query: { chains: chains || undefined },
  })
}

export async function bankrSubmitPrompt(params: {
  prompt: string
  threadId?: string
}): Promise<BankrResult<BankrPromptSubmitResponse>> {
  return bankrRequest<BankrPromptSubmitResponse>({
    path: '/agent/prompt',
    method: 'POST',
    body: {
      prompt: params.prompt,
      threadId: params.threadId,
    },
  })
}

export async function bankrGetJob(jobId: string): Promise<BankrResult<BankrJobResponse>> {
  const normalized = String(jobId).trim()
  if (!normalized) {
    return { ok: false, status: 400, error: 'jobId is required' }
  }
  return bankrRequest<BankrJobResponse>({
    path: `/agent/job/${encodeURIComponent(normalized)}`,
    method: 'GET',
  })
}

export async function bankrPrompt(params: {
  prompt: string
  threadId?: string
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<BankrResult<BankrPromptCompletion>> {
  const prompt = String(params.prompt ?? '').trim()
  if (!prompt) return { ok: false, status: 400, error: 'prompt is required' }

  const submit = await bankrSubmitPrompt({ prompt, threadId: params.threadId })
  if (!submit.ok) return submit

  const jobId = String(submit.data?.jobId ?? '').trim()
  if (!jobId) {
    return {
      ok: false,
      status: 502,
      error: 'Bankr prompt response did not include jobId',
      payload: submit.data,
    }
  }

  const timeoutMs = Math.max(2_000, Number(params.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS))
  const pollIntervalMs = Math.max(500, Number(params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS))
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const job = await bankrGetJob(jobId)
    if (!job.ok) return job
    const status = String(job.data?.status ?? '').trim().toLowerCase()
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      return {
        ok: true,
        status: 200,
        data: {
          jobId,
          threadId: String(job.data?.threadId ?? submit.data?.threadId ?? '').trim() || null,
          status: status || 'unknown',
          response: typeof job.data?.response === 'string' ? job.data.response : null,
          raw: job.data,
        },
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return {
    ok: false,
    status: 504,
    error: `Bankr job polling timed out after ${timeoutMs}ms`,
    payload: { jobId },
  }
}

export async function bankrGetProfile(): Promise<BankrResult<BankrProfileResponse>> {
  return bankrRequest<BankrProfileResponse>({
    path: '/agent/profile',
    method: 'GET',
  })
}

export async function bankrCreateProfile(payload: JsonObject): Promise<BankrResult<BankrProfileResponse>> {
  return bankrRequest<BankrProfileResponse>({
    path: '/agent/profile',
    method: 'POST',
    body: payload,
  })
}

export async function bankrUpdateProfile(payload: JsonObject): Promise<BankrResult<BankrProfileResponse>> {
  return bankrRequest<BankrProfileResponse>({
    path: '/agent/profile',
    method: 'PUT',
    body: payload,
  })
}

export async function bankrAddProfileUpdate(payload: {
  title: string
  content: string
}): Promise<BankrResult<Record<string, unknown>>> {
  return bankrRequest<Record<string, unknown>>({
    path: '/agent/profile/update',
    method: 'POST',
    body: {
      title: payload.title,
      content: payload.content,
    },
  })
}

export async function bankrListPublicProfiles(params?: {
  limit?: number
  offset?: number
  sort?: 'marketCap' | 'newest'
}): Promise<BankrResult<Record<string, unknown>>> {
  return bankrRequest<Record<string, unknown>>({
    path: '/agent-profiles',
    method: 'GET',
    query: {
      limit: params?.limit,
      offset: params?.offset,
      sort: params?.sort,
    },
  })
}
