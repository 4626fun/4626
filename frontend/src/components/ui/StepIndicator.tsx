import { memo, useMemo } from 'react'
import { Stepper } from '@coinbase/cds-web/stepper'

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
  const cdsSteps = useMemo(
    () => steps.map((s, i) => ({ id: `step-${i}`, label: s.label })),
    [steps],
  )

  const activeStepId = useMemo(() => {
    const activeIndex = steps.findIndex((s) => s.status === 'active')
    if (activeIndex >= 0) return `step-${activeIndex}`
    const allComplete = steps.every((s) => s.status === 'complete')
    if (allComplete && steps.length > 0) return `step-${steps.length - 1}`
    return null
  }, [steps])

  const allComplete = steps.every((s) => s.status === 'complete')

  return (
    <div className={className}>
      <Stepper
        direction="horizontal"
        steps={cdsSteps}
        activeStepId={activeStepId}
        complete={allComplete}
        animate
      />
    </div>
  )
})
