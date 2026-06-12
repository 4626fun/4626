import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'

/**
 * Sticky bottom action bar for the deploy cockpit: secondary actions
 * (dry-run, export) on the left, the primary 1-Click Deploy CTA on the
 * right, with supporting copy and an explicit disabled reason.
 */
export function DeployActionBar({
  secondary,
  note,
  primary,
  supportingCopy,
  disabledReason,
  className,
}: {
  /** Secondary action buttons (Run dry-run, Export Plan JSON). */
  secondary?: ReactNode
  /** Small status/help line near the secondary actions. */
  note?: ReactNode
  /** Primary CTA (deploy button) or a replacement blocked-state element. */
  primary?: ReactNode
  /** One-line supporting copy above/beside the primary CTA. */
  supportingCopy?: ReactNode
  /** Explicit reason the primary CTA is disabled, if any. */
  disabledReason?: string | null
  className?: string
}) {
  return (
    <div className={cn('sticky bottom-3 z-30', className)}>
      <div className="rounded-2xl bg-zinc-950/90 px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            {secondary ? <div className="flex flex-wrap items-center gap-2">{secondary}</div> : null}
            {note ? <div className="text-[11px] leading-relaxed text-zinc-500">{note}</div> : null}
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-64 sm:items-end">
            {supportingCopy ? <div className="text-[10px] text-zinc-500">{supportingCopy}</div> : null}
            {primary}
            {disabledReason ? (
              <div className="text-[11px] leading-relaxed text-amber-300/80 sm:text-right" role="status">
                {disabledReason}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
