import type { WorkspaceTabId } from '@/lib/workspace/types'

const WORKSPACE_TABS: WorkspaceTabId[] = [
  'overview',
  'strategies',
  'monitoring',
  'activity',
  'rooms',
  'tasks',
  'settings',
]

export function isWorkspaceTab(value: string | null): value is WorkspaceTabId {
  return Boolean(value) && WORKSPACE_TABS.includes(value as WorkspaceTabId)
}

export function parseVaultWorkspaceQuery(searchParams: URLSearchParams): {
  panel: 'workspace' | 'manage'
  tab: WorkspaceTabId
  taskId: number | null
} {
  const panel = searchParams.get('panel') === 'workspace' ? 'workspace' : 'manage'
  const tabRaw = searchParams.get('tab')
  const tab = isWorkspaceTab(tabRaw) ? tabRaw : 'overview'
  const taskRaw = Number(searchParams.get('task') ?? '')
  const taskId = Number.isFinite(taskRaw) && taskRaw > 0 ? Math.floor(taskRaw) : null
  return {
    panel,
    tab,
    taskId,
  }
}

export function updateVaultWorkspaceQuery(params: {
  current: URLSearchParams
  panel: 'workspace' | 'manage'
  tab?: WorkspaceTabId
  taskId?: number | null
}) {
  const next = new URLSearchParams(params.current)
  if (params.panel === 'workspace') {
    next.set('panel', 'workspace')
    if (params.tab) {
      next.set('tab', params.tab)
    }
  } else {
    next.delete('panel')
    next.delete('tab')
    next.delete('task')
  }
  if (params.taskId && params.taskId > 0) {
    next.set('task', String(params.taskId))
  } else if (params.panel !== 'workspace') {
    next.delete('task')
  }
  return next
}
