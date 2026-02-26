import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'

type StepStatus = 'pending' | 'active' | 'complete'

interface Step {
  label: string
  status: StepStatus
}

interface StepIndicatorProps {
  steps: Step[]
  className?: string
}

const circleSize = 'h-7 w-7'
const lineHeight = 'h-0.5'

function StepCircle({ status }: { status: StepStatus }) {
  if (status === 'complete') {
    return (
      <div
        className={`${circleSize} rounded-full bg-emerald-500 flex items-center justify-center shrink-0`}
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className={`${circleSize} relative flex items-center justify-center shrink-0`} aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-brand-primary/20 animate-pulse" />
        <div className="h-3.5 w-3.5 rounded-full bg-brand-primary" />
      </div>
    )
  }

  return (
    <div
      className={`${circleSize} rounded-full border-2 border-zinc-700 bg-transparent shrink-0`}
      aria-hidden="true"
    />
  )
}

export const StepIndicator = memo(function StepIndicator({ steps, className = '' }: StepIndicatorProps) {
  const prefersReduced = useReducedMotion()

  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center gap-0" role="list">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const ariaCurrent = step.status === 'active' ? ('step' as const) : undefined

          return (
            <li key={step.label} className={`flex items-center ${isLast ? '' : 'flex-1'}`} aria-current={ariaCurrent}>
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  initial={prefersReduced ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08, duration: 0.2 }}
                >
                  <StepCircle status={step.status} />
                </motion.div>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    step.status === 'active'
                      ? 'text-white'
                      : step.status === 'complete'
                        ? 'text-emerald-400'
                        : 'text-zinc-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {!isLast ? (
                <div className={`flex-1 mx-2 mt-[-18px]`}>
                  <div
                    className={`${lineHeight} rounded-full transition-colors duration-300 ${
                      step.status === 'complete' ? 'bg-emerald-500/60' : 'bg-zinc-700/50'
                    }`}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
})
