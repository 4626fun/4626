import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-6 h-6 border-2',
}

interface SpinnerProps {
  size?: keyof typeof sizeClasses
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      aria-label="Loading"
      role="status"
      className={cn(
        'inline-block rounded-full border-brand-primary/30 border-t-brand-primary animate-spin',
        sizeClasses[size],
        className,
      )}
    />
  )
}
