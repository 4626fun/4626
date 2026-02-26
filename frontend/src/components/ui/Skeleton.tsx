import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

/**
 * Shimmer skeleton block. Respects `prefers-reduced-motion`.
 * Use to replace content during loading to prevent layout shift.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-lg bg-white/5',
        'motion-safe:after:absolute motion-safe:after:inset-0',
        'motion-safe:after:bg-linear-to-r motion-safe:after:from-transparent motion-safe:after:via-white/[0.04] motion-safe:after:to-transparent',
        'motion-safe:after:animate-shimmer',
        className,
      )}
    />
  )
}

/** Multi-line text skeleton — alias kept for backward compatibility */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3 w-full', i === lines - 1 && 'w-3/5')}
        />
      ))}
    </div>
  )
}

/** Stack of skeleton rows for list/table loading states */
export function SkeletonRows({
  count = 3,
  rowClassName,
}: {
  count?: number
  rowClassName?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-10 w-full', rowClassName)} />
      ))}
    </div>
  )
}
