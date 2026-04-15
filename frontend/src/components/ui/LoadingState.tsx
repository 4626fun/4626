import { useMemo } from 'react'

import { getLoadingIntentConfig, type LoadingIntent } from '@/components/layout/appLoadingIntents'
import { cn } from '@/lib/shared/utils'

import { PixelWaveLoader } from './PixelWaveLoader'

type LoadingSize = 'sm' | 'md' | 'lg'

const INLINE_SIZE_MAP: Record<LoadingSize, number> = {
  sm: 10,
  md: 12,
  lg: 16,
}

const INLINE_TEXT_CLASS_MAP: Record<LoadingSize, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

const BLOCK_SIZE_MAP: Record<LoadingSize, number> = {
  sm: 14,
  md: 18,
  lg: 22,
}

type BaseLoadingProps = {
  intent?: LoadingIntent
  labelOverride?: string
  className?: string
}

export type LoadingInlineProps = BaseLoadingProps & {
  size?: LoadingSize
  showLabel?: boolean
}

export function LoadingInline(props: LoadingInlineProps) {
  const { intent = 'processing', size = 'md', showLabel = true, className, labelOverride } = props
  const config = getLoadingIntentConfig(intent)
  const label = labelOverride ?? config.headline
  const loaderSize = INLINE_SIZE_MAP[size]
  const delays = useMemo(
    () => config.pattern.baseDelays.map((d) => Math.max(0, d)),
    [config.pattern.baseDelays],
  )

  return (
    <span className={cn('inline-flex items-center gap-2 text-zinc-500', INLINE_TEXT_CLASS_MAP[size], className)} role="status" aria-live="polite">
      <PixelWaveLoader
        name={config.pattern.preset}
        size={loaderSize}
        color="rgb(var(--brand-primary))"
        delays={delays}
        duration={config.pattern.baseDurationMs}
      />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  )
}

export type LoadingTextProps = BaseLoadingProps & {
  size?: LoadingSize
}

export function LoadingText(props: LoadingTextProps) {
  return <LoadingInline {...props} showLabel />
}

export type LoadingBlockProps = BaseLoadingProps & {
  size?: LoadingSize
  minHeightClassName?: string
}

export function LoadingBlock(props: LoadingBlockProps) {
  const { intent = 'page', size = 'md', minHeightClassName = 'min-h-[120px]', className, labelOverride } = props
  const config = getLoadingIntentConfig(intent)
  const label = labelOverride ?? config.headline
  const loaderSize = BLOCK_SIZE_MAP[size]

  const delays = useMemo(() => config.pattern.baseDelays.map((delay) => Math.max(0, delay)), [config.pattern.baseDelays])

  return (
    <div className={cn('flex items-center justify-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-6 text-zinc-400', minHeightClassName, className)} role="status" aria-live="polite">
      <PixelWaveLoader
        name={config.pattern.preset}
        size={loaderSize}
        color="rgb(var(--brand-primary))"
        delays={delays}
        duration={config.pattern.baseDurationMs}
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}
