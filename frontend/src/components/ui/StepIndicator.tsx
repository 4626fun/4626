import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type StepStatus = 'pending' | 'active' | 'complete'

interface Step {
  label: string
  status: StepStatus
}

interface StepIndicatorProps {
  steps: Step[]
  className?: string
}

export const StepIndicator = memo(function StepIndicator({ steps, className = '' }: StepIndicatorProps) {
  const prefersReduced = useReducedMotion()

  const total = steps.length
  const completedCount = steps.filter((s) => s.status === 'complete').length
  const activeIdx = steps.findIndex((s) => s.status === 'active')

  // Smooth progress: each complete step fills its full segment;
  // the active step contributes a partial fill to imply movement.
  const progressPct = ((completedCount + (activeIdx >= 0 ? 0.35 : 0)) / total) * 100

  return (
    <nav aria-label="Progress" className={`${className} space-y-2`}>
      {/* Track + fill */}
      <div className="relative h-[2px] w-full rounded-full overflow-hidden bg-white/[0.07]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #003FCC 0%, #0052FF 45%, #5BA8FF 100%)',
            boxShadow: '0 0 6px rgba(91,168,255,0.45)',
          }}
          initial={prefersReduced ? false : { width: '0%', opacity: 0 }}
          animate={{ width: `${progressPct}%`, opacity: progressPct > 0 ? 1 : 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>

      {/* Step labels */}
      <div className="flex justify-between">
        {steps.map((step) => (
          <span
            key={step.label}
            className={`text-[10px] font-medium tracking-widest uppercase transition-colors duration-300 ${
              step.status === 'complete'
                ? 'text-[#5BA8FF]'
                : step.status === 'active'
                  ? 'text-white'
                  : 'text-zinc-600'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </nav>
  )
})
