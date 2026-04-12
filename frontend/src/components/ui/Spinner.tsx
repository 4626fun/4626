import { LoadingInline } from './LoadingState'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return <LoadingInline intent="processing" size={size} showLabel={false} className={className} />
}
