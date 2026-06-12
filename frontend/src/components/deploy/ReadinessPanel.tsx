import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/shared/utils'
import { StatusBadge } from './ui/StatusBadge'

export interface ReadinessCheck {
  label: string
  ok: boolean
  hint?: string | null
}

function ReadinessCheckItem({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-black/20 px-3 py-2">
      <span
        aria-hidden="true"
        className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', check.ok ? 'bg-emerald-400' : 'bg-amber-400')}
      />
      <div className="min-w-0 flex-1 text-xs text-zinc-300">
        <span>{check.label}</span>
        <span className="sr-only">{check.ok ? ' — passed' : ' — needs attention'}</span>
        {check.hint ? <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{check.hint}</div> : null}
      </div>
    </div>
  )
}

/**
 * Collapsible readiness summary. Header shows an aggregate Ready /
 * Needs attention badge; the body lists individual checks in a grid.
 * `headerControls` renders inline admin inputs (e.g. min coin age).
 */
export function ReadinessPanel({
  title,
  checks,
  headerControls,
  defaultOpen = false,
}: {
  title: string
  checks: ReadinessCheck[]
  headerControls?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const failing = useMemo(() => checks.filter((c) => !c.ok).length, [checks])
  const allOk = failing === 0

  return (
    <div className="rounded-2xl bg-white/[0.02] backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{title}</span>
          <StatusBadge
            status={allOk ? 'success' : 'warning'}
            label={allOk ? 'Ready' : `Needs attention (${failing})`}
          />
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-3.5 shrink-0 text-zinc-500 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4">
          {headerControls ? <div className="flex items-center justify-end gap-2 text-[11px] text-zinc-500">{headerControls}</div> : null}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {checks.map((check) => (
              <ReadinessCheckItem key={check.label} check={check} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
