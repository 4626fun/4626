import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

const DEFAULT_DURATION_MS = 600
const DEFAULT_GRID_SIZE = 3
const DEFAULT_SIZE = 28
const DEFAULT_COLOR = 'rgb(var(--brand-primary))'

export type PixelWavePreset = 'wave-lr' | 'wave-rl' | 'wave-tb' | 'wave-bt' | 'wave-diag'

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
    case 'wave-lr':
    default:
      return column
  }
}

function createPresetDelays(name: string, gridSize: number, duration: number) {
  const cellCount = gridSize * gridSize
  const stepMs = Math.max(70, Math.round(duration / Math.max(gridSize * 2, 1)))

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

    return Number.isFinite(candidateDelay) ? Math.max(0, Math.round(candidateDelay)) : fallbackDelay
  })
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

  const rootStyle: CSSProperties = {
    width: sizeValue,
    height: sizeValue,
    color,
    gap: getGapValue(size, sizeValue, gridSize),
    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
  }

  return (
    <div
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-stretch', className)}
      data-pixel-wave-loader="true"
      style={rootStyle}
    >
      {resolvedDelays.map((delay, index) => (
        <span
          key={index}
          data-pixel-wave-cell="true"
          className="pixel-wave-loader__cell block h-full w-full"
          // Every cell runs the same fade loop. The per-cell delay array is the
          // entire sequencing mechanism, which keeps the motion simple and stable.
          style={{
            animationDuration: `${durationMs}ms`,
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
