import { cn } from '@/lib/shared/utils'

export type ExploreAnalyticsSyncBadgeProps = {
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
  className?: string
}

type BadgeTone = 'success' | 'warn' | 'error' | 'neutral'

export function resolveExploreAnalyticsSyncBadge(input: ExploreAnalyticsSyncBadgeProps): {
  label: string
  title: string
  tone: BadgeTone
} {
  const { exact, syncStatus } = input

  if (syncStatus === 'error') {
    return {
      label: 'Sync error',
      title: 'Explore metrics sync failed; numbers may be stale until the next successful refresh.',
      tone: 'error',
    }
  }

  if (syncStatus === 'running' || !exact) {
    return {
      label: exact ? 'Refreshing' : 'Partial index',
      title: exact
        ? 'Index is complete; a background refresh is in progress.'
        : 'Totals sum indexed creator coins only. Backfill may still be running.',
      tone: 'warn',
    }
  }

  return {
    label: 'Full index',
    title: 'Indexed creator-coin backfill is complete for Explore hero totals.',
    tone: 'success',
  }
}

const toneClass: Record<BadgeTone, string> = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  error: 'border-red-500/25 bg-red-500/10 text-red-300',
  neutral: 'border-white/10 bg-white/5 text-zinc-400',
}

export function ExploreAnalyticsSyncBadge({ exact, syncStatus, className }: ExploreAnalyticsSyncBadgeProps) {
  const badge = resolveExploreAnalyticsSyncBadge({ exact, syncStatus })

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        toneClass[badge.tone],
        className,
      )}
      title={badge.title}
    >
      {badge.label}
    </span>
  )
}
