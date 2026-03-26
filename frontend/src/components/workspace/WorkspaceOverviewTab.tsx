import type { ReactNode } from 'react'
import { AlertTriangle, Activity, Bot, MessageSquare } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceSummary } from '@/lib/workspace/types'

function MetricCard(props: { label: string; value: string; icon: ReactNode; tone?: 'default' | 'warning' | 'error' }) {
  const borderTone =
    props.tone === 'error' ? 'border-rose-400/30' : props.tone === 'warning' ? 'border-amber-400/30' : 'border-white/10'
  return (
    <div className={`rounded-xl border ${borderTone} bg-white/5 p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{props.label}</span>
        <span className="text-zinc-500">{props.icon}</span>
      </div>
      <div className="mt-2 text-xl text-zinc-100">{props.value}</div>
    </div>
  )
}

export function WorkspaceOverviewTab(props: {
  summary: WorkspaceSummary | undefined
  isLoading: boolean
}) {
  if (props.isLoading && !props.summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <Skeleton className="h-4 w-40 mb-3" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    )
  }

  const summary = props.summary
  if (!summary) return null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Active Strategies"
          value={`${summary.metrics.activeStrategyCount}/${summary.metrics.strategyCount}`}
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label="Open Alerts"
          value={`${summary.metrics.openAlerts}`}
          icon={<AlertTriangle className="w-4 h-4" />}
          tone={summary.metrics.openAlerts > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Pending Tasks"
          value={`${summary.metrics.pendingTasks}`}
          icon={<Bot className="w-4 h-4" />}
          tone={summary.metrics.pendingTasks > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Pending Approvals"
          value={`${summary.metrics.pendingApprovals}`}
          icon={<MessageSquare className="w-4 h-4" />}
          tone={summary.metrics.pendingApprovals > 0 ? 'error' : 'default'}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 uppercase tracking-[0.12em]">Room health</span>
          <Badge variant={summary.rooms.telegram.linked || summary.rooms.xmtp.linked ? 'success' : 'muted'}>
            {summary.rooms.telegram.linked || summary.rooms.xmtp.linked ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 p-3">
            <div className="text-zinc-400">Telegram</div>
            <div className="text-zinc-100 mt-1">
              {summary.rooms.telegram.linked
                ? `${summary.rooms.telegram.memberCount} members in room ${summary.rooms.telegram.roomChatId ?? '-'}`
                : 'Not linked'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <div className="text-zinc-400">XMTP</div>
            <div className="text-zinc-100 mt-1">
              {summary.rooms.xmtp.linked
                ? `Agent ${summary.rooms.xmtp.agentAddress ?? '-'}`
                : 'No XMTP agent linked'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-[0.12em] mb-3">Recent alerts</div>
          <div className="space-y-2">
            {summary.latestAlerts.length === 0 ? (
              <div className="text-sm text-zinc-500">No open alerts.</div>
            ) : (
              summary.latestAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-zinc-100">{alert.title}</div>
                    <Badge variant={alert.severity === 'critical' ? 'error' : alert.severity === 'warn' ? 'warning' : 'info'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  {alert.message ? <div className="text-xs text-zinc-400 mt-1">{alert.message}</div> : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-[0.12em] mb-3">Latest activity</div>
          <div className="space-y-2">
            {summary.latestActivity.length === 0 ? (
              <div className="text-sm text-zinc-500">No recent activity.</div>
            ) : (
              summary.latestActivity.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 p-3">
                  <div className="text-sm text-zinc-100">{event.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{new Date(event.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
