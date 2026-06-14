import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type BacktestAuditRow = {
  runId: string
  stepIndex: number
  mark: number
  weakHealth: number
  healthGap: number
  executionCostUsd: number
  noCrossLegTransfer: boolean
}

export type BacktestAuditPayload = {
  file: string | null
  auditFile: string | null
  runId: string | null
  rows: BacktestAuditRow[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['1', 'true', 'yes', 'on'].includes(normalized)
  }
  return false
}

function parseRow(value: unknown): BacktestAuditRow | null {
  if (!isRecord(value)) return null
  return {
    runId: typeof value.runId === 'string' ? value.runId : '',
    stepIndex: asNumber(value.stepIndex),
    mark: asNumber(value.mark),
    weakHealth: asNumber(value.weakHealth),
    healthGap: asNumber(value.healthGap),
    executionCostUsd: asNumber(value.executionCostUsd),
    noCrossLegTransfer: asBoolean(value.noCrossLegTransfer),
  }
}

function parsePayload(payload: unknown): BacktestAuditPayload {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new Error('Invalid backtest audit response shape')
  }
  const data = payload.data
  const rows = Array.isArray(data.rows) ? data.rows.map(parseRow).filter((row): row is BacktestAuditRow => Boolean(row)) : []
  return {
    file: typeof data.file === 'string' ? data.file : null,
    auditFile: typeof data.auditFile === 'string' ? data.auditFile : null,
    runId: typeof data.runId === 'string' ? data.runId : null,
    rows,
  }
}

export async function fetchBacktestAudit(params: { file?: string | null; runId?: string | null }): Promise<BacktestAuditPayload> {
  const qs = new URLSearchParams()
  if (params.file) qs.set('file', params.file)
  if (params.runId) qs.set('runId', params.runId)
  const query = qs.toString()
  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.backtestAudit}${query ? `?${query}` : ''}`, {
    method: 'GET',
    withCredentials: false,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Backtest audit failed (${response.status})`))
  }
  return parsePayload(payload)
}
