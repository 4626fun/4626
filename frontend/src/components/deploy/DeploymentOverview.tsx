import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'
import type { DeployTimelineProgressState } from '@/pages/deploy/deployVaultSignals'
import { PhaseProgressBadge } from './PhaseTimeline'

/** Simple label/value row inside the launch-control card. */
export function OverviewRow({ label, children, shared }: { label: string; children: ReactNode; shared?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <div className={shared ? 'text-sky-200/90' : 'text-zinc-500'}>{label}</div>
      <div className="min-w-0 text-right font-mono text-zinc-200/90">{children}</div>
    </div>
  )
}

/**
 * Launch-control summary: phase progress, workflow status, setup owner
 * approval, and key deploy parameters. Always visible above the timeline.
 */
export function DeploymentOverview({
  completedPhases,
  totalPhases,
  remainingText,
  workflowLabel,
  workflowToneClass,
  workflowDetail,
  setupOwnerApprovalState,
  children,
}: {
  completedPhases: number
  totalPhases: number
  remainingText: string
  workflowLabel: string
  workflowToneClass: string
  workflowDetail: ReactNode
  setupOwnerApprovalState: DeployTimelineProgressState
  children?: ReactNode
}) {
  const ratio = totalPhases > 0 ? Math.min(Math.max(completedPhases / totalPhases, 0), 1) : 0
  return (
    <div className="space-y-3 rounded-xl bg-black/20 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Launch control</div>
        <div className="text-right text-[10px] leading-relaxed">
          <div className="text-zinc-400">
            {completedPhases}/{totalPhases} phases completed
          </div>
          <div className="text-zinc-600">{remainingText}</div>
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-primary/70 to-brand-accent/80 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="text-zinc-500">Setup owner approval</div>
        <PhaseProgressBadge state={setupOwnerApprovalState} />
      </div>

      <div className="flex items-start justify-between gap-4 text-xs">
        <div className="text-zinc-500">Workflow status</div>
        <div className="min-w-0 text-right">
          <div
            className={cn(
              'mb-1 inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
              workflowToneClass,
            )}
          >
            {workflowLabel}
          </div>
          <div className="break-words leading-relaxed text-zinc-500">{workflowDetail}</div>
        </div>
      </div>

      {children ? (
        <>
          <div className="h-px bg-white/[0.07]" />
          <div className="space-y-2">{children}</div>
        </>
      ) : null}
    </div>
  )
}
