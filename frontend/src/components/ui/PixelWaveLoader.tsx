import type { CSSProperties } from 'react'

import { cn } from '@/lib/shared/utils'

const DEFAULT_DURATION_MS = 900
const DEFAULT_GRID_SIZE = 5
const DEFAULT_SIZE = 28
const DEFAULT_COLOR = 'rgb(var(--brand-primary))'

export type PixelWavePreset = 'wave-lr' | 'wave-rl' | 'wave-tb' | 'wave-bt' | 'wave-diag' | 'wave-orbit-cw'

export interface PixelWaveLoaderProps {
  name?: PixelWavePreset | (string & {})
  size?: number | string
  color?: string
  duration?: number
  delays?: number[]
  gridSize?: number
  className?: string
}

function normalizeGridSize(gridSize: number | undefined) {
  if (!Number.isFinite(gridSize)) {
    return DEFAULT_GRID_SIZE
  }

  return Math.max(1, Math.floor(gridSize as number))
}

function normalizeDuration(duration: number | undefined) {
  if (!Number.isFinite(duration)) {
    return DEFAULT_DURATION_MS
  }

  return Math.max(180, Math.round(duration as number))
}

function normalizeSize(size: number | string | undefined) {
  if (typeof size === 'number') {
    return `${size}px`
  }

  return size ?? `${DEFAULT_SIZE}px`
}

function getGapValue(size: number | string | undefined, sizeValue: string, gridSize: number) {
  if (typeof size === 'number') {
    return `${Math.max(1, Math.round(size / Math.max(gridSize * 2, 1)))}px`
  }

  return `clamp(1px, calc(${sizeValue} / ${Math.max(gridSize * 2.5, 6)}), 6px)`
}

function getOrbitOffset(row: number, column: number, gridSize: number) {
  const center = (gridSize - 1) / 2
  const dx = column - center
  const dy = row - center
  const angle = Math.atan2(dy, dx)
  const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2)
  const ringDistance = Math.round(Math.hypot(dx, dy) * 1000) / 1000
  const maxDistance = Math.max(center, 1)
  const ringWeight = Math.max(0, Math.min(1, ringDistance / maxDistance))

  return normalizedAngle / (Math.PI * 2) + ringWeight
}

function getPresetOffset(name: string, row: number, column: number, gridSize: number) {
  switch (name) {
    case 'wave-rl':
      return gridSize - column - 1
    case 'wave-tb':
      return row
    case 'wave-bt':
      return gridSize - row - 1
    case 'wave-diag':
      return row + column
    case 'wave-orbit-cw':
      return getOrbitOffset(row, column, gridSize)
    case 'wave-lr':
    default:
      return column
  }
}

function createPresetDelays(name: string, gridSize: number, duration: number) {
  const cellCount = gridSize * gridSize
  const stepMs = Math.max(55, Math.round(duration / Math.max(gridSize * 2.2, 1)))

  return Array.from({ length: cellCount }, (_, index) => {
    const row = Math.floor(index / gridSize)
    const column = index % gridSize

    return getPresetOffset(name, row, column, gridSize) * stepMs
  })
}

function normalizeDelays(delays: number[] | undefined, fallbackDelays: number[]) {
  if (!delays?.length) {
    return fallbackDelays
  }

  // Repeat shorter arrays so one sweep pattern can be safely reused across any grid size.
  return fallbackDelays.map((fallbackDelay, index) => {
    const candidateDelay = delays[index % delays.length]

    return candidateDelay !== undefined && Number.isFinite(candidateDelay) ? Math.max(0, Math.round(candidateDelay)) : fallbackDelay
  })
}

function getDotScale(size: number | string | undefined, gridSize: number) {
  if (typeof size === 'number') {
    const slot = size / Math.max(gridSize, 1)
    return Math.max(0.65, Math.min(1.6, slot / 4))
  }

  return Math.max(0.7, Math.min(1.4, 5 / Math.max(gridSize, 1)))
}

export function PixelWaveLoader({
  name = 'wave-lr',
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  duration = DEFAULT_DURATION_MS,
  delays,
  gridSize: gridSizeProp = DEFAULT_GRID_SIZE,
  className,
}: PixelWaveLoaderProps) {
  const gridSize = normalizeGridSize(gridSizeProp)
  const durationMs = normalizeDuration(duration)
  const sizeValue = normalizeSize(size)
  const resolvedDelays = normalizeDelays(delays, createPresetDelays(name, gridSize, durationMs))
  const dotScale = getDotScale(size, gridSize)

  const rootStyle: CSSProperties & Record<string, string | number> = {
    width: sizeValue,
    height: sizeValue,
    color,
    gap: getGapValue(size, sizeValue, gridSize),
    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
    '--dotm-wave-duration': `${durationMs}ms`,
    '--dotm-wave-scale': dotScale,
  }

  return (
    <div
      aria-hidden="true"
      className={cn('dot-matrix-loader grid shrink-0 place-items-stretch', className)}
      data-dot-matrix-loader="true"
      data-pixel-wave-loader="true"
      style={rootStyle}
    >
      {resolvedDelays.map((delay, index) => (
        <span
          key={index}
          data-dot-matrix-cell="true"
          data-pixel-wave-cell="true"
          className="dot-matrix-loader__cell block h-full w-full rounded-[2px]"
          // Every cell runs the same fade loop. The per-cell delay array is the
          // entire sequencing mechanism, which keeps the motion simple and stable.
          style={{
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
