import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'
import { AdvancedDetails } from './ui/AdvancedDetails'

/**
 * Compact role-policy diagnostics: overall state and the canary override
 * stay visible; the detailed policy readout collapses behind a disclosure.
 */
export function RolePolicyHealthPanel({
  statusLabel,
  statusToneClass,
  children,
  details,
}: {
  statusLabel: string
  statusToneClass: string
  /** Always-visible compact rows (effective source, canary override). */
  children: ReactNode
  /** Detailed readout (policy IDs, rules, validation), behind a disclosure. */
  details?: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Role policy health</div>
        <div className={cn('text-[11px]', statusToneClass)}>{statusLabel}</div>
      </div>
      <div className="space-y-1.5 text-[11px]">{children}</div>
      {details ? <AdvancedDetails summary="Policy details">{details}</AdvancedDetails> : null}
    </div>
  )
}
