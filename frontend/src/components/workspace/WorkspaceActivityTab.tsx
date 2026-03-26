import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceActivityResponse } from '@/lib/workspace/types'

function badgeForSeverity(severity: string): 'info' | 'warning' | 'error' | 'default' {
  if (severity === 'critical') return 'error'
  if (severity === 'warn') return 'warning'
  if (severity === 'info') return 'info'
  return 'default'
}

export function WorkspaceActivityTab(props: {
  data: WorkspaceActivityResponse | undefined
  isLoading: boolean
}) {
  if (props.isLoading && !props.data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const items = props.data?.activity ?? []
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-zinc-400">
        No activity has been recorded for this workspace yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-100">{item.title}</div>
            <div className="flex items-center gap-2">
              <Badge variant={badgeForSeverity(item.severity)}>{item.severity}</Badge>
              <Badge variant="muted">{item.source}</Badge>
            </div>
          </div>
          {item.description ? <div className="text-sm text-zinc-400 mt-2">{item.description}</div> : null}
          <div className="text-[11px] text-zinc-500 mt-2">{new Date(item.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}
