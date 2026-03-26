import { AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceMonitoringResponse, WorkspaceCheckStatus } from '@/lib/workspace/types'

function checkStatusIcon(status: WorkspaceCheckStatus) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
  if (status === 'warn') return <TriangleAlert className="w-4 h-4 text-amber-400" />
  if (status === 'fail') return <AlertCircle className="w-4 h-4 text-rose-400" />
  return <AlertCircle className="w-4 h-4 text-zinc-500" />
}

export function WorkspaceMonitoringTab(props: {
  data: WorkspaceMonitoringResponse | undefined
  isLoading: boolean
}) {
  if (props.isLoading && !props.data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-4 w-36 mb-3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const monitoring = props.data
  if (!monitoring) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">Pass</div>
          <div className="text-xl text-emerald-100 mt-1">{monitoring.summary.pass}</div>
        </div>
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-amber-300">Warn</div>
          <div className="text-xl text-amber-100 mt-1">{monitoring.summary.warn}</div>
        </div>
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-rose-300">Fail</div>
          <div className="text-xl text-rose-100 mt-1">{monitoring.summary.fail}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-300">Info</div>
          <div className="text-xl text-cyan-100 mt-1">{monitoring.summary.info}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.12em] text-zinc-400">Recent incidents</span>
          <Badge variant={monitoring.incidents.length > 0 ? 'warning' : 'success'}>
            {monitoring.incidents.length > 0 ? `${monitoring.incidents.length} incidents` : 'Healthy'}
          </Badge>
        </div>
        <div className="space-y-2">
          {monitoring.incidents.length === 0 ? (
            <div className="text-sm text-zinc-500">No recent incidents.</div>
          ) : (
            monitoring.incidents.slice(0, 8).map((incident) => (
              <div key={incident.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-zinc-100">{incident.title}</div>
                  <Badge variant={incident.severity === 'critical' ? 'error' : 'warning'}>{incident.severity}</Badge>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">{new Date(incident.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        {monitoring.sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-zinc-100">{section.title}</div>
            {section.description ? <div className="text-xs text-zinc-500 mt-1">{section.description}</div> : null}
            <div className="mt-3 space-y-2">
              {section.checks.map((check) => (
                <div key={check.id} className="rounded-lg border border-white/10 p-2 flex items-start gap-2">
                  <span className="mt-0.5">{checkStatusIcon(check.status)}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">{check.label}</div>
                    {check.details ? <div className="text-xs text-zinc-500">{check.details}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
