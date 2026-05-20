import { memo } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

export type StepStatus = 'pending' | 'active' | 'complete'

interface Step {
  label: string
  status: StepStatus
}

export interface StepIndicatorProps {
  steps: Step[]
  className?: string
}

export const StepIndicator = memo(function StepIndicator({ steps, className = '' }: StepIndicatorProps) {
  return (
    <ol className={cn('flex w-full items-center gap-2', className)} aria-label="Progress">
      {steps.map((step, index) => {
        const isComplete = step.status === 'complete'
        const isActive = step.status === 'active'
        const isLast = index === steps.length - 1

        return (
          <li key={`${step.label}-${index}`} className={cn('flex min-w-0 flex-1 items-center gap-2', isLast && 'flex-none')}>
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                  isComplete && 'border-brand-500/40 bg-brand-500 text-white',
                  isActive && 'border-brand-500 bg-brand-500/15 text-brand-200',
                  !isComplete && !isActive && 'border-white/12 bg-white/5 text-zinc-500',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'max-w-[5.5rem] truncate text-center text-[10px] font-medium uppercase tracking-wide',
                  isActive || isComplete ? 'text-zinc-200' : 'text-zinc-600',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <div
                className={cn(
                  'mb-5 h-px flex-1',
                  isComplete ? 'bg-brand-500/50' : 'bg-white/10',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
})
