import type { ReactNode } from 'react'
import { Info, Loader2, OctagonAlert, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

export type BlockedTone = 'info' | 'warning' | 'error' | 'checking'

function toneClasses(tone: BlockedTone): { card: string; title: string; body: string } {
  switch (tone) {
    case 'info':
      return {
        card: 'border-white/[0.07] bg-white/[0.03]',
        title: 'text-zinc-300',
        body: 'text-zinc-500',
      }
    case 'warning':
      return {
        card: 'border-amber-500/25 bg-linear-to-b from-amber-500/14 to-amber-500/6',
        title: 'text-amber-200',
        body: 'text-amber-200/70',
      }
    case 'error':
      return {
        card: 'border-red-500/25 bg-linear-to-b from-red-500/12 to-red-500/5',
        title: 'text-red-300',
        body: 'text-red-300/70',
      }
    case 'checking':
      return {
        card: 'border-white/[0.07] bg-white/[0.02]',
        title: 'text-zinc-400',
        body: 'text-zinc-600',
      }
    default: {
      const exhaustive: never = tone
      return exhaustive
    }
  }
}

function ToneIcon({ tone }: { tone: BlockedTone }) {
  const cls = 'size-4 shrink-0'
  switch (tone) {
    case 'info':
      return <Info aria-hidden="true" className={cn(cls, 'text-zinc-400')} />
    case 'warning':
      return <TriangleAlert aria-hidden="true" className={cn(cls, 'text-amber-300')} />
    case 'error':
      return <OctagonAlert aria-hidden="true" className={cn(cls, 'text-red-300')} />
    case 'checking':
      return <Loader2 aria-hidden="true" className={cn(cls, 'animate-spin text-zinc-400')} />
    default: {
      const exhaustive: never = tone
      return exhaustive
    }
  }
}

/**
 * Consistent blocked / gated state card for the deploy gating ladder.
 * Shows the reason the CTA is unavailable plus an optional action slot.
 */
export function BlockedStateCard({
  tone = 'info',
  title,
  description,
  children,
  className,
}: {
  tone?: BlockedTone
  title: string
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const classes = toneClasses(tone)
  return (
    <div className={cn('rounded-xl border p-4 backdrop-blur-sm', classes.card, className)} role={tone === 'error' ? 'alert' : undefined}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <ToneIcon tone={tone} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className={cn('text-sm font-medium', classes.title)}>{title}</div>
          {description ? <div className={cn('text-xs leading-relaxed', classes.body)}>{description}</div> : null}
          {children ? <div className="pt-2">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}
