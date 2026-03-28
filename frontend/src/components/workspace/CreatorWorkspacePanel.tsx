import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useCreatorWorkspace } from '@/hooks/useCreatorWorkspace'
import type { WorkspaceTabId } from '@/lib/workspace/types'
import { WorkspaceOverviewTab } from './WorkspaceOverviewTab'
import { WorkspaceStrategiesTab } from './WorkspaceStrategiesTab'
import { WorkspaceMonitoringTab } from './WorkspaceMonitoringTab'
import { WorkspaceActivityTab } from './WorkspaceActivityTab'
import { WorkspaceRoomsTab } from './WorkspaceRoomsTab'
import { WorkspaceTasksTab } from './WorkspaceTasksTab'
import { WorkspaceSettingsTab } from './WorkspaceSettingsTab'

const WORKSPACE_TABS: Array<{ id: WorkspaceTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'activity', label: 'Activity' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'settings', label: 'Settings' },
]

export function CreatorWorkspacePanel(props: {
  vaultAddress: `0x${string}`
  initialTab?: WorkspaceTabId
  focusedTaskId?: number | null
  onTabChange?: (tab: WorkspaceTabId) => void
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const activeTab = props.initialTab ?? 'overview'

  const workspace = useCreatorWorkspace({
    vaultAddress: props.vaultAddress,
    tab: activeTab,
  })

  const actorRole = workspace.summary.data?.actorRole ?? 'VIEWER'
  const canMutate = actorRole !== 'VIEWER'

  const pendingCountLabel = useMemo(() => {
    const pendingTasks = workspace.summary.data?.metrics.pendingTasks ?? 0
    const pendingApprovals = workspace.summary.data?.metrics.pendingApprovals ?? 0
    if (pendingTasks + pendingApprovals === 0) return null
    return `${pendingTasks + pendingApprovals} pending`
  }, [workspace.summary.data?.metrics.pendingApprovals, workspace.summary.data?.metrics.pendingTasks])

  async function runAction(action: string, payload?: Record<string, unknown>) {
    if (!canMutate) {
      toast.error('Viewer role cannot run workspace actions')
      return
    }
    setErrorMessage(null)
    try {
      await workspace.actionMutation.mutateAsync({
        action,
        payload,
      })
      toast.success(`Action completed: ${action}`)
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : 'Workspace action failed'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Creator Workspace</div>
          <div className="text-sm text-zinc-200 mt-1">
            Role: <span className="text-zinc-100">{actorRole}</span>
            {pendingCountLabel ? <span className="text-zinc-500"> • {pendingCountLabel}</span> : null}
          </div>
        </div>
        <Button
          size="sm"
          disabled={workspace.actionMutation.isPending}
          onClick={() => {
            void Promise.all([
              workspace.summary.refetch(),
              workspace.strategies.refetch(),
              workspace.monitoring.refetch(),
              workspace.activity.refetch(),
              workspace.rooms.refetch(),
              workspace.tasks.refetch(),
              workspace.settings.refetch(),
            ])
          }}
        >
          Refresh
        </Button>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  isActive
                    ? 'bg-brand-primary/20 text-zinc-100 border border-brand-primary/30'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
                onClick={() => {
                  props.onTabChange?.(tab.id)
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {errorMessage ? <Alert variant="error" onDismiss={() => setErrorMessage(null)}>{errorMessage}</Alert> : null}

      {activeTab === 'overview' ? (
        <WorkspaceOverviewTab summary={workspace.summary.data} isLoading={workspace.summary.isLoading} />
      ) : null}

      {activeTab === 'strategies' ? (
        <WorkspaceStrategiesTab
          data={workspace.strategies.data}
          isLoading={workspace.strategies.isLoading}
          isMutating={workspace.actionMutation.isPending}
          onSetTarget={(params) =>
            runAction('strategy.setTarget', {
              strategyAddress: params.strategyAddress,
              targetWeightBps: params.targetWeightBps,
              status: 'active',
            })
          }
          onExecute={(params) =>
            runAction('strategy.execute', {
              strategyAddress: params.strategyAddress,
              actionType: params.actionType,
              params: {},
            })
          }
        />
      ) : null}

      {activeTab === 'monitoring' ? (
        <WorkspaceMonitoringTab data={workspace.monitoring.data} isLoading={workspace.monitoring.isLoading} />
      ) : null}

      {activeTab === 'activity' ? (
        <WorkspaceActivityTab data={workspace.activity.data} isLoading={workspace.activity.isLoading} />
      ) : null}

      {activeTab === 'rooms' ? (
        <WorkspaceRoomsTab
          data={workspace.rooms.data}
          isLoading={workspace.rooms.isLoading}
          isMutating={workspace.actionMutation.isPending}
          onTelegramLink={(payload) => runAction('rooms.telegram.link', payload)}
          onTelegramUnlink={(payload) => runAction('rooms.telegram.unlink', payload)}
          onXmtpPing={() =>
            runAction('rooms.xmtp.publish', {
              messageType: 'status_summary',
              title: 'Workspace status ping',
              body: 'Operator requested a status ping from the workspace panel.',
            })
          }
        />
      ) : null}

      {activeTab === 'tasks' ? (
        <WorkspaceTasksTab
          data={workspace.tasks.data}
          isLoading={workspace.tasks.isLoading}
          isMutating={workspace.actionMutation.isPending}
          focusedTaskId={props.focusedTaskId ?? null}
          onTaskAction={(params) =>
            runAction(`task.${params.action}`, {
              taskId: params.taskId,
              ...(params.action === 'snooze'
                ? { snoozedUntil: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() }
                : {}),
            })
          }
          onApprovalAction={(params) =>
            runAction(`approval.${params.action}`, {
              approvalId: params.approvalId,
            })
          }
        />
      ) : null}

      {activeTab === 'settings' ? (
        <WorkspaceSettingsTab
          data={workspace.settings.data}
          isLoading={workspace.settings.isLoading}
          isMutating={workspace.actionMutation.isPending}
          onUpdateNotifications={(payload) => runAction('settings.notifications.upsert', payload)}
        />
      ) : null}
    </div>
  )
}
