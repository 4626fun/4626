import { Fallback } from '@coinbase/cds-web/layout'
import { cn } from '@/lib/shared/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <span className={cn('block overflow-hidden', className)}>
      <Fallback width="100%" height="100%" shape="rectangle" />
    </span>
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Fallback
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
          shape="rectangle"
        />
      ))}
    </div>
  )
}

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
        <span key={i} className={cn('block', rowClassName)}>
          <Fallback width="100%" height={40} shape="rectangle" />
        </span>
      ))}
    </div>
  )
}
