/**
 * Dune Analytics API (server-only). Requires DUNE_API_KEY — never use VITE_ prefix.
 * @see https://docs.dune.com/api-reference/overview/authentication
 */

const DUNE_API_BASE = 'https://api.dune.com/api/v1'

export type DuneExecutionState =
  | 'QUERY_STATE_PENDING'
  | 'QUERY_STATE_EXECUTING'
  | 'QUERY_STATE_COMPLETED'
  | 'QUERY_STATE_FAILED'
  | 'QUERY_STATE_CANCELLED'
  | string

export type DuneSqlExecuteResponse = {
  execution_id?: string
  state?: DuneExecutionState
}

export type DuneExecutionResults = {
  execution_id?: string
  state?: DuneExecutionState
  result?: {
    rows?: Array<Record<string, unknown>>
    metadata?: { column_names?: string[]; row_count?: number }
  }
  error?: { message?: string; type?: string }
}

export function readDuneApiKey(): string | null {
  const key = String(process.env.DUNE_API_KEY ?? '').trim()
  return key || null
}

export function isDuneConfigured(): boolean {
  return readDuneApiKey() != null
}

function duneHeaders(apiKey: string): HeadersInit {
  return {
    'X-Dune-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

export async function executeDuneSql(
  sql: string,
  options?: { performance?: 'small' | 'medium' | 'large' },
): Promise<DuneSqlExecuteResponse> {
  const apiKey = readDuneApiKey()
  if (!apiKey) {
    throw Object.assign(new Error('dune_not_configured'), { status: 503 })
  }

  const trimmed = sql.trim()
  if (!trimmed) {
    throw Object.assign(new Error('dune_sql_empty'), { status: 400 })
  }

  const res = await fetch(`${DUNE_API_BASE}/sql/execute`, {
    method: 'POST',
    headers: duneHeaders(apiKey),
    body: JSON.stringify({
      sql: trimmed,
      performance: options?.performance ?? 'small',
    }),
  })

  const json = (await res.json().catch(() => null)) as DuneSqlExecuteResponse & { error?: string }
  if (!res.ok) {
    const message = typeof json?.error === 'string' ? json.error : `Dune SQL execute failed (${res.status})`
    throw Object.assign(new Error(message), { status: res.status >= 400 && res.status < 600 ? res.status : 502 })
  }

  if (!json?.execution_id) {
    throw Object.assign(new Error('dune_missing_execution_id'), { status: 502 })
  }

  return json
}

export async function fetchDuneExecutionResults(executionId: string): Promise<DuneExecutionResults> {
  const apiKey = readDuneApiKey()
  if (!apiKey) {
    throw Object.assign(new Error('dune_not_configured'), { status: 503 })
  }

  const res = await fetch(`${DUNE_API_BASE}/execution/${encodeURIComponent(executionId)}/results`, {
    method: 'GET',
    headers: duneHeaders(apiKey),
  })

  const json = (await res.json().catch(() => null)) as DuneExecutionResults & { error?: string }
  if (!res.ok) {
    const message = typeof json?.error === 'string' ? json.error : `Dune results failed (${res.status})`
    throw Object.assign(new Error(message), { status: res.status >= 400 && res.status < 600 ? res.status : 502 })
  }

  return json ?? {}
}

const TERMINAL_STATES = new Set([
  'QUERY_STATE_COMPLETED',
  'QUERY_STATE_FAILED',
  'QUERY_STATE_CANCELLED',
  'EXECUTION_STATE_COMPLETED',
  'EXECUTION_STATE_FAILED',
  'EXECUTION_STATE_CANCELLED',
  'completed',
  'failed',
  'cancelled',
])

function isTerminalState(state: string | undefined): boolean {
  if (!state) return false
  if (TERMINAL_STATES.has(state)) return true
  return state.toLowerCase().includes('completed') || state.toLowerCase().includes('failed')
}

export async function waitForDuneExecutionResults(
  executionId: string,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<DuneExecutionResults> {
  const maxWaitMs = options?.maxWaitMs ?? 45_000
  const pollMs = options?.pollMs ?? 1_500
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const payload = await fetchDuneExecutionResults(executionId)
    const state = String(payload.state ?? '').trim()
    if (isTerminalState(state)) {
      if (state.toLowerCase().includes('fail') || state.toLowerCase().includes('cancel')) {
        const msg = payload.error?.message ?? `Dune execution ${state}`
        throw Object.assign(new Error(msg), { status: 502 })
      }
      return payload
    }
    if (payload.result?.rows) {
      return payload
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }

  throw Object.assign(new Error('dune_execution_timeout'), { status: 504 })
}

export async function runDuneSqlRows(
  sql: string,
  options?: { performance?: 'small' | 'medium' | 'large'; maxWaitMs?: number },
): Promise<Array<Record<string, unknown>>> {
  const started = await executeDuneSql(sql, options)
  const finished = await waitForDuneExecutionResults(started.execution_id!, {
    maxWaitMs: options?.maxWaitMs,
  })
  return finished.result?.rows ?? []
}
