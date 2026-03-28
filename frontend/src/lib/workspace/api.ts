import { apiFetch } from '@/lib/apiBase'
import type {
  WorkspaceActionResult,
  WorkspaceActivityResponse,
  WorkspaceMonitoringResponse,
  WorkspaceRoomsResponse,
  WorkspaceSettingsResponse,
  WorkspaceStrategiesResponse,
  WorkspaceSummary,
  WorkspaceTasksResponse,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
}

function resolveErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && typeof (payload as any).error === 'string') {
    const error = (payload as any).error.trim()
    if (error) return error
  }
  return fallback
}

function buildUrl(pathname: string, query: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    params.set(key, String(value))
  }
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

async function requestJson<T>(params: {
  path: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
}): Promise<T> {
  const response = await apiFetch(params.path, {
    method: params.method ?? 'GET',
    headers: params.body ? { 'Content-Type': 'application/json' } : undefined,
    body: params.body ? JSON.stringify(params.body) : undefined,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.success || payload?.data === undefined) {
    throw new Error(resolveErrorMessage(payload, `Workspace API request failed (${response.status})`))
  }
  return payload.data
}

export async function getWorkspaceSummary(vault: `0x${string}`): Promise<WorkspaceSummary> {
  return requestJson<WorkspaceSummary>({
    path: buildUrl('/api/v1/workspace/summary', { vault }),
  })
}

export async function getWorkspaceStrategies(vault: `0x${string}`): Promise<WorkspaceStrategiesResponse> {
  return requestJson<WorkspaceStrategiesResponse>({
    path: buildUrl('/api/v1/workspace/strategies', { vault }),
  })
}

export async function getWorkspaceMonitoring(vault: `0x${string}`): Promise<WorkspaceMonitoringResponse> {
  return requestJson<WorkspaceMonitoringResponse>({
    path: buildUrl('/api/v1/workspace/monitoring', { vault }),
  })
}

export async function getWorkspaceActivity(params: {
  vault: `0x${string}`
  includeSystem?: boolean
  limit?: number
}): Promise<WorkspaceActivityResponse> {
  return requestJson<WorkspaceActivityResponse>({
    path: buildUrl('/api/v1/workspace/activity', {
      vault: params.vault,
      includeSystem: params.includeSystem ?? true,
      limit: params.limit ?? 150,
    }),
  })
}

export async function getWorkspaceRooms(vault: `0x${string}`): Promise<WorkspaceRoomsResponse> {
  return requestJson<WorkspaceRoomsResponse>({
    path: buildUrl('/api/v1/workspace/rooms', { vault }),
  })
}

export async function getWorkspaceTasks(params: {
  vault: `0x${string}`
  taskStatus?: string
  approvalStatus?: string
}): Promise<WorkspaceTasksResponse> {
  return requestJson<WorkspaceTasksResponse>({
    path: buildUrl('/api/v1/workspace/tasks', {
      vault: params.vault,
      taskStatus: params.taskStatus ?? null,
      approvalStatus: params.approvalStatus ?? null,
    }),
  })
}

export async function getWorkspaceSettings(vault: `0x${string}`): Promise<WorkspaceSettingsResponse> {
  return requestJson<WorkspaceSettingsResponse>({
    path: buildUrl('/api/v1/workspace/settings', { vault }),
  })
}

export async function postWorkspaceAction(params: {
  vault: `0x${string}`
  action: string
  payload?: Record<string, unknown>
}): Promise<WorkspaceActionResult> {
  return requestJson<WorkspaceActionResult>({
    path: buildUrl('/api/v1/workspace/actions', { vault: params.vault }),
    method: 'POST',
    body: {
      action: params.action,
      payload: params.payload ?? {},
    },
  })
}
