import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'
import type { DeployTimelineProgressState } from '@/pages/deploy/deployVaultSignals'
import { deployTimelineProgressLabel } from '@/pages/deploy/deployVaultSignals'
import { StatusBadge } from './ui/StatusBadge'
import { AdvancedDetails } from './ui/AdvancedDetails'
import type { DeployStatus } from './ui/statusModel'

export function timelineProgressToDeployStatus(state: DeployTimelineProgressState): DeployStatus {
  switch (state) {
    case 'done':
      return 'success'
    case 'inProgress':
      return 'checking'
    case 'pending':
      return 'pending'
    case 'disabled':
      return 'disabled'
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/** Status pill for a timeline stage, reusing the canonical stage labels. */
export function PhaseProgressBadge({ state, className }: { state: DeployTimelineProgressState; className?: string }) {
  return (
    <StatusBadge status={timelineProgressToDeployStatus(state)} label={deployTimelineProgressLabel(state)} className={className} />
  )
}

function nodeToneClasses(state: DeployTimelineProgressState): string {
  switch (state) {
    case 'done':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    case 'inProgress':
      return 'border-blue-500/45 bg-blue-500/15 text-blue-300'
    case 'pending':
      return 'border-white/12 bg-white/[0.04] text-zinc-500'
    case 'disabled':
      return 'border-white/[0.06] bg-transparent text-zinc-700'
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/**
 * One stage of the deployment timeline. The phase number, title, and status
 * badge are always visible; address tables collapse behind a disclosure.
 */
export function PhaseCard({
  index,
  title,
  purpose,
  state,
  statusExtras,
  headerAction,
  addresses,
  addressesLabel = 'Contract addresses',
  defaultAddressesOpen = false,
  isLast = false,
  children,
}: {
  /** Display index on the timeline node, e.g. "1" or "2b". */
  index: string
  title: string
  /** One-sentence plain-language purpose under the title. */
  purpose?: ReactNode
  state: DeployTimelineProgressState
  /** Inline extras next to the status badge (e.g. dry-run check). */
  statusExtras?: ReactNode
  /** Right-aligned header action (e.g. "view tx" link). */
  headerAction?: ReactNode
  /** Collapsible address tables for this phase. */
  addresses?: ReactNode
  addressesLabel?: string
  defaultAddressesOpen?: boolean
  isLast?: boolean
  children?: ReactNode
}) {
  return (
    <li className="relative flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 shrink-0 select-none items-center justify-center rounded-full border font-mono text-[11px] font-medium transition-colors duration-300',
            state === 'inProgress' && 'animate-pulse ring-4 ring-blue-500/10 motion-reduce:animate-none',
            nodeToneClasses(state),
          )}
        >
          {index}
        </span>
        {!isLast ? <span aria-hidden="true" className="mt-1 w-px flex-1 bg-white/[0.07]" /> : null}
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className={cn('text-sm font-medium', state === 'disabled' ? 'text-zinc-600' : 'text-zinc-200')}>{title}</h3>
            <PhaseProgressBadge state={state} />
            {statusExtras}
          </div>
          {headerAction}
        </div>
        {purpose ? <div className="mt-1 text-xs leading-relaxed text-zinc-500">{purpose}</div> : null}
        {children ? <div className="mt-3 space-y-3">{children}</div> : null}
        {addresses ? (
          <AdvancedDetails summary={addressesLabel} defaultOpen={defaultAddressesOpen} className="mt-3">
            {addresses}
          </AdvancedDetails>
        ) : null}
      </div>
    </li>
  )
}

/** Vertical timeline container for PhaseCard items. */
export function PhaseTimeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn('flex flex-col', className)}>{children}</ol>
}
