import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceTasksResponse } from '@/lib/workspace/types'

function severityVariant(severity: string): 'info' | 'warning' | 'error' | 'default' {
  if (severity === 'critical' || severity === 'high') return 'error'
  if (severity === 'warn' || severity === 'medium') return 'warning'
  if (severity === 'info' || severity === 'low') return 'info'
  return 'default'
}

export function WorkspaceTasksTab(props: {
  data: WorkspaceTasksResponse | undefined
  isLoading: boolean
  isMutating: boolean
  focusedTaskId?: number | null
  onTaskAction: (params: { action: 'approve' | 'reject' | 'snooze'; taskId: number }) => void
  onApprovalAction: (params: { action: 'approve' | 'reject'; approvalId: number }) => void
}) {
  if (props.isLoading && !props.data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const data = props.data
  if (!data) return null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.12em] text-zinc-400">Tasks</div>
        {data.tasks.length === 0 ? (
          <div className="text-sm text-zinc-500">No tasks queued.</div>
        ) : (
          data.tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-lg border p-3 ${
                props.focusedTaskId === task.id
                  ? 'border-brand-primary/40 bg-brand-primary/10'
                  : 'border-white/10 bg-black/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-zinc-100">{task.title}</div>
                <Badge variant={severityVariant(task.severity)}>{task.severity}</Badge>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Status: {task.status}</div>
              {task.description ? <div className="text-xs text-zinc-400 mt-1">{task.description}</div> : null}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  disabled={props.isMutating}
                  onClick={() => props.onTaskAction({ action: 'approve', taskId: task.id })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  disabled={props.isMutating}
                  onClick={() => props.onTaskAction({ action: 'reject', taskId: task.id })}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={props.isMutating}
                  onClick={() => props.onTaskAction({ action: 'snooze', taskId: task.id })}
                >
                  Snooze
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.12em] text-zinc-400">Approvals</div>
        {data.approvals.length === 0 ? (
          <div className="text-sm text-zinc-500">No pending approvals.</div>
        ) : (
          data.approvals.map((approval) => (
            <div key={approval.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-zinc-100">{approval.actionType}</div>
                <Badge variant={severityVariant(approval.severity)}>{approval.severity}</Badge>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Status: {approval.status}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  disabled={props.isMutating || approval.status !== 'pending'}
                  onClick={() => props.onApprovalAction({ action: 'approve', approvalId: approval.id })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  disabled={props.isMutating || approval.status !== 'pending'}
                  onClick={() => props.onApprovalAction({ action: 'reject', approvalId: approval.id })}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
