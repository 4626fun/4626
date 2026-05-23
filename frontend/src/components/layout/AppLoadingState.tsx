import { useEffect, useMemo, useState } from 'react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { getLoadingIntentConfig, type LoadingIntent } from './appLoadingIntents'

export type AppLoadingStateProps = {
  intent?: LoadingIntent
  labelOverride?: string
  srStatusOverride?: string
}

function rotateIndex(index: number, phase: number, count: number) {
  if (count <= 0) return index
  return (index + phase) % count
}

export function AppLoadingState(props: AppLoadingStateProps = {}) {
  const intent = props.intent ?? 'page'
  const config = getLoadingIntentConfig(intent)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhase((current) => (current + 1) % 3)
    }, config.pattern.phaseIntervalMs)
    return () => window.clearInterval(interval)
  }, [config.pattern.phaseIntervalMs])

  const duration = useMemo(() => {
    const durationShift = (phase - 1) * config.pattern.durationStepMs
    return Math.max(220, config.pattern.baseDurationMs + durationShift)
  }, [config.pattern.baseDurationMs, config.pattern.durationStepMs, phase])

  const delays = useMemo(() => {
    const { baseDelays, phaseOffsets, phaseStepMs } = config.pattern
    return baseDelays.map((delay, index) => {
      const offsetIndex = rotateIndex(index, phase, phaseOffsets.length)
      const offset = phaseOffsets[offsetIndex] ?? 0
      return Math.max(0, delay + offset * phaseStepMs)
    })
  }, [config.pattern, phase])

  const heading = props.labelOverride ?? config.headline
  const srStatus = props.srStatusOverride ?? config.srStatus

  return (
    <div
      className="app-loading-root fixed inset-0 z-[120] isolate overflow-hidden text-zinc-100"
      data-loading-intent={intent}
      data-loading-pattern={config.pattern.id}
    >
      <div className="relative z-10 flex h-full items-center justify-center px-6 py-16">
        <div className="flex items-center gap-3 text-center">
          <PixelWaveLoader
            className="shrink-0"
            color="rgb(var(--brand-primary))"
            delays={delays}
            duration={duration}
            name={config.pattern.preset}
            size={20}
          />
          <h2 className="text-sm font-medium tracking-tight text-zinc-200 sm:text-base">{heading}</h2>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {srStatus}
      </div>
    </div>
  )
}
